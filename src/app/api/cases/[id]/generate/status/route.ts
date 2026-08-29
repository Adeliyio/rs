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
import { q, currentUser, api } from '@/lib/convex/server';
import {
  getJobQueuePosition,
  getGenerationQueueDepth,
} from '@/lib/queue/enqueue';
import type { Id } from '@convex/dataModel';
// Calls Convex — never cache (Next 14 caches GET route handlers by default).
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    /* ---- Load case to verify ownership and get wedge ---- */
    const caseRow = await q(api.cases.getMine, { caseId: caseId as Id<'cases'> });
    if (!caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

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
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
