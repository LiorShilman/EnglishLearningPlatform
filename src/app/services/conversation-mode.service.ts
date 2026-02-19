import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ConversationMode } from '../shared/interfaces/english-learning.interfaces';

@Injectable({ providedIn: 'root' })
export class ConversationModeService {
  private selectedMode$ = new BehaviorSubject<ConversationMode | null>(null);
  readonly currentMode$ = this.selectedMode$.asObservable();

  private readonly MODES: ConversationMode[] = [
    {
      id: 'free',
      nameEn: 'Free Conversation',
      nameHe: 'שיחה חופשית',
      descriptionEn: 'Chat freely about any topic you choose',
      descriptionHe: 'שוחח בחופשיות על כל נושא שתבחר',
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B8CDE" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="rgba(123,140,222,0.12)"/></svg>`,
      systemPromptAddition: '',
      welcomeMessageEn: '',
      welcomeMessageHe: '',
      suggestedTopics: []
    },
    {
      id: 'job-interview',
      nameEn: 'Job Interview',
      nameHe: 'ראיון עבודה',
      descriptionEn: 'Practice interview questions and professional vocabulary',
      descriptionHe: 'תרגול שאלות ראיון ואוצר מילים מקצועי',
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#70C1B3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" fill="rgba(112,193,179,0.12)"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`,
      systemPromptAddition: `CONVERSATION MODE: Job Interview Practice
You are conducting a realistic practice job interview with the user.
- Ask one interview question at a time, starting with "Tell me about yourself"
- Progress through: personal intro → strengths/weaknesses → behavioral questions → situational questions
- After each answer, provide feedback on content quality, grammar, and professional vocabulary
- Suggest better phrasing using business English
- Include relevant professional vocabulary in BLOCKS
- Match question difficulty to the user's level
- Be encouraging but honest about areas to improve`,
      welcomeMessageEn: `Welcome to **Job Interview Practice**!\n\nI'll be your interviewer today. I'll ask you realistic interview questions and help you:\n- Answer confidently in professional English\n- Use appropriate business vocabulary\n- Structure your responses clearly\n\nLet's begin! Imagine you're walking into the interview room...`,
      welcomeMessageHe: `ברוך הבא ל**תרגול ראיון עבודה**!\n\nאני אהיה המראיין שלך. אשאל שאלות ראיון ואעזור לך:\n- לענות בביטחון באנגלית מקצועית\n- להשתמש באוצר מילים עסקי\n- לבנות תשובות בצורה ברורה`,
      suggestedTopics: ['Tell me about yourself', 'What are your strengths?', 'Why do you want this job?']
    },
    {
      id: 'travel',
      nameEn: 'Travel & Airport',
      nameHe: 'טיסה ושדה תעופה',
      descriptionEn: 'Practice travel scenarios — airport, hotel, directions',
      descriptionHe: 'תרגול מצבי טיסה, מלון והתמצאות',
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFB997" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" fill="rgba(255,185,151,0.12)"/></svg>`,
      systemPromptAddition: `CONVERSATION MODE: Travel & Airport
Simulate real travel situations with the user.
- Role-play as different characters: check-in agent, flight attendant, hotel receptionist, taxi driver, local guide
- Create realistic scenarios: booking, check-in, customs, asking directions, ordering at restaurants
- Teach travel-specific vocabulary and common phrases
- Practice polite requests, asking for help, and handling problems (delays, lost luggage)
- Include useful travel expressions in BLOCKS
- Gradually increase complexity based on user's level`,
      welcomeMessageEn: `Welcome to **Travel & Airport** practice!\n\nLet's practice real travel situations. I'll play different roles — airport staff, hotel receptionist, locals — to help you:\n- Navigate airports and hotels confidently\n- Ask for directions and handle problems\n- Learn essential travel vocabulary\n\nWhere would you like to start? Imagine you just arrived at the airport...`,
      welcomeMessageHe: `ברוך הבא ל**תרגול טיסה ושדה תעופה**!\n\nנתרגל מצבי טיסה אמיתיים. אמלא תפקידים שונים — צוות שדה תעופה, פקיד מלון, מקומיים — כדי לעזור לך:\n- להתמצא בשדות תעופה ומלונות\n- לבקש עזרה ולהתמודד עם בעיות\n- ללמוד אוצר מילים חיוני לטיסות`,
      suggestedTopics: ['Check in at the airport', 'Ask for directions in a new city', 'Book a hotel room']
    },
    {
      id: 'restaurant',
      nameEn: 'Restaurant',
      nameHe: 'מסעדה והזמנה',
      descriptionEn: 'Practice ordering food, reading menus, and dining',
      descriptionHe: 'תרגול הזמנת אוכל, קריאת תפריט וסעודה',
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B6A4CE" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" fill="rgba(182,164,206,0.12)"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`,
      systemPromptAddition: `CONVERSATION MODE: Restaurant & Ordering
Simulate restaurant and food-related situations.
- Role-play as waiter/waitress taking orders
- Present realistic menus and daily specials
- Practice: making reservations, ordering food and drinks, asking about ingredients, requesting the check
- Teach food vocabulary, polite dining expressions, and cultural tips
- Handle situations: dietary restrictions, complaints, splitting the bill
- Include food and dining vocabulary in BLOCKS`,
      welcomeMessageEn: `Welcome to **Restaurant** practice!\n\nI'll be your waiter today. Let's practice:\n- Reading menus and asking about dishes\n- Ordering food and drinks politely\n- Handling special requests and the bill\n\nGood evening! Welcome to our restaurant. Would you like to see the menu?`,
      welcomeMessageHe: `ברוך הבא ל**תרגול מסעדה**!\n\nאני אהיה המלצר שלך. נתרגל:\n- קריאת תפריט ושאלות על מנות\n- הזמנת אוכל ושתייה בנימוס\n- טיפול בבקשות מיוחדות ובחשבון`,
      suggestedTopics: ['Order dinner for two', 'Ask about vegetarian options', 'Make a reservation']
    },
    {
      id: 'business',
      nameEn: 'Business Meeting',
      nameHe: 'פגישה עסקית',
      descriptionEn: 'Practice professional meetings and presentations',
      descriptionHe: 'תרגול פגישות מקצועיות ומצגות',
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B8CDE" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4" fill="rgba(123,140,222,0.12)"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      systemPromptAddition: `CONVERSATION MODE: Business Meeting
Simulate professional business meeting scenarios.
- Role-play as colleague, manager, or client in a meeting
- Practice: opening meetings, presenting ideas, discussing proposals, negotiating, closing meetings
- Teach formal business language, meeting vocabulary, and professional expressions
- Cover: agreeing/disagreeing politely, asking for clarification, summarizing action items
- Include business vocabulary and professional phrases in BLOCKS
- Gradually introduce more complex negotiation scenarios`,
      welcomeMessageEn: `Welcome to **Business Meeting** practice!\n\nLet's practice professional meeting scenarios. I'll play different roles to help you:\n- Present ideas clearly and professionally\n- Use formal business language\n- Negotiate and discuss proposals confidently\n\nLet's start a meeting. What topic would you like to discuss?`,
      welcomeMessageHe: `ברוך הבא ל**תרגול פגישה עסקית**!\n\nנתרגל תרחישי פגישות מקצועיות. אמלא תפקידים שונים כדי לעזור לך:\n- להציג רעיונות בבהירות ובמקצועיות\n- להשתמש בשפה עסקית פורמלית\n- לנהל משא ומתן בביטחון`,
      suggestedTopics: ['Present a new project idea', 'Discuss quarterly results', 'Negotiate a deal']
    },
    {
      id: 'doctor',
      nameEn: 'Doctor Visit',
      nameHe: 'ביקור רופא',
      descriptionEn: 'Practice medical conversations and health vocabulary',
      descriptionHe: 'תרגול שיחות רפואיות ואוצר מילים בריאותי',
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#70C1B3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/><circle cx="12" cy="12" r="10" fill="rgba(112,193,179,0.06)" stroke="none"/></svg>`,
      systemPromptAddition: `CONVERSATION MODE: Doctor Visit
Simulate medical appointment scenarios.
- Role-play as a doctor or receptionist
- Practice: describing symptoms, answering medical questions, understanding diagnoses, discussing treatment
- Teach body parts, symptoms, medical terms, and health-related vocabulary
- Cover: making appointments, explaining pain/discomfort, understanding prescriptions
- Include medical vocabulary and useful health phrases in BLOCKS
- Be sensitive and supportive while teaching`,
      welcomeMessageEn: `Welcome to **Doctor Visit** practice!\n\nI'll be your doctor today. Let's practice:\n- Describing symptoms and how you feel\n- Understanding medical advice\n- Learning health and body vocabulary\n\nHello! I'm Dr. Smith. What brings you in today?`,
      welcomeMessageHe: `ברוך הבא ל**תרגול ביקור רופא**!\n\nאני אהיה הרופא שלך. נתרגל:\n- תיאור תסמינים ואיך אתה מרגיש\n- הבנת עצות רפואיות\n- לימוד אוצר מילים בריאותי`,
      suggestedTopics: ['Describe a headache', 'Schedule a check-up', 'Ask about medication']
    },
    {
      id: 'shopping',
      nameEn: 'Shopping',
      nameHe: 'קניות',
      descriptionEn: 'Practice shopping — stores, prices, returns',
      descriptionHe: 'תרגול קניות, מחירים והחזרות',
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFB997" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" fill="rgba(255,185,151,0.1)"/></svg>`,
      systemPromptAddition: `CONVERSATION MODE: Shopping
Simulate shopping scenarios in various stores.
- Role-play as shop assistant in different stores: clothing, electronics, grocery, market
- Practice: asking about products, comparing items, asking prices, negotiating, making returns
- Teach shopping vocabulary: sizes, colors, materials, prices, discounts
- Cover: trying on clothes, asking for recommendations, complaining about defects
- Include shopping expressions and vocabulary in BLOCKS`,
      welcomeMessageEn: `Welcome to **Shopping** practice!\n\nI'll be your shop assistant. Let's practice:\n- Asking about products and prices\n- Comparing items and making decisions\n- Returns, exchanges, and negotiations\n\nHello! Welcome to our store. Can I help you find anything?`,
      welcomeMessageHe: `ברוך הבא ל**תרגול קניות**!\n\nאני אהיה המוכר שלך. נתרגל:\n- שאלות על מוצרים ומחירים\n- השוואת פריטים וקבלת החלטות\n- החזרות, החלפות ומשא ומתן`,
      suggestedTopics: ['Buy a birthday gift', 'Return a defective item', 'Ask about a sale']
    }
  ];

  getAll(): ConversationMode[] {
    return this.MODES;
  }

  getMode(id: string): ConversationMode | undefined {
    return this.MODES.find(m => m.id === id);
  }

  selectMode(id: string): void {
    const mode = this.getMode(id);
    if (mode) {
      this.selectedMode$.next(mode);
    }
  }

  getSelected(): ConversationMode | null {
    return this.selectedMode$.value;
  }

  clearSelection(): void {
    this.selectedMode$.next(null);
  }
}
