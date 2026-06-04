import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
//   user: process.env.PG_USER || 'postgres',
//   host: process.env.PG_HOST || 'localhost',
//   database: process.env.PG_DATABASE || 's2',
//   password: process.env.PG_PASSWORD || 'postgres',
//   port: Number(process.env.PG_PORT || 5432),
  connectionString:process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 80000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('🟢 Postgres connected');
});

pool.on('error', (err) => {
  console.error('🔴 Postgres connection error:', err.message || err);
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_mode TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS room_states (
    room_id INTEGER PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
    state JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  );
`);

export async function createUser(username, passwordHash) {
  const result = await pool.query(
    `INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username`,
    [username, passwordHash]
  );
  return result.rows[0];
}

export async function findUserByUsername(username) {
  const result = await pool.query(
    `SELECT id, username, password_hash FROM users WHERE username = $1 LIMIT 1`,
    [username]
  );
  return result.rows[0] || null;
}

export async function findUserById(id) {
  const result = await pool.query(
    `SELECT id, username FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function createRoom(name, createdBy, accessMode = 'open') {
  const result = await pool.query(
    `INSERT INTO rooms (name, created_by, access_mode) VALUES ($1, $2, $3) RETURNING id, name, created_by, access_mode`,
    [name, createdBy, accessMode]
  );
  return result.rows[0];
}

export async function listRooms() {
  const result = await pool.query(
    `SELECT rooms.id, rooms.name, rooms.created_at, rooms.access_mode, users.username as created_by
     FROM rooms
     JOIN users ON rooms.created_by = users.id
     ORDER BY rooms.created_at DESC`
  );
  return result.rows;
}

export async function findRoomById(id) {
  const result = await pool.query(
    `SELECT rooms.id, rooms.name, rooms.created_by, rooms.access_mode, rooms.created_at, users.username as created_by_username
     FROM rooms
     JOIN users ON rooms.created_by = users.id
     WHERE rooms.id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function saveMessage(roomId, userId, username, message) {
  const result = await pool.query(
    `INSERT INTO chat_messages (room_id, user_id, username, message) VALUES ($1, $2, $3, $4) RETURNING id, room_id, user_id, username, message, created_at`,
    [roomId, userId, username, message]
  );
  return result.rows[0];
}

export async function fetchMessages(roomId, limit = 200) {
  const result = await pool.query(
    `SELECT id, room_id, user_id, username, message, created_at FROM chat_messages WHERE room_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [roomId, limit]
  );
  return result.rows.reverse();
}

export async function findRoomByName(name) {
  const result = await pool.query(
    `SELECT id, name, created_by, created_at FROM rooms WHERE name = $1 LIMIT 1`,
    [name]
  );
  return result.rows[0] || null;
}

export async function saveRoomState(roomId, state) {
  const payload = typeof state === 'string' ? state : JSON.stringify(state || []);
  await pool.query(
    `INSERT INTO room_states (room_id, state, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (room_id) DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at`,
    [roomId, payload]
  );
}

export async function loadRoomState(roomId) {
  const result = await pool.query(
    `SELECT state FROM room_states WHERE room_id = $1 LIMIT 1`,
    [roomId]
  );

  if (!result.rows[0]) {
    return [];
  }
  return result.rows[0].state || [];
}
