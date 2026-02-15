const express = require('express');
const router = express.Router();
const Conversation = require('../models/conversation.model');

// GET /api/conversations/active - Get the active session
router.get('/active', async (req, res) => {
  try {
    const session = await Conversation.findOne({ isActive: true }).sort({ updatedAt: -1 });
    res.json(session);
  } catch (error) {
    console.error('Error loading active session:', error.message);
    res.status(500).json({ error: 'Failed to load active session' });
  }
});

// POST /api/conversations - Create a new session
router.post('/', async (req, res) => {
  try {
    const { userLevel, chatMessages, currentTopic, lastProgressUpdate, currentStage } = req.body;

    const session = new Conversation({
      userLevel,
      chatMessages: chatMessages || [],
      currentTopic: currentTopic || null,
      lastProgressUpdate: lastProgressUpdate || null,
      currentStage: currentStage || 'conversation',
      isActive: true
    });

    const saved = await session.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error('Error creating session:', error.message);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/conversations/:id - Get a specific session
router.get('/:id', async (req, res) => {
  try {
    const session = await Conversation.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (error) {
    console.error('Error loading session:', error.message);
    res.status(500).json({ error: 'Failed to load session' });
  }
});

// PUT /api/conversations/:id - Update session (auto-save)
router.put('/:id', async (req, res) => {
  try {
    const { chatMessages, currentTopic, lastProgressUpdate, currentStage, isActive } = req.body;

    const updateData = { chatMessages, currentTopic, lastProgressUpdate, currentStage };
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await Conversation.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating session:', error.message);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// POST /api/conversations/:id/archive - Archive current and start new
router.post('/:id/archive', async (req, res) => {
  try {
    await Conversation.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ archived: true });
  } catch (error) {
    console.error('Error archiving session:', error.message);
    res.status(500).json({ error: 'Failed to archive session' });
  }
});

// GET /api/conversations/history - List past sessions (metadata only)
router.get('/history', async (req, res) => {
  try {
    const sessions = await Conversation.find({ isActive: false })
      .sort({ updatedAt: -1 })
      .limit(20)
      .select('userLevel currentTopic currentStage createdAt updatedAt chatMessages');

    const metadata = sessions.map(s => ({
      id: s._id,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: s.chatMessages.length,
      topicName: s.currentTopic?.english || null,
      userLevel: s.userLevel
    }));

    res.json(metadata);
  } catch (error) {
    console.error('Error loading history:', error.message);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

module.exports = router;
