/**
 * POST /api/sequences/[id]/advance
 *
 * Advances a subscription email sequence to the next step.
 * Marks the current step as sent with a timestamp, increments
 * current_step, and updates the case status accordingly.
 *
 * Body: { step_number: number }
 *
 * Step transitions:
 *   step 1 sent → case status: 'sent'
 *   step 3 sent → case status: 'awaiting'
 */

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { enqueueSequenceStepEmail } from '@/lib/queue/enqueue';
import type { Tables } from '@/types/database.types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type SequenceRow = Pick<
  Tables<'sequences'>,
  'id' | 'case_id' | 'current_step' | 'steps'
>;

type CaseRow = Pick<Tables<'cases'>, 'id' | 'user_id' | 'status'>;

interface AdvanceRequestBody {
  step_number: number;
}

function isValidBody(body: unknown): body is AdvanceRequestBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'step_number' in body &&
    typeof (body as AdvanceRequestBody).step_number === 'number'
  );
}

/* ------------------------------------------------------------------ */
/*  POST                                                              */
/* ------------------------------------------------------------------ */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sequenceId } = await params;

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

    /* ---- Parse body ---- */
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    if (!isValidBody(body)) {
      return NextResponse.json(
        { error: 'Missing or invalid step_number field' },
        { status: 400 },
      );
    }

    const { step_number } = body;

    /* ---- Fetch sequence ---- */
    const { data: seqData, error: seqError } = await supabase
      .from('sequences')
      .select('id, case_id, current_step, steps')
      .eq('id', sequenceId)
      .single();

    if (seqError || !seqData) {
      return NextResponse.json(
        { error: 'Sequence not found' },
        { status: 404 },
      );
    }

    const sequenceRow = seqData as unknown as SequenceRow;

    /* ---- Validate that the user owns the case ---- */
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, user_id, status')
      .eq('id', sequenceRow.case_id)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json(
        { error: 'Case not found for this sequence' },
        { status: 404 },
      );
    }

    const caseRow = caseData as unknown as CaseRow;

    if (caseRow.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized: sequence does not belong to your case' },
        { status: 403 },
      );
    }

    /* ---- Validate step_number matches current_step ---- */
    if (step_number !== sequenceRow.current_step) {
      return NextResponse.json(
        {
          error: `Step mismatch: expected step ${sequenceRow.current_step}, got ${step_number}.`,
        },
        { status: 409 },
      );
    }

    /* ---- Update the steps JSONB with sent timestamp ---- */
    const now = new Date().toISOString();
    const stepsData = sequenceRow.steps as Record<string, unknown>;
    const sentDates = (stepsData['sent_dates'] as Record<string, string>) ?? {};
    sentDates[String(step_number)] = now;

    const updatedStepsData = {
      ...stepsData,
      sent_dates: sentDates,
    };

    /* ---- Calculate next step ---- */
    const nextStep = step_number + 1;
    const maxSteps = 3;
    const isComplete = step_number >= maxSteps;

    /* ---- Calculate next_send_at (7 days from now for step 2, 14 days for step 3) ---- */
    let nextSendAt: string | null = null;
    if (!isComplete) {
      const sendDate = new Date();
      sendDate.setDate(sendDate.getDate() + 7); // 7 days between each step
      nextSendAt = sendDate.toISOString();
    }

    /* ---- Update sequence ---- */
    const seqUpdatePayload: Record<string, unknown> = {
      current_step: isComplete ? maxSteps : nextStep,
      next_send_at: nextSendAt,
      steps: updatedStepsData,
      updated_at: now,
    };

    const { error: seqUpdateError } = await supabase
      .from('sequences')
      // @ts-expect-error — Supabase SSR generic doesn't resolve table Update type from manual Database definition
      .update(seqUpdatePayload)
      .eq('id', sequenceId);

    if (seqUpdateError) {
      // eslint-disable-next-line no-console
      console.error('Failed to update sequence:', seqUpdateError.message);
      return NextResponse.json(
        { error: 'Failed to update sequence. Please try again.' },
        { status: 500 },
      );
    }

    /* ---- Queue next-step reminder email (best-effort) ---- */
    if (!isComplete) {
      try {
        const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
        const caseUrl = `${appUrl}/case/${sequenceRow.case_id}`;
        const steps = (stepsData['steps'] as { name?: string }[]) ?? [];
        const nextStepName = steps[nextStep - 1]?.name ?? `Step ${nextStep}`;
        const companyName = (stepsData['jurisdiction'] as string) ?? 'the company';

        await enqueueSequenceStepEmail(
          user.email ?? '',
          nextStep,
          nextStepName,
          companyName,
          sequenceRow.case_id as string,
          caseUrl,
        );
      } catch (emailErr) {
        // Non-critical — log but don't fail the advance
        // eslint-disable-next-line no-console
        console.error('Failed to enqueue sequence step reminder:', emailErr);
      }
    }

    /* ---- Update case status based on which step was sent ---- */
    let newCaseStatus: string | null = null;
    const previousStatus = caseRow.status;

    if (step_number === 1) {
      newCaseStatus = 'sent';
    } else if (step_number === 3) {
      newCaseStatus = 'awaiting';
    }

    if (newCaseStatus && newCaseStatus !== previousStatus) {
      const caseUpdatePayload: Record<string, unknown> = {
        status: newCaseStatus,
        updated_at: now,
      };

      const { error: caseUpdateError } = await supabase
        .from('cases')
        // @ts-expect-error — Supabase SSR generic doesn't resolve table Update type from manual Database definition
        .update(caseUpdatePayload)
        .eq('id', sequenceRow.case_id);

      if (caseUpdateError) {
        // Non-critical — log but don't fail
        // eslint-disable-next-line no-console
        console.error(
          'Failed to update case status:',
          caseUpdateError.message,
        );
      }

      /* ---- Create status history entry ---- */
      const historyPayload: Record<string, unknown> = {
        case_id: sequenceRow.case_id,
        previous_status: previousStatus,
        new_status: newCaseStatus,
      };

      const { error: historyError } = await supabase
        .from('case_status_history')
        // @ts-expect-error — Supabase SSR generic doesn't resolve table Insert type from manual Database definition
        .insert(historyPayload);

      if (historyError) {
        // eslint-disable-next-line no-console
        console.error(
          'Failed to create case_status_history entry:',
          historyError.message,
        );
      }
    }

    return NextResponse.json({
      current_step: isComplete ? maxSteps : nextStep,
      sent_at: now,
      next_send_at: nextSendAt,
      case_status: newCaseStatus ?? previousStatus,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/sequences/[id]/advance error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
