/**
 * Tests for packet assembler.
 */

import { describe, it, expect } from 'vitest';
import {
  assemblePacket,
  resolveFieldMappings,
  loadSmallClaimsPacket,
  loadStateAgPacket,
  listAvailableCounties,
  type PacketTemplate,
  type PacketCaseData,
  type PacketForm,
} from '@/lib/packets/packet-assembler';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

const mockTemplate: PacketTemplate = {
  id: 'sc-CA-test',
  venue_type: 'small_claims',
  jurisdiction: 'CA',
  county: 'Los Angeles',
  venue_name: 'Los Angeles Superior Court — Small Claims Division',
  venue_address: '111 N Hill St, Los Angeles, CA 90012',
  venue_url: 'https://courts.ca.gov',
  monetary_limit: 12500,
  forms: [
    {
      form_id: 'SC-100',
      name: "Plaintiff's Claim",
      official_url: 'https://example.com/sc-100.pdf',
      fillable: true,
      required: true,
      copies_needed: 3,
      field_mapping: {
        'plaintiff_name': 'tenant_name',
        'defendant_name': 'landlord_name',
        'claim_amount': 'demand_amount',
      },
    },
    {
      form_id: 'SC-104',
      name: 'Declaration of Nonmilitary Status',
      official_url: 'https://example.com/sc-104.pdf',
      fillable: false,
      required: true,
      copies_needed: 1,
    },
    {
      form_id: 'SC-EXTRA',
      name: 'Optional Attachment',
      official_url: 'https://example.com/extra.pdf',
      fillable: false,
      required: false,
      copies_needed: 1,
    },
  ],
  attachments_order: [
    'Demand letter (copy)',
    'Lease agreement (copy)',
    'Move-in/move-out photos',
  ],
  filing_instructions: {
    method: 'in-person or online',
    steps: [
      'Complete SC-100 form',
      'File at the courthouse clerk window',
      'Pay filing fee',
    ],
    service_method: 'Process server or certified mail',
    service_deadline_days: 15,
  },
  fees: [
    { type: 'Filing fee', amount_range: '$30-$75' },
    { type: 'Service fee', amount_range: '$40' },
  ],
  statute_of_limitations: {
    years: 4,
    statute_ref: 'Cal. Code Civ. Proc. §337',
  },
};

const mockCaseData: PacketCaseData = {
  case_id: 'case-123',
  tenant_name: 'Jane Doe',
  landlord_name: 'John Smith',
  property_address: '123 Main St, Los Angeles, CA 90001',
  deposit_amount: 2400,
  demand_amount: 1600,
  jurisdiction: 'CA',
  county: 'Los Angeles',
  move_out_date: '2025-01-15',
};

/* ------------------------------------------------------------------ */
/*  assemblePacket                                                    */
/* ------------------------------------------------------------------ */

