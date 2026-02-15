import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EnhancedChatMessage, CorrectionBlock, ExplanationItem } from '../../shared/interfaces/english-learning.interfaces';

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

  correctionBlocks: CorrectionBlock[] = [];

  openSummary(): void {
    this.buildCorrectionBlocks();
    this.showSummary = true;
  }

  onClose(): void {
    this.showSummary = false;
    this.closeSummary.emit();
  }

  private buildCorrectionBlocks(): void {
    const assistantMessages = this.chatMessages.filter(msg => msg.sender === 'assistant');
    this.correctionBlocks = [];

    assistantMessages.forEach((message) => {
      const englishContent = message.english;
      const block: CorrectionBlock = {
        timestamp: message.timestamp.toLocaleString(),
        corrections: []
      };

      const changesMatch = englishContent.match(/Changes explained:\s*([\s\S]*?)(?=Let's continue|##|\n\n🎭|$)/i);
      let explanations: string[] = [];

      if (changesMatch?.[1]) {
        explanations = changesMatch[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && /^\d+\./.test(line))
          .map(line => line.replace(/^\d+\.\s*/, '').trim());
      }

      const correctionParts = englishContent.split(/(?=• Original:)/);

      correctionParts.forEach(part => {
        const originalMatch = part.match(/• Original: ~~([^~]+)~~/);
        const correctedMatch = part.match(/• Corrected: ["'`]([^"'`]+)["'`]/);

        if (originalMatch?.[1] && correctedMatch?.[1]) {
          block.corrections.push({
            wrong: originalMatch[1].trim(),
            right: correctedMatch[1].trim(),
            explanations: explanations
          });
        }
      });

      if (block.corrections.length > 0) {
        this.correctionBlocks.push(block);
      }
    });
  }

  trackByTimestamp(_index: number, block: CorrectionBlock): string {
    return block.timestamp;
  }

  trackByCorrectionIndex(index: number): number {
    return index;
  }

  trackByExplanationIndex(index: number): number {
    return index;
  }
}
