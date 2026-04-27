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
