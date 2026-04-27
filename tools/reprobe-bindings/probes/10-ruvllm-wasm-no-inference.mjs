#!/usr/bin/env node
// Issue #10 — @ruvector/ruvllm-wasm@2.0.x RuvLLMWasm has NO inference
// methods (no embed/similarity/generate/query/route on its prototype).
// M22 binding-method probe.
//
// Exits 0 if the methods are still missing — classification holds.
// Exits 1 if any of those names appear on RuvLLMWasm.prototype — DRIFT.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const sdkRequire = createRequire(resolve(REPO_ROOT, 'packages/sdk/package.json'));
const modPath = sdkRequire.resolve('@ruvector/ruvllm-wasm');
const wasmPath = sdkRequire.resolve('@ruvector/ruvllm-wasm/ruvllm_wasm_bg.wasm');

const ns = await import(pathToFileURL(modPath).href);
const mod = { ...(ns.default ?? {}), ...ns };
await mod.default({ module_or_path: readFileSync(wasmPath) });

const inferenceMethods = ['embed', 'similarity', 'generate', 'query', 'route'];
const protoMethods = Object.getOwnPropertyNames(mod.RuvLLMWasm.prototype)
  .filter((k) => k !== 'constructor' && !k.startsWith('__'));
const found = inferenceMethods.filter((m) => protoMethods.includes(m));

if (found.length > 0) {
  console.log(`DRIFT: RuvLLMWasm.prototype now exposes ${found.join(', ')} — inference methods appeared. Wire WasmLocalLLMBackend.`);
  process.exit(1);
}

console.log(`gap-confirmed: 0 of [${inferenceMethods.join(',')}] on RuvLLMWasm.prototype. Proto: [${protoMethods.join(',')}]`);
process.exit(0);
