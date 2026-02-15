import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ClaudeApiService } from './claude-api.service';
import { ConversationContext, MessageRole, ServiceContext } from '../shared/interfaces/english-learning.interfaces';

// Base interfaces
interface ChatMessage {
  sender: 'user' | 'assistant';
  english: string;
  hebrew?: string;
  feedback?: Array<{
    type: 'grammar' | 'vocabulary' | 'pronunciation';
    message: {
      english: string;
      hebrew: string;
    };
    suggestion?: string;
  }>;
  timestamp: Date;
}

interface TTSOptions {
  rate?: number;        // Speech rate (0.1 to 10)
  pitch?: number;       // Speech pitch (0 to 2)
  volume?: number;      // Speech volume (0 to 1)
  voice?: SpeechSynthesisVoice; // Specific voice to use
  lang?: string;        // Language code (e.g., 'en-US')
  preferredGender?: 'female' | 'male';  // Preferred voice gender
}


interface UserLevel {
  speaking: number;
  writing: number;
  grammar: number;
  vocabulary: number;
}

interface Topic {
  english: string;
  hebrew: string;
}

// Enhanced interfaces to match the comprehensive guidelines
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
  speaking: {
    score: number;
    accuracy: number;
    fluency: number;
  };
  writing: {
    score: number;
    structure: number;
    style: number;
  };
  grammar: {
    score: number;
    accuracy: number;
    range: number;
  };
  vocabulary: {
    score: number;
    active: number;
    passive: number;
  };
}


interface FocusArea {
  priority: number;
  description: {
    english: string;
    hebrew: string;
  };
  status: number; // Progress percentage
}

// הגדרת הטיפוסים
type ErrorType = 'grammar' | 'vocabulary' | 'structure';
type LevelType = 1 | 2 | 3 | 4;
type SkillType = keyof UserLevel; // 'speaking' | 'writing' | 'grammar' | 'vocabulary'

interface ErrorDetection {
  type: ErrorType;
  skill: SkillType;
}

// הגדרת הטיפוס לרמות
type LevelCategories = Record<LevelType, string[]>;

// הגדרת הטיפוס לקטגוריות שגיאה
type ErrorCategories = Record<ErrorType, LevelCategories>;


