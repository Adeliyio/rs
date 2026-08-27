import { describe, it, expect } from 'vitest';

import {
  parseGraphResponse,
  parsePreviewResponse,
  parseCancellationResponse,
} from './anonymous-schemas';

describe('parseGraphResponse', () => {
  it('accepts a well-formed graph envelope', () => {
    const result = parseGraphResponse({
      graph: {
        version: '1.0.0',
        wedge: 'deposit',
        entry_node: 'jurisdiction',
        nodes: { jurisdiction: { id: 'jurisdiction', type: 'select' } },
      },
    });
    expect(result.graph.entry_node).toBe('jurisdiction');
  });

  it('rejects a missing entry_node', () => {
    expect(() =>
      parseGraphResponse({
        graph: { version: '1', wedge: 'deposit', nodes: {} },
      }),
    ).toThrow();
  });
});

describe('parsePreviewResponse', () => {
  it('parses a supported deposit reveal', () => {
    const result = parsePreviewResponse({
      supported: true,
      wedge: 'deposit',
      jurisdiction: 'CA',
      jurisdiction_full_name: 'California',
      deposit_amount: 1800,
      statute_count: 4,
      deadline_count: 2,
      penalty_available: true,
      sample_statute: { citation: 'Cal. Civ. Code §1950.5', title: 'Security deposits' },
    });
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.statute_count).toBe(4);
      expect(result.sample_statute?.citation).toContain('1950.5');
    }
  });

  it('parses an unsupported-jurisdiction reveal', () => {
    const result = parsePreviewResponse({
      supported: false,
      jurisdiction: 'WY',
      jurisdiction_full_name: 'Wyoming',
    });
    expect(result.supported).toBe(false);
  });

  it('accepts a null deposit_amount and null sample_statute', () => {
    const result = parsePreviewResponse({
      supported: true,
      wedge: 'deposit',
      jurisdiction: 'TX',
      jurisdiction_full_name: 'Texas',
      deposit_amount: null,
      statute_count: 3,
      deadline_count: 1,
      penalty_available: false,
      sample_statute: null,
    });
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.deposit_amount).toBeNull();
      expect(result.sample_statute).toBeNull();
    }
  });

  it('rejects a malformed response', () => {
    expect(() => parsePreviewResponse({ supported: true })).toThrow();
  });
});

describe('parseCancellationResponse', () => {
  it('parses a 3-step sequence', () => {
    const result = parseCancellationResponse({
      vertical: 'gym',
      jurisdiction: 'CA',
      steps: [
        {
          step_number: 1,
          name: 'Cancellation Request',
          subject: 'Cancellation of my membership',
          body: 'Dear [COMPANY], I am writing to cancel…',
          timing_description: 'Send today',
          citations: ['CA-ARL-1'],
        },
      ],
    });
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.citations).toEqual(['CA-ARL-1']);
  });

  it('rejects a step missing required fields', () => {
    expect(() =>
      parseCancellationResponse({
        vertical: 'gym',
        jurisdiction: 'CA',
        steps: [{ step_number: 1, name: 'x' }],
      }),
    ).toThrow();
  });
});
