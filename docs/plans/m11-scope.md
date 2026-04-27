# M11 — LocalLLM Scoping Report

| Field | Value |
|---|---|
| Status | Scoping (no implementation yet) |
| Date | 2026-04-27 |
| Decision needed from user | Path A vs B vs C (or hybrid) below |

This is a scoping pass, not a ship-task. Goal: figure out the realistic shape of a `LocalLLM` archetype before writing code, same pattern as `m6-scope.md`.

---

## TL;DR

1. **My M6 scoping conclusion that "`@ruvector/ruvllm` has no NAPI binding" was wrong.** As of this scoping session, `@ruvector/ruvllm@2.5.4` + `@ruvector/ruvllm-darwin-arm64@2.0.1` are both **published on npm with real binaries**. The platform package is 838 KB of Rust binary, not a placeholder. This rewrites the entire LocalLLM plan.

2. **All three options I'd planned to evaluate are actually available**: WASM (`@ruvector/ruvllm-wasm@2.0.2`, 30+ exports), CLI (`@ruvector/ruvllm-cli@0.1.1`, full subcommand set), NAPI (`@ruvector/ruvllm@2.5.4`, the umbrella's `RuvLLM` class works via CJS).

3. **`embed()` and `similarity()` work out-of-the-box** with the NAPI path. Real 768-dim embeddings, semantically meaningful similarity scores. **This means the SDK can drop the "user must supply pre-computed embeddings" caveat from KnowledgeBase / TimeSeriesMemory**.

4. **`generate()` runs mechanically but produces gibberish without a model file**. The default `new RuvLLM()` gives the user a runtime that *runs* but doesn't *know anything* — same pattern as the M6 Cypher stub: looks like it works, fails on result quality.

5. **Recommendation**: a *hybrid* implementation. NAPI primary (best perf, working embeddings); WASM as the browser fallback (already built; no extra work); CLI subprocess for ops use cases (`serve`, `bench`). All three are real today.

6. **One related action**: re-probe upstream npm publication status periodically. M9.1's dormant classification depends on it. The other dormant `upstream-binding` entries (attention-node, gnn-node, solver-node, etc.) **were re-probed during this scoping** and remain unpublished.

---

## What I verified live

### Publication status (probed via `npm view <pkg> version`)

| Package | Version | Notes |
|---|---|---|
| `@ruvector/ruvllm` | **2.5.4** | Umbrella; has both NAPI binding and JS wrapper layer |
| `@ruvector/ruvllm-darwin-arm64` | **2.0.1** | 838 KB Rust binary |
| `@ruvector/ruvllm-wasm` | **2.0.2** | `.wasm` bundle + JS loader |
| `@ruvector/ruvllm-cli` | **0.1.1** | CLI binary (`ruvllm` subcommands) |
| `@ruvector/attention-node` | not published | M9.1 dormant entry remains accurate |
| `@ruvector/gnn-node` | not published | same |
| `@ruvector/diskann-node` | not published | same |
| `@ruvector/solver-node` | not published | same |
| `@ruvector/sparsifier-node` | not published | same |

### NAPI surface (`@ruvector/ruvllm-darwin-arm64/ruvllm.darwin-arm64.node`)

```
binding keys: [ 'RuvLlmEngine', 'SimdOperations', 'hasSimdSupport', 'version' ]
RuvLlmEngine.prototype: addMemory, embed, feedback, forceLearn, generate, hasSimd,
                         query, route, searchMemory, simdCapabilities, similarity, stats
```

The umbrella's `RuvLLM` class wraps this with 14 methods (adds `batchQuery`, `isNativeLoaded`).

### Live behavior probes (default-construct `new RuvLLM()`)

```
isNativeLoaded: true
hasSimd: true
stats: { totalQueries: 0, memoryNodes: 0, patternsLearned: 0,
         avgLatencyMs: 0, cacheHitRate: 0, routerAccuracy: 0.5 }

embed("hello world")
  → array len=768, first 4 = [0.0028, 0.0062, 0.0004, 0.0046]   ✓ real

similarity("apple pie", "fruit dessert")
  → 0.9874                                                       ✓ semantically sane

generate("Once upon a time", { maxTokens: 20 })
  → "as##edR|?$X##edwithananT##edfor##tion?RNBHRbut..."          ✗ GIBBERISH
                                                                   no model file loaded

query("What is the capital of France?")
  → { text: "BN##lygEeifjthere...", confidence: 0.398 }           ✗ same issue

route("build me a vector database", { models: ['s','m','l'] })
  → { model: 'B1_2', temperature: 0.71, confidence: 0.43 }        ~ runs; output strange
```

