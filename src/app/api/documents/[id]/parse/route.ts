/* eslint-disable @typescript-eslint/no-explicit-any -- Manual DB types; remove after pnpm db:gen-types */
/**
 * POST /api/documents/[id]/parse
 *
 * Fetches a document record, creates a signed URL for the file in
 * Supabase Storage, determines the extraction schema from the case's
 * wedge, and calls GPT-4o Vision to extract structured fields.
 *
 * On success: saves parsed_json and updates parse_status to 'parsed'.
 * On failure: updates parse_status to 'failed' and returns an error.
 *
 * Returns: { parsed_fields, confidence_scores }
 */

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { extractFromDocument } from '@/lib/ai/extraction';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface DocumentRow {
  id: string;
  case_id: string;
  file_path: string;
  content_type: string | null;
  parse_status: string;
}

interface CaseRow {
  id: string;
  wedge: string;
}

/* ------------------------------------------------------------------ */
/*  Schema resolution                                                 */
/* ------------------------------------------------------------------ */

/**
 * Determines the extraction schema name based on the case wedge and
 * the document content type / context.
 */
function resolveSchemaName(wedge: string, _contentType: string | null): string {
  // For deposit cases, the primary documents are leases and itemisations.
  // For subscription cases, the primary documents are billing statements.
  if (wedge === 'subscription') {
    return 'billing_statement';
  }

  // Deposit wedge — default to lease agreement. The parse endpoint can
  // be called with a ?schema query parameter to override this for
  // itemisation documents.
  return 'lease_agreement';
}

/* ------------------------------------------------------------------ */
/*  POST                                                              */
/* ------------------------------------------------------------------ */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: documentId } = await params;

    /* ---- Auth ---- */
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    /* ---- Optional schema override via query string ---- */
    const url = new URL(request.url);
    const schemaOverride = url.searchParams.get('schema');

    /* ---- Fetch document record (RLS via case ownership) ---- */
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .select('id, case_id, file_path, content_type, parse_status')
      .eq('id', documentId)
      .single();

    if (docError || !docData) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    const doc = docData as unknown as DocumentRow;

    /* ---- Fetch associated case (for wedge) ---- */
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, wedge')
      .eq('id', doc.case_id)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json(
        { error: 'Associated case not found' },
        { status: 404 },
      );
    }

    const caseRow = caseData as unknown as CaseRow;

    /* ---- Create signed URL for the file ---- */
    const serviceClient = createServiceRoleClient();

    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 5 * 60); // 5-minute expiry (SEC-10)

    if (signedUrlError || !signedUrlData?.signedUrl) {
      // Update status to failed
      await updateParseStatus(supabase, documentId, 'failed');
      return NextResponse.json(
        { error: `Failed to create signed URL: ${signedUrlError?.message ?? 'unknown'}` },
        { status: 500 },
      );
    }

    const imageUrl = signedUrlData.signedUrl as string;

    /* ---- Determine extraction schema ---- */
    const schemaName = schemaOverride ?? resolveSchemaName(caseRow.wedge, doc.content_type);

    /* ---- Extract fields via GPT-4o Vision ---- */
    const result = await extractFromDocument(imageUrl, doc.content_type ?? 'image/jpeg', schemaName);

    if (result.error) {
      await updateParseStatus(supabase, documentId, 'failed');
      return NextResponse.json(
        { error: `Extraction failed: ${result.error}` },
        { status: 500 },
      );
    }

    /* ---- Save parsed result ---- */
    const parsedJson: Record<string, unknown> = {
      schema: schemaName,
      fields: result.fields,
      raw_response: result.raw_response,
      extracted_at: new Date().toISOString(),
    };

    const updatePayload: Record<string, unknown> = {
      parsed_json: parsedJson,
      parse_status: 'parsed',
      updated_at: new Date().toISOString(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase
      .from('documents') as any)
      .update(updatePayload)
      .eq('id', documentId);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to save parsed result: ${updateError.message}` },
        { status: 500 },
      );
    }

    /* ---- Build response ---- */
    const parsedFields: Record<string, unknown> = {};
    const confidenceScores: Record<string, number> = {};

    for (const [key, field] of Object.entries(result.fields)) {
      parsedFields[key] = field.value;
      confidenceScores[key] = field.confidence;
    }

    return NextResponse.json({
      parsed_fields: parsedFields,
      confidence_scores: confidenceScores,
      fields: result.fields,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Updates a document's parse_status. Best-effort — errors are logged
 * but not propagated.
 */
async function updateParseStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  status: 'pending' | 'parsed' | 'confirmed' | 'failed',
): Promise<void> {
  const payload: Record<string, unknown> = {
    parse_status: status,
    updated_at: new Date().toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase
    .from('documents') as any)
    .update(payload)
    .eq('id', documentId);

  if (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to update parse_status to '${status}':`, error.message);
  }
}
