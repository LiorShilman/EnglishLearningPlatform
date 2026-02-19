const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  userLevel: {
    speaking: { type: Number, required: true },
    writing: { type: Number, required: true },
    grammar: { type: Number, required: true },
    vocabulary: { type: Number, required: true }
  },
  chatMessages: [{
    sender: { type: String, enum: ['user', 'assistant'], required: true },
    english: { type: String, required: true },
    hebrew: String,
    feedback: [{
      type: { type: String, enum: ['grammar', 'vocabulary', 'pronunciation'] },
      message: {
        english: String,
        hebrew: String
      },
      suggestion: String
    }],
    learningBlocks: [{
      type: { type: String, enum: ['grammar', 'usage', 'warning', 'practice'] },
      title: String,
      content: {
        english: String,
        hebrew: String
      },
      examples: [{
        english: String,
        hebrew: String
      }]
    }],
    timestamp: { type: Date, default: Date.now }
  }],
  currentTopic: {
    english: String,
    hebrew: String
  },
  lastProgressUpdate: {
    metrics: {
      speaking: { score: Number, accuracy: Number, fluency: Number },
      writing: { score: Number, structure: Number, style: Number },
      grammar: { score: Number, accuracy: Number, range: Number },
      vocabulary: { score: Number, active: Number, passive: Number }
    },
    focusAreas: [{
      priority: Number,
      description: {
        english: String,
        hebrew: String
      },
      status: Number
    }]
  },
  conversationMode: {
    type: String,
    default: null
  },
  currentStage: {
    type: String,
    enum: ['assessment', 'topic-selection', 'conversation'],
    default: 'conversation'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

conversationSchema.index({ isActive: 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
