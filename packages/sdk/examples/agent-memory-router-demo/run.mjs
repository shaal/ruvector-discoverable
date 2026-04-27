#!/usr/bin/env node
// M19 — AgentMemory over @ruvector/router (publish-ready, no env var).
//
// Runs WITHOUT RUVECTOR_CORE_BINDING. Demonstrates remember + recall +
// recordFeedback (the SONA loop runs unchanged on either transport).
// **Caveat**: forget(id) throws CAPABILITY_DEFERRED on router transport
// because @ruvector/router.delete() deadlocks (Issue #11) — demonstrated in [4].
//
// Run: node examples/agent-memory-router-demo/run.mjs

import { AgentMemory } from '../../dist/index.js';

const DIMS = 8;

console.log('Opening AgentMemory via @ruvector/router (no env var)...');
const am = await AgentMemory.create({
  agentId: 'router-demo-agent',
  dimensions: DIMS,
  distanceMetric: 'Cosine',
  nativePackage: 'router',  // ← M19: dispatches to RouterKbBackend
});

console.log('\n[0] Health check (router-backed):');
const health = await am.healthCheck();
console.log(`  ${health.summary}`);
for (const c of health.checks.slice(0, 6)) {
  const icon = c.status === 'ok' ? '✓' : c.status === 'broken' ? '✗' : c.status === 'unsupported' ? '·' : '!';
  console.log(`    ${icon} ${c.name.padEnd(24)} ${c.status.padEnd(12)} ${(c.detail ?? '').slice(0, 60)}`);
}

console.log('\n[1] Remember 4 memories (cosine over deterministic embeddings):');
const oneHot = (i) => { const v = new Float32Array(DIMS); v[i % DIMS] = 1; return v; };
const m1 = await am.remember({ text: 'user prefers dark mode',     embedding: oneHot(0), tags: ['preferences'] });
const m2 = await am.remember({ text: 'user prefers compact UI',    embedding: oneHot(0), tags: ['preferences'] });
const m3 = await am.remember({ text: 'user works in EST timezone', embedding: oneHot(2), tags: ['profile'] });
const m4 = await am.remember({ text: 'user is a software engineer', embedding: oneHot(3), tags: ['profile'] });
console.log(`  remembered 4 memories: ${[m1, m2, m3, m4].map(m => m.id).join(', ')}`);

console.log('\n[2] Recall using a "preferences" query (should rank m1, m2 first):');
const recall = await am.recall(oneHot(0), { k: 4 });
for (const r of recall.records) {
  console.log(`    ${r.id.padEnd(28)} score=${r.score.toFixed(4)}  source=${r.source ?? 'vector'}`);
}

console.log('\n[3] Record feedback (SONA loop runs unchanged on router):');
await am.recordFeedback(recall.queryId, { score: 1, comment: 'spot-on' });
console.log(`  feedback recorded for queryId=${recall.queryId.slice(0, 12)}…`);

console.log('\n[4] forget(id) — Issue #11 caveat under router transport:');
try {
  await am.forget(m1.id);
  console.log('  forget succeeded (surprising — Issue #11 may be fixed?)');
} catch (e) {
  console.log(`  ✓ correctly threw: ${e.message.slice(0, 80)}…`);
  console.log(`  (SDK-side _memoryTags + _vectorMirror were still cleared — partial-success documented)`);
}

console.log('\nValue report:');
const vr = await am.getValueReport();
console.log(`  ${vr.summary}`);

console.log('\nClosing.');
await am.close();
console.log('Done.');
