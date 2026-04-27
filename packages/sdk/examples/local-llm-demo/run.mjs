#!/usr/bin/env node
// M12.1 — LocalLLM Phase 2A demo. Adds generate/query/route over NAPI.
//
// Phase 2A's contract: the SDK wraps the binding's generate (string return)
// into the M5 GenerateResult, exposes query / route in their real shapes,
// and surfaces the gibberish-output state honestly via the binding-tier
// generateNonGibberish probe. The classification flips automatically
// when upstream wires a model_path config — same self-correcting pattern
// as Issue #01's Cypher stub.
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

console.log('\n[4] generate() — Phase 2A wires it; output is gibberish today (upstream-bug):');
const g = await llm.generate('Once upon a time', { maxTokens: 12 });
console.log(`  text     : ${JSON.stringify(g.text.slice(0, 60))}${g.text.length > 60 ? '…' : ''}`);
console.log(`  tokensIn : ${g.tokensIn}  tokensOut: ${g.tokensOut}  (heuristic ≈ chars/4)`);
console.log(`  latency  : ${g.explain.totalLatencyMs.toFixed(2)}ms via [${g.explain.path.join(' → ')}]`);

console.log('\n[5] query() — auto-routed; richer return shape:');
const q = await llm.query('what is machine learning?');
console.log(`  text       : ${JSON.stringify(q.text.slice(0, 60))}${q.text.length > 60 ? '…' : ''}`);
console.log(`  confidence : ${q.confidence.toFixed(4)}`);
console.log(`  model      : ${q.model}`);
console.log(`  fields with undefined (#06): contextSize=${q.contextSize}, latencyMs=${q.latencyMs}, requestId=${q.requestId}`);

console.log('\n[6] route() — routing decision without generating:');
const d = await llm.route('build a vector database');
console.log(`  model=${d.model}  T=${d.temperature?.toFixed?.(2)}  topP=${d.topP}  conf=${d.confidence?.toFixed?.(2)}  contextSize=${d.contextSize}`);
console.log(`  (#06: contextSize and topP undefined — see upstream-issues/05 \"Related findings\")`);

console.log('\n[7] Backend stats:');
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
