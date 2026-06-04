import "dotenv/config";
import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import { createRedisAdapter, pubClient, subClient } from '../lib/redis.js';
import { verifyToken } from '../lib/jwt.js';
import { findRoomById, loadRoomState, saveRoomState, saveMessage, fetchMessages } from '../lib/db.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const DEBUG = process.env.DEBUG === '1' || process.env.NODE_ENV !== 'production';

const roomStates = new Map();
// roomId -> Set(socketId) for owners currently connected
const roomOwners = new Map();
// roomId -> Map(socketId -> { user }) pending join requests
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

export async function initializeSocket() {
  const adapter = await createRedisAdapter();
  io.adapter(adapter);
  console.log('Socket.IO Redis adapter configured');

  // Subscribe to custom Redis pub/sub channels for cross-server event forwarding
  // This enables communication between separate server processes
  await subClient.psubscribe('room:*:events');
  console.log('Subscribed to room:*:events pattern on Redis');
}

/**
 * Redis pub/sub message handler.
 * Forwards events published via Redis back to Socket.IO room clients.
 * Uses senderSocketId to exclude the originating socket (prevents duplicates).
 * 
 * Channel format: room:<roomId>:events
 * Message format: JSON { event: string, data: any, senderSocketId?: string }
 */
subClient.on('pmessage', (pattern, channel, message) => {
  try {
    const match = channel.match(/^room:(\d+):events$/);
    if (!match) return;

    const roomKey = String(match[1]);
    const parsed = JSON.parse(message);
    const { event, data, senderSocketId } = parsed;

    // Forward to all sockets in the room EXCEPT the sender
    // This works across server processes: same-process sender is excluded,
    // and other processes may not have the sender socket at all (harmless except)
    if (senderSocketId) {
      io.to(roomKey).except(senderSocketId).emit(event, data);
    } else {
      io.to(roomKey).emit(event, data);
    }
    if (DEBUG) console.log(`[Redis → Room ${roomKey}] Forwarded event: ${event}`);
  } catch (err) {
    console.error('Failed to process Redis pub/sub message:', err.message);
  }
});

subClient.on('psubscribe', (pattern, count) => {
  if (DEBUG) console.log(`🔊 Redis psubscribed to pattern: ${pattern} (${count} total)`);
});

subClient.on('error', (err) => {
  console.error('🔴 Redis subscriber error:', err.message);
});

