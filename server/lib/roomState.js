/**
 * Redis-backed shared room state.
 *
 * Why this exists
 * ---------------
 * When running multiple Socket.IO instances behind a load balancer, each
 * Node.js process has its own memory. State that used to live in plain
 * `Map`s (room owners, pending join requests, cached room metadata) is
 * therefore per-instance, which causes:
 *   • Owners connected to instance A cannot approve join requests that
 *     landed on instance B ("room not found" / "no pending request").
 *   • Presence counts are local — instance A reports 2 peers, instance B
 *     reports 1, the client sees a flicker.
 *   • Two instances may both flush `board-state` to the DB and clobber
 *     each other.
 *
 * Everything in this module is stored in Redis so all 8 app instances
 * see the same picture, regardless of which instance handled the HTTP
 * request or the WebSocket upgrade.
 *
 * Key layout
 * ----------
 *   room:<roomId>:owners          SET    socketIds of connected owners
 *   room:<roomId>:join-requests   HASH   pendingSocketId -> JSON(user, ts)
 *   room:<roomId>:meta            HASH   { ownerId, accessMode, name } (cached)
 *   room:<roomId>:meta-exp        STRING TTL marker (cache validity)
 *   room:meta-cache:room:<id>     STRING TTL key (alternative TTL form)
 *
 * Cross-instance notifications (one-shot, fire-and-forget)
 * --------------------------------------------------------
 *   room:<roomId>:owner-notify    PUB    join-request / owner-left events
 *   room:<roomId>:presence        PUB    presence delta broadcasts
 *   room:<roomId>:state-invalidate PUB  tells peers to drop cached state
 *
 * Subscribers in `socket.js` handle the pmessage channel and forward
 * to locally connected sockets. This is the same pattern as the
 * element/chat events that already work cross-instance.
 */

import { pubClient, subClient } from './redis.js';

const PREFIX = 'room';
const k = (roomId, ...parts) => [PREFIX, roomId, ...parts].join(':');

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                             */
/* -------------------------------------------------------------------------- */

function roomIdOf(roomId) {
  return String(roomId);
}

function nowMs() {
  return Date.now();
}

/* -------------------------------------------------------------------------- */
/*  Owners (room owners currently connected on any instance)                 */
/* -------------------------------------------------------------------------- */

/**
 * Add a socket as an owner of the given room.
 * @returns {Promise<number>} new total owner count across all instances
 */
export async function addOwner(roomId, socketId) {
  const key = k(roomIdOf(roomId), 'owners');
  await pubClient.sadd(key, socketId);
  return pubClient.scard(key);
}

export async function removeOwner(roomId, socketId) {
  const key = k(roomIdOf(roomId), 'owners');
  await pubClient.srem(key, socketId);
  return pubClient.scard(key);
}

export async function getOwners(roomId) {
  const key = k(roomIdOf(roomId), 'owners');
  return pubClient.smembers(key);
}

export async function getOwnerCount(roomId) {
  const key = k(roomIdOf(roomId), 'owners');
  return pubClient.scard(key);
}

/* -------------------------------------------------------------------------- */
/*  Pending join requests (for `access_mode === 'manual'`)                   */
/* -------------------------------------------------------------------------- */

const JOIN_REQUEST_TTL_SEC = 120; // auto-expire orphan requests

/**
 * Add a pending join request.
 * @param roomId
 * @param pendingSocketId  the socket.id of the user waiting for approval
 * @param user             { id, username }
 */
export async function addJoinRequest(roomId, pendingSocketId, user) {
  const key = k(roomIdOf(roomId), 'join-requests');
  const payload = JSON.stringify({ user, ts: nowMs() });
  await pubClient.hset(key, pendingSocketId, payload);
  await pubClient.expire(key, JOIN_REQUEST_TTL_SEC * 4);
  return payload;
}