interface EnhancedChatMessage extends ChatMessage {
  learningBlocks?: LearningBlock[];
  progressUpdate?: {
    metrics: ProgressMetrics;
    focusAreas: FocusArea[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class EnhancedClaudeService {
  private speechSynthesis: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];
  private speechQueue: string[] = [];
  private defaultTTSOptions: TTSOptions = {
    rate: 1,
    pitch: 1,
    volume: 1,
    lang: 'en-US'
  };
  private isSpeaking = false;
  private userLevel: UserLevel = {
    speaking: 1,
    writing: 1,
    grammar: 1,
    vocabulary: 1
  };

  private baseSystemPrompt: string;

  constructor(private http: HttpClient, private claudeApi: ClaudeApiService) {
    // Initialize base system prompt
    this.baseSystemPrompt = this.initializeBasePrompt(this.userLevel);

    // Initialize speech synthesis
    this.speechSynthesis = window.speechSynthesis;
    this.loadVoices();

    // Set default to female voice
    this.defaultTTSOptions.preferredGender = 'female';

    // Handle dynamic voice loading
    speechSynthesis.addEventListener('voiceschanged', () => {
      this.loadVoices();
    });
  }

  private initializeBasePrompt(userLevel: UserLevel): string {
    this.userLevel = userLevel;
    const writingGuidelines = this.getWritingGuidelines(userLevel.writing);
    const grammarSyntaxGuidelines = this.getGrammarSyntaxGuidelines(userLevel.grammar);
    const vocabularyGuidelines = this.getVocabularyGuidelines(userLevel.vocabulary);
    const speakingGuidelines = this.getSpeakingGuidelines(userLevel.speaking);
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
${writingGuidelines}
• Adapt writing tasks and feedback accordingly
• Focus on appropriate complexity for this level
• Provide suitable writing challenges and exercises

Grammar & Syntax (Level ${userLevel.grammar}):
${grammarSyntaxGuidelines}
• Introduce grammar concepts matching this level
• Provide level-appropriate explanations
• Focus on relevant grammatical structures

Vocabulary (Level ${userLevel.vocabulary}):
${vocabularyGuidelines}
• Introduce new words suitable for this level
• Provide context-appropriate vocabulary
• Build on existing knowledge

Speaking (Level ${userLevel.speaking}):
${speakingGuidelines}
• Adjust conversation pace to match ability
• Focus on appropriate pronunciation challenges
• Provide suitable speaking practice opportunities

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

| Column 1 | Column 2 |
|----------|----------|
| Content  | Content  |

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
Format:
📝 Rule Title
• Explanation matching grammar level
• Level-appropriate examples
• Common mistakes at this level

2. Usage (💡) - Adjust to Level ${userLevel.vocabulary}
Format:
💡 Usage Pattern
• Context suitable for vocabulary level
• Level-appropriate examples
• Practice suggestions matching level

3. Warning (⚠️) - Adapt to user's levels
Format:
⚠️ Warning Type
• Common mistakes at user's level
• Level-appropriate corrections
• Suitable memory tips

4. Practice (🔄) - Match to skill levels
Format:
🔄 Practice Topic
• Exercises matching each skill level
• Level-appropriate examples
• Targeted feedback

5. Story-Based Learning (📚)
Format:
📚 Story Title
• Level-appropriate narrative
• Key vocabulary
• Grammar focus
• Comprehension questions
• Cultural context

6. Situational Practice (🎭)
Format:
🎭 Scenario Title
• Real-life situation
• Key expressions
• Cultural notes
• Practice dialogue
• Feedback points

7. Review & Reinforcement (📝)
Format:
📝 Review Topic
• Previous concepts
• Pattern recognition
• Common errors
• Progress check
• Next steps

Advanced Error Correction System:

1. Error Pattern Recognition (🔍)
Format:
🔍 Error Pattern Analysis
• Pattern Type: [Grammar/Vocabulary/Pronunciation/Structure]
• Frequency: [High/Medium/Low]
• Context: When this error typically occurs
• Root Cause: Likely source of the error (e.g., L1 interference)

2. Personalized Corrections (✍️)
Format:
✍️ Correction Strategy
• Original Error: ~~mistake~~
• Correction: \`correct form\`
• Explanation: Clear, level-appropriate explanation
• Similar Examples: Related cases for pattern recognition
• Prevention Tips: How to avoid this error in future

3. Targeted Practice (🎯)
Format:
🎯 Focus Exercise
• Error Type: Specific error being addressed
• Practice Pattern: Structured exercise targeting the error
• Application: Real-world usage examples
• Self-Check: How to verify correct usage

4. Error Tracking Matrix:
| Error Category | Frequency | Progress | Status |
|----------------|-----------|----------|---------|
| L1 Interference| Track     | Weekly   | Active  |
| Grammar Rules  | Track     | Weekly   | Active  |
| Word Choice    | Track     | Weekly   | Active  |
| Structure      | Track     | Weekly   | Active  |

5. Feedback Integration:
• Connect errors to specific skill levels
• Track improvement over time
• Provide positive reinforcement
• Suggest targeted exercises
• Link to relevant learning blocks

Remember for Error Correction:
1. Always maintain a constructive tone
2. Focus on patterns rather than individual mistakes
3. Provide clear, actionable feedback
4. Connect corrections to existing knowledge
5. Use examples that match the user's interests and level

Progress Tracking System:

1. Achievement Matrix
🏆 Skill Progress
| Skill Area  | Current | Target | Progress |
|-------------|---------|---------|----------|
| Speaking    | ${userLevel.speaking} | ${userLevel.speaking + 1} | Tracking |
| Writing     | ${userLevel.writing} | ${userLevel.writing + 1} | Tracking |
| Grammar     | ${userLevel.grammar} | ${userLevel.grammar + 1} | Tracking |
| Vocabulary  | ${userLevel.vocabulary} | ${userLevel.vocabulary + 1} | Tracking |

2. Feedback Framework:
📊 Immediate Feedback
• Real-time corrections
• Pattern recognition
• Improvement suggestions
• Pronunciation guidance
• Grammar adjustments
• Vocabulary suggestions
• Expression refinement

📈 Session Summary
• Key achievements
• Areas for practice
• Next session goals
• Pattern observations
• Areas for improvement
• Practice recommendations

3. Progress Indicators
• Accuracy tracking
• Fluency measurement
• Complexity assessment
• Confidence markers

4. Motivation System:
🏆 Achievements
• Skill milestones
• Complexity increases
• Error reduction
• Fluency improvements

⭐ Progress Celebrations
• Level advancements
• Pattern mastery
• Vocabulary expansion
• Grammar proficiency

Additional Markdown Elements:
🎯 Goals and Objectives
📈 Progress Updates
💡 Learning Tips
⭐ Achievements
🔄 Practice Suggestions
⚠️ Common Mistakes
📚 Learning Resources
🌍 Cultural Notes

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
8. Provide feedback targeted to each skill
9. Use markdown formatting consistently
10. Balance instruction with natural conversation
    
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

  // Load available voices
  private loadVoices(): void {
    this.voices = this.speechSynthesis.getVoices();
    // Set default English voice
    this.defaultTTSOptions.voice = this.voices.find(
      voice => voice.lang.startsWith('en') && voice.default
    );
  }

  // מעבד את תור הדיבור
  private async processQueue(): Promise<void> {
    while (this.speechQueue.length > 0) {
      const chunk = this.speechQueue[0];
      const ttsOptions = this.getTTSOptionsForLevel(this.userLevel);

      try {
        this.isSpeaking = true;
        await this.speakText(chunk, ttsOptions);
        this.speechQueue.shift(); // מסיר מהתור לאחר דיבור מוצלח
      } catch (error) {
        console.error('Speech error:', error);
        this.speechQueue = []; // מנקה את התור במקרה של שגיאה
      } finally {
        this.isSpeaking = false;
      }
    }
  }

  // פונקציית הדיבור המשופרת
  private async speakText(text: string, options: TTSOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.stopSpeech(); // מוודא שאין דיבור קודם

        const utterance = new SpeechSynthesisUtterance(text);
        Object.assign(utterance, options);

        utterance.onend = () => resolve();
        utterance.onerror = (error) => reject(error);

        // מוסיף השהייה קצרה בין חלקים
        setTimeout(() => {
          this.speechSynthesis.speak(utterance);
        }, 100);
      } catch (error) {
        reject(error);
      }
    });
  }

  /*  private buildEnhancedSystemPrompt(userLevel: UserLevel): string {
     this.userLevel = userLevel;
     return this.generateInstructions(userLevel.writing,userLevel.grammar,userLevel.vocabulary,userLevel.speaking);
   }
    */
  /* private buildEnhancedSystemPrompt(userLevel: UserLevel): string {
    return `You are an AI language assistant named Claude, created by Anthropic to conduct engaging English conversations while providing clear feedback and explanations in both English and Hebrew. Your purpose is to create a supportive, immersive learning environment that helps users improve their English language skills through natural interaction, practical examples, and structured learning elements.

Key Principles:
1. Adapt responses to the user's proficiency level (Beginner, Intermediate, Advanced)
2. Seamlessly integrate English and Hebrew explanations
3. Use a friendly, encouraging tone to build rapport and motivate learners
4. Incorporate visual formatting to highlight key concepts and corrective feedback
5. Provide relevant, contextualized examples and practice opportunities
6. Maintain a natural conversation flow while weaving in learning elements
7. Proactively guide the dialogue with questions, prompts, and follow-ups
8. Offer specific, actionable feedback and progress tracking
9. Use memory techniques and associations to aid retention
10. Create interactive, engaging learning experiences tailored to user interests

Conversation Flow:
1. Greet the user warmly and introduce yourself as their personal English tutor
2. Assess the user's proficiency level and language learning goals through casual conversation
3. Begin a natural dialogue on a topic of interest to the user, sharing your own experiences and insights
4. Consistently provide feedback on the user's English throughout the conversation, from the very beginning:
   - Identify and correct errors in grammar, vocabulary, syntax, and logic
   - Offer suggestions for improving pronunciation, word choice, and idiomatic expressions
   - Address spelling mistakes and provide correct spellings
   - Use a supportive, non-judgmental tone when offering corrections, focusing on growth and learning
5. As the user responds, restate their message with corrections, while praising their effort and progress
   - Provide a clear explanation of the language rule or pattern involved
   - Offer memorable examples or analogies to help the concept stick
6. Introduce relevant vocabulary, grammar, and usage tips in context, as they arise naturally in the conversation
   - Highlight key terms and provide Hebrew translations for clarity
   - Encourage the user to practice using the new language elements through targeted questions or prompts
7. Regularly check the user's understanding and comfort level, inviting them to share their thoughts and experiences
   - Validate their perspective and relate it back to the language concepts being discussed
   - Offer specific praise for their insights and progress, boosting their confidence
8. As the conversation progresses, provide periodic feedback on the user's overall performance and growth
   - Celebrate successes and milestones, no matter how small
   - Identify areas of significant improvement and patterns of strength
   - Gently point out recurring errors or challenges, and collaborate on strategies to overcome them
9. Introduce new challenges and learning opportunities based on the user's evolving proficiency level
   - Push their boundaries gradually, while maintaining a supportive and engaging dynamic
   - Provide scaffolding and guidance as needed, but encourage increasing independence
10. Continuously adapt to the user's needs, interests, and energy levels to maintain a caring, invested presence
    - Be responsive to their emotional state, offering encouragement or lighter topics as needed
    - Demonstrate genuine curiosity and interest in their lives, thoughts, and goals
    - Maintain an upbeat, friendly demeanor, using humor and warmth to create a positive learning environment
11. As you conclude each conversation, provide a clear summary of key language points and progress made
    - Highlight new vocabulary, grammar structures, or communication strategies mastered
    - Offer specific, achievable "homework" or practice tasks to reinforce learning between sessions
    - Preview upcoming topics or challenges to build anticipation and motivation
    - Schedule the next session and express your enthusiasm for their continued growth

Important: Every response should end with an open-ended question, reflective prompt, or engaging hook to propel the conversation forward naturally. Vary your prompts to maintain an authentic, dynamic dialogue.

Remember: Your goal is to create a warm, supportive bond with the user as you guide them on their English learning journey. 
Adapt to their unique needs, maintain an encouraging growth mindset, and always strive to make the experience engaging, meaningful, and empowering. 
Be a teacher, a mentor, and a friend.

${this.getLevelSpecificPrompt(userLevel)}

---------------------------------------------------------------
VERY VERY IMPORTANT - Answer using this exact format:

English: [Answer in English inside a brackets] 
Hebrew: [Answer in Hebrew inside a brackets]

Your response MUST precisely match this structure, including the brackets. 

At the beginning of the conversation, ask the user what topic they would like to talk about today.
---------------------------------------------------------------

`;
}

  private getLevelSpecificPrompt(userLevel: UserLevel): string {
    const avgLevel = this.calculateAverageLevel(userLevel);
    
    if (avgLevel <= 2) {
      return `
BEGINNER LEVEL ADAPTATIONS:
• Use simple sentence structures
• Provide extensive Hebrew explanations
• Focus on basic vocabulary
• Keep conversation pace slow
• Include frequent comprehension checks
• Offer step-by-step guidance`;
    } else if (avgLevel <= 3) {
      return `
INTERMEDIATE LEVEL ADAPTATIONS:
• Use moderately complex dialogue
• Balance English-Hebrew explanations
• Expand vocabulary range
• Natural conversation pace
• Include challenging exercises
• Analyze error patterns`;
    } else {
      return `
ADVANCED LEVEL ADAPTATIONS:
• Use sophisticated language
• Hebrew only for complex concepts
• Focus on nuanced expressions
• Native-like interaction pace
• Include cultural context
• Address subtle patterns`;
    }
  } */

  private buildEnhancedSystemPrompt(userLevel: UserLevel): string {
    this.userLevel = userLevel;
    const writingGuidelines = this.getWritingGuidelines(userLevel.writing);
    const grammarSyntaxGuidelines = this.getGrammarSyntaxGuidelines(userLevel.grammar);
    const vocabularyGuidelines = this.getVocabularyGuidelines(userLevel.vocabulary);
    const speakingGuidelines = this.getSpeakingGuidelines(userLevel.speaking);

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
    • Original: [user's text]
    • Corrected: [corrected version]
    • Changes explained:

  [specific correction 1]
  [specific correction 2]
  etc.

Follow up with relevant:
• Grammar explanations
• Usage examples
• Practice suggestions
• Continue natural conversation flow

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
  ${writingGuidelines}
  • Adapt writing tasks and feedback accordingly
  • Focus on appropriate complexity for this level
  • Provide suitable writing challenges and exercises
  
  Grammar & Syntax (Level ${userLevel.grammar}):
  ${grammarSyntaxGuidelines}
  • Introduce grammar concepts matching this level
  • Provide level-appropriate explanations
  • Focus on relevant grammatical structures
  
  Vocabulary (Level ${userLevel.vocabulary}):
  ${vocabularyGuidelines}
  • Introduce new words suitable for this level
  • Provide context-appropriate vocabulary
  • Build on existing knowledge
  
  Speaking (Level ${userLevel.speaking}):
  ${speakingGuidelines}
  • Adjust conversation pace to match ability
  • Focus on appropriate pronunciation challenges
  • Provide suitable speaking practice opportunities
  
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
  **bold** for emphasis
  *italic* for new terms
  ~~strikethrough~~ for mistakes
  __underline__ for grammar patterns
  
  | Column 1 | Column 2 |
  |----------|----------|
  | Content  | Content  |
  
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
  Format:
  📝 Rule Title
  • Explanation matching grammar level
  • Level-appropriate examples
  • Common mistakes at this level
  
  2. Usage (💡) - Adjust to Level ${userLevel.vocabulary}
  Format:
  💡 Usage Pattern
  • Context suitable for vocabulary level
  • Level-appropriate examples
  • Practice suggestions matching level
  
  3. Warning (⚠️) - Adapt to user's levels
  Format:
  ⚠️ Warning Type
  • Common mistakes at user's level
  • Level-appropriate corrections
  • Suitable memory tips
  
  4. Practice (🔄) - Match to skill levels
  Format:
  🔄 Practice Topic
  • Exercises matching each skill level
  • Level-appropriate examples
  • Targeted feedback
  
  5. Story-Based Learning (📚)
  Format:
  📚 Story Title
  • Level-appropriate narrative
  • Key vocabulary
  • Grammar focus
  • Comprehension questions
  • Cultural context
  
  6. Situational Practice (🎭)
  Format:
  🎭 Scenario Title
  • Real-life situation
  • Key expressions
  • Cultural notes
  • Practice dialogue
  • Feedback points
  
  7. Review & Reinforcement (📝)
  Format:
  📝 Review Topic
  • Previous concepts
  • Pattern recognition
  • Common errors
  • Progress check
  • Next steps
  
  Advanced Error Correction System:
  
  1. Error Pattern Recognition (🔍)
  Format:
  🔍 Error Pattern Analysis
  • Pattern Type: [Grammar/Vocabulary/Pronunciation/Structure]
  • Frequency: [High/Medium/Low]
  • Context: When this error typically occurs
  • Root Cause: Likely source of the error (e.g., L1 interference)
  
  2. Personalized Corrections (✍️)
  Format:
  ✍️ Correction Strategy
  • Original Error: ~~mistake~~
  • Correction: \`correct form\`
  • Explanation: Clear, level-appropriate explanation
  • Similar Examples: Related cases for pattern recognition
  • Prevention Tips: How to avoid this error in future
  
  3. Targeted Practice (🎯)
  Format:
  🎯 Focus Exercise
  • Error Type: Specific error being addressed
  • Practice Pattern: Structured exercise targeting the error
  • Application: Real-world usage examples
  • Self-Check: How to verify correct usage
  
  4. Error Tracking Matrix:
  | Error Category | Frequency | Progress | Status |
  |----------------|-----------|----------|---------|
  | L1 Interference| Track     | Weekly   | Active  |
  | Grammar Rules  | Track     | Weekly   | Active  |
  | Word Choice    | Track     | Weekly   | Active  |
  | Structure      | Track     | Weekly   | Active  |
  
  5. Feedback Integration:
  • Connect errors to specific skill levels
  • Track improvement over time
  • Provide positive reinforcement
  • Suggest targeted exercises
  • Link to relevant learning blocks
  
  Remember for Error Correction:
  1. Always maintain a constructive tone
  2. Focus on patterns rather than individual mistakes
  3. Provide clear, actionable feedback
  4. Connect corrections to existing knowledge
  5. Use examples that match the user's interests and level
  
  Progress Tracking System:
  
  1. Achievement Matrix
  🏆 Skill Progress
  | Skill Area  | Current | Target | Progress |
  |-------------|---------|---------|----------|
  | Speaking    | ${userLevel.speaking} | ${userLevel.speaking + 1} | Tracking |
  | Writing     | ${userLevel.writing} | ${userLevel.writing + 1} | Tracking |
  | Grammar     | ${userLevel.grammar} | ${userLevel.grammar + 1} | Tracking |
  | Vocabulary  | ${userLevel.vocabulary} | ${userLevel.vocabulary + 1} | Tracking |
  
  2. Feedback Framework:
  📊 Immediate Feedback
  • Real-time corrections
  • Pattern recognition
  • Improvement suggestions
  • Pronunciation guidance
  • Grammar adjustments
  • Vocabulary suggestions
  • Expression refinement
  
  📈 Session Summary
  • Key achievements
  • Areas for practice
  • Next session goals
  • Pattern observations
  • Areas for improvement
  • Practice recommendations
  
  3. Progress Indicators
  • Accuracy tracking
  • Fluency measurement
  • Complexity assessment
  • Confidence markers
  
  4. Motivation System:
  🏆 Achievements
  • Skill milestones
  • Complexity increases
  • Error reduction
  • Fluency improvements
  
  ⭐ Progress Celebrations
  • Level advancements
  • Pattern mastery
  • Vocabulary expansion
  • Grammar proficiency
  
  Additional Markdown Elements:
  🎯 Goals and Objectives
  📈 Progress Updates
  💡 Learning Tips
  ⭐ Achievements
  🔄 Practice Suggestions
  ⚠️ Common Mistakes
  📚 Learning Resources
  🌍 Cultural Notes
  
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
  8. Provide feedback targeted to each skill
  9. Use markdown formatting consistently
  10. Balance instruction with natural conversation
  11. Present corrections clearly and supportively
  12. Follow up corrections with relevant practice opportunities`;
  }




  private getCurrentErrorAnalysis(message: string, userLevel: UserLevel): string {
    // בדיקת שגיאות בהודעה הנוכחית
    const currentError = this.detectErrors(message);

    // אם אין שגיאות, מחזירים רק את הניתוח הכללי
    if (!currentError || !this.isValidSkill(currentError.skill, userLevel)) {
      return this.getGeneralErrorAnalysis(userLevel);
    }

    // אם יש שגיאה ספציפית, מוסיפים אותה לניתוח
    const level = userLevel[currentError.skill] as LevelType;
    return `${this.getGeneralErrorAnalysis(userLevel)}

Current Message Specific Error:
${this.getErrorAnalysisPrompt(currentError.type, level)}`;
  }

  private getGeneralErrorAnalysis(userLevel: UserLevel): string {
    return `
Grammar Analysis:
${this.getErrorAnalysisPrompt('grammar' as ErrorType, userLevel.grammar as LevelType)}

Vocabulary Analysis:
${this.getErrorAnalysisPrompt('vocabulary' as ErrorType, userLevel.vocabulary as LevelType)}

Structure Analysis:
${this.getErrorAnalysisPrompt('structure' as ErrorType, userLevel.writing as LevelType)}`;
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

Example Formats:
1. Conversation Response:
English: [
# Topic Title
Main content and explanation
- Key points
- Practice suggestions
]

Hebrew: [
• נקודות מרכזיות
• הסברים חשובים
]

2. Correction Format:
English: [
# Grammar Correction
~~Incorrect form~~ should be \`correct form\`
**Rule:** Explanation
]

Hebrew: [
• תיקון השגיאה
• הסבר הכלל
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

  private getWritingLevelPrompt(level: number): string {
    switch (level) {
      case 1:
        return "• Focus on basic sentence formation\n• Simple punctuation rules\n• Short, clear sentences\n• Basic paragraph structure";
      case 2:
        return "• Compound sentences\n• Basic paragraph organization\n• Simple connectors\n• Clear topic sentences";
      case 3:
        return "• Complex sentence structures\n• Paragraph development\n• Transition phrases\n• Coherent arguments";
      case 4:
        return "• Sophisticated writing style\n• Advanced organization\n• Nuanced expression\n• Academic writing skills";
      default:
        return "";
    }
  }

  private getGrammarLevelPrompt(level: number): string {
    switch (level) {
      case 1:
        return "• Basic tenses\n• Simple sentence structure\n• Essential articles\n• Basic pronouns";
      case 2:
        return "• Compound tenses\n• Basic conditionals\n• Comparative forms\n• Regular patterns";
      case 3:
        return "• Perfect tenses\n• All conditionals\n• Passive voice\n• Complex patterns";
      case 4:
        return "• Advanced tenses\n• Subtle distinctions\n• Idiomatic usage\n• Native-like patterns";
      default:
        return "";
    }
  }

  private getVocabularyLevelPrompt(level: number): string {
    switch (level) {
      case 1:
        return "• Basic everyday words\n• Simple phrases\n• Common expressions\n• Essential verbs";
      case 2:
        return "• Extended vocabulary\n• Common idioms\n• Topic-specific terms\n• Phrasal verbs";
      case 3:
        return "• Advanced vocabulary\n• Industry terms\n• Abstract concepts\n• Idiomatic expressions";
      case 4:
        return "• Sophisticated terms\n• Nuanced meanings\n• Academic vocabulary\n• Cultural references";
      default:
        return "";
    }
  }

  private getSpeakingLevelPrompt(level: number): string {
    switch (level) {
      case 1:
        return "• Basic pronunciation\n• Simple responses\n• Common phrases\n• Slow, clear speech";
      case 2:
        return "• Clear pronunciation\n• Short discussions\n• Topic responses\n• Moderate pace";
      case 3:
        return "• Natural intonation\n• Fluid discussion\n• Complex topics\n• Normal pace";
      case 4:
        return "• Native-like fluency\n• Advanced discussion\n• Any topic\n• Natural pace";
      default:
        return "";
    }
  }

  private getWritingGuidelines(level: number): string {
    switch (level) {
      case 1:
        return "Focus on basic writing skills, simple sentences, and clear communication";
      case 2:
        return "Develop paragraph structure, introduce compound sentences, and basic organization";
      case 3:
        return "Work on complex writing, essay structure, and coherent argumentation";
      case 4:
        return "Master sophisticated writing styles, academic writing, and creative expression";
      default:
        return "";
    }
  }

  private getGrammarSyntaxGuidelines(level: number): string {
    switch (level) {
      case 1:
        return "Cover essential grammar rules, basic tenses, and simple structures";
      case 2:
        return "Introduce intermediate grammar concepts, compound tenses, and basic conditionals";
      case 3:
        return "Focus on advanced grammar patterns, all tenses, and complex structures";
      case 4:
        return "Perfect advanced grammar usage, subtle distinctions, and native-like patterns";
      default:
        return "";
    }
  }

  private getVocabularyGuidelines(level: number): string {
    switch (level) {
      case 1:
        return "Build essential vocabulary for daily communication and basic needs";
      case 2:
        return "Expand vocabulary with common idioms and topic-specific terms";
      case 3:
        return "Develop advanced vocabulary including abstract concepts and professional terms";
      case 4:
        return "Master sophisticated vocabulary, nuanced meanings, and cultural references";
      default:
        return "";
    }
  }

  private getSpeakingGuidelines(level: number): string {
    switch (level) {
      case 1:
        return "Focus on basic communication, clear pronunciation, and simple conversations";
      case 2:
        return "Develop fluency in common situations, improve pronunciation, and build confidence";
      case 3:
        return "Practice complex discussions, natural intonation, and fluid conversation";
      case 4:
        return "Perfect native-like speaking, handle any topic, and master subtle expressions";
      default:
        return "";
    }
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

    return `
Error Focus for ${errorType} at Level ${level}:
• Common Patterns: ${errorCategories[errorType][level]?.join(', ') || 'No patterns defined'}
• Correction Strategy: ${this.getCorrectionStrategy(level)}
• Practice Focus: ${this.getPracticeFocus(errorType, level)}
    `;
  }

  private getCorrectionStrategy(level: number): string {
    const strategies: { [key: number]: string } = {
      1: "Immediate, direct correction with simple explanations",
      2: "Guided self-correction with hints and examples",
      3: "Pattern recognition and self-correction opportunities",
      4: "Subtle guidance and advanced error analysis"
    };
    return strategies[level] ?? strategies[1]; // Using nullish coalescing operator
  }

  private getPracticeFocus(errorType: string, level: number): string {
    // Implementation of practice focus based on error type and level
    // This would provide specific practice recommendations
    return `Level ${level} ${errorType} practice with appropriate exercises`;
  }


  // עדכון הפונקציה detectErrors
  private detectErrors(message: string): ErrorDetection | null {
    const grammarErrors = this.checkGrammarErrors(message);
    const vocabularyErrors = this.checkVocabularyErrors(message);
    const structureErrors = this.checkStructureErrors(message);

    if (grammarErrors) return { type: 'grammar', skill: 'grammar' };
    if (vocabularyErrors) return { type: 'vocabulary', skill: 'vocabulary' };
    if (structureErrors) return { type: 'structure', skill: 'writing' };

    return null;
  }

  private checkGrammarErrors(message: string): boolean {
    // בדיקות דקדוק בסיסיות - יש להרחיב
    const basicGrammarPatterns = [
      /\bi am going/i,  // should be "I am going"
      /\bi (is|are)/i,  // incorrect subject-verb agreement
      /\b(he|she|it) (are|am)\b/i,  // incorrect subject-verb agreement
      /\b(have|has) went\b/i,  // incorrect perfect tense
    ];

    return basicGrammarPatterns.some(pattern => pattern.test(message));
  }

  private checkVocabularyErrors(message: string): boolean {
    // בדיקות אוצר מילים בסיסיות - יש להרחיב
    const commonMisusedWords = [
      /\bmake (a|the) homework\b/i,  // should be "do homework"
      /\btake (a|the) decision\b/i,  // should be "make a decision"
      /\bsay (a|the) lie\b/i,  // should be "tell a lie"
    ];

    return commonMisusedWords.some(pattern => pattern.test(message));
  }

  private checkStructureErrors(message: string): boolean {
    // בדיקות מבנה בסיסיות - יש להרחיב
    const structurePatterns = [
      /^[a-z]/,  // sentence doesn't start with capital letter
      /[^.!?]$/,  // sentence doesn't end with punctuation
      /\s[.!?]/,  // space before punctuation
    ];

    return structurePatterns.some(pattern => pattern.test(message));
  }



  async sendEnhancedMessage(message: string, context: ServiceContext): Promise<EnhancedChatMessage> {
    try {
      // בניית היסטוריית ההודעות
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

      if (context.conversationContext.isFirstMessage) {
        messages.push({
          role: 'user',
          content: message
        });
        context.conversationContext.isFirstMessage = false;
      } else {
        // הוספת היסטוריית ההודעות הקודמות (לא כולל את ההודעה הנוכחית)
        const previousMessages = [...context.previousMessages];
        // מסירים את ההודעה האחרונה אם היא זהה להודעה הנוכחית
        if (previousMessages.length > 0 && 
            previousMessages[previousMessages.length - 1].english === message) {
          previousMessages.pop();
        }

        previousMessages.forEach(msg => {
          messages.push({
            role: msg.sender,
            content: msg.english
          });
        });

        // הוספת ההודעה הנוכחית
        messages.push({
          role: 'user',
          content: message
        });
      }

      // בניית הפרומפט המערכתי
      const systemPrompt = this.buildCurrentMessagePrompt(message, context);

      // שליחה ל-API דרך Backend
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
    } catch (error) {
      console.error('Error in enhanced Claude communication:', error);
      return {
        sender: 'assistant',
        timestamp: new Date(),
        english: "I'm having difficulty processing that. Could you please rephrase?",
        hebrew: "אני מתקשה לעבד את זה. האם תוכל לנסח מחדש?",
        learningBlocks: []
      };
    }
}

  // Helper function to validate skills
  isValidSkill(skill: string, userLevel: UserLevel): skill is keyof UserLevel {
    return skill in userLevel;
  }

  /*   private generateInstructions(writingLevel: number, grammarSyntaxLevel: number, vocabularyLevel: number, speakingLevel: number): string {
      const writingGuidelines = this.getWritingGuidelines(writingLevel);
      const grammarSyntaxGuidelines = this.getGrammarSyntaxGuidelines(grammarSyntaxLevel);
      const vocabularyGuidelines = this.getVocabularyGuidelines(vocabularyLevel);
      const speakingGuidelines = this.getSpeakingGuidelines(speakingLevel);
    
      const writingFeedback = this.getWritingFeedback(writingLevel);
      const grammarSyntaxFeedback = this.getGrammarSyntaxFeedback(grammarSyntaxLevel);
      const vocabularyFeedback = this.getVocabularyFeedback(vocabularyLevel);
      const speakingFeedback = this.getSpeakingFeedback(speakingLevel);
    
      return `You are an AI language assistant named Claude, created by Anthropic to conduct engaging English conversations while providing clear feedback and explanations in both English and Hebrew. Your purpose is to create a supportive, immersive learning environment that helps users improve their English language skills through natural interaction, practical examples, and structured learning elements.
  
  User's English Proficiency Levels:
  Writing: ${writingLevel}
  Grammar and Syntax: ${grammarSyntaxLevel}
  Vocabulary: ${vocabularyLevel}
  Speaking: ${speakingLevel}
  (1 - Beginner, 4 - Advanced)
  
  Key Principles:
  1. Adapt responses to the user's proficiency levels across categories:
     - Writing (Level ${writingLevel}): ${writingGuidelines}
     - Grammar and Syntax (Level ${grammarSyntaxLevel}): ${grammarSyntaxGuidelines}
     - Vocabulary (Level ${vocabularyLevel}): ${vocabularyGuidelines}
     - Speaking (Level ${speakingLevel}): ${speakingGuidelines}
  2. Seamlessly integrate English and Hebrew explanations, adjusting the ratio based on the user's levels
  3. Use a friendly, encouraging tone to build rapport and motivate the learner at their current level
  4. Incorporate visual formatting to highlight key concepts and corrective feedback
  5. Provide relevant, contextualized examples and practice opportunities tailored to the user's levels
  6. Maintain a natural conversation flow while weaving in level-appropriate learning elements
  7. Proactively guide the dialogue with questions, prompts, and follow-ups suited to the user's levels
  8. Offer specific, actionable feedback and progress tracking relative to the user's starting proficiencies
  9. Use memory techniques and associations to aid retention, adapting to the user's levels
  10. Create interactive, engaging learning experiences that align with the user's interests and proficiencies
  
  Conversation Flow:
  1. Greet the user warmly and introduce yourself as their personal English tutor
  2. Begin a natural conversation with markdown formatting:
     - Use **bold** for important terms or emphasis
     - Use *italic* for new vocabulary or subtle emphasis
     - Use \`code\` for spelling corrections
     - Use ~~strikethrough~~ for mistakes to be corrected
     - Use __underline__ for grammar patterns
     
     Include level-appropriate corrections and feedback:
     - Writing (Level ${writingLevel}): ${writingFeedback}
     - Grammar and Syntax (Level ${grammarSyntaxLevel}): ${grammarSyntaxFeedback}
     - Vocabulary (Level ${vocabularyLevel}): ${vocabularyFeedback}
     - Speaking (Level ${speakingLevel}): ${speakingFeedback}
  
  3. Provide corrective feedback using markdown:
     - Spelling: "~~recieve~~ \`receive\`"
     - Vocabulary: "The word *crucial* means very important"
     - Grammar: "__Subject + have/has + past participle__"
     - Important rules: "**Remember to use past tense**"
  
  4. Maintain consistent formatting for:
     - New vocabulary: *word*
     - Corrections: ~~mistake~~ \`correction\`
     - Grammar patterns: __pattern__
     - Important points: **point**
  
  ---------------------------------------------------------------
  VERY VERY IMPORTANT - Answer using this exact format:
  
  English: [
  Your English response here with clear line breaks between paragraphs.
  Use a blank line between each separate thought or idea.
  Use markdown formatting:
  - **bold** for emphasis
  - *italic* for new terms
  - \`code\` for corrections
  - ~~strikethrough~~ for mistakes
  ]
  
  Hebrew: [
  התשובה שלך בעברית עם שורות ריקות בין פסקאות.
  השאר שורה ריקה בין כל רעיון או מחשבה נפרדים.
  השתמש בעיצוב מרקדאון:
  - **מודגש** להדגשה
  - *נטוי* למונחים חדשים
  - \`קוד\` לתיקונים
  - ~~קו חוצה~~ לטעויות
  ]
  ---------------------------------------------------------------
  
  Remember: Your goal is to create a warm, supportive bond with the user as you guide them on their English learning journey. Continuously adapt to their unique needs, proficiency levels across categories, and learning style to ensure an engaging, meaningful, and empowering experience. Be a teacher, a mentor, and a friend.`;
    } */

  /* // Helper functions to get guidelines and feedback based on proficiency levels
  private getWritingGuidelines(level: number): string {
    switch (level) {
      case 1:
        return 'Focus on basic sentence structure, punctuation, and capitalization. Provide guidance on writing simple, clear sentences. Offer feedback on common writing errors and help the user build foundational writing skills.';
      case 2:
        return 'Provide guidance on organizing ideas, using transitional phrases, and varying sentence structures. Offer feedback on common writing errors and help the user develop self-editing skills.';
      case 3:
        return 'Encourage the use of advanced grammar structures, complex sentence formations, and sophisticated vocabulary. Provide feedback on refining style, tone, and coherence in writing.';
      case 4:
        return 'Focus on refining nuance, style, and voice in writing. Provide feedback on subtle errors and help the user achieve native-like written fluency. Encourage experimentation with different writing styles and genres.';
      default:
        return '';
    }
  }
  
  private getGrammarSyntaxGuidelines(level: number): string {
    switch (level) {
      case 1:
        return 'Focus on basic grammar rules, such as subject-verb agreement, verb tenses, and word order. Provide clear explanations and examples. Offer feedback on common grammatical errors.';
      case 2:
        return 'Introduce more complex grammar concepts, such as conditionals, modals, and gerunds. Provide practice opportunities and feedback on errors. Help the user develop a strong grammatical foundation.';
      case 3:
        return 'Encourage the use of advanced grammar structures, such as passive voice, subjunctive mood, and complex tenses. Provide feedback on refining grammar usage and help the user achieve grammatical accuracy.';
      case 4:
        return 'Focus on mastering nuanced grammar points, idiomatic expressions, and colloquialisms. Provide feedback on subtle errors and help the user achieve native-like grammatical fluency.';
      default:
        return '';
    }
  }
  
  private getVocabularyGuidelines(level: number): string {
    switch (level) {
      case 1:
        return 'Focus on building a foundation of common, high-frequency words. Provide clear definitions, examples, and translations. Encourage the use of new words in context.';
      case 2:
        return 'Expand vocabulary range to include more specific and academic terms. Provide practice opportunities for using new words in various contexts. Offer feedback on word choice and collocations.';
      case 3:
        return 'Encourage the use of sophisticated, low-frequency words and idiomatic expressions. Provide feedback on refining word choice, connotations, and register.';
      case 4:
        return 'Focus on mastering nuanced vocabulary, phrasal verbs, and colloquialisms. Provide feedback on subtle errors and help the user achieve native-like vocabulary fluency.';
      default:
        return '';
    }
  }
  
  private getSpeakingGuidelines(level: number): string {
    switch (level) {
      case 1:
        return 'Focus on basic pronunciation, intonation, and stress patterns. Provide clear explanations and examples. Offer feedback on common pronunciation errors and help the user build speaking confidence.';
      case 2:
        return 'Encourage the use of more complex language structures and vocabulary in speaking. Provide practice opportunities for fluency and accuracy. Offer feedback on errors and help the user develop conversational skills.';
      case 3:
        return 'Focus on refining pronunciation, intonation, and stress patterns for advanced vocabulary and structures. Provide feedback on errors and help the user achieve near-native spoken fluency.';
      case 4:
        return 'Encourage the use of colloquialisms, idiomatic expressions, and natural speech patterns. Provide feedback on subtle errors and help the user achieve native-like spoken fluency. Focus on mastering nuance, register, and cultural appropriateness in speaking.';
      default:
        return '';
    }
  } */

  /* private getWritingFeedback(level: number): string {
    switch (level) {
      case 1:
        return 'Provide immediate feedback on basic writing errors, such as sentence structure, punctuation, and capitalization. Offer suggestions for improving clarity and coherence. Encourage the user to practice writing simple, clear sentences.';
      case 2:
        return 'Offer feedback on organizing ideas effectively, using transitional phrases, and varying sentence structures. Help the user identify and correct common writing errors. Provide guidance on developing self-editing skills.';
      case 3:
        return 'Give feedback on the use of advanced grammar structures, complex sentence formations, and sophisticated vocabulary. Offer suggestions for refining style, tone, and coherence in writing. Encourage the user to experiment with different writing techniques.';
      case 4:
        return 'Provide detailed feedback on nuance, style, and voice in writing. Help the user identify and correct subtle errors. Offer suggestions for achieving native-like written fluency and developing a unique writing style.';
      default:
        return '';
    }
  }

  private getGrammarSyntaxFeedback(level: number): string {
    switch (level) {
      case 1:
        return 'Provide immediate feedback on basic grammar errors, such as subject-verb agreement, verb tenses, and word order. Offer clear explanations and examples to help the user understand and correct their mistakes.';
      case 2:
        return 'Give feedback on the use of more complex grammar structures, such as conditionals, modals, and gerunds. Help the user identify and correct common grammatical errors. Provide practice opportunities to reinforce correct usage.';
      case 3:
        return 'Offer feedback on the use of advanced grammar structures, such as passive voice, subjunctive mood, and complex tenses. Help the user refine their grammar usage and achieve greater accuracy. Provide targeted exercises to address specific areas of improvement.';
      case 4:
        return 'Provide detailed feedback on nuanced grammar points, idiomatic expressions, and colloquialisms. Help the user identify and correct subtle grammatical errors. Offer suggestions for achieving native-like grammatical fluency.';
      default:
        return '';
    }
  }

  private getVocabularyFeedback(level: number): string {
    switch (level) {
      case 1:
        return 'Provide feedback on the use of basic, high-frequency words. Offer suggestions for using new words in context. Help the user understand word meanings, translations, and usage.';
      case 2:
        return 'Give feedback on the use of more specific and academic vocabulary. Help the user identify and correct errors in word choice and collocations. Provide practice opportunities for using new words in various contexts.';
      case 3:
        return 'Offer feedback on the use of sophisticated, low-frequency words and idiomatic expressions. Help the user refine their word choice, connotations, and register. Provide targeted exercises to expand vocabulary range.';
      case 4:
        return 'Provide detailed feedback on nuanced vocabulary, phrasal verbs, and colloquialisms. Help the user identify and correct subtle vocabulary errors. Offer suggestions for achieving native-like vocabulary fluency.';
      default:
        return '';
    }
  }

  private getSpeakingFeedback(level: number): string {
    switch (level) {
      case 1:
        return 'Provide immediate feedback on basic pronunciation, intonation, and stress patterns. Offer clear explanations and examples to help the user understand and correct their mistakes. Encourage the user to practice speaking with confidence.';
      case 2:
        return 'Give feedback on the use of more complex language structures and vocabulary in speaking. Help the user identify and correct errors in fluency and accuracy. Provide practice opportunities for developing conversational skills.';
      case 3:
        return 'Offer feedback on the refinement of pronunciation, intonation, and stress patterns for advanced vocabulary and structures. Help the user achieve near-native spoken fluency. Provide targeted exercises to address specific areas of improvement.';
      case 4:
        return 'Provide detailed feedback on the use of colloquialisms, idiomatic expressions, and natural speech patterns. Help the user identify and correct subtle spoken errors. Offer suggestions for achieving native-like spoken fluency and mastering nuance, register, and cultural appropriateness.';
      default:
        return '';
    }
  } */

  /*   async sendEnhancedMessage(
      message: string,
      context: ServiceContext
    ): Promise<EnhancedChatMessage> {
      const systemPrompt = this.buildEnhancedSystemPrompt(context.userLevel);
      console.log(systemPrompt);
      try {
        // Handle conversation history
      const messages = [];
  
      if (context.conversationContext.isFirstMessage) {
        messages.push({
          role: 'user' as const,
          content: "Hello."
        });
          context.conversationContext.isFirstMessage = false;
      } else {
        // Add previous messages
        context.previousMessages.forEach(msg => {
          messages.push({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.english
          });
        });
  
        // Add current message
        messages.push({
          role: 'user' as const,
          content: message
        });
      }
  
        const response = await this.anthropic.messages.create({
          model: 'claude-3-sonnet-20240229',
          system: systemPrompt,
          messages,
          max_tokens: 1024,
          temperature: 0.7
        });
  
        if (!response.content || response.content.length === 0) {
          throw new Error('No content in response');
        }
  
        return this.parseClaudeResponse(response);
  
      } catch (error) {
        console.error('Error in enhanced Claude communication:', error);
        return {
          sender: 'assistant',
          timestamp: new Date(),
          english: "I'm having difficulty processing that. Could you please rephrase?",
          hebrew: "אני מתקשה לעבד את זה. האם תוכל לנסח מחדש?",
          learningBlocks: []
        };
      }
    } */

  private parseContent(content: string): { english: string; hebrew: string } {
    try {
      // Split content at Hebrew: marker
      const [englishPart = '', hebrewPart = ''] = content.split('Hebrew:');

      // For English part: remove 'English:' prefix and get everything between outermost brackets
      let english = englishPart
        .replace('English:', '')
        .trim();

      // Check if content starts and ends with brackets
      if (english.startsWith('[') && english.endsWith(']')) {
        english = english.slice(1, -1).trim();
      }

      // For Hebrew part: get content between brackets
      const hebrewMatch = hebrewPart.match(/\[([\s\S]*?)\]/);
      const hebrew = hebrewMatch ? hebrewMatch[1].trim() : '';

      return { english, hebrew };
    } catch (error) {
      console.error('Error parsing content:', error);
      return { english: '', hebrew: '' };
    }
  }

  private parseClaudeResponse(response: any): EnhancedChatMessage {
    if (!response.content?.[0] || response.content[0].type !== 'text') {
      throw new Error('Invalid response format from Claude');
    }

    const content = response.content[0].text;
    console.log('Original content:', content);

    const { english, hebrew } = this.parseContent(content);
    console.log('Parsed English:', english);
    console.log('Parsed Hebrew:', hebrew);

    const message: EnhancedChatMessage = {
      sender: 'assistant',
      timestamp: new Date(),
      english: english,
      hebrew: hebrew,
      learningBlocks: []
    };

    // Parse learning blocks with proper typing
    const blocks: string[] = content.match(/[📝💡⚠️🔄][^\n]+/g) || [];
    blocks.forEach((block: string) => {
      const parsedBlock = this.parseLearningBlock(block);
      if (parsedBlock) {
        message.learningBlocks?.push(parsedBlock);
      }
    });

    return message;
  }

  // Make sure parseLearningBlock is properly typed
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
          let [eng, heb] = this.separateLanguages(exampleText);
          examples.push({ english: eng, hebrew: heb || '' });
        } else if (/[\u0590-\u05FF]/.test(line)) {
          if (isExample) {
            if (examples.length > 0) {
              examples[examples.length - 1].hebrew = line;
            }
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
        content: {
          english: english || title,
          hebrew: hebrew || ''
        },
        ...(examples.length > 0 && { examples })
      };

    } catch (error) {
      console.error('Error parsing learning block:', error);
      return null;
    }
  }

  // מטפל בדיבור עם תור ומניעת התנגשויות
  private async handleTTS(message: string): Promise<void> {
    try {
      // מחלק לחלקים קטנים
      const chunks = message.match(/.{1,200}(?=\s|$)/g) || [];

      // מוסיף לתור
      this.speechQueue.push(...chunks);

      // אם לא מדבר כרגע, מתחיל את התור
      if (!this.isSpeaking) {
        await this.processQueue();
      }
    } catch (error) {
      console.error('Error in TTS:', error);
    }
  }

  private getTTSOptionsForLevel(userLevel: UserLevel): TTSOptions {
    // Calculate weighted average with emphasis on speaking level
    const weightedAverage = (
      (userLevel.speaking * 2) +  // Double weight for speaking
      userLevel.vocabulary +
      userLevel.grammar
    ) / 4;  // Divide by total weights (2 + 1 + 1 = 4)

    const options: TTSOptions = {
      ...this.defaultTTSOptions
    };

    // Adjust rate based on speaking proficiency and overall level
    if (userLevel.speaking <= 2) {
      options.rate = 0.7 + (weightedAverage * 0.1); // 0.7-0.9 range for beginners
      options.pitch = 1.0;
      options.volume = 1.0;
    } else if (userLevel.speaking <= 3) {
      options.rate = 0.8 + (weightedAverage * 0.1); // 0.8-1.0 range for intermediates
      options.pitch = 1.0;
      options.volume = 1.0;
    } else {
      options.rate = 0.9 + (weightedAverage * 0.1); // 0.9-1.1 range for advanced
      options.pitch = 1.0;
      options.volume = 1.0;
    }

    // Select appropriate voice based on user level
    if (this.voices.length > 0) {
      options.voice = this.getBestVoiceForLevel(userLevel);
    }

    return options;
  }

  // Get the appropriate TTS voice based on user level and gender preference
  private getBestVoiceForLevel(userLevel: UserLevel): SpeechSynthesisVoice | undefined {
    const voices = this.getAvailableVoices();
    if (voices.length === 0) return undefined;

    // Filter voices by gender preference
    const preferredVoices = this.filterVoicesByGender(voices, this.defaultTTSOptions.preferredGender);

    if (preferredVoices.length === 0) return voices[0]; // Fallback to any voice if no preferred gender found

    // For beginners, prefer clear and slower voices
    if (userLevel.speaking <= 2) {
      return preferredVoices.find(voice =>
        voice.name.toLowerCase().includes('clear') ||
        voice.name.toLowerCase().includes('precise')
      ) || preferredVoices[0];
    }

    // For intermediate and advanced, use standard voices
    return preferredVoices.find(voice => voice.default) || preferredVoices[0];
  }

  // Helper method to filter voices by gender
  private filterVoicesByGender(voices: SpeechSynthesisVoice[], preferredGender?: 'female' | 'male'): SpeechSynthesisVoice[] {
    if (!preferredGender) return voices;

    const femaleIndicators = ['female', 'woman', 'girl', 'samantha', 'victoria', 'karen', 'moira', 'tessa'];
    const maleIndicators = ['male', 'man', 'guy', 'daniel', 'david', 'james', 'john', 'peter'];

    const indicators = preferredGender === 'female' ? femaleIndicators : maleIndicators;

    return voices.filter(voice =>
      indicators.some(indicator =>
        voice.name.toLowerCase().includes(indicator) ||
        voice.voiceURI.toLowerCase().includes(indicator)
      )
    );
  }

  // Method to set voice gender preference
  setVoiceGender(gender: 'female' | 'male'): void {
    this.defaultTTSOptions.preferredGender = gender;
    // Update voice based on new gender preference
    const newVoice = this.getBestVoiceForLevel(this.userLevel);
    if (newVoice) {
      this.updateTTSOptions({ voice: newVoice });
    }
  }

  // Get current voice gender preference
  getVoiceGender(): 'female' | 'male' | undefined {
    return this.defaultTTSOptions.preferredGender;
  }
  // Utility methods for TTS control
  pauseSpeech(): void {
    this.speechSynthesis.pause();
  }

  resumeSpeech(): void {
    this.speechSynthesis.resume();
  }

  stopSpeech(): void {
    this.speechSynthesis.cancel();
  }

  // Method to get available voices
  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices.filter(voice => voice.lang.startsWith('en'));
  }

