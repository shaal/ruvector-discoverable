# `@ruvector/ruvllm-wasm@2.0.0`: missing inference surface + broken `RuvLLMWasm.formatChat`

## Affected versions

- `@ruvector/ruvllm-wasm@2.0.0` (npm) — multiple defects affecting LocalLLM WASM transport

## Summary

Live integration of `@ruvector/ruvllm-wasm@2.0.0` into the SDK's `WasmLocalLLMBackend` (M17.2) surfaced two distinct issues with the WASM binding:

1. **`RuvLLMWasm` has no inference surface.** The main class exports only `initialize / initializeWithConfig / getPoolStats / reset / static formatChat / static version` — **no `embed`, `similarity`, `generate`, `query`, or `route`** equivalent to the NAPI binding's `RuvLLM` prototype. The 45 exports in the package are mostly compute primitives (`BufferPoolWasm`, `InferenceArenaWasm`, `ParallelInference.attention`, `KvCacheConfigWasm`, `MicroLoraWasm`, `SonaInstantWasm`) — building blocks for someone implementing inference manually. End-user inference calls have no WASM analog.
2. **`RuvLLMWasm.formatChat(template, messages)` throws intermittently.** Observed live across two probe sessions: in the first, the static method threw `"null pointer passed to rust"` even with valid `ChatTemplateWasm` and `ChatMessageWasm` instances. In the second (after `new RuvLLMWasm()` + `llm.initialize()` had been called by another caller in the same process), the same call succeeded. The behavior appears to depend on initialization order or some shared WASM state that isn't documented. The underlying `ChatTemplateWasm.format(messages)` works correctly in both cases.

These are not blockers for shipping a working WASM transport — `ChatTemplateWasm.format`, `detectChatTemplate`, and `HnswRouterWasm` work end-to-end and provide three capabilities the NAPI binding lacks. The defects above mean WASM is a *supplemental* transport for LocalLLM, not a *replacement* for native NAPI inference.

## Reproducers

### 1. RuvLLMWasm has no inference methods

```js
import * as m from '@ruvector/ruvllm-wasm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
await m.default({ module_or_path: readFileSync(req.resolve('@ruvector/ruvllm-wasm/ruvllm_wasm_bg.wasm')) });

const llm = new m.RuvLLMWasm();
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(llm)));
// → ['__destroy_into_raw', 'free', 'getPoolStats', 'initialize',
//    'initializeWithConfig', 'isInitialized', 'reset']
//
// No embed, similarity, generate, query, or route methods.
console.log(Object.getOwnPropertyNames(m.RuvLLMWasm).filter(k => !['length','prototype','name'].includes(k)));
// → ['formatChat', 'version']
//
// Static methods: only formatChat (broken, see #2 below) and version.
```

For comparison, the NAPI binding's `RuvLLM` instance has 14 methods including `embed / similarity / generate / query / route / addMemory / searchMemory / feedback / forceLearn`. The WASM binding has none of these on its main class.

### 2. `RuvLLMWasm.formatChat` throws "null pointer passed to rust" (intermittent)

**First probe — fails:**

```js
// (after WASM init via m.default(bytes), no other prior calls)
const llm = new m.RuvLLMWasm();
llm.initialize();
const tmpl = m.ChatTemplateWasm.llama3();
const msgs = [m.ChatMessageWasm.user('Hello'), m.ChatMessageWasm.assistant('Hi!')];
const broken = m.RuvLLMWasm.formatChat(tmpl, msgs);
// → throws: Error: null pointer passed to rust
//   at __wbg___wbindgen_throw_39bc967c0e5a9b58 (.../ruvllm_wasm.js:3152:19)
```

**Second probe — succeeds:**

```js
// Same module, same init, but a second smoke-check probe runs the
// equivalent call later in the process and gets a 121-char string back.
m.RuvLLMWasm.formatChat(tmpl, msgs);
// → '<|begin_of_text|><|start_header_id|>...|>'  (121 chars, correct)
```

