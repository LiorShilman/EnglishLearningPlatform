import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
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

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      grammar: 'G',
      usage: 'U',
      warning: '!',
      practice: 'P'
    };
    return icons[type] || '?';
  }

  trackByIndex(index: number): number {
    return index;
  }
}
