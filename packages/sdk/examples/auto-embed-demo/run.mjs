#!/usr/bin/env node
// M11.2 — cross-archetype embedding propagation via LocalLLM.
//
// Demonstrates that KnowledgeBase / TimeSeriesMemory / GraphReasoner all
// accept text-only inputs (and string queries) when wired with a shared
// LocalLLM as `embedder`. The pre-computed Float32Array path remains
// available; this demo just shows callers can drop the caveat.
//
// Run: RUVECTOR_CORE_BINDING="$PWD/../../ruvector/npm/core/platforms/darwin-arm64/ruvector.node" \
//      node examples/auto-embed-demo/run.mjs

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import {
  KnowledgeBase,
  TimeSeriesMemory,
  GraphReasoner,
  LocalLLM,
} from '../../dist/index.js';

const explicitBinding = process.env.RUVECTOR_CORE_BINDING
  ?? resolve(process.cwd(), '..', '..', 'ruvector', 'npm', 'core', 'platforms', 'darwin-arm64', 'ruvector.node');

if (!existsSync(explicitBinding)) {
  console.error(`@ruvector/core binding not found at ${explicitBinding}.`);
  console.error('Set RUVECTOR_CORE_BINDING to the path of upstream\'s prebuilt ruvector.node.');
  process.exit(1);
}

console.log('M11.2 — cross-archetype auto-embed via shared LocalLLM\n');

// One LLM, three archetypes. The embedder owns its lifecycle; archetypes
// don't close it (multiple archetypes sharing one embedder is the point).
const llm = await LocalLLM.create();
const dims = llm.embedDimensions;
console.log(`LocalLLM ready: embedDimensions=${dims}\n`);

// ------------------------------------------------------------
// 1. KnowledgeBase — text-only Document, string retrieve
// ------------------------------------------------------------
console.log('--- KnowledgeBase ---');
const kb = await KnowledgeBase.create({
  dimensions: dims,
  distanceMetric: 'Cosine',
  bindingPath: explicitBinding,
  embedder: llm,
});

const docPrefix = `__ruvsdk_demo_kb_${Date.now()}`;
const docs = [
  { id: `${docPrefix}-1`, text: 'apple pie cinnamon dessert recipe' },
  { id: `${docPrefix}-2`, text: 'corporate income tax filing requirements' },
  { id: `${docPrefix}-3`, text: 'banana bread sweet baked dessert' },
  { id: `${docPrefix}-4`, text: 'machine learning gradient descent optimization' },
];
const ingestReport = await kb.ingest(docs);
console.log(`  ingested ${ingestReport.documentsIngested} text-only docs in ${ingestReport.durationMs.toFixed(2)}ms`);

const retrieved = await kb.retrieve('fruit baked sweet recipe', { k: 3 });
console.log('  query "fruit baked sweet recipe" →');
for (const c of retrieved.citations) {
  const tail = c.documentId.slice(-2);
  console.log(`    score=${c.score.toFixed(4)}  doc-${tail}`);
}

// ------------------------------------------------------------
// 2. TimeSeriesMemory — string `value` on TimeSeriesPoint
// ------------------------------------------------------------
console.log('\n--- TimeSeriesMemory ---');
const stream = `__ruvsdk_demo_ts_${Date.now()}`;
const ts = await TimeSeriesMemory.create({
  streamId: stream,
  dimensions: dims,
  distanceMetric: 'Cosine',
  bindingPath: explicitBinding,
  embedder: llm,
});

const T0 = Date.parse('2100-01-01T00:00:00Z');
await ts.append({ timestampMs: T0,           value: 'system boot completed' });
await ts.append({ timestampMs: T0 + 60_000,  value: 'user login successful' });
await ts.append({ timestampMs: T0 + 120_000, value: 'database query slow timeout' });
await ts.append({ timestampMs: T0 + 180_000, value: 'disk space low warning' });

const tsResult = await ts.query('storage capacity alert', {
  window: { fromMs: T0 - 1, toMs: T0 + 300_000 },
  k: 4,
});
console.log(`  query "storage capacity alert" → ${tsResult.points.length} hits`);
for (const p of tsResult.points) {
  const offsetSec = (p.timestampMs - T0) / 1000;
  console.log(`    score=${p.score.toFixed(4)}  T+${offsetSec}s`);
}

// ------------------------------------------------------------
// 3. GraphReasoner — text-only Node/Edge
// ------------------------------------------------------------
console.log('\n--- GraphReasoner ---');
const gr = await GraphReasoner.create({
  dimensions: dims,
  distanceMetric: 'Cosine',
  embedder: llm,
});

const grPrefix = `__ruvsdk_demo_gr_${Date.now()}`;
await gr.addBatch({
  nodes: [
    { id: `${grPrefix}-alice`, text: 'researcher Alice working on graph algorithms', labels: ['Researcher'] },
    { id: `${grPrefix}-bob`,   text: 'engineer Bob shipping graph databases',      labels: ['Engineer'] },
    { id: `${grPrefix}-carol`, text: 'product manager Carol scoping ML platforms',  labels: ['PM'] },
  ],
  edges: [
    { from: `${grPrefix}-alice`, to: `${grPrefix}-bob`,   description: 'COLLABORATES_WITH' },
    { from: `${grPrefix}-bob`,   to: `${grPrefix}-carol`, description: 'REPORTS_TO' },
  ],
});

const reachable = await gr.kHopNeighbors({ startNode: `${grPrefix}-alice`, hops: 2 });
console.log(`  kHop(${grPrefix.split('_').pop()}-alice, 2) → ${reachable.length} reachable`);
for (const id of reachable) console.log(`    ${id.split('-').slice(-1)[0]}`);

// ------------------------------------------------------------
// 4. Value reports — autoEmbed flips to active across all three
// ------------------------------------------------------------
console.log('\n--- Value reports (post-healthCheck) ---');
for (const [name, archetype] of [['KnowledgeBase', kb], ['TimeSeriesMemory', ts], ['GraphReasoner', gr]]) {
  await archetype.healthCheck();
  const r = await archetype.getValueReport();
  const ae = [...r.active, ...r.dormant].find((c) => c.name === 'autoEmbed');
  const status = r.active.some((c) => c.name === 'autoEmbed') ? 'active' : 'dormant';
  console.log(`  ${name.padEnd(18)} autoEmbed: ${status}${ae && 'invocations' in ae ? ` (${ae.invocations} invocations)` : ''}`);
}

// ------------------------------------------------------------
// 5. Cleanup — best-effort delete of demo ids on shared backend.
// ------------------------------------------------------------
await kb.close();
await ts.close();
await gr.close();
await llm.close();

console.log('\nDone.');
