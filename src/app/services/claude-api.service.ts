import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeRequest {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  system: string;
  messages: ClaudeMessage[];
}

export interface ClaudeContentBlock {
  type: 'text';
  text: string;
}

export interface ClaudeResponse {
  content: ClaudeContentBlock[];
  role: string;
  model: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClaudeApiService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  async createMessage(request: ClaudeRequest): Promise<ClaudeResponse> {
    return firstValueFrom(
      this.http.post<ClaudeResponse>(`${this.apiUrl}/api/claude/messages`, {
        model: request.model || 'claude-sonnet-4-5-20250929',
        max_tokens: request.max_tokens || 1024,
        temperature: request.temperature ?? 0.7,
        system: request.system,
        messages: request.messages,
      })
    );
  }
}
