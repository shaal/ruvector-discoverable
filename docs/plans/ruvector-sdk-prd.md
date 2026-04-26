# RuVector SDK — Product Requirements Document

| Field | Value |
|---|---|
| Status | Draft v0.1 |
| Owner | Ofer Shaal |
| Created | 2026-04-26 |
| Upstream pinned at | `github.com/ruvnet/ruvector` (cloned to `./ruvector/`) |
| Upstream version observed | `2.2.0` |
| Doc location | `docs/plans/ruvector-sdk-prd.md` |

This PRD has two halves. **Part A** specifies the SDK product. **Part B** specifies the recursive code-first analysis process whose output feeds Part A. They are intentionally in one document because the product specification cannot be finalized until the analysis is run, and the analysis only makes sense in the context of the product it serves.

---

## 1. Problem Statement

RuVector upstream contains an extraordinary breadth of capability — observed in this repo:

- **125** top-level directories under `crates/` (workspace + excluded crates)
- **22** nested crates inside `crates/ruvix/` (bare-metal AArch64 cognitive kernel)
- **~10** nested crates inside `crates/rvf/` (peer subworkspace with its own `Cargo.lock`)
- **57** packages under `npm/packages/`
- **73** example apps under `examples/`
- **171** ADR files in `docs/adr/`, numbered up to ADR-159

A reasonable estimate is **>200 distinct technical capabilities** across vector indexing, graph algorithms, attention mechanisms, local LLMs, formal verification, post-quantum crypto, FPGA acceleration, kernel-level cognition, and dozens of "boundary discovery" demonstrations.

Despite this breadth, three problems block adoption:

1. **Discoverability collapse.** Developers reach for `VectorDB`, recognize HNSW, and stop. The remaining ~95% of unique capability is invisible behind a flat API surface and a 276 KB README that no one reads end-to-end.

2. **Generic fallback by gravity.** The default code path looks like every other vector DB: `insert()` then `search(vec, k)`. A developer who never reads further never discovers SONA continual learning, Graph RAG, hyperbolic HNSW, mincut-gated attention, or ColBERT — and ends up with a *worse* generic vector DB than they could have built on something simpler.

3. **No code-truth catalog.** Even the README and ADRs do not exhaustively cover what's in the code. Public items, NAPI bindings, and WASM exports exist that have no documentation — features hidden from the people they could help.

The SDK exists to solve all three.

---

## 2. Goals & Non-Goals

### Goals

1. Make RuVector's unique capabilities the **default** path, not an opt-in.
2. Make every query *self-explanatory* — the developer learns what RuVector did from using it, not from reading docs.
3. Produce a **code-derived, regenerable catalog** of every public capability in upstream, classified into archetypes, with hidden features surfaced explicitly.
4. Ship a **transport-agnostic TypeScript SDK** with three pluggable backends (native, WASM, HTTP) under one API.
5. Keep the surface small enough that a competent TypeScript developer can adopt it in an afternoon.

### Non-Goals

1. Re-implementing or forking upstream Rust crates. The SDK consumes upstream; it does not maintain a parallel codebase.
2. Polyglot bindings (Python, Go, Swift) in v1. TypeScript-first; other languages are a v2 question.
3. Exposing every one of the ~200 capabilities. Long-tail capabilities (FPGA transformer, quantum coherence, bare-metal kernel) are out of the SDK's headline surface — accessible via an `advanced/` namespace with explicit imports, but not in autocomplete-by-default.
4. Replacing the existing `ruvector` umbrella npm package. The SDK is a new product with a different shape; the umbrella package continues to exist.

---

## 3. Target Users

| Persona | Need | Today's friction |
|---|---|---|
| **App developer building RAG over docs** | Hybrid search + Graph RAG, low latency, runs locally | Lands on HNSW only; never enables Graph RAG |
| **Agent framework author** | Long-term agent memory with feedback-driven improvement | Doesn't know SONA exists |
| **DevTool builder indexing code** | Per-token retrieval, semantic + symbol-aware | Doesn't know ColBERT or Matryoshka are available |
| **Researcher exploring graph models** | Graph transformers, GNN, mincut | Has to read 159 ADRs to find the right module |
| **Edge / browser developer** | WASM-shippable vector + light LLM | Has to figure out which of 57 npm packages actually run in a browser |

