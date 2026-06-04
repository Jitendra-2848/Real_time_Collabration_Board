import { createRoom as createRoomDb, listRooms as listRoomsDb, findRoomById, fetchMessages } from '../lib/db.js';

export async function listRooms(req, res) {
  try {
    console.log(`[Rooms] listRooms called by user:`, req.user);
    const rooms = await listRoomsDb();
    console.log(`[Rooms] Found ${rooms.length} rooms`);
    res.json({ rooms });
  } catch (err) {
    console.error('[Rooms] listRooms error:', err.message || err);
    res.status(500).json({ error: 'Failed to list rooms.' });
  }
}

export async function createRoom(req, res) {
  try {
    const { name } = req.body;
    const { access_mode } = req.body;
    console.log(`[Rooms] createRoom called:`, { name, access_mode, user: req.user });

    if (!name || typeof name !== 'string') {
      console.warn('[Rooms] createRoom validation failed: name missing or not a string');
      return res.status(400).json({ error: 'Room name is required.' });
    }

    const normalized = name.trim();
    if (!normalized) {
      console.warn('[Rooms] createRoom validation failed: name is empty after trim');
      return res.status(400).json({ error: 'Room name cannot be empty.' });
    }

    if (!req.user || !req.user.id) {
      console.error('[Rooms] createRoom failed: req.user or req.user.id is missing', req.user);
      return res.status(401).json({ error: 'User not authenticated.' });
    }

    const userId = req.user.id;
    const mode = access_mode || 'open';
    console.log(`[Rooms] Creating room: name="${normalized}", userId=${userId}, access_mode="${mode}"`);

    const room = await createRoomDb(normalized, userId, mode);
    console.log(`[Rooms] Room created successfully:`, room);

    if (!room || !room.id) {
      console.error('[Rooms] createRoom returned invalid result:', room);
      return res.status(500).json({ error: 'Failed to create room — no ID returned.' });
    }

    res.status(201).json({ room });
  } catch (err) {
    console.error('[Rooms] createRoom error:', err.message || err);
    if (err.code === '23505') {
      // PostgreSQL unique constraint violation
      return res.status(409).json({ error: 'A room with this name already exists.' });
    }
    res.status(500).json({ error: 'Failed to create room.' });
  }
}

export async function getRoomMessages(req, res) {
  try {
    const roomId = req.params.roomId;
    console.log(`[Rooms] getRoomMessages called for roomId:`, roomId);
    if (!roomId || roomId === 'undefined' || roomId === 'NaN') {
      return res.status(400).json({ error: 'Invalid room ID.' });
    }
    const messages = await fetchMessages(roomId);
    console.log(`[Rooms] Found ${messages.length} messages for room ${roomId}`);
    res.json({ messages });
  } catch (err) {
    console.error('[Rooms] getRoomMessages error:', err.message || err);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
}

export async function getRoomById(req, res) {
  try {
    const roomId = req.params.roomId;
    console.log(`[Rooms] getRoomById called for roomId:`, roomId);
    if (!roomId || roomId === 'undefined' || roomId === 'NaN') {
      return res.status(400).json({ error: 'Invalid room ID.' });
    }

    const room = await findRoomById(roomId);
    if (!room) {
      console.warn(`[Rooms] Room not found: ${roomId}`);
      return res.status(404).json({ error: 'Room not found.' });
    }

    console.log(`[Rooms] Found room:`, room);
    res.json({ room });
  } catch (err) {
    console.error('[Rooms] getRoomById error:', err.message || err);
    res.status(500).json({ error: 'Failed to fetch room.' });
  }
}
