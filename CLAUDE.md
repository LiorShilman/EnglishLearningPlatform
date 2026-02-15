# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

### Frontend (Angular)
```bash
npm start          # ng serve — dev server at localhost:4200 (proxies /api to backend)
npm run build      # ng build — production build to dist/english-learning-platform
npm run watch      # ng build --watch --configuration development
npm test           # ng test — runs Karma/Jasmine tests
```

### Backend (Express/MongoDB)
```bash
cd server && npm install   # install backend dependencies separately
cd server && npm start     # node src/index.js — runs on PORT from .env (default 3000)
cd server && npm run dev   # node --watch — auto-restart on changes
```

Both must run simultaneously. Frontend proxies `/api` requests to backend via `proxy.conf.json` (target: `http://localhost:5000`).

### Server Environment
Create `server/.env`:
```
CLAUDE_API_KEY=your-api-key
PORT=5000
MONGO_URI=mongodb://localhost:27017/english-learning
```

### Production Build (IIS deployment)
```bash
ng build --base-href /EnglishLearning/
```

## Architecture

Angular 18 standalone-component SPA for interactive English learning, powered by Claude AI. No NgModules — uses `bootstrapApplication` with standalone components throughout.

### Core Flow

1. **Assessment stage** — User self-rates 4 skills (speaking, writing, grammar, vocabulary) on a 1–4 scale via radar chart UI. This determines AI conversation complexity.
2. **Chat interface** — Split layout: vocabulary panel (left, toggled) + AI conversation (center) + floating action bar (right). Messages include real-time corrections, learning blocks (grammar/usage/warning/practice), and bilingual content (English/Hebrew).
3. **Vocabulary system** — Cards auto-extracted from conversations via Claude analysis. Suggestions panel appears inside vocabulary component with Add/Reject per word. Includes spaced repetition review and stats tracking.
4. **Conversation persistence** — Sessions saved to MongoDB via REST API. History drawer allows loading past conversations and deleting them.
5. **Gamification** — XP, levels (1–10), and streaks tracked in localStorage via GamificationService. XP awarded for messages (+10) and assessment completion (+50).

### Backend API Routes

- `POST /api/claude/chat` — Proxy to Claude API
- `GET /api/conversations/active` — Get active conversation
- `POST /api/conversations` — Create new conversation
- `GET /api/conversations/history` — List past conversations
- `GET /api/conversations/:id` — Load specific conversation
- `PUT /api/conversations/:id` — Update conversation
- `POST /api/conversations/:id/archive` — Archive conversation
- `DELETE /api/conversations/:id` — Delete conversation
- `GET /api/health` — Health check (includes DB connection status)

### Key Services

- **EnhancedClaudeService** — Main AI service. Manages conversation history, generates system prompts based on user level, processes responses into structured feedback/learning blocks, handles TTS via browser speech synthesis.
- **VocabularyService** — Vocabulary card CRUD with BehaviorSubject state. Tracks review stats, categories, mastery levels. Receives conversation messages and triggers Claude-powered word extraction.
- **VocabularyClaudeService** — Claude-powered vocabulary extraction and analysis from conversations.
- **ConversationStorageService** — HTTP client for conversation persistence REST API (CRUD + archive).
- **GamificationService** — XP, level, streak tracking with localStorage persistence. Exposes state via BehaviorSubject.
- **VirtualAvatarService** — Avatar state management (mood, speaking/thinking states).

### Key Interfaces

- `src/app/shared/interfaces/english-learning.interfaces.ts` — Core types: UserLevel, ChatMessage, EnhancedChatMessage, LearningBlock, ServiceContext
- `src/app/interfaces/vocabulary.interfaces.ts` — VocabularyCard, review tracking types
- `src/app/shared/interfaces/vocabulary.interfaces.ts` — AutoVocabCard (suggested vocabulary from conversations)

### Component Structure

- **AppComponent** — Main orchestrator: assessment flow, chat, speech recognition (annyang.js), FAB, history drawer, gamification bar
- **VocabularyComponent** — Card management with 4 views (cards/review/stats/add) + suggestions panel for AI-extracted words
- **SummaryComponent** — Conversation summary modal showing corrections. Triggered externally via ViewChild from FAB button (its own button is hidden due to stacking context constraints)
- **VirtualAvatarComponent** — Animated emoji avatar with moods (normal/happy/thinking/concerned)
- **AssessmentComponent** — Skill assessment with radar chart visualization
- **TypingMessageComponent** / **AnimatedLearningBlockComponent** — Chat UI animation elements (currently unused in template, kept for potential reuse)

### UI Layout

- **Floating Action Bar (FAB)** — Fixed right side, vertically centered. Buttons: V (vocabulary toggle), S (summary), arrow-down (scroll), + (new conversation), hamburger (history drawer). Uses glass morphism styling with `backdrop-filter`.
- **History Drawer** — Full-height slide-in panel from right (360px wide), z-index 200, with backdrop overlay at z-index 150. Items have CSS-only icons (no emoji entities — they don't render reliably).
- **CSS stacking context caveat** — The FAB container creates a stacking context (`backdrop-filter` + `z-index`). Modals/overlays must be placed OUTSIDE `.floating-actions` in the template to escape it.

### State Management

RxJS BehaviorSubjects in services — no external state library. NgZone used selectively to run operations outside change detection. GamificationService persists to localStorage.

## Conventions

- **Bilingual UI**: All user-facing text has English + Hebrew. Source code comments are sometimes in Hebrew.
- **Styling**: Component-level SCSS with glass morphism theme (dark background, `backdrop-filter: blur`, subtle borders). Semantic accent colors: teal=grammar, periwinkle=usage, coral=warning, lavender=practice. Animated aurora background with ambient particles.
- **Icons**: Use CSS pseudo-elements or plain text characters for icons — avoid HTML emoji entities (`&#x1F4DD;`) as they don't render consistently across browsers.
- **Routing**: `app.routes.ts` exists but is currently empty — single-page app with no routing.
- **API proxy**: Frontend calls `/api/*` which proxies to backend. Claude API key lives in `server/.env`, NOT in frontend code.
- **Custom pipes**: MarkdownPipe transforms markdown to sanitized HTML.
- **MongoDB models**: Mongoose models live in `server/src/models/`. Conversation model stores messages, user level, and session metadata.
