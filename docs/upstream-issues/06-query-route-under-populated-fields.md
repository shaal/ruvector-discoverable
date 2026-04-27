# `@ruvector/ruvllm`: JS wrapper drops 3-of-6 / 2-of-5 fields from `query()` / `route()` due to snake_case vs camelCase mismatch

## Affected versions

- `@ruvector/ruvllm@2.5.4` (umbrella, npm) — observed on darwin-arm64 / Node 22.22.0.

The defect lives in the JS-layer wrapper that ships in the umbrella. The underlying NAPI binding (`@ruvector/ruvllm-darwin-arm64@2.0.1`) is **not** at fault — see "Root cause" below.

## Summary

`RuvLLM.query(text, config?)` is documented to return a 6-field `QueryResponse` (`text`, `confidence`, `model`, `contextSize`, `latencyMs`, `requestId`). It actually returns 6 keys but only 3 are populated; the other 3 are `undefined`.

`RuvLLM.route(text)` is documented to return a 5-field `RoutingDecision` (`model`, `contextSize`, `temperature`, `topP`, `confidence`). It returns 5 keys but only 3 are populated; `contextSize` and `topP` are `undefined`.

This is independent of [Issue #05](05-no-model-loading-api.md). #05 describes the binding running on broken default weights (output is gibberish); #06 describes the JS-layer wrapper dropping fields on the way back to the caller. Both are real, both are present in `@ruvector/ruvllm@2.5.4`, but each can be fixed independently.

## Reproducer

```js
const { RuvLLM } = require('@ruvector/ruvllm');
const llm = new RuvLLM();

const q = await llm.query('what is machine learning?');
console.log('query keys:', Object.keys(q));
console.log('per-field typeof:');
for (const k of ['text', 'confidence', 'model', 'contextSize', 'latencyMs', 'requestId']) {
  console.log(`  ${k.padEnd(12)} ${typeof q[k]}${q[k] === undefined ? ' (undefined)' : ''}`);
}

const r = await llm.route('build a vector database');
console.log('\nroute keys:', Object.keys(r));
console.log('per-field typeof:');
for (const k of ['model', 'contextSize', 'temperature', 'topP', 'confidence']) {
  console.log(`  ${k.padEnd(12)} ${typeof r[k]}${r[k] === undefined ? ' (undefined)' : ''}`);
}
```

## Expected

All declared fields populated with values matching the typedef:

```
query keys: [text, confidence, model, contextSize, latencyMs, requestId]
  text         string
  confidence   number
  model        string
  contextSize  number
  latencyMs    number
  requestId    string

route keys: [model, contextSize, temperature, topP, confidence]
  model        string
  contextSize  number
  temperature  number
  topP         number
  confidence   number
```

## Actual (verbatim from the reproducer above)

```
query keys: [text, confidence, model, contextSize, latencyMs, requestId]
per-field typeof:
  text         string
  confidence   number
  model        string
  contextSize  undefined (undefined)
  latencyMs    undefined (undefined)
  requestId    undefined (undefined)

route keys: [model, contextSize, temperature, topP, confidence]
per-field typeof:
  model        string
  contextSize  undefined (undefined)
  temperature  number
  topP         undefined (undefined)
  confidence   number
```

`JSON.stringify` drops `undefined` values silently, so a quick eyeball of `JSON.stringify(q)` shows a neatly-shaped 3-field object with no obvious indication that 3 declared fields are missing. This is how the defect went unnoticed long enough to ship in 2.5.4.

## Root cause

The bug is **not** in the native binding. The native binding returns all fields populated, in camelCase. Probing the platform-specific binding directly:

```js
const native = require('@ruvector/ruvllm-darwin-arm64');
const e = new native.RuvLlmEngine();
console.log(JSON.stringify(await e.query('what is ML?'), null, 2));
```

```json
{
  "text": "...",
  "confidence": 0.593869686126709,
  "model": "B1_2",
  "contextSize": 2048,
  "latencyMs": 674.634416,
  "requestId": "7f80dc80-ecdb-4eb7-be15-d83073f9eecd"
}
```

Six fields, all populated, all camelCase. (`napi-rs` and similar Rust→JS binding generators commonly auto-convert snake_case Rust field names to camelCase in the JS-visible output.)

The umbrella's JS-layer wrapper at `node_modules/@ruvector/ruvllm/dist/cjs/engine.js` (also `dist/esm/engine.js`) does this:

```js
query(text, config) {
  if (this.native) {
    const result = this.native.query(text, toNativeGenConfig(config));
    return {
      text: result.text,
      confidence: result.confidence,
      model: result.model,
      contextSize: result.context_size,    // ← native returns `contextSize`, not `context_size`
      latencyMs: result.latency_ms,         // ← native returns `latencyMs`, not `latency_ms`
      requestId: result.request_id,         // ← native returns `requestId`, not `request_id`
    };
  }
  // ... fallback omitted
}
```

```js
route(text) {
  if (this.native) {
    const result = this.native.route(text);
    return {
      model: result.model,
      contextSize: result.context_size,    // ← `contextSize` (camelCase) on native
      temperature: result.temperature,
      topP: result.top_p,                   // ← `topP` (camelCase) on native
      confidence: result.confidence,
    };
  }
}
```

The wrapper is renaming snake_case → camelCase, but the native binding already emits camelCase. Every snake_case lookup returns `undefined`. The 3 fields that survive (`text`, `confidence`, `model` for `query`; `model`, `temperature`, `confidence` for `route`) are the ones whose names happen to be identical in both conventions (no underscore, so case-conversion is a no-op).

## Downstream impact

For an integrating SDK, this means:

- Any `requestId`-based feedback flow is broken from the start. The integrator records the request, gets `undefined` back as the ID, then has nothing to pass to `feedback(requestId, rating)`.
- Latency tracking via `latencyMs` always shows `undefined` — telemetry pipelines either error or display garbage.
- `contextSize` is documented in the README as a routing tradeoff lever but is invisible to consumers; same for `topP` on `route()`.
- Type-checked TypeScript consumers don't catch this at compile time because the wrapper's return type still claims to fulfill the full interface. Runtime-only failure.

## Detection by an integrating SDK

The integrating SDK's tier-1 binding probes (added in M12.1) catch the defect from observation:

```
LocalLLM/native: 3 ok, 3 broken
  ✗ queryConfidenceBounded   broken    confidence ok (0.549) but missing/wrong-type fields:
                                       contextSize(undefined), latencyMs(undefined),
                                       requestId(undefined). Native QueryResponse struct
                                       under-populated — separate from upstream-issues/05.

  ✗ routeDecisionShape       broken    RoutingDecision missing/wrong-type fields:
                                       contextSize(undefined), topP(undefined). Native struct
                                       under-populated (same defect as queryConfidenceBounded).
```

(The diagnostic text in M12.1 attributed the defect to "native struct under-populated" — that was the integrator's first-pass theory before probing the native binding directly. M12.3's reproducer for this issue probed the platform binding and identified the JS-wrapper rename layer as the real root cause. The probe diagnostics will be updated in a follow-up to reflect the corrected attribution.)

The probes flip from `broken` to `ok` automatically when the wrapper is fixed — same M6.2 self-correcting-classification pattern used for [Issue #01](01-graph-node-cypher-stub.md)'s Cypher stub.

## Suggested fix shape

**Easiest** — drop the unnecessary renaming entirely. The native return value already has the correct field names and types:

```diff
 query(text, config) {
   if (this.native) {
     const result = this.native.query(text, toNativeGenConfig(config));
-    return {
-      text: result.text,
-      confidence: result.confidence,
-      model: result.model,
-      contextSize: result.context_size,
-      latencyMs: result.latency_ms,
-      requestId: result.request_id,
-    };
+    return result;
   }
   // ... fallback path remains
 }

 route(text) {
   if (this.native) {
-    const result = this.native.route(text);
-    return {
-      model: result.model,
-      contextSize: result.context_size,
-      temperature: result.temperature,
-      topP: result.top_p,
-      confidence: result.confidence,
-    };
+    return this.native.route(text);
   }
 }
```

Slightly more conservative — keep the renaming wrapper but fix the field lookups to match the native binding's actual camelCase output (`result.contextSize`, `result.latencyMs`, `result.requestId`, `result.topP`). Same outcome, more code.

If upstream is intentionally using the wrapper as a contract layer (in case the native binding's field names change in future), the wrapper should at minimum log a warning when a renamed field is `undefined`, OR the build/test pipeline should add a smoke test that asserts every documented field is populated post-construction. Either would have caught this before publication.

## Related to

- [Issue #05](05-no-model-loading-api.md) — separate defect; same wrapper file (`engine.js`); same pattern of "the contract surface is shaped right but the data isn't there." Both can be fixed independently.
- [Issue #02](02-broken-umbrella-packages.md) — third sample of broken-umbrella-build defects in `@ruvector/ruvllm@2.5.4` (the ESM build's `Cannot find module 'dist/esm/types'` defect, observed in M11.1). All three suggest a publishing-pipeline audit would surface multiple issues at once.