io.on('connection', async (socket) => {
  const { roomId, token } = socket.handshake.auth || {};

  if (DEBUG) console.log('handshake.auth:', socket.handshake.auth);
  if (!roomId || !token) {
    socket.emit('error', 'Room ID and authentication token are required.');
    return;
  }

  let user;
  try {
    user = verifyToken(token);
  } catch (error) {
    socket.emit('error', 'Invalid authentication token.');
    socket.disconnect(true);
    return;
  }

  const room = await findRoomById(Number(roomId));
  if (!room) {
    socket.emit('error', 'Room not found.');
    socket.disconnect(true);
    return;
  }

  const roomKey = String(room.id);

  // If owner connects, track owner sockets
  if (user.id === room.created_by) {
    if (!roomOwners.has(roomKey)) roomOwners.set(roomKey, new Set());
    roomOwners.get(roomKey).add(socket.id);
    socket.data.isRoomOwner = true;
  }

  // Handle access modes
  if (room.access_mode === 'manual' && user.id !== room.created_by) {
    // Add to pending requests and notify owners for approval
    if (!pendingJoinRequests.has(roomKey)) pendingJoinRequests.set(roomKey, new Map());
    pendingJoinRequests.get(roomKey).set(socket.id, { user });
    socket.emit('awaiting-approval');
    // notify owners
    const owners = roomOwners.get(roomKey);
    if (owners && owners.size > 0) {
      for (const ownerSocketId of owners) {
        const ownerSocket = io.sockets.sockets.get(ownerSocketId);
        if (ownerSocket) {
          ownerSocket.emit('join-request', { socketId: socket.id, user: { id: user.id, username: user.username } });
        }
      }
    }
    if (DEBUG) console.log('User awaiting manual approval:', socket.id, 'room:', roomKey, 'user:', user.username);
  } else {
    // Default: join room immediately
    socket.join(roomKey);
    if (DEBUG) console.log('A user connected:', socket.id, 'room:', roomKey, 'user:', user.username);

    const roomElements = (await getRoomState(room.id)) || [];
    socket.emit('init-state', roomElements);

    // send recent chat history
    try {
      const messages = await fetchMessages(room.id);
      socket.emit('chat-history', messages);
    } catch (err) {
      if (DEBUG) console.error('Failed to load chat history:', err.message || err);
    }

    const roomData = io.sockets.adapter.rooms.get(roomKey);
    io.to(roomKey).emit('presence', { count: roomData ? roomData.size : 0 });
  }

  /**
   * Element event handling pattern:
   * 1. Persist the change to the in-memory cache and database
   * 2. Publish the event to Redis so other server processes receive it
   * 3. The Redis subClient pmessage handler then forwards to all sockets
   *    in the room except the sender (preventing double-delivery)
   * 
   * Direct socket.to(roomKey).emit() is intentionally NOT used here
   * to avoid double delivery — the pmessage handler is the single
   * source of truth for broadcasting to peers.
   */

  socket.on('element-create', async (newElement) => {
    if (DEBUG) console.log('Received element create:', newElement);
    const existing = (await getRoomState(room.id)) || [];
    const element = { ...newElement, lastModified: newElement.lastModified ?? Date.now() };
    const updated = [...existing, element];
    await persistRoomState(room.id, updated);
    // Publish to Redis — pmessage handler will forward to all peers except sender
    try {
      await pubClient.publish(`room:${roomKey}:events`, JSON.stringify({
        event: 'element-created',
        data: element,
        senderSocketId: socket.id
      }));
    } catch (err) {
      console.error('Failed to publish element-created to Redis:', err);
    }
  });

  // Join response from owner: { socketId, accept }
  socket.on('join-response', async ({ socketId, accept }) => {
    try {
      const pending = pendingJoinRequests.get(roomKey);
      if (!pending || !pending.has(socketId)) return;
      const { user: pendingUser } = pending.get(socketId);
      const targetSocket = io.sockets.sockets.get(socketId);
      if (!targetSocket) {
        pending.delete(socketId);
        return;
      }
      if (accept) {
        targetSocket.join(roomKey);
        // send state and chat history
        const roomElements = (await getRoomState(room.id)) || [];
        targetSocket.emit('init-state', roomElements);
        const messages = await fetchMessages(room.id);
        targetSocket.emit('chat-history', messages);
        const roomData = io.sockets.adapter.rooms.get(roomKey);
        io.to(roomKey).emit('presence', { count: roomData ? roomData.size : 0 });
        targetSocket.emit('join-accepted');
      } else {
        targetSocket.emit('join-rejected');
        targetSocket.disconnect(true);
      }
      pending.delete(socketId);
    } catch (err) {
      console.error('Error handling join-response:', err.message || err);
    }
  });

  // Chat messaging
  socket.on('chat-message', async ({ message }) => {
    try {
      if (!message || typeof message !== 'string') return;
      const saved = await saveMessage(room.id, user.id, user.username, message);
      const payload = { id: saved.id, room_id: saved.room_id, user_id: saved.user_id, username: saved.username, message: saved.message, created_at: saved.created_at };
      await pubClient.publish(`room:${roomKey}:events`, JSON.stringify({ event: 'chat-message', data: payload, senderSocketId: socket.id }));
    } catch (err) {
      console.error('Failed to handle chat-message:', err.message || err);
    }
  });

  socket.on('element-update', async (updatedElement) => {
    if (DEBUG) console.log('Received element update:', updatedElement);
    const existing = (await getRoomState(room.id)) || [];
    const index = existing.findIndex((el) => el.id === updatedElement.id);
    if (index !== -1) {
      if (!existing[index].lastModified || updatedElement.lastModified > existing[index].lastModified) {
        const updated = [...existing];
        updated[index] = updatedElement;
        await persistRoomState(room.id, updated);
        try {
          await pubClient.publish(`room:${roomKey}:events`, JSON.stringify({
            event: 'element-updated',
            data: updatedElement,
            senderSocketId: socket.id
          }));
        } catch (err) {
          console.error('Failed to publish element-updated to Redis:', err);
        }
      }
    } else {
      // Element doesn't exist locally — treat as create
      const updated = [...existing, updatedElement];
      await persistRoomState(room.id, updated);
      try {
        await pubClient.publish(`room:${roomKey}:events`, JSON.stringify({
          event: 'element-created',
          data: updatedElement,
          senderSocketId: socket.id
        }));
      } catch (err) {
        console.error('Failed to publish element-created to Redis:', err);
      }
    }
  });

  socket.on('element-delete', async (elementId) => {
    if (DEBUG) console.log('Received element delete:', elementId);
    const existing = (await getRoomState(room.id)) || [];
    const updated = existing.filter((el) => el.id !== elementId);
    await persistRoomState(room.id, updated);
    try {
      await pubClient.publish(`room:${roomKey}:events`, JSON.stringify({
        event: 'element-deleted',
        data: elementId,
        senderSocketId: socket.id
      }));
    } catch (err) {
      console.error('Failed to publish element-deleted to Redis:', err);
    }
  });

  socket.on('board-state', async (serverElements) => {
    await persistRoomState(room.id, serverElements);
    try {
      await pubClient.publish(`room:${roomKey}:events`, JSON.stringify({
        event: 'board-state',
        data: serverElements,
        senderSocketId: socket.id
      }));
    } catch (err) {
      console.error('Failed to publish board-state to Redis:', err);
    }
  });

  socket.on('scalability.ping', ({ clientId, ts }) => {
    socket.emit('scalability.pong', { clientId, ts, serverTs: Date.now() });
  });

  socket.on('disconnect', () => {
    if (DEBUG) console.log('User disconnected:', socket.id, 'room:', roomKey);
    // remove from owner tracking
    if (socket.data.isRoomOwner) {
      const owners = roomOwners.get(roomKey);
      if (owners) {
        owners.delete(socket.id);
        if (owners.size === 0) roomOwners.delete(roomKey);
      }
    }
    // remove pending request if present
    const pending = pendingJoinRequests.get(roomKey);
    if (pending && pending.has(socket.id)) pending.delete(socket.id);

    const roomAfter = io.sockets.adapter.rooms.get(roomKey);
    io.to(roomKey).emit('presence', { count: roomAfter ? roomAfter.size : 0 });
  });
});

export { server, app, express };