The SDK's success is measured against these personas, not against a feature checklist.

---

## 4. Solution Overview — Five Reinforcing Patterns

The SDK rests on five patterns. None of them is sufficient alone; all five together address the discoverability and generic-fallback problems.

1. **Task-first archetypes** as the headline API surface. Developers choose `KnowledgeBase`, not `VectorDB`.
2. **Inverted opt-in.** Unique capabilities are on by default. Generic mode requires explicit detour.
3. **`.explain()` on every result.** Every operation returns a trace of which capabilities contributed.
4. **`getValueReport()`** detects dormant capabilities and recommends activation steps.
5. **`doctor` / `recommend` CLI** maps developer-stated workloads to a generated config.

These are specified in detail in §5.

---

# Part A — Product Specification

## 5. SDK Specification

### 5.1 Package shape & distribution

- **Primary package:** `@ruvector/sdk` (name TBD; placeholder).
- **Distribution:** ESM + CJS, TypeScript types first-class, Node ≥ 18, browsers via the WASM backend.
- **Backends (pluggable, one API):**
  - `native` — wraps `@ruvector/core` and friends (NAPI). Default in Node.
  - `wasm` — wraps the upstream WASM bundles. Default in browser.
  - `http` — talks to `ruvector-server`. For remote / serverless deployments.
- **Backend selection** is automatic from environment, overridable via constructor option.

### 5.2 Architecture: archetypes over features

The headline export is **eight seed archetypes** (subject to evolution per §11). Each archetype is a pre-wired pipeline that activates the upstream capabilities appropriate to its workload.

| Archetype | Workload | Default-active capabilities (illustrative; final list set after §6 analysis) |
|---|---|---|
| `KnowledgeBase` | RAG over documents | Hybrid (sparse+dense) + RRF + Graph RAG (Leiden) + ColBERT rerank + SONA |
| `AgentMemory` | Long-term agent state | GNN-learned index + SONA + EWC++ + hyperbolic HNSW for hierarchical recall |
| `CodebaseIndex` | Code search | ColBERT multi-vector + Matryoshka funnel + symbol graph + AST-aware chunking |
| `RecommendationEngine` | User × item retrieval | Bipartite GNN + collaborative filtering + temporal tensor compression |
| `TaxonomySearch` | Hierarchical / tree-like data | Hyperbolic HNSW + tree-aware metadata filters |
| `TimeSeriesMemory` | Sequential / streaming data | Mamba SSM attention + delta indexing + temporal-causal layers |
| `GenomicAnalyzer` | Bio sequences | rvDNA + HNSW k-mer search + biomarker engine |
| `GraphReasoner` | Multi-hop + Cypher queries | Cypher engine + graph transformers + sublinear PageRank + sparsifier |

Each archetype has:
- A reference example application (one per archetype, in `examples/sdk/<archetype>/`)
- A specification of which upstream features it activates
- A `getValueReport()` whose dormant-capability recommendations are tailored to its workload

### 5.3 Public API sketch (illustrative)

