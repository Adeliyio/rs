/**
 * Deposit regression suite — D1-D20 test cases.
 *
 * Validates KB loading, grounding context, citation validation,
 * compliance scanning, deadline computation, and packet assembly
 * for representative deposit scenarios across all 4 jurisdictions.
 */

import { describe, it, expect } from 'vitest';
import { assembleGroundingContext } from '@/lib/ai/grounding';
import { loadKbEntry } from '@/lib/kb/loader';
import { scanCompliance } from '@/lib/ai/compliance-scanner';
import { validateCitations } from '@/lib/ai/citation-validator';
import { computeDeadlines } from '@/lib/deadlines/calculator';
import { loadSmallClaimsPacket, loadStateAgPacket } from '@/lib/packets/packet-assembler';

const JURISDICTIONS = ['CA', 'TX', 'NY', 'FL'] as const;

/* ------------------------------------------------------------------ */
/*  D1-D4: KB entry loading per jurisdiction                          */
/* ------------------------------------------------------------------ */

describe('D1-D4: KB entry loading', () => {
  for (const jur of JURISDICTIONS) {
    it(`D-${jur}: loads KB entry with statutes, deadlines, penalties, venues`, () => {
      const kb = loadKbEntry('deposit', jur);

      expect(kb.statutes.length).toBeGreaterThan(0);
      expect(kb.deadline_rules.length).toBeGreaterThan(0);
      expect(kb.penalties.length).toBeGreaterThan(0);
      expect(kb.escalation_venues.length).toBeGreaterThan(0);
      expect(kb.jurisdiction).toBe(jur);
    });
  }
});

/* ------------------------------------------------------------------ */
/*  D5-D8: Grounding context assembly per jurisdiction                */
/* ------------------------------------------------------------------ */

describe('D5-D8: Grounding context assembly', () => {
  for (const jur of JURISDICTIONS) {
    it(`D-${jur}: assembles grounding context with statute IDs`, () => {
      const grounding = assembleGroundingContext('deposit', jur);

      expect(grounding.context.length).toBeGreaterThan(100);
      expect(grounding.statute_ids.length).toBeGreaterThan(0);
      expect(grounding.kb_entry_ids).toContain(`deposit-${jur}`);
      expect(grounding.context).toContain('APPLICABLE STATUTES');
      expect(grounding.context).toContain('DEADLINE RULES');
    });
  }
});

/* ------------------------------------------------------------------ */
/*  D9-D12: Compliance scanner on jurisdiction-specific text          */
/* ------------------------------------------------------------------ */

describe('D9-D12: Compliance scanning', () => {
  const compliantTexts: Record<string, string> = {
    CA: 'Under Cal. Civ. Code §1950.5(e), landlords in California are required to return the security deposit within 21 calendar days.',
    TX: 'Under Tex. Prop. Code §92.103, landlords in Texas are required to return the security deposit within 30 days.',
    NY: 'Under N.Y. Gen. Oblig. Law §7-108, landlords in New York are required to return the security deposit within 14 days.',
    FL: 'Under Fla. Stat. §83.49(3)(a), landlords in Florida who do not intend to impose a claim must return the deposit within 15 days.',
  };

  for (const jur of JURISDICTIONS) {
    it(`D-${jur}: passes compliance on valid text`, () => {
      const result = scanCompliance(compliantTexts[jur]!);
      expect(result.pass).toBe(true);
    });
  }
});

/* ------------------------------------------------------------------ */
/*  D13-D16: Deadline computation per jurisdiction                    */
/* ------------------------------------------------------------------ */

describe('D13-D16: Deadline computation', () => {
  for (const jur of JURISDICTIONS) {
    it(`D-${jur}: computes deadlines from move_out anchor`, () => {
      const kb = loadKbEntry('deposit', jur);
      const { deadlines } = computeDeadlines(
        kb.deadline_rules,
        { move_out: '2025-01-15' },
        'America/New_York',
      );

      expect(deadlines.length).toBeGreaterThan(0);
      expect(deadlines[0]!.anchor_event).toBe('move_out');
    });
  }
});

/* ------------------------------------------------------------------ */
/*  D17-D20: Packet template availability                             */
/* ------------------------------------------------------------------ */

describe('D17-D20: Packet template availability', () => {
  it('D17: CA has small claims packets', () => {
    const packet = loadSmallClaimsPacket('CA', 'los-angeles');
    expect(packet).not.toBeNull();
    expect(packet?.venue_type).toBe('small_claims');
  });

  it('D18: TX has small claims packets', () => {
    const packet = loadSmallClaimsPacket('TX', 'harris');
    expect(packet).not.toBeNull();
  });

  it('D19: All 4 states have AG complaint packets', () => {
    for (const jur of JURISDICTIONS) {
      const packet = loadStateAgPacket(jur);
      expect(packet).not.toBeNull();
      expect(packet?.venue_type).toBe('state_ag');
    }
  });

  it('D20: Citation validation works on CA statute', () => {
    const text = 'Under Cal. Civ. Code §1950.5(e), the deadline is 21 days.';
    const kb = loadKbEntry('deposit', 'CA');
    const { result } = validateCitations(
      text,
      kb.statutes.map((s) => s.statute_id),
      kb.statutes,
    );
    expect(result.valid.length).toBeGreaterThan(0);
  });
});
