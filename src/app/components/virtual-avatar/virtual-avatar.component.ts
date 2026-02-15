import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, Subject, Subscription, interval, takeUntil } from 'rxjs';

export type AvatarMood = 'normal' | 'happy' | 'thinking' | 'concerned';
export type AvatarState = { speaking: boolean; thinking: boolean };

@Component({
  selector: 'app-virtual-avatar',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './virtual-avatar.component.html',
  styleUrls: ['./virtual-avatar.component.scss']
})
export class VirtualAvatarComponent implements OnInit, OnDestroy {
  // Input properties with defaults
  @Input() set isSpeaking(value: boolean) {
    this._isSpeaking = value;
    this.updateAvatarState();
  }
  get isSpeaking(): boolean {
    return this._isSpeaking;
  }

  @Input() set isThinking(value: boolean) {
    this._isThinking = value;
    this.updateAvatarState();
  }
  get isThinking(): boolean {
    return this._isThinking;
  }

  @Input() set currentMood(value: AvatarMood) {
    this._currentMood = value;
    this.moodChanged.emit(value);
  }
  get currentMood(): AvatarMood {
    return this._currentMood;
  }

  // Output events
  @Output() moodChanged = new EventEmitter<AvatarMood>();
  @Output() stateChanged = new EventEmitter<AvatarState>();

  // Private state subjects
  private readonly stateSubject = new BehaviorSubject<AvatarState>({ speaking: false, thinking: false });
  private readonly moodSubject = new BehaviorSubject<AvatarMood>('normal');

  // Private fields
  private _isSpeaking = false;
  private _isThinking = false;
  private _currentMood: AvatarMood = 'normal';
  private destroy$ = new Subject<void>();
  private blinkInterval?: Subscription;
  private activeTimer: ReturnType<typeof setTimeout> | undefined;
  private isBlinking = false;
  private lastInteraction = Date.now();
  private readonly IDLE_TIMEOUT = 10000; // 10 seconds
  private readonly BLINK_INTERVAL = 4000; // 4 seconds
  private readonly BLINK_DURATION = 200; // 0.2 seconds

  ngOnInit() {
    this.initializeBlinking();
    this.initializeIdleCheck();
    this.subscribeToStateChanges();
  }

  ngOnDestroy() {
    this.cleanup();
  }

  // Public methods
  async speak(text: string, duration: number = 2000): Promise<void> {
    this.clearActiveTimer();
    this.updateState(true, false);

    return new Promise((resolve) => {
      this.activeTimer = setTimeout(() => {
        this.updateState(false, false);
        resolve();
      }, duration);
    });
  }

  async think(duration: number = 2000): Promise<void> {
    this.clearActiveTimer();
    this.updateState(false, true);

    return new Promise((resolve) => {
      this.activeTimer = setTimeout(() => {
        this.updateState(false, false);
        resolve();
      }, duration);
    });
  }

  setMood(mood: AvatarMood): void {
    this.currentMood = mood;
    this.lastInteraction = Date.now();
    this.moodSubject.next(mood);
  }

  onUserInteraction(): void {
    this.lastInteraction = Date.now();
    if (this.currentMood === 'concerned') {
      setTimeout(() => this.setMood('normal'), 1000);
    }
  }

  // Private methods
  private initializeBlinking(): void {
    interval(this.BLINK_INTERVAL)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.isBlinking = true;
        setTimeout(() => {
          this.isBlinking = false;
        }, this.BLINK_DURATION);
      });
  }

  private initializeIdleCheck(): void {
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (Date.now() - this.lastInteraction > this.IDLE_TIMEOUT) {
          this.handleIdle();
        }
      });
  }

  private subscribeToStateChanges(): void {
    this.stateSubject
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.stateChanged.emit(state);
      });
  }

  private updateState(speaking: boolean, thinking: boolean): void {
    this._isSpeaking = speaking;
    this._isThinking = thinking;
    this.stateSubject.next({ speaking, thinking });
    this.lastInteraction = Date.now();
  }

  private updateAvatarState(): void {
    this.stateSubject.next({
      speaking: this._isSpeaking,
      thinking: this._isThinking
    });
  }

  private handleIdle(): void {
    const random = Math.random();
    if (random < 0.3) {
      void this.think(1000);
    } else if (random < 0.6) {
      this.setMood('thinking');
      setTimeout(() => this.setMood('normal'), 1500);
    }
  }

  private clearActiveTimer(): void {
    if (this.activeTimer !== undefined) {
      window.clearTimeout(this.activeTimer);
      this.activeTimer = undefined;
    }
  }

  private cleanup(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearActiveTimer();
    this.blinkInterval?.unsubscribe();
  }
}