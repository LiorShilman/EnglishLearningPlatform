import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Beginner'
  },
  progress: {
    completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
    currentLesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    skillLevels: {
      grammar: { type: Number, default: 0 },
      vocabulary: { type: Number, default: 0 },
      pronunciation: { type: Number, default: 0 },
      comprehension: { type: Number, default: 0 }
    }
  }
});

export const User = mongoose.model('User', userSchema);