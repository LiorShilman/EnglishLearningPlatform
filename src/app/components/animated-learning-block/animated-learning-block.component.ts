import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { LearningBlock } from '../../shared/interfaces/english-learning.interfaces';

@Component({
  selector: 'app-animated-learning-block',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './animated-learning-block.component.html',
  styleUrl: './animated-learning-block.component.scss'
})
export class AnimatedLearningBlockComponent implements OnInit {
  @Input() block!: LearningBlock;
  @Input() delay: number = 500; // Delay before showing the block

  isVisible = false;
  displayedEnglish = '';
  displayedHebrew = '';

  ngOnInit() {
    // Show block after delay
    setTimeout(() => {
      this.isVisible = true;
      this.startTyping();
    }, this.delay);
  }

  private startTyping() {
    // Start typing content after block appears
    setTimeout(() => {
      this.displayedEnglish = this.block.content.english;
      this.displayedHebrew = this.block.content.hebrew;
    }, 300);
  }

  getBlockIcon(type: string): string {
    switch (type) {
      case 'grammar': return '📝';
      case 'usage': return '💡';
      case 'warning': return '⚠️';
      case 'practice': return '🔄';
      default: return '📌';
    }
  }
}