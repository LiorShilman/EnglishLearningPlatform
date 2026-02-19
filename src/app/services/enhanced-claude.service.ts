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
    console.log('[DEBUG] Raw Claude response length:', content.length);
    console.log('[DEBUG] Raw Claude response (first 500 chars):', content.substring(0, 500));

    const { english, hebrew } = this.parseContent(content);
    console.log('[DEBUG] Parsed english length:', english.length, 'hebrew length:', hebrew.length);

    let learningBlocks = this.parseStructuredBlocks(content);
    console.log('[DEBUG] Structured blocks found:', learningBlocks.length);

    // Fallback: try to extract blocks from English content using markdown patterns
    if (learningBlocks.length === 0) {
      learningBlocks = this.extractBlocksFromMarkdown(english);
      console.log('[DEBUG] Markdown fallback blocks found:', learningBlocks.length);
    }

    return {
      sender: 'assistant',
      timestamp: new Date(),
      english,
      hebrew,
      learningBlocks
    };
  }

  private parseContent(content: string): { english: string; hebrew: string } {
    try {
      // Strip BLOCKS section aggressively - multiple patterns to handle AI variations
      let cleaned = content;

      // Pattern 1: BLOCKS: [...] with closing bracket
      cleaned = cleaned.replace(/\n?\s*BLOCKS:\s*\[[\s\S]*\]\s*$/, '');
      // Pattern 2: BLOCKS: [ followed by content until end (no closing bracket)
      cleaned = cleaned.replace(/\n?\s*BLOCKS:\s*\[[\s\S]*$/, '');
      // Pattern 3: Standalone [GRAMMAR], [USAGE], etc. sections at the end
      cleaned = cleaned.replace(/\n?\s*\[(GRAMMAR|USAGE|WARNING|PRACTICE)\][\s\S]*$/i, '');

      cleaned = cleaned.trim();
      console.log('[DEBUG] parseContent: cleaned length:', cleaned.length, 'original:', content.length);

      // Try bracket-delimited format: English: [...] Hebrew: [...]
      // Use greedy for English (to find last ] before Hebrew:) and greedy for Hebrew
      const bracketMatch = cleaned.match(
        /English:\s*\[([\s\S]*)\]\s*Hebrew:\s*\[([\s\S]*)\]\s*$/
      );
      if (bracketMatch) {
        console.log('[DEBUG] parseContent: bracketMatch succeeded');
        return {
          english: this.cleanDisplayText(bracketMatch[1].trim()),
          hebrew: this.cleanDisplayText(bracketMatch[2].trim())
        };
      }

      // Fallback: split on "Hebrew:" at the start of a line
      const hebrewSplitMatch = cleaned.match(
        /^([\s\S]*?)(?:^|\n)\s*Hebrew:\s*([\s\S]*)$/m
      );
      if (hebrewSplitMatch) {
        console.log('[DEBUG] parseContent: hebrewSplit succeeded');
        let english = hebrewSplitMatch[1].replace(/^\s*English:\s*/i, '').trim();
        let hebrew = hebrewSplitMatch[2].trim();
        english = this.stripBrackets(english);
        hebrew = this.stripBrackets(hebrew);
        return {
          english: this.cleanDisplayText(english),
          hebrew: this.cleanDisplayText(hebrew)
        };
      }

      // Last resort: treat entire content as English
      let english = cleaned.replace(/^\s*English:\s*/i, '').trim();
      english = this.stripBrackets(english);
      return { english: this.cleanDisplayText(english), hebrew: '' };
    } catch (error) {
      console.error('Error parsing content:', error);
      return { english: '', hebrew: '' };
    }
  }

  // Remove any remaining BLOCKS artifacts from display text
  private cleanDisplayText(text: string): string {
    return text
      .replace(/\n?\s*BLOCKS:\s*\[[\s\S]*/g, '')
      .replace(/\n?\s*\[(GRAMMAR|USAGE|WARNING|PRACTICE|VOCABULARY)\][^\n]*/gi, '')
      .replace(/\n?\s*(?:EN|HE|EX):\s*[^\n]*/g, '')
      .trim();
  }

  private stripBrackets(text: string): string {
    // Remove leading [ and trailing ] (with possible whitespace/newlines around them)
    return text.replace(/^\s*\[/, '').replace(/\]\s*$/, '').trim();
  }

  private parseStructuredBlocks(content: string): LearningBlock[] {
    try {
      // Try multiple patterns to find BLOCKS section
      let blocksContent = '';

      // Pattern 1: BLOCKS: [...content...]
      const blocksMatch1 = content.match(/BLOCKS:\s*\[([\s\S]*)\]\s*$/);
      if (blocksMatch1) {
        blocksContent = blocksMatch1[1].trim();
      }

      // Pattern 2: BLOCKS: [ then content (AI might not close bracket)
      if (!blocksContent) {
        const blocksMatch2 = content.match(/BLOCKS:\s*\[([\s\S]*)$/);
        if (blocksMatch2) {
          blocksContent = blocksMatch2[1].trim();
        }
      }

      // Pattern 3: Just find [GRAMMAR/USAGE/WARNING/PRACTICE] blocks anywhere after Hebrew section
      if (!blocksContent) {
        const hebrewEnd = content.lastIndexOf(']');
        const afterHebrew = content.substring(hebrewEnd + 1);
        if (/\[(GRAMMAR|USAGE|WARNING|PRACTICE)\]/i.test(afterHebrew)) {
          blocksContent = afterHebrew;
        }
      }

      console.log('[DEBUG] parseStructuredBlocks: blocksContent length:', blocksContent.length);
      if (!blocksContent || blocksContent.toLowerCase() === 'none') return [];

      // Split on block type markers: [GRAMMAR], [USAGE], [WARNING], [PRACTICE]
      const blocks: LearningBlock[] = [];
      const parts = blocksContent.split(/(?=\[(?:GRAMMAR|USAGE|WARNING|PRACTICE|VOCABULARY)\])/i);

      for (const part of parts) {
        const headerMatch = part.match(/^\[(GRAMMAR|USAGE|WARNING|PRACTICE|VOCABULARY)\]\s*(.+)/i);
        if (!headerMatch) continue;

        const rawType = headerMatch[1].toLowerCase();
        const type = (rawType === 'vocabulary' ? 'usage' : rawType) as LearningBlock['type'];
        const title = headerMatch[2].trim();
        const lines = part.split('\n').slice(1); // skip the header line

        let english = '';
        let hebrew = '';
        const examples: Array<{ english: string; hebrew: string }> = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('EN:')) {
            english = trimmed.substring(3).trim();
          } else if (trimmed.startsWith('HE:')) {
            hebrew = trimmed.substring(3).trim();
          } else if (trimmed.startsWith('EX:')) {
            const exText = trimmed.substring(3).trim();
            const pipeIdx = exText.indexOf('|');
            if (pipeIdx !== -1) {
              examples.push({
                english: exText.substring(0, pipeIdx).trim(),
                hebrew: exText.substring(pipeIdx + 1).trim()
              });
            } else {
              examples.push({ english: exText, hebrew: '' });
            }
          }
        }

        if (english || title) {
          blocks.push({
            type,
            title,
            content: { english: english || title, hebrew: hebrew || '' },
            ...(examples.length > 0 && { examples })
          });
        }
      }

      return blocks;
    } catch (error) {
      console.error('Error parsing structured blocks:', error);
      return [];
    }
  }

  // Fallback: extract learning blocks from markdown content when BLOCKS section is missing
  private extractBlocksFromMarkdown(english: string): LearningBlock[] {
    const blocks: LearningBlock[] = [];
    if (!english) return blocks;

    // Pattern 1: Look for numbered sections with grammar/correction keywords
    const correctionMatch = english.match(/(?:did you mean|corrected|correction|here'?s the breakdown)/i);
    if (correctionMatch) {
      // Extract corrections as a grammar block
      const correctionSection = english.substring(correctionMatch.index || 0);
      blocks.push({
        type: 'grammar',
        title: 'Correction',
        content: { english: correctionSection.substring(0, 300), hebrew: '' },
      });
    }

    // Pattern 2: Look for sections with ## headers that indicate learning content
    const sectionRegex = /#{1,3}\s*\d*\.?\s*(Grammar|Vocabulary|Usage|Warning|Practice|Tip|Note|Important|Correction|Verb|Tense|Capital|Time|Expression)[^\n]*/gi;
    let match;
    const foundSections: { type: LearningBlock['type']; title: string; startIdx: number }[] = [];

    while ((match = sectionRegex.exec(english)) !== null) {
      const keyword = match[1].toLowerCase();
      let type: LearningBlock['type'] = 'grammar';
      if (keyword.includes('usage') || keyword.includes('vocabulary') || keyword.includes('tip')) type = 'usage';
      else if (keyword.includes('warning') || keyword.includes('important') || keyword.includes('note')) type = 'warning';
      else if (keyword.includes('practice')) type = 'practice';

      foundSections.push({
        type,
        title: match[0].replace(/^#+\s*\d*\.?\s*/, '').trim(),
        startIdx: match.index
      });
    }

    // Extract content for each section
    for (let i = 0; i < foundSections.length; i++) {
      const section = foundSections[i];
      const endIdx = i < foundSections.length - 1
        ? foundSections[i + 1].startIdx
        : Math.min(section.startIdx + 500, english.length);

      const sectionContent = english.substring(section.startIdx, endIdx).trim();

      // Skip if we already have a block with this title
      if (blocks.some(b => b.title === section.title)) continue;

      blocks.push({
        type: section.type,
        title: section.title,
        content: { english: sectionContent, hebrew: '' },
      });
    }

    // Pattern 3: If no sections found but content has correction indicators
    if (blocks.length === 0) {
      const hasCorrection = /~~[^~]+~~|strikethrough|original.*corrected|incorrect.*correct/i.test(english);
      const hasTip = /remember|important|note that|keep in mind|tip:/i.test(english);
      const hasPractice = /try|practice|exercise|your turn|can you/i.test(english);

      if (hasCorrection) {
        blocks.push({
          type: 'grammar',
          title: 'Grammar Correction',
          content: { english: 'Corrections provided in the response above', hebrew: 'תיקונים מופיעים בתשובה למעלה' },
        });
      }
      if (hasTip) {
        blocks.push({
          type: 'usage',
          title: 'Learning Tip',
          content: { english: 'Tips provided in the response above', hebrew: 'טיפים מופיעים בתשובה למעלה' },
        });
      }
      if (hasPractice) {
        blocks.push({
          type: 'practice',
          title: 'Practice',
          content: { english: 'Practice exercises in the response above', hebrew: 'תרגול מופיע בתשובה למעלה' },
        });
      }
    }

    return blocks;
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
    - Original: ~~[user's text]~~
    - Corrected: **[corrected version]**
    - Changes explained:

  [specific correction 1]
  [specific correction 2]
  etc.

  IMPORTANT STYLE RULES:
  - Do NOT use emoji icons like ✅, ❌, 📝, 💡, ⚠️, 🔄, 🎯, 🌍, 📋 etc.
  - Instead use clean markdown: bullet points (-), numbered lists (1.), bold (**text**), italic (*text*), headers (##)
  - For correct examples use: **Correct:** before the sentence
  - For incorrect examples use: ~~Incorrect:~~ before the sentence
  - Use horizontal rules (---) to separate sections
  - Keep the tone professional and clean without decorative symbols

*********************************************************

Extended Learning Features:

1. Conversation Templates (match to user levels):
**Professional Practice** (Level ${userLevel.speaking})
- Job interviews
- Business meetings
- Customer service
- Presentations

**Daily Life Practice** (Level ${userLevel.vocabulary})
- Shopping interactions
- Restaurant scenarios
- Travel situations
- Social conversations

2. Cultural Integration:
**Cultural Elements**
- Idioms matching vocabulary level
- Cultural context for conversations
- Social norms and customs
- Cross-cultural comparisons

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
Detailed response in English using clean, professional markdown:

## For Main Sections
### For Subsections

- Bullet points for lists
1. Numbered steps for sequences
> Blockquotes for important notes or examples

**bold** for emphasis, key terms, and correct forms
*italic* for new vocabulary or grammar patterns
~~strikethrough~~ for incorrect forms
\`code\` for specific word corrections

---
For section breaks

STYLE: Do NOT use any emoji or unicode symbols. Use only plain text with markdown formatting.
The formatting itself should convey meaning — bold for correct, strikethrough for incorrect, headers for structure.
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

1. Grammar — Adjust to Level ${userLevel.grammar}
2. Usage — Adjust to Level ${userLevel.vocabulary}
3. Warning — Adapt to user's levels
4. Practice — Match to skill levels

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
3. Use clean markdown formatting — headers, bold, italic, lists, horizontal rules
4. Celebrate progress in each skill area
5. Address errors based on skill-specific levels
6. Keep Hebrew summaries focused and concise
7. End each response with level-appropriate questions
8. NEVER use emoji icons (no ✅❌📝💡⚠️🔄🎯🌍📋 etc.) — use markdown formatting instead

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
    const modeAddition = context.conversationContext.modePromptAddition || '';

    return `${this.baseSystemPrompt}
${modeAddition ? `\n--- CONVERSATION MODE ---\n${modeAddition}\n--- END MODE ---\n` : ''}
CRITICAL FORMAT REQUIREMENT:
You MUST format ALL responses using EXACTLY this structure:

English: [
Your complete English response here using clean markdown.
Do NOT include learning blocks here — put them in the BLOCKS section below.
]

Hebrew: [
תמצית בעברית — נקודות עיקריות בלבד
]

BLOCKS: [
If you have grammar corrections, usage tips, warnings, or practice suggestions, list them here.
Each block must follow this exact format (one per learning point):

[GRAMMAR] Title of the point
EN: English explanation
HE: Hebrew explanation
EX: Example sentence in English | Hebrew translation

[USAGE] Title
EN: English explanation
HE: Hebrew explanation
EX: Example | תרגום

[WARNING] Title
EN: English explanation
HE: Hebrew explanation

[PRACTICE] Title
EN: English explanation or exercise
HE: Hebrew explanation
EX: Example | תרגום

Valid block types: GRAMMAR, USAGE, WARNING, PRACTICE
Each block MUST have EN and HE lines. EX lines are optional (can have multiple).
If there are no learning points, write: BLOCKS: [none]
]

Current User Levels:
Writing: ${context.userLevel.writing}
Grammar: ${context.userLevel.grammar}
Vocabulary: ${context.userLevel.vocabulary}
Speaking: ${context.userLevel.speaking}

Error Analysis:
${errorAnalysis}

IMPORTANT REMINDERS:
1. Always use the exact format: English: [...] Hebrew: [...] BLOCKS: [...]
2. Never use emoji icons — use only clean markdown
3. Put ALL grammar/usage/warning/practice content inside BLOCKS, not in the English section
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
