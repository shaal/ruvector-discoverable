# M6 — Scoping Report

| Field | Value |
|---|---|
| Status | Scoping (no commit, no implementation yet) |
| Date | 2026-04-26 |
| Author | M5 → M6 transition |
| Decision needed from user | Path A vs B vs C below |

This is a scoping pass, not a ship-task. Goal: figure out the realistic shape of M6 *before* committing to delivery. Investigates what's needed to bring **one archetype** from M5's "throws NotImplementedError" to a working call site against upstream.

---

## TL;DR

1. **GraphReasoner is unblocked for M6 v0.1** — prebuilt darwin-arm64 binary installs from npm and loads cleanly. No Rust build required.
2. **Five other archetypes are blocked or partially blocked.** KnowledgeBase, AgentMemory, TimeSeriesMemory need `attention-node` / `gnn-node` packages that **are not published on npm**. LocalLLM has *no NAPI binding at all*; it ships as WASM + CLI only. AgentFramework's rvagent-* family has no published bindings.
3. **M5's GraphReasoner types need revision.** The upstream NAPI surface diverges from my M5 sketch in several substantive places (embeddings are required, `Edge.type` is actually `Edge.description`, no `pageRank()` or `communities()` in the binding).
4. **Recommendation:** scope M6 v0.1 as **one archetype (GraphReasoner) end-to-end with a working reference example**, plus revisions to M5's types to match reality. ~1 focused session. v0.2 of M6 builds remaining bindings from source.

---

## What I verified (live probes against upstream)

### `@ruvector/core` prebuilt binary

Loaded directly from `ruvector/npm/core/platforms/darwin-arm64/ruvector.node` with vanilla `require()`:

```
Exports: [CollectionManager, JsDistanceMetric, VectorDb, getHealth, getMetrics, hello, version]
Version: 2.2.0
Health: { status: "healthy", version: "2.2.0", uptimeSeconds: 0 }
```

**Reality check:** the headline `@ruvector/core` NAPI surface is **just a basic vector DB**. None of the unique capabilities the SDK promises (Cypher, SONA, Graph RAG, ColBERT, hybrid search, attention) live in this binary. They live in **other crates** that need their own bindings.

### npm registry availability

Probed each platform package via `npm view <name> version`:

| Package | Status | Notes |
|---|---|---|
| `@ruvector/core-darwin-arm64` | **NOT published** | Only available via in-repo prebuilt |
| `@ruvector/graph-node-darwin-arm64` | **2.0.2 published** ✓ | GraphReasoner is unblocked |
| `@ruvector/rvf-node-darwin-arm64` | **0.1.7 published** ✓ | Useful for advanced/RVF surface |
| `@ruvector/sona-darwin-arm64` | **0.1.5 published** ✓ | Useful for SONA continual learning |
| `@ruvector/attention-node-darwin-arm64` | **NOT published** | Blocks KnowledgeBase/AgentMemory/TimeSeries from cleanly using attention |
| `@ruvector/gnn-node-darwin-arm64` | **NOT published** | Blocks AgentMemory's GNN-learned index |
| `ruvector` (umbrella) | 0.2.23 published, **but broken** | `package.json#main` points to `dist/index.js` which isn't in the published tarball |

### Live install + load probe

```
$ npm install @ruvector/graph-node
  → installs @ruvector/graph-node + @ruvector/graph-node-darwin-arm64

$ node -e "console.log(Object.keys(require('@ruvector/graph-node')))"
  → ['GraphDatabase', 'HyperedgeStream', 'JsDistanceMetric',
     'JsTemporalGranularity', 'NodeStream', 'QueryResultStream',
     'hello', 'version']
```

Loaded cleanly. **GraphReasoner has a real backend.**

---

## Where M5's types diverge from upstream NAPI reality

This is the most important finding for M6. M5 v0.1 was an opinionated guess; the actual `@ruvector/graph-node` shape forces revisions:

| M5 GraphReasoner | Upstream `@ruvector/graph-node@2.0.3` | Verdict |
|---|---|---|
| `static create(options)` | `static GraphDatabase.open()` | Rename to align (or wrap, both are fine) |
| `addNodes(Node[])` (Node has no embedding) | `createNode(JsNode)` + `batchInsert({nodes, edges})`; **`embedding: Float32Array` is required** | M5 must require embeddings or carry an embedder config |
| `addEdges(Edge[])` with `Edge.type: string` | `createEdge(JsEdge)` with `description` (not `type`); `embedding: Float32Array` required | Field rename + embedding requirement |
| `addHyperedges(Hyperedge[])` with `type` | `createHyperedge(JsHyperedge)` with `description` | Field rename |
| `cypher(query, params)` | `query(...)` / `querySync(...)` | Binding is generic; SDK can keep the `cypher()` name |
| `pageRank({topK, damping})` | **NOT IN BINDING** | Drop from M5 v0.1 OR mark deferred to v0.2; pageRank lives in `ruvector-solver` (no published binding) |
| `communities({resolution})` | **NOT IN BINDING** | Same — Leiden lives in `ruvector-graph` Rust code but isn't NAPI-exposed |
| `getValueReport()` / `introspect()` | (SDK-side, not in binding) | OK — these are SDK-implemented over the binding |
| (no equivalent) | `kHopNeighbors`, `searchHyperedges`, `subscribe`, `begin/commit/rollback`, `stats` | M5 should add these to GraphReasoner, OR explicitly defer to advanced/ |

**Net:** M5's GraphReasoner needs 6–8 small type revisions. None are catastrophic. Each is an honest finding from M6's reality check — exactly what the M5 PRD §5.3 commentary said would happen.

---

## What's blocked beyond GraphReasoner

| Archetype | Blocking reason |
|---|---|
| **KnowledgeBase** | Needs hybrid search + Graph RAG + ColBERT + SONA. Hybrid/ColBERT live in `ruvector-core` (basic VectorDb only — no rerank API). Graph RAG needs `@ruvector/graph-node` (have it) **plus** Leiden community detection (not in binding). SONA is published. So KnowledgeBase v0.1 could ship a *degraded* path with hybrid+SONA but no Leiden. Substantive feature loss. |
| **AgentMemory** | Needs `gnn-node` (not published) for the learned index — the whole point of this archetype. v0.1 would be a wrapper around generic vector recall, missing the differentiator. |
| **TimeSeriesMemory** | Needs `attention-node` (Mamba) — not published. Also needs `delta-*` family with no Node bindings at all. |
| **LocalLLM** | `ruvllm` has **no NAPI binding** in the repo or on npm. Only WASM + CLI. Three options: (1) wait for upstream NAPI, (2) wrap the CLI as a subprocess, (3) build via WASM-in-Node. Each is a substantively different architecture from "import + call." |
| **AgentFramework** | Entire rvagent-* family has no published Node bindings. The framework is Rust-native; binding-out is v0.2 work. |

---

## Three paths for M6

### Path A — Single-archetype slice, prebuilt only *(recommended for v0.1)*

Scope: GraphReasoner only. Use `@ruvector/graph-node@2.0.3`. No Rust toolchain.

Deliverables:
- `packages/sdk/src/backends/native-graph.ts` — adapter wrapping `GraphDatabase`
- Implement `GraphReasoner` methods that map cleanly: `create` (calls `open`), `addNodes`/`addEdges`/`addHyperedges` (call `createNode`/`createEdge`/`createHyperedge` or `batchInsert`), `cypher` (calls `query`), `close`
- M5 type revisions: drop `pageRank` / `communities` from public surface (or mark `Promise<never>` with a deferred-to-v0.2 comment), require `embedding` on Node/Edge/Hyperedge or accept an embedder config in archetype options, rename `Edge.type` → `description`
- Surface additions: `kHopNeighbors`, `searchHyperedges` (these are real upstream features the SDK should expose)
- Reference example: `examples/graph-reasoner-demo/` — load a small graph, run a Cypher query, print results
- Working `node examples/graph-reasoner-demo/run.mjs` end-to-end test
- PRD §5.3 updated with reality-aligned types

Effort: 1 focused session (~3–5 hours).
Risk: low — every dependency probed and confirmed.

### Path B — Three archetypes, source-build the missing bindings

Scope: GraphReasoner + KnowledgeBase + AgentMemory.

