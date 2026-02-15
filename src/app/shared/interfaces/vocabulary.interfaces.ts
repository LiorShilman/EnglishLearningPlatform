import { ChatMessage, ConversationContext } from "./english-learning.interfaces";

// src/app/interfaces/vocabulary.interfaces.ts
export interface VocabularyCard {
    id: string;
    english: string;
    hebrew: string;
    pronunciation: string;
    examples: Example[];
    tags: string[];
    level: number;
    category: VocabCategory;
    createdAt: Date;
    correctCount: number;
    incorrectCount: number;
    lastReviewed: Date | null;
  }
  
  export interface Example {
    english: string;
    hebrew: string;
    context?: string;
  }
  
  export type VocabCategory = 
    | 'nouns' 
    | 'verbs' 
    | 'adjectives' 
    | 'adverbs'
    | 'phrases' 
    | 'idioms' 
    | 'academic' 
    | 'business' 
    | 'daily_life';
  
  export interface AutoVocabCard {
    english: string;
    hebrew: string;
    context: string;
    examples: Example[];
    suggestedLevel: number;
    suggestedCategory: VocabCategory;
    confidence: number;
  }

  // interfaces/vocabulary.interfaces.ts
export interface ServiceContext {
    userLevel: UserLevel;
    previousMessages: ChatMessage[];
    conversationContext: ConversationContext;
    // Add any other properties you need
  }
  
  export interface UserLevel {
    speaking: number;
    writing: number;
    grammar: number;
    vocabulary: number;
  }
  