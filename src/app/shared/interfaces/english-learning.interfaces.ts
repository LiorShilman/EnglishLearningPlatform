// shared/interfaces/english-learning.interfaces.ts

export type MessageRole = 'user' | 'assistant';

export interface ExplanationItem {
  text: string;
  isSubPoint: boolean;
}

export interface Correction {
  wrong: string;
  right: string;
  explanation?: string;
}

export interface DetailedChange {
  wrong: string;
  right: string;
  explanation: string ;
}

export interface CorrectionBlock {
  timestamp: string;
  corrections: Array<{
    wrong: string;
    right: string;
    explanations: string[];  // שינוי מ-explanation ל-explanations כמערך
  }>;
}

export interface UserLevel {
  speaking: number;
  writing: number;
  grammar: number;
  vocabulary: number;
}

export interface ProgressMetrics {
  speaking: {
    score: number;
    accuracy: number;
    fluency: number;
  };
  writing: {
    score: number;
    structure: number;
    style: number;
  };
  grammar: {
    score: number;
    accuracy: number;
    range: number;
  };
  vocabulary: {
    score: number;
    active: number;
    passive: number;
  };
}

export interface FocusArea {
  priority: number;
  description: {
    english: string;
    hebrew: string;
  };
  status: number;
}

export interface Topic {
  english: string;
  hebrew: string;
}

// Enhanced interfaces to match the comprehensive guidelines
export interface LearningBlock {
    type: 'grammar' | 'usage' | 'warning' | 'practice';
    title: string;
    content: {
      english: string;
      hebrew: string;
    };
    examples?: Array<{
      english: string;
      hebrew: string;
    }>;
  }

export interface FeedbackItem {
  type: 'grammar' | 'vocabulary' | 'pronunciation';
  message: {
    english: string;
    hebrew: string;
  };
  suggestion?: string;
}

export interface ChatMessage {
  sender: 'user' | 'assistant';
  english: string;
  hebrew?: string;
  feedback?: FeedbackItem[];
  timestamp: Date;
}

export interface EnhancedChatMessage {
    sender: 'user' | 'assistant';
    english: string;
    hebrew?: string;
    feedback?: FeedbackItem[];
    learningBlocks?: LearningBlock[];
    progressUpdate?: {
      metrics: ProgressMetrics;
      focusAreas: FocusArea[];
    };
    timestamp: Date;
  }
  

export interface Skill {
  key: keyof UserLevel;
  nameEn: string;
  nameHe: string;
  selectedLevel?: number;
}

export interface Level {
  value: number;
  nameEn: string;
  nameHe: string;
}

export interface ConversationContext {
    isFirstMessage: boolean;
    currentTopic: Topic | null;
    modePromptAddition?: string;
    lastProgressUpdate?: {
      metrics: ProgressMetrics;
      focusAreas: FocusArea[];
      newTopic?: Topic;
    };
  }

export interface ServiceContext {
  userLevel: UserLevel;
  previousMessages: ChatMessage[];
  conversationContext: ConversationContext;
}

// Conversation Modes
export interface ConversationMode {
  id: string;
  nameEn: string;
  nameHe: string;
  descriptionEn: string;
  descriptionHe: string;
  icon: string;
  systemPromptAddition: string;
  welcomeMessageEn: string;
  welcomeMessageHe: string;
  suggestedTopics: string[];
}

// Daily Challenge
export type ChallengeType = 'translate-en-he' | 'translate-he-en' | 'fix-grammar' | 'use-word' | 'fill-blank';

export interface DailyChallenge {
  id: string;
  type: ChallengeType;
  promptEn: string;
  promptHe: string;
  sentence: string;
  hint?: string;
}

export interface DailyChallengeState {
  date: string;
  challenge: DailyChallenge;
  completed: boolean;
  userAnswer?: string;
  isCorrect?: boolean;
  feedbackEn?: string;
  feedbackHe?: string;
}