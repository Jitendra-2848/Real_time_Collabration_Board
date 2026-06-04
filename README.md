# Real-Time Collaboration Board

A modern real-time collaboration board built using React, TypeScript, Node.js, and Socket.io. The application allows multiple users to draw and collaborate simultaneously with live synchronization across connected clients.

---

## Features

- Real-time multi-user collaboration
- Live canvas synchronization using WebSockets
- Interactive drawing tools
- Responsive user interface
- Type-safe development with TypeScript
- Fast frontend development using Vite
- Scalable client-server architecture

---

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Socket.io Client

### Backend
- Node.js
- Express.js
- Socket.io

---

## Project Structure

```bash
Real_time_Collabration_Board/
│
├── client/          # Frontend application
├── server/          # Backend server
└── test/            # Testing utilities
```

---

## Installation

### Clone the Repository

```bash
git clone https://github.com/Jitendra-2848/Real_time_Collabration_Board.git
cd Real_time_Collabration_Board
```

### Install Dependencies

#### Backend

```bash
cd server
npm install
```

#### Frontend

```bash
cd client
npm install
```

---

## Running the Application

### Start Backend Server

```bash
cd server
npm start
```

Backend runs on:

```bash
http://localhost:8000
```

### Start Frontend

```bash
cd client
npm run dev
```

Frontend runs on:

```bash
http://localhost:5173
```

---

## Available Scripts

### Client

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

### Server

```bash
npm start         # Start backend server
npm run test:load # Run load testing
```

---

## Socket.io Events

### Client → Server
- `draw`
- `clear`
- `join`
- `leave`

### Server → Client
- `draw`
- `clear`
- `users`
- `sync`

---

## Environment Variables

Create a `.env` file inside the `server` directory:

```env
PORT=8000
```

---

## Deployment

### Backend

```bash
cd server
npm install --production
npm start
```

### Frontend

```bash
cd client
npm run build
```

Deploy the generated `dist` folder to any static hosting service.

---

## Troubleshooting

### Port Already in Use
Change the port number in the server configuration or `.env` file.

### Socket Connection Errors
Verify that both frontend and backend servers are running correctly.

---

## Author

Jitendra Prajapati

- GitHub: https://github.com/Jitendra-2848

---

## License

This project is licensed under the MIT License.
