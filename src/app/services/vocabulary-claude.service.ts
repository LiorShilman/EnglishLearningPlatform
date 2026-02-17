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
        max_tokens: 4096,
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
- Return at most 5 vocabulary items (the most useful ones)
- suggestedCategory must be one of: nouns, verbs, adjectives, phrases, idioms
- suggestedLevel: 1-4
- confidence: 0-1 (how useful the word is for this learner)
- Each item MUST have exactly 1 example (not more)
- Return ONLY the JSON object, no markdown, no explanation`
        }]
      });

      const content = response.content?.[0]?.text || '';
      console.log('[DEBUG] VocabClaude: raw response length:', content.length);
      console.log('[DEBUG] VocabClaude: raw response (first 300):', content.substring(0, 300));
      const result = this.parseVocabularyResponse(content);
      console.log('[DEBUG] VocabClaude: parsed', result.length, 'vocab items');
      return result;
    } catch (error) {
      console.error('[DEBUG] VocabClaude: Error analyzing conversation:', error);
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

      console.log('[DEBUG] VocabParse: after markdown clean, length:', cleaned.length);

      // Try to extract JSON from content
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) {
        console.warn('[DEBUG] VocabParse: No JSON braces found');
        return [];
      }
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      console.log('[DEBUG] VocabParse: JSON substring length:', cleaned.length);

      let jsonData;
      try {
        jsonData = JSON.parse(cleaned);
      } catch (parseErr) {
        // Try to fix truncated JSON by closing open brackets/braces
        console.warn('[DEBUG] VocabParse: JSON parse failed, attempting repair');
        let repaired = cleaned;
        // Remove last incomplete object/element
        repaired = repaired.replace(/,\s*\{[^}]*$/, '');
        repaired = repaired.replace(/,\s*"[^"]*$/, '');
        // Count and close open brackets
        const openBraces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;
        for (let i = 0; i < openBrackets; i++) repaired += ']';
        for (let i = 0; i < openBraces; i++) repaired += '}';
        console.log('[DEBUG] VocabParse: repaired JSON, trying again');
        jsonData = JSON.parse(repaired);
      }
      console.log('[DEBUG] VocabParse: JSON parsed, keys:', Object.keys(jsonData));
      const vocabItems = jsonData.vocabulary;
      if (!Array.isArray(vocabItems)) {
        console.warn('[DEBUG] VocabParse: vocabulary is not array:', typeof vocabItems, vocabItems);
        return [];
      }
      console.log('[DEBUG] VocabParse: vocabItems count:', vocabItems.length);

      const mapped = vocabItems
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
        }) as AutoVocabCard);

      console.log('[DEBUG] VocabParse: mapped items:', mapped.length, 'first:', mapped[0]);
      const filtered = mapped.filter(item => item.english && item.hebrew);
      console.log('[DEBUG] VocabParse: after filter:', filtered.length);

      return filtered;
    } catch (error) {
      console.error('[DEBUG] VocabParse: Error:', error);
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
