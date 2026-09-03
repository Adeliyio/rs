/**
 * Regression: the deposit normalizer must read answers in the REAL persisted
 * shape — keyed by the diagnostic engine's NODE IDs, which differ from the
 * generator's field names. The third audit found the committed normalizer was
 * INERT because it read field names the engine never populates (itemization,
 * deductions, days, walkthrough all vanished; partial-return over-demanded the
 * full deposit). These tests drive normalizeDepositAnswers with the ACTUAL
 * node-id keys from kb/diagnostics/deposit-graph.json.
 */

import { describe, it, expect } from 'vitest';

import {
  normalizeDepositAnswers,
  depositDemandIsValid,
} from '@/features/deposit/generation/normalize-answers';

describe('deposit normalizer — REAL node-id-keyed shape', () => {
  it('landlord kept everything (status "nothing") → demand = full deposit', () => {
    const n = normalizeDepositAnswers({
      deposit_amount: 2000,
      received_itemization: 'nothing', // node id → itemization_status
    });
    expect(n.itemization_status).toBe('nothing');
    expect(n.amount_withheld).toBe(2000);
    expect(n.demand_amount).toBe(2000);
    expect(depositDemandIsValid(n)).toBe(true);
  });

  it('partial return WITH itemization → demand = SUM of deductions, not full deposit', () => {
    const n = normalizeDepositAnswers({
      deposit_amount: 2000,
      received_itemization: 'partial_return_with_itemization',
      // deduction_details is the NODE ID; rows carry dispute_basis / has_evidence.
      deduction_details: [
        { description: 'Carpet cleaning', amount: 300, dispute_basis: 'Normal wear and tear, not damage', has_evidence: true },
        { description: 'Repainting', amount: 200, dispute_basis: 'Pre-existing condition', has_evidence: false },
      ],
    });
    // Withheld = 300 + 200 = 500 (NOT the full 2000).
    expect(n.amount_withheld).toBe(500);
    expect(n.demand_amount).toBe(500);
    expect(n.amount_returned).toBe(1500);
    expect(depositDemandIsValid(n)).toBe(true);
  });

  it('deduction rows are mapped to the consumed shape (disputed + basis_for_dispute)', () => {
    const n = normalizeDepositAnswers({
      deposit_amount: 1000,
      received_itemization: 'partial_return_with_itemization',
      deduction_details: [
        { description: 'Cleaning', amount: 150, dispute_basis: 'Charge is excessive / inflated', has_evidence: false },
      ],
    });
    const deductions = n.deductions as Array<Record<string, unknown>>;
    expect(deductions[0]!.disputed).toBe(true);
    expect(deductions[0]!.basis_for_dispute).toBe('Charge is excessive / inflated');
    expect(deductions[0]!.amount).toBe(150);
  });

  it('itemized-partial with NO parseable deductions (Skip) does NOT over-demand', () => {
    const n = normalizeDepositAnswers({
      deposit_amount: 2000,
      received_itemization: 'partial_return_with_itemization',
      deduction_details: [], // user hit "Skip — no deductions listed"
    });
    // Must NOT fall through to demanding the whole deposit; leave underived so
    // the demand guard fails and the case routes to recovery.
    expect(depositDemandIsValid(n)).toBe(false);
  });

  it('days-since-move-out bridges the computed node-id key', () => {
    const n = normalizeDepositAnswers({
      deposit_amount: 1000,
      received_itemization: 'nothing',
      days_since_moveout_check: 45, // computed node id
    });
    expect(n.days_since_move_out).toBe(45);
  });

  it('walkthrough + forwarding booleans coerce from node-id string values', () => {
    const n = normalizeDepositAnswers({
      deposit_amount: 1000,
      received_itemization: 'nothing',
      walkthrough_done: 'false',        // node id, string
      forwarding_address: 'true',       // node id, string
    });
    expect(n.walkthrough_completed).toBe(false);
    expect(n.forwarding_address_provided).toBe(true);
  });

  it('fills tenant_name from the user when the graph did not collect it', () => {
    const n = normalizeDepositAnswers(
      { deposit_amount: 1000, received_itemization: 'nothing' },
      { userName: 'Jane Tenant' },
    );
    expect(n.tenant_name).toBe('Jane Tenant');
  });
});