```ts
import { KnowledgeBase, AgentMemory, CodebaseIndex } from '@ruvector/sdk';

// 1. Task-first construction
const kb = await KnowledgeBase.create({
  source: './docs',          // file glob, URL, or async iterator
  backend: 'auto',           // 'native' | 'wasm' | 'http' | 'auto'
  storage: './kb.rvf',
});

// 2. Default path is the unique path
const answer = await kb.ask('how does our auth flow work?');
console.log(answer.text);
console.log(answer.citations);

// 3. .explain() teaches what happened
console.log(answer.explain);
// {
//   path: ['embed', 'sparse+dense hybrid', 'RRF', 'leiden community 7', 'colbert rerank'],
//   sona: { applied: true, deltaFromQueries: 142, estimatedLift: 0.12 },
//   latencyMsByStage: { embed: 4.1, hybrid: 1.2, graph: 2.0, rerank: 3.8, fuse: 1.2 },
// }

// 4. Feedback closes the SONA loop
await kb.recordFeedback(answer.queryId, { score: 1, comment: 'correct' });

// 5. Value report flags dormant capabilities
const report = await kb.getValueReport();
// { active: ['hybrid', 'graph-rag', 'rrf'],
//   dormant: [{ name: 'colbert', reason: '...', expectedLift: '...', enable: '...' }] }

// 6. Capability registry for power users (does not appear at headline level)
import { capabilities } from '@ruvector/sdk/advanced';
capabilities.list({ category: 'attention' });
capabilities.recommend({ workload: 'long-context-rag' });
```

### 5.4 Cross-cutting APIs (apply to every archetype)

- **`.explain`** — present on every result object; tracks pipeline stages, latencies, capability-attributed score lift.
- **`getValueReport()`** — returns `{ active, dormant }` arrays; dormant entries include a one-line `enable` example.
- **`recordFeedback(queryId, signal)`** — feeds SONA where applicable; no-ops gracefully when SONA is not in the active path.
- **`introspect()`** — returns the archetype's wired pipeline as data (not text), for tooling.
- **Module augmentation** — installing optional packages (e.g. `@ruvector/router`, `@ruvector/diskann`) extends archetype types via TS module augmentation, so optional capabilities appear in autocomplete only when actually installed.

### 5.5 `doctor` / `recommend` CLI

```
$ npx @ruvector/sdk recommend
? What are you building? › RAG over technical documentation
? How much data? › ~100k docs, growing
? Latency target p95? › <50ms
? Update pattern? › Daily ingest

→ Recommended: KnowledgeBase + DiskANN backend + ColBERT rerank + Graph RAG
→ Skip: Matryoshka (data too small), TurboQuant (no generation in path)
→ Generated: ruvector.config.ts
```

The CLI also has `doctor` (introspect a running SDK and report degradations) and `audit` (compare a config against best-practice for its archetype).

### 5.6 Out-of-headline candidates (revisit at M4)

These upstream areas are *initial candidates* for "not in the SDK headline surface" — accessible via `@ruvector/sdk/advanced` with explicit imports rather than archetype-default. **No capability is permanently excluded.** Per §6.9, the catalog is allowed to add new archetypes if a coherent cluster of capabilities serves a workload not in the seed list — including capabilities that look out-of-scope from this distance.

Initial candidates:

- FPGA transformer (`ruvector-fpga-transformer`)
- Quantum coherence (`ruQu`, `ruqu-*`)
- Bare-metal cognitive kernel (`crates/ruvix/`)
- Post-quantum crypto primitives (currently surfaced via RVF)
- Most "boundary-discovery" examples (currently look like demonstrations, not products)
- Postgres extension (`ruvector-postgres`) — separate distribution path; SDK likely consumes via HTTP, not embedded

Each candidate is tagged `headline-candidate=false` in the catalog so the decision is auditable. M4 ratifies the final list against actual code and use cases — items here may be promoted to headline if the catalog reveals them serving a real archetype.

---

# Part B — Recursive Code-First Analysis Process

This half specifies how to discover what's actually in upstream. The output of this process is the input to Part A's archetype-feature mapping.

## 6. Analysis Process

### 6.1 Why code-first

READMEs, ADRs, and inline comments are *partial* maps. They cover the parts the authors thought worth advertising. The hidden features — items developers would benefit from but never find — live in code that has no doc coverage. Therefore the source of truth for the catalog is the code itself: `pub` items in `lib.rs` and module trees, plus NAPI/WASM exports.

ADRs and READMEs are useful as a **structural skeleton** to seed the analysis (they tell us where to look) and as **cross-cutting tags** on items (they tell us why an item exists). They are not the catalog.

### 6.2 Granularity model

Three nested levels, with ADRs as cross-cutting tags:

