import "dotenv/config";
import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import { createRedisAdapter } from '../lib/redis.js';
import { verifyToken } from '../lib/jwt.js';
import { findRoomById, loadRoomState, saveRoomState } from '../lib/db.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

const roomStates = new Map();

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
}

io.on('connection', async (socket) => {
  const { roomId, token } = socket.handshake.auth || {};

  if (!roomId || !token) {
    socket.emit('error', 'Room ID and authentication token are required.');
    socket.disconnect(true);
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
  socket.join(roomKey);
  console.log('A user connected:', socket.id, 'room:', roomKey, 'user:', user.username);

  const roomElements = (await getRoomState(room.id)) || [];
  socket.emit('init-state', roomElements);

  const roomData = io.sockets.adapter.rooms.get(roomKey);
  io.to(roomKey).emit('presence', { count: roomData ? roomData.size : 0 });

  socket.on('element-create', async (newElement) => {
    const existing = (await getRoomState(room.id)) || [];
    const element = { ...newElement, lastModified: newElement.lastModified ?? Date.now() };
    const updated = [...existing, element];
    await persistRoomState(room.id, updated);
    socket.to(roomKey).emit('element-created', element);
  });

  socket.on('element-update', async (updatedElement) => {
    const existing = (await getRoomState(room.id)) || [];
    const index = existing.findIndex((el) => el.id === updatedElement.id);
    if (index !== -1) {
      if (!existing[index].lastModified || updatedElement.lastModified > existing[index].lastModified) {
        const updated = [...existing];
        updated[index] = updatedElement;
        await persistRoomState(room.id, updated);
        socket.to(roomKey).emit('element-updated', updatedElement);
      }
    } else {
      const updated = [...existing, updatedElement];
      await persistRoomState(room.id, updated);
      socket.to(roomKey).emit('element-created', updatedElement);
    }
  });

  socket.on('element-delete', async (elementId) => {
    const existing = (await getRoomState(room.id)) || [];
    const updated = existing.filter((el) => el.id !== elementId);
    await persistRoomState(room.id, updated);
    socket.to(roomKey).emit('element-deleted', elementId);
  });

  socket.on('board-state', async (serverElements) => {
    await persistRoomState(room.id, serverElements);
    socket.to(roomKey).emit('board-state', serverElements);
  });

  socket.on('scalability.ping', ({ clientId, ts }) => {
    socket.emit('scalability.pong', { clientId, ts, serverTs: Date.now() });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id, 'room:', roomKey);
    const roomAfter = io.sockets.adapter.rooms.get(roomKey);
    io.to(roomKey).emit('presence', { count: roomAfter ? roomAfter.size : 0 });
  });
});

export { server, app, express };
