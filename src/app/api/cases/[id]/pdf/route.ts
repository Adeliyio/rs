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
import { renderLetterPdf, PdfRendererBusyError } from '@/lib/pdf/renderer';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
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

    /* ---- Rate limit ----
     * This route spawns headless Chromium — the heaviest operation in the app
     * (~512MB per instance, capped at 3 concurrent). It was previously
     * unlimited, so one authenticated user clicking "Download PDF" repeatedly
     * could saturate every render slot and stall PDF generation for everyone.
     * Keyed by user id: a cached PDF short-circuits below, so a legitimate
     * re-download rarely reaches the renderer at all. */
    const rateResult = await checkRateLimit('general', user.id);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Too many PDF requests. Please wait a moment and try again.' },
        { status: 429, headers: rateLimitHeaders(rateResult) },
      );
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
    // Dual gate, matching /generate: a paid case OR an active subscription
    // (Unlimited) may download the PDF. Without the subscription branch a paying
    // subscriber could read the letter on screen but never download the mailable
    // PDF (their case is never marked payment_status:'paid').
    if (caseRow.payment_status !== 'paid') {
      const activeSubscription = await q(api.subscriptions.currentMine, {});
      if (!activeSubscription) {
        return NextResponse.json({ error: 'Payment required before PDF generation.' }, { status: 402 });
      }
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
    // Pass the persisted rebuttal table so the MAILED document contains the
    // itemized dispute. The renderer has always had the table styling; nothing
    // ever handed it a table, so that code was dead and the landlord received a
    // letter with no itemized rebuttal at all.
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await renderLetterPdf({
        content: letter.content,
        rebuttalTable: letter.rebuttal_table ?? undefined,
      });
    } catch (renderErr) {
      // Saturated renderer (all slots busy / queue full) is a TRANSIENT
      // condition, not a failure of this request — say so, so the customer
      // retries instead of believing their document is broken.
      if (renderErr instanceof PdfRendererBusyError) {
        return NextResponse.json(
          {
            error:
              'We are generating a lot of documents right now. Please try again in a minute.',
          },
          { status: 503, headers: { 'Retry-After': '60' } },
        );
      }
      throw renderErr;
    }
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
