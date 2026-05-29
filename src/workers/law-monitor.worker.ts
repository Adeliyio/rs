/**
 * Law monitor worker — processes the LAW_MONITOR queue.
 *
 * Iterates all KB entries, queries Tavily for each statute,
 * sends both the KB snapshot and live results to GPT-4o for
 * structured diff analysis, and stores alerts when changes
 * are detected. Enqueues admin notification emails for
 * high-confidence alerts.
 *
 * Schedule: weekly repeatable job (configured in workers/index.ts).
 */

import { Worker, type Job } from 'bullmq';
import { getRedis } from '@/lib/redis';
import { QUEUE_NAMES } from '@/lib/queue/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getOpenAIClient } from '@/lib/ai/openai-client';
import { AI_CONFIG } from '@/config/ai.config';
import { searchTavily } from '@/lib/ai/tavily-client';
import { loadKbEntry } from '@/lib/kb/loader';
import { enqueueEmailDelivery } from '@/lib/queue/enqueue';
import {
  lawMonitorJobSchema,
  type LawMonitorJobPayload,
} from '@/types/jobs/law-monitor.job';
import type { Statute, KbEntry } from '@/types/kb.types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEPOSIT_JURISDICTION, WEDGE } from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  Supabase helper for tables not yet in generated types             */
/* ------------------------------------------------------------------ */

// statute_monitor_runs and statute_monitor_alerts tables are created
// in migration 00008 but are not yet in the generated Database types.
// After running `supabase gen types` these casts can be removed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): SupabaseClient<any, 'public', any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
  return createServiceRoleClient() as any;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

/** Minimum confidence to create an alert (0.0–1.0). */
const CONFIDENCE_THRESHOLD = 0.7;

/** Don't re-alert on the same statute within this many days. */
const DEDUP_WINDOW_DAYS = 7;

/* ------------------------------------------------------------------ */
/*  LLM analysis types                                                */
/* ------------------------------------------------------------------ */

interface StatuteChangeAnalysis {
  has_changed: boolean;
  confidence: number;
  severity: 'info' | 'warning' | 'critical';
  change_summary: string;
  change_details: {
    provisions_added: string[];
    provisions_removed: string[];
    provisions_modified: string[];
    effective_date_change: string | null;
    amount_or_limit_change: string | null;
  };
  source_urls: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Collects all (wedge, jurisdiction) KB entries that exist on disk.
 * Only includes deposit entries for now — subscription doesn't have
 * jurisdiction-specific statutes in the KB.
 */
function getAllKbEntries(): { wedge: string; jurisdiction: string; entry: KbEntry }[] {
  const entries: { wedge: string; jurisdiction: string; entry: KbEntry }[] = [];

  for (const wedge of WEDGE) {
    if (wedge !== 'deposit') continue; // subscription KB doesn't have per-jurisdiction statutes

    for (const jurisdiction of DEPOSIT_JURISDICTION) {
      try {
        const entry = loadKbEntry(wedge, jurisdiction);
        entries.push({ wedge, jurisdiction, entry });
      } catch {
        // eslint-disable-next-line no-console
        console.warn(`[LawMonitor] KB entry not found: ${wedge}/${jurisdiction} — skipping`);
      }
    }
  }

  return entries;
}

/**
 * Check if an alert for this statute already exists within the dedup window.
 */
async function isRecentlyAlerted(statuteId: string): Promise<boolean> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DEDUP_WINDOW_DAYS);

  const { data } = await db()
    .from('statute_monitor_alerts')
    .select('id')
    .eq('statute_id', statuteId)
    .neq('status', 'dismissed')
    .gte('created_at', cutoff.toISOString())
    .limit(1);

  return Array.isArray(data) && data.length > 0;
}

/**
 * Build the LLM prompt for comparing KB state vs. live sources.
 */
