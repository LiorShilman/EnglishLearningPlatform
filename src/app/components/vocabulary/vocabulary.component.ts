// vocabulary.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { VocabularyService } from '../../services/vocabulary.service';
import { take } from 'rxjs/operators';
import { 
  VocabularyCard, 
  VocabCategory,
  LearningStats,
  Example 
} from '../../interfaces/vocabulary.interfaces';
import { CommonModule } from '@angular/common';
import { AutoVocabCard } from '../../shared/interfaces/vocabulary.interfaces';
import { MatSelectModule } from '@angular/material/select'; // ייבוא רכיבי בחירה של Angular Material
import { MatFormFieldModule } from '@angular/material/form-field'; // ייבוא רכיב שדה טופס

type ViewType = 'cards' | 'review' | 'stats' | 'add';

// הגדר טיפוס ספציפי למספרי הרמות
type LevelNumber = 1 | 2 | 3 | 4;

@Component({
  selector: 'app-vocabulary',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatSelectModule, // הוספה למודול
    MatFormFieldModule // הוספה למודול
  ],
  templateUrl: './vocabulary.component.html',
  styleUrls: ['./vocabulary.component.scss']
})
export class VocabularyComponent implements OnInit, OnDestroy {

  readonly levels: LevelNumber[] = [1, 2, 3, 4];

  activeView: ViewType = 'cards';
  readonly viewTypes: ViewType[] = ['cards', 'review', 'stats', 'add'];
  // Form Management
  cardForm: FormGroup;
  editingCardId: string | null = null;
  
  suggestedCards: AutoVocabCard[] = [];
  autoProcessEnabled = true;
  private destroy$ = new Subject<void>();
  
  
  // Review Management
  reviewCards: VocabularyCard[] = [];
  currentReviewIndex = 0;
  showAnswer = false;
  reviewInProgress = false;
  reviewResults: { correct: number; incorrect: number } = { correct: 0, incorrect: 0 };
  
  // Stats Management
  stats!: LearningStats;
  lastReviewDate: Date | null = null;
  
  // Search and Filters
  searchQuery = '';
  filterCategory: VocabCategory | null = null;
  filterLevel: number | null = null;
  sortBy: 'date' | 'level' | 'category' = 'date';
  sortDirection: 'asc' | 'desc' = 'desc';

  // התחברות לכרטיסיות המוצעות
  private _showSuggestions = new BehaviorSubject<boolean>(false);
  showSuggestions$ = this._showSuggestions.asObservable();
  
  private _suggestedCards = new BehaviorSubject<AutoVocabCard[]>([]);
  suggestedCards$ = this._suggestedCards.asObservable();


  // Constants
  readonly categories: VocabCategory[] = [
    'nouns', 'verbs', 'adjectives', 'adverbs', 
    'phrases', 'idioms', 'academic', 'business', 'daily_life'
  ];


  constructor(
    private vocabService: VocabularyService,
    private fb: FormBuilder
  ) {
    this.cardForm = this.fb.group({
      english: ['', [Validators.required, Validators.minLength(1)]],
      hebrew: ['', [Validators.required, Validators.minLength(1)]],
      pronunciation: [''],
      examples: this.fb.array([]),
      tags: [''],
      level: [1, [Validators.required, Validators.min(1), Validators.max(4)]],
      category: ['', Validators.required]
    });
    
    this._showSuggestions = new BehaviorSubject<boolean>(true);
    this.showSuggestions$ = this._showSuggestions.asObservable();
    this.suggestedCards$ = this.vocabService.suggestedCards$;
    
    this.initializeForm();
    this.initializeSuggestions();

  }

  async processSuggestedCards() {
    for (const card of this.suggestedCards) {
      if (card.confidence > 0.8) {
        await this.vocabService.addSuggestedCard(card);
      }
    }
  }

  async addSuggestedCard(card: AutoVocabCard): Promise<void> {
    try {
      await this.vocabService.addSuggestedCard(card);
      this.vocabService.rejectSuggestion(card); // Remove from suggestions after adding
      
      // Check if there are any cards left
      this.suggestedCards$.pipe(take(1)).subscribe(cards => {
        if (!cards || cards.length === 0) {
          this._showSuggestions.next(false);
        }
      });
    } catch (error) {
      console.error('Error adding suggested card:', error);
    }
  }

  // דחיית כרטיסייה מוצעת
  rejectSuggestion(card: AutoVocabCard) {
    console.log('Rejecting card:', card);
    this.vocabService.rejectSuggestion(card);
    
    // Check if there are any cards left
    this.suggestedCards$.pipe(take(1)).subscribe(cards => {
      if (!cards || cards.length === 0) {
        this._showSuggestions.next(false);
      }
    });
  }

