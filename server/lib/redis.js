import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';

const redisOptions = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
};

console.log({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
})
const pubClient = new Redis(redisOptions);
const subClient = pubClient.duplicate();

pubClient.on('connect', () => {
  console.log('🟢 Redis publisher connected');
});

subClient.on('connect', () => {
  console.log('🟢 Redis subscriber connected');
});

pubClient.on('error', (err) => {
  console.error('🔴 Redis publisher error:', err.message);
});

subClient.on('error', (err) => {
  console.error('🔴 Redis subscriber error:', err.message);
});

export function createRedisAdapter() {
  return createAdapter(pubClient, subClient);
}

export { pubClient, subClient };