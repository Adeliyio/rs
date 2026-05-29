/* ------------------------------------------------------------------ */
/*  Tavily external API types                                         */
/* ------------------------------------------------------------------ */

export interface TavilySearchRequest {
  query: string;
  search_depth: 'basic' | 'advanced';
  include_domains: string[];
  max_results: number;
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

export interface TavilySearchResponse {
  results: TavilyResult[];
}

/**
 * Allowlist of government domains for grounding search queries.
 * Only results from these domains are used for legal citations.
 */
export const GOVERNMENT_DOMAIN_ALLOWLIST = [
  'gov',
  'ca.gov',
  'texas.gov',
  'ny.gov',
  'myflorida.com',
  'courts.ca.gov',
  'txcourts.gov',
  'nycourts.gov',
  'flcourts.org',
  'law.cornell.edu',
  'legislature.ca.gov',
  'capitol.texas.gov',
  'nysenate.gov',
  'flsenate.gov',
  'ftc.gov',
  'consumerfinance.gov',
  'hud.gov',
  'ag.ca.gov',
  'texasattorneygeneral.gov',
  'ag.ny.gov',
  'myfloridalegal.com',
] as const;

export type GovernmentDomain = (typeof GOVERNMENT_DOMAIN_ALLOWLIST)[number];
