// src/app/pipes/markdown.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
    name: 'markdown',
    standalone: true,
    pure: true
})
export class MarkdownPipe implements PipeTransform {

    constructor(private sanitizer: DomSanitizer) {}

    transform(value: string | undefined | null): SafeHtml {
        if (!value) return '';

        const html = this.parseMarkdown(value);
        return this.sanitizer.bypassSecurityTrustHtml(html);
    }

    private parseMarkdown(text: string): string {
        const lines = text.split('\n');
        const result: string[] = [];
        let inList = false;
        let inTable = false;
        let tableRows: string[][] = [];
        let hasHeader = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Horizontal rule
            if (/^---+$/.test(line.trim())) {
                if (inList) { this.closeList(result); inList = false; }
                if (inTable) { result.push(this.buildTable(tableRows, hasHeader)); inTable = false; tableRows = []; hasHeader = false; }
                result.push('<hr>');
                continue;
            }

            // Table row detection (must be before headings/paragraphs)
            const tableRowMatch = line.match(/^\|(.+)\|$/);
            if (tableRowMatch) {
                const cells = tableRowMatch[1].split('|').map(c => c.trim());
                const isSeparator = cells.every(c => /^[-:\s]+$/.test(c));

                if (!inTable) {
                    if (inList) { this.closeList(result); inList = false; }
                    inTable = true;
                    tableRows = [];
                    hasHeader = false;
                }

                if (isSeparator) {
                    hasHeader = true;
                } else {
                    tableRows.push(cells);
                }
                continue;
            }

            // Flush table if we were in one
            if (inTable) {
                result.push(this.buildTable(tableRows, hasHeader));
                inTable = false;
                tableRows = [];
                hasHeader = false;
            }

            // Headings
            const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
            if (headingMatch) {
                if (inList) { this.closeList(result); inList = false; }
                const level = headingMatch[1].length;
                const content = this.formatInline(this.escapeHtml(headingMatch[2]));
                result.push(`<h${level}>${content}</h${level}>`);
                continue;
            }

            // Unordered list items
            const listMatch = line.match(/^[-*]\s+(.+)$/);
            if (listMatch) {
                if (!inList) { result.push('<ul>'); inList = true; }
                const content = this.formatInline(this.escapeHtml(listMatch[1]));
                result.push(`<li>${content}</li>`);
                continue;
            }

            // Ordered list items
            const olMatch = line.match(/^\d+\.\s+(.+)$/);
            if (olMatch) {
                if (!inList) { result.push('<ol>'); inList = true; }
                const content = this.formatInline(this.escapeHtml(olMatch[1]));
                result.push(`<li>${content}</li>`);
                continue;
            }

            // Close list if we're no longer in one
            if (inList) {
                this.closeList(result);
                inList = false;
            }

            // Empty line
            if (line.trim() === '') {
                continue;
            }

            // Regular paragraph
            const content = this.formatInline(this.escapeHtml(line));
            result.push(`<p>${content}</p>`);
        }

        // Flush any pending state
        if (inList) { this.closeList(result); }
        if (inTable) { result.push(this.buildTable(tableRows, hasHeader)); }

        return result.join('');
    }

    private buildTable(rows: string[][], hasHeader: boolean): string {
        if (rows.length === 0) return '';

        let html = '<div class="md-table-wrapper"><table class="md-table">';

        let startIdx = 0;
        if (hasHeader && rows.length > 0) {
            html += '<thead><tr>';
            for (const cell of rows[0]) {
                html += `<th>${this.formatInline(this.escapeHtml(cell))}</th>`;
            }
            html += '</tr></thead>';
            startIdx = 1;
        }

        html += '<tbody>';
        for (let i = startIdx; i < rows.length; i++) {
            html += '<tr>';
            for (const cell of rows[i]) {
                html += `<td>${this.formatInline(this.escapeHtml(cell))}</td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table></div>';

        return html;
    }

    private closeList(result: string[]): void {
        const lastTag = this.findLastListTag(result);
        result.push(lastTag === '<ol>' ? '</ol>' : '</ul>');
    }

    private formatInline(text: string): string {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/~~(.*?)~~/g, '<del>$1</del>')
            .replace(/__(.*?)__/g, '<u>$1</u>');
    }

    private findLastListTag(arr: string[]): string {
        for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i] === '<ul>' || arr[i] === '<ol>') return arr[i];
        }
        return '</ul>';
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
