# `@ruvector/ruvllm`: NAPI binding has no `model_path` config; default-loaded weights produce gibberish

## Affected versions

- `@ruvector/ruvllm@2.5.4` (umbrella, npm)
- `@ruvector/ruvllm-darwin-arm64@2.0.1` (platform, npm) — observed on darwin-arm64 / Node 22.22.0.

## Summary

The published NAPI binding (`@ruvector/ruvllm`) exposes `generate`, `query`, and `route` methods on its `RuvLLM` class, but provides **no API to load a custom model file**. The `RuvLLMConfig` and underlying `NativeConfig` shapes have no `model_path` (or `modelPath`, or any equivalent) field; the `RuvLlmEngine` constructor accepts only HNSW / SONA tuning parameters. The result: a default-constructed `RuvLLM` runs in native mode (`isNativeLoaded() === true`) with built-in (presumably untrained) weights and produces gibberish.

This blocks any downstream integration that wants to ship `generate` over NAPI. The CLI binary (`@ruvector/ruvllm-cli`) exposes a documented `--model <path>` flag, so the loading logic exists somewhere — it's just not surfaced through the NAPI binding.

## Reproducer

```js
const um = require('@ruvector/ruvllm');
const llm = new um.RuvLLM();

console.log('isNativeLoaded:', llm.isNativeLoaded());
// → true

console.log('config-accepts-modelPath:', (() => {
  // Try various plausible field names. NAPI accepts the object without
  // throwing — the fields are silently ignored, no schema validation.
  try { new um.RuvLLM({ modelPath: '/tmp/nonexistent.gguf' }); return 'accepted-modelPath'; } catch { return 'rejected'; }
})());
// → accepted-modelPath  (silent ignore; no error, no effect)

console.log('generate output:');
console.log(llm.generate('Once upon a time', { maxTokens: 20 }));
```

## Expected

A way to load a model file at construction time, e.g.:

```js
const llm = new RuvLLM({ modelPath: '/path/to/model.gguf' });
// or
const llm = await RuvLLM.fromFile('/path/to/model.gguf');
```

…such that `generate` produces text matching the loaded model's behaviour.

The CLI's `--model` flag suggests the loading code already exists in Rust; exposing it via a NAPI config field or a `RuvLlmEngine.loadModel(path)` method would close the gap.

## Actual (verbatim output from the reproducer)

```
isNativeLoaded: true
config-accepts-modelPath: accepted-modelPath
generate output:
hadeachq.}that{*thenqwq##ly##lyallhad}LGall82wereSLthatS }of2*rthe8butwthe29ofbythatn##albuty q##s*yhad8L##s2r had9 ny}qrwc|by{##al*##ly##s ##alVnotlnall*]fromfromlof##ly*in]werekofthe##sywthek:e]]of9butatthat##al*##lynotnlqlthenot9*eabout]notofw:qyw)=y]HaboutZ##alenot{byZ|Vabout
```

The output is letter-noise: 0% whitespace, run-on word-fragments up to 46 characters between the few spaces, lots of `##` and stray punctuation. The shape is "string of length N" — what the typedef promises — but no real model is loaded.

## Type-level evidence

The published package's TypeScript declarations confirm the gap. From `node_modules/@ruvector/ruvllm/dist/cjs/native.js` source map:

```ts
interface NativeConfig {
  embedding_dim?: number;
  router_hidden_dim?: number;
  hnsw_m?: number;
  hnsw_ef_construction?: number;
  hnsw_ef_search?: number;
  learning_enabled?: boolean;
  quality_threshold?: number;
  ewc_lambda?: number;
}
```

```ts
interface NativeEngine {
  query(text: string, config?: NativeGenConfig): NativeQueryResponse;
  generate(prompt: string, config?: NativeGenConfig): string;
  route(text: string): NativeRoutingDecision;
  searchMemory(text: string, k?: number): NativeMemoryResult[];
  addMemory(content: string, metadata?: string): number;
  feedback(requestId: string, rating: number, correction?: string): boolean;
  stats(): NativeStats;
  forceLearn(): string;
  embed(text: string): number[];
  similarity(text1: string, text2: string): number;
  hasSimd(): boolean;
  simdCapabilities(): string[];
}
```

No `loadModel`, `setModel`, `model_path`, or equivalent appears anywhere in the binding's surface.

## Downstream impact

A downstream SDK with a tier-1 binding probe asserting `generate` produces non-gibberish output catches this from observation. The same probe acts as a self-correcting flip signal: when upstream wires a model loader, the probe goes from `broken` to `ok` and the SDK's value report automatically reclassifies the capability from dormant to active without any code change downstream.

The probe's three conjunctive assertions (alphanumeric/whitespace ratio ≥ 80%, whitespace ratio ≥ 8%, longest non-whitespace run ≤ 25 chars) catch real gibberish that a single ratio threshold misses — letter-noise without spaces passes alphanumeric checks alone.

## Detection by an integrating SDK

The downstream SDK reports this in its value report:

