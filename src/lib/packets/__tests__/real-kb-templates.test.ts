import { describe, it, expect } from 'vitest';

import {
  loadSmallClaimsPacket,
  loadStateAgPacket,
  assemblePacket,
  resolveFieldMappings,
  type PacketTemplate,
  type PacketCaseData,
} from '../packet-assembler';
import {
  generateCoverSheet,
  generateFilingInstructionsPage,
} from '../form-filler';

/**
 * Regression guard: every REAL knowledge-base packet template must assemble.
 *
 * All 18 templates used to fail with an HTTP 500 — every state, both venue
 * types. A customer who sent their demand letter, waited out the statutory
 * deadline and clicked "Begin Escalation" saw "Internal error" and got nothing,
 * against a public promise that we generate the small-claims filing packet or
 * the AG complaint.
 *
 * The cause: the TS interfaces described a shape the KB does not use, and the
 * loaders cast straight across with `JSON.parse(raw) as PacketTemplate`, so the
 * compiler never objected. `filing_instructions.steps` is an object array, not
 * `string[]`; `fees` is an object, not an array; `field_mapping` is an array,
 * not a record; `attachments_order` and `venue_address` are objects and are
 * often absent entirely.
 *
 * The existing suite passed throughout because it hand-built a `mockTemplate`
 * in the interface's (fictional) shape — it tested a shape production never
 * produces. THIS suite therefore drives the real files on disk, and asserts on
 * the real crash sites. Do not replace these fixtures with mocks.
 */

const CASE_DATA: PacketCaseData = {
  case_id: 'case_regression',
  tenant_name: 'Jane Doe',
  landlord_name: 'Acme Property Management',
  property_address: '12 Elm St, Apt 4',
  deposit_amount: 2400,
  demand_amount: 2400,
  jurisdiction: 'CA',
  county: 'Los Angeles',
  move_out_date: '2026-06-30',
  letter_sent_date: '2026-07-05',
};

const SMALL_CLAIMS: Array<[string, string]> = [
  ['CA', 'los angeles'],
  ['CA', 'sacramento'],
  ['CA', 'san diego'],
  ['CA', 'san francisco'],
  ['TX', 'harris'],
  ['TX', 'dallas'],
  ['TX', 'travis'],
  ['TX', 'bexar'],
  ['NY', 'new york city'],
  ['NY', 'nassau'],
  ['NY', 'suffolk'],
  ['FL', 'miami dade'],
  ['FL', 'broward'],
  ['FL', 'hillsborough'],
];

const AG_STATES = ['CA', 'TX', 'NY', 'FL'];

/** Runs the full production path for one template. */
async function assembleAndRender(template: PacketTemplate): Promise<string[]> {
  const packet = assemblePacket(template, {
    ...CASE_DATA,
    jurisdiction: template.jurisdiction,
    county: template.county,
  });

  // These two are where the object-shaped steps actually blew up.
  await generateCoverSheet(
    packet.cover_sheet.title,
    packet.cover_sheet.court_name,
    packet.cover_sheet.plaintiff,
    packet.cover_sheet.defendant,
    packet.cover_sheet.claim_amount,
    packet.cover_sheet.contents,
  );
  await generateFilingInstructionsPage(
    packet.filing_checklist,
    template.venue_name,
    template.venue_address,
    template.venue_url,
  );

  return packet.filing_checklist;
}

describe.each(SMALL_CLAIMS)(
  'small-claims packet: %s / %s',
  (jurisdiction, county) => {
    it('loads, assembles and renders without throwing', async () => {
      const template = loadSmallClaimsPacket(jurisdiction, county);
      expect(template).not.toBeNull();
      const checklist = await assembleAndRender(template!);
      expect(checklist.length).toBeGreaterThan(0);
    });

    it('produces a checklist of STRINGS only (was: objects → item.split crash)', () => {
      const template = loadSmallClaimsPacket(jurisdiction, county)!;
      const packet = assemblePacket(template, CASE_DATA);
      for (const item of packet.filing_checklist) {
        expect(typeof item).toBe('string');
      }
    });

    it('carries fee information through (was: silently dropped)', () => {
      const template = loadSmallClaimsPacket(jurisdiction, county)!;
      expect(Array.isArray(template.fees)).toBe(true);
      expect(template.fees.length).toBeGreaterThan(0);
      for (const fee of template.fees) {
        expect(typeof fee.type).toBe('string');
        expect(typeof fee.amount_range).toBe('string');
      }
    });

    it('exposes filing steps as readable strings', () => {
      const template = loadSmallClaimsPacket(jurisdiction, county)!;
      expect(template.filing_instructions.steps.length).toBeGreaterThan(0);
      for (const step of template.filing_instructions.steps) {
        expect(typeof step).toBe('string');
        expect(step.length).toBeGreaterThan(0);
      }
    });

    it('renders venue_address as a string, never [object Object]', () => {
      const template = loadSmallClaimsPacket(jurisdiction, county)!;
      if (template.venue_address !== undefined) {
        expect(typeof template.venue_address).toBe('string');
        expect(template.venue_address).not.toContain('[object Object]');
      }
    });
  },
);

describe.each(AG_STATES)('AG complaint packet: %s', (jurisdiction) => {
  it('loads, assembles and renders without throwing', async () => {
    const template = loadStateAgPacket(jurisdiction);
    expect(template).not.toBeNull();
    const checklist = await assembleAndRender(template!);
    expect(checklist.length).toBeGreaterThan(0);
  });

  it('produces a checklist of STRINGS only', () => {
    const template = loadStateAgPacket(jurisdiction)!;
    const packet = assemblePacket(template, CASE_DATA);
    for (const item of packet.filing_checklist) {
      expect(typeof item).toBe('string');
    }
  });
});

describe('field mappings resolve against real KB forms', () => {
  it('fills real fields for a fillable form (was: zero, always)', () => {
    // LA's SC-100 is the canonical fillable form with a real field_mapping.
    const template = loadSmallClaimsPacket('CA', 'los angeles')!;
    const fillable = template.forms.filter((f) => f.field_mapping);
    expect(fillable.length).toBeGreaterThan(0);

    const totalMapped = fillable.reduce(
      (n, form) => n + Object.keys(resolveFieldMappings(form, CASE_DATA)).length,
      0,
    );
    expect(totalMapped).toBeGreaterThan(0);
  });

  it('never yields numeric keys from an array field_mapping', () => {
    const template = loadSmallClaimsPacket('CA', 'los angeles')!;
    for (const form of template.forms) {
      for (const key of Object.keys(form.field_mapping ?? {})) {
        expect(key).not.toMatch(/^\d+$/);
      }
    }
  });
});
