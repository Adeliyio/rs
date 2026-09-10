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

/* ------------------------------------------------------------------ */
/*  KB → PacketTemplate normalization                                 */
/* ------------------------------------------------------------------ */

/**
 * The interfaces above describe the shape this module CONSUMES. The KB files on
 * disk are shaped differently, and the loaders used to cast straight across with
 * `JSON.parse(raw) as PacketTemplate` — so TypeScript never noticed and every
 * single template blew up at runtime:
 *
 *   - `filing_instructions.steps` is `{step_number, instruction, note}[]`, not
 *     `string[]`. Those objects flowed into a `string[]` and reached
 *     `item.split(' ')` in the instructions renderer → "item.split is not a
 *     function" → uncaught → HTTP 500. The customer saw "Internal error".
 *   - `fees` is an OBJECT (`{filing_fee, service_fee, ...}`), not an array, so
 *     the `Array.isArray` guard silently dropped ALL fee information — a
 *     customer would reach the clerk not knowing the fee or the waiver form.
 *   - `forms[].field_mapping` is `{pdf_field, source}[]`, not a record, so
 *     `Object.entries` yielded numeric keys and `resolveDataPath` threw on an
 *     object → zero fields ever filled.
 *   - `attachments_order` is `{position, description, ...}[]` and is MISSING
 *     entirely from TX/NY/FL small-claims and several AG templates → "not
 *     iterable".
 *   - `venue_address` is `{street, city, state, zip}`, not a string → would
 *     have rendered "Address: [object Object]".
 *
 * Normalizing once at the load boundary fixes every consumer without spreading
 * shape-guessing through the module, and tolerates the real drift between
 * states (FL small-claims has no `forms`; most have no `attachments_order`).
 */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (typeof value === 'number') return String(value);
  return undefined;
}

/** Flattens the KB's `{street, city, state, zip}` into one printable line. */
function normalizeVenueAddress(value: unknown): string | undefined {
  const direct = asString(value);
  if (direct) return direct;
  const addr = asRecord(value);
  const parts = [
    asString(addr['street']),
    asString(addr['city']),
    [asString(addr['state']), asString(addr['zip'])].filter(Boolean).join(' '),
  ].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/** `{step_number, instruction, note}[]` → readable strings. */
function normalizeSteps(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((step) => {
      const direct = asString(step);
      if (direct) return direct;
      const s = asRecord(step);
      const instruction = asString(s['instruction']) ?? asString(s['step']);
      if (!instruction) return undefined;
      const note = asString(s['note']);
      return note ? `${instruction} (${note})` : instruction;
    })
    .filter((s): s is string => typeof s === 'string');
}

/** `{position, description, ...}[]` → readable strings; missing → []. */
function normalizeAttachments(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const direct = asString(item);
      if (direct) return direct;
      const a = asRecord(item);
      return (
        asString(a['description']) ??
        asString(a['attachment_type']) ??
        undefined
      );
    })
    .filter((s): s is string => typeof s === 'string');
}

/** The KB fees OBJECT → the PacketFee[] this module consumes. */
function normalizeFees(value: unknown): PacketFee[] {
  if (Array.isArray(value)) {
    // Already in the consumed shape (or close enough to read).
    return value
      .map((f): PacketFee | undefined => {
        const fee = asRecord(f);
        const type = asString(fee['type']);
        const amount = asString(fee['amount_range']) ?? asString(fee['amount']);
        if (!type || !amount) return undefined;
        return {
          type,
          amount_range: amount,
          conditions: asString(fee['conditions']),
        };
      })
      .filter((f): f is PacketFee => f !== undefined);
  }

  const fees = asRecord(value);
  const out: PacketFee[] = [];

  /** filing_fee may be a number, a string, or tiered `[{...}]`. */
  const readAmount = (raw: unknown): string | undefined => {
    const direct = asString(raw);
    if (direct) return direct.startsWith('$') ? direct : `$${direct}`;
    if (Array.isArray(raw)) {
      const tiers = raw
        .map((t) => {
          const tier = asRecord(t);
          const amt = asString(tier['amount']) ?? asString(tier['fee']);
          if (!amt) return undefined;
          const cond =
            asString(tier['claim_range']) ??
            asString(tier['condition']) ??
            asString(tier['description']);
          const money = amt.startsWith('$') ? amt : `$${amt}`;
          return cond ? `${money} (${cond})` : money;
        })
        .filter((t): t is string => typeof t === 'string');
      return tiers.length > 0 ? tiers.join('; ') : undefined;
    }
    return undefined;
  };

  const filing = readAmount(fees['filing_fee']);
  if (filing) out.push({ type: 'Filing fee', amount_range: filing });

  const service = readAmount(fees['service_fee']);
  if (service) out.push({ type: 'Service fee', amount_range: service });

  if (fees['fee_waiver_available'] === true) {
    const form = asString(fees['fee_waiver_form']);
    out.push({
      type: 'Fee waiver',
      amount_range: 'Available if you cannot afford the fees',
      conditions: form ? `Submit form ${form}` : undefined,
    });
  }

  return out;
}

