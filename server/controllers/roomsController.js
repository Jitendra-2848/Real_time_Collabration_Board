import { createRoom as createRoomDb, listRooms as listRoomsDb, findRoomById } from '../lib/db.js';

export async function listRooms(req, res) {
  const rooms = await listRoomsDb();
  res.json({ rooms });
}

export async function createRoom(req, res) {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Room name is required.' });
  }

  const normalized = name.trim();
  if (!normalized) {
    return res.status(400).json({ error: 'Room name cannot be empty.' });
  }

  const room = await createRoomDb(normalized, req.user.userId);
  res.status(201).json({ room });
}

export async function getRoomById(req, res) {
  const roomId = Number(req.params.roomId);
  if (Number.isNaN(roomId)) {
    return res.status(400).json({ error: 'Invalid room ID.' });
  }

  const room = await findRoomById(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found.' });
  }

  res.json({ room });
}
