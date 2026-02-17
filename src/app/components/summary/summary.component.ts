import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EnhancedChatMessage, LearningBlock } from '../../shared/interfaces/english-learning.interfaces';

interface SummaryBlock {
  type: string;
  title: string;
  english: string;
  hebrew: string;
  examples: Array<{ english: string; hebrew: string }>;
}

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.scss']
})
export class SummaryComponent {
  @Input() chatMessages: EnhancedChatMessage[] = [];
  @Input() showSummary = false;
  @Output() closeSummary = new EventEmitter<void>();

  summaryBlocks: SummaryBlock[] = [];
  messageCount = 0;
  correctionCount = 0;

  constructor(private sanitizer: DomSanitizer) {}

  openSummary(): void {
    this.buildSummary();
    this.showSummary = true;
  }

  onClose(): void {
    this.showSummary = false;
    this.closeSummary.emit();
  }

  private buildSummary(): void {
    const assistantMessages = this.chatMessages.filter(msg => msg.sender === 'assistant');
    this.messageCount = this.chatMessages.filter(msg => msg.sender === 'user').length;
    this.summaryBlocks = [];

    assistantMessages.forEach(message => {
      // Collect learning blocks from the parsed message
      if (message.learningBlocks?.length) {
        message.learningBlocks.forEach((block: LearningBlock) => {
          this.summaryBlocks.push({
            type: block.type,
            title: block.title,
            english: block.content.english,
            hebrew: block.content.hebrew,
            examples: block.examples || []
          });
        });
      }
    });

    this.correctionCount = this.summaryBlocks.filter(b => b.type === 'grammar' || b.type === 'warning').length;
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      grammar: 'Grammar',
      usage: 'Usage',
      warning: 'Warning',
      practice: 'Practice'
    };
    return labels[type] || type;
  }

  getTypeIcon(type: string): SafeHtml {
    const svgs: Record<string, string> = {
      grammar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="rgba(112,193,179,0.2)" stroke="#70C1B3" stroke-width="1.5"/>
        <path d="M9 12h6M9 15h4" stroke="#70C1B3" stroke-width="2" stroke-linecap="round"/>
        <circle cx="8" cy="9" r="1.2" fill="#70C1B3"/>
        <path d="M11 8.5l1.5 2 3-3" stroke="#70C1B3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      usage: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="rgba(123,140,222,0.15)" stroke="#7B8CDE" stroke-width="1.2"/>
        <circle cx="12" cy="12" r="4" fill="rgba(123,140,222,0.25)" stroke="#7B8CDE" stroke-width="1.5"/>
        <path d="M12 10v4M10 12h4" stroke="#7B8CDE" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
      warning: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 20h20L12 2z" fill="rgba(255,185,151,0.2)" stroke="#FFB997" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M12 9v5" stroke="#FFB997" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="12" cy="17" r="1" fill="#FFB997"/>
      </svg>`,
      practice: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="20" height="20" rx="4" fill="rgba(182,164,206,0.15)" stroke="#B6A4CE" stroke-width="1.2"/>
        <path d="M8 12l3 3 5-6" stroke="#B6A4CE" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    };
    return this.sanitizer.bypassSecurityTrustHtml(svgs[type] || svgs['grammar']);
  }

  trackByIndex(index: number): number {
    return index;
  }
}