describe('assemblePacket', () => {
  it('generates a cover sheet with case details', () => {
    const result = assemblePacket(mockTemplate, mockCaseData);

    expect(result.cover_sheet.court_name).toBe(
      'Los Angeles Superior Court — Small Claims Division',
    );
    expect(result.cover_sheet.plaintiff).toBe('Jane Doe');
    expect(result.cover_sheet.defendant).toBe('John Smith');
    expect(result.cover_sheet.claim_amount).toBe('$1,600');
  });

  it('builds contents order with required forms first', () => {
    const result = assemblePacket(mockTemplate, mockCaseData);
    const contents = result.cover_sheet.contents;

    expect(contents[0]).toBe('Cover Sheet');
    expect(contents[1]).toContain("Plaintiff's Claim");
    expect(contents[1]).toContain('3 copies');
    expect(contents[2]).toContain('Nonmilitary');
  });

  it('includes attachments in contents', () => {
    const result = assemblePacket(mockTemplate, mockCaseData);
    const contents = result.cover_sheet.contents;

    expect(contents.some((c) => c.includes('Demand letter'))).toBe(true);
    expect(contents.some((c) => c.includes('Lease agreement'))).toBe(true);
  });

  it('includes optional forms marked as optional', () => {
    const result = assemblePacket(mockTemplate, mockCaseData);
    const contents = result.cover_sheet.contents;

    expect(
      contents.some(
        (c) => c.includes('Optional Attachment') && c.includes('if applicable'),
      ),
    ).toBe(true);
  });

  it('includes filing instructions in contents', () => {
    const result = assemblePacket(mockTemplate, mockCaseData);
    expect(result.cover_sheet.contents.includes('Filing Instructions')).toBe(
      true,
    );
  });

  it('builds filing checklist with steps and fees', () => {
    const result = assemblePacket(mockTemplate, mockCaseData);
    const checklist = result.filing_checklist;

    expect(checklist.some((c) => c.includes('SC-100'))).toBe(true);
    expect(checklist.some((c) => c.includes('filing fee'))).toBe(true);
    expect(checklist.some((c) => c.includes('Serve the defendant'))).toBe(true);
    expect(checklist.some((c) => c.includes('15 days'))).toBe(true);
  });

  it('warns when claim exceeds monetary limit', () => {
    const overLimitCase = { ...mockCaseData, demand_amount: 15000 };
    const result = assemblePacket(mockTemplate, overLimitCase);

    expect(
      result.filing_checklist.some((c) => c.includes('WARNING')),
    ).toBe(true);
    expect(
      result.filing_checklist.some((c) => c.includes('exceeds')),
    ).toBe(true);
  });

  it('does not warn when claim is under limit', () => {
    const result = assemblePacket(mockTemplate, mockCaseData);

    expect(
      result.filing_checklist.some((c) => c.includes('WARNING')),
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  resolveFieldMappings                                              */
/* ------------------------------------------------------------------ */

describe('resolveFieldMappings', () => {
  it('resolves mapped fields from case data', () => {
    const form: PacketForm = {
      form_id: 'test',
      name: 'Test',
      official_url: '',
      fillable: true,
      required: true,
      copies_needed: 1,
      field_mapping: {
        'pdf_plaintiff': 'tenant_name',
        'pdf_defendant': 'landlord_name',
        'pdf_amount': 'demand_amount',
      },
    };

    const resolved = resolveFieldMappings(form, mockCaseData);
    expect(resolved['pdf_plaintiff']).toBe('Jane Doe');
    expect(resolved['pdf_defendant']).toBe('John Smith');
    expect(resolved['pdf_amount']).toBe('1600');
  });

  it('returns empty object when no field_mapping', () => {
    const form: PacketForm = {
      form_id: 'test',
      name: 'Test',
      official_url: '',
      fillable: false,
      required: true,
      copies_needed: 1,
    };

    const resolved = resolveFieldMappings(form, mockCaseData);
    expect(Object.keys(resolved)).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  KB loaders                                                        */
/* ------------------------------------------------------------------ */

describe('loadSmallClaimsPacket', () => {
  it('loads CA Los Angeles packet', () => {
    const packet = loadSmallClaimsPacket('CA', 'los-angeles');
    expect(packet).not.toBeNull();
    expect(packet?.jurisdiction).toBe('CA');
    expect(packet?.venue_type).toBe('small_claims');
  });

  it('loads CA San Francisco packet', () => {
    const packet = loadSmallClaimsPacket('CA', 'san-francisco');
    expect(packet).not.toBeNull();
  });

  it('returns null for unknown county', () => {
    const packet = loadSmallClaimsPacket('CA', 'nonexistent-county');
    expect(packet).toBeNull();
  });
});

describe('loadStateAgPacket', () => {
  it('loads CA state AG packet', () => {
    const packet = loadStateAgPacket('CA');
    expect(packet).not.toBeNull();
    expect(packet?.venue_type).toBe('state_ag');
  });

  it('loads FL state AG packet', () => {
    const packet = loadStateAgPacket('FL');
    expect(packet).not.toBeNull();
  });
});

describe('listAvailableCounties', () => {
  it('lists CA counties', () => {
    const counties = listAvailableCounties('CA');
    expect(counties.length).toBeGreaterThanOrEqual(4);
    expect(counties.some((c) => c.toLowerCase().includes('los angeles'))).toBe(true);
  });

  it('returns empty for unsupported jurisdiction', () => {
    const counties = listAvailableCounties('ZZ');
    expect(counties).toHaveLength(0);
  });
});
