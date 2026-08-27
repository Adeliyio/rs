/**
 * Tests for the single Polar client module.
 *
 * Signature verification is now handled by the `@polar-sh/nextjs` Webhooks()
 * adapter (not this module), so these tests focus on configuration detection and
 * the product-id resolution that the checkout route depends on.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { isPolarConfigured, POLAR_PRODUCTS } from '@/lib/payments/polar-client';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('isPolarConfigured', () => {
  it('is false when no access token is set', () => {
    delete process.env.POLAR_ACCESS_TOKEN;
    expect(isPolarConfigured()).toBe(false);
  });

  it('is true when an access token is present', () => {
    process.env.POLAR_ACCESS_TOKEN = 'polar_oat_test';
    expect(isPolarConfigured()).toBe(true);
  });
});

describe('POLAR_PRODUCTS', () => {
  it('resolves each product id from its env var', () => {
    process.env.POLAR_PRODUCT_LETTER = 'prod_letter';
    process.env.POLAR_PRODUCT_MONTHLY = 'prod_monthly';
    process.env.POLAR_PRODUCT_YEARLY = 'prod_yearly';

    expect(POLAR_PRODUCTS.depositLetter()).toBe('prod_letter');
    expect(POLAR_PRODUCTS.monthlyUnlimited()).toBe('prod_monthly');
    expect(POLAR_PRODUCTS.yearlyUnlimited()).toBe('prod_yearly');
  });

  it('throws a clear error when a product id is missing', () => {
    delete process.env.POLAR_PRODUCT_LETTER;
    expect(() => POLAR_PRODUCTS.depositLetter()).toThrow('POLAR_PRODUCT_LETTER');
  });
});
