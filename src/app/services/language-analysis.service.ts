// src/app/services/language-analysis.service.ts
import { Injectable } from '@angular/core';

// קודם כל נגדיר את הממשקים שישמשו אותנו
interface GrammarError {
    pattern: RegExp;
    correction: string;
    example: string;
}

interface VocabularyError {
    pattern: RegExp;
    suggestion: string;
    examples: Record<string, string>;
}

interface GrammarIssue {
    type: 'grammar';
    correction: string;
    example: string;
}

interface VocabularySuggestion {
    type: 'vocabulary';
    suggestion: string;
    examples: Record<string, string>;
}

interface LanguageFeedback {
    grammarFeedback?: string;
    vocabularyFeedback?: string;
    pronunciationTips?: string;
    improvement?: string;
    translatedResponse?: string;
}

// כעת נייצא את השירות שלנו
@Injectable({
    providedIn: 'root'
})
export class LanguageAnalysisService {
    // הגדרת השגיאות הנפוצות שנרצה לזהות
    private commonErrors: {
        grammar: GrammarError[];
        vocabulary: VocabularyError[];
    } = {
            grammar: [
                {
                    pattern: /\bi am.+ing\b/i,
                    correction: "When using 'I am', we usually don't use continuous tense for state verbs",
                    example: "'I am knowing' → 'I know'"
                },
                {
                    pattern: /\bi am like\b/i,
                    correction: "Instead of 'I am like', consider using 'I like'",
                    example: "'I am like pizza' → 'I like pizza'"
                }
            ],
            vocabulary: [
                {
                    pattern: /\bvery (\w+)\b/i,
                    suggestion: "Consider using a stronger single word instead of 'very'",
                    examples: {
                        'very good': 'excellent',
                        'very big': 'huge',
                        'very small': 'tiny'
                    }
                }
            ]
        };

    // הפונקציה הראשית לניתוח תגובת המשתמש
    analyzeResponse(text: string): LanguageFeedback {
        const feedback: LanguageFeedback = {};

        const grammarIssues = this.checkGrammar(text);
        if (grammarIssues.length > 0) {
            feedback.grammarFeedback = this.formatGrammarFeedback(grammarIssues);
        }

        const vocabularySuggestions = this.checkVocabulary(text);
        if (vocabularySuggestions.length > 0) {
            feedback.vocabularyFeedback = this.formatVocabularySuggestions(vocabularySuggestions);
        }

        feedback.improvement = this.generateImprovementTips(text);

        return feedback;
    }

    // בדיקת שגיאות דקדוק
    private checkGrammar(text: string): GrammarIssue[] {
        const issues: GrammarIssue[] = [];

        this.commonErrors.grammar.forEach(error => {
            if (error.pattern.test(text)) {
                issues.push({
                    type: 'grammar',
                    correction: error.correction,
                    example: error.example
                });
            }
        });

        return issues;
    }

    // בדיקת אוצר מילים והצעות לשיפור
    private checkVocabulary(text: string): VocabularySuggestion[] {
        const suggestions: VocabularySuggestion[] = [];

        this.commonErrors.vocabulary.forEach(vocab => {
            const matches = text.match(vocab.pattern);
            if (matches) {
                suggestions.push({
                    type: 'vocabulary',
                    suggestion: vocab.suggestion,
                    examples: vocab.examples
                });
            }
        });

        return suggestions;
    }

    // עיצוב המשוב על שגיאות דקדוק
    private formatGrammarFeedback(issues: GrammarIssue[]): string {
        return issues.map(issue =>
            `Grammar tip: ${issue.correction}. For example: ${issue.example}`
        ).join('\n');
    }

    // עיצוב המשוב על אוצר מילים
    private formatVocabularySuggestions(suggestions: VocabularySuggestion[]): string {
        return suggestions.map(suggestion =>
            `Vocabulary tip: ${suggestion.suggestion}`
        ).join('\n');
    }

    // יצירת טיפים לשיפור כללי
    private generateImprovementTips(text: string): string {
        const sentences = text.split(/[.!?]+/).filter(Boolean);
        const avgLength = sentences.reduce((sum, sent) => sum + sent.length, 0) / sentences.length;

        let tips = [];

        if (avgLength < 10) {
            tips.push("Try to expand your sentences with more details.");
        } else if (avgLength > 30) {
            tips.push("Consider breaking longer sentences into smaller ones for clarity.");
        }

        if (text.split(' ').length < 5) {
            tips.push("Try to provide more information in your responses.");
        }

        return tips.join('\n');
    }
}