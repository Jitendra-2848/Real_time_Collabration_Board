import "dotenv/config";
import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import {
  createRedisAdapter,
  pubClient,
  subClient,
  INSTANCE_ID,
  waitForRedisReady,
} from '../lib/redis.js';
import { verifyToken } from '../lib/jwt.js';
import {
  findRoomById,
  loadRoomState,
  saveRoomState,
  saveMessage,
  fetchMessages,
} from '../lib/db.js';
import {
  addOwner,
  removeOwner,
  getOwners,
  getOwnerCount,
  addJoinRequest,
  getJoinRequest,
  removeJoinRequest,
  cacheRoomMeta,
  getCachedRoomMeta,
  publishJoinRequest,
  publishOwnerChange,
  publishStateInvalidate,
  publishPresence,
  subscribeRoomChannels,
  parseRoomChannel,
} from '../lib/roomState.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Make sure the WS upgrade is faster than the default 45s.
  pingTimeout: 30000,
  pingInterval: 25000,
  // Allow more buffer for slow clients
  maxHttpBufferSize: 1e7,
});

const DEBUG = process.env.DEBUG === '1' || process.env.NODE_ENV !== 'production';

/* -------------------------------------------------------------------------- */
/*  Local cache (per instance) — invalidated by Redis pub/sub                 */
/* -------------------------------------------------------------------------- */

// roomId -> elements[]
const roomStates = new Map();
// roomId -> Map(socketId -> { user })  — kept locally for performance; the
// source of truth is Redis (`room:<id>:join-requests`).
const pendingJoinRequests = new Map();

async function getRoomState(roomId) {
  const key = String(roomId);
  if (!roomStates.has(key)) {
    try {
      const state = await loadRoomState(roomId);
      roomStates.set(key, Array.isArray(state) ? state : []);
    } catch (error) {
      console.error('Failed to load room state:', error);
      roomStates.set(key, []);
    }
  }
  return roomStates.get(key);
}

async function persistRoomState(roomId, elements) {
  const key = String(roomId);
  roomStates.set(key, elements);
  try {
    await saveRoomState(roomId, elements);
  } catch (error) {
    console.error('Failed to persist room state:', error);
  }
}

function dropRoomStateCache(roomId) {
  const key = String(roomId);
  roomStates.delete(key);
}

/* -------------------------------------------------------------------------- */
/*  Resilient DB helpers (retries on transient failures)                      */
/* -------------------------------------------------------------------------- */