Requires building NAPI bindings from source for `ruvector-attention-node` and `ruvector-gnn-node` (which exist as Rust crates but aren't on npm). `napi build --platform --release` from each crate dir.

Effort: probably 2–4 sessions. First-time build of the 196-crate workspace will exercise lots of cargo deps and may surface build errors. Workspace `Cargo.lock` is 323 KB — there's a lot of native dependency to compile.
Risk: high — first cold cargo build of upstream is uncharted territory. Could surface compile errors, missing system deps, or feature-flag combinatorics that aren't documented.

### Path C — Different SDK architecture entirely

Scope: SDK fronts the HTTP backend (`@ruvector/sdk` with `kind: 'http'`) instead of native. Server runs as a separate process. The HTTP API is what `ruvector-server` exposes — could be richer than the patched-together NAPI bindings.

Effort: requires building / running `ruvector-server` (Rust binary). Adds operational overhead (a server process). But cleanly isolates archetype implementation from the cargo-build problem.
Risk: medium — depends on `ruvector-server` API surface and whether upstream ships it as a binary.

---

## My recommendation

**Path A.** Concrete reasons:

1. **Validated dependency.** `@ruvector/graph-node@2.0.3` installs and loads on this machine with one command. Every other path requires building or running additional infrastructure.
2. **GraphReasoner is the strongest archetype** (M4: 11 crates, 1,866 items, all high-confidence) — the implementation feedback feeds the largest archetype-feature mapping back into the PRD.
3. **Forces M5 to confront reality fast.** The 6–8 type revisions surface within hours, not weeks. Every other archetype's M5 types will need similar revisions; better to learn the *kind* of revision needed before scaling.
4. **Defers the cargo-build problem.** Building the upstream Rust workspace is a real piece of work and orthogonal to "is the SDK the right shape." Solve the SDK shape first.

Path B should follow Path A — once the GraphReasoner adapter pattern is settled, repeating it for source-built bindings is a routine extension. Path C makes more sense as a v1 hardening once two or three archetypes are working.

---

## Open questions for the user

These are the decisions that lock the next ship-task's contents:

1. **Path A, B, or C?** (My recommendation: A.)
2. **Type revisions to M5: do them in M6's commit, or as a separate v0.2 PRD update first?** Doing them inline keeps the diff focused; doing them first locks the shape before implementation. I lean inline — the implementation IS the validation.
3. **Reference example domain?** A small social graph (people / docs / topics) would demonstrate Cypher cleanly. Or a code-call-graph for self-reference. Or a Wikipedia-style entity graph. Pick what'll be most useful for adopters to read.
4. **`pageRank()` / `communities()`: drop from M5 surface, or mark deferred?** Dropping is honest about reality; marking deferred preserves the archetype's "feature ceiling" story. I lean deferred (with a `@deprecated until v0.2` JSDoc) since users *will* ask for them.
5. **`ruvllm` LocalLLM strategy: wait, subprocess CLI, or WASM-in-Node?** This needs a separate scoping pass, not an M6 v0.1 decision.

---

## Update — M6 v0.1 outcome (2026-04-26)

Path A executed end-to-end. GraphReasoner wired to `@ruvector/graph-node@2.0.3` via `packages/sdk/src/backends/native-graph.ts`. Working demo at `packages/sdk/examples/graph-reasoner-demo/run.mjs`. M5 type revisions landed inline (embedding required, `description` not `type`, `pageRank`/`communities` deferred-throw, added `kHopNeighbors` / `searchHyperedges` / `stats` / `subscribe`).

**Critical finding scoping did NOT predict.** `@ruvector/graph-node@2.0.3`'s `query()` and `querySync()` are stubs — they always return empty `nodes`/`edges` regardless of the Cypher input. Confirmed with `MATCH (n) RETURN n`, label-typed matches, and pattern matches. Inserts persist correctly (confirmed via `stats()` and `kHopNeighbors`); only Cypher query execution is non-functional.

The SDK reflects this honestly:
- `cypher()` still callable — logs a one-time warning per archetype instance and returns the (empty) upstream result.
- `getValueReport` lists `cypher` under `dormant` with the full reason.
- `introspect()` marks the cypher capability `active: false`.

**Generalization for M7+ readiness gate.** Scoping treated "binding loads + exports method" as readiness. That was insufficient. Going forward, the readiness gate is "binding loads AND a known input produces a correct output." Each archetype's adapter needs a smoke check that proves its core operations actually work, not just that the methods exist.

## Update — M6.1 outcome (smoke-check infrastructure)

The readiness-gate generalization is now infrastructure, not just a recommendation:

- `packages/sdk/src/core/health.ts` — `CheckStatus` (`ok` | `broken` | `unsupported` | `error`), `CheckResult`, `HealthCheckResult`, `runCheck`, `summarize` helpers, and `HealthCheckProvider` interface.
- `packages/sdk/src/backends/native-graph.ts` — `NativeGraphBackend.smokeCheck()` runs 6 probes against an isolated `new GraphDatabase()` (no user data touched): insertNode, insertEdge, stats, kHopNeighbors, hyperedgeSearch, cypher.
- `packages/sdk/src/archetypes/GraphReasoner.ts` — `healthCheck()` exposes the result with archetype + backend context.
- `packages/sdk/examples/graph-reasoner-demo/run.mjs` — calls `healthCheck()` before any user-facing operation, surfacing the live state of the binding.

Live result (commit at HEAD):
```
GraphReasoner/native: 5 ok, 1 broken (1.09ms)
  ✓ insertNode      ok       1 node inserted, id round-tripped
  ✓ insertEdge      ok
  ✓ stats           ok       2 nodes, 1 edges
  ✓ kHopNeighbors   ok       2 reachable from probe-a
  ✓ hyperedgeSearch ok       2 hits, top score 2.51e-11
  ✗ cypher          broken   MATCH (n) RETURN n returned 0 nodes despite stats showing 2.
```

Key property: the cypher diagnostic is **observed, not declared**. When upstream fixes the stub binding, the next `healthCheck()` run reports `ok` with no SDK code change. Hand-written dormant lists rot; observed checks don't.

v0.2 work item: wire `getValueReport()` to consult cached `healthCheck()` results so dormant detection is dynamic, not hardcoded.

## Update — M12.5 (probe-diagnostic loop closed)

`packages/sdk/src/backends/native-ruvllm.ts` updated: the `queryConfidenceBounded` and `routeDecisionShape` detail strings (and the M12.1 comment block above them) now reference `upstream-issues/06` and name the JS-wrapper case-rename mismatch — replacing M12.1's wrong "native struct under-populated" attribution. Diagnostic-only change; same probe assertion logic, same `broken` status, same enumerated missing fields. Closes the explicit "will be updated in a follow-up" loop named in the M12.4 entry below and in Issue #06's "Detection by an integrating SDK" section.

The four other demos (graph-reasoner, knowledge-base, time-series-memory, auto-embed) showed only M8.2 nondeterminism in the M8.2-protocol diff — confirming this was indeed a scope-tight diagnostic-only change.

## Update — M12.4 (Issue #06 authored; M12.1's root-cause theory was wrong)

`docs/upstream-issues/06-query-route-under-populated-fields.md` filed. Lifted from #05's "Related findings" section and expanded — but during the lift, **a fresh probe of the native-layer binding overturned M12.1's first-pass theory**. M12.1 attributed the missing-field defect to "native struct under-populated"; the actual root cause is the JS-layer wrapper renaming snake_case to camelCase that the native binding already provides.

Concretely:

- `@ruvector/ruvllm-darwin-arm64`'s `RuvLlmEngine.query()` returns `{text, confidence, model, contextSize, latencyMs, requestId}` — all 6 fields populated, all camelCase.
- `@ruvector/ruvllm`'s JS wrapper does `contextSize: result.context_size` — looks up snake_case, gets `undefined`.

The fix is one-line per method: drop the rename layer (`return result;`) since the native return shape already matches the documented contract.

**Lesson for the SDK's diagnostic infrastructure**: a probe that says "missing fields" is honest but stops one layer short of the root cause. The SDK's `queryConfidenceBounded` / `routeDecisionShape` probes call out *which* fields are undefined; what they don't tell you is whether the gap lives in the native binding, the JS wrapper, or somewhere between. M12.4 spent ~5 minutes probing both layers to pin it precisely. That kind of layer-by-layer probe is the same thing the M11.3+v0.2 reprobe tool codifies for npm/CLI surfaces — there's a parallel v0.3 work-item here for "binding-layer probe" that asserts each layer's contract independently. Logged but not built; the pattern is rare enough that one-time manual probing is fine for now.

**Issue #05's "Related findings" section** corrected with a pointer at #06 and the fixed root-cause attribution. Updates traceable: `git blame` on #05 shows the original (wrong) attribution dates 2026-04-27 (M12.1); the correction (also 2026-04-27) carries the M12.4 reference.

`docs/upstream-issues/README.md` updated with the #06 entry. Three Phase 2 issues now point at the same JS-layer file (`@ruvector/ruvllm/dist/cjs/engine.js`): #02 (broken ESM build), #05 (no model_path config), #06 (rename-layer drops fields). One coordinated upstream pass could close all three.

## Update — M11.3 v0.2 (CLI surface-contract probing; codifies the M12.2 lesson)

`tools/reprobe-bindings/reprobe.mjs` extended with a `CLI_PROBES` table. For each tracked binary, the script spawns `<bin> --help` and regex-tests two sets of expectations:

- **`expectAbsent`**: substrings/regex that should NOT appear. Drift if any does — typically signals upstream shipped a load-bearing feature the SDK has been waiting on (e.g., `ruvllm --model` flag → reconsider Phase 2B deferral).
- **`expectPresent`**: substrings/regex that SHOULD appear. Drift if missing — contract regression on a surface the SDK already uses.

Initial entry: `ruvllm` with 4 absent (`--model`, `serve`, `load-model`, `--gguf`) + 6 present (`query`, `generate`, `route`, `models`, `embed`, `similarity`). Live result: 0 drift; the M12.2 deferral is still consistent with what's published.

**Both drift paths verified by inversion**: flipping `query` from `expectPresent` to `expectAbsent` produced `absent-appeared: /\bquery\b/` with action message "Upstream shipped a feature the SDK was waiting on — re-evaluate the deferred milestone"; adding a fake `nonexistent-subcommand-for-drift-test` to `expectPresent` produced `present-missing: ...` with action message "Contract regression — SDK code that depended on this surface needs review." Same exit-1 behavior on either drift kind. Restored after.

**Three lessons now codified into one tool**:

| Lesson | Source | Codification |
|---|---|---|
| Re-probe npm publication status before trusting earlier scoping | M11 → M11.3 | `PROBES` table + `npm view` per entry |
| Re-probe binding internals (TypeScript declarations) before trusting advertised behavior | M12.1 | Read `dist/cjs/native.js` source map directly during scoping (not yet automated) |
| Re-probe CLI `--help` surface before trusting advertised CLI flags | M12.2 → M11.3 v0.2 | `CLI_PROBES` table + `<bin> --help` regex per entry |

The middle row is the only one not in `reprobe.mjs`. Reading TypeScript declarations programmatically is harder (would need `@ruvector/ruvllm/dist/...` introspection past the package-exports gate; M12 found that gate is closed). Logged as a v0.3 work-item; lower priority than CLI probing because M12.1 already settled the relevant claims for now.

**Output format**: two tables (NPM + CLI), single combined drift block at the bottom in paste-ready Markdown. Exit code 1 if either dimension drifts; exit 0 only when both are clean. CI-gateable as a single check.

**Cadence recommendation unchanged**: re-run at every milestone close, OR any time scoping touches an `upstream-binding` / `upstream-bug` classification, OR any time scoping cites a CLI flag/subcommand from earlier docs.

## Update — M12.2 deferral (CLI shares NAPI's model-loading defect; my M11/M12 claim about ruvllm CLI was wrong)

Live re-probing of `node_modules/.bin/ruvllm --help` and `node_modules/@ruvector/ruvllm/bin/cli.js` overturns the claims that grounded M12.2 (Phase 2B CLI subprocess transport). **Both M11 scoping and M12 scoping cited a `--model` flag and a `serve` subcommand that do not exist in the actually-installed `@ruvector/ruvllm@2.5.4` CLI.** The CLI source constructs `new RuvLLM()` (line 229) or `new RuvLLM({ embeddingDim: 768, learningEnabled: false })` (line 877) with no model path; it shares the same broken-default-model defect as the in-process NAPI path probed in M12.1.

Live evidence: `ruvllm generate "Once upon a time" --max-tokens 10` produces `XboutuponthenronDbout##erin|inPup0|D0...` — same letter-noise as `LocalLLM.generate(...)` over NAPI. The CLI's own emitted warning ("Built-in SIMD inference is experimental. For production use, configure an external LLM provider") is the closest upstream comes to acknowledging this — but the warning is non-specific about scope; it applies to NAPI too.

**M12.2 is deferred indefinitely.** Shipping a `CliRuvllmBackend` would proxy `generate`/`query`/`route` to a subprocess that produces the same gibberish — extra subprocess overhead, zero quality benefit. The M12 scoping doc is updated with a CORRECTION callout under §3.2 Transport 2 and a DEFERRED status under §4 Phase 2B. The original (incorrect) analysis is preserved in the doc as historical record of what assumptions broke and why.

**M11.3 lesson generalizes — re-probe should cover CLI surface contracts, not just npm publication status.** The current `tools/reprobe-bindings/reprobe.mjs` confirms a package is *published*; it doesn't confirm the package's *advertised features* are real. The same kind of drift that hit "ruvllm has no NAPI binding" (M11) hit "ruvllm CLI accepts `--model`" (M12.2). A v2 reprobe could spawn `<bin> --help` for each tracked CLI binary and grep for advertised flags / subcommands — small extension. Logged as M11.3 v0.2 work-item.

**Issue #05 updated** at `docs/upstream-issues/05-no-model-loading-api.md` with a "Second affected transport: the bundled CLI" section. Shows both transports manifest the same root cause; gives upstream a single fix that unblocks both. The CLI source line references (`bin/cli.js:229,877`) are included so an upstream maintainer can verify the lack of model-loading in seconds.

**Three lessons compounding across M11/M12**:

1. M11 scoping: trust live probes over earlier docs. ✓ Codified as M11.3 (`reprobe.mjs`).
2. M12 scoping: trust live binding-internals (TypeScript declarations) over advertised behavior. ✓ Codified by reading `node_modules/@ruvector/ruvllm/dist/cjs/native.js` source map directly in M12.1.
3. M12.2 deferral: trust live CLI-help output over advertised CLI surface. **Not yet codified in tooling.** Worth adding as `reprobe.mjs` v0.2 — extend the script to optionally probe `<bin> --help` and check for advertised flag presence.

**Project state unchanged from M12.1**: 17 active capabilities, 24 dormant (14 upstream-binding, 4 upstream-bug, 3 sdk-integration, 3 design-deferred). The ratified Phase 2 → Phase 2A-only path means LocalLLM's row stays at 3 active / 9 dormant; the only difference from M12.1 is that M12.2 is now off the roadmap (vs deferred-but-planned).

**Next-task options for the user to ratify**: (1) Issue #06 standalone (the QueryResponse/RoutingDecision under-populated-struct defect; reproducer already in #05's "Related findings"; ~scoping-doc-sized); (2) AgentMemory archetype scoping (deferred since M11; the SDK has 4 working archetypes and 2 placeholder M5-typed-only archetypes still); (3) `reprobe.mjs` v0.2 — add CLI-help probing per the M12.2 lesson; (4) other.

## Update — M12.1 outcome (LocalLLM Phase 2A — generate/query/route honest over NAPI)

`LocalLLM.generate` / `query` / `route` now wired through `NativeRuvllmBackend`. M5 surface preserved: `generate` returns `GenerateResult` (binding's plain-string output wrapped with character-heuristic tokenIn/tokenOut and an explain trace); `query` returns `QueryResult`; `route` returns `RoutingDecision` (both new types, exported from `@ruvector/sdk`). `streaming` remains design-deferred (upstream `StreamingGenerator` chunks the full response — not real token-by-token).

**The classification flip works as designed.** The new tier-1 binding probe `generateNonGibberish` observes the default model's gibberish output and reports `broken` with a diagnostic naming the failure mode (alnum/ws ratio, whitespace ratio, longest non-whitespace run). The reducer flips `generate`'s catalog row from declared-`design-deferred` to observed-`upstream-bug`. When upstream exposes a `model_path` config (Issue #05), the same probe will flip back to `ok` with no SDK code change.

**`generateNonGibberish` v1 false-positived; v2 has 3 conjunctive assertions.** First-pass version asserted only "≥ 80% alphanumeric or whitespace" — passed on real gibberish (`hadeachq.}that{*then...`, 82% alphanumeric because letter-noise IS alphanumeric). Live smoke caught it. v2 adds two more assertions: `ws ≥ 8%` (real English ≥ 12-18%; gibberish observed at 0%) and `longest non-whitespace run ≤ 25 chars` (longest English word ≈ 20; gibberish observed at 46-354 chars). All three must pass; diagnostic names which one failed. Pattern: when a probe's failure mode is calibrated to one observed example, conjunctive checks across orthogonal properties catch the failure mode generally, not just the one example.

**Symmetric 3/3/3/3 dormant breakdown — first time all 4 blocker categories are populated**:

| Archetype | Active | Dormant | upstream-binding | upstream-bug | sdk-integration | design-deferred |
|---|--:|--:|--:|--:|--:|--:|
| LocalLLM | 3 | 9 | 3 | 3 | 0 | 3 |
| GraphReasoner | 3 | 6 | 4 | 1 | 1 | 0 |
| KnowledgeBase | 6 | 4 | 3 | 0 | 1 | 0 |
| TimeSeriesMemory | 5 | 5 | 4 | 0 | 1 | 0 |
| **Total** | **17** | **24** | **14** | **4** | **3** | **3** |

`upstream-bug` rises 1 → 4 (cypher + generate + query + route). All four are probe-observed and self-correcting; if upstream fixes any one, its catalog row flips to active automatically.

**Secondary upstream defect found in passing**. While verifying #05's reproducer, the same probe pass surfaced a separate defect: `RuvLLM.query()` claims to return 6 fields but the underlying native struct only populates 3 (`text`, `confidence`, `model`); the JS-layer wrapper passes through `undefined` for `contextSize`, `latencyMs`, `requestId`. Same defect on `route()` for `contextSize` and `topP`. Documented as "Related findings" in `docs/upstream-issues/05-no-model-loading-api.md`; recommend filing as a standalone Issue #06 once #05 lands.

**Authored upstream issue #05** at `docs/upstream-issues/05-no-model-loading-api.md` — paste-ready following the M10.2 pattern. Includes:
- Live runtime reproducer.
- Type-level evidence pulled from the published package's TypeScript declarations (the `NativeConfig` schema and `NativeEngine` interface, verbatim, with no model-loading methods).
- Three suggested fix shapes (config field, instance method, auto-discovery convention).
- "Detection by an integrating SDK" section quoting the SDK's probe output verbatim.

`docs/upstream-issues/README.md` updated with the new entry; M6→M10 reference bumped to M6→M12.

**v0.2 work-items still open**:
- Token counts in `GenerateResult` are character heuristics (`Math.ceil(chars / 4)`). Real counts when upstream exposes a tokenizer or when the CLI subprocess transport (M12.2 / Phase 2B) reports them.
- The `generateNonGibberish` heuristic is calibrated to letter-noise patterns. If upstream's failure mode shifts (zeros, perfectly-lengthed garbage), a vocabulary-overlap check against a tiny English wordlist would be a stronger probe. Defer until needed.
- Phase 2B (CLI subprocess transport) is the next-largest remaining LocalLLM work; once it lands, `KnowledgeBase.ask()` can be wired (citations + LLM synthesis), which is the ratified Phase 2 KB coupling per M12 scoping §6 Q2.

## Update — M12 scoping (LocalLLM Phase 2; M11's plan needs revision)

`docs/plans/m12-scope.md` is the LocalLLM Phase 2 scoping report. Headline finding overturning M11:

**`@ruvector/ruvllm`'s NAPI binding has no `model_path` config field.** Probed live via the installed package's TypeScript source: both `RuvLLMConfig` (JS-layer) and `NativeConfig` (NAPI-layer) lack any model-path / model-loading equivalent. M11's plan to ship `LocalLLM.create({ model: path })` over the NAPI transport is **not viable** as written — the field would be silently ignored (verified by passing `{ model_path: '/tmp/nonexistent.gguf' }` to `new RuvLlmEngine(...)` — accepted without throwing, no effect).

**Two model-loading paths are real, neither via NAPI**:
- CLI subprocess (`@ruvector/ruvllm-cli@0.1.1`, documented `--model` flag).
- WASM (`@ruvector/ruvllm-wasm@2.0.2`, not re-probed live in this pass).

**Live behavior confirms M11 scoping's "gibberish without model" observation**: `generate('Once upon a time', { maxTokens: 8 })` returns a plain `string` (not the M5 `GenerateResult`), value `"q8&other_N6q or&_qxsaid+<~xof88toabout5of"`. `query()` returns rich shape with same gibberish text.

**Recommended Phase 2 split**:
- **Phase 2A (NAPI honesty pass)**: wrap `query`/`route`/`generate` over the existing NAPI backend. Surface as `[upstream-bug] generate` with a tier-3 `generate-non-gibberish` probe that auto-flips to active when upstream wires real weights. Same M6.2 self-correcting pattern as the Cypher stub.
- **Phase 2B (CLI subprocess transport)**: ship a `cli` backend variant; the only path that actually loads a GGUF today.
- **Phase 2C (WASM)**: deferred until 2A+2B settle and a browser use-case demands it.

**Reused the M11.3 re-probe tool successfully**: `tools/reprobe-bindings/reprobe.mjs` ran clean (0 drift, 13 packages) before any of the deeper investigation. Re-probe-before-trust is now operationally part of the scoping pattern, not just a recommendation.

**5 open questions for the user** in m12-scope.md §6 — they lock the Phase 2A vs 2B split, KB.ask coupling decision, model-strategy choice (auto-download vs explicit path), upstream Issue #05 framing, and the LocalLLM.feedback shared-SONA question.

**`design-deferred` should drop from 4 to ~1 in Phase 2A**: `generate` and `streaming` flip dormant→broken-but-classified (probe observation), `feedback` flips dormant→sdk-integration when wired, `localMemory` stays deferred pending AgentMemory archetype scope decision.

## Update — M11.3 outcome (periodic re-probe; classification drift detector)

`tools/reprobe-bindings/reprobe.mjs` ships. Maintained list of 13 upstream npm packages whose publication status the SDK's `upstream-binding`-classified dormant entries depend on; runs `npm view <pkg> version` for each in parallel; reports drift vs the most recent ratified scoping (this doc + `m11-scope.md`). Exits 0 on no drift, 1 on drift detected — CI-gate-able.

**Live result (2026-04-27)**: 0 drift. All 10 dormant packages remain unpublished; all 3 positive controls (`@ruvector/ruvllm`, `@ruvector/graph-node`, `@ruvector/sona`) confirm registry reachability and report current versions (2.5.4 / 2.0.3 / 0.1.6).

**Drift-detection path verified by inverting `@ruvector/ruvllm`'s expected status during testing**: the script produced the exact ⚠ flag and paste-ready Markdown block this entry would otherwise need to author by hand. The kind of artifact M11 scoping had to write longhand can now be regenerated in seconds.

**Why a maintained list rather than runtime SDK introspection**: I considered driving the PROBES list from the archetypes' `getValueReport()` output, filtering dormant entries with `blocker === 'upstream-binding'`, and mapping source crates to npm packages via a lookup table. Rejected as overengineering for a ~60-LOC tool — runtime introspection would need the core NAPI binding present, triple the LOC, and still require a manually-maintained source-crate→npm-package map. The current design names the maintenance protocol explicitly in the script's header: re-run after every milestone, ratify any flips into this doc, edit the PROBES table.

**Cadence recommendation**: re-run at every milestone close, AND any time scoping touches dormant `upstream-binding` classification. The cost is ~3 seconds wall-clock; the cost of skipping it has historical precedent (4 milestones of misclassification on `@ruvector/ruvllm`).

**Generalizes the M6.2 self-correcting-classification pattern at the publication-status layer**. M6.2 made the in-process probe observation override the static catalog ("when upstream fixes Cypher, the next healthCheck() flips it to active"). M11.3 does the same at the npm-registry layer ("when upstream publishes a binding we said wasn't on npm, the next reprobe.mjs run flags it"). Both are observation-over-declaration, just at different layers.

**v0.2 work-items**:
- A `--include-pre-release` flag to also probe `@ruvector/<pkg>@beta` / `@next` tags. Right now the script reports the latest stable version only.
- Add the script to a CI job (when CI exists; M9 PRD §7 listed CI as an open question).
- If M11 open question #5 (Issue #02 scope expansion to add `@ruvector/ruvllm`) lands as a published-fix, the SDK's umbrella-load fallback for ruvllm could be removed; reprobe would then naturally surface that opportunity.

## Update — M11.2 outcome (cross-archetype embed propagation)

`LocalLLM.embed()` now propagates across `KnowledgeBase`, `TimeSeriesMemory`, and `GraphReasoner` via an optional `embedder: LocalLLM` constructor parameter. When wired, the archetypes derive missing embeddings from text:

- **KB**: `Document.embedding` becomes optional; `retrieve()` accepts `string` or `Float32Array`.
- **TSM**: `TimeSeriesPoint.value: string` finally works at runtime (the M5 type union is now load-bearing); `query(string, ...)` works the same way.
- **GR**: `Node.embedding`, `Edge.embedding`, `Hyperedge.embedding` become optional; nodes get `text?: string` (falls back to `id`); edges/hyperedges embed their `description`.

The pre-computed `Float32Array` fast path is preserved; passing a vector bypasses the embedder. Dimension validation at create-time catches mismatches early with `EMBEDDER_DIM_MISMATCH`.

**Tier-3 probes per archetype** assert real semantic ranking, not just plumbing:

- `KB._autoEmbedProbe` ingests "apple pie cinnamon dessert recipe" + "corporate income tax filing requirements", retrieves "fruit baked sweet", asserts apple-pie outranks tax-filing **among the probe's own ids**. Robust to Finding B shared-state pollution because the assertion is on relative rank, not absolute #1.
- `TSM._autoEmbedProbe` appends three string-only points (two cooking, one tax), queries "fruit baked sweet", asserts the top window-filtered point is a cooking point.
- `GR._autoEmbedProbe` addBatch with text-only nodes/edges, asserts kHop traversal succeeds. (No semantic ranking assertion because GR's kHop is structural; embedding values don't affect reachability — that lives in KB/TSM probes.)

**Project-wide value-report breakdown** (5 demos × 5 archetypes; first row uses the standalone demos with no embedder wired):

| Archetype | Active | Dormant | upstream-binding | upstream-bug | sdk-integration | design-deferred |
|---|--:|--:|--:|--:|--:|--:|
| GraphReasoner | 3 | 6 | 4 | 1 (cypher) | 1 (autoEmbed) | 0 |
| KnowledgeBase | 6 | 4 | 3 | 0 | 1 (autoEmbed) | 0 |
| TimeSeriesMemory | 5 | 5 | 4 | 0 | 1 (autoEmbed) | 0 |
| LocalLLM | 3 | 7 | 3 | 0 | 0 | 4 |
| **Total** | **17** | **22** | **14** | **1** | **3** | **4** |

`sdk-integration` rises from 0 (M11.1) to 3 (M11.2) — three new "the SDK can ship this with currently-available bindings" entries appear, one per cross-archetype-eligible archetype. The `examples/auto-embed-demo/run.mjs` shows all three flipping to **active** when one shared `LocalLLM` is wired across them: first time three dormant capabilities flip simultaneously via a single user-side wire-up.

**Subtle reducer fix in `core/capability-catalog.ts`**. The blocker-derivation logic previously forced `upstream-binding` whenever a probe returned `unsupported`. That was correct for binding-tier probes ("method not exposed in NAPI") but wrong for archetype-tier probes signaling "user didn't opt in" (M11.2 autoEmbed). Now: catalog `defaultDormantBlocker` wins for `unsupported`. Side effect (a positive one): existing `sona` and `graphRag` dormant entries when not configured are now correctly labeled `[sdk-integration]` instead of `[upstream-binding]` — they were misclassified since M9.1.

**Backend type-tightening as a load-bearing invariant**. `native-graph.ts` now uses `ResolvedNode`/`ResolvedEdge`/`ResolvedHyperedge` types (`Omit<Node, 'embedding'> & { embedding: Float32Array }`) at the backend boundary. The archetype layer's `_resolveNodes`/`_resolveEdges`/`_resolveHyperedges` are the only callers; TypeScript catches any path that bypasses resolution. The resolved type stays internal to the backend module — public types preserve the optional-embedding ergonomics.

**Edge cases verified**: 7 error paths fire with actionable codes — 3× `EMBEDDER_DIM_MISMATCH` (KB/TSM/GR), 2× `MISSING_EMBEDDING` (KB ingest / GR addNodes), 1× `EMBEDDER_NOT_CONFIGURED` (KB retrieve(string) without embedder), 1× `NOT_IMPLEMENTED_M5` (TSM string-without-embedder, preserving v0.1 behavior).

**v0.2 work-items still open** for M11.x:
- `LocalLLM.embed(string[])` dispatches per-string internally because of the M11.1 binding-rejection finding. If upstream fixes the array-input case, archetype `_resolve*` helpers should batch instead of looping.
- Auto-derive helpers across the three archetypes (`_resolveDocEmbeddings` / `coerceValue` / `_resolveNodes`) are similar enough to extract — but each shape differs (Document vs TimeSeriesPoint vs Node/Edge/Hyperedge), and three archetypes is the same threshold M8.2 used for the reducer extraction. Defer until a fourth archetype lands or the shapes converge.
- The auto-embed probe assertions are conservative (relative rank among probe ids). A stronger assertion could check absolute semantic gap (cosine difference > some delta) once tier-3 latency budgets allow.
- `LocalLLM` Phase 2 (`generate` + model loading) remains the next-largest LocalLLM work; M11.2 lays the cross-archetype groundwork without forcing it.

## Update — M11.1 outcome (LocalLLM Phase 1: embed + similarity active)

Fourth archetype shipped with a real backend. Wiring `@ruvector/ruvllm` via `NativeRuvllmBackend`. Phase 1 surfaces `embed` and `similarity` only; `generate`/`stream` throw `NotImplementedError` until Phase 2 wires a real model file.

3-probe tier-3 health check passes:
- `embedDeterministic ok dim=768, identical across calls`
- `embedUnitNorm ok norm = 1.0000 (unit-normalized)`
- `similarityMonotonic ok sim(cat,dog)=0.9998 > sim(cat,banana)=0.9821`

The `similarityMonotonic` assertion is exactly what M11 scoping anticipated — a strong-signal pair (cat/dog vs cat/banana) reliably distinguishes a working semantic-similarity binding from a stub.

**Project-wide value-report breakdown across the 4 working archetypes**:

| Archetype | Active | Dormant | upstream-binding | upstream-bug | sdk-integration | design-deferred |
|---|--:|--:|--:|--:|--:|--:|
| GraphReasoner | 3 | 5 | 4 | 1 (cypher) | 0 | 0 |
| KnowledgeBase | 6 | 3 | 3 | 0 | 0 | 0 |
| TimeSeriesMemory | 5 | 4 | 4 | 0 | 0 | 0 |
| LocalLLM | 3 | 7 | 3 | 0 | 0 | 4 |
| **Total** | **17** | **19** | **14** | **1** | **0** | **4** |

**`design-deferred` is non-zero for the first time**. 4 entries in LocalLLM (generate, streaming, feedback, localMemory). M9.1 reserved this category for "intentional Phase-N deferrals"; LocalLLM is the first archetype to actually use it. The classification is now operating in 3 of its 4 modes.

**`sdk-integration` remains 0**. Every dormant capability across all 4 archetypes is either gated on someone else (15) or deliberately Phase 2 (4).

**Three real bugs found in this milestone**, each by running:
1. Cross-realm `instanceof Float32Array` fails when the typed array comes from a different module realm — fixed with a duck-type `asFloat32Array` helper in `native-ruvllm.ts`.
2. The umbrella's `RuvLLM.embed()` returns a plain `number[]`, not a Float32Array. Its TypeScript type says Float32Array. Real upstream contract violation; minor candidate to add to Issue #02.
3. The binding rejects `embed(string[])` despite the JS class declaring batch support — `StringExpected` error. SDK now dispatches per-string in `embedBatch`.

**Cross-archetype propagation deferred to M11.2**. With `llm.embed()` working, KB / TSM / GR could drop their "user supplies pre-computed embeddings" caveats. That's the largest single ergonomic upgrade still available — but it's a *cross-archetype coordination* task best done after Phase 1 has settled.

## Update — M11 scoping (LocalLLM; my M6 claim about ruvllm was wrong)

`docs/plans/m11-scope.md` is the LocalLLM scoping report. The headline correction:

**M6 v0.1's scoping said `ruvllm has no NAPI binding in the repo or on npm`. That was incorrect.** Re-probed during M11 scoping: `@ruvector/ruvllm@2.5.4` + `@ruvector/ruvllm-darwin-arm64@2.0.1` are published, the binary is 838 KB of real Rust, and the umbrella's `RuvLLM` class loads via CJS with 14 working methods.

What works out-of-the-box on the NAPI path:
- `embed("hello world")` → real 768-dim Float32Array
- `similarity("apple pie", "fruit dessert")` → 0.987

What needs a model file (default-construct produces gibberish, same Cypher-stub failure mode):
- `generate(...)`, `query(...)`, `route(...)`

Re-probed *other* unpublished bindings during the same session — `attention-node`, `gnn-node`, `diskann-node`, `solver-node`, `sparsifier-node`, `mincut-gated-transformer-node` — all confirmed still unpublished. So only the ruvllm claim was outdated; M9.1's dormant classification of the others remains accurate.

**Process lesson**: I should have re-probed before committing M9.1's classification. A periodic re-probe script (`npm view <pkg> version` for every dormant `upstream-binding` entry, ~30 LOC) would catch this kind of slip earlier. **Recommendation tracked as M11 open question #4.**

**Issue #02 should be updated** to add `@ruvector/ruvllm@2.5.4` as the third broken-umbrella sample (its ESM build fails with the same `Cannot find module 'dist/esm/...'` defect as `ruvector` and `@ruvector/sona`). Three samples confirms a publishing-pipeline pattern, not three independent oversights.

## Update — M10.2 outcome (upstream issues authored)

With `sdk-integration` empty, the next-highest-leverage move was externalizing what the SDK's diagnostic infrastructure had already discovered. Four paste-ready upstream bug reports authored in `docs/upstream-issues/`:

1. `01-graph-node-cypher-stub.md` — `@ruvector/graph-node@2.0.3`'s `query()` returns empty for any input.
2. `02-broken-umbrella-packages.md` — `ruvector@0.2.23` and `@ruvector/sona@0.1.6` publish without their `main`-referenced files.
3. `03-core-vectordb-construction-quirks.md` — `@ruvector/core` VectorDb shared state, dimension singleton, and default-storage-to-disk.
4. `04-sona-microlora-warmup.md` — `applyMicroLora` returns a **zero vector** before any training (sharper than M10's "perturbs non-trivially" framing — the reproducer-while-writing produced verbatim `cos = 0.0000`).

Each report's "Detection by an integrating SDK" section is verbatim from the SDK's `getValueReport().dormant[i].reason` strings — the smoke-check + value-report infrastructure built across M6.1/M6.2/M8.1 doubles as bug-report-evidence infrastructure with zero rewriting cost.

Filing: I authored markdown but did not file the GitHub issues. User can paste each report's body into https://github.com/ruvnet/ruvector/issues. The README in `docs/upstream-issues/` explains the procedure.

If upstream addresses Issues #1, #2, or #4, the SDK's value reports should observe the change and reclassify the affected dormant entries automatically:
- Cypher fix: `cypher` probe flips `broken → ok`; capability moves to active in GraphReasoner.
- Umbrella fix: SDK can simplify its binding-resolution code; no value-report change but cleaner integration.
- SONA `applyMicroLora` fix: KB demo's `score=1.00e+0` collapse goes away; tier-3 sona probe could add a stronger assertion (`cos(x, applyMicroLora(x)) > 0.95 before training`).

The drift report (`m6-scope.md` itself) and the upstream-issue reports are now the SDK's two channels for surfacing what it found: `m6-scope.md` for the SDK's own roadmap; `docs/upstream-issues/` for upstream's.

## Update — M10.1 outcome (changepoint baseline; project `sdk-integration` count now 0)

The last `sdk-integration` dormant capability flips to active. `TimeSeriesMemory.detectChangepoints()` and `query({ changepoints: true })` now run a real sliding-window mean-shift detector instead of throwing `NotImplementedError`. **Project-wide `sdk-integration` count: 1 → 0.**

Algorithm (M10.1 baseline):
- Maintain SDK-side ring buffer of the last N appended points (default 1000; configurable via `maxRecentForChangepoints`).
- For each interior position `t` (with at least `_cpWindow=5` points on each side), compute `||leftMean - rightMean||` over the surrounding windows.
- Adaptive threshold = `max(2 × median(deltas), 1e-6)`. Flag points exceeding threshold.
- Confidence = `(delta - threshold) / (max - threshold)` clamped to `[0, 1]` (in-run-relative, not absolute).

Demo verification (anomaly at minutes 12-16 in a 30-sample stream): detector returned 5 changepoints clustered at the boundaries. Top confidence 1.00 at minute 17 (falling edge); secondary 0.50 at minute 12 (rising edge). Mathematically correct — sliding-window mean shift detects boundaries, not anomaly interiors.

Tier-3 probe: inserts 10 baseline + 10 anomaly points (clear step), runs detector, asserts a changepoint is found within ±1 second of the known step. Probe result: `5 cp(s); closest at ±0s, confidence=1.00`.

**Project-wide value-report breakdown (across the three working archetypes):**

| Archetype | Active | Dormant | upstream-binding | upstream-bug | sdk-integration |
|---|--:|--:|--:|--:|--:|
| GraphReasoner | 3 | 5 | 4 | 1 (cypher) | 0 |
| KnowledgeBase | 6 | 3 | 3 | 0 | 0 |
| TimeSeriesMemory | 5 | 4 | 4 | 0 | 0 |
| **Total** | **14** | **12** | **11** | **1** | **0** |

The `sdk-integration` queue went from 2 (graphRag + sona) at M9.1 → 1 (sona) at M9 v0.1 → 1 (changepointDetection) at M10 v0.1 → **0** at M10.1. The remaining 12 dormant entries are all gated on someone else: upstream NAPI publishing (11) or an upstream Cypher-engine fix (1). The SDK has fulfilled every dormant capability it could ship from existing primitives.

`changepointDetection.source = '@ruvector/sdk'` is the **first capability where the SDK itself is the source**, not just a wrapper around an upstream binding. Demonstrates the SDK can ship value before upstream is ready.

Limitations declared in v0.1:
- Bounded by ring buffer (default 1000 points). Older history needs delta-* bindings (still upstream-binding dormant). Window queries predating the buffer get a `ringBufferNote` in the explain trace.
- Single-window detector — gradual drifts may not trigger. v0.2 could add CUSUM for slow drifts.
- Adjacent peaks reported separately, not merged. v0.1 user can post-filter.
- Threshold is heuristic (2× median); not calibrated to a false-positive rate.
- Confidence is in-run-relative, not absolute.
- Probe tolerance ±1 second is generous.

## Update — M10 v0.1 outcome (SONA wired; `sdk-integration` queue empty)

The second `sdk-integration` dormant capability flips to active. `KnowledgeBase` now optionally takes `sona: true` (or a config object) at create-time; when wired, `retrieve()` warps the query embedding via `applyMicroLora` and begins a SONA trajectory; `recordFeedback()` ends the trajectory with the reward signal and ticks the engine for learning.

API surface discovered by probing the binding:
- `SonaEngine.withConfig({ hiddenDim })` constructs.
- `beginTrajectory(input: number[])` → numeric trajectoryId.
- `setTrajectoryRoute(tid, routeId: string)` — top-citation docId in our wiring.
- `endTrajectory(tid, reward: number)` — reward in `[-1, 1]`.
- `applyMicroLora(input: number[], strength?: number)` → number[] — the LoRA-warped query.
- `tick()` triggers learning; `getStats()` returns a debug-stringified `CoordinatorStats` we regex-parse.

**Project-wide `sdk-integration` count: 2 → 0.**
- Pre-M10: graphRag (M9 v0.1 flipped it) + sona + changepointDetection. After M9.1's classification edit: graphRag was active; sona and changepointDetection sdk-integration.
- Post-M10: only changepointDetection remains as sdk-integration. (changepointDetection is in TimeSeriesMemory, not KB.)
- Across the three working archetypes' value reports: 11 upstream-binding / 1 upstream-bug / 1 sdk-integration / 0 design-deferred. **The SDK has paid down its own integration debt for KB/GR.**

**Finding D (M10): `@ruvector/sona@0.1.6` is published-but-broken** with the same defect as upstream's `ruvector` umbrella package found in M6: `package.json#main` references files (`index.js`, `index.d.ts`) that aren't in the tarball. The platform package `@ruvector/sona-darwin-arm64` ships a working `.node`, which the SDK loads directly via the env var + auto-resolve fallback pattern proven in M7 for `@ruvector/core`. Two umbrella packages broken the same way is a publishing-pipeline bug worth filing upstream as a unified issue.

**Finding E (M10): `applyMicroLora` at zero-training perturbs the query non-trivially.** The expected behavior — LoRA delta near-zero before any trajectories with feedback have trained — would mean `applyMicroLora(x) ≈ x`. In practice, the demo's top retrieval rank shifted (`auth-spec` → `db-design`) once SONA was wired even with zero feedback. Documented in the demo's narration. v0.2 should add either a "warmup" mode that bypasses LoRA until N trajectories accumulate, OR a stronger probe assertion that `cos(x, applyMicroLora(x)) > 0.95 before training`.

**Tier-3 SONA probe**: 3 binding-tier probes (construct, trajectory, applyLora) rolled up into a single archetype-tier `sona` summary `CheckResult`. The roll-up uses worst-status semantics: any broken/error → broken; any unsupported → unsupported; otherwise ok. Lets the catalog's `sona` capability resolve via a single named probe while the underlying detail is preserved in the binding-tier results.

## Update — M9.1 outcome (two-tier dormant classification)

`DormantCapability` now carries a `blocker: DormantBlocker` field, classifying each dormant entry into one of four categories:

- `upstream-binding` — the upstream binding doesn't expose this surface.
- `upstream-bug` — the binding exposes the surface but observation shows it's broken.
- `sdk-integration` — the SDK could wire this with currently-available bindings but hasn't yet.
- `design-deferred` — intentionally out of scope for the current SDK milestone.

Classification is automatic where possible: `reduceValueReport` derives the blocker from probe status (`broken`/`error` → `upstream-bug`, `unsupported` → `upstream-binding`). When no probe overrides, the catalog entry's `defaultDormantBlocker` is used; default-default is `sdk-integration` (the most actionable category).

The summary string now breaks down dormant by blocker:
```
"5 of 9 unique capabilities active. 4 dormant (3 upstream-binding, 1 sdk-integration) — mixed (5/9 observed)."
```

Each demo's dormant list now shows the blocker prominently:
```
⚠ [upstream-bug     ] cypher                 — [observed via probe 'cypher', status=broken] ...
⚠ [upstream-binding ] sublinearPageRank      — No published NAPI binding for ruvector-solver ...
⚠ [sdk-integration  ] sona                   — @ruvector/sona is published on npm but not wired ...
```

**Project-wide breakdown** (across the three working archetypes):

| Blocker | Count | Examples |
|---|---:|---|
| `upstream-binding` | 11 | sublinearPageRank, leidenCommunities, graphSparsifier, mincutGating, hybridSearch, colbertRerank, matryoshka, mambaAttention, temporalCompression, deltaIndexing, causalLayers |
| `upstream-bug` | 1 | cypher (probe-observed) |
| `sdk-integration` | 2 | sona, changepointDetection |
| `design-deferred` | 0 | (reserved for explicit out-of-scope archetypes — quantum, FPGA, etc.) |

The 11/1/2 split is the SDK's roadmap one paragraph: 2 things we can ship from here without waiting on anyone, 11 things that wait on upstream NAPI publishing, 1 thing that needs an upstream bug fix.

Probe-observation override works the same way it did for the dormant `reason`: the static catalog declares an expected blocker; the probe overrides when present. If upstream fixes Cypher in 2.0.4, the probe reports `ok`, the row moves to active, and the blocker tag becomes irrelevant — same M6.2 dynamism applied at a higher classification layer.

v0.2 polish items: `byBlocker?: Record<DormantBlocker, number>` on `ValueReport` for programmatic access; per-transport blocker resolution when WASM/HTTP backends land; potential split of `upstream-binding` into "binding-missing" vs "method-not-exposed" if editorial value justifies.

## Update — M9 v0.1 outcome (Graph RAG via cross-archetype coordination — first dormant→active flip)

**The first milestone where a capability moves from dormant to active without an upstream binding change.** `graphRag` had been dormant since KnowledgeBase v0.1 (M7) with the dormant reason "KnowledgeBase does not coordinate with @ruvector/graph-node yet." M9 wires that coordination and the capability flips automatically because tier-3 (M8.1) sees the probe pass and the value-report reducer (M8.2) reflects observation over declaration.

How it works:
- `KnowledgeBase` accepts an optional `graphReasoner: GraphReasoner` and `entityExtractor: EntityExtractor` at create-time.
- The default extractor is heuristic: `#hashtags` plus an explicit `metadata.entities: string[]` array. Honest about its limits; users can replace it.
- During `ingest`, the SDK extracts entities from each doc, creates a graph node for the doc + nodes for each entity, and writes `MENTIONS` edges between them. Entity embeddings are deterministic hashes — semantically meaningless, but kHop traversal is structural so it doesn't matter.
- During `retrieve(query, { graphRagHops })`, after vector search returns top-k, the SDK fans out from each doc node by `graphRagHops` and adds reachable docs as `graph-adjacent` citations with bridge-entity attribution.

Schema constraint (caught by the tier-3 probe on first run): `graphRagHops: 1` returns no graph-adjacent docs — the doc-entity graph is bipartite, so reaching a sibling doc through a shared entity takes `2` hops (doc → entity → other-doc). Documented loudly on `RetrieveOptions.graphRagHops`. Probe runs at hops=2.

Live demo result:
```
Plain retrieve (vector-only, k=3):
  vector  auth-spec      score=2.03e-11
  vector  monitoring     score=8.35e-1
  vector  crypto-notes   score=9.42e-1

Retrieve with Graph RAG (k=1, graphRagHops=2):
  vector          auth-spec      score=2.03e-11
  graph-adjacent  crypto-notes   score=1.02e-11 (via entity:auth)

Value report:
  5 of 9 unique capabilities active. 4 dormant — mixed (5/9 observed).
  active:
    ✓ vectorSearch     2 invocations  [ruvector-core]
    ✓ vectorInsert     1 invocations  [ruvector-core]
    ✓ health           0 invocations  [ruvector-core]
    ✓ metrics          0 invocations  [ruvector-core]
    ✓ graphRag         1 invocations  [ruvector-graph]    ← FIRST FLIP
```

Tier-3 probe assertion is a 3-way invariant: A must be in vector hits, B must be graph-adjacent via shared entity, C (no shared entity) must NOT appear. Stronger than just "B is reachable" — also enforces that graph-RAG isn't being too greedy.

Open v0.2 work-items:
- Validate dimension match between KB and graphReasoner at create-time (currently surfaces as upstream error during ingest).
- `graphRagHops < 2` could throw or warn (currently silently returns 0 graph-adjacent docs).
- Multiple bridge entities in the same doc-pair: report all, not just the first.
- `_docEntities` map needs eviction when a delete API on KB lands.
- Real NER extractor as a contributed extension (not in core SDK).

## Update — M8.2 outcome (extract shared reducer; unify introspect semantics)

After three archetypes confirmed the catalog/probe pattern was stable, the duplicated `getValueReport` and `introspect` bodies were extracted into `core/capability-catalog.ts`. Each archetype now keeps only its own data (the `CAPABILITY_CATALOG` array) and state (`_invocationCounts`, `_lastHealth`); the reducer logic lives in one place and is consumed via 5-line delegations.

Net change:
- ~140 LOC of duplication eliminated (~80 LOC × 3 archetype reducers, replaced by ~10 LOC × 3 delegations + ~140 LOC shared module).
- Three private copies of `CapabilityCatalogEntry` collapsed to one re-exported type.

Latent bug fixed in passing: `introspect().stages` previously had divergent filters across archetypes — GR used `c => c.probeName` (would include dormant `cypher` because it has a probe!), KB and TSM used `c => c.defaultStatus === 'active'`. Unified to "currently-active capabilities (post-observation overlay)" — `introspect.stages` now exactly matches `getValueReport.active`. Invisible to current demos (none call introspect) but eliminates a latent surprise.

Verification: captured canonical demo output for all three archetypes before the refactor, ran the refactor, captured after. Diff is empty modulo two documented sources of per-run nondeterminism (random probe ID suffixes and upstream's kHop iteration order). Pure-refactor verified by behavior, not just by type-check.

v0.2 work-items still open:
- Extract `_archetypeProbe` template (tier-3 probes still duplicated; argument shapes vary per archetype, so harder than the reducer extraction was)
- Add unit tests for the reducer in isolation once the shared module grows complex enough
- Add `healthCheck: 'on-create'` constructor option

## Update — M8.1 outcome (tier-3 archetype probes — closing the readiness loop)

The `ms | 0` bug from M8 v0.1 exposed a gap in the smoke-check pattern: it validated the *binding* but not the SDK's logic over the binding. M8.1 closes that gap with archetype-level probes that exercise the SDK's own public API end-to-end.

`CheckResult` now carries an optional `tier: 'binding' | 'archetype'`. Each archetype's `healthCheck()` runs both: tier-1/2 probes via the existing `NativeBackend.smokeCheck` (catches binding bugs like the Cypher stub), and tier-3 probes via a static `_archetypeProbe()` method (catches SDK-layer bugs like timestamp encoding).

Probes added:

- **GraphReasoner.\_archetypeProbe** — addNodes + addEdges + kHopNeighbors round-trip. Asserts kHop(node-a, 1) reaches node-b. **Leak:** no delete API in `@ruvector/graph-node@2.0.3`; probe data accumulates in shared store. Mitigated by unique IDs.
- **KnowledgeBase.\_archetypeProbe** — ingest 3 docs with distinct embeddings, retrieve with one as query, assert it ranks in top-k. Cleans up via `NativeCoreBackend.deleteId`.
- **TimeSeriesMemory.\_archetypeProbe** — append 3 points at year-2100 timestamps, query with window covering them, **assert `top.timestampMs === T0`**. This is literally the regression test for the M8 `ms | 0` bug; if the bug ever returns, this probe surfaces it as `broken` with the diagnostic `expected top.timestampMs=… got 0 — likely an ID encoding bug in the SDK layer`.

`runCheck(name, fn, tier?)` extended to accept tier; default is `'binding'`. No breaking changes to existing call sites.

`NativeCoreBackend.deleteId(id)` exposed for probe cleanup.

Probe latency: TSM probe ~51 ms, KB probe ~45 ms, GR probe ~1 ms (no temp instance — uses GraphReasoner.create directly). All under any reasonable startup budget.

**Three-tier readiness gate now in place:**
1. **Binding loads** — verified by NAPI/WASM/HTTP load probe.
2. **Binding works** — verified by tier-1/2 smoke checks (insert, search, etc with known inputs).
3. **SDK works over binding** — verified by tier-3 archetype probes that go through the SDK's public API and assert on result quality.

Tier 3 is the layer the M8 `ms | 0` bug lived at. Without tier-3 the bug shipped clean through tier-1/2. With tier-3, the bug is now a regression test that runs on every healthCheck.

## Update — M8 v0.1 outcome (TimeSeriesMemory + third-archetype validation; abstraction-extraction unblocked)

The catalog/probe pattern survived its third archetype with **zero source-level changes**. TimeSeriesMemory uses an identically-shaped `CAPABILITY_CATALOG`, the same `getValueReport` reducer, the same `introspect`. Three meaningfully different workloads (graph / vector / timestamp-keyed) now share the value-report machinery.

**v0.2 work-item now unblocked**: extract `core/capability-catalog.ts` with a shared `runCatalogReducer(catalog, lastHealth, invocationCounts)` function. Three samples is enough; the abstraction is no longer accidentally graph-shaped. Each archetype keeps its own catalog data; only the reducer logic gets shared (~80 LOC dedup × 3).

**Bug found by demo, not by smoke check.** The first run of TimeSeriesMemory's demo silently returned 0 matches despite confirmed 30 inserts. Smoke check passed 5/5. Root cause: SDK-side `padTs(ms)` used `ms | 0` for integer coercion, which is signed-int32-truncate; for any timestamp after Sep 2003 it overflows negative, `Math.max(0, negative)` returns 0, all sample IDs encoded with timestamp portion `000000000000000`, window filter then drops everything. Fixed with `Math.trunc(ms)`. **Lesson**: smoke checks validate the *backend*; SDK-internal logic still needs end-to-end demo runs that look at *result quality*, not just absence of errors. The demo's "0 matches in 30-sample window" output was the right signal; smoke-check pass/fail was orthogonal.

**TimeSeriesMemory v0.1 is the first archetype where a unique capability actually returns a useful result.** GraphReasoner v0.1 has cypher stubbed upstream; KnowledgeBase v0.1 is search-only with no LLM. TSM v0.1 correctly identifies a 14-minute anomaly window in a 30-sample trace via vector similarity — real anomaly detection on a real backend. Even with 5 of 9 capabilities dormant, the working surface delivers value.

**v0.1 limitations declared and documented**:
- Window filtering is post-search; narrow windows degrade recall (visible via `deltaIndexing` dormant entry).
- `value: string | Record` accepted at compile time, throws at runtime — wider M5 union preserved for forward compat with the embedder.
- No `appendBatch` chunking — large batches could OOM the binding.
- `bucketMs` option is advisory only — temporal compression isn't wired.
- `detectChangepoints()` throws (no streaming primitive in `@ruvector/core`; deferred until Mamba bindings or a v0.2 trivial baseline).

## Update — M7 v0.1 outcome (KnowledgeBase + second-archetype validation)

The catalog/probe pattern from M6.2 ports to a second archetype with no source-level changes. `KnowledgeBase` (wired to `@ruvector/core` via the in-repo prebuilt binary) uses an identically-shaped `CAPABILITY_CATALOG`, an identically-shaped `getValueReport` reducer, and an identically-shaped `introspect`. Both archetypes' value reports now read the same way: `source`, `lastHealthCheckAt`, `[observed via probe ...]` dormant strings.

Two upstream findings the smoke check caught on first run:

**Finding A — `@ruvector/core` VectorDb dimension singleton.** `new VectorDb({dimensions: N})` rejects subsequent inserts at non-N dimensions across instances created later. Cause: the binding caches dimensions on the first construction. Mitigation: smoke check accepts a `dimensions` parameter and sizes the probe to the user's KB dimensions; archetype passes its own dimensions through.

**Finding B — `@ruvector/core` VectorDb shared state.** `new VectorDb()` does not isolate instances; multiple constructions in the same Node process share a backing store. Probe inserts therefore pollute the user's `len()` and (less concerningly) the user's index. Mitigations:
1. Probe assertions are deltas (`len_after - len_before == 1`), not absolutes.
2. Probe IDs use a private prefix (`__ruvsdk_probe_*`) and are best-effort deleted at the start AND end of the smoke check.
3. Documented loudly so users know `healthCheck()` is a destructive read against shared state.

**Finding C — `@ruvector/core` writes to disk by default.** Constructing `new VectorDb({dimensions, distanceMetric})` without an explicit `storagePath` creates a default `ruvector.db` file in the current working directory rather than running in-memory. Combined with Finding B, this means state actually persists across Node processes too, not just within one. Mitigations:
1. SDK `.gitignore` excludes `*.db` and `*.rvf` so accidental persistence doesn't get committed.
2. v0.2 should pass an explicit ephemeral path to the binding when the user requests in-memory mode, then clean it up on close. Or, ideally, upstream adds an explicit in-memory mode.

Both findings are real upstream quirks worth filing. Both are handled cleanly by the same observe-and-classify pattern that handles Cypher's stub.

Catalog duplication: two ~80-line `CAPABILITY_CATALOG` arrays now live in `archetypes/GraphReasoner.ts` and `archetypes/KnowledgeBase.ts`. Pure copy-paste, drift-prone. v0.2 should extract a shared module — but the M7 v0.1 deliberate scope cap is to **wait for a third archetype** before committing to a shared shape. Two data points isn't enough to lock in the abstraction.

## Update — M6.2 outcome (value report → observation)

The v0.2 wiring item from M6.1 has shipped:

- `ValueReport` extended with `healthSource: 'observed' | 'declared' | 'mixed'` and optional `lastHealthCheckAt`.
- `GraphReasoner` reorganized around a single `CAPABILITY_CATALOG` source of truth. Each entry declares default status + optional `probeName` mapping into the smoke-check result.
- `healthCheck()` caches its result on the instance; subsequent `getValueReport()` and `introspect()` calls consult the cache.
- For probed capabilities, observed status overrides declared status. Dormant reasons quote the probe's own diagnostic (`[observed via probe 'cypher', status=broken] ...`) instead of a hardcoded string.

Demo now shows the contrast explicitly:

```
[0a] Value report BEFORE healthCheck — declared only:
  source: declared
  cypher dormant reason: "STUB UPSTREAM (declared): ..."

[0b] healthCheck runs, 5 ok / 1 broken in 0.79 ms.

Value report AFTER:
  source: mixed (4/8 observed)
  cypher dormant reason: "[observed via probe 'cypher', status=broken]
                          MATCH (n) RETURN n returned 0 nodes despite
                          stats showing 2."
```

Self-correcting property: when upstream fixes the Cypher engine, the next `healthCheck()` reports `cypher: ok`, the catalog reducer moves it from dormant to active, and the value report tells the new truth with zero SDK code change.

## Findings worth surfacing regardless of M6 path

These came out of the scoping pass and matter for the broader project:

- **The published `ruvector` umbrella package on npm is broken.** Its `package.json#main` references `dist/index.js` which isn't in the tarball. Anyone who runs `npm install ruvector` and tries to import it gets a "Cannot find module" error. Worth filing upstream.
- **`@ruvector/core` is in-repo only.** The platform package is not published on npm. Means the SDK can't depend on it via npm-normal mechanisms; would need to vendor or pre-build.
- **NAPI publishing coverage is uneven.** Three packages are properly multi-platform-published (`graph-node`, `rvf-node`, `sona`); the rest are repo-only or unpublished. Any v0.2 plan that depends on `attention-node` / `gnn-node` / `ruvllm` needs to either build from source or wait for upstream publishing.
