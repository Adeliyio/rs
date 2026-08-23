/**
 * Tests for Tavily client utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  hashQuery,
  isAllowedDomain,
  formatTavilyResults,
} from '@/lib/ai/tavily-client';
import type { TavilyResult } from '@/types/external/tavily.types';

describe('hashQuery', () => {
  it('returns consistent hash for same query', () => {
    expect(hashQuery('test query')).toBe(hashQuery('test query'));
  });

  it('is case-insensitive', () => {
    expect(hashQuery('Test Query')).toBe(hashQuery('test query'));
  });

  it('trims whitespace', () => {
    expect(hashQuery('  test query  ')).toBe(hashQuery('test query'));
  });

  it('returns hex string', () => {
    expect(hashQuery('test')).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('isAllowedDomain', () => {
  it('allows .gov domains', () => {
    expect(isAllowedDomain('https://www.ftc.gov/page')).toBe(true);
  });

  it('allows state gov domains', () => {
    expect(isAllowedDomain('https://leginfo.legislature.ca.gov/faces')).toBe(true);
  });

  it('allows law.cornell.edu', () => {
    expect(isAllowedDomain('https://www.law.cornell.edu/uscode')).toBe(true);
  });

  it('allows consumerfinance.gov', () => {
    expect(isAllowedDomain('https://www.consumerfinance.gov/complaint')).toBe(true);
  });

  it('rejects non-gov domains', () => {
    expect(isAllowedDomain('https://www.nolo.com/legal')).toBe(false);
  });

  it('rejects wikipedia', () => {
    expect(isAllowedDomain('https://en.wikipedia.org/wiki/FTC')).toBe(false);
  });

  it('handles invalid URLs gracefully', () => {
    expect(isAllowedDomain('not-a-url')).toBe(false);
  });

  it('handles empty string', () => {
    expect(isAllowedDomain('')).toBe(false);
  });
});

describe('formatTavilyResults', () => {
  it('formats results into grounding context', () => {
    const results: TavilyResult[] = [
      {
        title: 'FTC Consumer Protection',
        url: 'https://www.ftc.gov/consumer-protection',
        content: 'The FTC protects consumers...',
        score: 0.95,
      },
    ];

    const formatted = formatTavilyResults(results);
    expect(formatted).toContain('LIVE RETRIEVAL');
    expect(formatted).toContain('FTC Consumer Protection');
    expect(formatted).toContain('ftc.gov');
    expect(formatted).toContain('The FTC protects consumers');
  });

  it('includes published date when available', () => {
    const results: TavilyResult[] = [
      {
        title: 'Test',
        url: 'https://www.ftc.gov',
        content: 'Content',
        score: 0.9,
        published_date: '2025-01-15',
      },
    ];

    const formatted = formatTavilyResults(results);
    expect(formatted).toContain('2025-01-15');
  });

  it('returns empty string for no results', () => {
    expect(formatTavilyResults([])).toBe('');
  });

  it('truncates long content to 500 chars', () => {
    const longContent = 'A'.repeat(1000);
    const results: TavilyResult[] = [
      {
        title: 'Test',
        url: 'https://www.ftc.gov',
        content: longContent,
        score: 0.9,
      },
    ];

    const formatted = formatTavilyResults(results);
    expect(formatted.length).toBeLessThan(longContent.length);
  });
});
