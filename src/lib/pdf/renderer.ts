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

/**
 * How long a caller will wait for a slot before giving up. Without this the
 * queue was UNBOUNDED and UNTIMED: `releaseSlot()` is only reachable from a
 * render's `finally`, so a single stalled Puppeteer page meant the queue never
 * drained and every later caller waited forever. The customer saw "Generating
 * PDF…" indefinitely, with no error and no route to their mailable document —
 * against a public claim that this takes under a minute.
 */
const SLOT_WAIT_TIMEOUT_MS = 30_000;

/** Hard ceiling on queued waiters, so a burst sheds load instead of piling up. */
const MAX_QUEUE_DEPTH = 20;

/** Per-operation Puppeteer timeouts — a stalled page must never hold its slot. */
const PAGE_CONTENT_TIMEOUT_MS = 15_000;
const PAGE_PDF_TIMEOUT_MS = 20_000;

/** Thrown when the renderer is saturated. The route maps this to HTTP 503. */
export class PdfRendererBusyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfRendererBusyError';
  }
}

let activeRenders = 0;
interface Waiter {
  grant: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
const waitQueue: Waiter[] = [];

async function acquireSlot(): Promise<void> {
  if (activeRenders < MAX_CONCURRENT) {
    activeRenders++;
    return;
  }

  if (waitQueue.length >= MAX_QUEUE_DEPTH) {
    throw new PdfRendererBusyError(
      'PDF renderer queue is full; try again shortly.',
    );
  }

  return new Promise<void>((resolve, reject) => {
    const waiter: Waiter = {
      grant: () => {
        clearTimeout(waiter.timer);
        activeRenders++;
        resolve();
      },
      reject,
      timer: setTimeout(() => {
        // Drop this waiter so a timed-out caller cannot later be granted a slot
        // that nothing would release.
        const idx = waitQueue.indexOf(waiter);
        if (idx !== -1) waitQueue.splice(idx, 1);
        reject(
          new PdfRendererBusyError(
            `Timed out after ${SLOT_WAIT_TIMEOUT_MS}ms waiting for a PDF render slot.`,
          ),
        );
      }, SLOT_WAIT_TIMEOUT_MS),
    };
    waitQueue.push(waiter);
  });
}

function releaseSlot(): void {
  activeRenders--;
  const next = waitQueue.shift();
  if (next) next.grant();
}

/** Test-only view of limiter state. Not used in production paths. */
export function __rendererQueueState(): {
  active: number;
  queued: number;
  maxConcurrent: number;
  maxQueueDepth: number;
} {
  return {
    active: activeRenders,
    queued: waitQueue.length,
    maxConcurrent: MAX_CONCURRENT,
    maxQueueDepth: MAX_QUEUE_DEPTH,
  };
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
      // Explicit timeouts: a page that never settles must not hold its slot
      // forever, because releaseSlot() is only reachable from the finally below.
      // A stalled render used to wedge PDF generation for EVERY user.
      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: PAGE_CONTENT_TIMEOUT_MS,
      });

      const pdf = await page.pdf({
        format: 'Letter',
        printBackground: true,
        timeout: PAGE_PDF_TIMEOUT_MS,
        margin: {
          top: '1in',
          bottom: '1in',
          left: '1.25in',
          right: '1.25in',
        },
      });

      return Buffer.from(pdf);
    } finally {
      // Never await a close that could itself hang — that would hold the slot
      // the outer finally is about to release, reintroducing the wedge.
      void page.close().catch(() => {
        /* page already gone / browser disconnected */
      });
    }
  } finally {
    releaseSlot();
  }
}

// Export internals for testing
export { letterToHtml, markdownTableToHtml, escapeHtml };
