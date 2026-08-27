/**
 * Zod schemas for the PUBLIC anonymous diagnostic endpoints (SPEC.md M3, §6
 * "Zod at every external boundary").
 *
 * These parse the responses of:
 *   - GET  /api/diagnostic/graph        → the question graph
 *   - POST /api/diagnostic/preview      → the deterministic KB value-reveal
 *   - POST /api/diagnostic/cancellation → the $0 3-step template sequence
 *
 * The anonymous client holds diagnostic answers in memory only (no localStorage,
 * per CLAUDE.md §2.5) and never persists until the deposit email gate, so these
 * boundaries are the only external data the anonymous flow trusts.
 */

import { z } from 'zod';

/* ------------------------------------------------------------------ */
/*  GET /api/diagnostic/graph                                         */
/* ------------------------------------------------------------------ */

/**
 * The graph is a large recursive KB structure already typed as DiagnosticGraph.
 * We validate the envelope shape (a `graph` object with the fields the traversal
 * engine reads) rather than re-deriving the full discriminated union here — the
 * engine only ever touches `version`, `entry_node`, and `nodes`.
 */
const graphEnvelopeSchema = z.object({
  graph: z.object({
    version: z.string(),
    wedge: z.string(),
    description: z.string().optional(),
    entry_node: z.string(),
    nodes: z.record(z.unknown()),
  }),
});

export type GraphEnvelope = z.infer<typeof graphEnvelopeSchema>;

export function parseGraphResponse(data: unknown): GraphEnvelope {
  return graphEnvelopeSchema.parse(data);
}

/* ------------------------------------------------------------------ */
/*  POST /api/diagnostic/preview                                      */
/* ------------------------------------------------------------------ */

const sampleStatuteSchema = z
  .object({
    citation: z.string(),
    title: z.string(),
  })
  .nullable();

/** Unsupported-jurisdiction response — the endpoint returns only these fields. */
const previewUnsupportedSchema = z.object({
  supported: z.literal(false),
  jurisdiction: z.string(),
  jurisdiction_full_name: z.string(),
});

/** Supported-jurisdiction response — the full deterministic value reveal. */
const previewSupportedSchema = z.object({
  supported: z.literal(true),
  wedge: z.string(),
  jurisdiction: z.string(),
  jurisdiction_full_name: z.string(),
  deposit_amount: z.number().nullable(),
  statute_count: z.number(),
  deadline_count: z.number(),
  penalty_available: z.boolean(),
  sample_statute: sampleStatuteSchema,
});

const previewResponseSchema = z.discriminatedUnion('supported', [
  previewSupportedSchema,
  previewUnsupportedSchema,
]);

export type PreviewSupported = z.infer<typeof previewSupportedSchema>;
export type PreviewResponse = z.infer<typeof previewResponseSchema>;

export function parsePreviewResponse(data: unknown): PreviewResponse {
  return previewResponseSchema.parse(data);
}

/* ------------------------------------------------------------------ */
/*  POST /api/diagnostic/cancellation                                 */
/* ------------------------------------------------------------------ */

const cancellationStepSchema = z.object({
  step_number: z.number(),
  name: z.string(),
  subject: z.string(),
  body: z.string(),
  timing_description: z.string(),
  citations: z.array(z.string()),
});

export type CancellationStep = z.infer<typeof cancellationStepSchema>;

const cancellationResponseSchema = z.object({
  vertical: z.string(),
  jurisdiction: z.string(),
  steps: z.array(cancellationStepSchema),
});

export type CancellationResponse = z.infer<typeof cancellationResponseSchema>;

export function parseCancellationResponse(data: unknown): CancellationResponse {
  return cancellationResponseSchema.parse(data);
}
