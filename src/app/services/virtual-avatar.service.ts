// services/virtual-avatar.service.ts

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface AvatarState {
  isSpeaking: boolean;
  isThinking: boolean;
  currentMood: 'normal' | 'happy' | 'thinking' | 'concerned';
  lastInteractionTime: Date;
}

@Injectable({
  providedIn: 'root'
})
export class VirtualAvatarService {
  
  // מצב האווטר הנוכחי
  private avatarState = new BehaviorSubject<AvatarState>({
    isSpeaking: false,
    isThinking: false,
    currentMood: 'normal',
    lastInteractionTime: new Date()
  });

  // חשיפת המצב כ-Observable
  avatarState$ = this.avatarState.asObservable();

  // פונקציות לעדכון מצב האווטר
  async startSpeaking(duration: number = 2000): Promise<void> {
    this.updateState({ isSpeaking: true, isThinking: false });
    
    return new Promise(resolve => {
      setTimeout(() => {
        this.updateState({ isSpeaking: false });
        resolve();
      }, duration);
    });
  }

  async startThinking(duration: number = 2000): Promise<void> {
    this.updateState({
      isThinking: true,
      currentMood: 'thinking'
    });

    return new Promise(resolve => {
      setTimeout(() => {
        this.updateState({
          isThinking: false,
          currentMood: 'normal'
        });
        resolve();
      }, duration);
    });
  }

  // ניתוח תגובה ועדכון מצב רוח בהתאם
  analyzeResponseAndUpdateMood(responseText: string): void {
    if (this.isPositiveResponse(responseText)) {
      this.setMood('happy');
    } else if (this.isNegativeResponse(responseText)) {
      this.setMood('concerned');
    }
  }

  setMood(mood: AvatarState['currentMood']): void {
    this.updateState({ currentMood: mood });
  }

  private updateState(partialState: Partial<AvatarState>): void {
    this.avatarState.next({
      ...this.avatarState.value,
      ...partialState,
      lastInteractionTime: new Date()
    });
  }

  private isPositiveResponse(text: string): boolean {
    const positiveKeywords = [
      'correct',
      'well done',
      'great',
      'excellent',
      'perfect'
    ];
    return positiveKeywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private isNegativeResponse(text: string): boolean {
    const negativeKeywords = [
      'mistake',
      'error',
      'incorrect',
      'not quite'
    ];
    return negativeKeywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // עזרה בזיהוי משפטים ספציפיים שמשפיעים על מצב הרוח
  private responsePatterns = {
    needsCorrection: [
      /that's not quite right/i,
      /let me help you with that/i,
      /there's a small mistake/i
    ],
    praise: [
      /excellent work/i,
      /that's perfect/i,
      /well done/i
    ]
  };

  // פונקציה לזיהוי תבניות תגובה
  analyzeResponsePattern(text: string): string | null {
    for (const [patternType, patterns] of Object.entries(this.responsePatterns)) {
      if (patterns.some(pattern => pattern.test(text))) {
        return patternType;
      }
    }
    return null;
  }
}