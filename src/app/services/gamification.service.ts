import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface GamificationState {
  xp: number;
  level: number;
  streak: number;
  lastActivityDate: string;
  messagesCount: number;
  wordsLearned: number;
}

interface LevelThreshold {
  level: number;
  xpRequired: number;
}

@Injectable({ providedIn: 'root' })
export class GamificationService {
  private readonly STORAGE_KEY = 'english_learning_gamification';

  private readonly LEVEL_THRESHOLDS: LevelThreshold[] = [
    { level: 1, xpRequired: 0 },
    { level: 2, xpRequired: 100 },
    { level: 3, xpRequired: 300 },
    { level: 4, xpRequired: 600 },
    { level: 5, xpRequired: 1000 },
    { level: 6, xpRequired: 1500 },
    { level: 7, xpRequired: 2200 },
    { level: 8, xpRequired: 3000 },
    { level: 9, xpRequired: 4000 },
    { level: 10, xpRequired: 5500 },
  ];

  private state$ = new BehaviorSubject<GamificationState>(this.loadState());

  get currentState$(): Observable<GamificationState> {
    return this.state$.asObservable();
  }

  get currentState(): GamificationState {
    return this.state$.value;
  }

  constructor() {
    this.checkStreak();
  }

  addXP(amount: number): boolean {
    const state = { ...this.state$.value };
    const oldLevel = this.getLevelFromXP(state.xp);
    state.xp += amount;
    state.level = this.getLevelFromXP(state.xp);
    state.lastActivityDate = new Date().toISOString().split('T')[0];
    this.state$.next(state);
    this.saveState(state);

    return state.level > oldLevel;
  }

  incrementMessages(): void {
    const state = { ...this.state$.value };
    state.messagesCount += 1;
    this.state$.next(state);
    this.saveState(state);
  }

  incrementWords(): void {
    const state = { ...this.state$.value };
    state.wordsLearned += 1;
    this.state$.next(state);
    this.saveState(state);
  }

  getXPToNextLevel(): { current: number; required: number; percentage: number } {
    const state = this.state$.value;
    const currentThreshold = this.LEVEL_THRESHOLDS.find(t => t.level === state.level);
    const nextThreshold = this.LEVEL_THRESHOLDS.find(t => t.level === state.level + 1);

    if (!nextThreshold || !currentThreshold) {
      return { current: state.xp, required: state.xp, percentage: 100 };
    }

    const currentLevelXP = state.xp - currentThreshold.xpRequired;
    const requiredLevelXP = nextThreshold.xpRequired - currentThreshold.xpRequired;
    const percentage = Math.min(100, (currentLevelXP / requiredLevelXP) * 100);

    return { current: currentLevelXP, required: requiredLevelXP, percentage };
  }

  private checkStreak(): void {
    const state = { ...this.state$.value };
    const today = new Date().toISOString().split('T')[0];
    const lastActivity = state.lastActivityDate;

    if (!lastActivity) {
      state.streak = 0;
    } else if (lastActivity === today) {
      // Already active today, streak unchanged
    } else {
      const lastDate = new Date(lastActivity);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        state.streak += 1;
      } else if (diffDays > 1) {
        state.streak = 0;
      }
    }

    state.lastActivityDate = today;
    this.state$.next(state);
    this.saveState(state);
  }

  private getLevelFromXP(xp: number): number {
    let level = 1;
    for (const threshold of this.LEVEL_THRESHOLDS) {
      if (xp >= threshold.xpRequired) {
        level = threshold.level;
      }
    }
    return level;
  }

  private loadState(): GamificationState {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore parse errors
    }
    return {
      xp: 0,
      level: 1,
      streak: 0,
      lastActivityDate: '',
      messagesCount: 0,
      wordsLearned: 0
    };
  }

  private saveState(state: GamificationState): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage errors
    }
  }
}
