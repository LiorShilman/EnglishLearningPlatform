# English Learning Platform

An interactive AI-powered English learning application for Hebrew speakers. Features real-time conversation with Claude AI, themed practice scenarios, daily challenges, grammar corrections, vocabulary tracking with spaced repetition, and gamification.

## Tech Stack

- **Frontend:** Angular 18 (standalone components), SCSS
- **Backend:** Node.js, Express, MongoDB (Mongoose)
- **AI:** Claude API (Anthropic)
- **Speech:** Web Speech API (annyang for recognition, SpeechSynthesis for TTS)

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- MongoDB (local or remote)

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
MONGO_URI=mongodb://localhost:27017/english-learning
```

### Running

```bash
# Terminal 1 - Start backend
cd server
npm run dev

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

### Core Learning
- **Skill Assessment** — Self-rate speaking, writing, grammar, and vocabulary (levels 1-4) with radar chart visualization
- **AI Conversation** — Chat with Claude AI adapted to your proficiency level
- **Real-Time Corrections** — Grammar, vocabulary, and structure feedback in English and Hebrew
- **Learning Blocks** — Structured tips for grammar, usage, warnings, and practice
- **Bilingual Feedback** — Every explanation in both English and Hebrew

### Conversation Modes
- **Free Conversation** — Chat freely about any topic
- **Job Interview** — Practice interview questions with professional vocabulary
- **Travel & Airport** — Navigate travel scenarios confidently
- **Restaurant** — Order food, read menus, handle dining situations
- **Business Meeting** — Professional meeting and negotiation practice
- **Doctor Visit** — Medical vocabulary and appointment scenarios
- **Shopping** — Store interactions, prices, returns

### Vocabulary System
- **Auto-Extraction** — New words automatically captured from conversations via AI
- **Suggestions Panel** — Review and accept/reject AI-suggested vocabulary
- **Spaced Repetition** — Review cards with mastery tracking
- **Categories & Stats** — Organized vocabulary with progress statistics

### Gamification
- **Daily Challenge** — One exercise per day (translate, fix grammar, use a word, fill blanks) with +25 XP reward
- **XP & Levels** — Earn XP for messages (+10), assessments (+50), and challenges (+25), level up through 10 tiers
- **Streak Tracking** — Consecutive daily activity tracking
- **Celebrations** — Animated level-up and challenge completion effects

### Additional Features
- **Landing Page** — Premium onboarding with live demo, feature showcase, and scroll animations
- **Virtual Avatar** — Animated companion with mood reactions (happy, thinking, concerned)
- **Text-to-Speech** — Adjustable speech rate based on user level
- **Speech Recognition** — Speak instead of type using microphone
- **Conversation History** — Save, load, and manage past conversations
- **Conversation Summary** — Review corrections and tips from each session

## User Flow

```
Landing Page → Skill Assessment → Mode Selection → AI Conversation
                                                         ↕
                                               Daily Challenge
                                               Vocabulary Panel
                                               Conversation Summary
```

Returning users skip the landing page and resume their active session.

## Project Structure

```
src/app/
  components/
    landing/                  # Onboarding page with live demo
    assessment/               # Skill assessment with radar chart
    mode-selection/           # Conversation mode picker
    daily-challenge/          # Daily exercise card
    vocabulary/               # Vocabulary cards, review & stats
    summary/                  # Conversation summary modal
    virtual-avatar/           # Animated avatar with moods
  services/
    enhanced-claude.service   # Main AI conversation service
    claude-api.service        # HTTP client for Claude API proxy
    conversation-mode.service # Themed mode definitions & state
    daily-challenge.service   # Daily challenge pool & answer checking
    vocabulary.service        # Vocabulary card CRUD & stats
    vocabulary-claude.service # AI vocabulary extraction
    conversation-storage.service # Session persistence (MongoDB)
    gamification.service      # XP, levels, streaks (localStorage)
    virtual-avatar.service    # Avatar state management
  shared/interfaces/          # TypeScript interfaces
  pipes/
    markdown.pipe             # Markdown to sanitized HTML

server/
  src/
    routes/
      claude.routes.js        # Claude API proxy
      conversation.routes.js  # Conversation CRUD & history
    models/
      conversation.model.js   # Mongoose schema
    index.js                  # Express server entry point
```

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/claude/messages` | Proxy to Claude API |
| GET | `/api/conversations/active` | Get active conversation |
| POST | `/api/conversations` | Create new conversation |
| GET | `/api/conversations/history` | List past conversations |
| GET | `/api/conversations/:id` | Load specific conversation |
| PUT | `/api/conversations/:id` | Update conversation |
| POST | `/api/conversations/:id/archive` | Archive conversation |
| DELETE | `/api/conversations/:id` | Delete conversation |
| GET | `/api/health` | Health check |
