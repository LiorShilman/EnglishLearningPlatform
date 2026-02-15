import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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

export interface ClaudeApiError {
  status: number;
  type: string;
  message: string;
  retryable: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ClaudeApiService {
  private readonly apiUrl = environment.apiUrl;
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAYS = [1000, 3000]; // ms

  constructor(private http: HttpClient) {}

  async createMessage(request: ClaudeRequest): Promise<ClaudeResponse> {
    let lastError: ClaudeApiError | null = null;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await firstValueFrom(
          this.http.post<ClaudeResponse>(`${this.apiUrl}/api/claude/messages`, {
            model: request.model || 'claude-sonnet-4-5-20250929',
            max_tokens: request.max_tokens || 1024,
            temperature: request.temperature ?? 0.7,
            system: request.system,
            messages: request.messages,
          })
        );
      } catch (err) {
        lastError = this.parseError(err);
        if (!lastError.retryable || attempt === this.MAX_RETRIES) {
          break;
        }
        await this.delay(this.RETRY_DELAYS[attempt]);
      }
    }

    throw lastError;
  }

  private parseError(err: unknown): ClaudeApiError {
    if (err instanceof HttpErrorResponse) {
      const retryable = err.status === 0 || err.status === 429 || err.status >= 500;
      return {
        status: err.status,
        type: err.error?.type || 'http_error',
        message: err.error?.error || err.message || 'Network error',
        retryable,
      };
    }
    return {
      status: 0,
      type: 'unknown_error',
      message: err instanceof Error ? err.message : 'Unknown error',
      retryable: false,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