### WASM surface (`@ruvector/ruvllm-wasm@2.0.2`)

Loads cleanly. Exports 30+ classes including `RuvLLMWasm`, `MicroLoraWasm`, `KvCacheWasm`, `HnswRouterWasm`, `SonaInstantWasm`, `AdaptFeedbackWasm`, `BufferPoolWasm`, plus utility functions (`getVersion`, `healthCheck`, `detectChatTemplate`, `detect_capability_level`).

The `.d.ts` is rich: `AdaptFeedbackWasm` has a `quality` score in [0,1] and `learningRate`; `KvCacheWasm` tracks paged KV cache stats; `MicroLoraWasm` provides per-request adaptation (matches the SONA pattern from M10).

### CLI surface (`@ruvector/ruvllm-cli@0.1.1`)

```
RuvLLM CLI v0.1.0
Commands: run | bench | serve | list | download | chat
Options : --model, -p prompt, -b backend (metal|cuda|cpu),
          --port, --iterations, --temperature, --max-tokens
Examples: ruvllm run --model ./model.gguf --prompt "Hello, world"
          ruvllm serve --model ./model.gguf --port 3000
```

A subprocess-shell would `spawn('ruvllm', ['run', '--model', ..., '--prompt', ...])` and parse stdout. The `serve` mode is a real HTTP server — probably the cleanest integration for a long-running SDK process.

### Model loading path

The umbrella exports `MODEL_ALIASES` and `ModelDownloader`:

```js
const { MODEL_ALIASES, RUVLTRA_MODELS } = require('@ruvector/ruvllm');
MODEL_ALIASES = { cc, claudecode, claude, s, sm, m, med, default, ... }
RUVLTRA_MODELS = { 'claude-code', 'small', 'medium' }
```

Pattern: aliases resolve to model identifiers; `ModelDownloader` pulls from Hugging Face. No model is bundled with the package — first call after `download` populates a local cache.

The CLI's `ruvllm download` and `ruvllm list` subcommands appear to be the user-facing equivalent of the same pattern.

---

## Where my M6 scoping went wrong

M6 v0.1's scoping doc said:

> **LocalLLM** — `ruvllm` has *no NAPI binding* in the repo or on npm. Only WASM + CLI.

That was incorrect by the time it was written, OR upstream shipped the NAPI between M6 and now (M11). I should have re-probed before deferring. **Lesson for future scoping passes: re-run the probes any time a recommendation depends on a published-or-not status. Never trust an earlier scoping doc's "not published" claim without re-verifying.**

This generalizes: M9.1's dormant classification depends on similar publication-status checks. Re-probing all of them quarterly (or any time a milestone deals with one) keeps the dormant list honest. I re-probed the *other* unpublished bindings during this scoping; they remain unpublished, so M9.1's classification is still accurate.

---

## Three options for LocalLLM v0.1

### Option A — NAPI primary

`@ruvector/ruvllm@2.5.4` via the umbrella (CJS works; ESM is broken — same upstream defect as `ruvector` and `@ruvector/sona` from Issue #02).

Pros:
- **Embeddings work today.** `embed("...")` returns a real 768-dim vector. This unlocks dropping the "user supplies embeddings" caveat across KB / TSM / GR.
- **Similarity works today.** Useful for KB's eventual full Graph RAG with semantic edge-weighting, and for AgentMemory's recall scoring.
- **Same machinery as M6/M7/M10**: NAPI adapter + tier-2 smoke check + tier-3 archetype probe.
- Best performance.

Cons:
- **Generation produces gibberish without a model file.** Same Cypher-stub-style failure mode: looks fine in a smoke check that just calls `generate()` and gets a string back, fails on result quality.
- Model loading adds another moving part (download, cache, file paths).
- Broken ESM build means CJS-only for the foreseeable future.

### Option B — WASM browser fallback

`@ruvector/ruvllm-wasm@2.0.2` for in-browser use. Loads cleanly in Node too.

Pros:
- Already built and published; ~zero incremental work to wire in alongside NAPI.
- Browser support is the SDK's promised third backend (alongside native, http) per the M5 PRD.
- Runs without filesystem access (model bytes can be fetched).

Cons:
- Slower than NAPI. Not the right primary for a Node-side archetype.
- Same model-file requirement as NAPI.

### Option C — CLI subprocess

`@ruvector/ruvllm-cli` spawned as a subprocess; `ruvllm serve` for long-running, `ruvllm run` for one-shot.

Pros:
- **Operationally clean.** Decoupled lifecycle: SDK can crash without taking the model down; model can crash without taking the SDK down.
- The `serve` mode is an HTTP server — same interface the SDK's eventual HTTP backend will use, so this option doubles as a stand-in for that backend.
- No JS-side memory pressure from the LLM weights.

Cons:
- Subprocess management overhead (start, monitor, restart).
- IPC latency on every call.
- Streaming generation requires parsing the CLI's stdout format (or hitting `serve`'s SSE endpoint).

