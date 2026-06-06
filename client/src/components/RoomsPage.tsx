import { useEffect, useState } from 'react';
import { createRoom, fetchRooms, fetchRoomById } from '../lib/api';
import toast from 'react-hot-toast';

interface RoomsPageProps {
  token: string;
  username: string;
  onJoinRoom: (roomId: string | number, roomName: string) => void;
  onLogout: () => void;
}

export const RoomsPage = ({ token, username, onJoinRoom, onLogout }: RoomsPageProps) => {
  const [rooms, setRooms] = useState<Array<{ id: string | number; name: string; created_by: string; access_mode?: string }>>([]);
  const [newRoom, setNewRoom] = useState('');
  const [accessMode, setAccessMode] = useState<'open'|'link'|'manual'>('open');
  const [joinId, setJoinId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadRooms = async () => {
      const result = await fetchRooms(token);
      if (result.error) {
        setError(result.error);
        toast.error('Failed to load rooms list.');
      } else {
        setRooms(result.rooms || []);
      }
    };
    loadRooms();
  }, [token]);

  const handleCreateRoom = async () => {
    if (!newRoom.trim()) {
      toast.error('Please enter a room name.');
      return;
    }
    setError('');
    setLoading(true);
    const result = await createRoom(token, newRoom.trim(), accessMode);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    setRooms(prev => [result.room, ...prev]);
    setNewRoom('');
    toast.success('Room created successfully!');
  };

  const handleJoinById = async () => {
    setError('');
    const id = joinId.trim();
    if (!id) {
      toast.error('Please enter a room ID.');
      return;
    }
    setLoading(true);
    const res = await fetchRoomById(token, id);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success(`Joined room: ${res.room.name}`);
    onJoinRoom(res.room.id, res.room.name);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome back, {username}</h1>
            <p className="text-sm text-slate-500">Choose a room to collaborate in real time.</p>
          </div>
          <button
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">Create a new room</label>
            <div className="flex gap-3">
              <input
                className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 focus:border-slate-500 focus:outline-none"
                value={newRoom}
                onChange={(event) => setNewRoom(event.target.value)}
                placeholder="Room name"
              />
              <select value={accessMode} onChange={e => setAccessMode(e.target.value as any)} className="rounded-2xl border border-slate-300 px-3 py-2 text-sm">
                <option value="open">Open</option>
                <option value="link">Link only</option>
                <option value="manual">Manual approval</option>
              </select>
              <button
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                onClick={handleCreateRoom}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
            {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-700 mb-2">Room info</div>
            <p className="text-sm text-slate-500">Rooms are persisted in the backend database and shared across all collaborators.</p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">Available rooms</h2>
          <div className="mt-3 space-y-3">
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              Or connect by room id / link:
              <div className="flex gap-2 mt-2">
                <input value={joinId} onChange={e => setJoinId(e.target.value)} placeholder="Enter room id" className="flex-1 rounded-2xl border border-slate-300 px-4 py-2" />
                <button onClick={handleJoinById} className="rounded-2xl border border-slate-300 px-4 py-2">Connect</button>
              </div>
              {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
            </div>
            {rooms.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                No rooms available yet. Create one to start collaborating.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
                {rooms.map((room) => (
                  <div key={room.id} className="rounded-3xl border border-slate-200 p-4 flex items-center justify-between gap-4 flex-shrink-0">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 truncate">{room.name}</div>
                      <div className="text-xs text-slate-500 truncate">Created by {room.created_by}{room.access_mode ? ` • ${room.access_mode}` : ''}</div>
                    </div>
                    <button
                      className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex-shrink-0"
                      onClick={() => onJoinRoom(room.id, room.name)}
                    >
                      Join room
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