- **L1 — Crate.** A unit of distribution. Has a `Cargo.toml`, possibly an npm package, possibly a workspace exclude.
- **L2 — Module / capability.** A module path inside a crate that represents a coherent capability (e.g., `ruvector_gnn::graphmae`).
- **L3 — Public item.** Every `pub fn`, `pub struct`, `pub trait`, `pub enum`, `pub const`, `pub macro`, plus every NAPI `#[napi]` export and every `#[wasm_bindgen]` export.

A **hidden feature** is an L3 item that:
- has no doc comment, AND
- has no ADR tag, AND
- is not referenced from any README or example.

These are the highest-value finds for the SDK.

### 6.3 Scope

**In scope:**
- All 125 directories under `crates/`, including those excluded from the default workspace (`ruvector-postgres`, `micro-hnsw-wasm`, `ruvector-hyperbolic-hnsw`, `mcp-brain-server`, etc.)
- The `crates/rvf/` peer subworkspace (~10 nested crates)
- The `crates/ruvix/` nested workspace (22 nested crates)
- `npm/core/` and all 57 packages under `npm/packages/`
- All 171 ADR files under `docs/adr/`

**In scope at L1 only** (noted as "this exists, demonstrates X" but not L3-catalogued):
- All 73 directories under `examples/`

**Out of scope:**
- `bench_results/`, `benchmarks/`, `data/`, `test_models/`, `tests/` (top-level, not crate-level tests)
- Vendored dependencies under `patches/`
- Generated artifacts in `target/`, `dist/`, `node_modules/`

### 6.4 Phase 0 — Bootstrap from ADRs *(M1, complete)*

Implementation: `tools/extract-adrs/extract-adrs.mjs` — dependency-free Node ESM.
Outputs: `catalog/adrs.json` and `catalog/adrs.md`. Re-runnable; deterministic apart from the top-level `extracted_at` timestamp.

Per-ADR fields extracted: id, sub_letter (for ADR-040a/b), title, slug, status (parsed + raw), date, header format (A/B/C), referenced ADRs, referenced crates, supersession relations, summary first paragraph, file path, size, line count.

Three header format generations supported:
- **A** — bold key-value pairs (`**Status**: Proposed` or `**Status:** Proposed`) — 96 ADRs
- **B** — markdown subsection (`## Status` followed by value) — 48 ADRs
- **C** — markdown table, with or without bold labels — 27 ADRs

**M1 findings (from running the tool, not assumed):**

| Metric | Value |
|---|---|
| ADRs parsed | **171** |
| Highest ID | ADR-159 (8 IDs missing in range: 018–023, 041, 152) |
| Real upstream crates on disk | **164** (top-level `crates/` + `ruvix/crates/` nested + `rvf/rvf-*` peers) |
| Crate refs found in ADRs | 212 |
| Verified (match a real crate) | 116 |
| Unverified (renamed / removed / external / GCP resource) | 96 |
| **Real crates with no ADR coverage** | **48** |

The 48-crates-with-no-ADR finding is the highest-signal output of M1: it's a concrete priority list for M3. It includes the entire 22-crate `ruvix/` subworkspace, the `agentic-robotics-*` family (6 crates), and infrastructure crates like `ruvector-server`, `ruvector-cli`, `ruvector-cluster`, `ruvector-router-core` — code that exists and ships but has no ADR record explaining why.

The 96 unverified crate refs are not all bugs; many are renamed crates (e.g., `ruvector-deep-*` family, likely the previous name for `rvAgent`) or external dependencies (`fips204`, `lean-agentic`). M2's `Cargo.toml` walk + git-history scan will classify each definitively.

### 6.5 Phase 1 — Ripgrep-driven inventory (bootstrap, fast)

A short script that:
1. Walks every in-scope crate.
2. Extracts `Cargo.toml` metadata (name, version, deps, features, workspace status).
3. `rg`-matches `^pub (fn|struct|trait|enum|const|type|macro)` to enumerate L3 items at first approximation.
4. `rg`-matches `#\[napi` and `#\[wasm_bindgen` to flag bindings.
5. Cross-references doc comments (`///` lines preceding `pub`).
6. Emits `catalog/inventory-bootstrap.json` for review.

