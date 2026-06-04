const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

export async function registerUser(username: string, password: string) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  });
  return await response.json();
}

export async function loginUser(username: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  });
  return await response.json();
}

export async function fetchRooms(token: string) {
  const response = await fetch(`${API_URL}/rooms`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return await response.json();
}

export async function createRoom(token: string, name: string, access_mode?: string) {
  const body: any = { name };
  if (access_mode) body.access_mode = access_mode;
  const response = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return await response.json();
}

export async function fetchRoomMessages(token: string, roomId: number) {
  const response = await fetch(`${API_URL}/rooms/${roomId}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return await response.json();
}

export async function fetchRoomById(token: string, roomId: number) {
  const response = await fetch(`${API_URL}/rooms/${roomId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return await response.json();
}
