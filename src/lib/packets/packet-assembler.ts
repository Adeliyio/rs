/**
 * Packet assembler — server-only.
 *
 * Reads packet template JSON from the KB, resolves case-specific data
 * (from diagnostic answers and generated letter), and produces a
 * structured packet ready for PDF/ZIP bundling.
 *
 * Supports: small_claims, state_ag, federal_agency venue types.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface PacketForm {
  form_id: string;
  name: string;
  official_url: string;
  fillable: boolean;
  required: boolean;
  copies_needed: number;
  field_mapping?: Record<string, string>;
}

export interface PacketFee {
  type: string;
  amount_range: string;
  conditions?: string;
}

export interface FilingInstructions {
  method: string;
  steps: string[];
  service_method?: string;
  service_deadline_days?: number;
  service_proof_form?: string;
}

export interface PacketTemplate {
  id: string;
  venue_type: string;
  jurisdiction: string;
  county?: string;
  venue_name: string;
  venue_address?: string;
  venue_url?: string;
  monetary_limit?: number;
  forms: PacketForm[];
  attachments_order: string[];
  filing_instructions: FilingInstructions;
  fees: PacketFee[];
  statute_of_limitations?: {
    years: number;
    statute_ref: string;
  };
}

export interface AssembledPacket {
  template: PacketTemplate;
  case_data: PacketCaseData;
  cover_sheet: CoverSheet;
  filing_checklist: string[];
}

export interface PacketCaseData {
  case_id: string;
  tenant_name: string;
  landlord_name: string;
  property_address: string;
  deposit_amount: number;
  demand_amount: number;
  jurisdiction: string;
  county?: string;
  move_out_date?: string;
  letter_sent_date?: string;
}

export interface CoverSheet {
  title: string;
  court_name: string;
  plaintiff: string;
  defendant: string;
  claim_amount: string;
  filing_date: string;
  contents: string[];
}

/* ------------------------------------------------------------------ */
/*  KB packet loader                                                  */
/* ------------------------------------------------------------------ */

const KB_ROOT = path.resolve(process.cwd(), 'kb');

/**
 * Loads a small-claims packet template for a specific county.
 */
export function loadSmallClaimsPacket(
  jurisdiction: string,
  county: string,
): PacketTemplate | null {
  const slug = county.toLowerCase().replace(/\s+/g, '-');
  const filePath = path.join(
    KB_ROOT,
    'deposit',
    jurisdiction.toUpperCase(),
    'packets',
    'small-claims',
    `${slug}.json`,
  );

  if (!existsSync(filePath)) return null;

  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as PacketTemplate;
}

/**
 * Loads a state AG complaint packet template.
 */
export function loadStateAgPacket(
  jurisdiction: string,
): PacketTemplate | null {
  const filePath = path.join(
    KB_ROOT,
    'deposit',
    jurisdiction.toUpperCase(),
    'packets',
    '_state-ag-complaint.json',
  );

  if (!existsSync(filePath)) return null;

  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as PacketTemplate;
}

/**
 * Lists available counties for a jurisdiction's small claims packets.
 */
export function listAvailableCounties(
  jurisdiction: string,
): string[] {
  const dirPath = path.join(
    KB_ROOT,
    'deposit',
    jurisdiction.toUpperCase(),
    'packets',
    'small-claims',
  );

  if (!existsSync(dirPath)) return [];

  return readdirSync(dirPath)
    .filter((f: string) => f.endsWith('.json'))
    .map((f: string) => f.replace('.json', '').replace(/-/g, ' '))
    .map((name: string) =>
      name
        .split(' ')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
    );
}

/* ------------------------------------------------------------------ */
/*  Packet assembly                                                   */
/* ------------------------------------------------------------------ */

/**
 * Assembles a complete packet from a template and case data.
 */
export function assemblePacket(
  template: PacketTemplate,
  caseData: PacketCaseData,
): AssembledPacket {
  // Build cover sheet
  const coverSheet: CoverSheet = {
    title: `${template.venue_type === 'small_claims' ? 'Small Claims Court' : 'Complaint'} Filing Packet`,
    court_name: template.venue_name,
    plaintiff: caseData.tenant_name,
    defendant: caseData.landlord_name,
    claim_amount: `$${caseData.demand_amount.toLocaleString()}`,
    filing_date: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    contents: buildContentsOrder(template),
  };

  // Build filing checklist
  const checklist = buildFilingChecklist(template, caseData);

  return {
    template,
    case_data: caseData,
    cover_sheet: coverSheet,
    filing_checklist: checklist,
  };
}

function buildContentsOrder(template: PacketTemplate): string[] {
  const contents: string[] = ['Cover Sheet'];

  // Required forms first
  for (const form of template.forms.filter((f) => f.required)) {
    const copies =
      form.copies_needed > 1 ? ` (${form.copies_needed} copies)` : '';
    contents.push(`${form.name}${copies}`);
  }

  // Attachments
  for (const attachment of template.attachments_order) {
    contents.push(attachment);
  }

  // Optional forms
  for (const form of template.forms.filter((f) => !f.required)) {
    contents.push(`${form.name} (if applicable)`);
  }

  contents.push('Filing Instructions');

  return contents;
}

function buildFilingChecklist(
  template: PacketTemplate,
  caseData: PacketCaseData,
): string[] {
  const checklist: string[] = [];

  // Monetary limit check
  if (
    template.monetary_limit &&
    caseData.demand_amount > template.monetary_limit
  ) {
    checklist.push(
      `WARNING: Your claim ($${caseData.demand_amount.toLocaleString()}) exceeds the court's jurisdictional limit ($${template.monetary_limit.toLocaleString()}). You may need to file in a different court or reduce your claim.`,
    );
  }

  // Forms checklist
  for (const form of template.forms.filter((f) => f.required)) {
    checklist.push(
      `Complete ${form.name} (${form.form_id})${form.copies_needed > 1 ? ` — ${form.copies_needed} copies needed` : ''}`,
    );
  }

  // Filing steps
  for (const step of template.filing_instructions.steps) {
    checklist.push(step);
  }

  // Service
  if (template.filing_instructions.service_method) {
    checklist.push(
      `Serve the defendant: ${template.filing_instructions.service_method}`,
    );
  }
  if (template.filing_instructions.service_deadline_days) {
    checklist.push(
      `Service must be completed at least ${template.filing_instructions.service_deadline_days} days before the hearing`,
    );
  }

  // Fees
  if (Array.isArray(template.fees)) {
    for (const fee of template.fees) {
      checklist.push(`Pay ${fee.type}: ${fee.amount_range}`);
    }
  }

  return checklist;
}

/* ------------------------------------------------------------------ */
/*  Field mapping resolver                                            */
/* ------------------------------------------------------------------ */

/**
 * Resolves form field mappings from case data.
 * Maps template field references (e.g., "case.tenant_name") to values.
 */
export function resolveFieldMappings(
  form: PacketForm,
  caseData: PacketCaseData,
): Record<string, string> {
  if (!form.field_mapping) return {};

  const resolved: Record<string, string> = {};

  for (const [pdfField, dataPath] of Object.entries(form.field_mapping)) {
    const value = resolveDataPath(dataPath, caseData);
    if (value !== undefined) {
      resolved[pdfField] = String(value);
    }
  }

  return resolved;
}

function resolveDataPath(
  dataPath: string,
  caseData: PacketCaseData,
): unknown {
  // Remove "case." prefix if present
  const cleanPath = dataPath.replace(/^case\./, '');
  return (caseData as unknown as Record<string, unknown>)[cleanPath];
}
