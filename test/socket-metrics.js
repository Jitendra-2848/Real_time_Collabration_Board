import { io } from 'socket.io-client';
import process from 'process';

const argv = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value ?? 'true'];
}));

const CONCURRENT_CLIENTS = Number(argv.clients ?? 100);
const SPAWN_RATE = Number(argv.rate ?? 20); // clients per second
const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:8000';

console.log(`========================================================`);
console.log(`📊 Socket.IO Backend Performance & Metrics Analyzer`);
console.log(`========================================================`);
console.log(`Server Target:       ${SERVER_URL}`);
console.log(`Target Clients:      ${CONCURRENT_CLIENTS}`);
console.log(`Connection Rate:     ${SPAWN_RATE} clients/sec`);
console.log(`========================================================\n`);

const clients = [];
let connectedCount = 0;
let connectionFailedCount = 0;
let disconnectCount = 0;

const connectionLatencies = [];
const pingPongLatencies = [];

const createTestClient = (id) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    // Connect directly to the sticky-session Nginx balancer
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000,
      forceNew: true
    });

    socket.on('connect', () => {
      connectedCount++;
      const latency = Date.now() - startTime;
      connectionLatencies.push(latency);
      
      // Perform ping-pong delay check immediately
      socket.emit('scalability.ping', { clientId: id, ts: Date.now() });
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      connectionFailedCount++;
      resolve(null);
    });

    socket.on('disconnect', () => {
      disconnectCount++;
    });

    socket.on('scalability.pong', ({ ts }) => {
      const latency = Date.now() - ts;
      pingPongLatencies.push(latency);
    });
  });
};

const runSuite = async () => {
  const startTime = Date.now();
  console.log(`⏳ Spawning test clients...`);

  for (let i = 0; i < CONCURRENT_CLIENTS; i++) {
    const socket = await createTestClient(i);
    if (socket) clients.push(socket);
    // Control spawn speed
    await new Promise(r => setTimeout(r, 1000 / SPAWN_RATE));
  }

  // Allow a short window for late pongs
  await new Promise(r => setTimeout(r, 1500));

  console.log(`\nDisconnecting test clients...`);
  clients.forEach(s => {
    if (s.connected) s.disconnect();
  });

  const totalTimeSec = ((Date.now() - startTime) / 1000).toFixed(2);

  // Compute Latency Statistics
  const avgConnectTime = connectionLatencies.length > 0 
    ? (connectionLatencies.reduce((a, b) => a + b, 0) / connectionLatencies.length).toFixed(1)
    : 0;
  const maxConnectTime = connectionLatencies.length > 0 ? Math.max(...connectionLatencies) : 0;
  const minConnectTime = connectionLatencies.length > 0 ? Math.min(...connectionLatencies) : 0;

  const avgPingPongTime = pingPongLatencies.length > 0
    ? (pingPongLatencies.reduce((a, b) => a + b, 0) / pingPongLatencies.length).toFixed(1)
    : 0;
  const maxPingPongTime = pingPongLatencies.length > 0 ? Math.max(...pingPongLatencies) : 0;

  const successRate = ((connectedCount / CONCURRENT_CLIENTS) * 100).toFixed(1);

  console.log(`\n========================================================`);
  console.log(`🏁 Performance & Metrics Summary`);
  console.log(`========================================================`);
  console.log(`Total Run Time:             ${totalTimeSec} seconds`);
  console.log(`Attempted Connections:      ${CONCURRENT_CLIENTS}`);
  console.log(`Successful Connections:     ${connectedCount} (${successRate}%)`);
  console.log(`Failed Handshakes:          ${connectionFailedCount}`);
  console.log(`Unexpected Disconnects:     ${disconnectCount}`);
  console.log(`--------------------------------------------------------`);
  console.log(`⏱️ Connection Handshake Latency:`);
  console.log(`  - Average:                ${avgConnectTime} ms`);
  console.log(`  - Minimum:                ${minConnectTime} ms`);
  console.log(`  - Maximum:                ${maxConnectTime} ms`);
  console.log(`--------------------------------------------------------`);
  console.log(`⚡ Real-Time Message Latency (Ping-Pong roundtrip):`);
  console.log(`  - Average:                ${avgPingPongTime} ms`);
  console.log(`  - Maximum:                ${maxPingPongTime} ms`);
  console.log(`========================================================\n`);

  if (connectionFailedCount > 0) {
    console.log(`💡 Note: If connection failed rate is high on Windows host, please verify Docker adapter settings or firewall rules blocking Node WinSock loopback connections.\n`);
  }
};

runSuite().catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});
