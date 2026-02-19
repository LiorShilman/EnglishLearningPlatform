import { UserLevel, EnhancedChatMessage, ProgressMetrics, FocusArea, Topic } from './english-learning.interfaces';

export interface ConversationSession {
  _id?: string;
  userLevel: UserLevel;
  chatMessages: EnhancedChatMessage[];
  currentTopic: Topic | null;
  conversationMode?: string;
  lastProgressUpdate?: {
    metrics: ProgressMetrics;
    focusAreas: FocusArea[];
  };
  currentStage: 'assessment' | 'topic-selection' | 'conversation';
}

export interface SessionMetadata {
  id: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  topicName?: string;
  userLevel: UserLevel;
}
