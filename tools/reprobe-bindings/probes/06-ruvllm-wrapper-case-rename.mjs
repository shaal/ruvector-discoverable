#!/usr/bin/env node
// Issue #06 — @ruvector/ruvllm JS-wrapper case-rename mismatch.
// The umbrella's JS layer does snake_case → camelCase translation on the
// QueryResponse / RoutingDecision return shapes, but the native binding
// already returns camelCase. The translation hits `undefined` for every
// field that doesn't have a snake_case original, dropping 3-of-6 fields
// from query() and 2-of-5 from route(). M23 binding-method probe.
//
// Exits 0 if the bug is still present (any expected field is undefined).
// Exits 1 if all fields are populated (DRIFT — wrapper fixed).
// Exits 64 ('skipped') if the binding's native loader returns false
// (would mean we're hitting the JS fallback path, which has a different
// failure mode unrelated to Issue #06).

import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const sdkRequire = createRequire(resolve(REPO_ROOT, 'packages/sdk/package.json'));
const modPath = sdkRequire.resolve('@ruvector/ruvllm');
const ns = await import(pathToFileURL(modPath).href);
const mod = ns.default ?? ns;

if (typeof mod.RuvLLM !== 'function') {
  console.log(`DRIFT: @ruvector/ruvllm does not export RuvLLM class. Got: ${Object.keys(mod).join(',')}`);
  process.exit(1);
}

const llm = new mod.RuvLLM();

if (typeof llm.isNativeLoaded === 'function' && llm.isNativeLoaded() === false) {
  console.log('skipped: RuvLLM running in JS fallback mode (isNativeLoaded()=false). Issue #06 is about the umbrella JS wrapper over the native return shape; cannot probe it without native.');
  process.exit(64);
}

// Call query(). Native returns 6 fields (text, confidence, model,
// contextSize, latencyMs, requestId). The JS wrapper drops 3 of them
// because of the case-rename mismatch.
const q = await llm.query('test');
const queryMissing = [];
if (typeof q.text !== 'string')        queryMissing.push('text');
if (typeof q.confidence !== 'number')  queryMissing.push('confidence');
if (typeof q.model !== 'string')       queryMissing.push('model');
if (typeof q.contextSize !== 'number') queryMissing.push('contextSize');
if (typeof q.latencyMs !== 'number')   queryMissing.push('latencyMs');
if (typeof q.requestId !== 'string')   queryMissing.push('requestId');

// Call route(). Native returns 5 fields (model, contextSize, temperature,
// topP, confidence). Wrapper drops some.
const r = await llm.route('test');
const routeMissing = [];
if (typeof r.model !== 'string')        routeMissing.push('model');
if (typeof r.contextSize !== 'number')  routeMissing.push('contextSize');
if (typeof r.temperature !== 'number')  routeMissing.push('temperature');
if (typeof r.topP !== 'number')         routeMissing.push('topP');
if (typeof r.confidence !== 'number')   routeMissing.push('confidence');

if (queryMissing.length === 0 && routeMissing.length === 0) {
  console.log(`DRIFT: query() returned all 6 fields and route() returned all 5 — Issue #06 may be fixed (wrapper case-rename corrected).`);
  process.exit(1);
}

console.log(`wrapper-mismatch-confirmed: query missing ${queryMissing.length}/${6} fields [${queryMissing.join(',')}]; route missing ${routeMissing.length}/${5} fields [${routeMissing.join(',')}]. Native populated; wrapper drops via case-rename.`);
process.exit(0);