`tmpl` and `msgs` are valid wasm-bindgen objects (constructed via public factory methods); calling `tmpl.format(msgs)` directly produces correct output in both cases. The intermittent failure suggests a shared-state or initialization-order dependency in `RuvLLMWasm.formatChat`'s wrapper layer.

The SDK uses `ChatTemplateWasm.format()` directly to bypass the issue regardless of which initialization order the consumer ends up in.

## Expected

After WASM init and a `new RuvLLMWasm()`:

1. The class should expose `embed(text) / similarity(a, b) / generate(prompt, config) / query(text) / route(text)` — same shape as `@ruvector/ruvllm`'s `RuvLLM` JS class. If the WASM binding genuinely doesn't include inference (because of WASM perf / size considerations), the README and `.d.ts` should explicitly document that it's a primitives-only library and steer consumers to the NAPI binding for end-user inference.
2. `RuvLLMWasm.formatChat(template, messages)` should produce the same output as `template.format(messages)` — at minimum, not throw on validly-constructed inputs.

## Actual

Per the reproducers above. Tested live on `@ruvector/ruvllm-wasm@2.0.0` installed fresh from npm.

## Workaround in downstream SDK

The SDK's `WasmLocalLLMBackend` (`packages/sdk/src/backends/wasm-ruvllm.ts`):

- Throws `RuVectorError('CAPABILITY_DEFERRED', ...)` on `embed / embedBatch / similarity / generate / query / route` with a "use transport: 'native'" pointer message.
- Implements `formatChat()` by calling `ChatTemplateWasm.format()` directly (bypassing the broken `RuvLLMWasm.formatChat`).
- Surfaces three working WASM-only capabilities at the LocalLLM archetype level: `formatChat`, `detectChatTemplate`, `createHnswRouter`. Native transport throws `CAPABILITY_DEFERRED` on these in turn (with a "use transport: 'wasm'" pointer).
- The smoke-check observes the broken-formatChat as a `broken` probe result; when upstream fixes it, the SDK's classification flips to `active` automatically (M6.2 self-correcting pattern).
- Emits a one-time `console.warn` at `LocalLLM.create({ backend: { kind: 'wasm' } })` time naming the inference-method gap so consumers see the limitation immediately rather than discovering it via per-method errors.

## Suggested fix priority

In order of consumer impact:

1. **Inference parity** — either expose `embed / similarity / generate / query / route` on `RuvLLMWasm` (preferred, makes WASM transport viable as a browser/edge inference path), OR explicitly document the package as a primitives library and rename it (e.g., `@ruvector/ruvllm-primitives-wasm`) to set expectations.
2. **`RuvLLMWasm.formatChat`** — fix the null-pointer marshalling bug. The underlying `ChatTemplateWasm.format` works; whatever wrapper boilerplate `formatChat` does to its arguments is broken.

## Cross-references

- Issue #05 — `@ruvector/ruvllm` NAPI binding has no `model_path` config; same theme of "inference surface present but functionally limited."
- SDK reference: `packages/sdk/src/backends/wasm-ruvllm.ts` — the adapter that lives with these defects.
- SDK reference: `docs/plans/m17-scope.md` — original M17 scoping doc that anticipated WASM richness based on raw export count (45 vs 14); M17.2 found that count measured the wrong dimension (compute primitives vs end-user inference surface).

## SDK diagnostic that will detect resolution

The SDK's tier-1 binding probes (`WasmLocalLLMBackend.smokeCheck`) include named probes for `chatTemplate`, `chatTemplateDetect`, `hnswRouting` (all currently `ok`), `ruvllmFormatChat` (currently `broken` per defect #2 above), plus declared-`unsupported` results for the 5 inference methods (defect #1). When upstream addresses any of these, the next `healthCheck()` flips the corresponding catalog row from `dormant` → `active` with no SDK code change. `tools/reprobe-bindings/reprobe.mjs` v0.4 already tracks `@ruvector/ruvllm-wasm` with `expect: 'published'`; future versions can extend with surface-contract probes (similar to M11.3 v0.2 CLI checks) once `RuvLLMWasm`'s `.d.ts` gains the missing inference methods.
