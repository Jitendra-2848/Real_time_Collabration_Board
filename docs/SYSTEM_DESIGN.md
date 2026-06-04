**Realtime Collaboration — System Design**

Overview
- Purpose: support collaborative whiteboard with real-time synchronization, chat, and membership controls.
- Goals: scale to ~10k concurrent clients, persist room state and chat, support manual or link-based joins, and allow horizontal scaling.

Components
- Client (browser): React + Vite app. Connects to Socket.IO server via WebSocket and exchanges events (element-create/update/delete, board-state, chat-message, presence, scalability.ping).
- API Server (HTTP): Express endpoints for auth, room management, and fetching persisted data (rooms, chat history).
- Socket Servers (multiple): Node.js + Socket.IO, Redis adapter for cross-process pub/sub and event routing. Each instance accepts WebSocket connections and relies on Redis to forward events and maintain shared room state (backed by DB persistence).
- Redis: used as Socket.IO adapter pub/sub and for transient coordination and presence.
- Postgres: persistent storage for users, rooms, room state, and chat messages.
- Nginx: reverse proxy / load balancer in front of socket servers for TLS termination and connection distribution.

Mermaid Diagram
```mermaid
flowchart LR
  Browser[Client (React)] -->|WS| Nginx[NGINX LB]
  Nginx -->|WS| App1[Socket Server A]
  Nginx -->|WS| App2[Socket Server B]
  App1 <--> Redis[Redis Adapter]
  App2 <--> Redis
  Redis -->|pub/sub| App1
  Redis -->|pub/sub| App2
  App1 --> Postgres[(Postgres)]
  App2 --> Postgres
  Browser -->|HTTP| API[Express API]
  API --> Postgres
```

Key design details
- Redis adapter: required for multi-process/host Socket.IO setups — ensures messages cross processes and instances.
- Persistence: room states are stored in `room_states` JSONB; chat saved to `chat_messages` for recoverability.
- Access modes: `access_mode` column on `rooms` supports `open`, `link`, `manual` (manual requires owner approval flow).
- Join flow: by default socket attempts to `join` immediately; for `manual` mode, request goes to owners who accept/reject (owner prompt/UI can be improved).

Scaling to 10k+ users
- Horizontal scaling: run multiple socket server instances (Docker Compose shows `app`, `app1`, ..., `app7`), fronted by Nginx or a TCP LB. Use sticky sessions or rely on Socket.IO + Redis adapter to deliver messages across instances.
- Vertical sizing: each Node process can handle thousands of idle WebSocket connections if configured — actual numbers depend on message rate and server resources. Plan multiple instances across machines for headroom.
- OS tuning: raise file descriptors (`ulimit -n 100000`), increase ephemeral ports, tune kernel TCP settings if necessary.
- Connection strategy: use `websocket` transport only (disable polling) to reduce overhead. Disable verbose logging in production.

Testing & Load harness
- `test/load-test-cluster.js`: Node clustered load test that spawns worker processes; each worker creates many socket.io-client connections and reports metrics (connected, failed, average ping).
- To run a 10k-client test locally (careful: you'll need sufficient CPU, memory, and ulimit settings):

```bash
# from project root
cd test
npm install
# then run (example for 10000 clients, 8 workers, roomId 1):
node load-test-cluster.js --clients=10000 --workers=8 --roomId=1 --rate=1000 --duration=60
```

- The test signs JWT tokens with `JWT_SECRET` (default `realtime-collab-secret`) so set `JWT_SECRET` in your environment if your server uses a different secret.

Operational tips
- Logging: keep debug logging off for high-load runs (`DEBUG=0`), enable only errors.
- Redis: use a single high-performance Redis instance or a cluster for reliability.
- Database: ensure Postgres connection pool size (`pool.max`) is tuned and not exhausted by many server instances.
- Monitoring: capture metrics (CPU, memory, file descriptors, network), and per-message latency from `scalability.ping`/`pong` events.

Next steps
- Replace `window.confirm()` owner prompt with an in-app modal listing pending join requests (recommended UX improvement).
- Add token-based invite links for `link` mode.
- Add automated CI script that runs load tests and stores aggregated results (JSON/CSV) for analysis.

Contact
- If you'd like, I can implement the owner UI for join approvals and add a CI-friendly runner that produces CSV metrics automatically.
```