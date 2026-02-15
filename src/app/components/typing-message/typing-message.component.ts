import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownPipe } from '../../pipes/markdown.pipe';

@Component({
  selector: 'app-typing-message',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule, // Make sure it's here
    MarkdownPipe
  ],
  templateUrl: './typing-message.component.html',
  styleUrls: ['./typing-message.component.scss']  // Note: styleUrls not styleUrl
})
export class TypingMessageComponent implements OnChanges, OnDestroy {
  @Input() english: string = '';
  @Input() hebrew: string = '';
  @Input() typingSpeed: number = 30; // milliseconds per character

  displayedEnglish: string = '';
  displayedHebrew: string = '';
  isTyping: boolean = false;
  private timeout: any;
  private currentIndex: number = 0;

  ngOnChanges() {
    this.resetTyping();
    this.startTyping();
  }

  ngOnDestroy() {
    this.clearTimeout();
  }

  private resetTyping() {
    this.clearTimeout();
    this.displayedEnglish = '';
    this.displayedHebrew = '';
    this.currentIndex = 0;
    this.isTyping = false;
  }

  private clearTimeout() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  private startTyping() {
    this.isTyping = true;
    this.typeNextCharacter();
  }

  private typeNextCharacter() {
    if (this.currentIndex < this.english.length) {
      this.displayedEnglish += this.english[this.currentIndex];
      this.currentIndex++;
      
      this.timeout = setTimeout(() => {
        this.typeNextCharacter();
      }, this.typingSpeed);
    } else {
      this.isTyping = false;
      this.displayedHebrew = this.hebrew;
    }
  }
}