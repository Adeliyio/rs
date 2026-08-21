import { defineApp } from 'convex/server';
import r2 from '@convex-dev/r2/convex.config.js';

/**
 * Convex app configuration.
 *
 * Registers the Cloudflare R2 component, which replaces Supabase Storage for
 * the `documents` bucket (evidence uploads, letter PDFs, packet ZIPs). R2
 * credentials are set as Convex environment variables:
 *   R2_TOKEN, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET
 */
const app = defineApp();
app.use(r2);

export default app;
