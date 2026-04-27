#!/usr/bin/env node
// Issue #03 — @ruvector/core VectorDb has shared dimension state across
// instances. The first VectorDb pins the process's global dimension; later
// VectorDbs at different dims throw "Dimension mismatch" on insert.
// M23 binding-method probe.
//
// Exits 0 if the bug is still present (second VectorDb's insert at a
// different dim throws Dimension mismatch).
// Exits 1 if both inserts succeed — DRIFT (good news; classification was
// wrong).
// Exits 64 (custom 'skipped' code) if the binding can't be loaded —
// reprobe runner classifies this as 'skipped' rather than drift, since
// @ruvector/core is not yet on npm and the env-var fallback may be
// unavailable in CI.
//
// Binding resolution: needs @ruvector/core, which is unpublished. Tries
// (in order): RUVECTOR_CORE_BINDING env, then the in-repo fallback at
// `<REPO_ROOT>/ruvector/npm/core/platforms/<platform>/ruvector.node`.

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function resolveBindingPath() {
  const env = process.env['RUVECTOR_CORE_BINDING'];
  if (env !== undefined && env.length > 0 && existsSync(env)) return env;
  const platform = `${process.platform}-${process.arch}`;
  const fallback = resolve(REPO_ROOT, 'ruvector', 'npm', 'core', 'platforms', platform, 'ruvector.node');
  if (existsSync(fallback)) return fallback;
  return null;
}

const bindingPath = resolveBindingPath();
if (bindingPath === null) {
  console.log('skipped: @ruvector/core binding not available (set RUVECTOR_CORE_BINDING or check ruvector/npm/core/platforms/...)');
  process.exit(64);
}

const sdkRequire = createRequire(resolve(REPO_ROOT, 'packages/sdk/package.json'));
const binding = sdkRequire(bindingPath);

if (typeof binding.VectorDb !== 'function') {
  console.log(`DRIFT: @ruvector/core binding does not export VectorDb. Got: ${Object.keys(binding).join(',')}`);
  process.exit(1);
}

// First VectorDb at dims=4. The first insert pins the process's global
// dimension state.
const a = new binding.VectorDb({ dimensions: 4, distanceMetric: 'Cosine' });
await a.insert({ id: 'm23-probe-a', vector: new Float32Array([1, 0, 0, 0]) });

// Second VectorDb at dims=8 (different from the first). Issue #03 is the
// observation that this insert throws "Dimension mismatch: expected 4, got 8"
// despite each VectorDb declaring its own dimensions.
const b = new binding.VectorDb({ dimensions: 8, distanceMetric: 'Cosine' });
let secondInsertThrew = false;
let secondError = '';
try {
  await b.insert({ id: 'm23-probe-b', vector: new Float32Array([1, 0, 0, 0, 0, 0, 0, 0]) });
} catch (e) {
  secondInsertThrew = true;
  secondError = e instanceof Error ? e.message : String(e);
}

if (!secondInsertThrew) {
  console.log(`DRIFT: second VectorDb at dims=8 inserted successfully despite first VectorDb at dims=4. Issue #03 may be fixed; verify multi-instance isolation works for KB+TSM+AgentMemory at different dims under @ruvector/core.`);
  process.exit(1);
}

if (!/Dimension mismatch/i.test(secondError)) {
  console.log(`DRIFT: second VectorDb's insert threw, but with an unexpected error message (not "Dimension mismatch"). Got: ${secondError.slice(0, 100)}`);
  process.exit(1);
}

console.log(`singleton-confirmed: second VectorDb at dims=8 threw on insert with "Dimension mismatch" — ${secondError.slice(0, 80)}`);
process.exit(0);