function normalizeForms(value: unknown): PacketForm[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw): PacketForm | undefined => {
      const f = asRecord(raw);
      const formId = asString(f['form_id']);
      const name = asString(f['name']);
      if (!formId || !name) return undefined;

      // field_mapping is `{pdf_field, source}[]` in the KB, a record here.
      const mapping: Record<string, string> = {};
      const rawMapping = f['field_mapping'];
      if (Array.isArray(rawMapping)) {
        for (const entry of rawMapping) {
          const m = asRecord(entry);
          const pdfField = asString(m['pdf_field']);
          const source = asString(m['source']);
          if (pdfField && source) mapping[pdfField] = source;
        }
      } else {
        for (const [k, v] of Object.entries(asRecord(rawMapping))) {
          const source = asString(v);
          if (source) mapping[k] = source;
        }
      }

      return {
        form_id: formId,
        name,
        official_url: asString(f['official_url']) ?? '',
        fillable: f['fillable'] === true,
        required: f['required'] !== false,
        copies_needed:
          typeof f['copies_needed'] === 'number' ? f['copies_needed'] : 1,
        field_mapping: Object.keys(mapping).length > 0 ? mapping : undefined,
      };
    })
    .filter((f): f is PacketForm => f !== undefined);
}

function normalizeFilingInstructions(value: unknown): FilingInstructions {
  const fi = asRecord(value);
  const service = asRecord(fi['service_of_process']);
  const deadline = service['deadline_days'];

  return {
    method: asString(fi['method']) ?? 'See court instructions',
    steps: normalizeSteps(fi['steps']),
    service_method:
      asString(service['method']) ?? asString(fi['service_method']),
    service_deadline_days:
      typeof deadline === 'number' ? deadline : undefined,
    service_proof_form:
      asString(service['proof_form']) ?? asString(fi['service_proof_form']),
  };
}

/**
 * Converts a raw KB packet JSON into the PacketTemplate this module consumes.
 * Tolerant by design: a missing optional block yields an empty list rather than
 * a crash, so one drifted template degrades that section instead of 500-ing the
 * whole packet.
 */
export function normalizePacketTemplate(raw: unknown): PacketTemplate {
  const t = asRecord(raw);
  const monetary = t['monetary_limit'];
  const sol = asRecord(t['statute_of_limitations']);
  const solYears = sol['years'];
  const solRef = asString(sol['statute_ref']);

  return {
    id: asString(t['id']) ?? '',
    venue_type: asString(t['venue_type']) ?? '',
    jurisdiction: asString(t['jurisdiction']) ?? '',
    county: asString(t['county']),
    venue_name: asString(t['venue_name']) ?? '',
    venue_address: normalizeVenueAddress(t['venue_address']),
    venue_url: asString(t['venue_url']),
    monetary_limit: typeof monetary === 'number' ? monetary : undefined,
    forms: normalizeForms(t['forms']),
    attachments_order: normalizeAttachments(t['attachments_order']),
    filing_instructions: normalizeFilingInstructions(t['filing_instructions']),
    fees: normalizeFees(t['fees']),
    statute_of_limitations:
      typeof solYears === 'number' && solRef
        ? { years: solYears, statute_ref: solRef }
        : undefined,
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
  // Normalize, never cast: the KB shape and the consumed shape differ on every
  // block, and the old `as PacketTemplate` hid that until it 500'd at runtime.
  return normalizePacketTemplate(JSON.parse(raw));
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
  return normalizePacketTemplate(JSON.parse(raw));
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
