const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk').default;

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

router.post('/messages', async (req, res) => {
  try {
    const { model, max_tokens, temperature, system, messages } = req.body;

    const response = await anthropic.messages.create({
      model: model || 'claude-sonnet-4-5-20250929',
      max_tokens: max_tokens || 1024,
      temperature: temperature ?? 0.7,
      system,
      messages,
    });

    res.json(response);
  } catch (error) {
    console.error('Claude API error:', error.message);
    const status = error.status || 500;
    res.status(status).json({
      error: error.message,
      type: error.type || 'server_error',
    });
  }
});

module.exports = router;
