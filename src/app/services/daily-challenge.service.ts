import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DailyChallenge, DailyChallengeState, ChallengeType } from '../shared/interfaces/english-learning.interfaces';
import { ClaudeApiService } from './claude-api.service';
import { GamificationService } from './gamification.service';

interface ChallengeTemplate {
  type: ChallengeType;
  promptEn: string;
  promptHe: string;
  sentence: string;
  hint?: string;
}

@Injectable({ providedIn: 'root' })
export class DailyChallengeService {
  private readonly STORAGE_KEY = 'english_learning_daily_challenge';
  private state$ = new BehaviorSubject<DailyChallengeState | null>(null);
  readonly currentState$ = this.state$.asObservable();

  private readonly CHALLENGE_POOL: ChallengeTemplate[] = [
    // fix-grammar (8)
    { type: 'fix-grammar', promptEn: 'Fix the grammar error in this sentence:', promptHe: 'תקן את שגיאת הדקדוק במשפט:', sentence: 'She don\'t like coffee in the morning.' },
    { type: 'fix-grammar', promptEn: 'Fix the grammar error in this sentence:', promptHe: 'תקן את שגיאת הדקדוק במשפט:', sentence: 'I have went to the store yesterday.' },
    { type: 'fix-grammar', promptEn: 'Fix the grammar error in this sentence:', promptHe: 'תקן את שגיאת הדקדוק במשפט:', sentence: 'He is more taller than his brother.' },
    { type: 'fix-grammar', promptEn: 'Fix the grammar error in this sentence:', promptHe: 'תקן את שגיאת הדקדוק במשפט:', sentence: 'They was playing football when it started to rain.' },
    { type: 'fix-grammar', promptEn: 'Fix the grammar error in this sentence:', promptHe: 'תקן את שגיאת הדקדוק במשפט:', sentence: 'The informations are not correct.' },
    { type: 'fix-grammar', promptEn: 'Fix the grammar error in this sentence:', promptHe: 'תקן את שגיאת הדקדוק במשפט:', sentence: 'I am agree with your opinion.' },
    { type: 'fix-grammar', promptEn: 'Fix the grammar error in this sentence:', promptHe: 'תקן את שגיאת הדקדוק במשפט:', sentence: 'She suggested me to go home early.' },
    { type: 'fix-grammar', promptEn: 'Fix the grammar error in this sentence:', promptHe: 'תקן את שגיאת הדקדוק במשפט:', sentence: 'We have been living here since three years.' },

    // translate-he-en (6)
    { type: 'translate-he-en', promptEn: 'Translate this sentence to English:', promptHe: 'תרגם את המשפט לאנגלית:', sentence: 'אני אוהב ללמוד דברים חדשים כל יום.' },
    { type: 'translate-he-en', promptEn: 'Translate this sentence to English:', promptHe: 'תרגם את המשפט לאנגלית:', sentence: 'מזג האוויר היום יפה מאוד.' },
    { type: 'translate-he-en', promptEn: 'Translate this sentence to English:', promptHe: 'תרגם את המשפט לאנגלית:', sentence: 'היא עובדת כרופאה בבית חולים גדול.' },
    { type: 'translate-he-en', promptEn: 'Translate this sentence to English:', promptHe: 'תרגם את המשפט לאנגלית:', sentence: 'אנחנו הולכים למסעדה הערב.' },
    { type: 'translate-he-en', promptEn: 'Translate this sentence to English:', promptHe: 'תרגם את המשפט לאנגלית:', sentence: 'הספר הזה מעניין מאוד, אני ממליץ עליו.' },
    { type: 'translate-he-en', promptEn: 'Translate this sentence to English:', promptHe: 'תרגם את המשפט לאנגלית:', sentence: 'הילדים משחקים בגינה אחרי בית הספר.' },

    // translate-en-he (6)
    { type: 'translate-en-he', promptEn: 'Translate this sentence to Hebrew:', promptHe: 'תרגם את המשפט לעברית:', sentence: 'I usually wake up at seven in the morning.' },
    { type: 'translate-en-he', promptEn: 'Translate this sentence to Hebrew:', promptHe: 'תרגם את המשפט לעברית:', sentence: 'Can you help me find the nearest bus stop?' },
    { type: 'translate-en-he', promptEn: 'Translate this sentence to Hebrew:', promptHe: 'תרגם את המשפט לעברית:', sentence: 'My favorite hobby is reading books before bed.' },
    { type: 'translate-en-he', promptEn: 'Translate this sentence to Hebrew:', promptHe: 'תרגם את המשפט לעברית:', sentence: 'She has been studying English for two years.' },
    { type: 'translate-en-he', promptEn: 'Translate this sentence to Hebrew:', promptHe: 'תרגם את המשפט לעברית:', sentence: 'We need to buy groceries before the store closes.' },
    { type: 'translate-en-he', promptEn: 'Translate this sentence to Hebrew:', promptHe: 'תרגם את המשפט לעברית:', sentence: 'The meeting was cancelled because of the weather.' },

    // use-word (5)
    { type: 'use-word', promptEn: 'Write a sentence using this word:', promptHe: 'כתוב משפט עם המילה:', sentence: 'although', hint: 'Shows contrast between two ideas' },
    { type: 'use-word', promptEn: 'Write a sentence using this word:', promptHe: 'כתוב משפט עם המילה:', sentence: 'accomplish', hint: 'Means to successfully complete something' },
    { type: 'use-word', promptEn: 'Write a sentence using this word:', promptHe: 'כתוב משפט עם המילה:', sentence: 'furthermore', hint: 'Used to add more information' },
    { type: 'use-word', promptEn: 'Write a sentence using this word:', promptHe: 'כתוב משפט עם המילה:', sentence: 'opportunity', hint: 'A chance to do something good' },
    { type: 'use-word', promptEn: 'Write a sentence using this word:', promptHe: 'כתוב משפט עם המילה:', sentence: 'essential', hint: 'Absolutely necessary' },

    // fill-blank (5)
    { type: 'fill-blank', promptEn: 'Fill in the blank with the correct word:', promptHe: 'השלם את המילה החסרה:', sentence: 'If I ___ (know) about the party, I would have come.', hint: 'Past perfect tense' },
    { type: 'fill-blank', promptEn: 'Fill in the blank with the correct word:', promptHe: 'השלם את המילה החסרה:', sentence: 'She is looking forward ___ meeting you.', hint: 'Preposition needed' },
    { type: 'fill-blank', promptEn: 'Fill in the blank with the correct word:', promptHe: 'השלם את המילה החסרה:', sentence: 'By the time we arrived, the movie ___ already started.', hint: 'Auxiliary verb needed' },
    { type: 'fill-blank', promptEn: 'Fill in the blank with the correct word:', promptHe: 'השלם את המילה החסרה:', sentence: 'He ___ to the gym every day last year.', hint: 'Simple past of "go"' },
    { type: 'fill-blank', promptEn: 'Fill in the blank with the correct word:', promptHe: 'השלם את המילה החסרה:', sentence: 'I wish I ___ speak more languages.', hint: 'Subjunctive mood' },
  ];

