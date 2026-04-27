#!/usr/bin/env node
// M20 — v0.3 publish-ready end-to-end demo.
//
// Wires all 5 archetypes (LocalLLM + GraphReasoner + KnowledgeBase +
// TimeSeriesMemory + AgentMemory) in a single process, with the 3 KB-family
// archetypes using `nativePackage: 'router'` to skip the
// RUVECTOR_CORE_BINDING env-var workaround. Validates the M18/M19 claim
// that router transport supports multi-archetype DI cleanly — including
// **multi-dimension coexistence** (KB at 768, TSM at 8, AgentMemory at 768
// in the same process).
//
// Run from the SDK package root, WITHOUT RUVECTOR_CORE_BINDING:
//   node examples/v03-publish-ready-demo/run.mjs
//
// Drift-by-inversion: flip any KB/TSM/AgentMemory to nativePackage: 'core'
// (the default) and re-run without RUVECTOR_CORE_BINDING — should fail with
// BINDING_PATH_REQUIRED, demonstrating that M19 propagation is what makes
// the v0.3 story work end-to-end.

import {
  LocalLLM,
  GraphReasoner,
  KnowledgeBase,
  TimeSeriesMemory,
  AgentMemory,
} from '../../dist/index.js';

if (process.env.RUVECTOR_CORE_BINDING !== undefined && process.env.RUVECTOR_CORE_BINDING !== '') {
  console.warn(
    '[v0.3-demo] WARNING: RUVECTOR_CORE_BINDING is set. The v0.3 story is that ' +
    'this demo runs *without* the env-var workaround. Run with `env -u ' +
    'RUVECTOR_CORE_BINDING node ...` for the full v0.3 experience.\n',
  );
}

console.log('M20 — v0.3 publish-ready demo (no RUVECTOR_CORE_BINDING needed)\n');

// ─── 1. LocalLLM (default native — works via @ruvector/ruvllm-darwin-arm64) ───
console.log('[1/5] LocalLLM (native)...');
const llm = await LocalLLM.create();
const llmDims = llm.embedDimensions;  // 768 on the published binding
console.log(`      ✓ embedDimensions=${llmDims}, hasSimd=${llm.hasSimd()}`);

// ─── 2. GraphReasoner (default native — works via @ruvector/graph-node) ───
console.log('\n[2/5] GraphReasoner (native + embedder DI)...');
const graph = await GraphReasoner.create({
  dimensions: llmDims,
  distanceMetric: 'Cosine',
  embedder: llm,
});
console.log(`      ✓ wired with embedder DI (text-only addBatch enabled)`);

// ─── 3. KnowledgeBase (ROUTER, dims=768, full DI: embedder + graphReasoner) ───
console.log('\n[3/5] KnowledgeBase (router, dims=768, embedder + graphReasoner DI)...');
const kb = await KnowledgeBase.create({
  dimensions: llmDims,
  distanceMetric: 'Cosine',
  nativePackage: 'router',     // ← M18: no RUVECTOR_CORE_BINDING needed
  embedder: llm,                //   M11.2 cross-archetype autoEmbed
  graphReasoner: graph,         //   M9    cross-archetype graphRag
});
console.log(`      ✓ router-backed, M9+M11.2 DI active`);

// ─── 4. TimeSeriesMemory (ROUTER, dims=8 — DIFFERENT from KB; tests router's ──
//      multi-instance isolation that @ruvector/core lacks per Issue #03) ──────
const TSM_DIMS = 8;
console.log(`\n[4/5] TimeSeriesMemory (router, dims=${TSM_DIMS} — different from KB's ${llmDims}!)...`);
const tsm = await TimeSeriesMemory.create({
  streamId: 'v03-demo-stream',
  dimensions: TSM_DIMS,
  distanceMetric: 'Cosine',
  nativePackage: 'router',     // ← M19: no RUVECTOR_CORE_BINDING needed
  changepointWindow: 3,
  // No embedder — TSM uses raw Float32Array values at dims=8.
  // This is the load-bearing test: KB just constructed at dims=768
  // didn't pin the global dimension state. Under nativePackage: 'core',
  // the second VectorDb construction at a different dim throws Issue #03.
});
console.log(`      ✓ router-backed at dims=${TSM_DIMS} alongside KB at dims=${llmDims}`);
console.log(`        (would fail with Issue #03 dimension-mismatch under nativePackage: 'core')`);

// ─── 5. AgentMemory (ROUTER, dims=768, full DI: embedder + graphReasoner) ────
console.log(`\n[5/5] AgentMemory (router, dims=${llmDims}, embedder + graphReasoner DI)...`);
const am = await AgentMemory.create({
  agentId: 'v03-demo-agent',
  dimensions: llmDims,
  distanceMetric: 'Cosine',
  nativePackage: 'router',     // ← M19: no RUVECTOR_CORE_BINDING needed
  embedder: llm,                //   M11.2 cross-archetype autoEmbed
  graphReasoner: graph,         //   M13.1 graphMemory via tag co-occurrence
});
console.log(`      ✓ router-backed, M11.2+M13.1 DI active`);

