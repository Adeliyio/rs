/**
 * POST /api/cases/[id]/packet
 *
 * Generates a filing packet for a case. Assembles the packet from
 * KB templates, generates the ZIP bundle, uploads to storage,
 * and creates a packets table record.
 *
 * Body: { venue_type: "small_claims" | "state_ag", county?: string }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptAnswersPii } from '@/lib/crypto';
import {
  loadSmallClaimsPacket,
  loadStateAgPacket,
  assemblePacket,
  type PacketCaseData,
} from '@/lib/packets/packet-assembler';
import { generatePacketBundle } from '@/lib/packets/bundle-generator';
import type { DiagnosticState } from '@/types/diagnostic.types';

export async function POST(
  request: Request,
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

    /* ---- Parse body ---- */
    const body = (await request.json()) as {
      venue_type?: string;
      county?: string;
    };

    if (!body.venue_type) {
      return NextResponse.json(
        { error: 'Missing venue_type' },
        { status: 400 },
      );
    }

    /* ---- Load case ---- */
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, wedge, jurisdiction, diagnostic_state, payment_status, status')
      .eq('id', caseId)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const caseRow = caseData as unknown as {
      id: string;
      wedge: string;
      jurisdiction: string;
      diagnostic_state: Record<string, unknown> | null;
      payment_status: string;
      status: string;
    };

    /* ---- Load packet template ---- */
    let template;
    if (body.venue_type === 'small_claims') {
      if (!body.county) {
        return NextResponse.json(
          { error: 'county is required for small_claims venue' },
          { status: 400 },
        );
      }
      template = loadSmallClaimsPacket(caseRow.jurisdiction, body.county);
    } else if (body.venue_type === 'state_ag') {
      template = loadStateAgPacket(caseRow.jurisdiction);
    } else {
      return NextResponse.json(
        { error: `Unsupported venue_type: ${body.venue_type}` },
        { status: 400 },
      );
    }

    if (!template) {
      return NextResponse.json(
        { error: `No packet template found for ${caseRow.jurisdiction} ${body.venue_type}${body.county ? ` (${body.county})` : ''}` },
        { status: 404 },
      );
    }

    /* ---- Build case data from diagnostic answers (decrypt PII) ---- */
    const diagnosticState = caseRow.diagnostic_state as DiagnosticState | null;
    const answers = decryptAnswersPii(
      (diagnosticState?.answers ?? {}) as Record<string, unknown>,
    );

    const packetCaseData: PacketCaseData = {
      case_id: caseId,
      tenant_name: (answers['tenant_name'] as string) ?? '[YOUR NAME]',
      landlord_name: (answers['landlord_name'] as string) ?? '[LANDLORD NAME]',
      property_address: (answers['property_address'] as string) ?? '[PROPERTY ADDRESS]',
      deposit_amount: (answers['original_deposit_amount'] as number) ?? 0,
      demand_amount: (answers['demand_amount'] as number) ?? (answers['amount_withheld'] as number) ?? 0,
      jurisdiction: caseRow.jurisdiction,
      county: body.county,
      move_out_date: answers['move_out_date'] as string | undefined,
      letter_sent_date: answers['letter_sent'] as string | undefined,
    };

    /* ---- Assemble packet ---- */
    const packet = assemblePacket(template, packetCaseData);

    /* ---- Load demand letter PDF if available ---- */
    let demandLetterPdf: Buffer | undefined;
    const { data: letterData } = await supabase
      .from('letters')
      .select('pdf_url')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (letterData) {
      const letterRow = letterData as unknown as { pdf_url: string | null };
      if (letterRow.pdf_url) {
        try {
          // pdf_url now stores a storage path (not a full URL) — generate
          // a short-lived signed URL for internal fetch (SEC-03 + SEC-05).
          const storagePath = letterRow.pdf_url;

          // SSRF defense (SEC-05): validate the path is a simple storage
          // path, not an arbitrary URL.  A valid storage path is a relative
          // path like "userId/caseId/demand-letter.pdf". Reject anything
          // that looks like a URL or contains protocol/host components.
          const isValidStoragePath =
            !storagePath.includes('://') &&
            !storagePath.startsWith('/') &&
            !storagePath.startsWith('\\');

          if (isValidStoragePath) {
            const { data: signedData } = await supabase.storage
              .from('documents')
              .createSignedUrl(storagePath, 5 * 60); // 5-minute TTL for internal fetch

            if (signedData?.signedUrl) {
              const pdfResponse = await fetch(signedData.signedUrl);
              if (pdfResponse.ok) {
                demandLetterPdf = Buffer.from(await pdfResponse.arrayBuffer());
              }
            }
          }
        } catch {
          // Demand letter PDF not available — continue without it
        }
      }
    }

    /* ---- Generate ZIP bundle ---- */
    const bundle = await generatePacketBundle(packet, demandLetterPdf);

    /* ---- Upload to Supabase Storage ---- */
    const storagePath = `${user.id}/${caseId}/${bundle.filename}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, bundle.buffer, {
        contentType: 'application/zip',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: 'Failed to upload filing packet. Please try again.' },
        { status: 500 },
      );
    }

    // Generate a signed URL with 15-minute TTL (SEC-03)
    const { data: packetSignedData, error: packetSignedError } =
      await supabase.storage
        .from('documents')
        .createSignedUrl(storagePath, 15 * 60); // 15 minutes

    if (packetSignedError || !packetSignedData?.signedUrl) {
      return NextResponse.json(
        { error: 'Failed to generate signed URL for packet' },
        { status: 500 },
      );
    }

    /* ---- Create packets record (store path, not URL) ---- */
    const packetPayload = {
      case_id: caseId,
      venue: template.venue_name,
      type: body.venue_type,
      bundle_url: storagePath,
      template_version: '1.0.0',
    };

    const { data: packetRecord, error: insertError } = await supabase
      .from('packets')
      // @ts-expect-error — Supabase SSR generic doesn't resolve table Insert type
      .insert(packetPayload)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to save filing packet. Please try again.' },
        { status: 500 },
      );
    }

    const packetRow = packetRecord as unknown as { id: string };

    return NextResponse.json({
      packet_id: packetRow.id,
      bundle_url: packetSignedData.signedUrl,
      filename: bundle.filename,
      file_count: bundle.file_count,
      filing_checklist: packet.filing_checklist,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/cases/[id]/packet error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
