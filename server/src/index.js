const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const claudeRoutes = require('./routes/claude.routes');
const conversationRoutes = require('./routes/conversation.routes');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/english-learning';

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/api/claude', claudeRoutes);
app.use('/api/conversations', conversationRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully');
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
