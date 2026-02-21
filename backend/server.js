const express = require('express'); 
const cors = require('cors'); 
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
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
