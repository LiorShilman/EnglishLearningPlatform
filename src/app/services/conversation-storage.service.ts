import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConversationSession, SessionMetadata } from '../shared/interfaces/conversation-session.interfaces';

@Injectable({ providedIn: 'root' })
export class ConversationStorageService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  async loadActiveSession(): Promise<ConversationSession | null> {
    try {
      const session = await firstValueFrom(
        this.http.get<ConversationSession | null>(`${this.apiUrl}/api/conversations/active`)
      );

      if (!session || !session._id) return null;

      // Reconstruct Date objects
      session.chatMessages = (session.chatMessages || []).map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));

      return session;
    } catch (error) {
      console.error('Error loading active session:', error);
      return null;
    }
  }

  async createSession(session: Omit<ConversationSession, '_id'>): Promise<ConversationSession | null> {
    try {
      const created = await firstValueFrom(
        this.http.post<ConversationSession>(`${this.apiUrl}/api/conversations`, session)
      );
      return created;
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  }

  async saveSession(id: string, data: Partial<ConversationSession>): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put(`${this.apiUrl}/api/conversations/${id}`, data)
      );
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  async archiveSession(id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/api/conversations/${id}/archive`, {})
      );
    } catch (error) {
      console.error('Error archiving session:', error);
    }
  }

  async getHistory(): Promise<SessionMetadata[]> {
    try {
      return await firstValueFrom(
        this.http.get<SessionMetadata[]>(`${this.apiUrl}/api/conversations/history`)
      ) || [];
    } catch (error) {
      console.error('Error loading history:', error);
      return [];
    }
  }

  async loadSession(id: string): Promise<ConversationSession | null> {
    try {
      const session = await firstValueFrom(
        this.http.get<ConversationSession>(`${this.apiUrl}/api/conversations/${id}`)
      );
      if (!session) return null;

      session.chatMessages = (session.chatMessages || []).map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));

      return session;
    } catch (error) {
      console.error('Error loading session:', error);
      return null;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.apiUrl}/api/conversations/${id}`)
      );
      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }

  async reactivateSession(id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put(`${this.apiUrl}/api/conversations/${id}`, { isActive: true })
      );
    } catch (error) {
      console.error('Error reactivating session:', error);
    }
  }
}
