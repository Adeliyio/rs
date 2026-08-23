/**
 * Tests for PDF renderer utilities.
 *
 * Tests HTML conversion, Markdown table parsing, and HTML escaping.
 * Does NOT test actual Puppeteer rendering (requires browser binary).
 */

import { describe, it, expect } from 'vitest';
import {
  letterToHtml,
  markdownTableToHtml,
  escapeHtml,
} from '@/lib/pdf/renderer';

/* ------------------------------------------------------------------ */
/*  escapeHtml                                                         */
/* ------------------------------------------------------------------ */

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('handles plain text unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('She said "hello"')).toBe(
      'She said &quot;hello&quot;',
    );
  });
});

/* ------------------------------------------------------------------ */
/*  markdownTableToHtml                                               */
/* ------------------------------------------------------------------ */

describe('markdownTableToHtml', () => {
  it('converts a standard Markdown table', () => {
    const md = `| Deduction | Amount | Status |
|---|---|---|
| Cleaning | $500 | Disputed |
| Painting | $300 | Accepted |`;

    const html = markdownTableToHtml(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Deduction</th>');
    expect(html).toContain('<th>Amount</th>');
    expect(html).toContain('<td>Cleaning</td>');
    expect(html).toContain('<td>$500</td>');
    expect(html).toContain('<td>Disputed</td>');
    expect(html).toContain('<td>Painting</td>');
    expect(html).toContain('</table>');
  });

  it('skips separator rows', () => {
    const md = `| Col1 | Col2 |
|---|---|
| Data | Data2 |`;

    const html = markdownTableToHtml(md);
    expect(html).not.toContain('---');
  });

  it('handles single-line input as paragraph', () => {
    const html = markdownTableToHtml('Not a table');
    expect(html).toContain('<p>');
    expect(html).toContain('Not a table');
  });

  it('escapes HTML in table cells', () => {
    const md = `| Header |
|---|
| <script>xss</script> |`;

    const html = markdownTableToHtml(md);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});

/* ------------------------------------------------------------------ */
/*  letterToHtml                                                      */
/* ------------------------------------------------------------------ */

describe('letterToHtml', () => {
  it('wraps content in valid HTML document', () => {
    const html = letterToHtml('Hello World');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
    expect(html).toContain('Times New Roman');
  });

  it('converts double newlines to separate paragraphs', () => {
    const html = letterToHtml('Paragraph 1\n\nParagraph 2');
    expect(html).toContain('<p>Paragraph 1</p>');
    expect(html).toContain('<p>Paragraph 2</p>');
  });

  it('converts single newlines to line breaks', () => {
    const html = letterToHtml('Line 1\nLine 2');
    expect(html).toContain('Line 1<br/>Line 2');
  });

  it('converts disclaimer separator to horizontal rule', () => {
    const html = letterToHtml(
      'Letter body\n\n________________________________________\n\nDisclaimer text',
    );
    expect(html).toContain('<hr class="disclaimer-separator"');
    expect(html).toContain('<p>Disclaimer text</p>');
  });

  it('handles bold text markers', () => {
    const html = letterToHtml('**RE: Security Deposit Demand**');
    expect(html).toContain('class="bold"');
    expect(html).toContain('RE: Security Deposit Demand');
    expect(html).not.toContain('**');
  });

  it('includes rebuttal table when provided', () => {
    const table = `| Deduction | Amount |
|---|---|
| Cleaning | $500 |`;

    const html = letterToHtml('Letter body', table);
    expect(html).toContain('Itemized Dispute Summary');
    expect(html).toContain('<table>');
    expect(html).toContain('Cleaning');
  });

  it('omits rebuttal table section when not provided', () => {
    const html = letterToHtml('Letter body');
    expect(html).not.toContain('Itemized Dispute Summary');
    expect(html).not.toContain('<table>');
  });

  it('uses US Letter page size', () => {
    const html = letterToHtml('Test');
    expect(html).toContain('size: letter');
  });

  it('escapes HTML in letter content', () => {
    const html = letterToHtml('Amount: $100 <script>xss</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>xss');
  });

  it('handles empty content gracefully', () => {
    const html = letterToHtml('');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</body>');
  });

  it('sets proper margins for formal letter', () => {
    const html = letterToHtml('Test');
    expect(html).toContain('margin: 1in 1.25in');
  });
});
