/**
 * POST /api/cases/[id]/pdf
 *
 * Renders the case's letter to a PDF, uploads it to R2, and returns a 15-min
 * signed URL. Ownership via cases.getMine / letters.latestByCaseMine. R2 upload,
 * signing, and the letter pdf_url patch go through the service layer.
 */

import { NextResponse } from 'next/server';

import { q, currentUser, api } from '@/lib/convex/server';
import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { renderLetterPdf } from '@/lib/pdf/renderer';
import type { Id } from '@convex/dataModel';

// This route calls Convex at request time; force-dynamic so Next does not
// evaluate it during build-time page-data collection (fails without runtime env).
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const caseRow = await q(api.cases.getMine, { caseId: caseId as Id<'cases'> });
    if (!caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseRow.wedge !== 'deposit') {
      return NextResponse.json(
        { error: 'PDF generation is only available for deposit cases.' },
        { status: 400 },
      );
    }
    if (caseRow.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment required before PDF generation.' }, { status: 402 });
    }

    const letter = await q(api.letters.latestByCaseMine, { caseId: caseId as Id<'cases'> });
    if (!letter) {
      return NextResponse.json(
        { error: 'No letter found for this case. Generate a letter first.' },
        { status: 404 },
      );
    }

    const convex = createServiceConvexClient();
    const secret = serviceSecret();

    // If a PDF already exists, return a fresh signed URL from the stored key.
    if (letter.pdf_url) {
      try {
        const existing = await convex.action(api.service.signObject, {
          secret,
          key: letter.pdf_url,
          ttl: 'userFacing',
        });
        return NextResponse.json({ pdf_url: existing });
      } catch {
        // stale key — fall through to re-render
      }
    }

    /* ---- Render + upload ---- */
    const pdfBuffer = await renderLetterPdf({ content: letter.content });
    const storageKey = `${user.id}/${caseId}/demand-letter.pdf`;
    // Copy into a fresh ArrayBuffer (renderLetterPdf may return a Node Buffer
    // whose .buffer is a pooled/shared allocation).
    const pdfBytes = new Uint8Array(pdfBuffer.byteLength);
    pdfBytes.set(pdfBuffer);

    try {
      await convex.action(api.service.uploadObject, {
        secret,
        key: storageKey,
        bytes: pdfBytes.buffer,
        contentType: 'application/pdf',
      });
    } catch {
      return NextResponse.json({ error: 'Failed to upload PDF. Please try again.' }, { status: 500 });
    }

    let signedUrl: string;
    try {
      signedUrl = await convex.action(api.service.signObject, {
        secret,
        key: storageKey,
        ttl: 'userFacing',
      });
    } catch {
      return NextResponse.json({ error: 'Failed to generate signed URL for PDF' }, { status: 500 });
    }

    // Persist the R2 key on the letter (we regenerate signed URLs on demand).
    await convex.mutation(api.service.setLetterPdfUrl, {
      secret,
      letterId: letter.id as Id<'letters'>,
      pdfUrl: storageKey,
    });

    return NextResponse.json({ pdf_url: signedUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/cases/[id]/pdf error:', message);
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
