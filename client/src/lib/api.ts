const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

let activeToken: string | null = null;
let onTokenRefreshedCallback: ((token: string) => void) | null = null;

export const setApiAuthToken = (token: string | null) => {
  activeToken = token;
};

export const onApiTokenRefreshed = (callback: (token: string) => void) => {
  onTokenRefreshedCallback = callback;
};

async function handleResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { error: data.error || `Request failed with status ${response.status}` };
  }
  return data;
}

export async function refreshAccessToken() {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
  });
  const data = await handleResponse(response);
  return data;
}

export async function logoutUser() {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
  });
  return handleResponse(response);
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = { ...jsonHeaders, ...(options.headers || {}) } as any;
  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }
  options.headers = headers;

  let response = await fetch(url, options);
  if (response.status === 401 && activeToken) {
    const refreshResult = await refreshAccessToken();
    if (refreshResult && refreshResult.token) {
      activeToken = refreshResult.token;
      if (onTokenRefreshedCallback) {
        onTokenRefreshedCallback(refreshResult.token);
      }
      headers['Authorization'] = `Bearer ${activeToken}`;
      options.headers = headers;
      response = await fetch(url, options);
    }
  }
  return response;
}

export async function registerUser(username: string, password: string) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  });
  const data = await handleResponse(response);
  if (data && data.token) {
    setApiAuthToken(data.token);
  }
  return data;
}

export async function loginUser(username: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  });
  const data = await handleResponse(response);
  if (data && data.token) {
    setApiAuthToken(data.token);
  }
  return data;
}

export async function fetchRooms(token: string) {
  if (token) setApiAuthToken(token);
  const response = await fetchWithAuth(`${API_URL}/rooms`);
  return handleResponse(response);
}

export async function createRoom(token: string, name: string, access_mode?: string) {
  if (token) setApiAuthToken(token);
  const body: any = { name };
  if (access_mode) body.access_mode = access_mode;
  const response = await fetchWithAuth(`${API_URL}/rooms`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return handleResponse(response);
}

export async function fetchRoomMessages(token: string, roomId: string | number) {
  if (token) setApiAuthToken(token);
  const response = await fetchWithAuth(`${API_URL}/rooms/${roomId}/messages`);
  return handleResponse(response);
}

export async function fetchRoomById(token: string, roomId: string | number) {
  if (token) setApiAuthToken(token);
  const response = await fetchWithAuth(`${API_URL}/rooms/${roomId}`);
  return handleResponse(response);
}
