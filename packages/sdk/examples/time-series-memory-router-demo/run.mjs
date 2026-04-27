#!/usr/bin/env node
// M19 — TimeSeriesMemory over @ruvector/router (publish-ready, no env var).
//
// Mirrors knowledge-base-router-demo (M18). Runs WITHOUT RUVECTOR_CORE_BINDING.
// TSM is naturally append-only; Issue #11 (router's delete-deadlock) doesn't
// affect this archetype's normal use.
//
// Run: node examples/time-series-memory-router-demo/run.mjs

import { TimeSeriesMemory } from '../../dist/index.js';

const DIMS = 8;

console.log('Opening TimeSeriesMemory via @ruvector/router (no env var)...');
const tsm = await TimeSeriesMemory.create({
  streamId: 'router-demo',
  dimensions: DIMS,
  distanceMetric: 'Cosine',
  nativePackage: 'router',  // ← M19: dispatches to RouterKbBackend
  changepointWindow: 3,
});

console.log('\n[0] Health check (router-backed):');
const health = await tsm.healthCheck();
console.log(`  ${health.summary}`);
for (const c of health.checks.slice(0, 8)) {
  const icon = c.status === 'ok' ? '✓' : c.status === 'broken' ? '✗' : c.status === 'unsupported' ? '·' : '!';
  console.log(`    ${icon} ${c.name.padEnd(24)} ${c.status.padEnd(12)} ${(c.detail ?? '').slice(0, 60)}`);
}

console.log('\n[1] Append 20 timeseries points (1 per minute):');
const T0 = Date.parse('2026-01-01T00:00:00Z');
const oneHot = (i) => { const v = new Float32Array(DIMS); v[i % DIMS] = 1; return v; };
for (let i = 0; i < 20; i++) {
  // First 10 near oneHot(0), last 10 near oneHot(1) — clear changepoint.
  const base = i < 10 ? oneHot(0) : oneHot(1);
  const noise = new Float32Array(DIMS);
  for (let j = 0; j < DIMS; j++) noise[j] = base[j] + (Math.random() - 0.5) * 0.05;
  await tsm.append({ timestampMs: T0 + i * 60_000, value: noise });
}
console.log(`  appended 20 points, count=${await tsm.len()}`);

console.log('\n[2] Query for points near oneHot(0) (should match early window):');
const result = await tsm.query(oneHot(0), { window: { fromMs: T0, toMs: T0 + 30 * 60_000 }, k: 5 });
console.log(`  ${result.points.length} points in window`);
for (const h of result.points.slice(0, 3)) {
  const tOffset = ((h.timestampMs - T0) / 60_000).toFixed(0);
  console.log(`    t+${tOffset}min  score=${h.score.toFixed(4)}`);
}

console.log('\n[3] Changepoint detection (SDK-source ring buffer):');
const changepoints = await tsm.detectChangepoints({});
console.log(`  ${changepoints.length} changepoint(s) detected`);
for (const c of changepoints.slice(0, 3)) {
  const tOffset = ((c.timestampMs - T0) / 60_000).toFixed(0);
  console.log(`    t+${tOffset}min  confidence=${c.confidence.toFixed(2)}  ${c.note ?? ''}`);
}

console.log('\nValue report:');
const vr = await tsm.getValueReport();
console.log(`  ${vr.summary}`);

console.log('\nClosing.');
await tsm.close();
console.log('Done.');
