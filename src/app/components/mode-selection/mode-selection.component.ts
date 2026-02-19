import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ConversationMode } from '../../shared/interfaces/english-learning.interfaces';
import { ConversationModeService } from '../../services/conversation-mode.service';

@Component({
  selector: 'app-mode-selection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mode-selection.component.html',
  styleUrls: ['./mode-selection.component.scss']
})
export class ModeSelectionComponent {
  @Output() modeSelected = new EventEmitter<ConversationMode>();

  modes: ConversationMode[];

  constructor(
    private modeService: ConversationModeService,
    private sanitizer: DomSanitizer
  ) {
    this.modes = this.modeService.getAll();
  }

  getSafeIcon(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  selectMode(mode: ConversationMode): void {
    this.modeSelected.emit(mode);
  }
}
