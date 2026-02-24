const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const connectDB = require('./config/database');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const eventRoutes = require('./routes/event');
const passwordRoutes = require('./routes/password');
const registrationRoutes = require('./routes/registration');
const browseRoutes = require('./routes/browse');
const organizerRoutes = require('./routes/organizer');
const teamRoutes = require('./routes/team');
const resetRequestRoutes = require('./routes/resetRequest');
const chatRoutes = require('./routes/chat');
const uploadRoutes = require('./routes/upload');

const app = express();
const server = http.createServer(app);

// Socket.io — JWT auth middleware + team room management
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  // join the socket room for a team so broadcasts are scoped per team
  socket.on('join-team', ({ teamId }) => {
    socket.join(`team:${teamId}`);
    socket.to(`team:${teamId}`).emit('user-online', { userId: socket.user.id });
  });

  // forward typing/stop-typing to everybody else in the team room
  socket.on('typing', ({ teamId }) => {
    socket.to(`team:${teamId}`).emit('user-typing', { userId: socket.user.id });
  });
  socket.on('stop-typing', ({ teamId }) => {
    socket.to(`team:${teamId}`).emit('user-stop-typing', { userId: socket.user.id });
  });

  socket.on('disconnect', () => {
    socket.rooms.forEach(room => {
      if (room.startsWith('team:')) {
        socket.to(room).emit('user-offline', { userId: socket.user.id });
      }
    });
  });
});

// make io accessible inside Express route handlers via req.app.get('io')
app.set('io', io);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', require('express').static(require('path').join(__dirname, 'uploads')));

connectDB();

app.use('/api/auth', authRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/user', userRoutes);

app.use('/api/events', eventRoutes);

app.use('/api/password', passwordRoutes);

app.use('/api/registration', registrationRoutes);

app.use('/api/browse', browseRoutes);

app.use('/api/organizer', organizerRoutes);

app.use('/api/team', teamRoutes);

app.use('/api/reset-request', resetRequestRoutes);

app.use('/api/chat', chatRoutes);

app.use('/api/upload', uploadRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
