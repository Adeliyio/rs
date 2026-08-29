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

/**
 * Sniff the actual file type from the leading bytes (magic numbers). Returns the
 * detected content type, or null if the bytes don't match a supported type — the
 * real defense against a client that lies about `file.type`.
 */
function sniffFileType(b: Uint8Array): string | null {
  if (b.length < 12) return null;
  // PDF: "%PDF"
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return 'application/pdf';
  }
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return 'image/png';
  }
  // HEIC/HEIF: bytes 4-7 are "ftyp", brand at 8-11 (heic/heif/mif1/msf1/heix/hevc)
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    // the early length >= 12 check ensures bytes 8-11 exist.
    const brand = String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!).toLowerCase();
    if (['heic', 'heif', 'mif1', 'msf1', 'heix', 'hevc', 'heim', 'heis'].includes(brand)) {
      return 'image/heic';
    }
  }
  return null;
}

// This route calls Convex at request time; force-dynamic so Next does not
// evaluate it during build-time page-data collection (fails without runtime env).
export const dynamic = 'force-dynamic';

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

    /* ---- SECURITY: verify the file's actual bytes match its claimed type ----
       The client-supplied MIME type is attacker-controlled, so arbitrary bytes
       (HTML, SVG-with-script, polyglots) could be uploaded labeled application/pdf
       and reach the vision extractor / PDF pipeline. Sniff the magic bytes. */
    const bytes = await file.arrayBuffer();
    const sniffed = sniffFileType(new Uint8Array(bytes));
    if (!sniffed) {
      return NextResponse.json(
        { error: 'File content does not match a supported type (PDF, JPEG, PNG, HEIC).' },
        { status: 400 },
      );
    }

    /* ---- Verify the case belongs to the user ---- */
    const caseRow = await q(api.cases.getMine, { caseId: caseId as Id<'cases'> });
    if (!caseRow) {
      return NextResponse.json({ error: 'Case not found or access denied' }, { status: 404 });
    }

    /* ---- Upload to R2 under {userId}/{caseId}/{ts}_{name} ---- */
    const safeName = sanitiseFilename(file.name);
    const storageKey = `${user.id}/${caseId}/${String(Date.now())}_${safeName}`;

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
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
