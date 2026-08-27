/**
 * OpenAI client — server-only singleton.
 *
 * Returns a configured OpenAI client using the OPENAI_API_KEY
 * environment variable. The client is instantiated once and reused.
 */

import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing OPENAI_API_KEY environment variable. Set it in .env.local.',
    );
  }

  client = new OpenAI({
    apiKey,
    // Bound every request so a slow/hung OpenAI can't tie up a Next.js request
    // (or a worker job) indefinitely — the SDK default is a 10-minute timeout.
    // 90s comfortably covers GPT-4o vision + letter generation; on timeout or a
    // transient network error the SDK retries with backoff.
    timeout: 90_000,
    maxRetries: 2,
  });
  return client;
}
