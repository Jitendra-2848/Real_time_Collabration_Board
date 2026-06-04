
import cors from 'cors';
import { app, server, express, initializeSocket } from './socket/socket.js';
import authRoutes from './routes/auth.js';
import roomsRoutes from './routes/rooms.js';

console.log('[Server] Starting up...');
console.log('[Server] NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('[Server] PORT:', process.env.PORT || 8000);

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

app.use('/auth', authRoutes);
app.use('/rooms', roomsRoutes);

const port = process.env.PORT || 8000;

console.log('[Server] Initializing socket...');
await initializeSocket();
console.log('[Server] Socket initialized successfully');

app.get('/', (req, res) => {
  res.send('S2 realtime socket server is running');
});
app.get("/check", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(),instanceId: process.env.INSTANCE_ID || null});
});

// Global error handler — catches unhandled route errors and async errors
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message || err);
  console.error(err.stack || err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

server.listen(port, () => {
  console.log(`[Server] ✅ S2 realtime socket server listening on http://localhost:${port}`);
});

// Catch unhandled rejections and uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] ⚠️  Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Server] ⚠️  Uncaught Exception:', err.message || err);
  console.error(err.stack || err);
});
