// נוסיף שירות חדש לתקשורת עם Claude API
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ClaudeApiService } from './claude-api.service';

import { Observable } from 'rxjs';

interface ClaudeAPIResponse {
  content: Array<{
    text: string;
    type: string;
  }>;
  role: string;
  model: string;
}

type MessageRole = 'user' | 'assistant';
type MessageParam = {
  role: MessageRole;
  content: string;
};

// Define types for the response content blocks
interface TextBlock {
  type: 'text';
  text: string;
}

interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    media_type: string;
    data: string;
  };
}

// Union type for all possible content block types
type ContentBlock = TextBlock | ImageBlock;

// ראשית, נגדיר טיפוסים מדויקים יותר למשוב
interface FeedbackItem {
  type: 'grammar' | 'vocabulary' | 'pronunciation';
  message: {
      english: string;
      hebrew: string;
  };
  suggestion?: {
      english: string;
      hebrew: string;
      example?: string;
  };
  importance: 'high' | 'medium' | 'low';
  context?: string;
}



// הגדרת הממשק הבסיסי של הודעה בצ'אט
interface ChatMessage {
  // מזהה השולח - משתמש או מערכת
  sender: 'user' | 'assistant';

  // תוכן ההודעה באנגלית (חובה)
  english: string;

  // תרגום לעברית (אופציונלי)
  hebrew?: string;

  // מערך של משובים על ההודעה (אופציונלי)
  feedback?: {
    // סוג המשוב (דקדוק, אוצר מילים, או הגייה)
    type: 'grammar' | 'vocabulary' | 'pronunciation';

    // הודעת המשוב בשתי השפות
    message: {
      english: string;
      hebrew: string;
    };

    // הצעה לשיפור (אופציונלי)
    suggestion?: string;
  }[];

  // חותמת זמן של ההודעה
  timestamp: Date;
}

// הגדרת הטיפוסים בצורה מסודרת
interface UserLevel {
  speaking: number;
  writing: number;
  grammar: number;
  vocabulary: number;
}


// קודם כל, נגדיר את המבנה שאנחנו מצפים לקבל מ-Claude
interface ClaudeResponse {
  content: string;
  role: string;
  type: string;
  // שדות נוספים שעשויים להגיע מהשרת...
}


