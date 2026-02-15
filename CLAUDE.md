# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm start          # ng serve — dev server at localhost:4200
npm run build      # ng build — production build to dist/english-learning-platform
npm run watch      # ng build --watch --configuration development
npm test           # ng test — runs Karma/Jasmine tests
```

The server backend (Express/MongoDB) lives in `server/` with its own package.json.

## Architecture

Angular 18 standalone-component SPA for interactive English learning, powered by Claude AI. No NgModules — uses `bootstrapApplication` with standalone components throughout.

### Core Flow

1. **Assessment stage** — User self-rates 4 skills (speaking, writing, grammar, vocabulary) on a 1–4 scale. This determines AI conversation complexity.
2. **Chat interface** — Split layout: vocabulary cards (left) + AI conversation (right). Messages include real-time corrections, learning blocks (grammar/usage/warning/practice), and bilingual content (English/Hebrew).
3. **Vocabulary system** — Cards auto-extracted from conversations via Claude analysis, with spaced repetition review and stats tracking.

### Key Services

- **EnhancedClaudeService** — Main AI service. Manages conversation history, generates system prompts based on user level, processes responses into structured feedback/learning blocks, handles TTS via browser speech synthesis.
- **VocabularyService** — Vocabulary card CRUD with BehaviorSubject state. Tracks review stats, categories, mastery levels.
- **VocabularyClaudeService** — Claude-powered vocabulary extraction and analysis from conversations.
- **VirtualAvatarService** — Avatar state management (mood, speaking/thinking states).

### Key Interfaces

- `src/app/shared/interfaces/english-learning.interfaces.ts` — Core types: UserLevel, ChatMessage, EnhancedChatMessage, LearningBlock, ServiceContext
- `src/app/interfaces/vocabulary.interfaces.ts` — VocabularyCard, review tracking types

### Component Structure

- **AppComponent** — Main component handling assessment, chat, speech recognition (annyang.js), and overall layout
- **VocabularyComponent** — Card management with views: cards list, review session, stats, add form
- **VirtualAvatarComponent** — Animated emoji avatar with moods (normal/happy/thinking/concerned), blinking, idle behaviors
- **TypingMessageComponent** / **AnimatedLearningBlockComponent** — Chat UI elements

### State Management

RxJS BehaviorSubjects in services — no external state library. NgZone used selectively to run operations outside change detection.

## Conventions

- **Bilingual UI**: All user-facing text has English + Hebrew. Source code comments are sometimes in Hebrew.
- **Styling**: Component-level SCSS. Dark theme with semantic accent colors (teal=grammar, periwinkle=usage, coral=warning, lavender=practice).
- **Routing**: `app.routes.ts` exists but is currently empty — single-page app with no routing.
- **API key**: Claude API key is in `src/environments/environment.ts` (called directly from browser — no backend proxy currently).
- **Custom pipes**: MarkdownPipe transforms markdown to sanitized HTML.
