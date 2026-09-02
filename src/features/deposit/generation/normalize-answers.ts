/**
 * Shared normalization of diagnostic answers → deposit letter generator inputs.
 *
 * SINGLE SOURCE OF TRUTH. The sync route (generate/route.ts), the background
 * worker (generation.worker.ts), and the packet route MUST all use this so a
 * paying customer never gets a letter with "[LANDLORD NAME]", "$0", "[YOUR
 * NAME]", or a fabricated "Forwarding Address: Yes". The worker previously
 * skipped normalization entirely, so its recovery/queue-spike letters shipped
 * raw placeholders — that path is what makes the audit's verdict "BROKEN".
 *
 * What it does:
 *  - Flattens GROUP-node answers ({ [nodeId]: { field: value } }) to top level.
 *  - Maps renamed node-id keys to the generator's field names.
 *  - Coerces boolean-node string values ('true'/'false') to real booleans —
 *    critical: 'false' is a TRUTHY string, so an un-coerced "No" answer made the
 *    letter claim a forwarding address WAS provided (a false legal statement).
 *  - DERIVES the money figures the letter demands. The graph collects the
 *    deposit amount and (for partial returns) the amount returned, but NOT
 *    amount_withheld / demand_amount directly — so without derivation every
 *    letter demanded $0. For "landlord kept everything" (nothing) the whole
 *    deposit is withheld and demanded.
 *  - Fills tenant_name from the signed-in user's name (the graph never asks it),
 *    so the letter isn't signed "[YOUR NAME]".
 */

/** Coerce a boolean-node value: real boolean, or the strings 'true'/'false'. */
function asBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/** Coerce a currency/number answer to a number (answers may arrive as strings). */
function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export interface NormalizeContext {
  /** Signed-in user's display name — fills tenant_name when the graph didn't. */
  userName?: string;
}

/**
 * Normalize raw diagnostic answers into the flat, typed shape the deposit letter
 * generator reads. Never clobbers a value already present at the target key
 * (e.g. from document extraction). The original object is left intact.
 */
export function normalizeDepositAnswers(
  answers: Record<string, unknown>,
  ctx: NormalizeContext = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...answers };

  // 1. Flatten group-node answers to top level.
  const groups = ['landlord_info', 'lease_dates', 'forwarding_address_details'];
  for (const g of groups) {
    const grp = answers[g];
    if (grp && typeof grp === 'object' && !Array.isArray(grp)) {
      for (const [k, val] of Object.entries(grp as Record<string, unknown>)) {
        if (out[k] === undefined) out[k] = val;
      }
    }
  }

  // 2. Map renamed node-id keys to the generator's expected field names.
  const renames: Record<string, string> = {
    deposit_amount: 'original_deposit_amount',
    partial_amount_received: 'amount_returned',
    forwarding_address: 'forwarding_address_provided',
  };
  for (const [from, to] of Object.entries(renames)) {
    if (out[to] === undefined && answers[from] !== undefined) {
      out[to] = answers[from];
    }
  }

  // 3. Coerce boolean-node strings to real booleans (else 'false' reads truthy).
  for (const key of ['forwarding_address_provided', 'walkthrough_completed', 'itemization_received']) {
    const b = asBool(out[key]);
    if (b !== undefined) out[key] = b;
  }

  // 4. Normalize the money fields to numbers.
  const originalDeposit = asNumber(out['original_deposit_amount']);
  const amountReturned = asNumber(out['amount_returned']);
  if (originalDeposit !== undefined) out['original_deposit_amount'] = originalDeposit;
  if (amountReturned !== undefined) out['amount_returned'] = amountReturned;

  // 5. DERIVE amount_withheld and demand_amount so the letter never demands $0.
  //    amount_withheld = original - returned (or the whole deposit if nothing
  //    was returned). demand_amount defaults to the withheld amount.
  const status = out['itemization_status'];
  const keptEverything = status === 'nothing' || amountReturned === undefined || amountReturned === 0;

  let amountWithheld = asNumber(out['amount_withheld']);
  if (amountWithheld === undefined && originalDeposit !== undefined) {
    amountWithheld = keptEverything
      ? originalDeposit
      : Math.max(0, originalDeposit - (amountReturned ?? 0));
  }
  if (amountWithheld !== undefined) out['amount_withheld'] = amountWithheld;

  let demandAmount = asNumber(out['demand_amount']);
  if (demandAmount === undefined && amountWithheld !== undefined) {
    demandAmount = amountWithheld;
  }
  if (demandAmount !== undefined) out['demand_amount'] = demandAmount;

  // 6. Fill tenant_name from the user when the graph didn't collect it.
  if ((out['tenant_name'] === undefined || out['tenant_name'] === '') && ctx.userName) {
    out['tenant_name'] = ctx.userName;
  }

  return out;
}

/**
 * True when the normalized answers still can't produce a real demand — used to
 * FAIL generation loudly rather than ship a $0 letter to a paying customer.
 */
export function depositDemandIsValid(normalized: Record<string, unknown>): boolean {
  const demand = normalized['demand_amount'];
  return typeof demand === 'number' && demand > 0;
}
