// src/app/pipes/markdown.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
    name: 'markdown',
    standalone: true,
    pure: true
})
export class MarkdownPipe implements PipeTransform {
    private static readonly BOLD_RE = /\*\*(.*?)\*\*/g;
    private static readonly ITALIC_RE = /\*(.*?)\*/g;
    private static readonly CODE_RE = /`(.*?)`/g;
    private static readonly STRIKE_RE = /~~(.*?)~~/g;
    private static readonly UNDERLINE_RE = /__(.*?)__/g;
    private static readonly NEWLINE_RE = /\n/g;

    constructor(private sanitizer: DomSanitizer) {}

    transform(value: string | undefined | null): SafeHtml {
        if (!value) return '';

        // Escape HTML entities first to prevent XSS
        const escaped = this.escapeHtml(value);

        const html = escaped
            .replace(MarkdownPipe.BOLD_RE, '<strong>$1</strong>')
            .replace(MarkdownPipe.ITALIC_RE, '<em>$1</em>')
            .replace(MarkdownPipe.CODE_RE, '<code>$1</code>')
            .replace(MarkdownPipe.STRIKE_RE, '<del>$1</del>')
            .replace(MarkdownPipe.UNDERLINE_RE, '<u>$1</u>')
            .replace(MarkdownPipe.NEWLINE_RE, '<br>');

        return this.sanitizer.bypassSecurityTrustHtml(html);
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}