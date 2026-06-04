
# Real-Time Collaboration Board

A production-grade, horizontally scalable collaborative whiteboard built with React, Node.js, Socket.IO, and CockroachDB.

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat&logo=node.js)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?style=flat&logo=socket.io)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis)
![Docker](https://img.shields.io/badge/Docker-24-2496ED?style=flat&logo=docker)

---

## Features

- Real-time multi-user whiteboard with sub-100ms sync
- 10+ drawing tools: rect, ellipse, diamond, pen, highlighter, text, arrow, line, sticky notes, icons
- Smart connectors with auto-routing bezier curves and anchor-point snapping
- Room-based collaboration with open, link-only, and manual-approval access modes
- Persistent chat per room with history
- Alignment, grouping, layer ordering, and element locking
- Export to PNG, SVG, PDF
- Touch support with pinch-to-zoom and long-press context menus
- Presentation mode with step-through navigation

---

## Architecture

```
Browser (React + TypeScript)
    ├── HTTP ──► Express API (auth, rooms, messages)
    └── WS ────► Socket.IO ──► NGINX LB ──► App Nodes (×8)
                                              ├── Redis Pub/Sub (cross-instance sync)
                                              └── CockroachDB (persistence)
```

### Real-Time Events

| Client → Server | Server → Client |
|-----------------|-----------------|
| `element-create` | `init-state`, `element-created` |
| `element-update` | `element-updated`, `element-deleted` |
| `element-delete` | `board-state`, `presence` |
| `board-state` | `chat-history`, `chat-message` |
| `chat-message` | `join-request`, `awaiting-approval` |

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- Redis instance
- PostgreSQL / CockroachDB instance

### Setup

```bash
git clone https://github.com/Jitendra-2848/Real_time_Collabration_Board.git
cd Real_time_Collabration_Board

# Install dependencies
cd server && npm install
cd ../client && npm install
```

### Configure Environment

Create `server/.env`:

```env
PORT=8000
DATABASE_URL=postgresql://user:pass@host:26257/dbname?sslmode=verify-full
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=your-redis-password
```

### Run

```bash
# Server (port 8000)
cd server && npm run dev

# Client (port 5173)
cd client && npm run dev
```

Open `http://localhost:5173` → Register → Create Room → Start collaborating.

---


## Deployment

```bash
# Single node
cd server && docker build -t whiteboard . && docker run -p 8000:8000 --env-file .env whiteboard

# Multi-node cluster (NGINX + 8 app instances)
cd server && docker-compose up -d
```

### Load Testing

```bash
cd test && npm install
node load-test-cluster.js --clients=10000 --workers=8 --roomId=1
```

---

## Project Structure

```
├── client/                # React + TypeScript frontend
│   └── src/
│       ├── components/    # AuthPage, RoomsPage, Canvas, ToolSidebar, TopBar, Minimap
│       ├── hooks/         # useSocket, useHistory, useUI, useDrawingStyle
│       ├── services/      # connector, export, alignment, selection, board, storage
│       ├── lib/           # api, types, utils, renderer (4-layer canvas engine)
│       └── constants/     # tools, templates
│
├── server/                # Node.js backend
│   ├── socket/socket.js   # Socket.IO event handlers
│   ├── controllers/       # auth, rooms (with error handling + debug logs)
│   ├── routes/            # auth, rooms (JWT-protected)
│   ├── lib/               # db (CockroachDB), redis, jwt, password
│   └── middleware/        # JWT auth middleware
│
└── test/                  # Load testing tools
```


### Socket.IO Event Architecture

```
                          ┌─────────────────────────┐
                          │     Socket.IO Server     │
                          │    (socket/socket.js)    │
                          └────────────┬────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                   │
             ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
             │  Connection  │   │   Element   │   │    Chat     │
             │  Handler     │   │   Events    │   │   Events    │
             └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
                    │                  │                   │
             ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
             │ • Auth verify│   │ • create    │   │ • message   │
             │ • Room lookup│   │ • update    │   │ • history   │
             │ • Join room  │   │ • delete    │   │             │
             │ • Owner track│   │ • board-state│  │             │
             │ • State load │   │             │   │             │
             │ • Chat hist  │   │             │   │             │
             └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
                    │                  │                   │
                    └──────────────────┼──────────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │    Redis Pub/Sub Layer   │
                          │  (Cross-instance relay)  │
                          └────────────┬────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │    CockroachDB Layer     │
                          │   (State Persistence)    │
                          └─────────────────────────┘
```

### Connection Flow

```
Client                          Server
  │                               │
  │──── WS Connect ──────────────►│
  │    auth: { roomId, token }    │
  │                               │── Verify JWT
  │                               │── Look up room in DB
  │                               │── Check access mode
  │                               │
  │◄─── init-state ──────────────│  (canvas elements)
  │◄─── chat-history ────────────│  (recent messages)
  │◄─── presence ────────────────│  { count: N }
  │                               │
  │──── element-create ──────────►│── Persist to DB
  │                               │── Publish to Redis
  │◄─── element-created ─────────│  (via Redis → all peers)
  │                               │
  │──── chat-message ────────────►│── Save to DB
  │                               │── Publish to Redis
  │◄─── chat-message ────────────│  (via Redis → all peers)
```

---


### Canvas Rendering Engine

The canvas uses a **4-layer architecture** for optimal performance:

```
┌─────────────────────────────────┐
│  Layer 4: Overlay               │  ← Selection boxes, resize handles,
│  (Selection + UI)               │     rubber band selection
├─────────────────────────────────┤
│  Layer 3: Nodes                 │  ← All drawn elements
│  (Elements + Text + Icons)      │     (rect, ellipse, pen, text...)
├─────────────────────────────────┤
│  Layer 2: Connectors            │  ← Bezier curve connectors
│  (Arrows + Lines + Labels)      │     with anchor-point routing
├─────────────────────────────────┤
│  Layer 1: Background            │  ← Grid pattern / solid color
│  (Grid + Canvas Background)     │
└─────────────────────────────────┘
```

---

### Redis Pub/Sub Flow

```
Instance A receives "element-create" from Client
    │
    ├──► Persist to room_states (JSONB UPSERT)
    │
    └──► pubClient.publish("room:<id>:events", {
           event: "element-created",
           data: element,
           senderSocketId: socket.id
         })
                │
                ▼
         Redis distributes to all subscribers
                │
         ┌──────┴──────┐
         │             │
    Instance A     Instance B
    (subClient)    (subClient)
         │             │
    pmessage handler:
    io.to(roomKey)
      .except(senderSocketId)
      .emit(event, data)
         │             │
    Client A ✗    Client B ✓
    (excluded)    (receives)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Redis** instance (local or cloud)
- **PostgreSQL / CockroachDB** instance

### 1. Clone & Install

```bash
git clone https://github.com/Jitendra-2848/Real_time_Collabration_Board.git
cd Real_time_Collabration_Board

# Server dependencies
cd server && npm install

# Client dependencies
cd ../client && npm install
```

### 2. Configure Environment

Create `server/.env`:

```env
PORT=8000
DATABASE_URL=postgresql://user:pass@host:26257/dbname?sslmode=verify-full
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=your-redis-password
JWT_SECRET=your-secret-key
```

### 3. Start Development

```bash
# Terminal 1 — Server
cd server && npm run dev

# Terminal 2 — Client
cd client && npm run dev
```

Open **http://localhost:5173** → Register → Create Room → Start Collaborating!

---



### Docker (Single Node)

```bash
cd server
docker build -t whiteboard-server .
docker run -p 8000:8000 --env-file .env whiteboard-server
```

### Docker Compose (Multi-Node Cluster)

```bash
cd server
docker-compose up -d
```

This starts **NGINX (port 8000)** + **8 application instances** for horizontal scaling.

``

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 👨‍💻 Author

**Jitendra Prajapati**

- GitHub: [@Jitendra-2848](https://github.com/Jitendra-2848)
- Project: [Real-Time Collaboration Board](https://github.com/Jitendra-2848/Real_time_Collabration_Board)

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---


**Built with ❤️ by Jitendra**

*Scalable · Real-Time · Collaborative*