  // סגירת חלון ההצעות
  closeSuggestions() {
    this._showSuggestions.next(false);
  }

  // פתיחת חלון ההצעות
  openSuggestions() {
    this._showSuggestions.next(true);
  }

  toggleAutoProcess() {
    this.autoProcessEnabled = !this.autoProcessEnabled;
  }

  private initializeSuggestions() {
    // הסרת ההמרה למערך רגיל
    this.vocabService.getSuggestedCards()
      .pipe(takeUntil(this.destroy$))
      .subscribe(cards => {
        if (this.autoProcessEnabled) {
          this.processSuggestedCards();
        }
      });
  }

  ngOnInit(): void {
    this.loadStats();
    this.subscribeToCategoryChanges();
    this.loadLastReviewDate();

    // האזנה לכרטיסיות מוצעות חדשות
    this.suggestedCards$
    .pipe(takeUntil(this.destroy$))
    .subscribe(cards => {
      console.log('Updated suggested cards:', cards);
      if (cards?.length > 0) {
        this._showSuggestions.next(true);
      }
    });
      this.vocabService.logCurrentSuggestions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Form Management
  private initializeForm(): void {
    this.cardForm = this.fb.group({
      english: ['', [Validators.required, Validators.minLength(1)]],
      hebrew: ['', [Validators.required, Validators.minLength(1)]],
      pronunciation: [''],
      examples: this.fb.array([]),
      tags: [''],
      level: [1, [Validators.required, Validators.min(1), Validators.max(4)]],
      category: ['', Validators.required]
    });
  }

  private subscribeToCategoryChanges(): void {
    this.cardForm.get('category')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateFormValidation();
      });
  }

  // בקומפוננטה