export async function getJoinRequest(roomId, pendingSocketId) {
  const key = k(roomIdOf(roomId), 'join-requests');
  const raw = await pubClient.hget(key, pendingSocketId);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function listJoinRequests(roomId) {
  const key = k(roomIdOf(roomId), 'join-requests');
  const all = await pubClient.hgetall(key);
  const out = {};
  for (const [sid, raw] of Object.entries(all || {})) {
    try { out[sid] = JSON.parse(raw); } catch { /* ignore corrupt */ }
  }
  return out;
}

export async function removeJoinRequest(roomId, pendingSocketId) {
  const key = k(roomIdOf(roomId), 'join-requests');
  await pubClient.hdel(key, pendingSocketId);
}

/* -------------------------------------------------------------------------- */
/*  Room metadata cache (short-lived)                                         */
/* -------------------------------------------------------------------------- */

const META_TTL_SEC = 30;

/**
 * Cache the basic room metadata so the socket connection handler does not
 * hit Postgres on every reconnect / refresh. The DB is the source of
 * truth — we only cache for a few seconds.
 */
export async function cacheRoomMeta(roomId, meta) {
  const id = roomIdOf(roomId);
  const key = k(id, 'meta');
  const flat = {};
  for (const [k2, v] of Object.entries(meta || {})) {
    if (v === undefined || v === null) continue;
    flat[k2] = String(v);
  }
  await pubClient.hset(key, flat);
  await pubClient.expire(key, META_TTL_SEC);
}

export async function getCachedRoomMeta(roomId) {
  const id = roomIdOf(roomId);
  const key = k(id, 'meta');
  const flat = await pubClient.hgetall(key);
  if (!flat || Object.keys(flat).length === 0) return null;
  // Keep id and created_by as strings to support UUID rooms and 64-bit user IDs
  if (flat.id) flat.id = String(flat.id);
  if (flat.created_by) flat.created_by = String(flat.created_by);
  return flat;
}

/* -------------------------------------------------------------------------- */
/*  Cross-instance notifications                                              */
/* -------------------------------------------------------------------------- */

/**
 * Notify owner-side sockets (on ANY instance) that a user is waiting.
 * Local instance also receives it — that's fine, the local pmessage
 * handler will look up its own connected owners and forward to them.
 */
export async function publishJoinRequest(roomId, { pendingSocketId, user }) {
  const channel = k(roomIdOf(roomId), 'owner-notify');
  await pubClient.publish(
    channel,
    JSON.stringify({
      type: 'join-request',
      pendingSocketId,
      user,
      ts: nowMs(),
    })
  );
}

/**
 * Notify all instances that the owner list for a room changed.
 */
export async function publishOwnerChange(roomId, { ownerSocketId, change }) {
  const channel = k(roomIdOf(roomId), 'owner-notify');
  await pubClient.publish(
    channel,
    JSON.stringify({
      type: 'owner-change',
      ownerSocketId,
      change, // 'add' | 'remove'
      ts: nowMs(),
    })
  );
}

/**
 * Tell all instances to invalidate their in-memory element cache.
 * Used after `board-state` (full board replacement) to make sure every
 * instance reloads the same fresh state from the DB.
 */
export async function publishStateInvalidate(roomId) {
  const channel = k(roomIdOf(roomId), 'state-invalidate');
  await pubClient.publish(
    channel,
    JSON.stringify({ type: 'invalidate', ts: nowMs() })
  );
}

/**
 * Broadcast a presence delta for a room. Each instance sums its own
 * local members and adds the count of owners tracked in Redis, so the
 * final number is consistent across the cluster.
 */
export async function publishPresence(roomId, presenceData) {
  const channel = k(roomIdOf(roomId), 'presence');
  await pubClient.publish(
    channel,
    JSON.stringify({ type: 'presence', ...presenceData, ts: nowMs() })
  );
}

/* -------------------------------------------------------------------------- */
/*  Combined presence (owners tracked in Redis + local sockets)               */
/* -------------------------------------------------------------------------- */

/**
 * Returns the *cluster-wide* presence for a room.
 * `localAdapterCount` is what `io.sockets.adapter.rooms.get(roomKey).size`
 * reports on the current instance.
 */
export async function getClusterPresence(roomId, localAdapterCount) {
  const ownerCount = await getOwnerCount(roomId);
  // Owners are a subset of joined sockets, so we use the max of (local
  // adapter count, owner count + non-owner local members). The simpler
  // model that matches reality: total = localAdapterCount (this instance)
  // + remoteOwners (owners connected to other instances that we can't see).
  const remoteOwnerCount = Math.max(0, ownerCount); // every owner is either local or remote
  return localAdapterCount + Math.max(0, ownerCount - Math.min(ownerCount, localAdapterCount));
}

/* -------------------------------------------------------------------------- */
/*  Subscriber pattern setup                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Subscribe to all cross-instance room channels.
 * Returns a Map<channel, handlerFn> that the caller can register in
 * `subClient.on('pmessage', ...)` once.
 */
export async function subscribeRoomChannels() {
  await subClient.psubscribe('room:*:owner-notify');
  await subClient.psubscribe('room:*:state-invalidate');
  await subClient.psubscribe('room:*:presence');
  console.log('🟢 Subscribed to room:*:owner-notify, state-invalidate, presence');
}

/**
 * Extract the roomId from a channel name like
 *   "room:42:owner-notify"
 */
export function parseRoomChannel(channel) {
  const m = channel.match(/^room:([^:]+):(owner-notify|state-invalidate|presence)$/);
  if (!m) return null;
  return { roomId: String(m[1]), type: m[2] };
}
