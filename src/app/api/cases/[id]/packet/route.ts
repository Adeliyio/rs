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
import { q, currentUser, api } from '@/lib/convex/server';
import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { decryptAnswersPii } from '@/lib/crypto';
import {
  loadSmallClaimsPacket,
  loadStateAgPacket,
  assemblePacket,
  type PacketCaseData,
} from '@/lib/packets/packet-assembler';
import { generatePacketBundle } from '@/lib/packets/bundle-generator';
import type { DiagnosticState } from '@/types/diagnostic.types';
import type { Id } from '@convex/dataModel';

// This route calls Convex at request time; force-dynamic so Next does not
// evaluate it during build-time page-data collection (fails without runtime env).
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;

    /* ---- Auth ---- */
    const user = await currentUser();
    if (!user) {
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

    /* ---- Load case (ownership enforced by cases.getMine) ---- */
    const caseRow = await q(api.cases.getMine, { caseId: caseId as Id<'cases'> });
    if (!caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    /* ---- R-5: eligibility gate ---- */
    // Filing packets are a deposit-only escalation step and only make sense
    // AFTER the demand letter has been sent and gone unanswered. Guard against
    // building a packet for an intake/unpaid/subscription case.
    if (caseRow.wedge !== 'deposit') {
      return NextResponse.json(
        { error: 'Filing packets are only available for deposit cases.' },
        { status: 400 },
      );
    }
    const PACKET_ELIGIBLE = new Set(['sent', 'awaiting', 'escalation_drafted', 'resolved', 'closed']);
    if (!PACKET_ELIGIBLE.has(caseRow.status)) {
      return NextResponse.json(
        {
          error:
            'A filing packet is only available after your demand letter has been sent. ' +
            'Send your letter first, then escalate if the deadline passes.',
        },
        { status: 409 },
      );
    }

    const convex = createServiceConvexClient();
    const secret = serviceSecret();

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
    const letter = await q(api.letters.latestByCaseMine, { caseId: caseId as Id<'cases'> });
    if (letter?.pdf_url) {
      try {
        const storageKey = letter.pdf_url;
        // SSRF defense (SEC-05): reject anything that isn't a plain R2 key.
        const isValidKey =
          !storageKey.includes('://') &&
          !storageKey.startsWith('/') &&
          !storageKey.startsWith('\\');

        if (isValidKey) {
          const signedUrl = await convex.action(api.service.signObject, {
            secret,
            key: storageKey,
            ttl: 'internal',
          });
          const pdfResponse = await fetch(signedUrl);
          if (pdfResponse.ok) {
            demandLetterPdf = Buffer.from(await pdfResponse.arrayBuffer());
          }
        }
      } catch {
        // Demand letter PDF not available — continue without it
      }
    }

    /* ---- Generate ZIP bundle ---- */
    const bundle = await generatePacketBundle(packet, demandLetterPdf);

    /* ---- Upload to R2 ---- */
    const storageKey = `${user.id}/${caseId}/${bundle.filename}`;
    const zipBytes = new Uint8Array(bundle.buffer.byteLength);
    zipBytes.set(bundle.buffer);

    try {
      await convex.action(api.service.uploadObject, {
        secret,
        key: storageKey,
        bytes: zipBytes.buffer,
        contentType: 'application/zip',
      });
    } catch {
      return NextResponse.json(
        { error: 'Failed to upload filing packet. Please try again.' },
        { status: 500 },
      );
    }

    let bundleSignedUrl: string;
    try {
      bundleSignedUrl = await convex.action(api.service.signObject, {
        secret,
        key: storageKey,
        ttl: 'userFacing',
      });
    } catch {
      return NextResponse.json({ error: 'Failed to generate signed URL for packet' }, { status: 500 });
    }

    /* ---- Create packets record (store R2 key) ---- */
    let packetRow: { id: string };
    try {
      packetRow = await convex.mutation(api.service.createPacket, {
        secret,
        caseId: caseId as Id<'cases'>,
        venue: template.venue_name,
        type: body.venue_type,
        bundleUrl: storageKey,
        templateVersion: '1.0.0',
      });
    } catch {
      return NextResponse.json(
        { error: 'Failed to save filing packet. Please try again.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      packet_id: packetRow.id,
      bundle_url: bundleSignedUrl,
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