function buildComparisonPrompt(statute: Statute, tavilyContent: string): string {
  const provisions = statute.key_provisions
    .map((p) => `  - ${p.subsection}: ${p.description}`)
    .join('\n');

  return `You are a legal research assistant. Compare the following statute information from our knowledge base against live government source data to determine if the statute has been amended or changed.

## Our Knowledge Base Entry
- Citation: ${statute.citation}
- Title: ${statute.title}
- Summary: ${statute.summary}
- Last Amended (our record): ${statute.last_amended}
- Key Provisions:
${provisions}
- Official URL: ${statute.official_url}

## Live Government Source Data
${tavilyContent || 'No live data available for this statute.'}

## Task
Determine whether this statute has been amended or changed since our last recorded amendment date (${statute.last_amended}).

Focus on SUBSTANTIVE legal changes only:
- New subsections or provisions added
- Existing provisions modified (amounts, deadlines, requirements)
- Provisions repealed or removed
- Effective date changes

IGNORE:
- Formatting or numbering changes
- Restatements of existing law without substantive changes
- Temporary emergency orders that have expired

Respond with a JSON object (no markdown fences) matching this exact structure:
{
  "has_changed": boolean,
  "confidence": number between 0 and 1,
  "severity": "info" | "warning" | "critical",
  "change_summary": "plain-language summary of what changed, or 'No changes detected'",
  "change_details": {
    "provisions_added": ["list of new provisions"],
    "provisions_removed": ["list of removed provisions"],
    "provisions_modified": ["list of modified provisions with brief description"],
    "effective_date_change": "new effective date or null",
    "amount_or_limit_change": "description of amount/limit changes or null"
  },
  "source_urls": ["URLs from the live data that informed this analysis"]
}

Severity guide:
- "info": Minor clarifications, formatting changes
- "warning": Substantive changes to deadlines, amounts, or procedures
- "critical": New penalties, rights removed, major deadline changes

If no live data is available, set has_changed to false and confidence to 0.`;
}

/**
 * Send the comparison to GPT-4o and parse the structured response.
 */
