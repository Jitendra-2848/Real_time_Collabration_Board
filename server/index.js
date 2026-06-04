
import cors from 'cors';
import { app, server, express, initializeSocket } from './socket/socket.js';
import authRoutes from './routes/auth.js';
import roomsRoutes from './routes/rooms.js';


app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/rooms', roomsRoutes);

const port = process.env.PORT || 8000;

await initializeSocket();

app.get('/', (req, res) => {
  res.send('S2 realtime socket server is running');
});
app.get("/check", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(),instanceId: process.env.INSTANCE_ID || null});
});

server.listen(port, () => {
  console.log(`S2 realtime socket server listening on http://localhost:${port}`);
});
