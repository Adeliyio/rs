import { describe, it, expect } from 'vitest';

import {
  buildCancellationPayload,
  readDepositJurisdiction,
  readDepositAmount,
  buildHydratedState,
} from './anonymous-answers';

/**
 * The in-memory answer map is keyed by NODE ID exactly as
 * state-manager.advanceState records it. These fixtures mirror the shape the
 * subscription/deposit graphs produce (group nodes → nested objects, booleans →
 * 'true'/'false' strings, currency → numbers).
 */

describe('buildCancellationPayload', () => {
  it('maps a full subscription answer set to the endpoint payload', () => {
    const answers: Record<string, unknown> = {
      jurisdiction: 'CA',
      service_vertical: 'gym',
      company_name: 'Planet Fitness',
      account_identifier: 'CUS-12345',
      subscription_details: {
        monthly_charge: 29.99,
        billing_frequency: 'Monthly',
        billing_email: 'me@example.com',
        last_charge_date: '2026-08-01',
      },
      cancellation_attempts: 'true',
      cancellation_attempt_details: {
        cancellation_date: '2026-07-15',
        cancellation_method: 'Called customer service',
        cancellation_result: 'They refused to cancel',
      },
      cancellation_effective_date: 'immediately',
      refund_request: 'true',
      refund_details: {
        refund_amount: 59.98,
        refund_reason: 'Charged after I requested cancellation',
      },
    };

    const payload = buildCancellationPayload(answers);

    expect(payload.jurisdiction).toBe('CA');
    expect(payload.vertical).toBe('gym');
    expect(payload.company_name).toBe('Planet Fitness');
    expect(payload.account_identifier).toBe('CUS-12345');
    expect(payload.monthly_charge).toBe('29.99');
    expect(payload.billing_frequency).toBe('Monthly');
    expect(payload.billing_email).toBe('me@example.com');
    expect(payload.last_charge_date).toBe('2026-08-01');
    expect(payload.cancellation_effective_date).toBe('immediately');
    expect(payload.prior_cancellation_attempt).toBe(true);
    expect(payload.cancellation_date).toBe('2026-07-15');
    expect(payload.cancellation_method).toBe('Called customer service');
    expect(payload.cancellation_result).toBe('They refused to cancel');
    expect(payload.wants_refund).toBe(true);
    expect(payload.refund_amount).toBe('59.98');
    expect(payload.refund_reason).toBe('Charged after I requested cancellation');
  });

  it('omits undefined optional fields and drops an unknown vertical', () => {
    const answers: Record<string, unknown> = {
      jurisdiction: 'ny',
      service_vertical: 'other', // not in VERTICAL enum
      company_name: 'Some Co',
      cancellation_attempts: 'false',
      cancellation_difficulty: 'cant_find_how',
    };

    const payload = buildCancellationPayload(answers);

    // Jurisdiction is passed through verbatim (endpoint upper-cases it).
    expect(payload.jurisdiction).toBe('ny');
    // 'other' is not a Vertical → vertical omitted, service_type still carried.
    expect('vertical' in payload).toBe(false);
    expect(payload.service_type).toBe('other');
    expect(payload.prior_cancellation_attempt).toBe(false);
    expect(payload.cancellation_barriers).toEqual(['cant_find_how']);
    // No refund answered → refund fields absent.
    expect('wants_refund' in payload).toBe(false);
    expect('refund_amount' in payload).toBe(false);
    // No subscription_details group → those fields absent.
    expect('monthly_charge' in payload).toBe(false);
  });
});

describe('deposit readers', () => {
  it('reads the deposit jurisdiction code', () => {
    expect(readDepositJurisdiction({ jurisdiction: 'TX' })).toBe('TX');
    expect(readDepositJurisdiction({})).toBeUndefined();
  });

  it('reads a numeric deposit amount', () => {
    expect(readDepositAmount({ deposit_amount: 1800 })).toBe(1800);
  });

  it('coerces a currency string to a number', () => {
    expect(readDepositAmount({ deposit_amount: '$1,800.50' })).toBe(1800.5);
  });

  it('returns undefined when absent or unparseable', () => {
    expect(readDepositAmount({})).toBeUndefined();
    expect(readDepositAmount({ deposit_amount: 'abc' })).toBeUndefined();
  });
});

describe('buildHydratedState', () => {
  it('carries answers + completed path to the boundary node', () => {
    const state = buildHydratedState({
      caseId: 'case_123',
      graphVersion: '1.0.0',
      boundaryNodeId: 'evidence_upload',
      answers: { jurisdiction: 'CA', deposit_amount: 1800 },
      completedNodes: ['jurisdiction', 'deposit_amount'],
    });

    expect(state.case_id).toBe('case_123');
    expect(state.graph_version).toBe('1.0.0');
    expect(state.current_node).toBe('evidence_upload');
    expect(state.answers).toEqual({ jurisdiction: 'CA', deposit_amount: 1800 });
    expect(state.completed_nodes).toEqual(['jurisdiction', 'deposit_amount']);
    expect(state.is_completed).toBe(false);
    expect(state.extracted_fields).toEqual({});
  });

  it('clones the inputs (no shared references)', () => {
    const answers = { jurisdiction: 'CA' };
    const completed = ['jurisdiction'];
    const state = buildHydratedState({
      caseId: 'c',
      graphVersion: 'v',
      boundaryNodeId: 'n',
      answers,
      completedNodes: completed,
    });
    expect(state.answers).not.toBe(answers);
    expect(state.completed_nodes).not.toBe(completed);
  });
});