This is rough — regex misses macros, cfg-gated items, and re-exports — but it gets a 70% catalog in hours, not weeks. It also tells us where the AST-driven phase will need to be most careful.

### 6.6 Phase 2 — AST-driven catalog (target)

A Rust binary using `syn` (and `cargo_metadata` for dep graphs) that:
1. Parses every `lib.rs` and module tree in scope.
2. Walks the public-item tree, respecting `pub use` re-exports and `cfg` attributes.
3. Captures full type signatures, generics, where-clauses, and associated docs.
4. Detects NAPI/WASM bindings via attribute parsing (not regex).
5. Resolves which examples (`examples/*`) reference each crate.
6. Emits `catalog/catalog.json` — the source of truth.

This is the only way to get correct re-export resolution and feature-flag awareness. Estimated effort: ~5–8 working days.

The `syn` parser lives at `tools/ruvector-cataloger/` (a new crate in this SDK workspace). It is run via `cargo run -p ruvector-cataloger -- --upstream ./ruvector --out ./catalog/`.

### 6.7 Catalog schema (sketch)

> **The example below is a *shape* spec, not real data.** Crate names, item names, ADR IDs, and tags are placeholders. Real values are populated by the cataloger in M3.

```jsonc
{
  "version": "1.0",
  "generated_at": "<ISO8601>",
  "upstream_commit": "<sha>",
  "upstream_version": "2.2.0",
  "stats": { "crates": 125, "modules": "<n>", "public_items": "<n>" },

  "crates": [
    {
      "name": "<crate-name>",
      "path": "crates/<crate-name>",
      "version": "<semver>",
      "in_default_workspace": true,
      "publishes": ["crates.io:<name>", "npm:<scoped-name>"],
      "features": ["<feature-flags>"],
      "deps": ["<workspace-deps>"],
      "modules": [
        {
          "path": "<crate>::<module>",
          "doc": "<doc-comment-or-null>",
          "public_items": [
            {
              "name": "<ItemName>",
              "kind": "struct | trait | fn | enum | const | type | macro",
              "file": "src/<path>.rs",
              "line": 0,
              "signature": "<full-signature>",
              "doc": "<doc-comment-or-null>",
              "is_napi": false,
              "is_wasm": false,
              "is_reexported_as": null,
              "feature_gates": [],
              "adr_refs": ["<resolved-by-cataloger>"],
              "tags": ["<unique|standard|hidden|deprecated|...>"]
            }
          ]
        }
      ],
      "adr_refs": ["<resolved-by-cataloger>"],
      "archetype_candidates": ["<set-during-classification>"],
      "examples_referencing": ["examples/<path>"]
    }
  ],

  "adrs": [
    { "id": "ADR-XXX", "title": "<from-adr-front-matter>", "status": "<accepted|...>",
      "covers_crates": ["<resolved>"], "covers_items": ["<resolved>"] }
  ],

  "archetypes": [
    {
      "name": "<ArchetypeName>",
      "default_pipeline_stages": ["<stage>"],
      "active_capabilities": [{ "crate": "<name>", "item": "<name>" }]
    }
  ],

  "uncategorized": [
    { "crate": "<name>", "item": "<name>", "reason": "<no archetype matched|domain unclear>" }
  ]
}
```

### 6.8 Classification workflow

For every L3 item the catalog asks four questions:

1. **Does an ADR cover this?** If yes → tag with ADR ID.
2. **Does any README mention this?** Search upstream READMEs. If yes → tag `documented`.
3. **Does any example use this?** Search examples. If yes → tag with example path.
4. **Which archetype(s) could this serve?** Heuristic + manual review. May be zero or many.

Items with none of (1)/(2)/(3) AND no doc comment are flagged `hidden` — these are reviewed as a priority list because they may surface SDK-relevant capability that nobody knows exists.

### 6.9 Archetype evolution (hybrid model)

