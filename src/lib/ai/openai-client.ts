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

  client = new OpenAI({ apiKey });
  return client;
}