---

## Recommendation: hybrid

**LocalLLM v0.1 ships all three, with NAPI as the default and the user choosing per-instance:**

```ts
// Default (Node, embedded):
const llm = await LocalLLM.create({ model: 'small' });
// → resolves to NAPI

// Browser:
const llm = await LocalLLM.create({ model: 'small', backend: 'wasm' });

// Long-running ops:
const llm = await LocalLLM.create({ model: '/models/q4.gguf', backend: 'cli' });
// → spawns `ruvllm serve` and proxies via HTTP
```

The scoping doesn't lock in the API; that's the M5-style frozen surface job. What scoping does is identify that **all three transports are realistically buildable today**, with the NAPI path delivering immediate value via working embeddings + similarity, and generation gated on the user supplying a real model.

### Phased v0.1

1. **Phase 1 — NativeRuvllmBackend + LocalLLM archetype with embed/similarity only.** No `generate` exposed; tier-3 probe verifies `embed` produces a 768-dim vector and `similarity(x, y) > 0.5` for known-related strings. **Drop the "user must supply embeddings" requirement across KB / TSM** — they can call `llm.embed(text)` themselves once a LocalLLM is wired.

2. **Phase 2 — generate behind an explicit model: option.** Tier-3 probe asserts a known model produces a non-gibberish response (e.g., a model alias resolves, downloads, and `generate("Hello")` produces ASCII tokens). Until a real model is wired, `generate()` throws with an actionable error — same pattern as `ask()` in KB v0.1.

3. **Phase 3 — WASM and CLI backends.** Plug into the same archetype shape as additional backend kinds.

### Tier-3 probe ideas

- `embed-roundtrip`: `embed("hello") → 768-dim vector with non-zero norm`. Catches the "binding loads but returns junk" failure mode.
- `similarity-monotonic`: `similarity("apple pie", "fruit dessert") > similarity("apple pie", "tax law")`. Catches a binding that always returns 1.0 or 0.0.
- `generate-non-gibberish` (Phase 2 only): with a real model loaded, `generate("Once upon a time")` produces a string where ≥80% of characters are alphanumeric or whitespace. Catches the M11-scoping observation that default-construct produces hash-laden gibberish.

---

## Open questions for the user

1. **Model strategy.** Three sub-options:
   - (a) SDK ships with no default; user provides path/alias.
   - (b) SDK wraps `ModelDownloader` so `LocalLLM.create({ model: 'small' })` auto-downloads on first use.
   - (c) Bundle a tiny model with the SDK for "out-of-the-box demo" but require explicit choice for production.
   
   I lean (b) — most ergonomic, matches what `RuvLlmEngine` and `MODEL_ALIASES` already imply, but it does mean first run downloads several GB. (a) is most conservative.

2. **Streaming.** The NAPI binding doesn't expose a streaming `generate` method I could see. If users want token-by-token output, the CLI subprocess's `serve` mode (SSE) is the path. Acceptable for v0.1 to ship batch-only and document streaming as v0.2?

3. **Embeddings unlock — when do I propagate?** Wiring `embed()` from `LocalLLM` lets the SDK auto-derive embeddings for `Document` / `TimeSeriesPoint` / graph entities. This was a v0.2 promise across multiple archetype READMEs. Should LocalLLM ship *first* (Phase 1) so KB/TSM/GR can drop their "user supplies embedding" caveats in M11.x follow-ups, OR ship in lockstep with the auto-embedder integrations?

4. **Re-probing protocol.** Given that ruvllm publication slipped past my M6 scoping, should the SDK have a periodic-re-probe routine? A small script that runs `npm view <pkg> version` for every dormant `upstream-binding` entry and flags discrepancies. ~30 LOC; would have caught this earlier.

5. **Issue #02 scope expansion.** The umbrella `@ruvector/ruvllm@2.5.4` has the same broken ESM build as `ruvector` and `@ruvector/sona` (Cannot find module 'dist/esm/types' — i.e., `index.js` references files not in the tarball). Three samples is a confirmed pattern; Issue #02 should be updated to add `@ruvector/ruvllm` and recommend a publishing-pipeline audit across the org.