Per the agreed default, archetypes are seeded from §5.2's eight, but the analysis is allowed to:
- **Split** an archetype if the catalog reveals two distinct workloads inside one.
- **Merge** archetypes if their feature sets overlap substantially.
- **Add** a new archetype if a coherent cluster of capabilities serves a workload not in the seed list.
- **Demote** a seed archetype to `advanced` if upstream support is thin.

The final archetype set is **ratified after the catalog is built**, not before. This PRD is updated at that point.

### 6.10 Outputs of the analysis

| Artifact | Format | Purpose |
|---|---|---|
| `catalog/catalog.json` | JSON | Machine-readable source of truth |
| `catalog/catalog.md` | Markdown | Generated human view (full table) |
| `catalog/by-archetype/<name>.md` | Markdown | One file per archetype with mapped capabilities |
| `catalog/hidden-features.md` | Markdown | Priority list of `hidden`-tagged items |
| `catalog/uncategorized.md` | Markdown | Items not yet mapped to any archetype |
| `catalog/adrs.json` | JSON | ADR skeleton with crate/item references |
| `tools/ruvector-cataloger/` | Rust crate | The parser binary |

All artifacts are regenerable. Upstream changes are tracked by re-running the cataloger and `git diff`-ing the JSON.

---

## 7. Milestones & Sequencing

| # | Milestone | Owner | Dependencies | Rough effort |
|---|---|---|---|---|
| M0 | This PRD approved | User | — | done with this draft |
| M1 | Phase 0 — ADR skeleton extracted (`catalog/adrs.json`) | done 2026-04-26 | M0 | 1 session |
| M2 | Phase 1 — Ripgrep inventory bootstrap | TBD | M1 | 2–3 days |
| M3 | Phase 2 — `syn`-based cataloger v1 | TBD | M2 | 5–8 days |
| M4 | Archetype ratification (final list, mapped to L3 items) | User + TBD | M3 | 2 days |
| M5 | SDK API spec frozen (TypeScript `.d.ts` only, no impl) | TBD | M4 | 3 days |
| M6 | Reference example for one archetype (`KnowledgeBase`) | TBD | M5 | 1 week |
| M7 | SDK v0.1 — three backends, one archetype | TBD | M6 | 2 weeks |
| M8 | SDK v0.2 — three archetypes, `getValueReport`, `.explain` | TBD | M7 | 3 weeks |
| M9 | SDK v0.3 — `doctor` / `recommend` CLI, capability registry | TBD | M8 | 2 weeks |
| M10 | SDK v1.0 — eight (or final) archetypes, docs site | TBD | M9 | 4 weeks |

The current ship-task delivers M0. M1 onward is a separate ship-task each.

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Upstream churn between catalog runs | High | Med | Pin upstream commit in catalog metadata; re-run on bumps |
| `syn` parser incomplete for upstream's macros / cfg patterns | Med | High | Phase 1 ripgrep run as a cross-check; report items present in Phase 1 but missing from Phase 2 |
| Archetypes don't survive contact with real apps | Med | High | Ratification happens *after* a reference example for one archetype is built (M4 / M6) |
| SDK becomes "yet another wrapper" | Med | High | Inverted opt-in + `.explain()` are the differentiation; if either is cut, restart this PRD |
| Maintenance burden tracking 200+ upstream items | High | Med | Catalog is regenerated by tooling, not maintained by hand |
| TypeScript module augmentation gets complex with optional packages | Med | Med | Keep optional surface narrow; prefer runtime capability checks over compile-time when in doubt |
| Upstream relicensing or fork divergence | Low | High | License confirmed MIT in `LICENSE`. Catalog format is upstream-agnostic; could re-target a fork. |

---

## 9. Open Questions

