/**
 * Field-level encryption for PII — server-only.
 *
 * Uses AES-256-GCM to encrypt sensitive fields within diagnostic_state.answers
 * before they are stored in the database. Decrypts them when read back.
 *
 * Encrypted values are stored as a prefixed string:
 *   "enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>"
 *
 * The "enc:v1:" prefix allows the decryption layer to distinguish encrypted
 * values from plaintext (for backwards compatibility with existing data).
 *
 * VULN-02 mitigation: ensures PII is encrypted at rest in Supabase.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag
const ENCRYPTED_PREFIX = 'enc:v1:';

/**
 * PII field names that must be encrypted before database storage.
 * These fields appear as keys in diagnostic_state.answers.
 */
export const PII_FIELDS = new Set([
  // Deposit PII
  'tenant_name',
  'property_address',
  'landlord_name',
  'landlord_address',
  'forwarding_address_date',

  // Subscription PII
  'account_identifier',
  'billing_email',

  // Shared PII
  'additional_details',
  'additional_context',
]);

/* ------------------------------------------------------------------ */
/*  Key management                                                    */
/* ------------------------------------------------------------------ */

let _keyBuffer: Buffer | null = null;

/**
 * Returns the 32-byte encryption key from the ENCRYPTION_KEY env var.
 * The env var must be a 64-character hex string (32 bytes).
 * Caches the parsed buffer after first call.
 */
function getKey(): Buffer {
  if (_keyBuffer) return _keyBuffer;

  const keyHex = process.env.ENCRYPTION_KEY ?? '';

  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  _keyBuffer = Buffer.from(keyHex, 'hex');

  if (_keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY decoded to wrong length. Must be exactly 32 bytes.');
  }

  return _keyBuffer;
}

/* ------------------------------------------------------------------ */
/*  Core encrypt / decrypt                                            */
/* ------------------------------------------------------------------ */

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @returns Prefixed ciphertext string: "enc:v1:<iv>:<tag>:<ciphertext>"
 */
export function encryptValue(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a value produced by encryptValue().
 * Returns the original plaintext string.
 *
 * @throws If the ciphertext is malformed or the key/tag is wrong.
 */
export function decryptValue(ciphertext: string): string {
  const key = getKey();

  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error('Value does not have the expected encryption prefix.');
  }

  const payload = ciphertext.slice(ENCRYPTED_PREFIX.length);
  const parts = payload.split(':');

  if (parts.length !== 3) {
    throw new Error('Malformed encrypted value: expected iv:tag:ciphertext');
  }

  const [ivHex, tagHex, dataHex] = parts;

  const iv = Buffer.from(ivHex!, 'hex');
  const authTag = Buffer.from(tagHex!, 'hex');
  const encrypted = Buffer.from(dataHex!, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/* ------------------------------------------------------------------ */
/*  Detection helper                                                  */
/* ------------------------------------------------------------------ */

/**
 * Returns true if the value looks like an encrypted string produced
 * by this module. Used for backwards compatibility — plaintext values
 * from before encryption was enabled pass through unchanged.
 */
export function isEncrypted(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

/* ------------------------------------------------------------------ */
/*  Answers-level encrypt / decrypt                                   */
/* ------------------------------------------------------------------ */

/**
 * Encrypts PII fields within a diagnostic answers object.
 * Non-PII fields and non-string PII values are left unchanged.
 * Already-encrypted values are not double-encrypted.
 *
 * Returns a new object — does not mutate the input.
 */
export function encryptAnswersPii(
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(answers)) {
    if (PII_FIELDS.has(key) && typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
      result[key] = encryptValue(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Decrypts PII fields within a diagnostic answers object.
 * Plaintext values (from before encryption was enabled) pass through
 * unchanged for backwards compatibility.
 *
 * Returns a new object — does not mutate the input.
 */
export function decryptAnswersPii(
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(answers)) {
    if (PII_FIELDS.has(key) && isEncrypted(value)) {
      result[key] = decryptValue(value as string);
    } else {
      result[key] = value;
    }
  }

  return result;
}
