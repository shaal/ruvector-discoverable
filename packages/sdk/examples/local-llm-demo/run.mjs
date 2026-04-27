#!/usr/bin/env node
// M11.1 — LocalLLM Phase 1 demo. Wires @ruvector/ruvllm via NAPI for embed +
// similarity. generate() throws (Phase 2 work). The demo's interesting part
// is that 5 of 10 capabilities are dormant in 4 distinct categories
// (design-deferred for Phase-2 features, upstream-binding for unpublished
// surfaces) — a clean view of what the SDK can ship vs what waits.
//
// Run: node examples/local-llm-demo/run.mjs

import { LocalLLM } from '../../dist/index.js';

console.log('Opening LocalLLM (default-construct against @ruvector/ruvllm)...');
const llm = await LocalLLM.create();
console.log(`  embed dimensions: ${llm.embedDimensions}`);
console.log(`  hasSimd:          ${llm.hasSimd()}`);

console.log('\n[0] Health check (3 result-quality probes):');
const health = await llm.healthCheck();
console.log(`  ${health.summary}`);
for (const c of health.checks) {
  const icon = c.status === 'ok' ? '✓' : c.status === 'broken' ? '✗' : c.status === 'unsupported' ? '·' : '!';
  console.log(`    ${icon} ${c.name.padEnd(22)} ${c.status.padEnd(12)} ${c.detail ?? ''}`);
}

console.log('\n[1] embed("hello world"):');
const v = await llm.embed('hello world');
console.log(`  Float32Array of length ${v.length}; first 4 = [${Array.from(v).slice(0, 4).map(n => n.toFixed(4)).join(', ')}]`);

console.log('\n[2] embed batch of 3 strings:');
const vs = await llm.embed(['cat', 'dog', 'banana']);
console.log(`  ${vs.length} vectors of length ${vs[0].length}`);

console.log('\n[3] similarity probes:');
const pairs = [
  ['cat', 'dog'],         // closely related
  ['cat', 'banana'],      // less related
  ['the quick brown fox', 'a fast russet vulpes'],
  ['the quick brown fox', 'tax law'],
];
for (const [a, b] of pairs) {
  const s = await llm.similarity(a, b);
  console.log(`  sim(${JSON.stringify(a).padEnd(30)} , ${JSON.stringify(b).padEnd(30)}) = ${s.toFixed(4)}`);
}

console.log('\n[4] generate() is Phase 2 — throws with actionable message:');
try {
  await llm.generate('Hello, world.');
} catch (e) {
  console.log(`  expected: ${e.constructor.name}: ${e.message.split('\n')[0].slice(0, 110)}…`);
}

console.log('\n[5] Backend stats:');
console.log(`  ${JSON.stringify(llm.stats()).slice(0, 200)}`);

console.log('\nValue report:');
const vr = await llm.getValueReport();
console.log(`  source: ${vr.healthSource}`);
console.log(`  ${vr.summary}`);
console.log(`  active:`);
for (const a of vr.active) console.log(`    ✓ ${a.name.padEnd(22)} ${a.invocations} invocations  [${a.source}]`);
console.log(`  dormant:`);
for (const d of vr.dormant) {
  console.log(`    ⚠ [${d.blocker.padEnd(17)}] ${d.name.padEnd(22)} — ${d.reason.slice(0, 75)}${d.reason.length > 75 ? '…' : ''}`);
}

console.log('\nClosing.');
await llm.close();
console.log('Done.');
