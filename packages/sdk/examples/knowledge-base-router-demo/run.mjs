#!/usr/bin/env node
// M18 — third KnowledgeBase backend over @ruvector/router (publish-ready).
//
// **Critical UX win**: this demo runs WITHOUT `RUVECTOR_CORE_BINDING` set.
// `@ruvector/router@0.1.30` is a stealth-published NAPI binding (M17 find)
// with a working VectorDb that doesn't need the env-var workaround. Same
// NAPI layer as @ruvector/core, but a separate package that's actually on
// npm.
//
// Run from the SDK package root:
//   node examples/knowledge-base-router-demo/run.mjs
//
// (No env var. No bindingPath. Just `npm install @ruvector/sdk @ruvector/router`.)

import { KnowledgeBase } from '../../dist/index.js';

const DIMS = 16;

// Small deterministic embedder for the demo. Real apps wire a real model.
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

console.log(`Opening KnowledgeBase via @ruvector/router (no RUVECTOR_CORE_BINDING needed)...`);
const kb = await KnowledgeBase.create({
  dimensions: DIMS,
  distanceMetric: 'Cosine',
  nativePackage: 'router',  // ← M18: routes to @ruvector/router instead of @ruvector/core
});

console.log('\n[0] Health check (router-backed; no health/metrics surface):');
const health = await kb.healthCheck();
console.log(`  ${health.summary}`);
for (const c of health.checks) {
  const icon = c.status === 'ok' ? '✓' : c.status === 'broken' ? '✗' : c.status === 'unsupported' ? '·' : '!';
  console.log(`    ${icon} ${c.name.padEnd(22)} ${c.status.padEnd(12)} ${(c.detail ?? '').slice(0, 80)}`);
}

console.log('\n[1] Ingesting 5 documents (cosine over deterministic embeddings):');
const docs = [
  { id: 'auth-spec',  text: 'OAuth 2.1 with PKCE; tokens expire in 1h.', embedding: pseudoEmbed('auth') },
  { id: 'db-design',  text: 'Schema migrations run via alembic in CI.',  embedding: pseudoEmbed('database') },
  { id: 'kms-rotate', text: 'Key Management Service rotates keys nightly.', embedding: pseudoEmbed('kms') },
  { id: 'auth-flow',  text: 'Login redirects through OIDC.',              embedding: pseudoEmbed('auth') },  // close to auth-spec
  { id: 'data-model', text: 'Entities are stored in normalized tables.',  embedding: pseudoEmbed('database') }, // close to db-design
];
const report = await kb.ingest(docs);
console.log(`  ingested ${report.documentsIngested} docs in ${report.durationMs.toFixed(2)}ms`);

console.log('\n[2] Retrieve top-3 for an auth-related query:');
const result = await kb.retrieve(pseudoEmbed('auth'), { k: 3 });
for (const c of result.citations) {
  console.log(`    ${c.documentId.padEnd(12)} score=${c.score.toFixed(4)}  source=${c.source ?? 'vector'}`);
}

console.log('\n[3] count after ingest:', await kb.len());

console.log('\nValue report:');
const vr = await kb.getValueReport();
console.log(`  source:      ${vr.healthSource}`);
console.log(`  ${vr.summary}`);
console.log(`  active:`);
for (const a of vr.active) console.log(`    ✓ ${a.name.padEnd(22)} ${a.invocations} invocations  [${a.source}]`);
console.log(`  dormant (showing first 6 of ${vr.dormant.length}):`);
for (const d of vr.dormant.slice(0, 6)) console.log(`    ⚠ [${d.blocker.padEnd(17)}] ${d.name.padEnd(22)} — ${d.reason.slice(0, 60)}…`);

console.log('\nClosing.');
await kb.close();
console.log('Done.');
