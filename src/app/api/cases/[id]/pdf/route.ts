/**
 * POST /api/cases/[id]/pdf
 *
 * Generates a PDF from the case's stored letter content.
 * Uploads the PDF to Supabase Storage and updates the letter
 * record with the PDF URL.
 *
 * Requires: case has a generated letter, user is authenticated
 * and owns the case, payment gate passes.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderLetterPdf } from '@/lib/pdf/renderer';
import type { Tables } from '@/types/database.types';

type LetterRow = Pick<Tables<'letters'>, 'id' | 'content' | 'pdf_url'>;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;

    /* ---- Auth ---- */
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    /* ---- Load case (RLS enforces ownership) ---- */
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, user_id, status, wedge, payment_status')
      .eq('id', caseId)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const caseRow = caseData as unknown as { id: string; user_id: string; status: string; wedge: string; payment_status: string };

    if (caseRow.wedge !== 'deposit') {
      return NextResponse.json(
        { error: 'PDF generation is only available for deposit cases.' },
        { status: 400 },
      );
    }

    if (caseRow.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment required before PDF generation.' },
        { status: 402 },
      );
    }

    /* ---- Load letter ---- */
    const { data: letterData, error: letterError } = await supabase
      .from('letters')
      .select('id, content, pdf_url')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (letterError || !letterData) {
      return NextResponse.json(
        { error: 'No letter found for this case. Generate a letter first.' },
        { status: 404 },
      );
    }

    const letter = letterData as unknown as LetterRow;

    // If PDF already exists, generate a fresh signed URL from the stored path
    if (letter.pdf_url) {
      const { data: existingSignedData, error: existingSignedError } =
        await supabase.storage.from('documents').createSignedUrl(letter.pdf_url, 15 * 60);

      if (existingSignedError || !existingSignedData?.signedUrl) {
        // Stored path may be stale — fall through to re-render
      } else {
        return NextResponse.json({ pdf_url: existingSignedData.signedUrl });
      }
    }

    /* ---- Render PDF ---- */
    const pdfBuffer = await renderLetterPdf({
      content: letter.content,
    });

    /* ---- Upload to Supabase Storage ---- */
    const filePath = `${user.id}/${caseId}/demand-letter.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: 'Failed to upload PDF. Please try again.' },
        { status: 500 },
      );
    }

    // Generate a signed URL with 15-minute TTL (SEC-03)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 15 * 60); // 15 minutes

    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: 'Failed to generate signed URL for PDF' },
        { status: 500 },
      );
    }

    const signedUrl = signedData.signedUrl;

    /* ---- Update letter with storage path (not URL — we regenerate signed URLs on demand) ---- */
    const { error: updateError } = await supabase
      .from('letters')
      // @ts-expect-error — Supabase SSR generic doesn't resolve table Update type from manual Database definition
      .update({ pdf_url: filePath })
      .eq('id', letter.id);

    if (updateError) {
      // eslint-disable-next-line no-console
      console.error('Failed to update letter pdf_url:', updateError.message);
    }

    return NextResponse.json({ pdf_url: signedUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/cases/[id]/pdf error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
