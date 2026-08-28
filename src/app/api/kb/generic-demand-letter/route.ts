/**
 * GET /api/kb/generic-demand-letter
 *
 * Serves the free, generic (non-jurisdiction-specific) security-deposit demand
 * letter template shown on the unsupported-jurisdiction screen.
 *
 * The template lives in `kb/`, which is copied into the runtime image but is
 * NOT a served static asset — a direct `/kb/...` link 404s in production. This
 * route reads it server-side and returns it as text so the "Download Template"
 * button works everywhere. Public and safe to expose: it is a static,
 * non-personalized document with no secrets.
 */

import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

const FILE_SEGMENTS = ['unsupported', 'generic-demand-letter.md'] as const;

export function GET(): NextResponse {
  try {
    const filePath = join(process.cwd(), 'kb', ...FILE_SEGMENTS);
    const body = readFileSync(filePath, 'utf-8');
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'inline; filename="generic-demand-letter.md"',
        // Static content — cache aggressively at the edge.
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Template is temporarily unavailable. Please try again later.' },
      { status: 500 },
    );
  }
}
