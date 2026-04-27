#!/usr/bin/env node
// M17.1 — second graph transport (WASM).
//
// Loads `@ruvector/graph-wasm@2.0.x` through the SDK's GraphReasoner with
// `transport: 'wasm'`, exercises the working surface, and prints the value
// report so the user sees which capabilities are dormant under WASM transport.
//
// Run from the SDK package root: `node examples/wasm-graph-demo/run.mjs`.
// **No RUVECTOR_CORE_BINDING needed** — WASM is self-contained.

import { GraphReasoner } from '../../dist/index.js';

const DIMS = 16;

console.log('Opening GraphReasoner over WASM transport (in-memory, dims=' + DIMS + ')...');
const g = await GraphReasoner.create({
  dimensions: DIMS,
  distanceMetric: 'Cosine',
  backend: { kind: 'wasm' },
});

console.log('\n[0a] Value report BEFORE healthCheck — declared only:');
const beforeReport = await g.getValueReport();
console.log(`  source: ${beforeReport.healthSource}`);
console.log(`  ${beforeReport.summary}`);

console.log('\n[0b] Health check — observe what WASM transport actually supports:');
const health = await g.healthCheck();
console.log(`  ${health.summary}`);
for (const c of health.checks) {
  const icon = c.status === 'ok' ? '✓' : c.status === 'broken' ? '✗' : c.status === 'unsupported' ? '·' : '!';
  console.log(`    ${icon} ${c.name.padEnd(18)} ${c.status.padEnd(12)} ${(c.detail ?? '').slice(0, 80)}`);
}

console.log('\nWiring a small social graph...');
const nodes = [
  { id: 'alice',          labels: ['User'],  properties: { name: 'Alice' } },
  { id: 'bob',            labels: ['User'],  properties: { name: 'Bob'   } },
  { id: 'doc:auth-spec',  labels: ['Doc'],   properties: { title: 'Auth Spec'   } },
  { id: 'doc:db-design',  labels: ['Doc'],   properties: { title: 'DB Design'   } },
];
const edges = [
  { from: 'alice', to: 'doc:auth-spec', description: 'OWNS' },
  { from: 'bob',   to: 'doc:db-design', description: 'OWNS' },
  { from: 'bob',   to: 'alice',         description: 'KNOWS' },
];

// Note: nodes/edges have no embedding — WASM nodes/edges don't store embeddings
// at the binding layer (different from native). The archetype's auto-embed path
// would derive embeddings from text; without an embedder we use a deterministic
// stand-in to satisfy the resolved-embedding contract before reaching the backend.
const stub = (s) => {
  const v = new Float32Array(DIMS);
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  for (let i = 0; i < DIMS; i++) { h = (h * 1103515245 + 12345) >>> 0; v[i] = (h % 1000) / 1000; }
  return v;
};
for (const n of nodes) n.embedding = stub(n.id);
for (const e of edges) e.embedding = stub(e.from + '->' + e.to);

const { nodesAdded, edgesAdded } = await g.addBatch({ nodes, edges });
console.log(`  inserted ${nodesAdded} nodes, ${edgesAdded} edges`);

console.log('\n[1] Graph stats:');
console.log('  ' + JSON.stringify(await g.stats()));

console.log('\n[2] Cypher (will surface upstream stub warning — same Issue #01 behavior on WASM):');
const result = await g.cypher('MATCH (u:User)-[:OWNS]->(d:Doc) RETURN u, d');
console.log(`  result: ${result.nodes.length} nodes, ${result.edges.length} edges (expected 0/0 — Issue #01 affects WASM too per Issue #09)`);

console.log('\n[3] kHopNeighbors — UNSUPPORTED on WASM transport (Issue #09):');
try {
  await g.kHopNeighbors({ startNode: 'alice', hops: 1 });
  console.log('  surprising: kHop returned without error');
} catch (e) {
  console.log(`  ✓ correctly threw: ${e.message.slice(0, 80)}...`);
}

console.log('\nValue report (consults cached healthCheck):');
const vr = await g.getValueReport();
console.log(`  source:      ${vr.healthSource}`);
console.log(`  measured at: ${vr.lastHealthCheckAt ?? '(never — declared only)'}`);
console.log(`  ${vr.summary}`);
console.log(`  active:`);
for (const a of vr.active) console.log(`    ✓ ${a.name.padEnd(18)} ${a.invocations} invocations  [${a.source}]`);
console.log(`  dormant (showing first 6 of ${vr.dormant.length}):`);
for (const d of vr.dormant.slice(0, 6)) console.log(`    ⚠ [${d.blocker.padEnd(17)}] ${d.name.padEnd(18)} — ${d.reason.slice(0, 70)}...`);

console.log('\nClosing.');
await g.close();
console.log('Done.');
