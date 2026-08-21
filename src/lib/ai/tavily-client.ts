/**
 * Tavily search client — server-only.
 *
 * Provides live web retrieval for subscription grounding context
 * in states without deeply authored KB entries. Results are cached
 * in the tavily_cache table for 30 days.
 *
 * Only results from government-domain-allowlisted sites are used.
 */

import { createHash } from 'node:crypto';
import { workerConvex, api } from '@/lib/convex/worker-client';
import {
  GOVERNMENT_DOMAIN_ALLOWLIST,
  type TavilyResult,
  type TavilySearchResponse,
} from '@/types/external/tavily.types';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const TAVILY_API_URL = 'https://api.tavily.com/search';
const CACHE_TTL_DAYS = 30;
const MAX_RESULTS = 5;

/* ------------------------------------------------------------------ */
/*  Cache helpers                                                     */
/* ------------------------------------------------------------------ */

function hashQuery(query: string): string {
  return createHash('sha256').update(query.toLowerCase().trim()).digest('hex');
}

async function getCachedResults(
  queryHash: string,
): Promise<TavilyResult[] | null> {
  const cached = await workerConvex.query(api.service.getTavily, { queryHash });
  if (!cached) return null;

  // Check TTL against fetched_at.
  const fetchedAt = new Date(cached.fetched_at);
  const daysSince = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > CACHE_TTL_DAYS) {
    await workerConvex.mutation(api.service.deleteTavily, { queryHash });
    return null;
  }

  return cached.results as TavilyResult[];
}

async function setCachedResults(
  queryHash: string,
  _query: string,
  results: TavilyResult[],
): Promise<void> {
  await workerConvex.mutation(api.service.upsertTavily, {
    queryHash,
    results,
    ttlDays: CACHE_TTL_DAYS,
  });
}

/* ------------------------------------------------------------------ */
/*  Domain filtering                                                   */
/* ------------------------------------------------------------------ */

function isAllowedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return GOVERNMENT_DOMAIN_ALLOWLIST.some(
      (domain) =>
        hostname === domain ||
        hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Main search function                                              */
/* ------------------------------------------------------------------ */

export interface TavilySearchOptions {
  query: string;
  jurisdiction?: string;
  skipCache?: boolean;
}

/**
 * Searches Tavily for consumer protection information,
 * filtered to government domains only, with 30-day caching.
 *
 * @returns  Array of filtered results from government domains.
 */
export async function searchTavily(
  options: TavilySearchOptions,
): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn('[Tavily] TAVILY_API_KEY not set — skipping live retrieval');
    return [];
  }

  // Build search query with jurisdiction context
  const fullQuery = options.jurisdiction
    ? `${options.query} ${options.jurisdiction} consumer protection law`
    : options.query;

  const queryHash = hashQuery(fullQuery);

  // Check cache first
  if (!options.skipCache) {
    const cached = await getCachedResults(queryHash);
    if (cached) {
      // eslint-disable-next-line no-console
      console.log(`[Tavily] Cache hit for query: ${fullQuery.slice(0, 60)}...`);
      return cached;
    }
  }

  // Make API request
  try {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: fullQuery,
        search_depth: 'advanced',
        include_domains: [...GOVERNMENT_DOMAIN_ALLOWLIST],
        max_results: MAX_RESULTS * 2, // Request more, filter after
      }),
    });

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error(
        `[Tavily] API error: ${response.status} ${response.statusText}`,
      );
      return [];
    }

    const data = (await response.json()) as TavilySearchResponse;

    // Filter to allowed domains only
    const filtered = (data.results ?? [])
      .filter((r) => isAllowedDomain(r.url))
      .slice(0, MAX_RESULTS);

    // Cache results
    await setCachedResults(queryHash, fullQuery, filtered);

    // eslint-disable-next-line no-console
    console.log(
      `[Tavily] Fetched ${filtered.length} results for: ${fullQuery.slice(0, 60)}...`,
    );

    return filtered;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`[Tavily] Request failed: ${message}`);
    return [];
  }
}

/**
 * Formats Tavily results into a grounding context string
 * for inclusion in the generation prompt.
 */
export function formatTavilyResults(results: TavilyResult[]): string {
  if (results.length === 0) return '';

  const lines: string[] = ['=== LIVE RETRIEVAL (Government Sources) ==='];

  for (const result of results) {
    lines.push(`  Source: ${result.title}`);
    lines.push(`  URL: ${result.url}`);
    lines.push(`  Content: ${result.content.slice(0, 500)}`);
    if (result.published_date) {
      lines.push(`  Published: ${result.published_date}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Export for testing
export { hashQuery, isAllowedDomain, CACHE_TTL_DAYS };
