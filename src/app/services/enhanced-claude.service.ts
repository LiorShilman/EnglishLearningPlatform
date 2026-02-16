import { Injectable } from '@angular/core';
import { ClaudeApiService } from './claude-api.service';
import { TtsService } from './tts.service';
import { ServiceContext } from '../shared/interfaces/english-learning.interfaces';

interface UserLevel {
  speaking: number;
  writing: number;
  grammar: number;
  vocabulary: number;
}

interface LearningBlock {
  type: 'grammar' | 'usage' | 'warning' | 'practice';
  title: string;
  content: {
    english: string;
    hebrew: string;
  };
  examples?: Array<{
    english: string;
    hebrew: string;
  }>;
}

interface ProgressMetrics {
  speaking: { score: number; accuracy: number; fluency: number };
  writing: { score: number; structure: number; style: number };
  grammar: { score: number; accuracy: number; range: number };
  vocabulary: { score: number; active: number; passive: number };
}

interface FocusArea {
  priority: number;
  description: { english: string; hebrew: string };
  status: number;
}

interface EnhancedChatMessage {
  sender: 'user' | 'assistant';
  english: string;
  hebrew?: string;
  feedback?: Array<{
    type: 'grammar' | 'vocabulary' | 'pronunciation';
    message: { english: string; hebrew: string };
    suggestion?: string;
  }>;
  learningBlocks?: LearningBlock[];
  progressUpdate?: {
    metrics: ProgressMetrics;
    focusAreas: FocusArea[];
  };
  timestamp: Date;
}

type ErrorType = 'grammar' | 'vocabulary' | 'structure';
type LevelType = 1 | 2 | 3 | 4;
type SkillType = keyof UserLevel;
type LevelCategories = Record<LevelType, string[]>;
type ErrorCategories = Record<ErrorType, LevelCategories>;

interface ErrorDetection {
  type: ErrorType;
  skill: SkillType;
}

@Injectable({
  providedIn: 'root'
})
export class EnhancedClaudeService {
  private userLevel: UserLevel = { speaking: 1, writing: 1, grammar: 1, vocabulary: 1 };
  private baseSystemPrompt: string;

  constructor(
    private claudeApi: ClaudeApiService,
    private ttsService: TtsService
  ) {
    this.baseSystemPrompt = this.initializeBasePrompt(this.userLevel);
  }

  // Delegate TTS to TtsService
  stopSpeech(): void {
    this.ttsService.stopSpeech();
  }

  pauseSpeech(): void {
    this.ttsService.pauseSpeech();
  }

  resumeSpeech(): void {
    this.ttsService.resumeSpeech();
  }

  // Main API method
  async sendEnhancedMessage(message: string, context: ServiceContext): Promise<EnhancedChatMessage> {
    try {
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

      if (context.conversationContext.isFirstMessage) {
        messages.push({ role: 'user', content: message });
        context.conversationContext.isFirstMessage = false;
      } else {
        const previousMessages = [...context.previousMessages];
        if (previousMessages.length > 0 &&
            previousMessages[previousMessages.length - 1].english === message) {
          previousMessages.pop();
        }

        previousMessages.forEach(msg => {
          messages.push({ role: msg.sender, content: msg.english });
        });

        messages.push({ role: 'user', content: message });
      }

      const systemPrompt = this.buildCurrentMessagePrompt(message, context);

      const response = await this.claudeApi.createMessage({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        temperature: 0.7,
        system: systemPrompt,
        messages: messages
      });

      if (!response.content || response.content.length === 0) {
        throw new Error('No content in response');
      }

      const processedResponse = this.parseClaudeResponse(response);
      return {
        ...processedResponse,
        sender: 'assistant',
        timestamp: new Date()
      };
    } catch (error: any) {
      console.error('Error in enhanced Claude communication:', error);
      const { english, hebrew } = this.getErrorMessage(error);
      return {
        sender: 'assistant',
        timestamp: new Date(),
        english,
        hebrew,
        learningBlocks: []
      };
    }
  }

