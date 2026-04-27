#!/usr/bin/env node
// M17.2 — second LocalLLM transport (WASM).
//
// Loads `@ruvector/ruvllm-wasm@2.0.0` through LocalLLM with `transport: 'wasm'`.
// Demonstrates the 3 working WASM-only capabilities (chat-template formatting,
// auto-detect, HNSW routing) and confirms inference methods (embed/similarity/
// generate/query/route) throw `CAPABILITY_DEFERRED` per Issue #10.
//
// Run from the SDK package root: `node examples/wasm-localllm-demo/run.mjs`.

import { LocalLLM } from '../../dist/index.js';

console.log('Opening LocalLLM over WASM transport...');
const llm = await LocalLLM.create({ backend: { kind: 'wasm' } });

console.log('\n[0] Health check (smoke probes against the WASM binding):');
const health = await llm.healthCheck();
console.log(`  ${health.summary}`);
for (const c of health.checks) {
  const icon = c.status === 'ok' ? '✓' : c.status === 'broken' ? '✗' : c.status === 'unsupported' ? '·' : '!';
  console.log(`    ${icon} ${c.name.padEnd(24)} ${c.status.padEnd(12)} ${(c.detail ?? '').slice(0, 80)}`);
}

console.log('\n[1] Chat template formatting (WASM-only — NAPI lacks this):');
const formatted = await llm.formatChat('llama3', [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is RuVector?' },
]);
console.log(`  llama3 template: ${formatted.length} chars`);
console.log(`  preview: ${JSON.stringify(formatted.slice(0, 80))}…`);

console.log('\n[2] Auto-detect chat template from model id:');
const detected = await llm.detectChatTemplate('llama-3-8b');
console.log(`  detectChatTemplate('llama-3-8b') → '${detected}'`);

console.log('\n[3] HNSW semantic router (WASM-only — sub-ms in-process routing):');
const router = await llm.createHnswRouter(4, 100);
router.addPattern(new Float32Array([1, 0, 0, 0]), 'rust',    { domain: 'rust' });
router.addPattern(new Float32Array([0, 1, 0, 0]), 'web',     { domain: 'frontend' });
router.addPattern(new Float32Array([0, 0, 1, 0]), 'devops',  { domain: 'infrastructure' });
console.log(`  added 3 patterns, dimensions=${router.dimensions}, count=${router.patternCount}`);
const hits = router.route(new Float32Array([0.95, 0.05, 0.05, 0.05]), 2);
console.log(`  route([1,0,0,0]ish, k=2):`);
for (const h of hits) console.log(`    ${h.name.padEnd(8)} score=${h.score.toFixed(4)}`);

console.log('\n[4] Inference methods correctly throw CAPABILITY_DEFERRED on WASM:');
for (const op of ['embed', 'similarity', 'generate', 'query', 'route']) {
  try {
    if (op === 'embed') await llm.embed('hello');
    else if (op === 'similarity') await llm.similarity('a', 'b');
    else if (op === 'generate') await llm.generate('hi');
    else if (op === 'query') await llm.query('hi');
    else if (op === 'route') await llm.route('hi');
    console.log(`    surprising: ${op}() did not throw`);
  } catch (e) {
    console.log(`    ✓ ${op.padEnd(10)} threw: ${e.message.slice(0, 60)}…`);
  }
}

console.log('\nValue report (consults cached healthCheck):');
const vr = await llm.getValueReport();
console.log(`  source:      ${vr.healthSource}`);
console.log(`  measured at: ${vr.lastHealthCheckAt ?? '(never)'}`);
console.log(`  ${vr.summary}`);
console.log(`  active (showing first 5 of ${vr.active.length}):`);
for (const a of vr.active.slice(0, 5)) console.log(`    ✓ ${a.name.padEnd(22)} ${a.invocations} invocations  [${a.source}]`);
console.log(`  dormant (showing first 6 of ${vr.dormant.length}):`);
for (const d of vr.dormant.slice(0, 6)) console.log(`    ⚠ [${d.blocker.padEnd(17)}] ${d.name.padEnd(22)} — ${d.reason.slice(0, 60)}…`);

console.log('\nClosing.');
await llm.close();
console.log('Done.');