  // Method to update TTS options
  updateTTSOptions(options: TTSOptions): void {
    this.defaultTTSOptions = {
      ...this.defaultTTSOptions,
      ...options
    };
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

  /*  private calculateAverageLevel(userLevel: UserLevel): number {
     const sum = Object.values(userLevel).reduce((acc: number, val: number) => acc + val, 0);
     return Number((sum / Object.keys(userLevel).length).toFixed(2));
   }
  */
  private extractContent(section: string): string {
    return section.replace(/^(English:|Hebrew:)/, '').trim();
  }
  private extractBlockTitle(line: string): string {
    return line.replace(/^[📝💡⚠️🔄]\s*/, '').trim();
  }


  private parseInitialLayer(layer: string): { english: string; hebrew: string } {
    // Extract content between bold markers for English
    const englishMatches = layer.match(/\*\*(.*?)\*\*/g) || [];
    const english = englishMatches
      .map(match => match.replace(/\*\*/g, ''))
      .join(' ');

    // Extract Hebrew content (text with Hebrew characters)
    const hebrewParts = layer
      .split(/\s+/)
      .filter(word => /[\u0590-\u05FF]/.test(word));
    const hebrew = hebrewParts.join(' ');

    return { english, hebrew };
  }

  private parseLearningBlocks(layer: string): LearningBlock[] {
    const blocks: LearningBlock[] = [];
    const blockSections = layer.split(/(?=📝|💡|⚠️|🔄)/);

    blockSections.forEach(section => {
      if (!section.match(/^[📝💡⚠️🔄]/)) return;

      try {
        const type = this.getLearningBlockType(section);
        const lines = section.split('\n').map(line => line.trim()).filter(Boolean);
        const title = this.extractBlockTitle(lines[0]);
        const contentLines = lines.slice(1);

        const { english, hebrew, examples } = this.parseBlockContent(contentLines);

        blocks.push({
          type,
          title,
          content: { english, hebrew },
          ...(examples.length > 0 && { examples })
        });
      } catch (error) {
        console.error('Error parsing learning block:', error);
      }
    });

    return blocks;
  }

  private parseBlockContent(lines: string[]): {
    english: string;
    hebrew: string;
    examples: Array<{ english: string; hebrew: string }>;
  } {
    let english = '';
    let hebrew = '';
    const examples: Array<{ english: string; hebrew: string }> = [];

    lines.forEach(line => {
      if (line.startsWith('Example:') || line.startsWith('*')) {
        const [exEnglish, exHebrew] = this.separateLanguages(
          line.replace(/^(Example:|\*)/i, '').trim()
        );
        examples.push({ english: exEnglish, hebrew: exHebrew });
      } else if (line.startsWith('(')) {
        // Hebrew explanation in parentheses
        hebrew = line.replace(/[()]/g, '').trim();
      } else {
        const [eng, heb] = this.separateLanguages(line);
        if (!english) english = eng;
        if (!hebrew && heb) hebrew = heb;
      }
    });

    return { english, hebrew, examples };
  }

  private parseProgressLayer(layer: string): {
    metrics: ProgressMetrics;
    focusAreas: FocusArea[];
  } | null {
    try {
      const lines = layer.split('\n');
      const metrics: ProgressMetrics = {
        speaking: { score: 0, accuracy: 0, fluency: 0 },
        writing: { score: 0, structure: 0, style: 0 },
        grammar: { score: 0, accuracy: 0, range: 0 },
        vocabulary: { score: 0, active: 0, passive: 0 }
      };
      const focusAreas: FocusArea[] = [];

      lines.forEach(line => {
        // Parse metrics
        if (line.includes('Speaking')) {
          const matches = line.match(/Accuracy: (\d+)%.*Fluency: (\d+)%/);
          if (matches) {
            metrics.speaking.accuracy = parseInt(matches[1]);
            metrics.speaking.fluency = parseInt(matches[2]);
          }
        }
        // Add similar parsing for other metrics...

        // Parse focus areas
        if (line.startsWith('Priority')) {
          const [priority, description] = line.split(':').map(s => s.trim());
          const [english, hebrew] = this.separateLanguages(description);
          focusAreas.push({
            priority: parseInt(priority.replace('Priority', '')),
            description: { english, hebrew },
            status: 0 // Default status
          });
        }
      });

      return { metrics, focusAreas };
    } catch (error) {
      console.error('Error parsing progress layer:', error);
      return null;
    }
  }

  private formatEnhancedHistory(messages: EnhancedChatMessage[]): Array<{
    role: MessageRole;
    content: string;
  }> {
    return messages.map((msg: EnhancedChatMessage) => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.english
    }));
  }


  private parseProgressUpdate(section: string): {
    metrics: ProgressMetrics;
    focusAreas: FocusArea[];
  } {
    // Implementation of progress metrics parsing
    // This would parse the 📊 Skill Progress section and convert it to the appropriate format
    // ... (implementation details)
    return {
      metrics: {
        speaking: { score: 0, accuracy: 0, fluency: 0 },
        writing: { score: 0, structure: 0, style: 0 },
        grammar: { score: 0, accuracy: 0, range: 0 },
        vocabulary: { score: 0, active: 0, passive: 0 }
      },
      focusAreas: []
    };
  }

  private extractExamples(text: string): Array<{ english: string; hebrew: string }> {
    const examples = text.match(/\*([^*]+)\*/g) || [];
    return examples.map(example => {
      const [english, hebrew] = example.replace(/\*/g, '').split(/(?=[\u0590-\u05FF])/);
      return {
        english: english?.trim() || '',
        hebrew: hebrew?.trim() || ''
      };
    });
  }
}