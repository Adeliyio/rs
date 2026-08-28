/**
 * Generates the JWT_PRIVATE_KEY and JWKS values Convex Auth needs.
 *
 * Convex Auth signs session tokens with an RS256 key pair. The private key goes
 * on the Convex deployment as JWT_PRIVATE_KEY; the public key (as a JWKS set)
 * goes on as JWKS. Without them, signUp/signIn return a 400.
 *
 * Usage:
 *   node generateKeys.mjs
 *
 * Then set the two printed values on the Convex backend (see the notes printed
 * at the end). This is the same key material `npx @convex-dev/auth` would create;
 * we generate it explicitly so it can be set on a self-hosted deployment.
 *
 * Based on the official Convex Auth manual-setup script.
 */
import { exportPKCS8, exportJWK, generateKeyPair } from 'jose';

const keys = await generateKeyPair('RS256', { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: 'sig', ...publicKey }] });

// JWT_PRIVATE_KEY must keep its newlines; Convex reads it with real line breaks.
// When setting via `npx convex env set`, pass it quoted so the newlines survive.
process.stdout.write('JWT_PRIVATE_KEY (set this exactly, keep the newlines):\n');
process.stdout.write('----------------------------------------------------\n');
process.stdout.write(privateKey);
process.stdout.write('----------------------------------------------------\n\n');
process.stdout.write('JWKS (single line):\n');
process.stdout.write('----------------------------------------------------\n');
process.stdout.write(jwks + '\n');
process.stdout.write('----------------------------------------------------\n');