// הגדרת השירות שמתקשר עם Claude API
@Injectable({
  providedIn: 'root'
})
export class ClaudeService {
  constructor(private http: HttpClient, private claudeApi: ClaudeApiService) {}

/**
 * מחשבת את הרמה הממוצעת של המשתמש באנגלית
 * @param userLevel - אובייקט המכיל את רמות המיומנות השונות של המשתמש
 * @returns מספר בין 1 ל-4 המייצג את הרמה הממוצעת
 */
calculateAverageLevel(userLevel: UserLevel): number {
  // ראשית, נוודא שקיבלנו אובייקט תקין
  if (!userLevel || typeof userLevel !== 'object') {
      console.error('calculateAverageLevel: Invalid userLevel object provided');
      return 1; // מחזירים רמה בסיסית במקרה של שגיאה
  }

  // נחלץ את כל הרמות מהאובייקט
  const { speaking, writing, grammar, vocabulary } = userLevel;

  // ניצור מערך של כל הרמות שנרצה לחשב
  const levels: number[] = [speaking, writing, grammar, vocabulary];

  try {
      // נחשב את סכום כל הנקודות תוך כדי ביצוע בדיקות תקינות
      const totalPoints = levels.reduce((sum, level) => {
          // נוודא שהערך הוא מספר תקין
          if (typeof level !== 'number' || isNaN(level)) {
              throw new Error(`Invalid level value encountered: ${level}`);
          }

          // נוודא שהערך נמצא בטווח המותר
          if (level < 1 || level > 4) {
              throw new Error(`Level value out of range: ${level}. Must be between 1 and 4`);
          }

          return sum + level;
      }, 0);

      // נחשב את הממוצע
      const average = totalPoints / levels.length;

      // נעגל את התוצאה לשתי ספרות אחרי הנקודה העשרונית
      return Number(average.toFixed(2));

  } catch (error) {
      // במקרה של שגיאה, נתעד אותה ונחזיר ערך ברירת מחדל
      console.error('Error in calculateAverageLevel:', error);
      return 1;
  }
}

/**
 * מייצר הנחיות ספציפיות לרמת המשתמש עבור Claude
 * @param userLevel - אובייקט המכיל את רמות המיומנות של המשתמש
 * @returns מחרוזת עם הנחיות מפורטות מותאמות לרמה
 */
private getLevelSpecificInstructions(userLevel: UserLevel): string {
  const averageLevel = this.calculateAverageLevel(userLevel);

  // הנחיות בסיסיות שחלות על כל הרמות
  let baseInstructions = `
      When responding, follow these core principles:
      
      Response Structure:
      Your responses should always include three main components:
      1. An English response appropriate to the user's level
      2. A Hebrew translation that maintains the meaning while being natural
      3. Educational feedback when applicable, focusing on improvement opportunities
      
      Conversation Flow:
      - Maintain natural conversation while providing educational support
      - Ask follow-up questions to encourage further practice
      - Address errors gently and constructively
      - Build on previous interactions to create learning continuity
  `;

  // הנחיות ספציפיות בהתאם לרמה
  if (averageLevel <= 2) {
      return baseInstructions + `
          For Beginner Level (${averageLevel}):

          Language Complexity:
          - Use simple, everyday vocabulary that beginners are likely to know
          - Keep sentences short and straightforward
          - Avoid idioms and complex grammatical structures
          - Use present tense primarily, introducing past tense gradually
          
          Educational Support:
          - Provide comprehensive Hebrew translations for all English content
          - Break down complex ideas into smaller, manageable parts
          - Offer clear examples for new vocabulary or grammar patterns
          - Use repetition to reinforce learning
          
          Conversation Topics:
          - Focus on daily life situations (family, hobbies, routine)
          - Use concrete rather than abstract concepts
          - Keep questions simple and direct
          - Provide multiple choice options when appropriate
          
          Feedback Approach:
          - Prioritize building confidence over perfect grammar
          - Focus on one or two key improvements at a time
          - Always start with positive reinforcement
          - Provide simple, actionable suggestions for improvement
      `;
  } else if (averageLevel <= 3) {
      return baseInstructions + `
          For Intermediate Level (${averageLevel}):

          Language Complexity:
          - Introduce more varied vocabulary gradually
          - Use compound sentences and basic complex structures
          - Begin incorporating common idioms with explanations
          - Practice different tenses and modal verbs
          
          Educational Support:
          - Provide Hebrew translations for challenging concepts
          - Encourage self-correction before offering solutions
          - Explain grammar patterns when relevant
          - Connect new learning to previously mastered concepts
          
          Conversation Topics:
          - Expand to broader topics (current events, opinions, experiences)
          - Encourage longer, more detailed responses
          - Ask open-ended questions
          - Practice hypothetical situations
          
          Feedback Approach:
          - Balance fluency with accuracy
          - Highlight patterns in errors for focused improvement
          - Suggest alternative expressions and structures
          - Encourage self-reflection on language use
      `;
  } else {
      return baseInstructions + `
          For Advanced Level (${averageLevel}):

          Language Complexity:
          - Use sophisticated vocabulary and complex structures
          - Incorporate idiomatic expressions naturally
          - Explore nuanced meanings and connotations
          - Practice all tenses and advanced grammar patterns
          
          Educational Support:
          - Provide Hebrew translations only for highly specific or technical terms
          - Focus on style and register in addition to accuracy
          - Encourage precise word choice and expression
          - Discuss linguistic nuances and cultural context
          
          Conversation Topics:
          - Engage in abstract and theoretical discussions
          - Explore complex topics requiring critical thinking
          - Encourage debate and detailed argumentation
          - Practice professional and academic language use
          
          Feedback Approach:
          - Focus on refinement and sophistication
          - Address subtle errors and style improvements
          - Encourage advanced language features
          - Provide detailed analysis of language choices
      `;
  }
}

// נעדכן את פונקציית הפרסור כדי לטפל במשוב בצורה מקיפה יותר
/* private parseClaudeResponse(content: string): {
  english: string;
  hebrew: string;
  feedback?: FeedbackItem[];
} {
  // נחלק את התוכן לסקציות ברורות
  const sections = content.split(/(?=English:|Hebrew:|Feedback:)/i);
  
  let english = '';
  let hebrew = '';
  let feedbackItems: FeedbackItem[] = [];

  for (const section of sections) {
      const trimmedSection = section.trim();

      if (trimmedSection.startsWith('English:')) {
          english = trimmedSection.replace('English:', '').trim();
      }
      else if (trimmedSection.startsWith('Hebrew:')) {
          hebrew = trimmedSection.replace('Hebrew:', '').trim();
      }
      else if (trimmedSection.startsWith('Feedback:')) {
          // מחלצים את המשוב המפורט
          const feedbackContent = trimmedSection.replace('Feedback:', '').trim();
          
          // נפרסר את המשוב למבנה מסודר
          feedbackItems = this.parseFeedbackContent(feedbackContent);
      }
  }

  return {
      english: english || 'No English content provided',
      hebrew: hebrew || 'לא סופק תוכן בעברית',
      feedback: feedbackItems.length > 0 ? feedbackItems : undefined
  };
}
 */
private parseFeedbackContent(feedbackContent: string): FeedbackItem[] {
  // נפצל את המשוב לפריטים נפרדים (אם יש כמה)
  const feedbackPoints = feedbackContent.split(/(?=\d+\.|\*)/);
  const feedbackItems: FeedbackItem[] = [];

  for (const point of feedbackPoints) {
      if (!point.trim()) continue;

      // ננסה לזהות את סוג המשוב
      const type = this.identifyFeedbackType(point);
      
      // נחלץ את ההודעה באנגלית ובעברית
      const messageParts = point.split('Hebrew explanation:');
      
      const feedbackItem: FeedbackItem = {
          type,
          message: {
              english: messageParts[0].replace(/^\d+\.\s*|\*\s*/, '').trim(),
              hebrew: messageParts[1]?.trim() || 'תרגום חסר למשוב זה'
          },
          importance: this.determineFeedbackImportance(point)
      };

      // נחפש הצעות לשיפור
      const suggestionMatch = point.match(/Suggestion:\s*([^]*?)(?=\n|$)/i);
      if (suggestionMatch) {
          const [englishSuggestion, hebrewSuggestion] = suggestionMatch[1].split('|').map(s => s.trim());
          feedbackItem.suggestion = {
              english: englishSuggestion,
              hebrew: hebrewSuggestion || 'תרגום חסר להצעה'
          };

          // נחפש דוגמה אם יש
          const exampleMatch = point.match(/Example:\s*([^]*?)(?=\n|$)/i);
          if (exampleMatch) {
              feedbackItem.suggestion.example = exampleMatch[1].trim();
          }
      }

      feedbackItems.push(feedbackItem);
  }

  return feedbackItems;
}

private identifyFeedbackType(feedback: string): 'grammar' | 'vocabulary' | 'pronunciation' {
  const lowerFeedback = feedback.toLowerCase();
  
  if (lowerFeedback.includes('grammar') || 
      lowerFeedback.includes('structure') || 
      lowerFeedback.includes('tense')) {
      return 'grammar';
  }
  
  if (lowerFeedback.includes('vocabulary') || 
      lowerFeedback.includes('word choice') || 
      lowerFeedback.includes('expression')) {
      return 'vocabulary';
  }
  
  if (lowerFeedback.includes('pronunciation') || 
      lowerFeedback.includes('sound') || 
      lowerFeedback.includes('accent')) {
      return 'pronunciation';
  }

  // ברירת מחדל לדקדוק אם לא זוהה סוג ספציפי
  return 'grammar';
}

private determineFeedbackImportance(feedback: string): 'high' | 'medium' | 'low' {
  const lowerFeedback = feedback.toLowerCase();
  
  // נקבע את החשיבות לפי מילות מפתח וההקשר
  if (lowerFeedback.includes('critical') || 
      lowerFeedback.includes('important') || 
      lowerFeedback.includes('major')) {
      return 'high';
  }
  
  if (lowerFeedback.includes('minor') || 
      lowerFeedback.includes('subtle') || 
      lowerFeedback.includes('slight')) {
      return 'low';
  }

  return 'medium';
}

private buildSystemPrompt(userLevel: UserLevel): string {
  const basePrompt = `
        You are an English teaching assistant. Please structure your feedback in the following detailed format:

        English: [Your main response in English]
        Hebrew: [Hebrew translation of your response]
        Feedback: [If needed, provide structured feedback as follows]
        
        For each feedback point:
        1. Start with the type (Grammar/Vocabulary/Pronunciation)
        2. Provide the feedback in English
        3. Add "Hebrew explanation:" followed by the Hebrew translation
        4. If applicable, add "Suggestion:" followed by the improvement in English | and its Hebrew translation
        5. Optionally add "Example:" with a demonstrative example
        
        Example feedback structure:
        1. Grammar: Your sentence structure could be improved.
        Hebrew explanation: מבנה המשפט שלך יכול להשתפר
        Suggestion: Try rearranging the words like this... | נסה לסדר את המילים כך...
        Example: "I tomorrow will go" → "I will go tomorrow"

        Make sure each feedback point is clear, constructive, and includes both languages.
    `;

    // חישוב הרמה הממוצעת
    const avgLevel = this.calculateAverageLevel(userLevel);

    // בניית ההנחיה הבסיסית שמגדירה את התפקיד והמטרה
    let systemPrompt = `
        You are an English teaching assistant focused on conducting natural conversations while providing educational support. 
        Your goal is to help users practice and improve their English through engaging dialogue.

        Key Guidelines:
        1. Always respond in both English and Hebrew
        2. Structure your responses in this format:
           - Main response in English
           - Hebrew translation below
           - Educational feedback when relevant
           - Suggestions for improvement when needed

        Core Teaching Principles:
        - Build confidence through encouragement
        - Provide gentle, constructive corrections
        - Maintain natural conversation flow
        - Adapt language complexity to user level
        - Use real-life contexts and examples
    `.trim();

    // הוספת הנחיות ספציפיות בהתאם לרמת המשתמש
    if (avgLevel <= 2) {
      systemPrompt += `
            For Beginner Level Communication:
            - Use basic vocabulary and simple sentence structures
            - Focus on everyday topics and practical situations
            - Break down complex ideas into simple parts
            - Provide more detailed Hebrew explanations
            - Encourage basic response patterns
            - Use familiar contexts (daily routines, hobbies, family)
            - Offer positive reinforcement frequently
            - Keep sentences short and clear
            - Repeat key phrases in different contexts
        `;
    } else if (avgLevel <= 3) {
      systemPrompt += `
            For Intermediate Level Communication:
            - Use moderate vocabulary with some challenging words
            - Introduce more complex sentence structures gradually
            - Explore broader topics and abstract concepts
            - Balance English learning with natural conversation
            - Encourage longer responses and detailed explanations
            - Introduce idiomatic expressions with explanations
            - Guide self-correction through hints
            - Mix casual and formal language styles
            - Challenge the user to expand their responses
        `;
    } else {
      systemPrompt += `
            For Advanced Level Communication:
            - Use sophisticated vocabulary and complex structures
            - Engage in deep, nuanced discussions
            - Focus on subtle language distinctions
            - Minimize Hebrew translations except for complex concepts
            - Encourage critical thinking and detailed analysis
            - Discuss abstract and theoretical topics
            - Use advanced idiomatic expressions
            - Focus on style and tone in communication
            - Challenge the user with complex questions
        `;
    }

    // הוספת הנחיות לגבי המשוב החינוכי
    systemPrompt += `
        Feedback Guidelines:
        1. Educational Feedback:
           - Identify patterns in errors
           - Explain corrections clearly
           - Provide alternative expressions
           - Share relevant grammar rules
           - Give examples of proper usage

        2. Conversation Management:
           - Keep the dialogue natural and engaging
           - Ask follow-up questions to deepen discussion
           - Allow the user to express themselves fully
           - Provide conversation scaffolding when needed
           - Maintain topic relevance while allowing natural flow

        3. Progress Support:
           - Acknowledge improvements
           - Suggest areas for practice
           - Provide specific learning tips
           - Encourage self-reflection
           - Celebrate successful communication
    `;

    // הנחיות לגבי התאמה תרבותית ורגישות
    systemPrompt += `
        Cultural and Personal Sensitivity:
        - Respect cultural contexts
        - Use culturally appropriate examples
        - Maintain professional boundaries
        - Be patient and supportive
        - Adapt to user interests and needs
    `;

    return basePrompt + this.getLevelSpecificInstructions(userLevel);
  }

// פונקציית עזר לעיבוד התשובה מ-Claude למבנה הודעה שלנו
/* private processClaudeResponse(response: any): ChatMessage {
  // נניח שהתשובה מ-Claude מגיעה במבנה מוסכם
  const { english, hebrew, feedback } = this.parseClaudeResponse(response);

  return {
      sender: 'assistant',
      english,
      hebrew,
      feedback,
      timestamp: new Date()
  };
}
 */
// פונקציית עזר לפירוק התשובה מ-Claude
/* private parseClaudeResponse(response: any): {
  english: string;
  hebrew: string;
  feedback?: ChatMessage['feedback'];
} {
  // כאן נוסיף לוגיקה לפירוק התשובה המובנית מ-Claude
  // לדוגמה: פיצול התשובה לחלקים של אנגלית, עברית ומשוב
  
  try {
      // נניח שהתשובה מ-Claude מגיעה בפורמט JSON מובנה
      const parsedContent = JSON.parse(response.content);
      return {
          english: parsedContent.english,
          hebrew: parsedContent.hebrew,
          feedback: parsedContent.feedback
      };
  } catch (error) {
      // במקרה של שגיאה בפירוק, נחזיר תשובה בסיסית
      return {
          english: response.content,
          hebrew: 'תרגום לא זמין',
      };
  }
}
 */
// פונקציה לפירוק התוכן של התשובה מ-Claude
/* private parseClaudeContent(content: string): {
  english: string;
  hebrew: string;
  feedback?: Array<{
      type: 'grammar' | 'vocabulary' | 'pronunciation';
      message: { english: string; hebrew: string };
      suggestion?: string;
  }>;
} {
  try {
      // במקרה שהתשובה כבר מגיעה בפורמט JSON
      if (this.isJsonString(content)) {
          return JSON.parse(content);
      }

      // אחרת, נצטרך לפרסר את הטקסט ידנית
      // נניח שהתשובה מגיעה בפורמט מוסכם עם Claude:
      // English: [תוכן באנגלית]
      // Hebrew: [תוכן בעברית]
      // Feedback: [משוב אם קיים]

      const sections = content.split('\n\n');
      const parsedContent: any = {
          english: '',
          hebrew: '',
          feedback: []
      };

      sections.forEach(section => {
          if (section.startsWith('English:')) {
              parsedContent.english = section.replace('English:', '').trim();
          } else if (section.startsWith('Hebrew:')) {
              parsedContent.hebrew = section.replace('Hebrew:', '').trim();
          } else if (section.startsWith('Feedback:')) {
              const feedbackText = section.replace('Feedback:', '').trim();
              if (feedbackText) {
                  parsedContent.feedback.push({
                      type: 'grammar', // ברירת מחדל
                      message: {
                          english: feedbackText,
                          hebrew: '' // נוכל להוסיף תרגום אם נדרש
                      }
                  });
              }
          }
      });

      // אם אין משוב, נסיר את המערך הריק
      if (parsedContent.feedback.length === 0) {
          delete parsedContent.feedback;
      }

      return parsedContent;

  } catch (error) {
      console.error('Error parsing Claude response:', error);
      // במקרה של שגיאה, נחזיר מבנה בסיסי עם הודעת שגיאה
      return {
          english: 'I apologize, but I encountered an error processing the response.',
          hebrew: 'אני מתנצל, אך נתקלתי בשגיאה בעיבוד התשובה.',
      };
  }
} */

// פונקציית עזר לבדיקה האם מחרוזת היא JSON תקין
private isJsonString(str: string): boolean {
  try {
      JSON.parse(str);
      return true;
  } catch (e) {
      return false;
  }
}

/* async sendMessage(
  message: string,
  context: { userLevel: UserLevel; previousMessages: ChatMessage[] }
): Promise<ChatMessage> {
  const systemPrompt = this.buildSystemPrompt(context.userLevel);
  const conversationHistory = this.formatConversationHistory(context.previousMessages);

  try {
    const response = await this.http.post<ClaudeAPIResponse>(
      'https://api.anthropic.com/v1/messages',
      {
        model: "claude-sonnet-4-5-20250929",
        messages: [
          {
            role: "user",
            content: systemPrompt
          },
          ...conversationHistory,
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 1024,
        temperature: 0.7,
        system: "You are an English teaching assistant focused on helping users improve their English through natural conversation while providing educational support in both English and Hebrew."
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.API_KEY,
          'anthropic-version': '2024-02-29'
        }
      }
    ).toPromise();

    if (!response || !response.content) {
      throw new Error('Invalid response from Claude API');
    }

    // מחלצים את התוכן מהתשובה
    const content = response.content[0].text;
    
    // מפרסרים את התשובה למבנה הרצוי
    const parsedResponse = this.parseClaudeResponse(content);

    return {
      sender: 'assistant',
      english: parsedResponse.english,
      hebrew: parsedResponse.hebrew,
      feedback: parsedResponse.feedback,
      timestamp: new Date()
    };

  } catch (error) {
    console.error('Error communicating with Claude:', error);
    throw new Error('Failed to get response from Claude');
  }
} */

// First, let's define the exact type expected by the API


async sendMessage(
  message: string,
  context: { userLevel: UserLevel; previousMessages: ChatMessage[] }
): Promise<ChatMessage> {
  try {
    // Build an enhanced system prompt that encourages interactive learning
    const systemPrompt = `
      You are an English teaching assistant focused on creating an interactive learning experience.
      Follow these guidelines for every response:

      1. Start with a natural conversation response in English
      2. Provide a Hebrew translation
      3. If relevant, highlight any learning opportunities:
         - Grammar patterns used
         - Interesting vocabulary
         - Common expressions
      4. Add a practice component:
         - Give an example related to the conversation
         - Ask a follow-up question that encourages using similar patterns
      
      Format your response as:
      English: [Conversational response]
      Hebrew: [Translation]
      Learn: [If applicable, learning points]
      Practice: [Example and follow-up question]

      ${this.buildSystemPrompt(context.userLevel)}
    `;

    // Create messages array with enhanced context
    const formattedMessages: MessageParam[] = [];

    // Add conversation history
    context.previousMessages.forEach(msg => {
      const role: MessageRole = msg.sender === 'user' ? 'user' : 'assistant';
      formattedMessages.push({
        role,
        content: msg.english
      });
    });

    // Add current message
    formattedMessages.push({
      role: 'user' as MessageRole,
      content: message
    });

    // Make API call with enhanced prompt via backend
    const response = await this.claudeApi.createMessage({
      model: 'claude-sonnet-4-5-20250929',
      system: systemPrompt,
      messages: formattedMessages,
      max_tokens: 1024,
      temperature: 0.7
    });

    // Extract and process response
    let responseText = '';
    if (response.content && response.content.length > 0) {
      const textBlock = response.content.find(
        (block): block is TextBlock => block.type === 'text'
      );

      if (textBlock) {
        responseText = textBlock.text;
      } else {
        throw new Error('No text content found in response');
      }
    }

    // Parse response maintaining the enhanced structure
    const parsedResponse = this.parseEnhancedResponse(responseText);

    return {
      sender: 'assistant',
      english: parsedResponse.english,
      hebrew: parsedResponse.hebrew,
      feedback: parsedResponse.feedback,
      timestamp: new Date()
    };

  } catch (error) {
    console.error('Error communicating with Claude:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to communicate with Claude: ${error.message}`);
    }
    throw new Error('Failed to communicate with Claude: Unknown error');
  }
}

private parseEnhancedResponse(content: string): {
  english: string;
  hebrew: string;
  feedback?: Array<{
    type: 'grammar' | 'vocabulary' | 'pronunciation';
    message: { english: string; hebrew: string };
  }>;
} {
  const sections = content.split(/(?=English:|Hebrew:|Learn:|Practice:)/i);
  let english = '';
  let hebrew = '';
  const feedbackItems: Array<{
    type: 'grammar' | 'vocabulary' | 'pronunciation';
    message: { english: string; hebrew: string };
  }> = [];

  sections.forEach(section => {
    const trimmedSection = section.trim();
    
    if (trimmedSection.startsWith('English:')) {
      english = trimmedSection.replace('English:', '').trim();
    } 
    else if (trimmedSection.startsWith('Hebrew:')) {
      hebrew = trimmedSection.replace('Hebrew:', '').trim();
    }
    else if (trimmedSection.startsWith('Learn:')) {
      const learningPoints = trimmedSection.replace('Learn:', '').trim();
      // Add learning points as feedback
      feedbackItems.push({
        type: 'grammar',
        message: {
          english: learningPoints,
          hebrew: this.translateLearningPoints(learningPoints)
        }
      });
    }
    else if (trimmedSection.startsWith('Practice:')) {
      const practice = trimmedSection.replace('Practice:', '').trim();
      // Add practice suggestions as feedback
      feedbackItems.push({
        type: 'vocabulary',
        message: {
          english: practice,
          hebrew: this.translatePractice(practice)
        }
      });
    }
  });

  return {
    english,
    hebrew,
    feedback: feedbackItems.length > 0 ? feedbackItems : undefined
  };
}

private translateLearningPoints(points: string): string {
  // Implement translation logic for learning points
  // This could be enhanced with a more sophisticated translation mechanism
  return `נקודות למידה: ${points}`;
}

private translatePractice(practice: string): string {
  // Implement translation logic for practice suggestions
  return `תרגול: ${practice}`;
}

