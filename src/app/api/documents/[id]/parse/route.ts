/**
 * POST /api/documents/[id]/parse
 *
 * Verifies the caller owns the document (via its case), signs a short-lived R2
 * URL, runs GPT-4o Vision extraction, and saves parsed_json / parse_status.
 *
 * Ownership: documents.getMine enforces case ownership (RLS replacement). The
 * R2 signing + document patch then use the service-gated Convex functions.
 */

import { NextResponse } from 'next/server';

import { q, currentUser, api } from '@/lib/convex/server';
import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { extractFromDocument } from '@/lib/ai/extraction';
import type { Id } from '@convex/dataModel';

const VALID_SCHEMAS = new Set(['lease_agreement', 'billing_statement', 'itemization']);

function resolveSchemaName(wedge: string): string {
  return wedge === 'subscription' ? 'billing_statement' : 'lease_agreement';
}

// This route calls Convex at request time; force-dynamic so Next does not
// evaluate it during build-time page-data collection (fails without runtime env).
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: documentId } = await params;

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const schemaParam = url.searchParams.get('schema');
    if (schemaParam && !VALID_SCHEMAS.has(schemaParam)) {
      return NextResponse.json(
        { error: `Invalid schema: '${schemaParam}'. Allowed: ${[...VALID_SCHEMAS].join(', ')}` },
        { status: 400 },
      );
    }
    const schemaOverride = schemaParam && VALID_SCHEMAS.has(schemaParam) ? schemaParam : null;

    /* ---- Fetch owned document (enforces case ownership) ---- */
    const doc = await q(api.documents.getMine, { documentId: documentId as Id<'documents'> });
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    /* ---- Fetch the case for its wedge (owned) ---- */
    const caseRow = await q(api.cases.getMine, { caseId: doc.case_id });
    if (!caseRow) {
      return NextResponse.json({ error: 'Associated case not found' }, { status: 404 });
    }

    const convex = createServiceConvexClient();
    const secret = serviceSecret();

    /* ---- Sign a 5-minute R2 URL (SEC-10) ---- */
    let imageUrl: string;
    try {
      imageUrl = await convex.action(api.service.signObject, {
        secret,
        key: doc.file_path,
        ttl: 'internal',
      });
    } catch {
      await convex.mutation(api.service.patchDocument, {
        secret,
        documentId: documentId as Id<'documents'>,
        patch: { parseStatus: 'failed' },
      });
      return NextResponse.json({ error: 'Failed to access document. Please try again.' }, { status: 500 });
    }

    /* ---- Extract via GPT-4o Vision ---- */
    const schemaName = schemaOverride ?? resolveSchemaName(caseRow.wedge);
    const result = await extractFromDocument(imageUrl, doc.content_type ?? 'image/jpeg', schemaName);

    if (result.error) {
      await convex.mutation(api.service.patchDocument, {
        secret,
        documentId: documentId as Id<'documents'>,
        patch: { parseStatus: 'failed' },
      });
      return NextResponse.json(
        { error: 'Document extraction failed. Please try again with a clearer image.' },
        { status: 500 },
      );
    }

    /* ---- Save parsed result ---- */
    await convex.mutation(api.service.patchDocument, {
      secret,
      documentId: documentId as Id<'documents'>,
      patch: {
        parsedJson: {
          schema: schemaName,
          fields: result.fields,
          raw_response: result.raw_response,
          extracted_at: new Date().toISOString(),
        },
        parseStatus: 'parsed',
      },
    });

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
