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

  // 2. Map renamed NODE-ID keys to the generator's field names. The diagnostic
  //    engine keys every answer by the NODE id, which differs from the field
  //    name the letter generator reads. Missing these aliases is why the letter
  //    silently dropped itemization/deductions/days/walkthrough (audit round 3).
  const renames: Record<string, string> = {
    deposit_amount: 'original_deposit_amount',
    partial_amount_received: 'amount_returned',
    forwarding_address: 'forwarding_address_provided',
    received_itemization: 'itemization_status',   // select node id → field
    deduction_details: 'deductions',              // deduction_table node id → field
    walkthrough_done: 'walkthrough_completed',    // boolean node id → field
    // Computed days-since-move-out lives under either computed node id depending
    // on the branch; both carry the same value.
    days_since_moveout_check: 'days_since_move_out',
    days_since_moveout_deduction_path: 'days_since_move_out',
    days_since_moveout: 'days_since_move_out',
  };
  for (const [from, to] of Object.entries(renames)) {
    if (out[to] === undefined && answers[from] !== undefined) {
      out[to] = answers[from];
    }
  }

  // 2b. Map deduction ROWS to the shape the letter consumes. The table collects
  //     only DISPUTED deductions with { description, amount, dispute_basis,
  //     has_evidence }; the generator reads { description, amount, disputed,
  //     basis_for_dispute }. Without this every disputed charge rendered as
  //     "Accepted" (disputed defaulted false).
  if (Array.isArray(out['deductions'])) {
    out['deductions'] = (out['deductions'] as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      description: row.description ?? row['description'],
      amount: asNumber(row.amount) ?? row.amount,
      disputed: true,
      basis_for_dispute:
        (row.basis_for_dispute as string | undefined) ??
        (row.dispute_basis as string | undefined),
    }));
  }

  // 3. Coerce boolean-node strings to real booleans (else 'false' reads truthy).
  for (const key of ['forwarding_address_provided', 'walkthrough_completed', 'itemization_received']) {
    const b = asBool(out[key]);
    if (b !== undefined) out[key] = b;
  }

  // 3b. Normalize the computed days value to a number.
  const days = asNumber(out['days_since_move_out']);
  if (days !== undefined) out['days_since_move_out'] = days;

  // 4. Normalize the money fields to numbers.
  const originalDeposit = asNumber(out['original_deposit_amount']);
  const amountReturned = asNumber(out['amount_returned']);
  if (originalDeposit !== undefined) out['original_deposit_amount'] = originalDeposit;
  if (amountReturned !== undefined) out['amount_returned'] = amountReturned;

  // 5. DERIVE amount_withheld and demand_amount so the letter demands the RIGHT
  //    figure — never $0, and never the whole deposit when part was returned.
  //    The itemization_status determines how the money splits:
  //
  //    - 'partial_return_with_itemization': the graph routes to deduction_details
  //      and NEVER collects amount_returned. Deriving "kept everything" here
  //      wrongly demanded the FULL deposit. Instead, withheld = sum(deductions),
  //      and returned = deposit − withheld. (The tenant disputes the deductions;
  //      the demand is the itemized/withheld amount.)
  //    - 'nothing' (landlord returned nothing): the whole deposit is withheld.
  //    - partial-with-a-returned-amount: withheld = deposit − returned.
  const status = out['itemization_status'];
  const deductions = Array.isArray(out['deductions'])
    ? (out['deductions'] as Array<{ amount?: unknown }>)
    : [];
  const sumDeductions = deductions.reduce<number>((acc, d) => {
    const n = asNumber(d?.amount);
    return acc + (n ?? 0);
  }, 0);

  // ONLY partial_return_with_itemization splits by deductions (landlord returned
  // part + itemized the rest). 'letter_only' means the landlord kept EVERYTHING
  // and just mailed an itemization — the whole deposit is withheld and no money
  // was returned, so it must NOT go through the deduction-split path (that
  // fabricated an "Amount Returned" and under-demanded).
  let amountWithheld = asNumber(out['amount_withheld']);
  if (amountWithheld === undefined) {
    if (status === 'partial_return_with_itemization') {
      if (sumDeductions > 0) {
        // Withheld = the disputed itemized amount, capped at the deposit (a demand
        // exceeding what was ever paid is facially contradictory). Returned = rest.
        amountWithheld =
          originalDeposit !== undefined
            ? Math.min(sumDeductions, originalDeposit)
            : sumDeductions;
        if (amountReturned === undefined && originalDeposit !== undefined) {
          out['amount_returned'] = Math.max(0, originalDeposit - amountWithheld);
        }
      }
      // else: itemized-partial with NO parseable deductions (user hit "Skip").
      // Leave underived → the demand guard fails → routes to recovery, rather
      // than fabricating a full-deposit demand that contradicts their own facts.
    } else if (originalDeposit !== undefined) {
      // nothing / letter_only / partial-with-returned-amount.
      const keptEverything =
        status === 'nothing' ||
        status === 'letter_only' ||
        amountReturned === undefined ||
        amountReturned === 0;
      amountWithheld = keptEverything
        ? originalDeposit
        : Math.max(0, originalDeposit - amountReturned);
    }
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
 * True when the normalized answers produce a SANE demand — a positive amount that
 * does not exceed the original deposit. Used to FAIL generation loudly (→ recovery)
 * rather than ship a $0, or an impossible over-deposit, letter to a paying customer.
 */
export function depositDemandIsValid(normalized: Record<string, unknown>): boolean {
  const demand = normalized['demand_amount'];
  if (typeof demand !== 'number' || demand <= 0) return false;
  // A demand with no known (positive) deposit is never a valid deliverable — a
  // letter stating "Original Deposit: $0 / Amount Demanded: $500" is facially
  // contradictory. Require a positive deposit and demand <= deposit.
  const deposit = normalized['original_deposit_amount'];
  if (typeof deposit !== 'number' || deposit <= 0) return false;
  if (demand > deposit) return false;
  return true;
}
