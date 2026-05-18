import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';

const app = express();
app.use(cors());
const port = process.env.PORT || 3001;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.get('/', (req, res) => {
  res.send('S2 realtime socket server is running');
});

const ROOM = 'shared-room';
let elements = [];

io.on('connection', (socket) => {
  socket.join(ROOM);
  console.log('A user connected:', socket.id);

  socket.emit('init-state', elements);

  const room = io.sockets.adapter.rooms.get(ROOM);
  io.to(ROOM).emit('presence', { count: room ? room.size : 0 });

  socket.on('element-create', (newElement) => {
    const element = { ...newElement, lastModified: newElement.lastModified ?? Date.now() };
    elements.push(element);
    socket.to(ROOM).emit('element-created', element);
  });

  socket.on('element-update', (updatedElement) => {
    const index = elements.findIndex(el => el.id === updatedElement.id);
    if (index !== -1) {
      if (!elements[index].lastModified || updatedElement.lastModified > elements[index].lastModified) {
        elements[index] = updatedElement;
        socket.to(ROOM).emit('element-updated', updatedElement);
      }
    } else {
      elements.push(updatedElement);
      socket.to(ROOM).emit('element-created', updatedElement);
    }
  });

  socket.on('element-delete', (elementId) => {
    elements = elements.filter(el => el.id !== elementId);
    socket.to(ROOM).emit('element-deleted', elementId);
  });

  socket.on('board-state', (serverElements) => {
    elements = serverElements;
    socket.to(ROOM).emit('board-state', serverElements);
  });

  socket.on('scalability.ping', ({ clientId, ts }) => {
    socket.emit('scalability.pong', { clientId, ts, serverTs: Date.now() });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const roomAfter = io.sockets.adapter.rooms.get(ROOM);
    io.to(ROOM).emit('presence', { count: roomAfter ? roomAfter.size : 0 });
  });
});

server.listen(port, () => {
  console.log(`S2 realtime socket server listening on http://localhost:${port}`);
});
