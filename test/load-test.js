import { io } from 'socket.io-client';
import process from 'process';

const argv = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value ?? 'true'];
}));

const CLIENTS = Number(argv.clients ?? 2000);
const RATE = Number(argv.rate ?? 200);
const DURATION = Number(argv.duration ?? 30);
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

const clients = [];
let connected = 0;
let failed = 0;
let disconnects = 0;
let pings = 0;
let totalLatency = 0;

const records = [];

const createClient = (index) => new Promise((resolve) => {
  const socket = io(SERVER_URL, { transports: ['websocket'], reconnection: false, timeout: 10000 });

  const start = Date.now();

  socket.on('connect', () => {
    connected += 1;
    const connectMs = Date.now() - start;
    records.push({ phase: 'connect', index, latency: connectMs });
    socket.emit('scalability.ping', { clientId: index, ts: Date.now() });
    resolve(socket);
  });

  socket.on('connect_error', () => {
    failed += 1;
    resolve(null);
  });

  socket.on('disconnect', () => {
    disconnects += 1;
  });

  socket.on('scalability.pong', ({ clientId, ts }) => {
    const latency = Date.now() - ts;
    pings += 1;
    totalLatency += latency;
    records.push({ phase: 'pong', clientId, latency });
  });
});

const run = async () => {
  console.log(`Starting load test: ${CLIENTS} clients, ${RATE} connect/s, ${DURATION}s duration, server=${SERVER_URL}`);

  for (let i = 0; i < CLIENTS; i += 1) {
    const socket = await createClient(i);
    if (socket) clients.push(socket);
    await new Promise(r => setTimeout(r, 1000 / RATE));
  }

  console.log(`Connected ${connected}/${CLIENTS}, failed ${failed}`);
  console.log('Running duration phase...');

  const interval = setInterval(() => {
    for (const socket of clients) {
      if (socket.connected) {
        socket.emit('scalability.ping', { clientId: socket.id, ts: Date.now() });
      }
    }
  }, 1000);

  await new Promise(r => setTimeout(r, DURATION * 1000));
  clearInterval(interval);

  console.log('Closing sockets...');
  clients.forEach(socket => { if (socket.connected) socket.disconnect(); });

  const avgLatency = pings > 0 ? (totalLatency / pings).toFixed(2) : 0;
  console.log('--- Load test results ---');
  console.log(`Connected: ${connected}`);
  console.log(`Failed: ${failed}`);
  console.log(`Disconnects: ${disconnects}`);
  console.log(`Ping messages: ${pings}`);
  console.log(`Average latency: ${avgLatency} ms`);
};

run().catch(err => {
  console.error('Load test failed:', err);
  process.exit(1);
});
