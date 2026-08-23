/**
 * Tests for auto-refund jurisdiction check logic.
 *
 * Tests the jurisdiction validation without making real Paddle API calls.
 */

import { describe, it, expect } from 'vitest';
import { DEPOSIT_JURISDICTION } from '@/types/enums';

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
