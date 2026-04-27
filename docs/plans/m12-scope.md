# M12 — LocalLLM Phase 2 Scoping Report

| Field | Value |
|---|---|
| Status | Scoping (no implementation yet) |
| Date | 2026-04-27 |
| Decision needed from user | Open Questions §6 below |
| Predecessors | M11 scoping (`m11-scope.md`); M11.1 / M11.2 / M11.3 milestones (`m6-scope.md`) |

This is a scoping pass, not a ship-task. Goal: figure out the realistic shape of LocalLLM Phase 2 — `generate`, `stream`, model loading — before writing code. M11 scoping pre-supposed a binding where `model: path` would work via NAPI; live probes during this M12 scoping pass overturn that assumption.

---

## TL;DR

1. **Re-probed all 13 tracked upstream packages** via `tools/reprobe-bindings/reprobe.mjs` (M11.3): zero drift. `@ruvector/ruvllm@2.5.4` still shipping the same NAPI surface as M11.

2. **Severe finding overturning M11's plan.** `@ruvector/ruvllm`'s NAPI `NativeConfig` interface has **no `model_path` (or `modelPath`, or any equivalent) field**. The published binding does not expose a way to load a custom GGUF model file. M11's Phase 2 plan — "ship `generate` behind an explicit `model:` option, wired to the NAPI binding" — is **not viable as written**.

3. **What the binding actually does**: `new RuvLLM()` silently constructs a native engine with default (built-in) weights. `generate(prompt, config)` returns a `string` (not the M5 `GenerateResult` object), and the string is gibberish (`"q8&other_N6q or&_qxsaid+<~xof88toabout5of"` for `Once upon a time` / 8 tokens). `query()` and `route()` return rich, well-typed objects, but the `text` field is the same gibberish.

4. **Two model-loading paths are real**, neither is via the NAPI binding:
   - **CLI subprocess** (`@ruvector/ruvllm-cli@0.1.1`): documented `ruvllm run --model ./model.gguf --prompt "..."`. Real GGUF loading; output goes to stdout.
   - **WASM** (`@ruvector/ruvllm-wasm@2.0.2`): per M11 scoping, exports `RuvLLMWasm` and 30+ classes. Likely accepts model bytes; not re-probed in this pass because the package isn't installed in this workspace.

5. **`ModelDownloader` works fine — independently of model loading.** `getDefaultModelsDir()` returns `~/.ruvllm/models/`; `ModelDownloader.download('claude-code')` HTTP-fetches a 398 MB GGUF from HuggingFace with `.tmp` rename + size verification. **The download path is decoupled from the load path.** That's actually convenient: the SDK can use it regardless of which transport ends up loading the model.