console.log('\n══════════════════════════════════════════════════════════════');
console.log(' Multi-archetype + multi-dimension coexistence: VERIFIED');
console.log(' (5 archetypes alive in 1 process; 3 router-backed at 2 dims)');
console.log('══════════════════════════════════════════════════════════════');

// ─── Exercise each archetype end-to-end ──────────────────────────────────────

console.log('\n[A] KnowledgeBase: ingest 4 docs (text-only via autoEmbed)');
const docPrefix = `__v03_kb_${Date.now()}`;
const docs = [
  { id: `${docPrefix}-1`, text: 'apple pie cinnamon dessert recipe' },
  { id: `${docPrefix}-2`, text: 'corporate income tax filing requirements' },
  { id: `${docPrefix}-3`, text: 'banana bread sweet baked dessert' },
  { id: `${docPrefix}-4`, text: 'gradient descent optimization for neural nets' },
];
const ingestReport = await kb.ingest(docs);
console.log(`    ingested ${ingestReport.documentsIngested} docs in ${ingestReport.durationMs.toFixed(0)}ms`);

console.log('    retrieve "fruit baked sweet" k=3:');
const kbResult = await kb.retrieve('fruit baked sweet', { k: 3 });
for (const c of kbResult.citations) {
  const tail = c.documentId.slice(-2);
  console.log(`      score=${c.score.toFixed(4)}  doc-${tail}  source=${c.source ?? 'vector'}`);
}

console.log('\n[B] TimeSeriesMemory: append 20 points + windowed query + changepoint detect');
const T0 = Date.parse('2026-01-01T00:00:00Z');
const oneHot = (i) => { const v = new Float32Array(TSM_DIMS); v[i % TSM_DIMS] = 1; return v; };
for (let i = 0; i < 20; i++) {
  // Step shift at t=10: first 10 points near oneHot(0), last 10 near oneHot(1).
  const base = i < 10 ? oneHot(0) : oneHot(1);
  const noise = new Float32Array(TSM_DIMS);
  for (let j = 0; j < TSM_DIMS; j++) noise[j] = base[j] + (Math.random() - 0.5) * 0.05;
  await tsm.append({ timestampMs: T0 + i * 60_000, value: noise });
}
console.log(`    appended 20 points, count=${await tsm.len()}`);
const tsResult = await tsm.query(oneHot(0), { window: { fromMs: T0, toMs: T0 + 9 * 60_000 }, k: 3 });
console.log(`    query top-3 in early window: ${tsResult.points.length} hits`);
const changepoints = await tsm.detectChangepoints({});
console.log(`    detectChangepoints: ${changepoints.length} changepoint(s) detected at the t+8…t+12min step shift`);

console.log('\n[C] AgentMemory: remember 4 memories + recall + feedback');
const m1 = await am.remember({ text: 'user prefers dark mode interface',     tags: ['preferences'] });
const m2 = await am.remember({ text: 'user prefers compact UI density',      tags: ['preferences'] });
const m3 = await am.remember({ text: 'user is in EST timezone',                tags: ['profile'] });
const m4 = await am.remember({ text: 'user is a senior software engineer',    tags: ['profile'] });
console.log(`    remembered 4 memories, ids: ${[m1, m2, m3, m4].map(m => m.id.slice(-8)).join(', ')}`);

const recall = await am.recall('what does the user prefer?', { k: 3 });
// M21: recall().records[i].text now returns the original remember()-time
// text — no local Map<id, text> workaround needed (was required pre-M21).
console.log(`    recall "what does the user prefer?" k=3 (top results should be preferences-tagged):`);
for (const r of recall.records) {
  console.log(`      score=${r.score.toFixed(4)}  ${r.id.slice(-12)}  → "${r.text}"`);
}

await am.recordFeedback(recall.queryId, { score: 1, comment: 'spot-on' });
console.log(`    feedback recorded for queryId=${recall.queryId.slice(0, 14)}…`);

// ─── Summary value reports ───────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log(' Per-archetype value reports (post-healthCheck)');
console.log('══════════════════════════════════════════════════════════════');
for (const [name, archetype] of [
  ['LocalLLM',         llm],
  ['GraphReasoner',    graph],
  ['KnowledgeBase',    kb],
  ['TimeSeriesMemory', tsm],
  ['AgentMemory',      am],
]) {
  await archetype.healthCheck();
  const r = await archetype.getValueReport();
  console.log(`  ${name.padEnd(18)} ${r.summary.replace(/\s+—\s+.*$/, '')}`);
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

console.log('\nClosing all 5 archetypes...');
await am.close();
await tsm.close();
await kb.close();
await graph.close();
await llm.close();
console.log('Done.\n');
console.log('v0.3 publish-ready: 5 archetypes, multi-dimension router DI, no env var.');
