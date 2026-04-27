#!/usr/bin/env node
// M6 v0.1 — first archetype end-to-end against a real backend.
//
// Loads `@ruvector/graph-node@2.0.x` through the SDK's GraphReasoner archetype,
// builds a small social graph (people, documents, topics), runs a Cypher query,
// asks for k-hop neighbours and graph stats, and prints the value report so a
// user sees which capabilities are dormant pending upstream NAPI publishing.
//
// Run from the SDK package root: `node examples/graph-reasoner-demo/run.mjs`.

import { GraphReasoner } from '../../dist/index.js';

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

console.log('Opening GraphReasoner (in-memory, dims=' + DIMS + ')...');
const g = await GraphReasoner.create({ dimensions: DIMS, distanceMetric: 'Cosine' });

console.log('\n[0] Health check (isolated probe — no user data touched):');
const health = await g.healthCheck();
console.log(`  ${health.summary}`);
for (const c of health.checks) {
  const icon = c.status === 'ok' ? '✓' : c.status === 'broken' ? '✗' : c.status === 'unsupported' ? '·' : '!';
  console.log(`    ${icon} ${c.name.padEnd(18)} ${c.status.padEnd(12)} ${c.detail ?? ''}`);
}

console.log('Wiring a small social graph...');
//
//   alice ─OWNS→ doc:auth-spec ─COVERS→ topic:auth
//      │                                   │
//      └─INTERESTED_IN→ topic:auth ←COVERS─┘
//
//   bob   ─OWNS→ doc:db-design ─COVERS→ topic:databases
//      │
//      └─KNOWS→ alice
//
const nodes = [
  { id: 'alice',          labels: ['User'],  properties: { name: 'Alice' }, embedding: pseudoEmbed('alice') },
  { id: 'bob',            labels: ['User'],  properties: { name: 'Bob'   }, embedding: pseudoEmbed('bob') },
  { id: 'doc:auth-spec',  labels: ['Doc'],   properties: { title: 'Auth Spec'   }, embedding: pseudoEmbed('doc:auth-spec') },
  { id: 'doc:db-design',  labels: ['Doc'],   properties: { title: 'DB Design'   }, embedding: pseudoEmbed('doc:db-design') },
  { id: 'topic:auth',     labels: ['Topic'], properties: { name: 'Authentication' }, embedding: pseudoEmbed('topic:auth') },
  { id: 'topic:databases',labels: ['Topic'], properties: { name: 'Databases' }, embedding: pseudoEmbed('topic:databases') },
];
const edges = [
  { from: 'alice', to: 'doc:auth-spec', description: 'OWNS', embedding: pseudoEmbed('alice-owns-auth') },
  { from: 'bob',   to: 'doc:db-design', description: 'OWNS', embedding: pseudoEmbed('bob-owns-db') },
  { from: 'doc:auth-spec', to: 'topic:auth',     description: 'COVERS', embedding: pseudoEmbed('auth-covers-topic') },
  { from: 'doc:db-design', to: 'topic:databases',description: 'COVERS', embedding: pseudoEmbed('db-covers-topic') },
  { from: 'alice', to: 'topic:auth', description: 'INTERESTED_IN', embedding: pseudoEmbed('alice-interest-auth') },
  { from: 'bob',   to: 'alice',      description: 'KNOWS',         embedding: pseudoEmbed('bob-knows-alice') },
];

const { nodesAdded, edgesAdded } = await g.addBatch({ nodes, edges });
console.log(`  inserted ${nodesAdded} nodes, ${edgesAdded} edges`);

// Working operations first — these are the unique-RuVector path in v0.1.
console.log('\n[1] K-hop traversal from alice (hops=2):');
const neighbours = await g.kHopNeighbors({ startNode: 'alice', hops: 2 });
console.log(`  ${neighbours.length} reachable: ${JSON.stringify(neighbours)}`);

console.log('\n[2] Hyperedge — collaborate-on-spec linking alice/bob/auth-spec:');
await g.addHyperedges([
  { nodes: ['alice', 'bob', 'doc:auth-spec'], description: 'COLLABORATED_ON', embedding: pseudoEmbed('collab-auth') },
]);
const hits = await g.searchHyperedges({ embedding: pseudoEmbed('collab-auth'), k: 3 });
console.log(`  hyperedge search returned ${hits.length} hits, top score=${hits[0]?.score.toExponential(2)}`);

console.log('\n[3] Graph stats:');
console.log('  ' + JSON.stringify(await g.stats()));

// Cypher last — calling it surfaces the upstream-stub warning so a reader
// learns the limitation by using the SDK, not by reading docs.
console.log('\n[4] Cypher (will surface upstream stub warning):');
const result = await g.cypher('MATCH (u:User)-[:OWNS]->(d:Doc) RETURN u, d');
console.log(`  result: ${result.nodes.length} nodes, ${result.edges.length} edges (expected 0/0 in v0.1)`);
console.log(`  explain: ${JSON.stringify(result.explain.stages[0]?.note)}`);

console.log('\nValue report:');
const vr = await g.getValueReport();
console.log(`  ${vr.summary}`);
console.log(`  active:`);
for (const a of vr.active) console.log(`    ✓ ${a.name.padEnd(22)} ${a.invocations} invocations  [${a.source}]`);
console.log(`  dormant:`);
for (const d of vr.dormant) console.log(`    ⚠ ${d.name.padEnd(22)} — ${d.reason}`);

console.log('\nClosing.');
await g.close();
console.log('Done.');
