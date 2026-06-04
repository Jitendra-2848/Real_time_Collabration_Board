import cluster from 'cluster';
import os from 'os';
import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';

const argv = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value ?? 'true'];
}));

const TOTAL_CLIENTS = Number(argv.clients ?? 10000);
const WORKERS = Number(argv.workers ?? Math.max(1, os.cpus().length));
const SERVER_URL = process.env.SERVER_URL || argv.server || 'http://localhost:8000';
const ROOM_ID = Number(argv.roomId ?? 1);
const JWT_SECRET = process.env.JWT_SECRET || argv.jwtSecret || 'realtime-collab-secret';
const CONNECT_RATE = Number(argv.rate ?? 500); // connections per second across all workers
const DURATION = Number(argv.duration ?? 60); // seconds to run after connections complete

function now() { return Date.now(); }

if (cluster.isMaster) {
  console.log(`Master starting load test: ${TOTAL_CLIENTS} clients across ${WORKERS} workers`);
  const clientsPerWorker = Math.ceil(TOTAL_CLIENTS / WORKERS);
  let finished = 0;
  const aggregated = { connected: 0, failed: 0, disconnects: 0, pings: 0, totalPingMs: 0, records: [] };

  for (let w = 0; w < WORKERS; w++) {
    const startId = w * clientsPerWorker + 1;
    const worker = cluster.fork({ WORKER_CLIENTS: clientsPerWorker, START_ID: startId, SERVER_URL, ROOM_ID, JWT_SECRET, CONNECT_RATE, DURATION });
    worker.on('message', (msg) => {
      if (msg.type === 'stats') {
        finished += 1;
        aggregated.connected += msg.connected;
        aggregated.failed += msg.failed;
        aggregated.disconnects += msg.disconnects;
        aggregated.pings += msg.pings;
        aggregated.totalPingMs += msg.totalPingMs;
        aggregated.records.push(msg.record);
        console.log(`Worker ${worker.id} finished: connected=${msg.connected} failed=${msg.failed} avgPing=${msg.pings?Math.round(msg.totalPingMs/msg.pings):0}ms`);
        if (finished === WORKERS) {
          const avgPing = aggregated.pings ? (aggregated.totalPingMs / aggregated.pings) : 0;
          const result = { clients: TOTAL_CLIENTS, workers: WORKERS, connected: aggregated.connected, failed: aggregated.failed, disconnects: aggregated.disconnects, avgPingMs: avgPing, records: aggregated.records, timestamp: new Date().toISOString() };
          console.log('--- Load test result ---');
          console.log(JSON.stringify(result, null, 2));
        }
      }
    });
  }
} else {
  // Worker code
  const WORKER_CLIENTS = Number(process.env.WORKER_CLIENTS || 1000);
  const START_ID = Number(process.env.START_ID || 1);
  const SERVER = process.env.SERVER_URL || 'http://localhost:8000';
  const ROOM = Number(process.env.ROOM_ID || 1);
  const SECRET = process.env.JWT_SECRET || 'realtime-collab-secret';
  const RATE = Number(process.env.CONNECT_RATE || 200);
  const DURATION_S = Number(process.env.DURATION || 30);

  const clients = [];
  let connected = 0;
  let failed = 0;
  let disconnects = 0;
  let pings = 0;
  let totalPingMs = 0;

  const startTime = now();
  const perWorkerIntervalMs = Math.max(1, Math.floor(1000 * WORKER_CLIENTS / RATE));
  // create clients staggered
  (async () => {
    for (let i = 0; i < WORKER_CLIENTS; i++) {
      const id = START_ID + i;
      const token = jwt.sign({ userId: id, username: `loaduser-${id}` }, SECRET, { expiresIn: '7d' });
      const socket = io(SERVER, { auth: { roomId: ROOM, token }, transports: ['websocket'], reconnection: false, timeout: 20000, upgrade: false });
      clients.push(socket);

      const connectStart = now();
      socket.on('connect', () => {
        connected += 1;
        const connMs = now() - connectStart;
        // send a ping for latency
        socket.emit('scalability.ping', { clientId: id, ts: now() });
      });

      socket.on('connect_error', () => {
        failed += 1;
      });

      socket.on('disconnect', () => {
        disconnects += 1;
      });

      socket.on('scalability.pong', ({ clientId, ts }) => {
        const latency = now() - ts;
        pings += 1;
        totalPingMs += latency;
      });

      // throttle connection creation
      await new Promise(r => setTimeout(r, perWorkerIntervalMs));
    }

    // let sockets run for duration then report
    await new Promise(r => setTimeout(r, DURATION_S * 1000));

    // cleanup
    clients.forEach(s => { try { s.disconnect(); } catch (e) {} });

    const record = { workerId: cluster.worker.id, clients: WORKER_CLIENTS, connected, failed, disconnects, pings, totalPingMs };
    process.send({ type: 'stats', ...record });
    process.exit(0);
  })().catch(err => {
    console.error('Worker error', err);
    process.exit(1);
  });
}