  // Response parsing
  private parseClaudeResponse(response: any): EnhancedChatMessage {
    if (!response.content?.[0] || response.content[0].type !== 'text') {
      throw new Error('Invalid response format from Claude');
    }

    const content = response.content[0].text;
    const { english, hebrew } = this.parseContent(content);

    const message: EnhancedChatMessage = {
      sender: 'assistant',
      timestamp: new Date(),
      english,
      hebrew,
      learningBlocks: []
    };

    const blocks: string[] = content.match(/[📝💡⚠️🔄][^\n]+/g) || [];
    blocks.forEach((block: string) => {
      const parsedBlock = this.parseLearningBlock(block);
      if (parsedBlock) {
        message.learningBlocks?.push(parsedBlock);
      }
    });

    return message;
  }

  private parseContent(content: string): { english: string; hebrew: string } {
    try {
      // Try bracket-delimited format: English: [...] Hebrew: [...]
      // Use greedy match for English so it finds the last ] before Hebrew:
      const bracketMatch = content.match(
        /English:\s*\[([\s\S]*)\]\s*Hebrew:\s*\[([\s\S]*)\]\s*$/
      );
      if (bracketMatch) {
        return {
          english: bracketMatch[1].trim(),
          hebrew: bracketMatch[2].trim()
        };
      }

      // Fallback: split on "Hebrew:" at the start of a line (not mid-sentence)
      const hebrewSplitMatch = content.match(
        /^([\s\S]*?)(?:^|\n)\s*Hebrew:\s*([\s\S]*)$/m
      );
      if (hebrewSplitMatch) {
        let english = hebrewSplitMatch[1].replace(/^\s*English:\s*/i, '').trim();
        let hebrew = hebrewSplitMatch[2].trim();
        english = this.stripBrackets(english);
        hebrew = this.stripBrackets(hebrew);
        return { english, hebrew };
      }

      // Last resort: treat entire content as English
      let english = content.replace(/^\s*English:\s*/i, '').trim();
      english = this.stripBrackets(english);
      return { english, hebrew: '' };
    } catch (error) {
      console.error('Error parsing content:', error);
      return { english: '', hebrew: '' };
    }
  }

  private stripBrackets(text: string): string {
    // Remove leading [ and trailing ] (with possible whitespace/newlines around them)
    return text.replace(/^\s*\[/, '').replace(/\]\s*$/, '').trim();
  }

  private parseLearningBlock(block: string): LearningBlock | null {
    try {
      const lines = block.trim().split('\n').filter(line => line.trim());
      if (lines.length < 2) return null;

      const type = this.getLearningBlockType(lines[0]);
      const title = lines[0].replace(/^[📝💡⚠️🔄]/, '').trim();

      let english = '';
      let hebrew = '';
      const examples: Array<{ english: string; hebrew: string }> = [];

      let isExample = false;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.toLowerCase().includes('example:') || line.startsWith('*')) {
          isExample = true;
          const exampleText = line.replace(/^(Example:|•|\*)/i, '').trim();
          const [eng, heb] = this.separateLanguages(exampleText);
          examples.push({ english: eng, hebrew: heb || '' });
        } else if (/[\u0590-\u05FF]/.test(line)) {
          if (isExample && examples.length > 0) {
            examples[examples.length - 1].hebrew = line;
          } else {
            hebrew = line;
          }
        } else {
          if (!isExample && !english) {
            english = line.replace(/•/, '').trim();
          }
        }
      }

