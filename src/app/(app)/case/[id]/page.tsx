/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/dot-notation, @typescript-eslint/non-nullable-type-assertion-style -- Temporary: manual Database types require these casts; remove after `pnpm db:gen-types` */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database.types';
import type { CaseStatus, Wedge } from '@/types/enums';
import type { GeneratedSequence, SequenceStep } from '@/types/generation.types';

import { CaseDetail } from '@/components/dashboard/case-detail';
import type { CaseDetailData } from '@/components/dashboard/case-detail';

import DeliveryScreen from '@/features/subscription/components/delivery-screen';
import LetterView from '@/features/deposit/components/letter-view';

import CasePageClient from './case-page-client';
import IntakeClient from './intake-client';

/**
 * Progressive single-screen case view — the status-based router.
 *
 * PRD §6.1: "Returning user, active case → that case's next-action screen."
 * PRD §7.12: "The UI surfaces only the immediate next action."
 *
 * Server component that loads the case from Supabase and routes to the
 * correct sub-view based on case.status:
 *
 *   intake             → DiagnosticShell (question-by-question)
 *   generated          → DeliveryScreen (subscription) or LetterView (deposit)
 *   sent               → CaseDetail + OutcomePrompt
 *   awaiting           → CaseDetail + OutcomePrompt + report response option
 *   escalation_drafted → CaseDetail
 *   resolved           → CaseDetail
 *   closed             → CaseDetail (with refusal info if applicable)
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type CaseRow = Tables<'cases'>;

interface SequenceRow {
  id: string;
  case_id: string;
  vertical: string;
  current_step: number;
  next_send_at: string | null;
  steps: Record<string, unknown>;
  grounding_context_ids: string[] | null;
  citation_validation: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Metadata                                                          */
