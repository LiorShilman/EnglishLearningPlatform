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

  constructor(
    private enhancedClaudeService: EnhancedClaudeService,
    private vocabularyService: VocabularyService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    if (annyang) {
      this.annyang = annyang;
    }
  }

  ngOnInit() {
    this.setupSpeechRecognition();
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

      const context: ServiceContext = {
        userLevel: this.userLevel,
        previousMessages: [],
        conversationContext: {
          isFirstMessage: true,
          currentTopic: null,
          lastProgressUpdate: undefined
        }
      };

      const initialMessage = await this.enhancedClaudeService.sendEnhancedMessage(
        'START_CONVERSATION',
        context
      );

      this.chatMessages.push(initialMessage);
      this.currentStage = 'conversation';
      this.scrollToBottom();
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
      await this.virtualAvatar?.think();

      const userMessage: ChatMessage = {
        sender: 'user',
        english: this.userInput.trim(),
        timestamp: new Date()
      };

      this.chatMessages.push(userMessage);
      this.checkScrollPosition();

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

      if (response.english.includes('correct') || response.english.includes('Well done')) {
        this.virtualAvatar?.setMood('happy');
      } else if (response.english.includes('mistake') || response.english.toLowerCase().includes('error')) {
        this.virtualAvatar?.setMood('concerned');
      }

      await this.virtualAvatar?.speak(response.english);

      this.chatMessages.push(response);

      setTimeout(() => {
        this.virtualAvatar?.setMood('normal');
      }, 2000);

      await this.processVocabulary(context);

      setTimeout(() => this.scrollToBottom(), 100);

      if (response.feedback && response.feedback.length > 0) {
        this.updateProgress(response);
      }

      this.scrollToBottom();
    } catch (error) {
      console.error('Error in chat:', error);
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
}
