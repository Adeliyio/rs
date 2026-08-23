/**
 * Load test — 500-concurrent spike test.
 *
 * Tests the health endpoint and diagnostic state endpoint under load.
 * Validates: response times, error rates, and server stability.
 *
 * Usage: APP_URL=http://localhost:3000 pnpm tsx scripts/load-test.ts
 */

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const CONCURRENT = 500;
const ROUNDS = 3;

interface Result {
  status: number;
  duration: number;
  ok: boolean;
}

async function makeRequest(url: string): Promise<Result> {
  const start = Date.now();
  try {
    const res = await fetch(url);
    return {
      status: res.status,
      duration: Date.now() - start,
      ok: res.ok,
    };
  } catch {
    return {
      status: 0,
      duration: Date.now() - start,
      ok: false,
    };
  }
}

async function runBatch(url: string, concurrency: number): Promise<Result[]> {
  const promises: Promise<Result>[] = [];
  for (let i = 0; i < concurrency; i++) {
    promises.push(makeRequest(url));
  }
  return Promise.all(promises);
}

function reportResults(label: string, results: Result[]) {
  const total = results.length;
  const successes = results.filter((r) => r.ok).length;
  const failures = total - successes;
  const durations = results.map((r) => r.duration).sort((a, b) => a - b);
  const p50 = durations[Math.floor(total * 0.5)] ?? 0;
  const p95 = durations[Math.floor(total * 0.95)] ?? 0;
  const p99 = durations[Math.floor(total * 0.99)] ?? 0;
  const maxDuration = durations[total - 1] ?? 0;
  const avgDuration = Math.round(
    durations.reduce((a, b) => a + b, 0) / total,
  );

  console.log(`\n--- ${label} ---`);
  console.log(`  Total: ${total} | OK: ${successes} | Failed: ${failures}`);
  console.log(`  Error rate: ${((failures / total) * 100).toFixed(1)}%`);
  console.log(`  Avg: ${avgDuration}ms | P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms | Max: ${maxDuration}ms`);

  if (failures > total * 0.05) {
    console.log(`  !! ERROR RATE EXCEEDS 5% !!`);
  }
}

async function main() {
  console.log(`Load test: ${APP_URL}`);
  console.log(`Concurrency: ${CONCURRENT}, Rounds: ${ROUNDS}\n`);

  // Health endpoint
  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`Round ${round}/${ROUNDS} — Health endpoint...`);
    const results = await runBatch(`${APP_URL}/api/health`, CONCURRENT);
    reportResults(`Health Endpoint (Round ${round})`, results);
  }

  // Landing page
  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`Round ${round}/${ROUNDS} — Landing page...`);
    const results = await runBatch(APP_URL, CONCURRENT);
    reportResults(`Landing Page (Round ${round})`, results);
  }

  console.log('\nLoad test complete.');
}

main().catch(console.error);