6. **Recommendation**: **two-phase Phase 2**.
   - **Phase 2A (NAPI surface honest)**: wrap `query()` / `route()` over the NAPI binding as the M5 type surface always intended. Surface them as **dormant `upstream-bug`** in `getValueReport`, with a tier-3 probe (`generate-non-gibberish`) that automatically flips them to active when upstream wires real weights. Same M6.2 self-correcting-classification pattern that handled the Cypher stub.
   - **Phase 2B (CLI subprocess transport)**: ship a `cli` backend variant for `LocalLLM` that spawns `ruvllm run --model <path> --prompt <text>` and parses stdout. This is the only path today that actually generates non-gibberish text. Pairs with `ModelDownloader` for first-run model fetch.
   - Streaming deferred to Phase 2C / v0.3 (upstream's `StreamingGenerator` simulates streaming by chunking the full response — not real token-by-token).

---

## What I verified live

### Re-probe (M11.3, 2026-04-27)

Ran `node tools/reprobe-bindings/reprobe.mjs`. **0 drift across 13 packages.**

| Package | Status |
|---|---|
| `@ruvector/ruvllm` | published@2.5.4 (matches M11.1 ratification) |
| `@ruvector/graph-node` | published@2.0.3 |
| `@ruvector/sona` | published@0.1.6 |
| 10× dormant `upstream-binding` | unpublished (matches M9.1 / M11 scoping) |

### NAPI surface: `RuvLLM` prototype (live)

```
embed similarity stats hasSimd isNativeLoaded simdCapabilities
generate query route addMemory searchMemory feedback forceLearn batchQuery
```

Only `embed` and `similarity` are wired in M11.1. The rest are Phase 2 surface.

### `RuvLLMConfig` and `NativeConfig` (live, from `node_modules/@ruvector/ruvllm/dist/cjs/native.js` source map)

```ts
interface RuvLLMConfig {       // JS-layer
  embeddingDim?: number;
  routerHiddenDim?: number;
  hnswM?: number;
  hnswEfConstruction?: number;
  hnswEfSearch?: number;
  learningEnabled?: boolean;
  qualityThreshold?: number;
  ewcLambda?: number;
}

interface NativeConfig {        // NAPI-layer (via toNativeConfig)
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

**Neither shape has a `model_path` field.** `new RuvLlmEngine({ model_path: '/tmp/x.gguf' })` accepts the object without throwing — but the field is silently ignored (no schema validation; the Rust side just doesn't read it).

### `generate` / `query` / `route` (live)

```js
new RuvLLM().generate('Once upon a time', { maxTokens: 8 })
  → "q8&other_N6q or&_qxsaid+<~xof88toabout5of"   // string, gibberish

new RuvLLM().query('What is ML?')
  → { text: "...", confidence: 0.398, model: 'B1_2',
      contextSize: 512, latencyMs: 1.2, requestId: '...' }
                                                    // gibberish text, real shape

new RuvLLM().route('build a vector database')
  → { model: 'B1_2', contextSize: 512,
      temperature: 0.71, topP: 0.9, confidence: 0.43 }
                                                    // plausible, but operating
                                                    // on the broken default
```

**Importantly**: the JS-layer `generate` returns a plain `string`, not the M5 `GenerateResult` object. M12 must wrap. `query` returns a `QueryResponse` whose shape is closer to `Answer` than to `GenerateResult` — that's the surface KB.ask() should target.

### `StreamingGenerator` (live)

```
class StreamingGenerator {
  constructor(llm) { this.llm = llm; }
  // "This simulates streaming by chunking the full response.
  //  Native streaming requires native module support."
  async *stream(prompt, config) {
    const start = Date.now();
    // Generate full response (native streaming would yield ...)
    ...
  }
}
```

The "streaming" interface is fake — it generates the full response then chunks it. Real streaming needs upstream to add a token-callback NAPI method. **Phase 2C / v0.3 deferral confirmed.**

### `ModelDownloader` (live, source inspected)

```
class ModelDownloader {
  constructor(modelsDir = getDefaultModelsDir())
  getModelPath(modelIdOrAlias) → string | null
  isDownloaded(modelIdOrAlias) → boolean       // checks file exists + size ≥ 95% of expected
  getStatus() → Array<{model, downloaded, path}>
  async download(modelIdOrAlias, { force?, modelsDir? }) → string  // HuggingFace HTTPS
  async downloadAll() → Array<...>
  async delete(modelIdOrAlias) / deleteAll()
}
```

Default models dir: `~/.ruvllm/models/`. Three models in `RUVLTRA_MODELS`: `claude-code` (398 MB, 0.5B params, Q4_K_M), `small` (398 MB, 0.5B), `medium` (669 MB, 1.1B). All GGUFs hosted on `huggingface.co/ruv/ruvltra/resolve/main/<filename>.gguf`. **`isModelDownloaded('small') → false` on this machine** — fresh-machine workflow does need the download step.

### CLI surface (recap from M11 scoping; not re-probed live)

```
ruvllm run --model ./model.gguf --prompt "Hello, world"
ruvllm serve --model ./model.gguf --port 3000
ruvllm bench | list | download | chat
```

`ruvllm run` is the documented model-loading entry point. `ruvllm serve` exposes an HTTP server (probably the basis of the SDK's eventual `http` backend).

---

## Where M11's Phase 2 plan needs revision

M11 scoping (`m11-scope.md` §3.1) said:

> **Phase 2 — generate behind an explicit model: option.** Tier-3 probe asserts a known model produces a non-gibberish response (e.g., a model alias resolves, downloads, and `generate("Hello")` produces ASCII tokens). Until a real model is wired, `generate()` throws with an actionable error — same pattern as `ask()` in KB v0.1.

This presumed `LocalLLM.create({ model: path })` would propagate the path into the NAPI binding via a `model_path` config field. **That field does not exist in the published binding's config schema.** The plan is sound at the API-surface level but cannot be implemented over NAPI today — it requires either a CLI subprocess or the WASM bundle to actually load a model.

The same lesson M11 scoping applied to ruvllm-was-published-after-M6 applies here: **trust live probes, not earlier docs.** M11 scoping observed `embed`/`similarity` working but didn't probe the `generate` config path. M12 scoping does, and the answer is "no path there yet."

---

## Three transports re-evaluated for Phase 2

### Transport 1 — NAPI

Status: **embed/similarity work; generate/query/route operate on a broken default model.**

Pros:
- Already wired in M11.1; zero new transport infrastructure.
- Fastest in-process call path.
- Returns rich objects (`QueryResponse` is well-shaped).

Cons:
- **No model loading.** Output quality is gibberish until upstream wires a `model_path` config field or `loadModel()` method.
- The `generate` JS-layer return type is `string`, not `GenerateResult` — SDK wraps.
- Same broken-ESM-build defect as M11.1 (Issue #02 third sample); CJS-only.

### Transport 2 — CLI subprocess

> **CORRECTION — 2026-04-27 (M12.2 live re-probe).** The two claims this section was built on — "documented `--model` flag" and "`ruvllm serve` is an HTTP server" — are **both false in the actually-installed binary**. Probing `node_modules/.bin/ruvllm --help` shows neither a `--model` option nor a `serve` subcommand. The CLI source at `node_modules/@ruvector/ruvllm/bin/cli.js:229,877` constructs `new RuvLLM()` (or `new RuvLLM({ embeddingDim: 768, learningEnabled: false })`) with **no model path** — it shares the same broken-default-model defect as the in-process NAPI surface (Phase 2A / Issue #05). Live evidence: `ruvllm generate "Once upon a time" --max-tokens 10` produces `XboutuponthenronDbout##erin|inPup0|D0...` — same letter-noise as the NAPI path.
>
> Same lesson the M11.3 re-probe tool was built for: trust live probes, not earlier scoping prose. M11 scoping cited the `--model` / `serve` claims from upstream docs; I propagated them into M12 scoping without re-probing the actually-installed CLI. M11.3 catches *npm publication status* drift; the lesson now generalizes — **CLI surface contracts** also need live re-probing before they enter scoping. The `Transport 2` block below is preserved as the *original* analysis to keep this scoping doc honest about what was wrong; the corrected verdict is at the bottom of the section.
>
> The user-facing consequence: **Phase 2B implementation is deferred** until upstream exposes a model-loading API in any transport. There is no CLI quality differentiator over NAPI to ship.

Status (original — incorrect): **published, documented, accepts `--model`. The only path that actually loads a model today.**

Pros (original — claims that turn out to be false):
- Real GGUF loading via the documented CLI flag.
- `ruvllm serve` is an HTTP server — same interface the SDK's eventual `http` backend will need.
- Decoupled lifecycle: SDK can crash without taking model down; vice versa.

Cons (original):
- Subprocess management overhead (start, monitor, restart, parse stdout).
- IPC + process-spawn latency on every call.
- Streaming requires parsing CLI's stdout format or hitting `serve`'s SSE endpoint.
- `@ruvector/ruvllm-cli@0.1.1` — version 0.1 means contract may change; pin defensively.

**Corrected verdict (M12.2):** the CLI offers **no quality benefit over NAPI today**. Subprocess isolation alone (decoupled lifecycle, eventual basis for HTTP backend) is the only remaining argument for the transport, and that's not load-bearing for v0.1. Defer Phase 2B until upstream ships model loading; revisit then.

### Transport 3 — WASM

Status: **published (M11 scoping confirmed); not probed live in this pass.**

Pros:
- Browser-shippable (the SDK's promised third backend per PRD §5.1).
- Loads in Node too.
- Likely accepts model bytes (the `MicroLoraWasm` / `KvCacheWasm` exports in M11 scoping suggest a richer surface than NAPI).

Cons:
- Slower than NAPI for in-process Node use.
- Model bytes still must come from somewhere (SDK can use `ModelDownloader` to fetch and feed bytes).
- Requires a separate adapter layer.

---

## Recommended Phase 2 plan (pending ratification)

### Phase 2A — NAPI honesty pass

Wire `query()` and `route()` as additional methods on `LocalLLM` over `NativeRuvllmBackend`. Both return real objects with a populated `text` field (gibberish today, but contract-correct). Add tier-3 probes:

- `generate-non-gibberish` — `LocalLLM.generate("Once upon a time", { maxTokens: 20 })` produces a string where ≥80% of characters are alphanumeric or whitespace. **Default-fail today**; passes automatically when upstream wires real weights or when the SDK switches transport. Catalog row: `[upstream-bug]` with reason `"NAPI binding has no model_path config; default weights produce gibberish"`. Same self-correcting pattern as Cypher.
- `query-confidence-bounded` — `query(...)` returns confidence ∈ [0, 1]. Passes today (the route confidence we observed was 0.398). Validates the contract is preserved.
- `route-decision-shape` — `route(text)` returns `{ model, contextSize, temperature, topP, confidence }` with `temperature` ∈ [0, 2]. Passes today (we got `0.71`).

The key shape decision: `LocalLLM.generate(prompt, opts) → GenerateResult` wraps the JS-layer string return and synthesises the M5 fields (`tokensIn`, `tokensOut` via simple character heuristics; `explain` via the SDK's existing pipeline).

Effort: ~half-session (small wrapping; tier-3 probes lifted from M11.1's pattern).

### Phase 2B — CLI subprocess transport (`backend: 'cli'`) — **DEFERRED (M12.2)**

> **Status: deferred indefinitely.** The premise this section was written under (CLI accepts `--model`; `serve` subcommand exists; CLI loads custom GGUFs) is contradicted by live re-probing of the actually-installed `@ruvector/ruvllm@2.5.4` CLI binary. See the "CORRECTION" callout under §3.2 Transport 2 above. The CLI shares the same broken-default-model defect as NAPI; shipping a CLI subprocess transport delivers no quality benefit today.
>
> The original plan is preserved below as historical record of what was *intended* and what assumptions broke. Implementation is gated on upstream exposing a model-loading API in any transport.

Add `CliRuvllmBackend` alongside `NativeRuvllmBackend`. Constructor signature:

```ts
LocalLLM.create({
  backend: 'cli',                           // explicit
  model: 'small' | 'claude-code' | string,  // alias OR absolute path to .gguf
  modelsDir?: string,                        // default ~/.ruvllm/models
})
```

Behavior (intended, not viable today):
1. Resolve `model`: if alias, look up in `MODEL_ALIASES` then `RUVLTRA_MODELS`; if path, use directly.
2. If alias and not yet downloaded, call `ModelDownloader.download(alias)` (with progress callback).
3. Lazy-spawn `ruvllm serve --model <path> --port <random>` on first generate. **Wrong**: there is no `serve` subcommand; there is no `--model` flag.
4. `generate(prompt, opts)` POSTs to the local serve port, parses JSON response. **Wrong** for the same reason.
5. `stream` proxies the serve endpoint's SSE if present; otherwise falls back to `await generate()` + chunk. **Wrong** — no SSE endpoint exists.

Tier-3 probes (planned but not built):
- `cli-binary-resolves` — `which ruvllm` (or `npm root -g | xargs -I% ls %/.bin/ruvllm`) succeeds. *Would pass today; the binary is symlinked at `node_modules/.bin/ruvllm`.*
- `cli-generate-non-gibberish` — same ≥80% alphanum assertion against subprocess stdout, gated on a known model being available. *Would always report `broken` today regardless of model file because the CLI ignores the model and uses the same default-NAPI weights.*

Effort: deferred. Cost-vs-value flipped to ~0 once the CLI's lack-of-model-loading was probed. Revisit when upstream ships any model-loading mechanism.

### Phase 2C — WASM backend (deferred)

Adds `WasmRuvllmBackend` for browser use. Out of scope for v0.1 LocalLLM. Worth re-probing live (per the M11.3+M12.2 lesson) before relying on M11 scoping's claim that `RuvLLMWasm` accepts model bytes — that claim is now suspect by association.

---

## Cross-archetype couplings to address with Phase 2

Phase 2 is the milestone that finally lets `LocalLLM.generate` exist. Three other archetypes have features that have been waiting on it:

### KnowledgeBase.ask() — currently throws

```ts
ask(_question: string, _options?: AskOptions): Promise<Answer> {
  throw new NotImplementedError(
    'KnowledgeBase.ask — no LLM is wired in v0.1. Call retrieve(queryEmbedding, ...) ' +
    'for passage-only RAG and synthesize the answer client-side until the LLM milestone lands.'
  );
}
```

Phase 2 enables: `KnowledgeBase.create({ ..., llm: localLLM })` where `llm` is a `LocalLLM` instance. `ask(question)` retrieves citations via the existing `retrieve()`, formats a context-prompt, calls `llm.generate(promptWithCitations)`, returns `{ text, citations, queryId, explain }`. **Same dependency-injection pattern** as M9's `graphReasoner`, M10's `sona`, M11.2's `embedder`.

This is the largest user-facing payoff of Phase 2. Everything else is plumbing; `ask()` is the headline.

### LocalLLM.feedback() — design-deferred in M11.1

The binding's `feedback(requestId, rating)` hooks back into the engine's HNSW + EWC continual-learning state. M11.1 deliberately deferred. With `query`/`route` wired in 2A, `feedback()` becomes meaningful — same pattern as KB+SONA: the SDK records `requestId → original query` mapping; `recordFeedback` calls through.

Open question: does LocalLLM feedback route into a **shared** SONA instance or its own? KB and TSM both use SONA today via M10 wiring. Sharing one engine across archetypes is novel territory.

### LocalLLM.localMemory (addMemory / searchMemory) — design-deferred

The binding's memory layer overlaps `AgentMemory`'s scope. M11 scoping flagged this as a v0.2 archetype-boundaries decision. Phase 2 should explicitly NOT wire it; revisit when AgentMemory's scoping pass starts.

---

## Tier-3 probe assertions (compiled list)

For Phase 2A (NAPI):
- `generate-non-gibberish` — ≥80% alphanumeric/whitespace (would auto-flip from `broken` to `ok` if upstream ships model loading)
- `query-confidence-bounded` — confidence ∈ [0, 1]
- `route-decision-shape` — all five fields present, temperature ∈ [0, 2], topP ∈ [0, 1]

For Phase 2B (CLI):
- `cli-binary-resolves`
- `cli-generate-non-gibberish` (gated on test model availability; otherwise `unsupported`)
- `cli-serve-port-allocation` — random port can be claimed and released

For Phase 2 (cross-archetype):
- `ask-retrieve-then-synthesize` — KB-side: ingest 2 docs, `ask("topic")` returns text + non-empty citations
- (TSM/GR have no obvious LocalLLM dependency in Phase 2)

---

## 6. Open Questions for the user

These decisions lock the Phase 2A / 2B implementation contents. M11's open question #1 (model strategy) gets re-asked in light of the M12 finding.

1. **Two-phase split or single ship-task?** I lean **two**: 2A is small (~half session) and ships immediately useful query/route surface honest about the upstream state; 2B is bigger (~full session) and adds the CLI transport. Doing them as one ship-task risks 2B's complexity slowing 2A's classification fix. Acceptable to split?

2. **Should `KnowledgeBase.ask()` ship in Phase 2, or wait for Phase 3?** It's the highest user-visible payoff but couples KB to LocalLLM (cross-archetype dep #4 after embedder/sona/graphReasoner). I lean **ship in Phase 2B alongside the CLI backend** — `ask()` only becomes useful when generate produces non-gibberish, which only happens with the CLI transport.

3. **Auto-download or explicit-path-only?** With `ModelDownloader` confirmed working, the SDK can support `LocalLLM.create({ model: 'small' })` by downloading on first use. Pros: most ergonomic; matches what `MODEL_ALIASES` implies. Cons: 398 MB silent download on first run. M11 scoping leaned (b) auto-download; I now lean (a) explicit-path-only **for v0.1** with a clear error pointing at `ModelDownloader.download()` — silent multi-hundred-MB downloads are a real DX surprise, and (b) is a one-line change later. Acceptable?

4. **File the "no `model_path` in NAPI" finding as upstream Issue #05?** It's a documented contract gap that affects every consumer. The detection is already in the SDK — `generate-non-gibberish` probe with a clear "default model produces gibberish" diagnostic. I'd author the markdown in `docs/upstream-issues/05-no-model-loading-api.md` matching the M10.2 pattern. Or treat it as part of broader Issue #02 publishing-pipeline scope?

5. **Should `LocalLLM.feedback()` route into KB's shared SONA instance, or LocalLLM's own?** Shared is the cleanest cross-archetype-coupling story — one trajectory engine learning from all archetypes' feedback. Risk: opaque interaction effects between KB-feedback and LocalLLM-feedback signals. Defer this to Phase 3 with the choice spec'd here?

---

## Findings worth surfacing regardless of M12 path

- **`@ruvector/ruvllm`'s `package.json` exports map blocks `dist/cjs/native.js`.** When I tried `require('@ruvector/ruvllm/dist/cjs/native.js')` to inspect `toNativeConfig`, Node threw `ERR_PACKAGE_PATH_NOT_EXPORTED`. The source is readable as a flat file (which is how I inspected it), but cross-package introspection of internals is gated. **Not a blocker** — the public surface is sufficient for M12 — but worth noting for any future "introspect upstream type definitions at runtime" tooling.

- **`ModelDownloader` and the engine are entirely decoupled at the JS layer.** `ModelDownloader` writes to `~/.ruvllm/models/`; `RuvLLM` constructor never references that directory. There's no convention by which the engine auto-discovers downloaded models. Whatever transport ends up loading the model has to be told the path explicitly.

- **Three model files with identical filenames-on-disk would collide.** All three `RUVLTRA_MODELS` entries put their `.gguf` in the same flat directory, but their filenames are distinct (`ruvltra-small-0.5b-q4_k_m.gguf`, etc.). **No collision risk** today, but if upstream adds two variants of the same parameter count (e.g., `small-q4` + `small-q8`), the filename layout would need extending.

- **The `RuvLLM` JS-layer falls back gracefully when the native module isn't loaded.** It returns help text rather than gibberish (`"[RuvLLM JavaScript Fallback Mode] No native SIMD module loaded..."`). The probe assertion `generate-non-gibberish` would PASS in fallback mode — that's a false positive against the real intent. Probe needs to assert specifically that we're in native mode AND the output is non-gibberish; `isNativeLoaded()` distinguishes them.

---

*End of M12 scoping. Next ship-task: ratify §6 open questions with user → M12.1 (Phase 2A) or M12 (combined 2A+2B).*
