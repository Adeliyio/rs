import { NextResponse } from 'next/server';

/**
 * Standard API error response.
 *
 * Logs the real error server-side (so it's diagnosable) but returns a GENERIC
 * body to the client — internal exception messages (Convex errors, thrown
 * state-machine strings, dependency stack detail) must never be echoed to the
 * caller. Use this instead of `{ error: err.message }` in route catch blocks.
 *
 * @param context  Short tag for the log line, e.g. 'POST /api/cases'.
 * @param err      The caught error (logged, never returned to the client).
 * @param status   HTTP status (default 500).
 * @param clientMessage  Optional safe message to show the client.
 */
export function respondError(
  context: string,
  err: unknown,
  status = 500,
  clientMessage = 'Something went wrong. Please try again.',
): NextResponse {
  const detail = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error(`[${context}]`, detail, err);
  return NextResponse.json({ error: clientMessage }, { status });
}
