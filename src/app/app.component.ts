import { Component, ViewChild, ElementRef, NgZone, AfterViewInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VocabularyComponent } from '../app/components/vocabulary/vocabulary.component';
import { EnhancedClaudeService } from './services/enhanced-claude.service';
import {
  UserLevel,
  ChatMessage,
  ProgressMetrics,
  FocusArea,
  Topic,
  ServiceContext,
  EnhancedChatMessage,
} from './shared/interfaces/english-learning.interfaces';
import { MarkdownPipe } from './pipes/markdown.pipe';
import * as annyang from 'annyang';
import { VocabularyService } from './services/vocabulary.service';
import { VirtualAvatarComponent } from './components/virtual-avatar/virtual-avatar.component';
import { VirtualAvatarService } from './services/virtual-avatar.service';
import { AssessmentComponent } from './components/assessment/assessment.component';
import { SummaryComponent } from './components/summary/summary.component';
import { ConversationStorageService } from './services/conversation-storage.service';
import { SessionMetadata } from './shared/interfaces/conversation-session.interfaces';
import { GamificationService } from './services/gamification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MarkdownPipe,
    VocabularyComponent,
    VirtualAvatarComponent,
    AssessmentComponent,
    SummaryComponent
  ],
  providers: [VirtualAvatarService],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scrollContainer', { static: false }) scrollContainer?: ElementRef;
  @ViewChild('virtualAvatar', { static: false }) virtualAvatar?: VirtualAvatarComponent;
  @ViewChild('summaryComponent', { static: false }) summaryComponent?: SummaryComponent;

  isAssistantSpeaking = false;
  isAssistantThinking = false;
  assistantMood: 'normal' | 'happy' | 'thinking' | 'concerned' = 'normal';

  isVocabularyVisible = true;
  showScrollButton = false;
  showSummary = false;
  private scrollObserver: MutationObserver | null = null;
  private scrollListener: (() => void) | null = null;
  private retryIntervalId: ReturnType<typeof setInterval> | null = null;
  currentStage: 'assessment' | 'topic-selection' | 'conversation' = 'assessment';
  userAssessmentComplete = false;
  userInput = '';
  isRecording = false;
  lastProgressUpdate?: {
    metrics: ProgressMetrics;
    focusAreas: FocusArea[];
  };

  private annyang: any;

  userLevel: UserLevel = {
    speaking: 0,
    writing: 0,
    grammar: 0,
    vocabulary: 0
  };

  chatMessages: EnhancedChatMessage[] = [];
  currentTopic: Topic | null = null;

  private sessionId: string | null = null;
  showHistory = false;
  conversationHistory: SessionMetadata[] = [];

  // Gamification
  gamificationLevel = 1;
  currentXP = 0;
  requiredXP = 100;
  xpPercentage = 0;
  streakDays = 0;
  private gamificationSub?: Subscription;

  // Celebration
  showCelebration = false;
  celebrationIcon = '';
  celebrationTextEn = '';
  celebrationTextHe = '';
  confettiPieces = Array.from({ length: 12 }, (_, i) => i);

  constructor(
    private enhancedClaudeService: EnhancedClaudeService,
    private vocabularyService: VocabularyService,
    private conversationStorageService: ConversationStorageService,
    private gamificationService: GamificationService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    if (annyang) {
      this.annyang = annyang;
    }
  }

  ngOnInit() {
    this.setupSpeechRecognition();
    this.attemptSessionRestore();
    this.setupGamification();
  }

  private setupGamification(): void {
    this.gamificationSub = this.gamificationService.currentState$.subscribe(state => {
      this.gamificationLevel = state.level;
      this.streakDays = state.streak;
      const xpInfo = this.gamificationService.getXPToNextLevel();
      this.currentXP = xpInfo.current;
      this.requiredXP = xpInfo.required;
      this.xpPercentage = xpInfo.percentage;
    });
  }

  triggerCelebration(icon: string, textEn: string, textHe: string): void {
    this.showCelebration = true;
    this.celebrationIcon = icon;
    this.celebrationTextEn = textEn;
    this.celebrationTextHe = textHe;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.showCelebration = false;
      this.cdr.detectChanges();
    }, 3000);
  }

  getConfettiColor(index: number): string {
    const colors = ['#7B8CDE', '#70C1B3', '#FFB997', '#B6A4CE', '#4ade80', '#FF6B6B'];
    return colors[index % colors.length];
  }

  private async attemptSessionRestore(): Promise<void> {
    try {
      const session = await this.conversationStorageService.loadActiveSession();
      if (!session) return;

      this.sessionId = session._id || null;
      this.userLevel = session.userLevel;
      this.chatMessages = session.chatMessages;
      this.currentTopic = session.currentTopic;
      this.lastProgressUpdate = session.lastProgressUpdate;
      this.currentStage = session.currentStage;
      this.userAssessmentComplete = true;

      this.cdr.detectChanges();

      setTimeout(() => {
        if (this.scrollContainer?.nativeElement) {
          this.initScrollContainer();
        }
        if (this.virtualAvatar) {
          this.initVirtualAvatar();
        }
        this.scrollToBottom();
      }, 200);
    } catch (error) {
      console.error('Error restoring session:', error);
    }
  }

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        if (this.userAssessmentComplete) {
          if (this.scrollContainer?.nativeElement) {
            this.initScrollContainer();
          }
          if (this.virtualAvatar) {
            this.initVirtualAvatar();
          }
        }
        this.ngZone.run(() => {
          this.cdr.detectChanges();
        });
      }, 100);
    });
  }

  // Assessment callback
  async onAssessmentComplete(level: UserLevel): Promise<void> {
    this.userLevel = level;
    this.userAssessmentComplete = true;

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      if (this.scrollContainer?.nativeElement) {
        this.initScrollContainer();
      }
      if (this.virtualAvatar) {
        this.initVirtualAvatar();
      }

      this.chatMessages.push(this.buildWelcomeMessage(this.userLevel));
      this.currentStage = 'conversation';
      this.saveCurrentSession();

      const leveledUp = this.gamificationService.addXP(50);
      if (leveledUp) {
        this.triggerCelebration('🎓', 'Level Up!', 'עלית רמה!');
      }

      setTimeout(() => this.scrollToBottom(), 150);
    } catch (error) {
      console.error('[AppComponent] Error during assessment completion:', error);
    }
  }

  // Summary callbacks
  onShowSummary(): void {
    this.summaryComponent?.openSummary();
  }

  onCloseSummary(): void {
    this.showSummary = false;
  }

  // Virtual Avatar
  initVirtualAvatar(): void {
    if (!this.virtualAvatar) return;

    try {
      this.virtualAvatar.setMood('normal');
      this.isAssistantSpeaking = false;
      this.isAssistantThinking = false;
    } catch (error) {
      console.error('[AppComponent] Error initializing virtual avatar:', error);
    }
  }

  retryVirtualAvatarInit(attempts: number = 3): void {
    let currentAttempt = 0;
    this.retryIntervalId = setInterval(() => {
      currentAttempt++;
      if (this.virtualAvatar) {
        this.initVirtualAvatar();
        clearInterval(this.retryIntervalId!);
        this.retryIntervalId = null;
      } else if (currentAttempt >= attempts) {
        clearInterval(this.retryIntervalId!);
        this.retryIntervalId = null;
      }
    }, 500);
  }

  toggleVocabulary(): void {
    this.isVocabularyVisible = !this.isVocabularyVisible;
  }

  // Scroll Management
  initScrollContainer(): void {
    if (!this.scrollContainer?.nativeElement) return;

    const container = this.scrollContainer.nativeElement;

    try {
      this.scrollObserver = new MutationObserver(() => {
        this.checkScrollPosition();
      });

      this.scrollObserver.observe(container, {
        childList: true,
        subtree: true
      });

      this.scrollListener = () => this.checkScrollPosition();
      container.addEventListener('scroll', this.scrollListener);

      this.scrollToBottom();
    } catch (error) {
      console.error('Error in initScrollContainer:', error);
    }
  }

  scrollToBottom(): void {
    try {
      if (!this.scrollContainer?.nativeElement) return;

      const element = this.scrollContainer.nativeElement;
      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'smooth'
      });
    } catch (error) {
      console.error('Error scrolling to bottom:', error);
    }
  }

  scrollToLastMessage(): void {
    try {
      if (!this.scrollContainer?.nativeElement) return;

      const container = this.scrollContainer.nativeElement;
      const messages = container.querySelectorAll('.message-container');
      const lastMessage = messages[messages.length - 1] as HTMLElement;
      if (lastMessage) {
        const messageTop = lastMessage.offsetTop - container.offsetTop;
        container.scrollTo({
          top: messageTop - 12,
          behavior: 'smooth'
        });
      }
    } catch (error) {
      console.error('Error scrolling to last message:', error);
    }
  }

  checkScrollPosition(): void {
    if (!this.scrollContainer?.nativeElement) return;

    const element = this.scrollContainer.nativeElement;
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 150;
    this.showScrollButton = !isNearBottom;
  }

  // Cleanup
  ngOnDestroy() {
    this.scrollObserver?.disconnect();
    if (this.scrollListener && this.scrollContainer?.nativeElement) {
      this.scrollContainer.nativeElement.removeEventListener('scroll', this.scrollListener);
    }
    if (this.retryIntervalId) {
      clearInterval(this.retryIntervalId);
    }
    if (this.annyang) {
      this.annyang.abort();
    }
    this.enhancedClaudeService.stopSpeech();
    this.gamificationSub?.unsubscribe();
  }

  // Speech Recognition
  clearInput() {
    this.userInput = '';
    if (this.isRecording) {
      this.annyang.abort();
    }
  }

  setupSpeechRecognition() {
    this.annyang.setLanguage('en-US');

    this.annyang.addCallback('result', (phrases: string[]) => {
      if (phrases && phrases.length > 0) {
        this.ngZone.run(() => {
          const space = this.userInput.trim().length > 0 ? ' ' : '';
          this.userInput = this.userInput.trim() + space + phrases[0];
        });
      }
    });

    this.annyang.addCallback('start', () => {
      this.ngZone.run(() => {
        this.isRecording = true;
      });
    });

    this.annyang.addCallback('end', () => {
      this.ngZone.run(() => {
        this.isRecording = false;
      });
    });

    this.annyang.addCallback('error', (error: any) => {
      console.error('Speech recognition error:', error);
      this.ngZone.run(() => {
        this.isRecording = false;
      });
    });
  }

  toggleSpeechRecognition() {
    if (!this.annyang) {
      console.warn('Speech recognition is not supported in this browser');
      return;
    }

    if (this.isRecording) {
      this.annyang.abort();
    } else {
      try {
        this.annyang.start({ autoRestart: false, continuous: false });
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        this.isRecording = false;
      }
    }
  }

  // Chat Methods
  async sendMessage(): Promise<void> {
    if (!this.userInput.trim()) return;

    try {
      this.isAssistantThinking = true;
      await this.virtualAvatar?.think();

      const userMessage: ChatMessage = {
        sender: 'user',
        english: this.userInput.trim(),
        timestamp: new Date()
      };

      this.chatMessages.push(userMessage);
      setTimeout(() => this.scrollToBottom(), 50);

      this.enhancedClaudeService.stopSpeech();
      const isFirstUserMessage = this.chatMessages.filter(m => m.sender === 'user').length === 0;
      this.userInput = '';

      const context: ServiceContext = {
        userLevel: this.userLevel,
        previousMessages: this.chatMessages,
        conversationContext: {
          isFirstMessage: isFirstUserMessage,
          currentTopic: this.currentTopic,
          lastProgressUpdate: this.lastProgressUpdate
        }
      };

      const response = await this.enhancedClaudeService.sendEnhancedMessage(
        userMessage.english,
        context
      );

      this.isAssistantThinking = false;

      if (response.english.includes('correct') || response.english.includes('Well done')) {
        this.virtualAvatar?.setMood('happy');
      } else if (response.english.includes('mistake') || response.english.toLowerCase().includes('error')) {
        this.virtualAvatar?.setMood('concerned');
      }

      await this.virtualAvatar?.speak(response.english);

      this.chatMessages.push(response);
      setTimeout(() => this.scrollToLastMessage(), 100);

      // Gamification: award XP for sending a message
      this.gamificationService.incrementMessages();
      const leveledUp = this.gamificationService.addXP(10);
      if (leveledUp) {
        this.triggerCelebration('⭐', 'Level Up!', 'עלית רמה!');
      }

      setTimeout(() => {
        this.virtualAvatar?.setMood('normal');
      }, 2000);

      await this.processVocabulary(context);

      if (response.feedback && response.feedback.length > 0) {
        this.updateProgress(response);
      }

      this.saveCurrentSession();
    } catch (error) {
      console.error('Error in chat:', error);
      this.isAssistantThinking = false;
      this.handleError();
    }
  }

  // Helper Methods
  calculateAverageLevel(): number {
    const sum = Object.values(this.userLevel).reduce((acc, val) => acc + val, 0);
    return Number((sum / Object.keys(this.userLevel).length).toFixed(2));
  }

  updateProgress(response: ChatMessage): void {
    if (!this.lastProgressUpdate) {
      this.lastProgressUpdate = {
        metrics: {
          speaking: { score: 0, accuracy: 0, fluency: 0 },
          writing: { score: 0, structure: 0, style: 0 },
          grammar: { score: 0, accuracy: 0, range: 0 },
          vocabulary: { score: 0, active: 0, passive: 0 }
        },
        focusAreas: []
      };
    }

    response.feedback?.forEach(feedback => {
      if (feedback.type === 'grammar') {
        this.lastProgressUpdate!.metrics.grammar.score += 1;
      } else if (feedback.type === 'vocabulary') {
        this.lastProgressUpdate!.metrics.vocabulary.score += 1;
      }
    });
  }

  getProgressMetrics(): Array<{ nameEn: string; nameHe: string; value: number }> {
    if (!this.lastProgressUpdate) return [];

    return [
      { nameEn: 'Speaking', nameHe: 'דיבור', value: this.lastProgressUpdate.metrics.speaking.score },
      { nameEn: 'Writing', nameHe: 'כתיבה', value: this.lastProgressUpdate.metrics.writing.score },
      { nameEn: 'Grammar', nameHe: 'דקדוק', value: this.lastProgressUpdate.metrics.grammar.score },
      { nameEn: 'Vocabulary', nameHe: 'אוצר מילים', value: this.lastProgressUpdate.metrics.vocabulary.score }
    ];
  }

  handleError(): void {
    const errorMessage: ChatMessage = {
      sender: 'assistant',
      english: "I apologize, but I encountered a technical issue. Could you please try rephrasing your message?",
      hebrew: "אני מתנצל, אך נתקלתי בבעיה טכנית. האם תוכל לנסח מחדש את ההודעה שלך?",
      timestamp: new Date()
    };
    this.chatMessages.push(errorMessage);
  }

  getInputPlaceholder(): string {
    const avgLevel = this.calculateAverageLevel();
    return avgLevel <= 2
      ? "Type your message in English... | הקלד/י את ההודעה שלך באנגלית..."
      : "Express yourself in English... | התבטא/י באנגלית...";
  }

  getStrokeDashoffset(value: number): number {
    const circumference = 2 * Math.PI * 20;
    return circumference - (value / 100) * circumference;
  }

  getMetricColor(name: string): string {
    const colors: Record<string, string> = {
      'Speaking': '#7B8CDE',
      'Writing': '#70C1B3',
      'Grammar': '#FFB997',
      'Vocabulary': '#B6A4CE'
    };
    return colors[name] || '#7B8CDE';
  }

  getBlockIcon(type: string): string {
    switch (type) {
      case 'grammar': return '📝';
      case 'usage': return '💡';
      case 'warning': return '⚠️';
      case 'practice': return '🔄';
      default: return '📌';
    }
  }

  async processVocabulary(context: ServiceContext): Promise<void> {
    try {
      const recentMessages = this.chatMessages.slice(-3);
      await this.vocabularyService.processConversation(recentMessages, context);
    } catch (error) {
      console.error('Error processing vocabulary:', error);
    }
  }

  trackByMessageIndex(index: number): number {
    return index;
  }

  trackByBlockIndex(index: number): number {
    return index;
  }

  trackByExampleIndex(index: number): number {
    return index;
  }

  private async saveCurrentSession(): Promise<void> {
    try {
      const data = {
        userLevel: this.userLevel,
        chatMessages: this.chatMessages,
        currentTopic: this.currentTopic,
        lastProgressUpdate: this.lastProgressUpdate,
        currentStage: this.currentStage
      };

      if (this.sessionId) {
        await this.conversationStorageService.saveSession(this.sessionId, data);
      } else {
        const created = await this.conversationStorageService.createSession(data);
        if (created?._id) {
          this.sessionId = created._id;
        }
      }
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  async startNewConversation(): Promise<void> {
    if (this.sessionId) {
      await this.conversationStorageService.archiveSession(this.sessionId);
    }

    this.sessionId = null;
    this.userLevel = { speaking: 0, writing: 0, grammar: 0, vocabulary: 0 };
    this.chatMessages = [];
    this.currentTopic = null;
    this.lastProgressUpdate = undefined;
    this.currentStage = 'assessment';
    this.userAssessmentComplete = false;
    this.showHistory = false;
  }

  async toggleHistory(): Promise<void> {
    this.showHistory = !this.showHistory;
    if (this.showHistory) {
      this.conversationHistory = await this.conversationStorageService.getHistory();
    }
  }

  async deleteConversation(sessionMeta: SessionMetadata, event: Event): Promise<void> {
    event.stopPropagation();

    const confirmed = confirm('Delete this conversation?\nלמחוק שיחה זו?');
    if (!confirmed) return;

    const success = await this.conversationStorageService.deleteSession(sessionMeta.id);
    if (success) {
      this.conversationHistory = this.conversationHistory.filter(s => s.id !== sessionMeta.id);
    }
  }

  async loadConversation(sessionMeta: SessionMetadata): Promise<void> {
    // Archive current active session first
    if (this.sessionId) {
      await this.conversationStorageService.archiveSession(this.sessionId);
    }

    const session = await this.conversationStorageService.loadSession(sessionMeta.id);
    if (!session) {
      // Remove stale entry from history list and notify user
      this.conversationHistory = this.conversationHistory.filter(s => s.id !== sessionMeta.id);
      alert('לא ניתן לטעון שיחה זו — ייתכן שנמחקה.\nThis conversation could not be loaded — it may have been deleted.');
      return;
    }

    // Reactivate the loaded session
    await this.conversationStorageService.reactivateSession(sessionMeta.id);

    this.sessionId = session._id || null;
    this.userLevel = session.userLevel;
    this.chatMessages = session.chatMessages;
    this.currentTopic = session.currentTopic;
    this.lastProgressUpdate = session.lastProgressUpdate;
    this.currentStage = session.currentStage;
    this.userAssessmentComplete = true;
    this.showHistory = false;

    this.cdr.detectChanges();

    setTimeout(() => {
      if (this.scrollContainer?.nativeElement) {
        this.initScrollContainer();
      }
      if (this.virtualAvatar) {
        this.initVirtualAvatar();
      }
      this.scrollToBottom();
    }, 200);
  }

  private buildWelcomeMessage(level: UserLevel): EnhancedChatMessage {
    const levelNames: Record<number, { en: string; he: string }> = {
      1: { en: 'Beginner', he: 'מתחיל' },
      2: { en: 'Elementary', he: 'בסיסי' },
      3: { en: 'Intermediate', he: 'בינוני' },
      4: { en: 'Advanced', he: 'מתקדם' }
    };

    const skillRows = (['writing', 'grammar', 'vocabulary', 'speaking'] as const)
      .map(skill => {
        const val = level[skill];
        const name = levelNames[val] || levelNames[1];
        const label = skill.charAt(0).toUpperCase() + skill.slice(1);
        return `| ${label} | ${name.en} (${val}) |`;
      }).join('\n');

    const english = `# Welcome to Your English Learning Journey

Hello! I'm your AI English learning companion. I'm excited to help you improve your English skills through engaging conversations and personalized feedback!

---

## Your Current English Profile

| Skill | Level |
|-------|-------|
${skillRows}

---

## Let's Start a Conversation

Choose a topic that interests you, or suggest your own:

### Daily Life Topics
1. **My Daily Routine** - Talk about your typical day
2. **My Favorite Food** - Describe what you like to eat
3. **My Family** - Tell me about the people in your family

### Fun & Creative Topics
1. **My Hobbies** - What do you do for fun?
2. **Weekend Plans** - What do you like to do on weekends?

### Simple Practice Scenarios
1. **At the Store** - Practice shopping conversations
2. **Meeting Someone New** - Practice introductions

---

## How This Works
- You write in English
- I help you correct mistakes
- I explain grammar simply
- We practice together
- You improve step by step

Which topic would you like to talk about? Or tell me your own idea!
Type your choice (1-7) or write your own topic in English!`;

    const hebrew = `# ברוך הבא למסע לימוד האנגלית שלך

היי! אני קלוד, המלווה שלך ללימוד אנגלית. אני כאן לעזור לך לשפר את האנגלית שלך בצורה מהנה!

### הרמה שלך כרגע
- כתיבה: ${levelNames[level.writing]?.he || 'מתחיל'} - נתמקד במשפטים פשוטים
- דקדוק: ${levelNames[level.grammar]?.he || 'מתחיל'} - נלמד חוקים בסיסיים
- אוצר מילים: ${levelNames[level.vocabulary]?.he || 'מתחיל'} - נרחיב את המילים שלך
- דיבור: ${levelNames[level.speaking]?.he || 'מתחיל'} - נתרגל ביטויים יומיומיים

בחר נושא שמעניין אותך, או הצע נושא משלך!`;

    return {
      sender: 'assistant',
      english,
      hebrew,
      learningBlocks: [],
      timestamp: new Date()
    };
  }
}