  // Helper function to parse Claude's response into our expected format
  /* private parseClaudeResponse(content: string): {
    english: string;
    hebrew: string;
    feedback?: Array<{
      type: 'grammar' | 'vocabulary' | 'pronunciation';
      message: { english: string; hebrew: string };
    }>;
  } {
    // Extract the main sections using regex
    const englishMatch = content.match(/English:\s*([\s\S]*?)(?=Hebrew:|$)/i);
    const hebrewMatch = content.match(/Hebrew:\s*([\s\S]*?)(?=Feedback:|$)/i);
    const feedbackMatch = content.match(/Feedback:\s*([\s\S]*?)$/i);
  
    // Extract English and Hebrew content
    const english = englishMatch 
      ? englishMatch[1].trim() 
      : 'No English content provided';
      
    const hebrew = hebrewMatch 
      ? hebrewMatch[1].trim() 
      : 'לא סופק תוכן בעברית';
  
    // Parse feedback if present
    let feedback = undefined;
    if (feedbackMatch) {
      const feedbackContent = feedbackMatch[1].trim();
      
      if (feedbackContent) {
        // Split feedback into separate points
        const feedbackPoints = feedbackContent
          .split(/(?=\d+\.|•|\*)/g)
          .filter(point => point.trim().length > 0);
  
        feedback = feedbackPoints.map(point => {
          // Clean up the point text
          const cleanPoint = point.replace(/^\d+\.|\*|•/, '').trim();
  
          // Determine feedback type based on content
          let type: 'grammar' | 'vocabulary' | 'pronunciation' = 'grammar';
          if (cleanPoint.toLowerCase().includes('vocabulary') || 
              cleanPoint.toLowerCase().includes('word')) {
            type = 'vocabulary';
          } else if (cleanPoint.toLowerCase().includes('pronunciation') || 
                    cleanPoint.toLowerCase().includes('sound')) {
            type = 'pronunciation';
          }
  
          // Split feedback into English and Hebrew parts
          const [englishFeedback, hebrewFeedback] = this.separateLanguages(cleanPoint);
  
          return {
            type,
            message: {
              english: englishFeedback,
              hebrew: hebrewFeedback
            }
          };
        });
      }
    }
  
    return {
      english,
      hebrew,
      feedback
    };
  } */
  
