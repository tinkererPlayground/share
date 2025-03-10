import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-room', (roomId) => {
    rooms.set(roomId, socket.id);
    socket.join(roomId);
    console.log(`Room created: ${roomId}`);
  });

  socket.on('join-room', (roomId) => {
    if (rooms.has(roomId)) {
      socket.join(roomId);
      socket.to(roomId).emit('viewer-joined', socket.id);
      console.log(`User ${socket.id} joined room ${roomId}`);
    }
  });

  socket.on('offer', ({ offer, roomId }) => {
    socket.to(roomId).emit('offer', offer);
  });

  socket.on('answer', ({ answer, roomId }) => {
    socket.to(roomId).emit('answer', answer);
  });

  socket.on('ice-candidate', ({ candidate, roomId }) => {
    socket.to(roomId).emit('ice-candidate', candidate);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove any rooms created by this user
    for (const [roomId, hostId] of rooms.entries()) {
      if (hostId === socket.id) {
        rooms.delete(roomId);
        io.to(roomId).emit('host-disconnected');
        console.log(`Room ${roomId} closed`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});