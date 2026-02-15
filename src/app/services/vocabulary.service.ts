// vocabulary.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { LearningStats, VocabLevel } from '../interfaces/vocabulary.interfaces';
import {
  VocabularyCard,
  ReviewSession,
  VocabCategory
} from '../interfaces/vocabulary.interfaces';
import { AutoVocabCard, ServiceContext } from '../shared/interfaces/vocabulary.interfaces';
import { VocabularyClaudeService } from './vocabulary-claude.service';
import { ChatMessage } from '../shared/interfaces/english-learning.interfaces';

@Injectable({
  providedIn: 'root'
})
export class VocabularyService {
  private readonly STORAGE_KEY = 'vocabulary_cards';
  private readonly _cards = new BehaviorSubject<VocabularyCard[]>([]);
  private readonly _suggestedCards = new BehaviorSubject<AutoVocabCard[]>([]);
  public readonly suggestedCards$ = this._suggestedCards.asObservable();


  constructor(private http: HttpClient, private vocabClaudeService: VocabularyClaudeService) {
    this.loadCardsFromStorage();
  }

  public get cards$(): Observable<VocabularyCard[]> {
    return this._cards.asObservable();
  }

  // vocabulary.service.ts
  private loadCardsFromStorage(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      const cards = JSON.parse(stored) as VocabularyCard[];
      cards.forEach(card => {
        // Convert to null if no date exists
        card.lastReviewed = card.lastReviewed ? new Date(card.lastReviewed) : null;
        card.nextReview = card.nextReview ? new Date(card.nextReview) : null;
        card.createdAt = new Date(card.createdAt);
        card.updatedAt = new Date(card.updatedAt);
      });
      this._cards.next(cards);
    }
  }

  // Debug method to check current state
  logCurrentSuggestions(): void {
    console.log('Current suggested cards:', this._suggestedCards.value);
  }

  // Helper method to manually set suggestions (useful for testing)
  setSuggestedCards(cards: AutoVocabCard[]): void {
    this._suggestedCards.next(cards);
  }

  async processConversation(messages: ChatMessage[], context: ServiceContext): Promise<void> {
    try {
      const vocabItems = await this.vocabClaudeService.analyzeConversation(messages, context);
      const filteredItems = this.filterExistingVocab(vocabItems);

      if (filteredItems.length > 0) {
        // Update the BehaviorSubject with new items
        console.log('New vocab items:', filteredItems);
        this._suggestedCards.next(filteredItems);
      }
    } catch (error) {
      console.error('Error processing conversation:', error);
    }
  }

  rejectSuggestion(cardToReject: AutoVocabCard): void {
    const currentCards = this._suggestedCards.value;
    console.log('Current cards before rejection:', currentCards);

    const updatedCards = currentCards.filter(card =>
      card.english !== cardToReject.english
    );

    console.log('Cards after rejection:', updatedCards);
    this._suggestedCards.next(updatedCards);
  }


  private filterExistingVocab(items: AutoVocabCard[]): AutoVocabCard[] {
    const currentCards = this._cards.value;
    return items.filter(item =>
      !currentCards.some(card =>
        card.english.toLowerCase() === item.english.toLowerCase()
      )
    );
  }

  async addSuggestedCard(card: AutoVocabCard): Promise<void> {
    try {
      const examples = card.examples.length > 0 ?
        card.examples :
        await this.vocabClaudeService.generateExamples(card.english);

      const level: VocabLevel = this.ensureValidLevel(card.suggestedLevel);

      const newCard = this.createCard({
        english: card.english,
        hebrew: card.hebrew,
        examples: examples,
        level: level,
        category: card.suggestedCategory,
        tags: this.generateTags(card.context)
      });

      this.saveCard(newCard);
      // After adding, remove from suggestions
      const currentCards = this._suggestedCards.value;
      const updatedCards = currentCards.filter(c => c.english !== card.english);
      this._suggestedCards.next(updatedCards);
    } catch (error) {
      console.error('Error adding suggested card:', error);
    }

  }

  private ensureValidLevel(level: number): VocabLevel {
    if (level >= 1 && level <= 4) {
      return level as VocabLevel;
    }
    return 1;
  }

  private createCard(data: Partial<VocabularyCard>): VocabularyCard {
    return {
      id: Date.now().toString(),
      english: data.english || '',
      hebrew: data.hebrew || '',
      pronunciation: data.pronunciation || '',
      examples: data.examples || [],
      tags: data.tags || [],
      level: data.level || 1 as VocabLevel,
      category: data.category || 'nouns',
      createdAt: new Date(),
      updatedAt: new Date(),
      correctCount: 0,
      incorrectCount: 0,
      lastReviewed: null,
      nextReview: null  // הוספנו את שדה nextReview כ-null
    };
  }


  private generateTags(context: string): string[] {
    return context
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3)
      .slice(0, 5);
  }

  private saveCard(card: VocabularyCard) {
    const currentCards = this._cards.value;
    const updatedCards = [...currentCards, card];
    this._cards.next(updatedCards);
    this.saveToStorage(updatedCards);
  }

  private saveToStorage(cards: VocabularyCard[]) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cards));
  }



  /*   private saveCards() {
      localStorage.setItem('vocabulary-cards', JSON.stringify(this.cards));
    }
  
    private loadCards() {
      const saved = localStorage.getItem('vocabulary-cards');
      if (saved) {
        this.cards = JSON.parse(saved);
        this.cardsSubject.next(this.cards);
      }
    } */

  private saveCardsToStorage(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._cards.value));
  }

  addCard(card: Omit<VocabularyCard, 'id' | 'createdAt' | 'updatedAt'>): void {
    const newCard: VocabularyCard = {
      ...card,
      id: crypto.randomUUID(),
      correctCount: 0,
      incorrectCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updated = [...this._cards.value, newCard];
    this._cards.next(updated);
    this.saveCardsToStorage();
  }

  updateCard(id: string, updates: Partial<VocabularyCard>): void {
    const updated = this._cards.value.map(card =>
      card.id === id
        ? { ...card, ...updates, updatedAt: new Date() }
        : card
    );
    this._cards.next(updated);
    this.saveCardsToStorage();
  }

  deleteCard(id: string): void {
    const updated = this._cards.value.filter(card => card.id !== id);
    this._cards.next(updated);
    this.saveCardsToStorage();
  }


  private calculateReviewPriority(card: VocabularyCard): number {
    const accuracy = card.correctCount / (card.correctCount + card.incorrectCount || 1);
    const daysSinceLastReview = card.lastReviewed
      ? (new Date().getTime() - card.lastReviewed.getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    return (1 - accuracy) * 100 + daysSinceLastReview;
  }

  recordReviewResult(cardId: string, correct: boolean): void {
    const card = this._cards.value.find(c => c.id === cardId);
    if (!card) return;

    const updates: Partial<VocabularyCard> = {
      lastReviewed: new Date(),
      nextReview: this.calculateNextReview(card, correct),
      correctCount: correct ? card.correctCount + 1 : card.correctCount,
      incorrectCount: correct ? card.incorrectCount : card.incorrectCount + 1
    };

    this.updateCard(cardId, updates);
  }

  private calculateNextReview(card: VocabularyCard, wasCorrect: boolean): Date {
    const now = new Date();
    const accuracy = (card.correctCount + (wasCorrect ? 1 : 0)) /
      (card.correctCount + card.incorrectCount + 1);

    // Spacing intervals in days based on accuracy
    let interval: number;
    if (accuracy >= 0.9) interval = 30;
    else if (accuracy >= 0.7) interval = 14;
    else if (accuracy >= 0.5) interval = 7;
    else interval = 3;

    // Adjust for card level
    interval *= Math.max(1, card.level * 0.5);

    return new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
  }

  // Statistics and Analytics
  getLearningStats(): LearningStats {
    const currentCards = this._cards.value;
    const masteredThreshold = 0.9; // 90% accuracy considered mastered

    // Fixed category breakdown with explicit types
    const categoryBreakdown = currentCards.reduce((acc: Record<VocabCategory, number>, card: VocabularyCard) => {
      acc[card.category] = (acc[card.category] || 0) + 1;
      return acc;
    }, {} as Record<VocabCategory, number>);

    // Fixed level breakdown with VocabLevel type
    const levelBreakdown = currentCards.reduce((acc: Record<VocabLevel, number>, card: VocabularyCard) => {
      acc[card.level] = (acc[card.level] || 0) + 1;
      return acc;
    }, {} as Record<VocabLevel, number>);

    const masteredCards = currentCards.filter((card: VocabularyCard) => {
      const total = card.correctCount + card.incorrectCount;
      return total > 0 && (card.correctCount / total >= masteredThreshold);
    }).length;

    const cardsToReview = this.getCardsForReview().length;

    // Stats calculation with explicit types
    const totalAttempts = currentCards.reduce((sum: number, card: VocabularyCard): number =>
      sum + card.correctCount + card.incorrectCount, 0);
    const totalCorrect = currentCards.reduce((sum: number, card: VocabularyCard): number =>
      sum + card.correctCount, 0);

    return {
      totalCards: currentCards.length,
      masteredCards,
      cardsToReview,
      averageAccuracy: totalAttempts ? (totalCorrect / totalAttempts) * 100 : 0,
      categoryBreakdown,
      levelBreakdown,
      dailyProgress: this.calculateDailyProgress()
    };
  }

  // Helper method to get suggested cards observable
  getSuggestedCards(): Observable<AutoVocabCard[]> {
    return this.suggestedCards$;
  }


  private calculateDailyProgress(): { date: Date; cardsReviewed: number; accuracy: number; }[] {
    // יצירת מערך של 7 הימים האחרונים
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      return date;
    }).reverse();

    return last7Days.map(date => {
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      // שימוש ב-_cards במקום cards
      const dayCards = this._cards.value.filter(card =>
        card.lastReviewed &&
        card.lastReviewed >= date &&
        card.lastReviewed < nextDate
      );

      // הוספת טיפוסים מפורשים לפרמטרים של reduce
      const totalReviews = dayCards.reduce((sum: number, card: VocabularyCard): number =>
        sum + card.correctCount + card.incorrectCount, 0);
      const correctReviews = dayCards.reduce((sum: number, card: VocabularyCard): number =>
        sum + card.correctCount, 0);

      return {
        date,
        cardsReviewed: dayCards.length,
        accuracy: totalReviews ? (correctReviews / totalReviews) * 100 : 0
      };
    });
  }

  // Utility Methods
  getCardsByCategory(category: VocabCategory): VocabularyCard[] {
    return this._cards.value.filter(card => card.category === category);
  }

  getCardsByLevel(level: VocabLevel): VocabularyCard[] {  // שימוש בטיפוס VocabLevel
    return this._cards.value.filter(card => card.level === level);
  }

  searchCards(query: string): VocabularyCard[] {
    const lowerQuery = query.toLowerCase();
    return this._cards.value.filter(card =>
      card.english.toLowerCase().includes(lowerQuery) ||
      card.hebrew.includes(lowerQuery) ||
      card.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  // בונוס: מתודות שימושיות נוספות
  getCardsForReview(): VocabularyCard[] {
    const now = new Date();
    return this._cards.value.filter(card =>
      card.nextReview !== null && card.nextReview <= now
    );
  }

  getCardStats(): { total: number; byLevel: Record<VocabLevel, number> } {
    const stats = {
      total: this._cards.value.length,
      byLevel: {
        1: 0,
        2: 0,
        3: 0,
        4: 0
      } as Record<VocabLevel, number>
    };

    this._cards.value.forEach(card => {
      stats.byLevel[card.level]++;
    });

    return stats;
  }
}