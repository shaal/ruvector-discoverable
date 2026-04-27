#!/usr/bin/env node
// Issue #01 — @ruvector/graph-node@2.0.x VectorDb.query() (Cypher) is a stub
// that returns 0 nodes/edges regardless of input. M22 binding-method probe.
//
// Exits 0 if the bug is still present (MATCH (n) RETURN n returns 0 nodes
// despite a populated DB) — classification is correct.
// Exits 1 if the bug is gone (query returns nodes) — probably good news;
// investigate, then update SDK's GraphReasoner cypher catalog row from
// dormant [upstream-bug] → active.
//
// Module resolution: probes live at tools/reprobe-bindings/probes/, but
// @ruvector/* deps live at packages/sdk/node_modules/. Use createRequire
// rooted at packages/sdk/package.json + dynamic import on the resolved
// path so this works regardless of CWD.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const sdkRequire = createRequire(resolve(REPO_ROOT, 'packages/sdk/package.json'));
const modPath = sdkRequire.resolve('@ruvector/graph-node');
const { GraphDatabase, JsDistanceMetric } = await import(pathToFileURL(modPath).href);

const db = new GraphDatabase({ dimensions: 4, distanceMetric: JsDistanceMetric.Cosine });
await db.createNode({
  id: 'm22-probe-1',
  embedding: new Float32Array([1, 0, 0, 0]),
  labels: ['Probe'],
});
await db.createNode({
  id: 'm22-probe-2',
  embedding: new Float32Array([0, 1, 0, 0]),
  labels: ['Probe'],
});

const stats = await db.stats();
const result = await db.query('MATCH (n) RETURN n');

if (result.nodes.length >= 1) {
  // Bug is gone — Cypher engine works. DRIFT (good news).
  console.log(`DRIFT: query returned ${result.nodes.length} nodes (expected 0). stats=${stats.totalNodes}/${stats.totalEdges}.`);
  process.exit(1);
}

// Bug still present — expected state holds.
console.log(`stub-confirmed: 0 nodes returned despite stats=${stats.totalNodes}n/${stats.totalEdges}e.`);
process.exit(0);
