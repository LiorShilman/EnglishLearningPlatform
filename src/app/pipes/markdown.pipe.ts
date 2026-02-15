// src/app/pipes/markdown.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
    name: 'markdown',
    standalone: true,
    pure: true  // Add this for better performance
})
export class MarkdownPipe implements PipeTransform {
    constructor(private sanitizer: DomSanitizer) {}

    transform(value: string | undefined | null): SafeHtml {
        if (!value) return '';

        const html = value
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/~~(.*?)~~/g, '<del>$1</del>')
            .replace(/__(.*?)__/g, '<u>$1</u>')
            .replace(/\n/g, '<br>');

        return this.sanitizer.bypassSecurityTrustHtml(html);
    }
}