async function withRetry(fn, { tries = 3, baseDelayMs = 100, label = 'op' } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const wait = baseDelayMs * Math.pow(2, i);
      if (DEBUG) {
        console.warn(`[${INSTANCE_ID}] ${label} failed (try ${i + 1}/${tries}), retrying in ${wait}ms:`, err.message);
      }
      if (i < tries - 1) await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

/**
 * Look up a room by id, preferring the short-lived Redis cache to avoid
 * hammering Postgres on reconnect storms. Falls back to DB with retries.
 */
async function findRoomSafe(roomId) {
  const cached = await getCachedRoomMeta(roomId);
  if (cached && cached.id) return cached;

  const room = await withRetry(() => findRoomById(roomId), {
    tries: 3,
    baseDelayMs: 150,
    label: 'findRoomById',
  });

  if (room) {
    // Fire-and-forget: never block connection on cache write
    cacheRoomMeta(roomId, room).catch(() => {});
  }
  return room;
}

/* -------------------------------------------------------------------------- */
/*  Cross-instance presence                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Compute the cluster-wide presence and emit to local members.
 * Other instances receive the same event via the `room:*:presence` channel
 * and forward to their local members.
 */
async function broadcastPresence(roomKey) {
  try {
    const roomData = io.sockets.adapter.rooms.get(roomKey);
    const localCount = roomData ? roomData.size : 0;
    const ownerCount = await getOwnerCount(roomKey);
    // clusterMembers = localCount + remoteOwners (owners on other instances)
    // Remote non-owners can't be counted, so this is a lower-bound. In
    // practice most rooms are small enough that the majority of users
    // end up on one instance anyway thanks to nginx ip_hash.
    const remoteOwnerCount = Math.max(0, ownerCount - localCount);
    const clusterCount = localCount + remoteOwnerCount;
    await publishPresence(roomKey, { count: clusterCount, source: INSTANCE_ID });
  } catch (err) {
    if (DEBUG) console.error('broadcastPresence error:', err.message);
  }
}

function localPresenceCount(roomKey) {
  const roomData = io.sockets.adapter.rooms.get(roomKey);
  return roomData ? roomData.size : 0;
}

/* -------------------------------------------------------------------------- */
/*  Boot                                                                      */
/* -------------------------------------------------------------------------- */

export async function initializeSocket() {
  // Wait for Redis to be ready BEFORE setting up the adapter and
  // subscriptions — otherwise we miss messages published during boot.
  await waitForRedisReady();

  const adapter = await createRedisAdapter();
  io.adapter(adapter);
  console.log(`[${INSTANCE_ID}] Socket.IO Redis adapter configured`);

  // App-level cross-instance channels (room owners, join requests, etc.)
  await subscribeRoomChannels();

  // Element/chat pub/sub (existing behaviour)
  await subClient.psubscribe('room:*:events');
  console.log(`[${INSTANCE_ID}] Subscribed to room:*:events + room-level channels`);
}

/* -------------------------------------------------------------------------- */
/*  Redis pub/sub message handler — element / chat / owner / presence        */
/* -------------------------------------------------------------------------- */

subClient.on('pmessage', async (pattern, channel, message) => {
  try {
    // --- Element / chat events (existing) ---
    if (channel.includes(':events')) {
      const match = channel.match(/^room:(.+):events$/);
      if (!match) return;
      const roomKey = String(match[1]);
      const parsed = JSON.parse(message);
      const { event, data, senderSocketId } = parsed;
      if (senderSocketId) {
        io.to(roomKey).except(senderSocketId).emit(event, data);
      } else {
        io.to(roomKey).emit(event, data);
      }
      if (DEBUG) console.log(`[${INSTANCE_ID} → Room ${roomKey}] Forwarded event: ${event}`);
      return;
    }

    // --- Owner / join-request / presence / cache-invalidate ---
    const parsed = parseRoomChannel(channel);
    if (!parsed) return;
    const { roomId, type } = parsed;
    const roomKey = String(roomId);

    let payload = null;
    try {
      payload = JSON.parse(message);
    } catch (e) {
      // ignore parsing errors for non-json payloads
    }

    if (type === 'owner-notify') {
      if (payload && payload.type === 'join-request') {
        // Forward to any *locally connected* owner sockets. Redis already
        // fans this out to all instances — that's the whole point.
        const ownerSocketIds = await getOwners(roomKey);
        for (const ownerSocketId of ownerSocketIds) {
          const ownerSocket = io.sockets.sockets.get(ownerSocketId);
          if (ownerSocket) {
            ownerSocket.emit('join-request', {
              socketId: payload.pendingSocketId,
              user: payload.user,
            });
          }
        }
        // Track in local map for fast lookup (source of truth is Redis)
        if (!pendingJoinRequests.has(roomKey)) pendingJoinRequests.set(roomKey, new Map());
        pendingJoinRequests
          .get(roomKey)
          .set(payload.pendingSocketId, { user: payload.user });
        if (DEBUG) console.log(`[${INSTANCE_ID}] Forwarded join-request to ${ownerSocketIds.length} owner(s)`);
        return;
      }

      if (payload.type === 'owner-change') {
        // We just observe; no per-instance action required because the
        // truth lives in Redis.
        if (DEBUG) console.log(`[${INSTANCE_ID}] Owner change in room ${roomKey}: ${payload.change} ${payload.ownerSocketId}`);
        return;
      }
    }

    if (type === 'state-invalidate') {
      dropRoomStateCache(roomKey);
      if (DEBUG) console.log(`[${INSTANCE_ID}] Dropped local room-state cache for room ${roomKey}`);
      return;
    }

    if (type === 'presence') {
      // Don't double-emit from the source instance
      if (payload?.source === INSTANCE_ID) return;
      const count = Number(payload?.count || 0);
      io.to(roomKey).emit('presence', { count });
      if (DEBUG) console.log(`[${INSTANCE_ID}] Cross-instance presence update for room ${roomKey}: ${count}`);
      return;
    }
  } catch (err) {
    console.error('Failed to process Redis pub/sub message:', err.message);
  }
});

subClient.on('psubscribe', (pattern, count) => {
  if (DEBUG) console.log(`🔊 [${INSTANCE_ID}] psubscribed: ${pattern} (${count} total)`);
});
subClient.on('error', (err) => {
  console.error(`🔴 [${INSTANCE_ID}] Redis subscriber error:`, err.message);
});

/* -------------------------------------------------------------------------- */
/*  Connection handler                                                        */
/* -------------------------------------------------------------------------- */

io.on('connection', async (socket) => {
  console.log(`\n🔌 [${INSTANCE_ID}] New connection: socketId=${socket.id}`);
  const { roomId, token } = socket.handshake.auth || {};
  console.log(roomId);
  if (!roomId || !token) {
    console.error('❌ Connection failed: Missing roomId or token', { roomId });
    socket.emit('error', { code: 'BAD_HANDSHAKE', message: 'roomId and token are required' });
    socket.disconnect(true);
    return;
  }

  // Normalize roomId: the client sends a number, but everything in the
  // system uses string keys for the room name in Socket.IO adapter.
  const normalizedRoomId = roomId;
  console.log(`Room : ${roomId}, roomId=${normalizedRoomId}`);
  // if (!Number.isFinite(normalizedRoomId) || normalizedRoomId <= 0) {
  //   socket.emit('error', { code: 'INVALID_ROOM_ID', message: 'Invalid roomId' });
  //   socket.disconnect(true);
  //   return;
  // }
  const roomKey = String(normalizedRoomId);

  // Auth
  let user;
  try {
    user = verifyToken(token);
  } catch (error) {
    console.error('❌ Connection failed: Invalid token:', error.message);
    socket.emit('error', { code: 'INVALID_TOKEN', message: 'Invalid token' });
    socket.disconnect(true);
    return;
  }

  // Room lookup (with retries + Redis cache)
  console.log(normalizedRoomId);
  const room = await findRoomSafe(normalizedRoomId);
  console.log(normalizedRoomId, room ? 'found' : 'not found in DB');
  if (!room) {
    console.error('❌ Connection failed: Room not found in DB', { roomId: normalizedRoomId });
    socket.emit('error', {
      code: 'ROOM_NOT_FOUND',
      message: `Room ${normalizedRoomId} not found.`,
    });
    socket.disconnect(true);
    return;
  }

  // Track owner status (cluster-wide)
  const isOwner = user.id === room.created_by;
  socket.data.isRoomOwner = isOwner;
  socket.data.roomKey = roomKey;
  socket.data.user = { id: user.id, username: user.username };

  if (isOwner) {
    await addOwner(roomKey, socket.id);
    await publishOwnerChange(roomKey, { ownerSocketId: socket.id, change: 'add' });
  }

  if (room.access_mode === 'manual' && !isOwner) {
    // Manual approval: register the request in Redis so any instance
    // can resolve it. Notify ALL owners across the cluster via pub/sub.
    await addJoinRequest(roomKey, socket.id, { id: user.id, username: user.username });

    if (!pendingJoinRequests.has(roomKey)) pendingJoinRequests.set(roomKey, new Map());
    pendingJoinRequests.get(roomKey).set(socket.id, { user });

    socket.emit('awaiting-approval');
    await publishJoinRequest(roomKey, {
      pendingSocketId: socket.id,
      user: { id: user.id, username: user.username },
    });
    if (DEBUG) console.log(`[${INSTANCE_ID}] Manual join request for room ${roomKey} from ${user.username}`);
  } else {
    // Default / open / link: join immediately
    socket.join(roomKey);
    if (DEBUG) console.log(`[${INSTANCE_ID}] User joined: ${user.username} → room ${roomKey}`);

    try {
      const roomElements = (await getRoomState(normalizedRoomId)) || [];
      socket.emit('init-state', roomElements);
    } catch (err) {
      socket.emit('init-state', []);
    }

    try {
      const messages = await fetchMessages(normalizedRoomId);
      socket.emit('chat-history', messages);
    } catch (err) {
      if (DEBUG) console.error('Failed to load chat history:', err.message || err);
    }

    // Local + cross-instance presence
    await broadcastPresence(roomKey);
  }

  /* ---------------------- element / chat handlers ---------------------- */
  // Pattern: persist → publish to Redis → ALL instances (incl. ours) get
  // the message and forward to their locally connected sockets except the
  // sender. This guarantees a single delivery path and works across all
  // 8 instances.

  socket.on('element-create', async (newElement) => {
    if (DEBUG) console.log('element-create:', newElement?.id);
    const existing = (await getRoomState(normalizedRoomId)) || [];
    const element = { ...newElement, lastModified: newElement.lastModified ?? Date.now() };
    const updated = [...existing, element];
    await persistRoomState(normalizedRoomId, updated);
    console.log(`room:${roomKey}:events`);
    try {
      await pubClient.publish(`room:${roomKey}:events`, JSON.stringify({
        event: 'element-created',
        data: element,
        senderSocketId: socket.id,
      }));
    } catch (err) {
      console.error('Failed to publish element-created:', err);
    }
  });

  socket.on('element-update', async (updatedElement) => {
    if (DEBUG) console.log('element-update:', updatedElement?.id);
    const existing = (await getRoomState(normalizedRoomId)) || [];
    const index = existing.findIndex((el) => el.id === updatedElement.id);
    if (index !== -1) {
      if (!existing[index].lastModified || updatedElement.lastModified > existing[index].lastModified) {
        const updated = [...existing];
        updated[index] = updatedElement;
        await persistRoomState(normalizedRoomId, updated);
        console.log(`room:${roomKey}:events`);
        try {
          await pubClient.publish(`room:${roomKey}:events`, JSON.stringify({
            event: 'element-updated',
            data: updatedElement,
            senderSocketId: socket.id,
          }));
        } catch (err) {
          console.error('Failed to publish element-updated:', err);
        }
      }
    } else {
      const updated = [...existing, updatedElement];
      await persistRoomState(normalizedRoomId, updated);
      try {
        await pubClient.publish(`room:${roomKey}:events`, JSON.stringify({
          event: 'element-created',
          data: updatedElement,
          senderSocketId: socket.id,
        }));
      } catch (err) {
        console.error('Failed to publish element-created:', err);
      }
    }
  });

  socket.on('element-delete', async (elementId) => {
    if (DEBUG) console.log('element-delete:', elementId);
    const existing = (await getRoomState(normalizedRoomId)) || [];
    const updated = existing.filter((el) => el.id !== elementId);
    await persistRoomState(normalizedRoomId, updated);
    try {
      await pubClient.publish(`room:${roomKey}:events`, JSON.stringify({
        event: 'element-deleted',
        data: elementId,
        senderSocketId: socket.id,
      }));
    } catch (err) {
      console.error('Failed to publish element-deleted:', err);
    }
  });

  socket.on('board-state', async (serverElements) => {
    await persistRoomState(normalizedRoomId, serverElements);
    try {
      await pubClient.publish(`room:${roomKey}:events`, JSON.stringify({
        event: 'board-state',
        data: serverElements,
        senderSocketId: socket.id,
      }));
      // Tell other instances to drop their in-memory cache so a fresh
      // join on a different instance gets the new state from the DB.
      await publishStateInvalidate(roomKey);
    } catch (err) {
      console.error('Failed to publish board-state:', err);
    }
  });

  socket.on('chat-message', async ({ message }) => {
    try {
      if (!message || typeof message !== 'string') return;
      const saved = await saveMessage(normalizedRoomId, user.id, user.username, message);
      const payload = {
        id: saved.id,
        room_id: saved.room_id,
        user_id: saved.user_id,
        username: saved.username,
        message: saved.message,
        created_at: saved.created_at,
      };
      await pubClient.publish(`room:${roomKey}:events`, JSON.stringify({
        event: 'chat-message',
        data: payload,
        senderSocketId: socket.id,
      }));
    } catch (err) {
      console.error('Failed to handle chat-message:', err.message || err);
    }
  });

  // Join response from owner: { socketId, accept }
  socket.on('join-response', async ({ socketId: targetSocketId, accept }) => {
    try {
      // Look up the pending request in Redis (works regardless of which
      // instance received the original join-request).
      const pending = await getJoinRequest(roomKey, targetSocketId);
      if (!pending) {
        if (DEBUG) console.log(`[${INSTANCE_ID}] join-response: no pending request for ${targetSocketId}`);
        return;
      }

      // Find the target socket — could be on ANY instance via the adapter.
      // io.sockets.sockets only has LOCAL sockets, so we use the adapter
      // to look up the correct nodeId.
      const targetSocket = await findSocketAcrossCluster(roomKey, targetSocketId);
      if (!targetSocket) {
        await removeJoinRequest(roomKey, targetSocketId);
        return;
      }

      if (accept) {
        targetSocket.join(roomKey);
        try {
          const roomElements = (await getRoomState(normalizedRoomId)) || [];
          targetSocket.emit('init-state', roomElements);
          const messages = await fetchMessages(normalizedRoomId);
          targetSocket.emit('chat-history', messages);
        } catch (err) {
          console.error('join-response: failed to send state', err);
        }
        await broadcastPresence(roomKey);
        targetSocket.emit('join-accepted');
      } else {
        targetSocket.emit('join-rejected');
        targetSocket.disconnect(true);
      }
      await removeJoinRequest(roomKey, targetSocketId);
      // Local fast-path cache cleanup
      const localMap = pendingJoinRequests.get(roomKey);
      if (localMap) localMap.delete(targetSocketId);
    } catch (err) {
      console.error('Error handling join-response:', err.message || err);
    }
  });

  socket.on('scalability.ping', ({ clientId, ts }) => {
    socket.emit('scalability.pong', { clientId, ts, serverTs: Date.now() });
  });

  socket.on('disconnect', async () => {
    if (DEBUG) console.log(`[${INSTANCE_ID}] Disconnect: ${socket.id} room=${roomKey}`);

    if (socket.data.isRoomOwner) {
      try {
        await removeOwner(roomKey, socket.id);
        await publishOwnerChange(roomKey, { ownerSocketId: socket.id, change: 'remove' });
      } catch (err) {
        console.error('Failed to remove owner from Redis:', err);
      }
    }

    const localMap = pendingJoinRequests.get(roomKey);
    if (localMap && localMap.has(socket.id)) {
      localMap.delete(socket.id);
      // Best-effort cleanup of the Redis copy too
      removeJoinRequest(roomKey, socket.id).catch(() => {});
    }

    // Recompute presence for the room — only emit if the socket had
    // actually joined the room.
    if (socket.rooms.has(roomKey)) {
      await broadcastPresence(roomKey);
    }
  });
});

/**
 * Look up a socket by id across the whole cluster. Socket.IO's adapter
 * keeps a map of socketId -> nodeId; we use it to find the node, then
 * either grab the local socket or RPC to the remote node.
 */
async function findSocketAcrossCluster(roomKey, socketId) {
  // Fast path: try local first
  const local = io.sockets.sockets.get(socketId);
  if (local) return local;

  // Remote path: ask the adapter which node owns this socket, then
  // request a server-side socket reference.
  try {
    const adapter = io.of('/').adapter;
    const rooms = adapter.rooms; // Map<roomId, Set<socketId>>
    const sockets = adapter.sids; // Map<socketId, Set<roomId>>
    if (!sockets.has(socketId)) return null;
    // adapter.sids.get(socketId) is a Set of room names; we don't need
    // the value here, just the fact that it exists.
    // The socket.io server exposes `io.serverSideEmit` to RPC to a
    // specific node. Use it to get the remote socket reference.
    const allRooms = Array.from(rooms.entries());
    // We can't easily learn the nodeId from the public adapter API,
    // so use a brute-force `io.in(socketId).fetchSockets()` if available.
    if (typeof io.in === 'function') {
      const remote = await io.in(socketId).fetchSockets();
      if (remote && remote.length) return remote[0];
    }
  } catch (err) {
    if (DEBUG) console.error('findSocketAcrossCluster error:', err.message);
  }
  return null;
}

export { server, app, express };
