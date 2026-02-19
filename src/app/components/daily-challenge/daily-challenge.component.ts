import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { DailyChallenge, DailyChallengeState } from '../../shared/interfaces/english-learning.interfaces';
import { DailyChallengeService } from '../../services/daily-challenge.service';

@Component({
  selector: 'app-daily-challenge',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './daily-challenge.component.html',
  styleUrls: ['./daily-challenge.component.scss']
})
export class DailyChallengeComponent implements OnInit, OnDestroy {
  @Output() challengeCompleted = new EventEmitter<boolean>();

  state: DailyChallengeState | null = null;
  userAnswer = '';
  isSubmitting = false;
  isExpanded = true;

  private destroy$ = new Subject<void>();

  constructor(private challengeService: DailyChallengeService) {}

  ngOnInit(): void {
    this.challengeService.currentState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.state = state;
      });
  }

  getTypeLabel(): { en: string; he: string } {
    if (!this.state?.challenge) return { en: '', he: '' };
    const labels: Record<string, { en: string; he: string }> = {
      'fix-grammar': { en: 'Fix the Error', he: 'תקן את השגיאה' },
      'translate-he-en': { en: 'Translate to English', he: 'תרגם לאנגלית' },
      'translate-en-he': { en: 'Translate to Hebrew', he: 'תרגם לעברית' },
      'use-word': { en: 'Use the Word', he: 'השתמש במילה' },
      'fill-blank': { en: 'Fill the Blank', he: 'השלם את החסר' },
    };
    return labels[this.state.challenge.type] || { en: '', he: '' };
  }

  async submitAnswer(): Promise<void> {
    if (!this.userAnswer.trim() || this.isSubmitting) return;

    this.isSubmitting = true;
    const result = await this.challengeService.submitAnswer(this.userAnswer.trim());
    this.isSubmitting = false;
    this.challengeCompleted.emit(result.correct);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
