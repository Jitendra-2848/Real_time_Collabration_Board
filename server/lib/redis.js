import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';

const redisOptions = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  // Aggressive but safe reconnect — Redis going down should not take
  // the whole app with it. ioredis will queue commands and replay them
  // once the connection comes back.
  maxRetriesPerRequest: null, // never fail a command just because of a transient drop
  enableReadyCheck: true,
  enableOfflineQueue: true,
  // Exponential reconnect with a 2s cap; this keeps an instance that
  // boots before Redis is ready from dying.
  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  },
  reconnectOnError(err) {
    const msg = err?.message || '';
    // Reconnect on transient READONLY errors (e.g. failover)
    if (msg.includes('READONLY')) return true;
    return false;
  },
  // Avoid spurious disconnects on idle TCP connections
  keepAlive: 30000,
  connectTimeout: 10000,
};

console.log('Redis config:', {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD ? '***' : '(none)',
});

/**
 * The publish client is used for normal SET / GET / HSET / SADD / PUBLISH
 * commands. We *also* use it for SUBSCRIBE-only commands (PMESSAGE) by
 * `subClient.duplicate()`. ioredis requires that the connection that
 * SUBSCRIBEs is not used for normal commands.
 */
const pubClient = new Redis(redisOptions);
const subClient = pubClient.duplicate();

// Decouple Socket.IO adapter connections to prevent command queuing under heavy load (H2)
// Reuse pubClient for ioPubClient since standard queries and publisher commands don't require exclusive connection state
const ioPubClient = pubClient;
const ioSubClient = pubClient.duplicate();

const INSTANCE_ID = process.env.INSTANCE_ID || `inst-${process.pid}`;

pubClient.on('connect', () => {
  console.log(`🟢 [${INSTANCE_ID}] Redis publisher connected`);
});
subClient.on('connect', () => {
  console.log(`🟢 [${INSTANCE_ID}] Redis subscriber connected`);
});
ioSubClient.on('connect', () => {
  console.log(`🟢 [${INSTANCE_ID}] Redis IO subscriber connected`);
});

pubClient.on('ready', () => {
  console.log(`🟢 [${INSTANCE_ID}] Redis publisher ready`);
});
subClient.on('ready', () => {
  console.log(`🟢 [${INSTANCE_ID}] Redis subscriber ready`);
});
ioSubClient.on('ready', () => {
  console.log(`🟢 [${INSTANCE_ID}] Redis IO subscriber ready`);
});

pubClient.on('error', (err) => {
  console.error(`🔴 [${INSTANCE_ID}] Redis publisher error:`, err.message);
});
subClient.on('error', (err) => {
  console.error(`🔴 [${INSTANCE_ID}] Redis subscriber error:`, err.message);
});
ioSubClient.on('error', (err) => {
  console.error(`🔴 [${INSTANCE_ID}] Redis IO subscriber error:`, err.message);
});

pubClient.on('end', () => {
  console.warn(`⚠️  [${INSTANCE_ID}] Redis publisher connection ended`);
});
subClient.on('end', () => {
  console.warn(`⚠️  [${INSTANCE_ID}] Redis subscriber connection ended`);
});
ioSubClient.on('end', () => {
  console.warn(`⚠️  [${INSTANCE_ID}] Redis IO subscriber connection ended`);
});

export function createRedisAdapter() {
  return createAdapter(ioPubClient, ioSubClient);
}

export { pubClient, subClient, INSTANCE_ID };

/**
 * Wait for the pub/sub clients to be in the `ready` state. Useful during
 * boot so `subClient.psubscribe` happens after the connection is up.
 */
export async function waitForRedisReady(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pubClient.status === 'ready' && subClient.status === 'ready') return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Redis did not become ready within timeout');
}
