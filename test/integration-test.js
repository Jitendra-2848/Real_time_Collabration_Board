import { io } from 'socket.io-client';

const API = process.env.API_URL || 'http://localhost:3000';
const SOCKET = process.env.SERVER_URL || 'http://localhost:3000';

async function http(path, method='GET', body, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  return res.json();
}

async function run() {
  console.log('Starting integration test...');
  const ownerUser = `owner_${Date.now()}`;
  const guestUser = `guest_${Date.now()}`;
  const pwd = 'testpass';

  const ownerReg = await http('/auth/register', 'POST', { username: ownerUser, password: pwd });
  const guestReg = await http('/auth/register', 'POST', { username: guestUser, password: pwd });
  const ownerToken = ownerReg.token;
  const guestToken = guestReg.token;

  console.log('Registered users:', ownerReg.user.username, guestReg.user.username);

  const roomRes = await http('/rooms', 'POST', { name: `it-room-${Date.now()}`, access_mode: 'manual' }, ownerToken);
  if (roomRes.error) {
    console.error('Failed to create room', roomRes.error);
    process.exit(1);
  }
  const roomId = roomRes.room.id;
  console.log('Created room', roomId);

  // Owner socket
  const ownerSocket = io(SOCKET, { auth: { roomId, token: ownerToken }, transports: ['websocket'], reconnection: false, timeout: 10000 });
  ownerSocket.on('connect', () => console.log('Owner connected', ownerSocket.id));
  ownerSocket.on('join-request', (req) => {
    console.log('Owner received join-request', req);
    // Accept immediately
    ownerSocket.emit('join-response', { socketId: req.socketId, accept: true });
  });
  ownerSocket.on('chat-message', (m) => console.log('Owner got chat', m));

  // Guest socket
  const guestSocket = io(SOCKET, { auth: { roomId, token: guestToken }, transports: ['websocket'], reconnection: false, timeout: 10000 });
  guestSocket.on('connect', () => console.log('Guest connected (handshake)', guestSocket.id));
  guestSocket.on('awaiting-approval', () => console.log('Guest awaiting approval'));
  guestSocket.on('join-accepted', () => {
    console.log('Guest join accepted');
    // send chat
    guestSocket.emit('chat-message', { message: 'Hello from guest' });
  });
  guestSocket.on('chat-message', (m) => console.log('Guest got chat', m));

  // Basic ping/pong latency
  ownerSocket.on('scalability.pong', ({ clientId, ts }) => {
    console.log('Owner pong latency', Date.now() - ts);
  });
  guestSocket.on('scalability.pong', ({ clientId, ts }) => {
    console.log('Guest pong latency', Date.now() - ts);
  });

  // after a short wait, run pings
  setTimeout(() => {
    ownerSocket.emit('scalability.ping', { clientId: 'owner', ts: Date.now() });
    guestSocket.emit('scalability.ping', { clientId: 'guest', ts: Date.now() });
  }, 2000);

  // run for 8 seconds then cleanup
  setTimeout(() => {
    ownerSocket.disconnect();
    guestSocket.disconnect();
    console.log('Integration test finished');
    process.exit(0);
  }, 8000);
}

run().catch(err => { console.error('Test failed:', err); process.exit(1); });
