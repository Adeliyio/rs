/* eslint-disable @typescript-eslint/no-explicit-any -- Manual DB types; remove after pnpm db:gen-types */
/**
 * POST /api/documents/upload
 *
 * Accepts multipart form data with a file and caseId. Validates the
 * file type and size, uploads to Supabase Storage under a tenant-
 * isolated path ({userId}/{caseId}/{filename}), and creates a
 * documents row with parse_status = 'pending'.
 *
 * Returns: { document_id, file_path }
 */

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
]);

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Sanitise a filename for use as a storage object key.
 * Removes path separators and problematic characters, keeping the
 * extension intact.
 */
function sanitiseFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 200);
}

/* ------------------------------------------------------------------ */
/*  POST                                                              */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  try {
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

    /* ---- Rate limit ---- */
    const rateResult = await checkRateLimit('upload', user.id);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Upload rate limit exceeded. Please wait before uploading again.' },
        { status: 429, headers: rateLimitHeaders(rateResult) },
      );
    }

    /* ---- Parse multipart body ---- */
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'Invalid form data' },
        { status: 400 },
      );
    }

    const file = formData.get('file');
    const caseId = formData.get('caseId');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Missing file in form data' },
        { status: 400 },
      );
    }

    if (!caseId || typeof caseId !== 'string') {
      return NextResponse.json(
        { error: 'Missing caseId in form data' },
        { status: 400 },
      );
    }

    /* ---- Validate file type ---- */
    const contentType = file.type;
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${contentType}. Allowed: PDF, JPEG, PNG, HEIC.` },
        { status: 400 },
      );
    }

    /* ---- Validate file size ---- */
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds the 10 MB size limit.' },
        { status: 400 },
      );
    }

    /* ---- Verify the case belongs to the user (RLS) ---- */
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json(
        { error: 'Case not found or access denied' },
        { status: 404 },
      );
    }

    /* ---- Upload to Supabase Storage ---- */
    const safeName = sanitiseFilename(file.name);
    const timestamp = Date.now();
    const storagePath = `${user.id}/${caseId}/${String(timestamp)}_${safeName}`;

    // Use service-role client for storage operations (avoids RLS
    // restrictions on the storage.objects table)
    const serviceClient = createServiceRoleClient();

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await serviceClient.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: 'File upload failed. Please try again.' },
        { status: 500 },
      );
    }

    /* ---- Create document record ---- */
    const insertPayload: Record<string, unknown> = {
      case_id: caseId,
      file_path: storagePath,
      content_type: contentType,
      parse_status: 'pending',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: docData, error: insertError } = await (supabase
      .from('documents') as any)
      .insert(insertPayload)
      .select('id, file_path')
      .single();

    if (insertError || !docData) {
      return NextResponse.json(
        { error: 'Failed to save document. Please try again.' },
        { status: 500 },
      );
    }

    const doc = docData as unknown as { id: string; file_path: string };

    return NextResponse.json({
      document_id: doc.id,
      file_path: doc.file_path,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
