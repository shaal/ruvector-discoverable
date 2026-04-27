#!/usr/bin/env node
// M7 v0.1 — second archetype end-to-end against a real backend.
//
// Wires KnowledgeBase to upstream's @ruvector/core via the in-repo prebuilt
// .node binary. The smoke check + value-report pattern from M6.2 is reused
// verbatim — the test of this milestone is whether the same machinery works
// on a meaningfully different archetype.
//
// Run: RUVECTOR_CORE_BINDING="$PWD/../../ruvector/npm/core/platforms/darwin-arm64/ruvector.node" \
//      node examples/knowledge-base-demo/run.mjs

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { KnowledgeBase, GraphReasoner } from '../../dist/index.js';

const DIMS = 16;

// Resolve the upstream binding for darwin-arm64 — same approach as the
// scoping pass in M6. Other platforms swap the path component.
const explicitBinding = process.env.RUVECTOR_CORE_BINDING
  ?? resolve(process.cwd(), '..', '..', 'ruvector', 'npm', 'core', 'platforms', 'darwin-arm64', 'ruvector.node');

if (!existsSync(explicitBinding)) {
  console.error(`@ruvector/core binding not found at ${explicitBinding}.`);
  console.error('Set RUVECTOR_CORE_BINDING to the path of upstream\'s prebuilt ruvector.node.');
  process.exit(1);
}

// Tiny deterministic embedder for the demo. Real apps wire a real model.
function pseudoEmbed(seed) {
  const v = new Float32Array(DIMS);
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = 0; i < DIMS; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    v[i] = ((s % 2000) / 1000) - 1;
  }
  return v;
}

console.log(`Opening KnowledgeBase + GraphReasoner (in-memory, dims=${DIMS})...`);
console.log(`  binding: ${explicitBinding}`);

// M9: cross-archetype coordination. The KB takes a GraphReasoner so ingest()
// populates the doc-entity graph and retrieve() can fan out via kHopNeighbors.
// M10: SONA continual learning. recordFeedback now actually trains, and
// retrieve() warps the query embedding via the current LoRA delta.
const graph = await GraphReasoner.create({ dimensions: DIMS, distanceMetric: 'Cosine' });
const kb = await KnowledgeBase.create({
  dimensions: DIMS,
  distanceMetric: 'Cosine',
  bindingPath: explicitBinding,
  graphReasoner: graph,
  sona: true, // M10 v0.1 — opt in to SONA continual learning
});

console.log('\n[0a] Value report BEFORE healthCheck — declared only:');
const before = await kb.getValueReport();
console.log(`  source: ${before.healthSource}`);
console.log(`  ${before.summary}`);
console.log(`  hybridSearch dormant reason: "${before.dormant.find(d => d.name === 'hybridSearch')?.reason ?? '(not dormant)'}"`);

console.log('\n[0b] Health check (isolated probe — no user data touched):');
const health = await kb.healthCheck();
console.log(`  ${health.summary}`);
for (const c of health.checks) {
  const icon = c.status === 'ok' ? '✓' : c.status === 'broken' ? '✗' : c.status === 'unsupported' ? '·' : '!';
  console.log(`    ${icon} ${c.name.padEnd(16)} ${c.status.padEnd(12)} ${c.detail ?? ''}`);
}

console.log('\n[1] Ingesting 5 documents (with #hashtag entities for Graph RAG)...');
const docs = [
  { id: 'auth-spec',     text: 'OAuth2 authorization code flow with PKCE #auth #oauth',  embedding: pseudoEmbed('auth-oauth2-pkce'), metadata: { topic: 'auth' } },
  { id: 'db-design',     text: 'Schema migration patterns and rollback strategies #db', embedding: pseudoEmbed('db-migrations'), metadata: { topic: 'db' } },
  { id: 'api-style',     text: 'REST endpoint conventions and pagination',              embedding: pseudoEmbed('rest-api-style') },
  { id: 'crypto-notes',  text: 'Token rotation and key signing for JWTs #auth #jwt',    embedding: pseudoEmbed('crypto-jwt'), metadata: { topic: 'auth' } },
  { id: 'monitoring',    text: 'Latency p99 and error budget alerts',                   embedding: pseudoEmbed('observability-slo') },
];
const ingest = await kb.ingest(docs);
console.log(`  inserted ${ingest.documentsIngested} documents in ${ingest.durationMs.toFixed(2)}ms (len=${await kb.len()})`);
console.log(`  graph populated: ${(await graph.stats()).totalNodes} nodes, ${(await graph.stats()).totalEdges} edges`);

console.log('\n[2a] Plain retrieve (vector-only, k=3):');
const queryEmb = pseudoEmbed('auth-oauth2-pkce');
const r0 = await kb.retrieve(queryEmb, { k: 3 });
console.log(`  ${r0.citations.length} citations:`);
for (const c of r0.citations) {
  console.log(`    ${(c.source ?? 'vector').padEnd(15)} ${c.documentId.padEnd(14)} score=${c.score.toExponential(2)}`);
}

console.log('\n[2b] Retrieve with Graph RAG (k=1, graphRagHops=2 — doc→entity→other-doc):');
const r1 = await kb.retrieve(queryEmb, { k: 1, graphRagHops: 2 });
console.log(`  ${r1.citations.length} citations:`);
for (const c of r1.citations) {
  const bridge = c.bridgeEntity ? ` (via ${c.bridgeEntity})` : '';
  console.log(`    ${(c.source ?? 'vector').padEnd(15)} ${c.documentId.padEnd(14)} score=${c.score.toExponential(2)}${bridge}`);
}
console.log(`  explain: ${r1.explain.path.join(' → ')} (${r1.explain.totalLatencyMs.toFixed(2)}ms)`);
console.log(`  note: with SONA wired, retrieval goes through sonaApplyLora before vectorSearch.`);
console.log(`  At zero training the LoRA delta is essentially identity; after many trajectories`);
console.log(`  with reward signals, the warp learns to pull rewarded routes closer.`);

console.log('\n[3] Recording feedback (SONA wired — actually trains the LoRA delta):');
await kb.recordFeedback(r1.queryId, { score: 1, label: 'correct' });
console.log(`  feedback recorded; trajectory closed with reward=+1; tick fired`);

// Run a few more retrievals + feedbacks to exercise the trajectory loop.
for (let i = 0; i < 3; i++) {
  const r = await kb.retrieve(queryEmb, { k: 1 });
  await kb.recordFeedback(r.queryId, { score: 1, label: 'correct' });
}
console.log(`  exercised 3 more retrieve+feedback cycles`);

console.log('\n[4] ask() is deferred to LLM milestone:');
try {
  await kb.ask('how does auth work?');
} catch (e) {
  console.log(`  expected: ${e.constructor.name}: ${e.message.split('\n')[0].slice(0, 100)}...`);
}

console.log('\nValue report (consults cached healthCheck from step [0b]):');
const after = await kb.getValueReport();
console.log(`  source:      ${after.healthSource}`);
console.log(`  measured at: ${after.lastHealthCheckAt ?? '(never)'}`);
console.log(`  ${after.summary}`);
console.log(`  active:`);
for (const a of after.active) console.log(`    ✓ ${a.name.padEnd(16)} ${a.invocations} invocations  [${a.source}]`);
console.log(`  dormant:`);
for (const d of after.dormant) console.log(`    ⚠ [${d.blocker.padEnd(17)}] ${d.name.padEnd(16)} — ${d.reason.slice(0, 80)}${d.reason.length > 80 ? '…' : ''}`);

console.log('\nClosing.');
await kb.close();
await graph.close();
console.log('Done.');
