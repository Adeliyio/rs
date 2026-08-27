/**
 * Tests for auto-refund jurisdiction check logic + the Polar refund shape.
 *
 * Tests the jurisdiction validation without making real Polar API calls, and
 * asserts (source-level) that the refund goes through the single Polar client
 * with the correct call shape.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEPOSIT_JURISDICTION } from '@/types/enums';

const autoRefundSource = fs.readFileSync(
  path.resolve(__dirname, '../auto-refund.ts'),
  'utf-8',
);

describe('auto-refund uses the Polar refund API', () => {
  it('refunds through the single Polar client (getPolar)', () => {
    expect(autoRefundSource).toContain("from '@/lib/payments/polar-client'");
    expect(autoRefundSource).toContain('getPolar()');
  });

  it('calls refunds.create with orderId + amount + reason', () => {
    expect(autoRefundSource).toContain('polar.refunds.create');
    expect(autoRefundSource).toContain('orderId');
    expect(autoRefundSource).toContain('amount');
    expect(autoRefundSource).toContain("reason: 'customer_request'");
  });

  it('no longer calls the Paddle transactions refund endpoint', () => {
    expect(autoRefundSource).not.toContain('paddle.com');
    expect(autoRefundSource).not.toContain('PADDLE_API_KEY');
  });
});

describe('auto-refund jurisdiction validation', () => {
  it('supports CA, TX, NY, FL', () => {
    expect(DEPOSIT_JURISDICTION).toContain('CA');
    expect(DEPOSIT_JURISDICTION).toContain('TX');
    expect(DEPOSIT_JURISDICTION).toContain('NY');
    expect(DEPOSIT_JURISDICTION).toContain('FL');
  });

  it('does not support other states', () => {
    expect(DEPOSIT_JURISDICTION).not.toContain('WA');
    expect(DEPOSIT_JURISDICTION).not.toContain('OR');
    expect(DEPOSIT_JURISDICTION).not.toContain('IL');
    expect(DEPOSIT_JURISDICTION).not.toContain('MA');
  });

  it('has exactly 4 supported jurisdictions', () => {
    expect(DEPOSIT_JURISDICTION).toHaveLength(4);
  });

  it('jurisdiction check works with includes', () => {
    const supported = DEPOSIT_JURISDICTION.includes('CA' as (typeof DEPOSIT_JURISDICTION)[number]);
    const unsupported = DEPOSIT_JURISDICTION.includes('WA' as (typeof DEPOSIT_JURISDICTION)[number]);

    expect(supported).toBe(true);
    expect(unsupported).toBe(false);
  });
});