/* ------------------------------------------------------------------ */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('cases')
    .select('wedge, jurisdiction')
    .eq('id', id)
    .single();

  if (!data) {
    return { title: 'Case Not Found' };
  }

  const row = data as unknown as Pick<CaseRow, 'wedge' | 'jurisdiction'>;
  const wedgeLabel =
    row.wedge === 'deposit' ? 'Deposit Recovery' : 'Subscription Cancellation';

  return {
    title: `${wedgeLabel} — ${row.jurisdiction}`,
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Maps jurisdiction → available county names from KB packet files. */
const COUNTY_MAP: Record<string, string[]> = {
  CA: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento'],
  TX: ['Harris', 'Dallas', 'Travis', 'Bexar'],
  NY: ['New York City', 'Nassau', 'Suffolk'],
  FL: ['Miami-Dade', 'Broward', 'Hillsborough'],
};

function getAvailableCounties(jurisdiction: string): string[] {
  return COUNTY_MAP[jurisdiction] ?? [];
}

function rowToSequence(row: SequenceRow): GeneratedSequence {
  const stepsData = row.steps as Record<string, unknown>;
  const stepsArray = (stepsData['steps'] as SequenceStep[]) ?? [];

  return {
    case_id: row.case_id,
    vertical: row.vertical,
    jurisdiction: (stepsData['jurisdiction'] as string) ?? '',
    steps: stepsArray,
    grounding_context_ids: row.grounding_context_ids ?? [],
    citation_validation: {
      valid: [],
      stripped: [],
      pass: true,
      ...(row.citation_validation as Record<string, unknown>),
    },
    compliance_scan_pass: true,
    created_at: row.created_at,
  };
}

function buildCaseDetailData(
  caseRow: CaseRow,
  documentsCount: number,
  hasLetter: boolean,
  hasPacket: boolean,
  letterGeneratedAt?: string,
): CaseDetailData {
  return {
    id: caseRow.id,
    wedge: caseRow.wedge as Wedge,
    jurisdiction: caseRow.jurisdiction,
    status: caseRow.status as CaseStatus,
    created_at: caseRow.created_at,
    updated_at: caseRow.updated_at,
    deposit_amount: undefined, // Would come from diagnostic_state
    landlord_name: undefined,
    provider_name: undefined,
    has_letter: hasLetter,
    has_packet: hasPacket,
    documents_count: documentsCount,
    letter_generated_at: letterGeneratedAt,
  };
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id: caseId } = await params;

  /* ---- Auth + case load ---- */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single();

  if (caseError || !caseData) {
    notFound();
  }

  const caseRow = caseData as unknown as CaseRow;
  const status = caseRow.status as CaseStatus;
  const wedge = caseRow.wedge as Wedge;

  /* ================================================================ */
  /*  STATUS: intake → DiagnosticShell                                */
  /* ================================================================ */

  if (status === 'intake') {
    return (
      <div className="page-enter">
        <IntakeClient caseId={caseId} wedge={wedge} />
      </div>
    );
  }

  /* ================================================================ */
  /*  STATUS: generated → DeliveryScreen or LetterView                */
  /* ================================================================ */

  if (status === 'generated') {
    if (wedge === 'subscription') {
      // Load the sequence from Supabase to pass to the delivery component
      const { data: seqData } = await supabase
        .from('sequences')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (seqData) {
        const seqRow = seqData as unknown as SequenceRow;
        const sequence = rowToSequence(seqRow);

        return (
          <div className="page-enter">
            <DeliveryScreen caseId={caseId} sequence={sequence} />
          </div>
        );
      }

      // Fallback: sequence not found yet — show loading state
      return (
        <div className="page-enter space-y-4">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-2/3 rounded bg-muted" />
            <div className="h-40 rounded-lg bg-muted" />
          </div>
          <p className="text-sm text-muted-foreground">
            Your cancellation emails are being generated...
          </p>
        </div>
      );
    }

    // Deposit wedge
    return (
      <div className="page-enter">
        <LetterView caseId={caseId} jurisdiction={caseRow.jurisdiction} />
      </div>
    );
  }

  /* ================================================================ */
  /*  STATUS: sent, awaiting, escalation_drafted, resolved, closed    */
  /*  → CaseDetail (+ OutcomePrompt for sent/awaiting via client)     */
  /* ================================================================ */

  // Gather supplemental data for CaseDetail
  const { count: documentsCount } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId);

  // Check for letter (deposit wedge)
  const { data: letterData } = await supabase
    .from('letters')
    .select('id, created_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const letterRow = letterData as unknown as { id: string; created_at: string } | null;

  // Check for packet
  const { data: packetData } = await supabase
    .from('packets')
    .select('id')
    .eq('case_id', caseId)
    .limit(1)
    .single();

  // Extract useful fields from diagnostic_state
  const diagnosticState = caseRow.diagnostic_state as Record<string, unknown> | null;
  const answers = (diagnosticState?.answers ?? {}) as Record<string, unknown>;

  const caseDetailData = buildCaseDetailData(
    caseRow,
    documentsCount ?? 0,
    !!letterRow,
    !!packetData,
    letterRow?.created_at,
  );

  // Enrich with diagnostic answers
  if (answers['deposit_amount'] && typeof answers['deposit_amount'] === 'number') {
    caseDetailData.deposit_amount = answers['deposit_amount'] as number;
  }
  if (answers['landlord_name'] && typeof answers['landlord_name'] === 'string') {
    caseDetailData.landlord_name = answers['landlord_name'] as string;
  }
  if (answers['company_name'] && typeof answers['company_name'] === 'string') {
    caseDetailData.provider_name = answers['company_name'] as string;
  }

  // Find when the letter/sequence was marked as sent for OutcomePrompt
  const { data: sentHistoryData } = await supabase
    .from('case_status_history')
    .select('changed_at')
    .eq('case_id', caseId)
    .eq('new_status', 'sent')
    .order('changed_at', { ascending: false })
    .limit(1)
    .single();

  const sentAt = sentHistoryData
    ? (sentHistoryData as unknown as { changed_at: string }).changed_at
    : undefined;

  // Check if statutory deadline has expired (for escalation flow)
  let deadlineExpired = false;
  if (status === 'awaiting' && wedge === 'deposit') {
    const { data: deadlineData } = await supabase
      .from('deadline_events')
      .select('fire_at, fired_at')
      .eq('case_id', caseId)
      .order('fire_at', { ascending: false })
      .limit(1)
      .single();

    if (deadlineData) {
      const deadlineRow = deadlineData as unknown as { fire_at: string; fired_at: string | null };
      deadlineExpired = new Date(deadlineRow.fire_at) <= new Date();
    } else if (sentAt) {
      // Fallback: if no deadline_events were scheduled, use a default
      // 30-day window from when the letter was sent
      const sentDate = new Date(sentAt);
      const daysSinceSent = Math.floor(
        (Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      deadlineExpired = daysSinceSent >= 30;
    }
  }

  // Load available counties from KB for escalation (deposit only)
  const availableCounties = getAvailableCounties(caseRow.jurisdiction);

  // Load packet URL if it exists
  if (packetData) {
    const { data: packetRow } = await supabase
      .from('packets')
      .select('bundle_url')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (packetRow) {
      caseDetailData.packet_url =
        (packetRow as unknown as { bundle_url: string | null }).bundle_url ?? undefined;
    }
  }

  // For sent/awaiting/escalation_drafted/resolved — use client wrapper
  // so all interactive buttons work
  if (
    status === 'sent' ||
    status === 'awaiting' ||
    status === 'escalation_drafted' ||
    status === 'resolved'
  ) {
    return (
      <div className="page-enter">
        <CasePageClient
          caseId={caseId}
          caseDetailData={caseDetailData}
          status={status}
          sentAt={sentAt}
          hasRefusal={!!caseRow.refusal_trigger}
          deadlineExpired={deadlineExpired}
          availableCounties={availableCounties}
          jurisdiction={caseRow.jurisdiction}
        />
      </div>
    );
  }

  // closed — static CaseDetail
  return (
    <div className="page-enter">
      <CaseDetail caseData={caseDetailData} />
      {status === 'closed' && caseRow.refusal_trigger && (
        <div className="mt-4 rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            This case was closed because a safety check was triggered
            ({caseRow.refusal_trigger}). If you believe this was an error,
            please contact support.
          </p>
        </div>
      )}
    </div>
  );
}