async function analyzeStatuteChange(
  statute: Statute,
  tavilyContent: string,
): Promise<StatuteChangeAnalysis> {
  const openai = getOpenAIClient();
  const prompt = buildComparisonPrompt(statute, tavilyContent);

  const response = await openai.chat.completions.create({
    model: AI_CONFIG.lawMonitor.model,
    max_tokens: AI_CONFIG.lawMonitor.maxTokens,
    temperature: AI_CONFIG.lawMonitor.temperature,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.choices[0]?.message?.content?.trim() ?? '';

  try {
    return JSON.parse(content) as StatuteChangeAnalysis;
  } catch {
    // eslint-disable-next-line no-console
    console.error(`[LawMonitor] Failed to parse LLM response for ${statute.citation}:`, content.slice(0, 200));
    return {
      has_changed: false,
      confidence: 0,
      severity: 'info',
      change_summary: 'Analysis failed — could not parse LLM response',
      change_details: {
        provisions_added: [],
        provisions_removed: [],
        provisions_modified: [],
        effective_date_change: null,
        amount_or_limit_change: null,
      },
      source_urls: [],
    };
  }
}

/**
 * Build Tavily content string from search results for a statute.
 */
function formatTavilyForComparison(
  results: { title: string; url: string; content: string; published_date?: string }[],
): string {
  if (results.length === 0) return '';

  return results
    .map((r) => {
      const parts = [`Source: ${r.title}`, `URL: ${r.url}`, `Content: ${r.content.slice(0, 800)}`];
      if (r.published_date) parts.push(`Published: ${r.published_date}`);
      return parts.join('\n');
    })
    .join('\n\n---\n\n');
}

/* ------------------------------------------------------------------ */
/*  Core processing function                                          */
/* ------------------------------------------------------------------ */

async function processLawMonitor(job: Job<LawMonitorJobPayload>): Promise<void> {
  const payload = lawMonitorJobSchema.parse(job.data);
  const supabase = db();

  // eslint-disable-next-line no-console
  console.log(`[LawMonitor] Starting ${payload.run_type} run`);

  // Create monitoring run record
  const { data: runRow, error: runError } = await supabase
    .from('statute_monitor_runs')
    .insert({ status: 'running' })
    .select('id')
    .single();

  if (runError || !runRow) {
    throw new Error(`Failed to create monitor run: ${runError?.message ?? 'unknown'}`);
  }

  const runId = (runRow as { id: string }).id;
  let statutesChecked = 0;
  let changesDetected = 0;

  try {
    const kbEntries = getAllKbEntries();

    for (const { entry } of kbEntries) {
      for (const statute of entry.statutes) {
        // If manual run with specific statute_ids, filter
        if (payload.statute_ids && !payload.statute_ids.includes(statute.statute_id)) {
          continue;
        }

        // Skip statutes with no key provisions (reference-only entries)
        if (statute.key_provisions.length === 0) {
          continue;
        }

        // Check dedup window
        const recentlyAlerted = await isRecentlyAlerted(statute.statute_id);
        if (recentlyAlerted && payload.run_type === 'scheduled') {
          // eslint-disable-next-line no-console
          console.log(`[LawMonitor] Skipping ${statute.citation} — recently alerted`);
          continue;
        }

        statutesChecked++;

        // Query Tavily for live data
        const currentYear = new Date().getFullYear();
        const tavilyResults = await searchTavily({
          query: `${statute.citation} amendment ${currentYear}`,
          skipCache: true, // Always fresh for monitoring
        });

        const tavilyContent = formatTavilyForComparison(tavilyResults);

        // Analyze with LLM
        const analysis = await analyzeStatuteChange(statute, tavilyContent);

        // Only create alert if change detected with sufficient confidence
        if (analysis.has_changed && analysis.confidence >= CONFIDENCE_THRESHOLD) {
          changesDetected++;

          // Insert alert
          const { error: alertError } = await supabase
            .from('statute_monitor_alerts')
            .insert({
              run_id: runId,
              statute_id: statute.statute_id,
              citation: statute.citation,
              jurisdiction: entry.jurisdiction,
              kb_entry_id: entry.id,
              change_summary: analysis.change_summary,
              change_details: analysis.change_details,
              severity: analysis.severity,
              confidence: analysis.confidence,
              source_urls: analysis.source_urls,
            });

          if (alertError) {
            // eslint-disable-next-line no-console
            console.error(`[LawMonitor] Failed to insert alert for ${statute.citation}:`, alertError.message);
            continue;
          }

          // Enqueue admin notification email
          const adminEmails = (process.env.ADMIN_EMAILS ?? '')
            .split(',')
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean);

          for (const adminEmail of adminEmails) {
            await enqueueEmailDelivery(
              {
                to: adminEmail,
                subject: `[Action Required] Potential amendment detected: ${statute.citation}`,
                template_id: 'statute_amendment_alert',
                template_data: {
                  citation: statute.citation,
                  jurisdiction: entry.jurisdiction,
                  change_summary: analysis.change_summary,
                  severity: analysis.severity,
                  confidence: String(Math.round(analysis.confidence * 100)),
                  source_urls: analysis.source_urls.join('\n'),
                  kb_entry_id: entry.id,
                  dashboard_url: `${process.env.APP_URL ?? 'http://localhost:3000'}/admin`,
                },
              },
              `law-monitor-${statute.statute_id}-${runId}-${adminEmail}`,
            );
          }

          // eslint-disable-next-line no-console
          console.log(
            `[LawMonitor] Alert created: ${statute.citation} (${analysis.severity}, confidence: ${analysis.confidence})`,
          );
        } else {
          // eslint-disable-next-line no-console
          console.log(
            `[LawMonitor] No change: ${statute.citation} (confidence: ${analysis.confidence})`,
          );
        }

        // Rate-limit between statute checks to be a good API citizen
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Mark run as completed
    await supabase
      .from('statute_monitor_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        statutes_checked: statutesChecked,
        changes_detected: changesDetected,
      })
      .eq('id', runId);

    // eslint-disable-next-line no-console
    console.log(
      `[LawMonitor] Run complete: ${statutesChecked} statutes checked, ${changesDetected} changes detected`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Mark run as failed
    await supabase
      .from('statute_monitor_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        statutes_checked: statutesChecked,
        changes_detected: changesDetected,
        error: message,
      })
      .eq('id', runId);

    throw err; // Re-throw for BullMQ retry
  }
}

/* ------------------------------------------------------------------ */
/*  Worker factory                                                    */
/* ------------------------------------------------------------------ */

export function createLawMonitorWorker(): Worker {
  const connection = getRedis();

  const worker = new Worker(
    QUEUE_NAMES.LAW_MONITOR,
    processLawMonitor,
    {
      connection,
      concurrency: 1, // Only one monitoring run at a time
    },
  );

  worker.on('completed', (job) => {
    // eslint-disable-next-line no-console
    console.log(`[LawMonitor] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[LawMonitor] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
