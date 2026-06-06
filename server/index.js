
import cors from 'cors';
import { app, server, express, initializeSocket } from './socket/socket.js';
import authRoutes from './routes/auth.js';
import roomsRoutes from './routes/rooms.js';

console.log('[Server] Starting up...');
console.log('[Server] NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('[Server] PORT:', process.env.PORT || 8000);

import rateLimit from 'express-rate-limit';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging middleware - silenced in production (L1)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === '1') {
    console.log(`[HTTP] ${req.method} ${req.url}`);
  }
  next();
});

// Rate limiting (C3)
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login or registration attempts, please try again after 15 minutes.' }
});

app.use('/auth', authLimiter, authRoutes);
app.use('/rooms', standardLimiter, roomsRoutes);

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

// Graceful shutdown handling (M5)
const gracefulShutdown = (signal) => {
  console.log(`\n[Server] 🛑 Received ${signal}, starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(async () => {
    console.log('[Server] HTTP/WS server closed.');
    
    try {
      const { pool } = await import('./lib/db.js');
      await pool.end();
      console.log('[Server] Postgres connection pool ended.');
    } catch (err) {
      console.error('[Server] Error closing Postgres pool:', err.message);
    }
    
    try {
      const { pubClient, subClient } = await import('./lib/redis.js');
      await pubClient.quit();
      await subClient.quit();
      console.log('[Server] Redis connections closed.');
    } catch (err) {
      console.error('[Server] Error closing Redis clients:', err.message);
    }
    
    console.log('[Server] Graceful shutdown completed. Exiting.');
    process.exit(0);
  });

  // Bounded timeout to force shutdown if drainage stalls
  setTimeout(() => {
    console.error('[Server] Force exiting due to shutdown timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