  // Helper function to separate English and Hebrew text
  /* private separateLanguages(text: string): [string, string] {
    // Common separators between languages
    const separators = [
      ' - ',
      ' | ',
      ': ',
      'Hebrew:',
      'העברית:'
    ];
  
    // Try to split by common separators
    for (const separator of separators) {
      if (text.includes(separator)) {
        const [englishPart, hebrewPart] = text.split(separator);
        if (englishPart && hebrewPart) {
          return [englishPart.trim(), hebrewPart.trim()];
        }
      }
    }
  
    // Check for Hebrew text using Unicode range
    const hebrewRegex = /[\u0590-\u05FF]/;
    if (hebrewRegex.test(text)) {
      const parts = text.split(/(?=[\u0590-\u05FF])/).map(part => part.trim());
      if (parts.length >= 2) {
        return [parts[0], parts.slice(1).join(' ')];
      }
    }
  
    // Default case: return original text as English with a note in Hebrew
    return [text, 'נדרש תרגום לעברית'];
  } */

/* private formatConversationHistory(messages: ChatMessage[]): Array<{role: string; content: string}> {
    // ממירים את ההיסטוריה לפורמט שהמערכת מצפה לו
    return messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        // משתמשים רק בתוכן האנגלי להיסטוריה
        content: msg.english
    }));
}
 */
/* private parseClaudeResponse(content: string): {
  english: string;
  hebrew: string;
  feedback?: Array<{
      type: 'grammar' | 'vocabulary' | 'pronunciation';
      message: { english: string; hebrew: string };
  }>;
} {
  // מציאת החלקים הראשיים של התשובה
  const englishMatch = content.match(/English:\s*([\s\S]*?)(?=Hebrew:|$)/i);
  const hebrewMatch = content.match(/Hebrew:\s*([\s\S]*?)(?=Feedback:|$)/i);
  const feedbackMatch = content.match(/Feedback:\s*([\s\S]*?)$/i);

  // חילוץ התוכן באנגלית ובעברית
  const english = englishMatch ? englishMatch[1].trim() : 'No English content found';
  const hebrew = hebrewMatch ? hebrewMatch[1].trim() : 'לא נמצא תוכן בעברית';

  // טיפול במשוב
  let feedback = undefined;
  if (feedbackMatch) {
      const feedbackContent = feedbackMatch[1].trim();
      
      // אם יש תוכן משוב, נפרסר אותו
      if (feedbackContent) {
          // נפצל את המשוב לנקודות נפרדות (מפרידים לפי מספרים או נקודות)
          const feedbackPoints = feedbackContent.split(/(?=\d+\.|•|\*)/g)
              .filter(point => point.trim().length > 0);

          feedback = feedbackPoints.map(point => {
              // ננקה את הטקסט מסימני פיסוק מיותרים
              const cleanPoint = point.replace(/^\d+\.|\*|•/, '').trim();

              // נזהה את סוג המשוב לפי מילות מפתח
              let type: 'grammar' | 'vocabulary' | 'pronunciation' = 'grammar';
              if (cleanPoint.toLowerCase().includes('vocabulary') || 
                  cleanPoint.toLowerCase().includes('word')) {
                  type = 'vocabulary';
              } else if (cleanPoint.toLowerCase().includes('pronunciation') || 
                        cleanPoint.toLowerCase().includes('sound')) {
                  type = 'pronunciation';
              }

              // נפריד בין המשוב באנגלית לעברית
              const [englishFeedback, hebrewFeedback] = this.separateLanguages(cleanPoint);

              return {
                  type,
                  message: {
                      english: englishFeedback,
                      hebrew: hebrewFeedback
                  }
              };
          });
      }
  }

  return {
      english,
      hebrew,
      feedback
  };
}


* מפריד את הטקסט לחלק באנגלית ובעברית
* מחפש סימנים מקובלים להפרדה בין השפות

private separateLanguages(text: string): [string, string] {
  // מחפשים סימנים נפוצים להפרדה בין אנגלית לעברית
  const separators = [
      ' - ',
      ' | ',
      ': ',
      'Hebrew:',
      'העברית:'
  ];

  for (const separator of separators) {
      if (text.includes(separator)) {
          const [englishPart, hebrewPart] = text.split(separator);
          if (englishPart && hebrewPart) {
              return [englishPart.trim(), hebrewPart.trim()];
          }
      }
  }

  // אם לא מצאנו הפרדה ברורה, נבדוק אם יש טקסט בעברית
  const hebrewRegex = /[\u0590-\u05FF]/;
  if (hebrewRegex.test(text)) {
      // נניח שהטקסט העברי מופיע אחרי הטקסט האנגלי
      const parts = text.split(/(?=[\u0590-\u05FF])/).map(part => part.trim());
      if (parts.length >= 2) {
          return [parts[0], parts.slice(1).join(' ')];
      }
  }

  // אם לא מצאנו חלוקה ברורה, נחזיר את כל הטקסט כאנגלית עם הערה בעברית
  return [text, 'נדרש תרגום לעברית'];
}

private formatConversationHistory(messages: ChatMessage[]): Array<{ role: string; content: string }> {
  return messages.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'assistant',
    content: msg.english
  }));
} */

  // פונקציה לשליחת הודעה ל-Claude ועיבוד התשובה
/*   async sendMessage(
    message: string,
    context: { userLevel: UserLevel, previousMessages: ChatMessage[] }
  ): Promise<ChatMessage> {
    // בניית ההנחיה המערכתית ל-Claude
    const systemPrompt = this.buildSystemPrompt(context.userLevel);

    // בניית ההיסטוריה של השיחה בפורמט המתאים ל-Claude
    const conversationHistory = this.formatConversationHistory(context.previousMessages);

    try {
      // שליחת הבקשה ל-Claude API
      const response = await this.http.post(this.API_URL, {
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1000,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          ...conversationHistory,
          {
            role: "user",
            content: message
          }
        ]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }).toPromise();

      // עיבוד התשובה מ-Claude למבנה הודעה מתאים
      return this.processClaudeResponse(response);

    } catch (error) {
      console.error('Error communicating with Claude:', error);
      throw new Error('Failed to get response from Claude');
    }
  }
 */
  // פונקציית עזר להמרת היסטוריית השיחה לפורמט המתאים ל-Claude
 /*  private formatConversationHistory(messages: ChatMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.english
    }));
  } */
}