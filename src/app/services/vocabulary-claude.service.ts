import { Injectable } from '@angular/core';
import { EnhancedClaudeService } from './enhanced-claude.service';
import { Example, RawVocabItem, VocabCategory } from '../interfaces/vocabulary.interfaces';
import { AutoVocabCard, ServiceContext } from '../shared/interfaces/vocabulary.interfaces';
import { ChatMessage } from '../shared/interfaces/english-learning.interfaces';

import { filter } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class VocabularyClaudeService {
  constructor(private enhancedClaudeService: EnhancedClaudeService) { }

  // vocabulary-claude.service.ts

  async analyzeConversation(messages: ChatMessage[], context: ServiceContext): Promise<AutoVocabCard[]> {
    try {
      // Extract the conversation text from messages
      const conversationText = messages
        .map(msg => `${msg.sender}: ${msg.english}`)
        .join('\n');

      // Build a comprehensive prompt with the actual conversation
      const prompt = `Analyze this conversation for important vocabulary:

CONVERSATION:
${conversationText}

${this.buildVocabExtractionPrompt()}

Note: Focus on words and phrases that are:
1. Level-appropriate (user's vocabulary level: ${context.userLevel.vocabulary})
2. Actually used in the conversation
3. Useful for future conversations
4. Worth learning and remembering`;

      const response = await this.enhancedClaudeService.sendEnhancedMessage(
        prompt,
        context
      );

      // Debug logging
      console.log('Vocabulary Analysis Response:', response);

      const vocabCards = this.parseVocabularyResponse(response);
      console.log('Parsed Vocabulary Cards:', vocabCards);

      return vocabCards;
    } catch (error) {
      console.error('Error analyzing conversation:', error);
      return [];
    }
  }


  // vocabulary-claude.service.ts

  private parseVocabularyResponse(response: any): AutoVocabCard[] {
    try {
      let content = response.english || '';
      console.log('Raw content:', content);
  
      // Remove markdown code blocks if present
      content = content
        .replace(/```json\n?/g, '')  // Remove ```json
        .replace(/```\n?/g, '')      // Remove closing ```
        .trim();
  
      console.log('Content after markdown removal:', content);
  
      // Parse the JSON content
      let jsonData;
      try {
        jsonData = JSON.parse(content);
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
        console.error('Failed to parse content:', content);
        return [];
      }
  
      // Extract the vocabulary array
      const vocabItems = jsonData.vocabulary;
      if (!Array.isArray(vocabItems)) {
        console.warn('Vocabulary is not an array:', vocabItems);
        return [];
      }
  
      console.log('Found vocabulary items:', vocabItems.length);
  
      // Transform the items
      const transformedCards = vocabItems.map((item: RawVocabItem) => ({
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
  
      const filteredCards = transformedCards.filter(item => 
        item.english && 
        item.hebrew && 
        item.examples && 
        item.examples.length > 0
      );
      
      console.log('Processed vocabulary cards:', filteredCards);
      return filteredCards;
    } catch (error) {
      console.error('Error parsing vocabulary response:', error);
      return [];
    }
  }
  
  // Update prompt to specify no markdown
  private buildVocabExtractionPrompt(): string {
    return `Please analyze the conversation and extract vocabulary items. Return a JSON object in this exact format (no markdown):
  
  {
    "vocabulary": [
      {
        "english": "word or phrase",
        "hebrew": "תרגום לעברית",
        "context": "As used in conversation",
        "examples": [
          {
            "english": "Example sentence",
            "hebrew": "משפט דוגמה"
          }
        ],
        "suggestedLevel": 2,
        "suggestedCategory": "nouns",
        "confidence": 0.85
      }
    ]
  }
  
  Important:
  - Do NOT wrap the response in markdown code blocks
  - Return a single JSON object with a "vocabulary" array
  - Each item must have all the fields shown above
  - suggestedLevel: 1-4 (1=beginner, 4=advanced)
  - suggestedCategory: nouns, verbs, adjectives, phrases, idioms
  - confidence: 0-1 (how useful the word is)
  - Include relevant examples from the conversation`;
  }
  
  // Update the prompt to return a cleaner format

  // services/vocabulary-claude.service.ts
  async generateExamples(english: string): Promise<Example[]> {
    try {
      const context: ServiceContext = {
        userLevel: {
          speaking: 1,
          writing: 1,
          grammar: 1,
          vocabulary: 1
        },
        previousMessages: [],
        conversationContext: {
          isFirstMessage: false,
          currentTopic: null,
          lastProgressUpdate: undefined
        }
      };

      const prompt = `Generate 2-3 example sentences using: ${english}`;
      const response = await this.enhancedClaudeService.sendEnhancedMessage(
        prompt,
        context
      );
      return this.parseExamplesResponse(response);
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
  private parseExamplesResponse(response: any): Example[] {
    try {
      const content = response.content[0].text;
      return content.split('\n')
        .filter((line: string | string[]) => line.includes(':'))
        .map((line: { split: (arg0: string) => { (): any; new(): any; map: { (arg0: (s: any) => any): [any, any]; new(): any; }; }; }) => {
          const [english, hebrew] = line.split(':').map(s => s.trim());
          return { english, hebrew, context: '' };
        });
    } catch (error) {
      console.error('Error parsing examples:', error);
      return [];
    }
  }
}