```
LocalLLM/native: 3 ok, 3 broken
  ✗ generateNonGibberish    broken    alnum/ws=93%, ws=0%, longest-run=46 chars
                                       — only 0.0% whitespace (need ≥8%);
                                       real English text has ~15%.
                                       NAPI binding has no model_path config.
```

```
3 of 12 unique capabilities active. 9 dormant (3 upstream-binding,
3 upstream-bug, 3 design-deferred) — mixed (6/12 observed).
  ⚠ [upstream-bug] generate — STUB UPSTREAM: NAPI binding has no
                              model_path config field. Default-loaded
                              weights produce gibberish.
```

When a fix lands upstream, the SDK's next `healthCheck()` automatically reclassifies — same self-correcting pattern that handles a future `query()`-not-stub fix in `@ruvector/graph-node` (Issue #01).

## Second affected transport: the bundled CLI

The defect manifests in **two** of the three transports the umbrella package ships:

1. **NAPI** (in-process) — covered above. `new RuvLLM()` → gibberish.
2. **CLI** (`node_modules/@ruvector/ruvllm/bin/cli.js`, exposed as `node_modules/.bin/ruvllm`) — **same root cause, surfaced via subprocess.**

The CLI binary's source constructs the same `RuvLLM` JS class with no model path:

```js
// node_modules/@ruvector/ruvllm/bin/cli.js, line 229 and line 877
const llm = new RuvLLM();
// or
const llm = new RuvLLM({ embeddingDim: 768, learningEnabled: false });
```

The CLI's `--help` output enumerates 17 flags (`--json`, `--temperature`, `--max-tokens`, `--top-p`, `--top-k`, `--k`, `--metadata`, `--dims`, `--iterations`, `--force`, `--all`, `--output`, `--epochs`, `--batch-size`, `--lr`, `--margin`) — **no `--model` flag, and no `serve` subcommand**. The `models list` / `models download` / `models status` subcommands manage `~/.ruvllm/models/` (downloads from HuggingFace) but the loading-side never wires the downloaded file into the engine.

Live evidence:

```
$ ruvllm generate "Once upon a time" --max-tokens 10
Warning: Built-in SIMD inference is experimental. For production use, configure an external LLM provider (Ollama, OpenAI, etc.).
XboutuponthenronDbout##erin|inPup0|D0thenthen|Kp/##er|>onb<Sewhenyour5yePonateyourJrrDP\h\||##erthentheyouryour##erpoutD5e5the##sh5zPpon##er5dyourwhen>y"5dowhenwD\wwhenforJoVon\wtheir0o05yourmyouryour0Bp>hin%JO0HB0Pin"forsV\yP5upabout0##ingpBwhenDat>fors0w>yourS9
```

— same letter-noise as the in-process NAPI generate output.

The CLI's emitted warning ("For production use, configure an external LLM provider") is the closest the upstream surface comes to acknowledging that the bundled inference path is non-functional. A consumer who reads only the README would not know whether this warning applies to the NAPI transport too — it does.

**Implication for downstream integrators**: any "use the CLI as a workaround" suggestion (which a downstream SDK might infer from CLI-tool-on-npm) is *not* viable today. The CLI is a thin wrapper around the same defective engine, not an independent loader. A fix in any of the three shapes suggested above would unblock both transports simultaneously.

## Suggested fix shape (downstream perspective)

Either:
1. Add `model_path: string` to `NativeConfig`. The NAPI binding loads the file at construction time. Most ergonomic for the JS-layer wrapper.
2. Add `RuvLlmEngine.loadModel(path: string)` instance method. Lets callers re-load without reconstructing.
3. Document a convention: native auto-loads `~/.ruvllm/models/<default>.gguf` if present. The `ModelDownloader` already targets that directory; a discovery convention would close the loop with zero new API surface. This was checked from the integrating SDK side and does *not* currently happen — confirmed by `isModelDownloaded('small') → false` while default `generate` already produces gibberish output.

Any of the three would unblock the integrating SDK's Phase 2A surface (which currently classifies `generate` as `[upstream-bug]` per the probe above).

## Related findings — see [Issue #06](06-query-route-under-populated-fields.md)

While verifying #05, the same probe pass surfaced a separate defect: `RuvLLM.query()` and `RuvLLM.route()` return objects whose JS-layer wrapper claims to populate 6/5 fields but only delivers 3/3 — `contextSize`, `latencyMs`, `requestId`, `topP` all come back `undefined`.

The first-pass theory in M12.1 was that the native binding under-populated the struct. **That was wrong.** A direct probe of the platform binding (`@ruvector/ruvllm-darwin-arm64@2.0.1`) shows the native side returns *all* fields, all camelCase. The defect is in the umbrella's JS-layer wrapper (`engine.js`), which renames snake_case → camelCase that the native binding has already done — every snake_case lookup hits `undefined`.

Filed as a standalone issue at [`06-query-route-under-populated-fields.md`](06-query-route-under-populated-fields.md) with the corrected root cause and a one-line fix shape.
