#!/usr/bin/env node
// M13.1 — AgentMemory Phase 1A demo. Wires AgentMemory to upstream
// @ruvector/core via NativeCoreBackend, plus optional SONA continual
// learning and a GraphReasoner for memory-relations through tag co-occurrence.
//
// Default-active capabilities probed live: vectorRecall, vectorInsert,
// agentScoping, health, metrics. Opt-in: sona, graphMemory, autoEmbed,
// hyperbolic. Dormant upstream-binding: gnnLearning (M4 headline; gated
// on @ruvector/gnn-node), mambaRecall, domainExpansion.
//
// Run: RUVECTOR_CORE_BINDING="$PWD/../../ruvector/npm/core/platforms/darwin-arm64/ruvector.node" \
//      node examples/agent-memory-demo/run.mjs

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { AgentMemory, GraphReasoner } from '../../dist/index.js';

const DIMS = 16;

const explicitBinding = process.env.RUVECTOR_CORE_BINDING
  ?? resolve(process.cwd(), '..', '..', 'ruvector', 'npm', 'core', 'platforms', 'darwin-arm64', 'ruvector.node');

if (!existsSync(explicitBinding)) {
  console.error(`@ruvector/core binding not found at ${explicitBinding}.`);
  process.exit(1);
}

// Tiny deterministic embedder for the demo.
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

console.log(`Opening AgentMemory + GraphReasoner (in-memory, dims=${DIMS})...`);
const graph = await GraphReasoner.create({ dimensions: DIMS, distanceMetric: 'Cosine' });
const mem = await AgentMemory.create({
  agentId: 'planner-001',
  dimensions: DIMS,
  distanceMetric: 'Cosine',
  bindingPath: explicitBinding,
  sona: true,
  graphReasoner: graph,
  hyperbolic: true,
});

console.log(`\n[0] Health check (binding probes + 4 archetype-tier opt-in probes):`);
const h = await mem.healthCheck();
console.log(`  ${h.summary}`);
for (const c of h.checks) {
  const icon = c.status === 'ok' ? '✓' : c.status === 'broken' ? '✗' : c.status === 'unsupported' ? '·' : '!';
  console.log(`    ${icon} ${c.name.padEnd(22)} ${c.status.padEnd(12)} ${c.detail ?? ''}`);
}

console.log(`\n[1] remember() — 5 user memories with tags:`);
const memories = [
  { text: 'user prefers concise responses',         tags: ['preferences', 'style'] },
  { text: 'user works on a TypeScript codebase',    tags: ['preferences', 'tech'] },
  { text: 'user is in pacific time zone',           tags: ['locale'] },
  { text: 'last deploy failed at 03:17 UTC',        tags: ['incidents', 'tech'] },
  { text: 'user prefers async over sync calls',     tags: ['style', 'tech'] },
];
const ids = [];
for (const m of memories) {
  const r = await mem.remember({ ...m, embedding: pseudoEmbed(m.text) });
  ids.push(r.id);
  console.log(`  ${r.id}  ← "${m.text.slice(0, 40)}${m.text.length > 40 ? '…' : ''}"  tags=[${m.tags.join(',')}]`);
}

console.log(`\n[2] recall — vector-only query "user style preferences":`);
const r1 = await mem.recall(pseudoEmbed('user style preferences'), { k: 3 });
for (const rec of r1.records) {
  console.log(`  ${rec.source.padEnd(15)} ${rec.id}  score=${rec.score.toExponential(2)}`);
}
console.log(`  explain: ${r1.explain.path.join(' → ')} (${r1.explain.totalLatencyMs.toFixed(2)}ms)`);

console.log(`\n[3] recall with graphHops=2 — fan out via tag co-occurrence:`);
const r2 = await mem.recall(pseudoEmbed('user style preferences'), { k: 1, graphHops: 2 });
for (const rec of r2.records) {
  const bridge = rec.source === 'graph-adjacent' ? ` (via tag:${rec.bridgeTag})` : '';
  console.log(`  ${rec.source.padEnd(15)} ${rec.id}  score=${rec.score.toExponential(2)}${bridge}`);
}

console.log(`\n[4] forget() one memory:`);
const forgot = await mem.forget(ids[2]);
console.log(`  forget(${ids[2]}) → ${forgot}, len now = ${await mem.len()}`);

console.log(`\n[5] recordFeedback — closes SONA trajectory with reward signal:`);
await mem.recordFeedback(r1.queryId, { score: 1, label: 'helpful' });
console.log(`  feedback recorded for queryId=${r1.queryId}`);

console.log(`\nValue report (post-healthCheck):`);
const vr = await mem.getValueReport();
console.log(`  source: ${vr.healthSource}`);
console.log(`  ${vr.summary}`);
console.log(`  active:`);
for (const a of vr.active) console.log(`    ✓ ${a.name.padEnd(22)} ${a.invocations} invocations  [${a.source}]`);
console.log(`  dormant:`);
for (const d of vr.dormant) {
  console.log(`    ⚠ [${d.blocker.padEnd(17)}] ${d.name.padEnd(22)} — ${d.reason.slice(0, 70)}${d.reason.length > 70 ? '…' : ''}`);
}

console.log(`\nClosing.`);
await mem.close();
await graph.close();
console.log('Done.');