  constructor(
    private claudeApi: ClaudeApiService,
    private gamificationService: GamificationService
  ) {
    this.initialize();
  }

  private initialize(): void {
    const stored = this.loadState();
    if (stored) {
      this.state$.next(stored);
    } else {
      const challenge = this.getTodayChallenge();
      const newState: DailyChallengeState = {
        date: this.getTodayString(),
        challenge,
        completed: false
      };
      this.state$.next(newState);
      this.saveState(newState);
    }
  }

  private getTodayChallenge(): DailyChallenge {
    const today = this.getTodayString();
    const hash = this.simpleHash(today);
    const index = hash % this.CHALLENGE_POOL.length;
    const template = this.CHALLENGE_POOL[index];
    return { ...template, id: today };
  }

  private getTodayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  async submitAnswer(answer: string): Promise<{ correct: boolean; feedbackEn: string; feedbackHe: string }> {
    const state = this.state$.value;
    if (!state || state.completed) {
      return { correct: false, feedbackEn: '', feedbackHe: '' };
    }

    try {
      const systemPrompt = this.buildCheckPrompt(state.challenge, answer);
      const response = await this.claudeApi.createMessage({
        system: systemPrompt,
        messages: [{ role: 'user', content: answer }],
        max_tokens: 256,
        temperature: 0.3
      });

      const text = response.content[0]?.text || '';
      const result = this.parseCheckResponse(text);

      const newState: DailyChallengeState = {
        ...state,
        completed: true,
        userAnswer: answer,
        isCorrect: result.correct,
        feedbackEn: result.feedbackEn,
        feedbackHe: result.feedbackHe
      };
      this.state$.next(newState);
      this.saveState(newState);

      if (result.correct) {
        this.gamificationService.addXP(25);
      }

      return result;
    } catch (error) {
      console.error('Error checking daily challenge:', error);
      return { correct: false, feedbackEn: 'Error checking answer. Please try again.', feedbackHe: 'שגיאה בבדיקת התשובה. נסה שוב.' };
    }
  }

  private buildCheckPrompt(challenge: DailyChallenge, answer: string): string {
    const typeInstructions: Record<ChallengeType, string> = {
      'fix-grammar': `The user was asked to fix the grammar error in: "${challenge.sentence}"\nCheck if their correction is grammatically correct and fixes the intended error.`,
      'translate-he-en': `The user was asked to translate this Hebrew sentence to English: "${challenge.sentence}"\nCheck if the translation is accurate and grammatically correct. Accept reasonable variations.`,
      'translate-en-he': `The user was asked to translate this English sentence to Hebrew: "${challenge.sentence}"\nCheck if the Hebrew translation is accurate. Accept reasonable variations.`,
      'use-word': `The user was asked to write a sentence using the word "${challenge.sentence}".\nCheck if the sentence uses the word correctly and is grammatically correct.`,
      'fill-blank': `The user was asked to fill in the blank: "${challenge.sentence}"\nCheck if the answer correctly completes the sentence.`
    };

    return `You are checking an English learning exercise answer.
${typeInstructions[challenge.type]}

The user's answer: "${answer}"

Respond in EXACTLY this JSON format (nothing else):
{"correct": true/false, "feedbackEn": "short feedback in English", "feedbackHe": "short feedback in Hebrew"}

Be encouraging. If correct, praise briefly. If wrong, explain the correct answer.`;
  }

  private parseCheckResponse(text: string): { correct: boolean; feedbackEn: string; feedbackHe: string } {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          correct: !!parsed.correct,
          feedbackEn: parsed.feedbackEn || parsed.feedback || '',
          feedbackHe: parsed.feedbackHe || ''
        };
      }
    } catch (e) {
      console.error('Error parsing challenge response:', e);
    }
    return { correct: false, feedbackEn: 'Could not check your answer.', feedbackHe: 'לא ניתן לבדוק את התשובה.' };
  }

  private loadState(): DailyChallengeState | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const state: DailyChallengeState = JSON.parse(stored);
        if (state.date === this.getTodayString()) {
          return state;
        }
      }
    } catch (e) {
      console.error('Error loading daily challenge state:', e);
    }
    return null;
  }

  private saveState(state: DailyChallengeState): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Error saving daily challenge state:', e);
    }
  }
}
