// src/app/services/conversation-topics.service.ts
import { Injectable } from '@angular/core';

interface ConversationTopic {
    id: number;
    name: string;
    description: string;
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
    suggestedQuestions: string[];
    vocabularyWords: Array<{
        english: string;
        hebrew: string;
        example: string;
    }>;
}

@Injectable({
    providedIn: 'root'
})
export class ConversationTopicsService {
    private topics: ConversationTopic[] = [
        {
            id: 1,
            name: 'Daily Routine',
            description: 'Talk about your typical day and daily activities',
            difficulty: 'Beginner',
            suggestedQuestions: [
                'What time do you usually wake up?',
                'What do you like to do in your free time?',
                'Can you describe your morning routine?',
                'What is your favorite part of the day?'
            ],
            vocabularyWords: [
                {
                    english: 'routine',
                    hebrew: 'שגרה',
                    example: 'My morning routine includes exercise and breakfast'
                },
                {
                    english: 'schedule',
                    hebrew: 'לוח זמנים',
                    example: 'I have a busy schedule today'
                }
            ]
        },
        {
            id: 2,
            name: 'Hobbies & Interests',
            description: 'Discuss activities you enjoy and things that interest you',
            difficulty: 'Beginner',
            suggestedQuestions: [
                'What are your favorite hobbies?',
                'How long have you been interested in this hobby?',
                'What made you start this hobby?',
                'Would you recommend this hobby to others?'
            ],
            vocabularyWords: [
                {
                    english: 'hobby',
                    hebrew: 'תחביב',
                    example: 'Reading is my favorite hobby'
                },
                {
                    english: 'passionate',
                    hebrew: 'נלהב',
                    example: "I'm passionate about photography"
                }
            ]
        }
    ];

    // מקבל נושא שיחה אקראי מהרשימה
    getRandomTopic(): ConversationTopic {
        const randomIndex = Math.floor(Math.random() * this.topics.length);
        return this.topics[randomIndex];
    }

    // מקבל נושא שיחה לפי רמת קושי
    getTopicsByDifficulty(difficulty: 'Beginner' | 'Intermediate' | 'Advanced'): ConversationTopic[] {
        return this.topics.filter(topic => topic.difficulty === difficulty);
    }

    // מקבל שאלה אקראית מנושא מסוים
    getRandomQuestion(topicId: number): string {
        const topic = this.topics.find(t => t.id === topicId);
        if (!topic) return '';
        
        const randomIndex = Math.floor(Math.random() * topic.suggestedQuestions.length);
        return topic.suggestedQuestions[randomIndex];
    }

    // מקבל את מילות האוצר הרלוונטיות לנושא
    getVocabularyForTopic(topicId: number) {
        const topic = this.topics.find(t => t.id === topicId);
        return topic?.vocabularyWords || [];
    }
}