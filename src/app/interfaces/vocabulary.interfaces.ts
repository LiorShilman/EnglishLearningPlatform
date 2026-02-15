export type VocabLevel = 1 | 2 | 3 | 4;

export interface RawVocabItem {
    english?: string;
    hebrew?: string;
    context?: string;
    examples?: Array<{
      english?: string;
      hebrew?: string;
    }>;
    suggestedLevel?: number;
    suggestedCategory?: string;
    confidence?: number;
  }

// interfaces/vocabulary.interfaces.ts
export interface VocabularyCard {
    id: string;
    english: string;
    hebrew: string;
    pronunciation: string;
    examples: Example[];
    tags: string[];
    level: VocabLevel;
    category: VocabCategory;
    createdAt: Date;
    updatedAt: Date;
    correctCount: number;
    incorrectCount: number;
    lastReviewed: Date | null;  // Using null instead of undefined
    nextReview: Date | null;    // Using null instead of undefined
  }

  export interface AutoVocabCard {
    english: string;
    hebrew: string;
    context: string;
    examples: Example[];
    suggestedLevel: VocabLevel;  // עדכון הטיפוס כאן
    suggestedCategory: VocabCategory;
    confidence: number;
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
  
  export interface ReviewSession {
    id: string;
    userId: string;
    cards: VocabularyCard[];
    startTime: Date;
    endTime?: Date;
    correctCount: number;
    incorrectCount: number;
    reviewType: 'spaced' | 'category' | 'level' | 'custom';
  }
  

  export interface LearningStats {
      totalCards: number;
      masteredCards: number;
      cardsToReview: number;
      averageAccuracy: number;
      categoryBreakdown: Record<VocabCategory, number>;
      levelBreakdown: Record<VocabLevel, number>;  // שימוש ב-VocabLevel במקום LevelNumber
      dailyProgress: {
        date: Date;
        cardsReviewed: number;
        accuracy: number;
      }[];
  }