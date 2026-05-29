/**
 * PDF renderer — server-only.
 *
 * Converts generated letter content (plain text with \n line breaks)
 * and optional rebuttal table (Markdown) into a US Letter PDF using
 * Puppeteer. The PDF is styled for formal correspondence.
 *
 * Concurrency: max 3 simultaneous renders (per infrastructure rules).
 * Memory: ~512 MB per Puppeteer instance.
 */

import puppeteer, { type Browser } from 'puppeteer';

/* ------------------------------------------------------------------ */
/*  Concurrency limiter                                                */
/* ------------------------------------------------------------------ */

const MAX_CONCURRENT = 3;
let activeRenders = 0;
const waitQueue: (() => void)[] = [];

async function acquireSlot(): Promise<void> {
  if (activeRenders < MAX_CONCURRENT) {
    activeRenders++;
    return;
  }
  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      activeRenders++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeRenders--;
  const next = waitQueue.shift();
  if (next) next();
}

/* ------------------------------------------------------------------ */
/*  Browser singleton                                                  */
/* ------------------------------------------------------------------ */

let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;

  _browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  return _browser;
}

/**
 * Close the browser instance. Call during graceful shutdown.
 */
export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

/* ------------------------------------------------------------------ */
/*  HTML conversion                                                    */
/* ------------------------------------------------------------------ */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Converts a Markdown table to an HTML table.
 * Handles the standard `| col | col |` format with `|---|---|` separator.
 */
function markdownTableToHtml(markdown: string): string {
  const lines = markdown.trim().split('\n');
  if (lines.length < 2) return `<p>${escapeHtml(markdown)}</p>`;

  const htmlLines: string[] = ['<table>'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Skip separator rows (|---|---|)
    if (/^\|[\s-:|]+\|$/.test(line.trim())) continue;

    const cells = line
      .split('|')
      .filter((c) => c.trim() !== '');

    if (cells.length === 0) continue;

    const tag = i === 0 ? 'th' : 'td';
    const rowClass = i === 0 ? ' class="header"' : '';
    htmlLines.push(`  <tr${rowClass}>`);
    for (const cell of cells) {
      htmlLines.push(`    <${tag}>${escapeHtml(cell.trim())}</${tag}>`);
    }
    htmlLines.push('  </tr>');
  }

  htmlLines.push('</table>');
  return htmlLines.join('\n');
}

/**
 * Converts letter content (plain text with \n) to styled HTML
 * for PDF rendering.
 */
function letterToHtml(
  content: string,
  rebuttalTable?: string,
): string {
  // Convert plain text paragraphs to HTML
  const paragraphs = content.split(/\n{2,}/);
  const bodyHtml = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';

      // Check if this is the disclaimer separator
      if (trimmed.startsWith('________')) {
        return '<hr class="disclaimer-separator" />';
      }

      // Check if it's a bold line (** syntax)
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        return `<p class="bold">${escapeHtml(trimmed.replace(/\*\*/g, ''))}</p>`;
      }

      // Convert single line breaks within a paragraph
      const lines = trimmed.split('\n');
      return `<p>${lines.map((l) => escapeHtml(l)).join('<br/>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');

  // Insert rebuttal table if present
  let tableHtml = '';
  if (rebuttalTable) {
    tableHtml = `
      <div class="rebuttal-table">
        <h3>Itemized Dispute Summary</h3>
        ${markdownTableToHtml(rebuttalTable)}
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page {
      size: letter;
      margin: 1in 1.25in;
    }
    body {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #000;
    }
    p {
      margin: 0 0 12pt 0;
    }
    p.bold {
      font-weight: bold;
    }
    hr.disclaimer-separator {
      border: none;
      border-top: 1px solid #666;
      margin: 24pt 0 12pt 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12pt 0;
      font-size: 10pt;
    }
    th, td {
      border: 1px solid #333;
      padding: 6pt 8pt;
      text-align: left;
      vertical-align: top;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    tr:nth-child(even) td {
      background-color: #fafafa;
    }
    .rebuttal-table {
      margin: 16pt 0;
    }
    .rebuttal-table h3 {
      font-size: 12pt;
      margin-bottom: 8pt;
    }
  </style>
</head>
<body>
  ${bodyHtml}
  ${tableHtml}
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                  */
/* ------------------------------------------------------------------ */

export interface PdfRenderOptions {
  content: string;
  rebuttalTable?: string;
}

/**
 * Renders letter content as a PDF buffer.
 *
 * @param options  Letter content and optional rebuttal table.
 * @returns  PDF as a Buffer.
 */
export async function renderLetterPdf(
  options: PdfRenderOptions,
): Promise<Buffer> {
  await acquireSlot();

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      const html = letterToHtml(options.content, options.rebuttalTable);
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const pdf = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: {
          top: '1in',
          bottom: '1in',
          left: '1.25in',
          right: '1.25in',
        },
      });

      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  } finally {
    releaseSlot();
  }
}

// Export internals for testing
export { letterToHtml, markdownTableToHtml, escapeHtml };
