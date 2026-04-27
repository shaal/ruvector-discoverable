#!/usr/bin/env node
// Issue #11 — @ruvector/router@0.1.x VectorDb.delete(<existing-id>) hangs
// forever (native-side infinite loop; even setTimeout doesn't fire).
// M22 binding-method probe.
//
// Probe strategy: insert a node, call delete() on the existing id. If the
// bug is present, the call hangs and the parent reprobe's subprocess
// runner kills this process via SIGKILL after the timeout (script does
// not exit on its own).
//
// Exit semantics:
//   - never returns (SIGKILLed by parent)         → bug present (expected)
//   - exits 1 within timeout (delete returned)    → DRIFT, bug fixed
//   - exits 1 with explicit message               → DRIFT, surface changed
//
// The reprobe runner interprets a SIGKILL-on-timeout as the *expected*
// state for this specific probe (the only one with that semantics — the
// runner has a `timeoutIsExpected: true` flag for it).

import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const sdkRequire = createRequire(resolve(REPO_ROOT, 'packages/sdk/package.json'));
const modPath = sdkRequire.resolve('@ruvector/router');

const ns = await import(pathToFileURL(modPath).href);
const mod = { ...(ns.default ?? {}), ...ns };

if (typeof mod.VectorDb !== 'function') {
  console.log(`DRIFT: @ruvector/router no longer exports VectorDb class. Got: ${Object.keys(mod).join(',')}`);
  process.exit(1);
}

const db = new mod.VectorDb({ dimensions: 4, distanceMetric: mod.DistanceMetric.Cosine });

// Sync insert — well-trafficked path.
db.insert('m22-probe-delete', new Float32Array([1, 0, 0, 0]));

// **The hang point**: delete on an existing id. Issue #11 — this never
// returns. If it does return, the bug is fixed → drift.
const result = db.delete('m22-probe-delete');

console.log(`DRIFT: VectorDb.delete returned ${result} for an existing id (expected: hang). Bug may be fixed.`);
process.exit(1);
