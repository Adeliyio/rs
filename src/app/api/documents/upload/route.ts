/**
 * POST /api/documents/upload
 *
 * Accepts multipart form data (file + caseId), validates type/size, uploads to
 * Cloudflare R2 under a tenant-isolated key ({userId}/{caseId}/{filename}), and
 * creates a documents row with parse_status = 'pending'.
 *
 * Ownership: cases.getMine verifies the caller owns the case before upload.
 * Upload + record creation use the service-gated Convex functions.
 */

import { NextResponse } from 'next/server';

import { q, currentUser, api } from '@/lib/convex/server';
import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import type { Id } from '@convex/dataModel';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
]);

function sanitiseFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 200);
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateResult = await checkRateLimit('upload', user.id);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Upload rate limit exceeded. Please wait before uploading again.' },
        { status: 429, headers: rateLimitHeaders(rateResult) },
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const file = formData.get('file');
    const caseId = formData.get('caseId');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file in form data' }, { status: 400 });
    }
    if (!caseId || typeof caseId !== 'string') {
      return NextResponse.json({ error: 'Missing caseId in form data' }, { status: 400 });
    }

    const contentType = file.type;
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${contentType}. Allowed: PDF, JPEG, PNG, HEIC.` },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds the 10 MB size limit.' }, { status: 400 });
    }

    /* ---- Verify the case belongs to the user ---- */
    const caseRow = await q(api.cases.getMine, { caseId: caseId as Id<'cases'> });
    if (!caseRow) {
      return NextResponse.json({ error: 'Case not found or access denied' }, { status: 404 });
    }

    /* ---- Upload to R2 under {userId}/{caseId}/{ts}_{name} ---- */
    const safeName = sanitiseFilename(file.name);
    const storageKey = `${user.id}/${caseId}/${String(Date.now())}_${safeName}`;
    const bytes = await file.arrayBuffer();

    const convex = createServiceConvexClient();
    const secret = serviceSecret();

    try {
      await convex.action(api.service.uploadObject, {
        secret,
        key: storageKey,
        bytes,
        contentType,
      });
    } catch {
      return NextResponse.json({ error: 'File upload failed. Please try again.' }, { status: 500 });
    }

    /* ---- Create the document record ---- */
    const doc = await convex.mutation(api.service.createDocument, {
      secret,
      caseId: caseId as Id<'cases'>,
      filePath: storageKey,
      contentType,
    });

    return NextResponse.json({ document_id: doc.id, file_path: doc.file_path });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
