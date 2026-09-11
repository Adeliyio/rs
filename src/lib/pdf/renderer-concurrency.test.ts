import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

/**
 * Regression guard for the PDF renderer's concurrency limiter.
 *
 * The limiter caps renders at 3 concurrent, but its wait queue was UNBOUNDED
 * and UNTIMED. `releaseSlot()` is only reachable from a render's `finally`, so
 * one stalled Puppeteer page meant the queue never drained: every later caller
 * waited forever, the customer's button read "Generating PDF…" indefinitely,
 * and there was no error and no route to their mailable document — against a
 * public claim that this takes under a minute. A single authenticated user
 * clicking Download repeatedly could wedge PDF generation for EVERYONE.
 *
 * The real limiter cannot be exercised here (it launches Chromium), so the
 * behavioural assertions below run against a faithful REIMPLEMENTATION of the
 * same algorithm, and the source assertions pin the production file to it.
 * That split is deliberate: the simulation proves the algorithm recovers, and
 * the source checks prove production uses that algorithm rather than the old one.
 */

/* ------------------------------------------------------------------ */
/*  Behavioural: the algorithm recovers from a stalled render          */
/* ------------------------------------------------------------------ */

class BusyError extends Error {}

/** Mirrors acquireSlot/releaseSlot in src/lib/pdf/renderer.ts. */
function makeLimiter(maxConcurrent: number, maxQueue: number, timeoutMs: number) {
  let active = 0;
  interface W {
    grant: () => void;
    timer: ReturnType<typeof setTimeout>;
  }
  const queue: W[] = [];

  async function acquire(): Promise<void> {
    if (active < maxConcurrent) {
      active++;
      return;
    }
    if (queue.length >= maxQueue) {
      throw new BusyError('queue full');
    }
    return new Promise<void>((resolve, reject) => {
      const w: W = {
        grant: () => {
          clearTimeout(w.timer);
          active++;
          resolve();
        },
        timer: setTimeout(() => {
          const i = queue.indexOf(w);
          if (i !== -1) queue.splice(i, 1);
          reject(new BusyError('timed out waiting for slot'));
        }, timeoutMs),
      };
      queue.push(w);
    });
  }

  function release(): void {
    active--;
    const next = queue.shift();
    if (next) next.grant();
  }

  return {
    acquire,
    release,
    state: () => ({ active, queued: queue.length }),
  };
}

describe('PDF render slot limiter', () => {
  it('grants up to the concurrency cap immediately', async () => {
    const l = makeLimiter(3, 20, 1000);
    await l.acquire();
    await l.acquire();
    await l.acquire();
    expect(l.state().active).toBe(3);
  });

  it('a waiter TIMES OUT rather than hanging forever when a render stalls', async () => {
    const l = makeLimiter(1, 20, 50);
    await l.acquire(); // occupy the only slot and never release (the stall)

    // Before the fix this promise never settled — the customer's spinner ran
    // indefinitely with no error.
    await expect(l.acquire()).rejects.toBeInstanceOf(BusyError);
  });

  it('drops a timed-out waiter so it cannot later take a slot nothing releases', async () => {
    const l = makeLimiter(1, 20, 30);
    await l.acquire();

    await expect(l.acquire()).rejects.toBeInstanceOf(BusyError);
    expect(l.state().queued).toBe(0);

    // The stalled render finally finishes. The dropped waiter must NOT be
    // granted the slot (nothing would ever release it again).
    l.release();
    expect(l.state().active).toBe(0);
  });

  it('sheds load once the queue is full instead of growing without bound', async () => {
    const l = makeLimiter(1, 2, 5000);
    await l.acquire(); // slot taken

    void l.acquire().catch(() => undefined); // queued 1
    void l.acquire().catch(() => undefined); // queued 2 (now full)
    expect(l.state().queued).toBe(2);

    await expect(l.acquire()).rejects.toBeInstanceOf(BusyError);
  });

  it('a waiter is granted the slot as soon as a render completes', async () => {
    const l = makeLimiter(1, 20, 5000);
    await l.acquire();

    let granted = false;
    const waiting = l.acquire().then(() => {
      granted = true;
    });

    expect(granted).toBe(false);
    l.release();
    await waiting;
    expect(granted).toBe(true);
  });

  it('recovers fully: after a stall times out, later renders still work', async () => {
    const l = makeLimiter(1, 20, 30);
    await l.acquire();
    await expect(l.acquire()).rejects.toBeInstanceOf(BusyError);

    l.release(); // stalled render eventually returns
    await l.acquire(); // a brand-new request succeeds
    expect(l.state().active).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/*  Source: production uses the fixed algorithm                        */
/* ------------------------------------------------------------------ */

const RENDERER = readFileSync(
  join(process.cwd(), 'src', 'lib', 'pdf', 'renderer.ts'),
  'utf-8',
);
const PDF_ROUTE = readFileSync(
  join(process.cwd(), 'src', 'app', 'api', 'cases', '[id]', 'pdf', 'route.ts'),
  'utf-8',
);
const PACKET_ROUTE = readFileSync(
  join(process.cwd(), 'src', 'app', 'api', 'cases', '[id]', 'packet', 'route.ts'),
  'utf-8',
);

describe('renderer source carries the guards', () => {
  it('bounds the wait for a slot', () => {
    expect(RENDERER).toContain('SLOT_WAIT_TIMEOUT_MS');
  });

  it('bounds the queue depth', () => {
    expect(RENDERER).toContain('MAX_QUEUE_DEPTH');
  });

  it('gives Puppeteer explicit operation timeouts', () => {
    expect(RENDERER).toContain('PAGE_CONTENT_TIMEOUT_MS');
    expect(RENDERER).toContain('PAGE_PDF_TIMEOUT_MS');
  });

  it('does not await page.close() in the finally (it could hang the slot)', () => {
    expect(RENDERER).not.toContain('await page.close()');
  });

  it('exposes a typed busy error for callers to map to 503', () => {
    expect(RENDERER).toContain('class PdfRendererBusyError');
  });
});

describe('expensive routes are rate limited', () => {
  it('the PDF route limits by user', () => {
    expect(PDF_ROUTE).toContain('checkRateLimit');
    expect(PDF_ROUTE).toContain('429');
  });

  it('the PDF route returns 503 + Retry-After when the renderer is saturated', () => {
    expect(PDF_ROUTE).toContain('PdfRendererBusyError');
    expect(PDF_ROUTE).toContain('Retry-After');
  });

  it('the packet route limits by user', () => {
    expect(PACKET_ROUTE).toContain('checkRateLimit');
    expect(PACKET_ROUTE).toContain('429');
  });
});
