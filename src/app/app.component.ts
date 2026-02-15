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
  Skill,
  Level,
  Topic,
  ConversationContext,
  ServiceContext,
  EnhancedChatMessage,
  CorrectionBlock,
  DetailedChange,
  ExplanationItem,
} from './shared/interfaces/english-learning.interfaces';
import { MarkdownPipe } from './pipes/markdown.pipe';
import * as annyang from 'annyang';
import { VocabularyService } from './services/vocabulary.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { VirtualAvatarComponent } from './components/virtual-avatar/virtual-avatar.component';
import { VirtualAvatarService } from './services/virtual-avatar.service';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MarkdownPipe,
    VocabularyComponent,
    VirtualAvatarComponent  // הוספת הקומפוננטה כאן
  ],
  providers: [VirtualAvatarService],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']  // Note: styleUrls not styleUrl
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scrollContainer', { static: false }) scrollContainer?: ElementRef;
  @ViewChild('virtualAvatar', { static: false }) virtualAvatar?: VirtualAvatarComponent;

  // Add a flag to track initialization
  private viewsInitialized = false;

  // הוספת משתנים חדשים
  isAssistantSpeaking = false;
  isAssistantThinking = false;
  assistantMood: 'normal' | 'happy' | 'thinking' | 'concerned' = 'normal';

  // Add toggle functionality for mobile
  isVocabularyVisible = true;
  showScrollButton = false;
  showSummary = false;
  correctionBlocks: CorrectionBlock[] = [];
  currentSummaryHTML = '';
  private scrollObserver: MutationObserver | null = null;
  currentStage: 'assessment' | 'topic-selection' | 'conversation' = 'assessment';
  userAssessmentComplete = false;
  userInput = '';
  isRecording = false;
  lastProgressUpdate?: {
    metrics: ProgressMetrics;
    focusAreas: FocusArea[];
  };

  private annyang: any;

  // User Level Management
  userLevel: UserLevel = {
    speaking: 0,
    writing: 0,
    grammar: 0,
    vocabulary: 0
  };

  // Assessment Configuration
  skillsToAssess: Skill[] = [
    { key: 'speaking', nameEn: 'Speaking', nameHe: 'דיבור' },
    { key: 'writing', nameEn: 'Writing', nameHe: 'כתיבה' },
    { key: 'grammar', nameEn: 'Grammar', nameHe: 'דקדוק' },
    { key: 'vocabulary', nameEn: 'Vocabulary', nameHe: 'אוצר מילים' }
  ];

  levels: Level[] = [
    { value: 1, nameEn: 'Beginner', nameHe: 'מתחיל' },
    { value: 2, nameEn: 'Elementary', nameHe: 'בסיסי' },
    { value: 3, nameEn: 'Intermediate', nameHe: 'בינוני' },
    { value: 4, nameEn: 'Advanced', nameHe: 'מתקדם' }
  ];

  // Chat Management
  chatMessages: EnhancedChatMessage[] = [];
  currentTopic: Topic | null = null;

  constructor(private enhancedClaudeService: EnhancedClaudeService, private vocabularyService: VocabularyService,  // Add this
    private ngZone: NgZone,private cdr: ChangeDetectorRef,) {
    if (annyang) {
      this.annyang = annyang;
    }
  }

  ngOnInit() {
    // Initialize any required services or state
    this.setupSpeechRecognition();
  }

  // הוסף Event Listener לגלילה
  ngAfterViewInit() {
    console.log('[AppComponent] ngAfterViewInit called');
    
    // Run outside Angular's zone to avoid change detection issues
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        // Only try to initialize if assessment is complete
        if (this.userAssessmentComplete) {
          if (this.scrollContainer?.nativeElement) {
            this.initScrollContainer();
            console.log('[AppComponent] Scroll container initialized');
          } else {
            console.warn('[AppComponent] Scroll container not yet available in DOM');
          }

          if (this.virtualAvatar) {
            this.initVirtualAvatar();
            console.log('[AppComponent] Virtual avatar initialized');
          } else {
            console.warn('[AppComponent] Virtual avatar not yet available in DOM');
          }
        } else {
          console.log('[AppComponent] Waiting for assessment completion before initialization');
        }

        // Re-enter Angular zone for UI updates
        this.ngZone.run(() => {
          this.cdr.detectChanges();
        });
      }, 100);
    });
  }

  initVirtualAvatar(): void {
    if (!this.virtualAvatar) {
      console.warn('[AppComponent] Virtual avatar not available');
      return;
    }

    try {
      // Set initial state
      this.virtualAvatar.setMood('normal');
      this.isAssistantSpeaking = false;
      this.isAssistantThinking = false;
      
      // Verify the component methods are available
      if (typeof this.virtualAvatar.think !== 'function' ||
          typeof this.virtualAvatar.speak !== 'function' ||
          typeof this.virtualAvatar.setMood !== 'function') {
        console.error('[AppComponent] Virtual avatar methods not properly initialized');
        return;
      }

      console.log('[AppComponent] Virtual avatar successfully initialized');
    } catch (error) {
      console.error('[AppComponent] Error initializing virtual avatar:', error);
    }
  }

  retryVirtualAvatarInit(attempts: number = 3): void {
    let currentAttempt = 0;
    const retryInterval = setInterval(() => {
      currentAttempt++;
      console.log(`Retrying virtual avatar initialization, attempt ${currentAttempt}`);

      if (this.virtualAvatar) {
        this.initVirtualAvatar();
        clearInterval(retryInterval);
        console.log('Virtual avatar initialized after retry');
      } else if (currentAttempt >= attempts) {
        clearInterval(retryInterval);
        console.error('Failed to initialize virtual avatar after', attempts, 'attempts');
      }
    }, 500);
  }

  toggleVocabulary(): void {
    this.isVocabularyVisible = !this.isVocabularyVisible;
  }

  showConversationSummary() {
    const assistantMessages = this.chatMessages.filter(msg => msg.sender === 'assistant');
    this.correctionBlocks = [];

    assistantMessages.forEach((message) => {
      const englishContent = message.english;
      const block: CorrectionBlock = {
        timestamp: message.timestamp.toLocaleString(),
        corrections: []
      };

      // חיפוש Changes explained
      const changesMatch = englishContent.match(/Changes explained:\s*([\s\S]*?)(?=Let's continue|##|\n\n🎭|$)/i);
      let explanations: string[] = [];

      if (changesMatch?.[1]) {
        explanations = changesMatch[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && /^\d+\./.test(line))
          .map(line => line.replace(/^\d+\.\s*/, '').trim());
      }

      const correctionBlocks = englishContent.split(/(?=• Original:)/);

      correctionBlocks.forEach(correctionBlock => {
        const originalMatch = correctionBlock.match(/• Original: ~~([^~]+)~~/);
        const correctedMatch = correctionBlock.match(/• Corrected: ["'`]([^"'`]+)["'`]/);

        if (originalMatch?.[1] && correctedMatch?.[1]) {
          block.corrections.push({
            wrong: originalMatch[1].trim(),
            right: correctedMatch[1].trim(),
            explanations: explanations // כעת זה תואם לממשק
          });
        }
      });

      if (block.corrections.length > 0) {
        this.correctionBlocks.push(block);
      }
    });

    this.showSummary = true;
  }

  closeSummary() {
    this.showSummary = false;
  }



  extractExplanations(content: string): ExplanationItem[] {
    // מחפשים את החלק של Changes explained עם תבנית משופרת
    const changesSection = content.match(/Changes explained:[\s\S]*?((?:\d+\.[^\n]+\n?)+)/);

    if (!changesSection?.[1]) {
      console.log('No changes section found in:', content);
      return [];
    }

    // מנקים את הטקסט ומפצלים לשורות
    const changesText = changesSection[1].trim();
    console.log('Found changes text:', changesText);  // לדיבוג

    const lines = changesText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && /^\d+\./.test(line));

    console.log('Processed lines:', lines);  // לדיבוג

    // מעבדים כל שורה
    return lines.map(line => ({
      text: line.replace(/^\d+\.\s*/, '').trim(),
      isSubPoint: false
    }));
  }

  generateCorrectionsSummary(chatMessages: EnhancedChatMessage[]): string {
    const assistantMessages = chatMessages.filter(msg => msg.sender === 'assistant');
    let hasCorrections = false;

    let summaryHTML = `
      <div class="summary-header">
        <h2>Conversation Summary</h2>
        <div class="hebrew-title">סיכום שיחה</div>
      </div>`;

    assistantMessages.forEach((message) => {
      const englishContent = message.english;

      // חיפוש התיקונים הבסיסיים
      const pattern = /• Original: ~~([^~]+)~~[\s\n]*• Corrected: [`"]([^`"]+)[`"]/gms;
      const corrections = englishContent.match(pattern);

      if (corrections && corrections.length > 0) {
        hasCorrections = true;

        summaryHTML += `
          <div class="time-block">
            <div class="timestamp">${message.timestamp.toLocaleString()}</div>`;

        corrections.forEach(correction => {
          const wrongMatch = correction.match(/• Original: ~~([^~]+)~~/);
          const rightMatch = correction.match(/• Corrected: [`"]([^`"]+)[`"]/);

          if (wrongMatch?.[1] && rightMatch?.[1]) {
            const wrong = wrongMatch[1].trim();
            const right = rightMatch[1].trim();

            const explanations = this.extractExplanations(englishContent);
            console.log('Extracted explanations:', explanations);  // לדיבוג

            summaryHTML += `
              <div class="correction-container">
                <div class="error-row">
                  <span class="error-icon">✕</span>
                  <span class="correction-text">${wrong}</span>
                </div>
                <div class="success-row">
                  <span class="success-icon">✓</span>
                  <span class="correction-text">${right}</span>
                </div>`;

            if (explanations.length > 0) {
              summaryHTML += `<div class="explanations-list">`;
              explanations.forEach((explanation: ExplanationItem) => {
                summaryHTML += `
                  <div class="explanation-row">
                    <span class="info-icon">ℹ️</span>
                    <span class="explanation-text">${explanation.text}</span>
                  </div>`;
              });
              summaryHTML += `</div>`;
            }

            summaryHTML += `</div>`;
          }
        });

        summaryHTML += `</div>`;
      }
    });

    if (!hasCorrections) {
      return '<p>No corrections found in current conversation.</p>';
    }

    return `
      <style>
        .summary-header {
          padding: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .summary-header h2 {
          margin: 0;
          color: #fff;
          font-size: 1.25rem;
          font-weight: 500;
        }
        
        .hebrew-title {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.9rem;
          margin-top: 4px;
        }
        
        .time-block {
          padding: 16px;
          background: rgba(30, 32, 48, 0.5);
          border-radius: 8px;
          margin: 16px;
        }
        
        .timestamp {
          color: #8e94bb;
          font-size: 0.9rem;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .correction-container {
          background: #252842;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
        }
        
        .error-row, .success-row, .explanation-row {
          display: flex;
          align-items: center;
          padding: 12px;
          margin: 8px 0;
          border-radius: 4px;
        }
        
        .error-row {
          background: rgba(255, 68, 68, 0.1);
        }
        
        .success-row {
          background: rgba(46, 204, 113, 0.1);
        }
        
        .explanation-row {
          background: rgba(123, 140, 222, 0.1);
        }

        .explanation-row.sub-point {
          margin-left: 24px;
          border-left: 2px solid rgba(123, 140, 222, 0.3);
        }
        
        .error-icon, .success-icon, .info-icon {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 12px;
          font-weight: bold;
        }
        
        .error-icon {
          color: #ff4444;
        }
        
        .success-icon {
          color: #4ade80;
        }
        
        .correction-text {
          color: #fff;
          font-size: 0.95rem;
        }

        .explanations-list {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .explanation-text {
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.9rem;
          line-height: 1.4;
        }
      </style>
      
      ${summaryHTML}`;
  }

  /*   GeneratePracticeSummary(chatMessages: EnhancedChatMessage[]): string {
      // Filter only assistant messages
      const assistantMessages = chatMessages.filter(msg => msg.sender === 'assistant');
      
      let summaryHTML = '<div class="practice-summary">\n';
      
      // Process each message
      assistantMessages.forEach((message, index) => {
        const englishContent = message.english;
        
        // Extract Practice Questions using regex
        const practiceQuestionMatch = englishContent.match(/Practice Question:([^🔄]*)/g);
        const correctedVersionMatch = englishContent.match(/Here's the corrected version:`([^`]*)`/g);
        
        if (practiceQuestionMatch || correctedVersionMatch) {
          summaryHTML += `<div class="summary-item">\n`;
          summaryHTML += `<div class="timestamp">${message.timestamp.toLocaleString()}</div>\n`;
          
          // Add Practice Questions if found
          if (practiceQuestionMatch) {
            practiceQuestionMatch.forEach(question => {
              const cleanQuestion = question.replace('Practice Question:', '').trim();
              summaryHTML += `<div class="practice-question">
                <h3>🔄 Practice Question:</h3>
                <p>${cleanQuestion}</p>
              </div>\n`;
            });
          }
          
          // Add Corrections if found
          if (correctedVersionMatch) {
            correctedVersionMatch.forEach(correction => {
              const cleanCorrection = correction
                .replace("Here's the corrected version:", '')
                .replace(/`/g, '')
                .trim();
              summaryHTML += `<div class="correction">
                <h3>✅ Corrected Version:</h3>
                <p>${cleanCorrection}</p>
              </div>\n`;
            });
          }
          
          summaryHTML += `</div>\n`;
        }
      });
      
      summaryHTML += '</div>';
      
      // Add CSS styles
      summaryHTML = `
    <style>
    .practice-summary {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 20px auto;
      padding: 20px;
    }
    
    .summary-item {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .timestamp {
      color: #666;
      font-size: 0.9em;
      margin-bottom: 10px;
    }
    
    .practice-question, .correction {
      margin: 15px 0;
    }
    
    .practice-question h3, .correction h3 {
      color: #2c3e50;
      margin-bottom: 10px;
      font-size: 1.1em;
    }
    
    .practice-question p, .correction p {
      background-color: white;
      padding: 10px;
      border-radius: 4px;
      border-left: 4px solid #3498db;
      margin: 0;
    }
    
    .correction p {
      border-left-color: #2ecc71;
    }
    </style>
    ${summaryHTML}`;
    
      return summaryHTML;
    } */

      validateDOMStructure(): boolean {
        let isValid = true;
        const componentName = '[AppComponent]';
    
        // Check main container structure
        const chatSection = document.querySelector('.chat-section');
        if (!chatSection) {
          console.error(`${componentName} Main .chat-section container not found`);
          isValid = false;
        }
    
        // Check scroll container
        if (!document.querySelector('.chat-messages')) {
          console.error(`${componentName} .chat-messages container not found`);
          isValid = false;
        }
    
        // Check virtual avatar
        if (!document.querySelector('app-virtual-avatar')) {
          console.error(`${componentName} app-virtual-avatar component not found`);
          isValid = false;
        }
    
        return isValid;
      }

      initScrollContainer(): void {
        if (!this.scrollContainer?.nativeElement) {
          console.warn('No scroll container element found');
          return;
        }
    
        const container = this.scrollContainer.nativeElement;
        console.log('Initializing scroll container:', container);
    
        try {
          // Setup scroll observer
          this.scrollObserver = new MutationObserver(() => {
            this.checkScrollPosition();
          });
    
          this.scrollObserver.observe(container, {
            childList: true,
            subtree: true
          });
    
          // Add scroll listener
          container.addEventListener('scroll', () => {
            this.checkScrollPosition();
          });
    
          this.scrollToBottom();
        } catch (error) {
          console.error('Error in initScrollContainer:', error);
        }
      }

  // Use optional chaining and null checks
  scrollToBottom(): void {
    try {
      if (!this.scrollContainer?.nativeElement) {
        console.warn('Scroll container not found');
        return;
      }

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
    if (!this.scrollContainer?.nativeElement) {
      return;
    }

    const element = this.scrollContainer.nativeElement;
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 150;
    this.showScrollButton = !isNearBottom;
  }

  ngOnDestroy() {
    // Cleanup
    this.scrollObserver?.disconnect();
  }

  setupScrollObserver(): void {
    if (this.scrollContainer) {
      this.scrollObserver = new MutationObserver(() => {
        this.scrollToBottom();
      });

      this.scrollObserver.observe(this.scrollContainer.nativeElement, {
        childList: true,
        subtree: true
      });
    }
  }

  clearInput() {
    this.userInput = '';
    if (this.isRecording) {
      this.annyang.abort();
    }
  }

  setupSpeechRecognition() {
    // Set language
    this.annyang.setLanguage('en-US');

    // Add event listeners
    this.annyang.addCallback('result', (phrases: string[]) => {
      if (phrases && phrases.length > 0) {
        // Use NgZone to ensure UI updates
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


  // Assessment Methods
  selectLevel(skill: Skill, level: number): void {
    skill.selectedLevel = level;
    this.userLevel[skill.key] = level;
  }

  areAllSkillsAssessed(): boolean {
    return this.skillsToAssess.every(skill => skill.selectedLevel !== undefined);
  }

  async completeAssessment(): Promise<void> {
    if (!this.areAllSkillsAssessed()) return;

    this.userAssessmentComplete = true;
    const avgLevel = this.calculateAverageLevel();

    try {
      // Wait for view to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Initialize components now that the view is ready
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

  // Chat Methods
  async sendMessage(): Promise<void> {
    if (!this.userInput.trim()) return;

  
  try {
      // התחלת חשיבה
      await this.virtualAvatar?.think();

      const userMessage: ChatMessage = {
        sender: 'user',
        english: this.userInput.trim(),
        timestamp: new Date()
      };

      this.chatMessages.push(userMessage);

      
      this.checkScrollPosition(); // Add this line after messages are updated

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

       // עדכון מצב רוח לפי התוכן
       if (response.english.includes('correct') || response.english.includes('Well done')) {
        this.virtualAvatar?.setMood('happy');
      } else if (response.english.includes('mistake') || response.english.toLowerCase().includes('error')) {
        this.virtualAvatar?.setMood('concerned');
      }

      // התחלת דיבור
      await this.virtualAvatar?.speak(response.english);

      this.chatMessages.push(response);

      // חזרה למצב רגיל אחרי זמן קצר
      setTimeout(() => {
        this.virtualAvatar?.setMood('normal');
      }, 2000);

      // Process conversation for vocabulary after receiving response
      await this.processVocabulary(context);

      setTimeout(() => this.scrollToBottom(), 100);

      // Update progress if provided
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
    // Update progress based on feedback
    // This is a placeholder - implement actual progress tracking logic
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

    // Update metrics based on feedback
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
      {
        nameEn: 'Speaking',
        nameHe: 'דיבור',
        value: this.lastProgressUpdate.metrics.speaking.score
      },
      {
        nameEn: 'Writing',
        nameHe: 'כתיבה',
        value: this.lastProgressUpdate.metrics.writing.score
      },
      {
        nameEn: 'Grammar',
        nameHe: 'דקדוק',
        value: this.lastProgressUpdate.metrics.grammar.score
      },
      {
        nameEn: 'Vocabulary',
        nameHe: 'אוצר מילים',
        value: this.lastProgressUpdate.metrics.vocabulary.score
      }
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

  // Add new method to handle vocabulary processing
  async processVocabulary(context: ServiceContext): Promise<void> {
    try {
      // Get last few messages for context (e.g., last 3 messages)
      const recentMessages = this.chatMessages.slice(-3);

      // Process conversation for vocabulary suggestions
      await this.vocabularyService.processConversation(recentMessages, context);
    } catch (error) {
      console.error('Error processing vocabulary:', error);
    }
  }
}