1. **Naming.** Is `@ruvector/sdk` acceptable, or should this avoid the `@ruvector` scope to make the independent-SDK relationship explicit?
2. **License.** Match upstream MIT, or ship Apache-2.0 (more common for SDKs)?
3. **Repo layout.** Single-repo monorepo (`pnpm` workspace + Rust workspace), or multi-repo (SDK separate from cataloger tools)?
4. **Versioning policy.** Pin to upstream major (`@ruvector/core ^0.1.x`) or float?
5. **CI.** Is GitHub Actions sufficient, or is there a preferred host?
6. **Telemetry.** Should `getValueReport()` ever phone home? (Default: no. Flagging the question explicitly.)
7. **Trademark.** "RuVector" is a brand owned by upstream — confirm acceptable use in SDK package name and docs.

These don't block M0. They block M1 / M5.

---

## 10. Success Metrics

The SDK is successful when:

1. **Adoption breadth.** ≥80% of installed `@ruvector/sdk` projects activate at least 4 unique-to-RuVector capabilities (measured via opt-in, anonymous capability counts in the doctor CLI, never automatic).
2. **Time-to-first-query.** A new developer can go from `npm install` to a non-trivial query (with hybrid search + Graph RAG active) in ≤15 minutes following the README.
3. **Generic-fallback rate.** <10% of installed apps run only the `LowLevel` API with no archetype.
4. **Catalog completeness.** Catalog covers ≥95% of upstream `pub` items by L3 count, with `hidden`-tagged items reviewed within one release cycle of being introduced.
5. **Doc-without-reading.** Developers report (via survey or issue tracker) discovering at least one capability they didn't know existed via `.explain()` output.

---

## Appendix A — Upstream inventory snapshot (informational)

Captured 2026-04-26 from cloned upstream. Numbers below are from `ls`; the 164 real-crates count is from the M1 cataloger's authoritative on-disk walk.

```
crates/                       125 top-level dirs
  crates/ruvix/crates/         22 nested (bare-metal AArch64 cognitive kernel)
  crates/rvf/                  ~10 nested (peer subworkspace, own Cargo.lock)
  crates/rvAgent/              9 nested (DeepAgents Rust port)
  crates/ruvllm-*              7 (cli, wasm, per-platform binaries)
  crates/tiny-dancer-*         5 (per-platform binaries)
Total resolvable crate dirs   164 (per tools/extract-adrs)
npm/packages/                  57 packages
examples/                      73 example apps
docs/adr/                      171 ADR files (numbered to ADR-159; 8 IDs missing)
```

Workspace `Cargo.toml` excludes (won't appear in `cargo build --workspace`): `ruvector-postgres`, `micro-hnsw-wasm`, `ruvector-hyperbolic-hnsw[-wasm]`, `mcp-brain-server`, several `examples/*`, the entire `crates/rvf/` subtree (it has its own workspace).

The cataloger must walk these explicitly — they don't show up in `cargo metadata --workspace`.

---

## Appendix B — Glossary of cited upstream concepts

Brief definitions of terms used above; not authoritative — to be replaced by ADR / catalog references after M3.

- **SONA** — Self-Optimizing Neural Architecture; LoRA-based continual learning with EWC++. (`crates/sona`)
- **RVF** — RuVector File format; a single-file "cognitive container" with vectors, models, kernel. (`crates/rvf/`)
- **Graph RAG** — RAG enhanced with a knowledge graph + Leiden community detection. (referenced in `ruvector-core`)
- **DiskANN / Vamana** — SSD-backed billion-scale ANN. (`crates/ruvector-diskann`)
- **ColBERT** — Per-token late-interaction multi-vector retrieval.
- **Matryoshka** — Adaptive-dimension embedding search.
- **TurboQuant** — 2–4 bit asymmetric KV-cache quantization. (`crates/ruvllm`)
- **RuQu** — Quantum coherence / error correction via min-cut. (`crates/ruQu`, `crates/ruqu-*`)
- **RuVix** — Bare-metal cognitive kernel, AArch64. (`crates/ruvix/`)
- **Mincut-gated attention** — Attention masked by graph min-cut. (`crates/ruvector-mincut-gated-transformer`)
- **rvDNA** — Genomics-specific RVF variant. (`examples/dna`, `npm/packages/rvdna`)

---

*End of PRD v0.1. Next ship-task: M1 — extract ADR skeleton.*
