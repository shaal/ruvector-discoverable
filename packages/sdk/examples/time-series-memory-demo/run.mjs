#!/usr/bin/env node
// M8 v0.1 — third archetype end-to-end against @ruvector/core.
//
// Wires TimeSeriesMemory to the same in-repo @ruvector/core binding used by
// KnowledgeBase. The CAPABILITY_CATALOG / smokeCheck / value-report pattern
// is reused unchanged for the third time — that's the data point that decides
// whether the abstraction graduates to a shared module in v0.2.
//
// Run:
//   RUVECTOR_CORE_BINDING=$PWD/../../ruvector/npm/core/platforms/darwin-arm64/ruvector.node \
//   node examples/time-series-memory-demo/run.mjs

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { TimeSeriesMemory } from '../../dist/index.js';

const DIMS = 8;
const STREAM = 'sensor-temp';

const explicitBinding = process.env.RUVECTOR_CORE_BINDING
  ?? resolve(process.cwd(), '..', '..', 'ruvector', 'npm', 'core', 'platforms', 'darwin-arm64', 'ruvector.node');

if (!existsSync(explicitBinding)) {
  console.error(`@ruvector/core binding not found at ${explicitBinding}.`);
  process.exit(1);
}

// Synthetic time series: temperature-like signal with a baseline plus a
// 5-step anomalous spike near minute 60.
const SAMPLES = 30;
const T0 = Date.parse('2026-04-26T00:00:00Z');
const ONE_MIN = 60_000;
function makeSamples() {
  const out = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = T0 + i * ONE_MIN;
    const base = 0.5 + 0.05 * Math.sin(i / 4);
    const anomaly = (i >= 12 && i < 17) ? 0.6 : 0; // minutes 12..16 = anomaly
    const value = new Float32Array(DIMS);
    for (let d = 0; d < DIMS; d++) value[d] = base + anomaly * (d / DIMS) + 0.01 * Math.cos(i + d);
    out.push({ timestampMs: t, value });
  }
  return out;
}

console.log(`Opening TimeSeriesMemory (in-memory*, dims=${DIMS}, stream='${STREAM}')...`);
console.log(`  binding: ${explicitBinding}`);
console.log(`  *upstream Finding C: omitting storagePath actually writes to ./ruvector.db, not in-memory`);
const ts = await TimeSeriesMemory.create({
  streamId: STREAM,
  dimensions: DIMS,
  bindingPath: explicitBinding,
  bucketMs: ONE_MIN,
});

console.log('\n[0a] Value report BEFORE healthCheck — declared only:');
const before = await ts.getValueReport();
console.log(`  source: ${before.healthSource}`);
console.log(`  ${before.summary}`);

console.log('\n[0b] Health check (isolated probe — same shape as KB / GraphReasoner):');
const health = await ts.healthCheck();
console.log(`  ${health.summary}`);
for (const c of health.checks) {
  const icon = c.status === 'ok' ? '✓' : c.status === 'broken' ? '✗' : c.status === 'unsupported' ? '·' : '!';
  console.log(`    ${icon} ${c.name.padEnd(16)} ${c.status.padEnd(12)} ${c.detail ?? ''}`);
}

console.log('\n[1] Appending 30 samples (1 per minute, anomaly at minutes 12..16)...');
const samples = makeSamples();
const lenBefore = await ts.len();
const result = await ts.appendBatch(samples);
console.log(`  wrote ${result.written} (len ${lenBefore}→${await ts.len()})`);

console.log('\n[2] Query for the anomaly signature within minutes 0..30:');
const anomalyVec = samples[14].value; // mid-anomaly sample
const r0 = await ts.query(anomalyVec, {
  window: { fromMs: T0, toMs: T0 + 30 * ONE_MIN },
  k: 32,
});
console.log(`  ${r0.points.length} matches in window`);
for (const p of r0.points.slice(0, 5)) {
  const minute = Math.round((p.timestampMs - T0) / ONE_MIN);
  console.log(`    t=+${String(minute).padStart(2)}min  score=${p.score.toExponential(2)}  id=${p.id.slice(0, 28)}…`);
}
console.log(`  explain: ${r0.explain.path.join(' → ')} (${r0.explain.totalLatencyMs.toFixed(2)}ms)`);

console.log('\n[3] Query for the SAME signature, but window narrowed to minutes 8..18:');
const r1 = await ts.query(anomalyVec, {
  window: { fromMs: T0 + 8 * ONE_MIN, toMs: T0 + 18 * ONE_MIN },
  k: 32,
});
console.log(`  ${r1.points.length} matches in narrow window`);
console.log(`  (post-search filter — narrower windows drop more recall, see deltaIndexing dormant entry)`);

console.log('\n[4] detectChangepoints() is deferred:');
try {
  await ts.detectChangepoints();
} catch (e) {
  console.log(`  expected: ${e.constructor.name}: ${e.message.split('\n')[0].slice(0, 110)}…`);
}

console.log('\n[5] query({ changepoints: true }) is also deferred (matching message):');
try {
  await ts.query(anomalyVec, { changepoints: true });
} catch (e) {
  console.log(`  expected: ${e.constructor.name}: ${e.message.split('\n')[0].slice(0, 110)}…`);
}

console.log('\nValue report (consults cached healthCheck):');
const after = await ts.getValueReport();
console.log(`  source:      ${after.healthSource}`);
console.log(`  measured at: ${after.lastHealthCheckAt ?? '(never)'}`);
console.log(`  ${after.summary}`);
console.log(`  active:`);
for (const a of after.active) console.log(`    ✓ ${a.name.padEnd(16)} ${a.invocations} invocations  [${a.source}]`);
console.log(`  dormant (truncated):`);
for (const d of after.dormant) console.log(`    ⚠ ${d.name.padEnd(20)} — ${d.reason.slice(0, 80)}${d.reason.length > 80 ? '…' : ''}`);

console.log('\nClosing.');
await ts.close();
console.log('Done.');
