# English Learning Platform

An interactive AI-powered English learning application for Hebrew speakers. Features real-time conversation with Claude AI, grammar corrections, vocabulary tracking with spaced repetition, and text-to-speech.

## Tech Stack

- **Frontend:** Angular 18 (standalone components), Angular Material, SCSS
- **Backend:** Node.js, Express
- **AI:** Claude API (Anthropic)
- **Speech:** Web Speech API (annyang for recognition, SpeechSynthesis for TTS)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
```

### Configuration

Create `server/.env`:

```
CLAUDE_API_KEY=your-api-key-here
PORT=5000
```

### Running

```bash
# Terminal 1 - Start backend
cd server
npm start

# Terminal 2 - Start frontend (proxies /api to backend)
npm start
```

Open http://localhost:4200

### Build for Production

```bash
# Build with custom base href (e.g. for IIS deployment)
ng build --base-href /EnglishLearning/
```

Output: `dist/english-learning-platform/`

## Features

- **Skill Assessment** - Self-rate speaking, writing, grammar, and vocabulary (levels 1-4)
- **AI Conversation** - Chat with Claude AI adapted to your proficiency level
- **Real-Time Corrections** - Grammar, vocabulary, and structure feedback in English and Hebrew
- **Learning Blocks** - Structured tips for grammar, usage, warnings, and practice
- **Vocabulary Cards** - Auto-extracted from conversations with spaced repetition review
- **Virtual Avatar** - Animated companion with mood reactions
- **Text-to-Speech** - Adjustable speech rate based on user level
- **Speech Recognition** - Speak instead of type using microphone

## Project Structure

```
src/app/
  components/
    vocabulary/           # Vocabulary card management & review
    virtual-avatar/       # Animated avatar with moods
    typing-message/       # Typing animation effect
    animated-learning-block/  # Learning block animations
  services/
    enhanced-claude.service   # Main AI conversation service
    claude-api.service        # HTTP client for backend API
    vocabulary.service        # Vocabulary card CRUD & stats
    vocabulary-claude.service # AI vocabulary extraction
    virtual-avatar.service    # Avatar state management
  shared/interfaces/          # TypeScript interfaces
  pipes/
    markdown.pipe             # Markdown to HTML rendering

server/
  src/
    routes/claude.routes.js   # Claude API proxy endpoint
    index.js                  # Express server entry point
```
