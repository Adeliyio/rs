/**
 * Resend email client — server-only.
 *
 * Provides a configured Resend client singleton and send helpers.
 * Email is never the sole delivery mechanism — in-app download
 * is always available as fallback.
 *
 * Retry policy: 3 attempts with exponential backoff (5s → 30s → 120s).
 */

import { Resend } from 'resend';

/* ------------------------------------------------------------------ */
/*  Client singleton                                                   */
/* ------------------------------------------------------------------ */

let _client: Resend | null = null;

function getResendClient(): Resend {
  if (_client) return _client;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing RESEND_API_KEY environment variable. Cannot send emails.',
    );
  }

  _client = new Resend(apiKey);
  return _client;
}

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: {
    filename: string;
    content: Buffer | string;
    content_type?: string;
  }[];
}

export interface EmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Retry helper                                                       */
/* ------------------------------------------------------------------ */

const RETRY_DELAYS = [5000, 30000, 120000]; // 5s, 30s, 2min

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ */
/*  Send function                                                     */
/* ------------------------------------------------------------------ */

const FROM_ADDRESS = 'Resolvaio <noreply@resolvaio.com>';

/**
 * Sends an email via Resend with retry logic.
 *
 * @param options  Email options (to, subject, html, etc.)
 * @returns  Result with email ID or error.
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const client = getResendClient();

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await client.emails.send({
        from: FROM_ADDRESS,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: typeof a.content === 'string'
            ? Buffer.from(a.content, 'base64')
            : a.content,
        })),
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return {
        ok: true,
        id: response.data?.id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        // eslint-disable-next-line no-console
        console.warn(
          `[Email] Attempt ${attempt + 1} failed: ${message}. Retrying in ${delay! / 1000}s...`,
        );
        await sleep(delay!);
        continue;
      }

      // All retries exhausted
      // eslint-disable-next-line no-console
      console.error(`[Email] All ${RETRY_DELAYS.length + 1} attempts failed: ${message}`);
      return { ok: false, error: message };
    }
  }

  return { ok: false, error: 'All retry attempts exhausted' };
}
