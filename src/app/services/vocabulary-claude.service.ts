import { Injectable } from '@angular/core';
import { ClaudeApiService } from './claude-api.service';
import { Example, RawVocabItem, VocabCategory } from '../interfaces/vocabulary.interfaces';
import { AutoVocabCard, ServiceContext } from '../shared/interfaces/vocabulary.interfaces';
import { ChatMessage } from '../shared/interfaces/english-learning.interfaces';

@Injectable({
  providedIn: 'root'
})
export class VocabularyClaudeService {
  constructor(private claudeApi: ClaudeApiService) {}

  async analyzeConversation(messages: ChatMessage[], context: ServiceContext): Promise<AutoVocabCard[]> {
    try {
      const conversationText = messages
        .map(msg => `${msg.sender}: ${msg.english}`)
        .join('\n');

      const response = await this.claudeApi.createMessage({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        temperature: 0.3,
        system: `You are a vocabulary extraction tool. Return ONLY valid JSON, no markdown, no explanation.`,
        messages: [{
          role: 'user',
          content: `Analyze this English learning conversation and extract useful vocabulary.

CONVERSATION:
${conversationText}

User vocabulary level: ${context.userLevel.vocabulary} (1=beginner, 4=advanced)

Return a JSON object with this exact structure:
{
  "vocabulary": [
    {
      "english": "word or phrase",
      "hebrew": "translation in Hebrew",
      "context": "how it was used in the conversation",
      "examples": [
        { "english": "Example sentence", "hebrew": "Hebrew translation" }
      ],
      "suggestedLevel": 2,
      "suggestedCategory": "nouns",
      "confidence": 0.85
    }
  ]
}

Rules:
- suggestedCategory must be one of: nouns, verbs, adjectives, phrases, idioms
- suggestedLevel: 1-4
- confidence: 0-1 (how useful the word is for this learner)
- Each item MUST have at least one example
- Return ONLY the JSON object, nothing else`
        }]
      });

      const content = response.content?.[0]?.text || '';
      return this.parseVocabularyResponse(content);
    } catch (error) {
      console.error('Error analyzing conversation:', error);
      return [];
    }
  }

  private parseVocabularyResponse(content: string): AutoVocabCard[] {
    try {
      // Clean markdown wrappers if present
      let cleaned = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      // Try to extract JSON from content
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) {
        console.warn('No JSON found in vocabulary response');
        return [];
      }
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

      const jsonData = JSON.parse(cleaned);
      const vocabItems = jsonData.vocabulary;
      if (!Array.isArray(vocabItems)) {
        console.warn('Vocabulary is not an array:', vocabItems);
        return [];
      }

      return vocabItems
        .map((item: RawVocabItem) => ({
          english: String(item.english || ''),
          hebrew: String(item.hebrew || ''),
          context: String(item.context || ''),
          examples: Array.isArray(item.examples)
            ? item.examples.map(ex => ({
                english: String(ex.english || ''),
                hebrew: String(ex.hebrew || '')
              }))
            : [],
          suggestedLevel: Math.min(Math.max(1, Number(item.suggestedLevel) || 1), 4),
          suggestedCategory: this.validateCategory(item.suggestedCategory || ''),
          confidence: Math.min(Math.max(0, Number(item.confidence) || 0), 1)
        }) as AutoVocabCard)
        .filter(item => item.english && item.hebrew);
    } catch (error) {
      console.error('Error parsing vocabulary response:', error);
      return [];
    }
  }

  async generateExamples(english: string): Promise<Example[]> {
    try {
      const response = await this.claudeApi.createMessage({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 512,
        temperature: 0.5,
        system: 'Return only JSON array of examples.',
        messages: [{
          role: 'user',
          content: `Generate 2-3 example sentences for the word/phrase "${english}". Return JSON:
[{ "english": "sentence", "hebrew": "translation", "context": "" }]`
        }]
      });

      const content = response.content?.[0]?.text || '';
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Error generating examples:', error);
      return [];
    }
  }

  private validateCategory(category: string): VocabCategory {
    const validCategories: VocabCategory[] = ['nouns', 'verbs', 'adjectives', 'phrases', 'idioms'];
    const normalized = String(category || '').toLowerCase() as VocabCategory;
    return validCategories.includes(normalized) ? normalized : 'nouns';
  }
}
