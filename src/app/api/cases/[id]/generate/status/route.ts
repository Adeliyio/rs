/**
 * GET /api/cases/[id]/generate/status
 *
 * Returns the generation job status for a case.
 * Used by the frontend to poll for completion after the generate
 * route enqueues a BullMQ job.
 *
 * Returns:
 * - state: 'waiting' | 'active' | 'completed' | 'failed' | 'not_found'
 * - position: queue position (1-based) when waiting, 0 when active
 * - queue_depth: total jobs in generation queues
 *
 * PRD §8.4: generation queue with visible position.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getJobQueuePosition,
  getGenerationQueueDepth,
} from '@/lib/queue/enqueue';

export async function GET(
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

    /* ---- Load case to verify ownership and get wedge ---- */
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, wedge, status')
      .eq('id', caseId)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const caseRow = caseData as unknown as {
      id: string;
      wedge: string;
      status: string;
    };

    /* ---- If case is already generated, return immediately ---- */
    if (caseRow.status === 'generated' || caseRow.status === 'sent') {
      return NextResponse.json({
        state: 'completed',
        position: 0,
        queue_depth: 0,
      });
    }

    /* ---- Check job status in the queue ---- */
    const jobId = `gen-${caseId}`;
    const wedge = caseRow.wedge as 'deposit' | 'subscription';

    const [jobStatus, queueDepth] = await Promise.all([
      getJobQueuePosition(jobId, wedge),
      getGenerationQueueDepth(),
    ]);

    return NextResponse.json({
      state: jobStatus.state,
      position: jobStatus.position,
      queue_depth: queueDepth,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('GET /api/cases/[id]/generate/status error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