      return {
        type,
        title,
        content: { english: english || title, hebrew: hebrew || '' },
        ...(examples.length > 0 && { examples })
      };
    } catch (error) {
      console.error('Error parsing learning block:', error);
      return null;
    }
  }

  private getLearningBlockType(line: string): LearningBlock['type'] {
    if (line.startsWith('📝')) return 'grammar';
    if (line.startsWith('💡')) return 'usage';
    if (line.startsWith('⚠️')) return 'warning';
    if (line.startsWith('🔄')) return 'practice';
    return 'grammar';
  }

  private separateLanguages(text: string): [string, string] {
    const parts = text.split(/(?=[\u0590-\u05FF])/);
    return [
      parts[0]?.trim() || '',
      parts.slice(1).join('')?.trim() || ''
    ];
  }

  // Error handling
  private getErrorMessage(error: any): { english: string; hebrew: string } {
    if (error?.status === 429) {
      return {
        english: "I'm receiving too many requests right now. Please wait a moment and try again.",
        hebrew: "יש יותר מדי בקשות כרגע. אנא המתן רגע ונסה שוב."
      };
    }
    if (error?.status === 0 || error?.type === 'unknown_error') {
      return {
        english: "I can't reach the server. Please check your internet connection and make sure the backend is running.",
        hebrew: "לא ניתן להתחבר לשרת. אנא בדוק את חיבור האינטרנט ושהשרת פועל."
      };
    }
    if (error?.status >= 500) {
      return {
        english: "The AI service is temporarily unavailable. Please try again in a few moments.",
        hebrew: "שירות ה-AI לא זמין זמנית. אנא נסה שוב בעוד מספר רגעים."
      };
    }
    return {
      english: "I'm having difficulty processing that. Could you please rephrase?",
      hebrew: "אני מתקשה לעבד את זה. האם תוכל לנסח מחדש?"
    };
  }

  isValidSkill(skill: string, userLevel: UserLevel): skill is keyof UserLevel {
    return skill in userLevel;
  }

  // Prompt building
  private initializeBasePrompt(userLevel: UserLevel): string {
    this.userLevel = userLevel;
    return `You are an AI language assistant named Claude, created by Anthropic to conduct engaging English conversations while providing clear feedback and explanations in both English and Hebrew.
Your purpose is to create a supportive, immersive learning environment that helps users improve their English language skills through natural interaction,
practical examples, and structured learning elements.

User's English Proficiency Levels:
Writing: ${userLevel.writing}
Grammar and Syntax: ${userLevel.grammar}
Vocabulary: ${userLevel.vocabulary}
Speaking: ${userLevel.speaking}
(1 - Beginner, 4 - Advanced)

At the start of every conversation:
1. Greet the user warmly in both languages
2. Provide 3-5 creative conversation topic suggestions such as:
    • Personal experiences and stories
    • Current events and cultural topics
    • Hypothetical situations and scenarios
    • Role-playing exercises
    • Daily life and routine discussions
3. Let the user choose or suggest their own topic

********************VERY IMPORTENT*******************

Real-Time Correction System:
  When the user writes in English:

  1. Immediately analyze their input for:
    • Grammar and syntax
    • Word choice and vocabulary
    • Spelling and punctuation
    • Intended meaning

  2. Present corrections in this format:
  Did you mean to say: "[corrected sentence]"?
  Here's the breakdown:
    • Original: ~~[user's text]~~
    • Corrected: [corrected version]
    • Changes explained:

  [specific correction 1]
  [specific correction 2]
  etc.

*********************************************************

Extended Learning Features:

1. Conversation Templates (match to user levels):
🎯 Professional Practice (Level ${userLevel.speaking})
• Job interviews
• Business meetings
• Customer service
• Presentations

🎯 Daily Life Practice (Level ${userLevel.vocabulary})
• Shopping interactions
• Restaurant scenarios
• Travel situations
• Social conversations

2. Cultural Integration:
🌍 Cultural Elements
• Idioms matching vocabulary level
• Cultural context for conversations
• Social norms and customs
• Cross-cultural comparisons

Key Principles for Each Skill Level:

Writing (Level ${userLevel.writing}):
${this.getWritingGuidelines(userLevel.writing)}
• Adapt writing tasks and feedback accordingly
• Focus on appropriate complexity for this level

Grammar & Syntax (Level ${userLevel.grammar}):
${this.getGrammarSyntaxGuidelines(userLevel.grammar)}
• Introduce grammar concepts matching this level
• Focus on relevant grammatical structures

Vocabulary (Level ${userLevel.vocabulary}):
${this.getVocabularyGuidelines(userLevel.vocabulary)}
• Introduce new words suitable for this level
• Build on existing knowledge

Speaking (Level ${userLevel.speaking}):
${this.getSpeakingGuidelines(userLevel.speaking)}
• Adjust conversation pace to match ability
• Focus on appropriate pronunciation challenges

VERY IMPORTANT - Response Format:

English: [
Detailed response in English using enhanced markdown:

# For Main Topics
## For Subtopics
### For Specific Points

- Bullet points for lists
1. Numbered steps
> Quotes for emphasis or examples

\`code\` for corrections
**bold** for emphasis and question to the user.
*italic* for new terms
~~strikethrough~~ for mistakes
__underline__ for grammar patterns

---
For section breaks
]

Hebrew: [
תמצית תמציתית בעברית הכוללת:
• רעיונות מרכזיים בלבד
• נקודות חשובות להבנה
• תיקוני דקדוק קריטיים
• מילים חדשות חיוניות

לא לתרגם את כל הטקסט, אלא להתמקד במהות ובנקודות החשובות
]

Enhanced Learning Blocks:

1. Grammar (📝) - Adjust to Level ${userLevel.grammar}
2. Usage (💡) - Adjust to Level ${userLevel.vocabulary}
3. Warning (⚠️) - Adapt to user's levels
4. Practice (🔄) - Match to skill levels

Specific Level Adaptations:

Writing Level ${userLevel.writing}:
${this.getWritingLevelPrompt(userLevel.writing)}

Grammar Level ${userLevel.grammar}:
${this.getGrammarLevelPrompt(userLevel.grammar)}

Vocabulary Level ${userLevel.vocabulary}:
${this.getVocabularyLevelPrompt(userLevel.vocabulary)}

Speaking Level ${userLevel.speaking}:
${this.getSpeakingLevelPrompt(userLevel.speaking)}

Remember to:
1. Always maintain an encouraging, supportive tone
2. Adapt complexity specifically to each skill level
3. Use visual formatting to enhance readability
4. Celebrate progress in each skill area
5. Address errors based on skill-specific levels
6. Keep Hebrew summaries focused and concise
7. End each response with level-appropriate questions
8. Use markdown formatting consistently

======================================================================
CRITICAL FORMAT REQUIREMENT:
You MUST format ALL responses using EXACTLY this structure:

English: [
Your complete English response here
]

Hebrew: [
התגובה שלך בעברית כאן
]

ANY RESPONSE NOT IN THIS FORMAT IS INCORRECT.
======================================================================

Before you response check again this pattern`;
  }

  private buildCurrentMessagePrompt(message: string, context: ServiceContext): string {
    const errorAnalysis = this.getCurrentErrorAnalysis(message, context.userLevel);

    return `${this.baseSystemPrompt}

CRITICAL FORMAT REQUIREMENT:
You MUST format ALL responses using EXACTLY this structure:

English: [
Your complete English response here, including:
- All explanations
- All corrections
- All suggestions
- All practice exercises
Use markdown formatting as specified.
]

Hebrew: [
התגובה שלך בעברית כאן, כולל:
• נקודות עיקריות
• תיקונים חשובים
• הצעות לתרגול
]

Current User Levels:
Writing: ${context.userLevel.writing}
Grammar: ${context.userLevel.grammar}
Vocabulary: ${context.userLevel.vocabulary}
Speaking: ${context.userLevel.speaking}

Error Analysis:
${errorAnalysis}

IMPORTANT REMINDERS:
1. Always use the exact format specified above
2. Include both English and Hebrew sections
3. Use markdown formatting consistently
4. Keep Hebrew responses focused on key points
5. Provide appropriate feedback for user's level`;
  }

  // Error detection
  private getCurrentErrorAnalysis(message: string, userLevel: UserLevel): string {
    const currentError = this.detectErrors(message);

    if (!currentError || !this.isValidSkill(currentError.skill, userLevel)) {
      return this.getGeneralErrorAnalysis(userLevel);
    }

    const level = userLevel[currentError.skill] as LevelType;
    return `${this.getGeneralErrorAnalysis(userLevel)}

Current Message Specific Error:
${this.getErrorAnalysisPrompt(currentError.type, level)}`;
  }

  private getGeneralErrorAnalysis(userLevel: UserLevel): string {
    return `
Grammar Analysis:
${this.getErrorAnalysisPrompt('grammar', userLevel.grammar as LevelType)}

Vocabulary Analysis:
${this.getErrorAnalysisPrompt('vocabulary', userLevel.vocabulary as LevelType)}

Structure Analysis:
${this.getErrorAnalysisPrompt('structure', userLevel.writing as LevelType)}`;
  }

  private detectErrors(message: string): ErrorDetection | null {
    if (this.checkGrammarErrors(message)) return { type: 'grammar', skill: 'grammar' };
    if (this.checkVocabularyErrors(message)) return { type: 'vocabulary', skill: 'vocabulary' };
    if (this.checkStructureErrors(message)) return { type: 'structure', skill: 'writing' };
    return null;
  }

  private checkGrammarErrors(message: string): boolean {
    const patterns = [
      /\bi am going/i,
      /\bi (is|are)/i,
      /\b(he|she|it) (are|am)\b/i,
      /\b(have|has) went\b/i,
    ];
    return patterns.some(p => p.test(message));
  }

  private checkVocabularyErrors(message: string): boolean {
    const patterns = [
      /\bmake (a|the) homework\b/i,
      /\btake (a|the) decision\b/i,
      /\bsay (a|the) lie\b/i,
    ];
    return patterns.some(p => p.test(message));
  }

  private checkStructureErrors(message: string): boolean {
    const patterns = [
      /^[a-z]/,
      /[^.!?]$/,
      /\s[.!?]/,
    ];
    return patterns.some(p => p.test(message));
  }

  private getErrorAnalysisPrompt(errorType: ErrorType, level: LevelType): string {
    const errorCategories: ErrorCategories = {
      grammar: {
        1: ['subject-verb agreement', 'basic tenses', 'articles'],
        2: ['comparative forms', 'modal verbs', 'prepositions'],
        3: ['perfect tenses', 'conditionals', 'passive voice'],
        4: ['advanced tenses', 'subjunctive', 'complex structures']
      },
      vocabulary: {
        1: ['basic word choice', 'common expressions', 'simple synonyms'],
        2: ['phrasal verbs', 'common idioms', 'collocations'],
        3: ['academic vocabulary', 'formal vs informal', 'nuanced meaning'],
        4: ['idiomatic expressions', 'subtle distinctions', 'stylistic choices']
      },
      structure: {
        1: ['simple sentences', 'basic word order', 'punctuation'],
        2: ['compound sentences', 'paragraph structure', 'transitions'],
        3: ['complex sentences', 'essay organization', 'coherence'],
        4: ['advanced composition', 'stylistic devices', 'rhetorical strategies']
      }
    };

    const correctionStrategies: Record<number, string> = {
      1: 'Immediate, direct correction with simple explanations',
      2: 'Guided self-correction with hints and examples',
      3: 'Pattern recognition and self-correction opportunities',
      4: 'Subtle guidance and advanced error analysis'
    };

    return `
Error Focus for ${errorType} at Level ${level}:
• Common Patterns: ${errorCategories[errorType][level]?.join(', ') || 'No patterns defined'}
• Correction Strategy: ${correctionStrategies[level] ?? correctionStrategies[1]}
• Practice Focus: Level ${level} ${errorType} practice with appropriate exercises`;
  }

  // Level-specific prompts
  private getWritingLevelPrompt(level: number): string {
    const prompts: Record<number, string> = {
      1: '• Focus on basic sentence formation\n• Simple punctuation rules\n• Short, clear sentences\n• Basic paragraph structure',
      2: '• Compound sentences\n• Basic paragraph organization\n• Simple connectors\n• Clear topic sentences',
      3: '• Complex sentence structures\n• Paragraph development\n• Transition phrases\n• Coherent arguments',
      4: '• Sophisticated writing style\n• Advanced organization\n• Nuanced expression\n• Academic writing skills'
    };
    return prompts[level] || '';
  }

  private getGrammarLevelPrompt(level: number): string {
    const prompts: Record<number, string> = {
      1: '• Basic tenses\n• Simple sentence structure\n• Essential articles\n• Basic pronouns',
      2: '• Compound tenses\n• Basic conditionals\n• Comparative forms\n• Regular patterns',
      3: '• Perfect tenses\n• All conditionals\n• Passive voice\n• Complex patterns',
      4: '• Advanced tenses\n• Subtle distinctions\n• Idiomatic usage\n• Native-like patterns'
    };
    return prompts[level] || '';
  }

  private getVocabularyLevelPrompt(level: number): string {
    const prompts: Record<number, string> = {
      1: '• Basic everyday words\n• Simple phrases\n• Common expressions\n• Essential verbs',
      2: '• Extended vocabulary\n• Common idioms\n• Topic-specific terms\n• Phrasal verbs',
      3: '• Advanced vocabulary\n• Industry terms\n• Abstract concepts\n• Idiomatic expressions',
      4: '• Sophisticated terms\n• Nuanced meanings\n• Academic vocabulary\n• Cultural references'
    };
    return prompts[level] || '';
  }

  private getSpeakingLevelPrompt(level: number): string {
    const prompts: Record<number, string> = {
      1: '• Basic pronunciation\n• Simple responses\n• Common phrases\n• Slow, clear speech',
      2: '• Clear pronunciation\n• Short discussions\n• Topic responses\n• Moderate pace',
      3: '• Natural intonation\n• Fluid discussion\n• Complex topics\n• Normal pace',
      4: '• Native-like fluency\n• Advanced discussion\n• Any topic\n• Natural pace'
    };
    return prompts[level] || '';
  }

  private getWritingGuidelines(level: number): string {
    const guidelines: Record<number, string> = {
      1: 'Focus on basic writing skills, simple sentences, and clear communication',
      2: 'Develop paragraph structure, introduce compound sentences, and basic organization',
      3: 'Work on complex writing, essay structure, and coherent argumentation',
      4: 'Master sophisticated writing styles, academic writing, and creative expression'
    };
    return guidelines[level] || '';
  }

  private getGrammarSyntaxGuidelines(level: number): string {
    const guidelines: Record<number, string> = {
      1: 'Cover essential grammar rules, basic tenses, and simple structures',
      2: 'Introduce intermediate grammar concepts, compound tenses, and basic conditionals',
      3: 'Focus on advanced grammar patterns, all tenses, and complex structures',
      4: 'Perfect advanced grammar usage, subtle distinctions, and native-like patterns'
    };
    return guidelines[level] || '';
  }

  private getVocabularyGuidelines(level: number): string {
    const guidelines: Record<number, string> = {
      1: 'Build essential vocabulary for daily communication and basic needs',
      2: 'Expand vocabulary with common idioms and topic-specific terms',
      3: 'Develop advanced vocabulary including abstract concepts and professional terms',
      4: 'Master sophisticated vocabulary, nuanced meanings, and cultural references'
    };
    return guidelines[level] || '';
  }

  private getSpeakingGuidelines(level: number): string {
    const guidelines: Record<number, string> = {
      1: 'Focus on basic communication, clear pronunciation, and simple conversations',
      2: 'Develop fluency in common situations, improve pronunciation, and build confidence',
      3: 'Practice complex discussions, natural intonation, and fluid conversation',
      4: 'Perfect native-like speaking, handle any topic, and master subtle expressions'
    };
    return guidelines[level] || '';
  }
}
