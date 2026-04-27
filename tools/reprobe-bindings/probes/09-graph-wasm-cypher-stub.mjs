#!/usr/bin/env node
// Issue #09 — @ruvector/graph-wasm@2.0.x GraphDB.query() shares the Cypher
// stub bug with the NAPI binding (Issue #01 class). M22 binding-method probe.
//
// Exits 0 if the bug is still present (query returns 0 nodes); exits 1 if
// the bug is gone (query returns nodes — probably good news).

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const sdkRequire = createRequire(resolve(REPO_ROOT, 'packages/sdk/package.json'));
const modPath = sdkRequire.resolve('@ruvector/graph-wasm');
const wasmPath = sdkRequire.resolve('@ruvector/graph-wasm/ruvector_graph_wasm_bg.wasm');

const ns = await import(pathToFileURL(modPath).href);
const mod = { ...(ns.default ?? {}), ...ns };
await mod.default({ module_or_path: readFileSync(wasmPath) });

const db = new mod.GraphDB('cosine');
db.createNode(['Probe'], { name: 'm22-probe-1' });
db.createNode(['Probe'], { name: 'm22-probe-2' });
const stats = db.stats();
const result = await db.query('MATCH (n) RETURN n');

if (result.nodes.length >= 1) {
  console.log(`DRIFT: query returned ${result.nodes.length} nodes (expected 0). stats=${JSON.stringify(stats)}.`);
  process.exit(1);
}

console.log(`stub-confirmed: 0 nodes returned despite stats nodeCount=${stats.nodeCount}.`);
process.exit(0);