get examplesArray() {
  return this.cardForm.get('examples') as FormArray;
}

  private updateFormValidation(): void {
    const category = this.cardForm.get('category')?.value;
    const examplesRequired = ['idioms', 'phrases'].includes(category);
    
    const examplesArray = this.cardForm.get('examples') as FormArray;
    if (examplesRequired && examplesArray.length === 0) {
      this.addExample();
    }
  }

  addExample(): void {
    const examples = this.cardForm.get('examples') as FormArray;
    const newExample = this.fb.group({
      english: ['', Validators.required],
      hebrew: ['', Validators.required],
      context: ['']
    });
    examples.push(newExample);
  }

  removeExample(index: number): void {
    const examples = this.cardForm.get('examples') as FormArray;
    examples.removeAt(index);
  }

  getExamplesFormArray(): FormArray {
    return this.cardForm.get('examples') as FormArray;
  }

  // Card Management
  submitCard(): void {
    if (this.cardForm.valid) {
      const formValue = this.cardForm.value;
      const tags = formValue.tags.split(',')
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.length > 0);

      const cardData = {
        ...formValue,
        tags,
        examples: this.processExamples(formValue.examples)
      };

      if (this.editingCardId) {
        this.vocabService.updateCard(this.editingCardId, cardData);
      } else {
        this.vocabService.addCard(cardData);
      }

      this.resetForm();
      this.loadStats();
      this.switchView('cards');
    }
  }

  private processExamples(examples: any[]): Example[] {
    return examples
      .filter(ex => ex.english.trim() && ex.hebrew.trim())
      .map(ex => ({
        english: ex.english.trim(),
        hebrew: ex.hebrew.trim(),
        context: ex.context?.trim() || undefined
      }));
  }

  editCard(card: VocabularyCard): void {
    this.editingCardId = card.id;
    this.cardForm.patchValue({
      ...card,
      tags: card.tags.join(', ')
    });

    // Reset examples form array
    const examplesArray = this.cardForm.get('examples') as FormArray;
    while (examplesArray.length) {
      examplesArray.removeAt(0);
    }

    // Add existing examples
    card.examples.forEach(example => {
      examplesArray.push(this.fb.group({
        english: [example.english, Validators.required],
        hebrew: [example.hebrew, Validators.required],
        context: [example.context || '']
      }));
    });

    this.switchView('add');
  }

  deleteCard(id: string): void {
    if (confirm('Are you sure you want to delete this card?')) {
      this.vocabService.deleteCard(id);
      this.loadStats();
    }
  }

  private resetForm(): void {
    this.cardForm.reset({ level: 1 });
    const examplesArray = this.cardForm.get('examples') as FormArray;
    while (examplesArray.length) {
      examplesArray.removeAt(0);
    }
    this.editingCardId = null;
  }

  // Review System
  startReviewSession(): void {
    this.reviewCards = this.vocabService.getCardsForReview();
    this.currentReviewIndex = 0;
    this.showAnswer = false;
    this.reviewInProgress = true;
    this.reviewResults = { correct: 0, incorrect: 0 };
    this.lastReviewDate = new Date();
    localStorage.setItem('lastReviewDate', this.lastReviewDate.toISOString());
  }

  reviewAnswer(correct: boolean): void {
    if (!this.reviewInProgress) return;

    const currentCard = this.reviewCards[this.currentReviewIndex];
    this.vocabService.recordReviewResult(currentCard.id, correct);

    // Update results
    if (correct) {
      this.reviewResults.correct++;
    } else {
      this.reviewResults.incorrect++;
    }

    if (this.currentReviewIndex < this.reviewCards.length - 1) {
      this.currentReviewIndex++;
      this.showAnswer = false;
    } else {
      this.completeReview();
    }
  }

  toggleAnswer(): void {
    this.showAnswer = !this.showAnswer;
  }

  private completeReview(): void {
    this.reviewInProgress = false;
    this.loadStats();
    // Show review summary before switching view
    this.showReviewSummary();
  }

  private showReviewSummary(): void {
    const accuracy = Math.round(
      (this.reviewResults.correct / this.reviewCards.length) * 100
    );
    
    alert(`Review Complete!\n\n` +
          `Cards Reviewed: ${this.reviewCards.length}\n` +
          `Correct: ${this.reviewResults.correct}\n` +
          `Incorrect: ${this.reviewResults.incorrect}\n` +
          `Accuracy: ${accuracy}%`);
    
    this.switchView('stats');
  }

  // Stats Management
  private loadStats(): void {
    this.stats = this.vocabService.getLearningStats();
  }

  private loadLastReviewDate(): void {
    const lastReview = localStorage.getItem('lastReviewDate');
    this.lastReviewDate = lastReview ? new Date(lastReview) : null;
  }

  getTimeUntilNextReview(): string {
    if (!this.lastReviewDate) return 'Ready for review!';
    
    const hour = 60 * 60 * 1000;
    const timeSinceReview = Date.now() - this.lastReviewDate.getTime();
    
    if (timeSinceReview < 4 * hour) {
      const hoursLeft = Math.ceil((4 * hour - timeSinceReview) / hour);
      return `Next review in ${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}`;
    }
    
    return 'Ready for review!';
  }

  // View Management
  switchView(view: ViewType): void {
    this.activeView = view;
    if (this.reviewInProgress && view !== 'review') {
      if (!confirm('Are you sure you want to leave the review session?')) {
        return;
      }
      this.reviewInProgress = false;
    }
    
    this.activeView = view;
    if (view === 'review') {
      this.startReviewSession();
    } else if (view === 'stats') {
      this.loadStats();
    }
  }

  // Search and Filtering
  applyFilters(): VocabularyCard[] {
    let cards = this.vocabService.searchCards(this.searchQuery);
    
    if (this.filterCategory) {
      cards = cards.filter(card => card.category === this.filterCategory);
    }
    
    if (this.filterLevel !== null) {
      // Ensure both values are numbers for comparison
      const filterLevel = Number(this.filterLevel);
      cards = cards.filter(card => card.level === filterLevel);
    }
    
    // Apply sorting
    cards = this.sortCards(cards);
    
    // Debug logging
    //console.log('Filter level:', this.filterLevel);
    //console.log('Filtered cards:', cards);
    
    return cards;
  }

  private sortCards(cards: VocabularyCard[]): VocabularyCard[] {
    return cards.sort((a, b) => {
      let comparison = 0;
      
      switch (this.sortBy) {
        case 'date':
          comparison = b.createdAt.getTime() - a.createdAt.getTime();
          break;
        case 'level':
          comparison = a.level - b.level;
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }
      
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  toggleSort(criterion: 'date' | 'level' | 'category'): void {
    if (this.sortBy === criterion) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = criterion;
      this.sortDirection = 'asc';
    }
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.filterCategory = null;
    this.filterLevel = null;
    this.sortBy = 'date';
    this.sortDirection = 'desc';
  }

  // Utility Methods
  trackByCardId(index: number, card: VocabularyCard): string {
    return card.id;
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  getCardProgress(card: VocabularyCard): number {
    const total = card.correctCount + card.incorrectCount;
    if (total === 0) return 0;
    return Math.round((card.correctCount / total) * 100);
  }
}