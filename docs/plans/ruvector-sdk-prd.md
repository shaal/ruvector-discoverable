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

### 5.2 Architecture: archetypes over features *(updated by M4 v0.1, 2026-04-26)*

The headline export is **the archetype list below**. M4 v0.1 ratified the eight seed archetypes against M3's catalog and added two evidence-driven proposals (`LocalLLM`, `AgentFramework`). Three seed archetypes (`CodebaseIndex`, `GenomicAnalyzer`, `RecommendationEngine`) have insufficient dedicated upstream support and are flagged as *recipe candidates* rather than first-class archetypes pending v0.2 decision.

| Archetype | Status | Member crates | Items | Default-active capabilities |
|---|---|--:|--:|---|
| `KnowledgeBase` | seed ✓ | 9 | 1,507 | `ruvector-core` + `-graph` + `-attention` + `-cnn` + `sona` + `-gnn` + `-rabitq` + `-rulake` + `-diskann` |
| `AgentMemory` | seed ✓ | 5 | 1,051 | `ruvector-gnn` + `sona` + `-attention` + `-graph` + `-domain-expansion` |
| `CodebaseIndex` | **at risk** | 0 | 0 | _No dedicated upstream crate. Demote to recipe-on-top-of-KnowledgeBase in v0.2._ |
| `RecommendationEngine` | **at risk** | 1 (shared) | 84 | _Only `ruvector-gnn` (shared with AgentMemory). No dedicated infrastructure._ |
| `TaxonomySearch` | seed ✓ (with risk) | 2 | 283 | `ruvector-hyperbolic-hnsw` (excluded from default workspace) + `ruvector-filter` |
| `TimeSeriesMemory` | seed ✓ | 12 | 953 | `ruvector-attention` (Mamba) + `-temporal-tensor` + delta-* (5 crates) + neural-trader-* (4) + `ruvector-kalshi` |
| `GenomicAnalyzer` | **at risk** | 0 | 0 | _Demo-stage only (examples/dna, npm rvdna). Demote to recipe in v0.2._ |
| `GraphReasoner` | seed ✓ | 11 | 1,866 | `ruvector-graph` + `-graph-transformer` + `-mincut` + `-mincut-gated-transformer` + `-attn-mincut` + `-solver` + `-sparsifier` + `-dag` + 3 more |
| **`LocalLLM`** | **proposed M4** | 4 | 1,774 | `ruvllm` (1,547 items, single largest crate) + `-tiny-dancer-core` + `-sparse-inference` + `ruvllm-cli` |
| **`AgentFramework`** | **proposed M4** | 9 | 641 | rvagent-core + -a2a + -mcp + -acp + -middleware + -backends + -tools + -subagents + -cli |

> **What changed vs the v0.1 PRD draft.** The original capability lists in this section were inferred from upstream README marketing prose and were illustrative-only. M4 replaced them with assignments that cite specific M3 catalog items + ADRs. See `tools/archetypes/assignments.mjs` for full per-crate rationale; `catalog/by-archetype/<name>.md` for the generated views; `catalog/archetype-coverage.md` for the summary.

> **Open editorial decision for v0.2.** Promote `LocalLLM` and `AgentFramework` from *proposed* to *seed*; demote `CodebaseIndex`, `GenomicAnalyzer`, and possibly `RecommendationEngine` from headline to recipe. Do this before M5 (API freeze) so the SDK type surface reflects the ratified archetype list.

Each archetype has:
- A reference example application (one per archetype, in `examples/sdk/<archetype>/`)
- A specification of which upstream features it activates
- A `getValueReport()` whose dormant-capability recommendations are tailored to its workload

### 5.3 Public API *(M5 v0.1 — types frozen)*

The TypeScript surface lives at `packages/sdk/src/`. M5 v0.1 freezes the shape; M6 wires the first archetype to a real backend.

**Shipped surface:**

- `packages/sdk/src/index.ts` — re-exports six archetypes + cross-cutting types
- `packages/sdk/src/archetypes/{KnowledgeBase,AgentMemory,GraphReasoner,TimeSeriesMemory,LocalLLM,AgentFramework}.ts`
- `packages/sdk/src/core/{backend,explain,feedback,pipeline,value-report,index}.ts`
- `packages/sdk/src/advanced/index.ts` — `LowLevel`, `capabilities` registry, namespace placeholders for FPGA/Quantum/Postgres/Kernel
- `packages/sdk/examples/api-shape.ts` — exercises every archetype to verify the surface compiles end-to-end

**Verification:** `npm run verify` runs `tsc --noEmit` against both src and the example. Clean compile in v0.1.

**Three "at-risk" archetypes deliberately omitted from M5** pending v0.2 PRD decision: `CodebaseIndex`, `GenomicAnalyzer`, `RecommendationEngine`. M4 found insufficient upstream support; locking types now would freeze decisions M4 said weren't ready.

**Sketch (illustrative, retained from earlier draft):**

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

### 6.5 Phase 1 — Ripgrep-driven inventory *(M2, complete)*

Implementation: `tools/inventory/inventory.mjs` — dependency-free Node ESM, ~1 second runtime.
Outputs:
- `catalog/inventory-bootstrap.json` — full machine-readable catalog (~9 MB)
- `catalog/inventory-bootstrap.md` — per-crate summary table
- `catalog/hidden-features-bootstrap.md` — ADR-orphan crates only, sorted by public-item count (priority list for M3)

**M2 findings (from running the tool):**

| Metric | Value | Notes |
|---|---:|---|
| Leaf crates discovered | **196** | Up from M1's 164 — M1 over-counted workspace wrappers (`ruvix`, `rvf`) and missed nested members of `rvAgent` (10 sub-crates) and `rvm` (10 sub-crates). M2 detects leaf crates generically by `[package]` presence. |
| Public items found | **33,130** | `pub fn` 20,232 / `struct` 5,615 / `const` 2,427 / `use` 1,610 (re-exports) / `mod` 1,585 / `enum` 1,190 / `type` 251 / `trait` 191 / `static` 29 |
| `#[napi]` bindings | **551** across 13 crates | Top: `ruvector-attention-node` (201), `sona` (45) |
| `#[wasm_bindgen]` bindings | **1,780** across 34 crates | Top: `ruvllm-wasm` (435), `ruvector-attention-unified-wasm` (143) |
| **ADR-orphan crates** | **86** | Up from M1's reported 48 — M1 only counted orphans in *its own* known crate set; M2 corrects this. |
| **Public items in orphan crates** | **7,595** | The headline number: 23% of the upstream public surface has no ADR coverage. |
| Crates with 0 pub items found | 11 | Mostly tests, benches, examples nested in workspaces; tagged via `category` field (library/test/bench/example/binary). |

**Single-line case for the SDK:** 7,595 public items across 86 crates have *no decision record*. That is roughly four times the surface the ADRs document. The discoverability gap is now quantified.

**Bootstrap limitations** (declared in the JSON's `notes` field):
- `pub use` re-export chains not resolved — re-exports counted as `use`, not their underlying kind.
- `#[cfg(feature = "...")]` gates not evaluated — items counted unconditionally.
- Macro-generated items (NAPI/WASM expansions, derive output) not visible — only the *attribute lines* are captured.

All three are M3's job. M2 deliberately stays at the regex layer to maximize re-runnability against upstream churn.

**Cross-reference correctness:** Each crate carries `is_adr_orphan` derived from M1's reverse index, plus a `category` tag (`library` / `test` / `bench` / `example` / `binary`) so SDK archetype work in M4 can filter test/bench/example crates without manual review.

### 6.6 Phase 2 — AST-driven catalog *(M3 v0.1, complete)*

Implementation: `tools/ruvector-cataloger/` — Rust binary using `syn 2.0` + `serde`. Builds in ~3 seconds, runs in ~2.5 seconds against 196 crates.
Outputs:
- `catalog/catalog.json` — full structured catalog (~9 MB, the source of truth)
- `catalog/catalog.md` — generated summary
- `catalog/m2-vs-m3-diff.md` — per-crate item-count delta vs M2 (cross-validation)

**M3 v0.1 findings (from running):**

| Metric | Value | Notes |
|---|---:|---|
| Crates parsed | **187 of 196** | 9 are binary-only or use `[lib] path = "..."` overrides; future v0.2 work |
| Source files parsed | 2,096 | Reached recursively from each crate's `lib.rs` via `mod foo;` resolution, including `#[path = "..."]` overrides |
| Parse failures | **0** | Every `lib.rs` reachable from M2 parses cleanly with `syn` 2.0 |
| **Top-level public items** | **13,655** | The accurate API-surface count |
| `pub fn` (top-level / free) | 2,503 | M2 reported 20,232 — the difference (~17.7k) is `impl`-block public methods, real but a different category |
| `pub const` | 873 | M2 reported 2,427 — same explanation; the rest are `impl`-block constants |
| `pub struct` / `enum` / `trait` / `type` / `mod` / `use` / `static` | match M2 within ±5% | Confirms syn finds what ripgrep finds, just classifies correctly |
| **NAPI-decorated items** | **165** | M2 reported 551 attribute lines — the 3.3× difference is attrs inside macros, on fields, in conditional blocks |
| **WASM-decorated items** | **322** | M2 reported 1,780 attribute lines — same explanation |
| `#[macro_export]` items | 5 | Matches M2 |
| **`#[cfg]`-gated items** | **2,377 (17%)** | New finding — almost a fifth of the public API is feature-flagged. Any SDK that doesn't model feature flags will mis-represent shippable surface. |
| Items with doc comment | 10,004 (73%) | Generally well-documented |
| Deprecated items | 4 | Minimal; stable API surface |
| **Items in ADR-orphan crates** | **2,317** | Down from M2's 7,595; the corrected figure after the M1 retrofit |

**Cross-phase bug fixed during M3.** M3 surfaced that `rvagent-a2a` was being marked ADR-orphan despite ADR-159 explicitly listing it. Root cause: M1's `loadRealCrates()` only knew about top-level dirs + `ruvix/crates/*` + `rvf/rvf-*`, missing the 10 `rvAgent/rvagent-*` and 10 `rvm/crates/*` nested members. Retrofitted M1 with the generic `[package]`-section detection used in M2; the fix propagated cleanly through all three phases. **Net effect:** the ADR-orphan count dropped from 86 → 70 crates, and orphan items from 7,595 → 2,317 (M3-correct figure). Those 1,020 reattributed items are now properly linked to ADR-159, ADR-100, and others.

**v0.1 deliberate omissions** (noted in `catalog.json` and queued as v0.2/v0.3 work):
- Cross-crate `pub use` chains not resolved — re-exports recorded as use-tree strings only.
- Feature flags not combinatorially expanded — `#[cfg]`-gated items present unconditionally.
- Macro expansion not done — NAPI/WASM bindings observed at attribute layer, not at generated-output layer.
- `impl`-block public methods not captured as separate items — type captured, methods inside not enumerated. Real users want both counts.
- `[lib] path = "..."` overrides not honored — bounded to 9 currently lib-less crates.

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
| M2 | Phase 1 — Ripgrep inventory bootstrap | done 2026-04-26 | M1 | 1 session |
| M3 | Phase 2 — `syn`-based cataloger v0.1 | done 2026-04-26 | M2 | 1 session |
| M4 | Archetype ratification (final list, mapped to L3 items) | done 2026-04-26 (v0.1) | M3 | 1 session |
| M5 | SDK API spec frozen (TypeScript `.d.ts` only, no impl) | done 2026-04-26 (v0.1) | M4 | 1 session |
| M6 | Reference example for one archetype (GraphReasoner) | done 2026-04-26 (v0.1) | M5 | 1 session |
| M7 | SDK v0.1 — second archetype (KnowledgeBase) on @ruvector/core | done 2026-04-27 (v0.1) | M6 | 1 session |
| M8 | SDK v0.1 — third archetype (TimeSeriesMemory) on @ruvector/core | done 2026-04-27 (v0.1) | M7 | 1 session |
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
6. **Reprobe matches expected on every published SDK release.** The `tools/reprobe-bindings/reprobe.mjs` script (v0.5: 31 npm + 1 CLI + 6 binding-method probes = 38 monitored signals) exits 0 against the upstream surface at SDK publish-time. Drift on a release tag = a reproducer for "what changed upstream between SDK versions" — the canonical input to the next SDK milestone. *(Added M24 ratification; testable directly via `node tools/reprobe-bindings/reprobe.mjs; echo $?`.)*

---

## 11. SDK ↔ Upstream relationship policy *(added M17 ratification, 2026-04-27)*

The SDK is a **consumer** of upstream `github.com/ruvnet/ruvector`. We do not control upstream's release schedule, defect-fix priorities, or breaking-change cadence. This section formalizes how the SDK responds to upstream changes so that downstream consumers experience predictable behavior even when upstream churns.

### 11.1 Hard rules (govern every milestone)

1. **Never block SDK delivery on an upstream fix.** When the SDK encounters an upstream defect, it (a) classifies the affected capability `dormant` with a blocker reason, (b) files a paste-ready bug report at `docs/upstream-issues/`, (c) ships around it. As of M24 (2026-04-27), 11 paste-ready issues have been filed (#01–#11); none have blocked a milestone.

2. **Re-probe before relying on prior-doc upstream claims.** `tools/reprobe-bindings/reprobe.mjs` is the authoritative ground truth. Run it at every milestone close. M11 / M12 / M17 each caught a stale upstream-state claim that earlier scoping had treated as fact.

3. **Trust observed status over declared status.** Catalog rows declare a default `active`/`dormant`; live binding probes override the declared status with what the binding actually does. When upstream fixes a stub, the SDK reclassifies automatically (M6.2 / M11.3 self-correcting-classification pattern).

4. **The diagnostic infrastructure IS the bug-report-evidence infrastructure.** Probe diagnostics (`[observed via probe '...', status=broken] ...`) are lifted verbatim into upstream issue bodies. No editorial rewriting; one investment, two payoffs.

### 11.2 SDK versioning policy

The SDK uses semver, with explicit upstream-snapshot tracking because upstream churn is the largest source of breakage we'll see.

| Bump | Trigger |
|---|---|
| **patch** (`0.0.x`) | SDK-only changes: doc fixes, internal refactors, new probe rows, classification updates. Upstream snapshot unchanged. |
| **minor** (`0.x.0`) | Additive surface changes: new archetype, new CLI subcommand, new transport backend, dormant→active flips driven by upstream changes the SDK now exposes. Old code paths continue to work. |
| **major** (`x.0.0`) | Breaking SDK surface change. Reserved for: upstream forced a non-translatable break the SDK can't shim; OR an SDK-side architectural rewrite. Both should be rare. |

Every SDK release names a **verified upstream snapshot** — the `PROBES` + `CLI_PROBES` + `BINDING_METHOD_PROBES` tables in `tools/reprobe-bindings/reprobe.mjs` (v0.5+) at the release commit. Re-running reprobe against today's upstream surfaces drift; that drift drives the next milestone. The full surface monitored is documented in §11.6 below.

### 11.3 Response patterns by upstream-change type

| Upstream change | SDK response |
|---|---|
| **Additive — new method, new package** | Next minor bump exposes the capability. New catalog row + new probe. dormant→active reclassification automatic via M6.2 pattern when binding ships. |
| **Surface regression — method removed/renamed** | SDK records reproducer at `docs/upstream-issues/`. Affected capability flips active→dormant `[upstream-bug]`. CHANGELOG names user-facing impact. Consumer sees the regression *via the SDK's value report*, not as a runtime crash. |
| **Defect fix — broken binding starts working** | Next reprobe surfaces the publication change. Next `healthCheck()` run flips dormant→active. **No SDK code change needed** — same probe + classification machinery. |
| **Breaking change in upstream major** | SDK major-bump for the dependency line, OR transitional SDK layer if feasible. SDK CHANGELOG names the upstream version delta. |

### 11.4 What consumers see

The SDK's `getValueReport()` always names the **observed upstream-package versions** it's running against. Consumers can compare to the SDK release's "verified" snapshot to know whether they're on a tested path. If observed differs from verified (consumer installed a newer upstream binding manually), the SDK's probe diagnostics still apply — they assert behavior, not version strings.

The SDK never *silently* degrades. Every degradation surfaces in `value-report.dormant[]` with a reason and an `enable` string (where applicable). Consumers wanting a CI gate against degradation use `sdk audit --strict` — which exits 1 on any sdk-integration-suggestion row, including the ones triggered by upstream regressions.

**Consumers can also run reprobe themselves**, independently of the SDK's per-archetype `healthCheck()`. `node tools/reprobe-bindings/reprobe.mjs` prints a Markdown table of all 38 monitored signals (per §11.6), exits 0 on no-drift, and 1 on any drift detected. Consumers wanting earlier-than-milestone-close drift detection can wire reprobe into their own CI — its output is paste-ready into a GitHub issue or scoping doc when drift fires.

### 11.5 What this policy explicitly does NOT do

- It does not promise to *fix* upstream defects. The SDK's role is to make them visible and to ship around them.
- It does not promise the SDK will track every upstream release the day it lands. Reprobe runs at milestone close; consumers wanting faster cadence run reprobe themselves.
- It does not promise SDK API stability across upstream majors. An upstream major may force an SDK major. The CHANGELOG is the canonical record of which upstream version delta drove each SDK major.

### 11.6 Upstream-tracking surface *(formalized M24, 2026-04-27)*

Reprobe v0.5 monitors **38 distinct upstream signals** across 3 probe categories. Every SDK release pins these as the verified snapshot per §11.2; drift on a re-run surfaces as a paste-ready Markdown block ready for inclusion in `docs/plans/m6-scope.md` or a new scoping doc.

#### Probe categories

| Category | Count | What it monitors | How it detects drift |
|---|--:|---|---|
| **NPM publication status** | 31 | Whether each tracked `@ruvector/*` package is `published`, `unpublished`, or `published-broken` (declares a `main` but ships only `package.json + README` — Issue #02 / #08 class) | `npm view <pkg> --json`; for `published-broken`, checks `dist.fileCount <= 2` |
| **CLI surface contracts** | 1 | Presence/absence of named flags + subcommands in `ruvllm --help` output (M11.3 v0.2) | regex match against captured help text |
| **Binding-method behavior** | 6 | Runtime defects in upstream bindings — Issues #01 / #03 / #06 / #09 / #10 / #11 (M22 + M23) | Subprocess-isolated probe scripts spawned via `node child_process.spawn`; SIGKILL-on-timeout for hung NAPI calls per Issue #11 |

#### Result types

Each probe entry resolves to one of:

| Glyph | Status | Meaning | Effect on exit code |
|---|---|---|---|
| `✓` | `expected` (or `expected-hang`) | Observed state matches the policy's expected state — bug still present, classification still correct, OR package still published as expected | Doesn't contribute to drift |
| `⚠` | `drift` | Observed state differs from expected — likely either upstream fixed something the SDK has classified dormant, or upstream regressed something previously working | **Sets exit code to 1**; produces a per-probe paste-ready drift block |
| `·` | `skipped` | Probe declined to run (e.g., binding-method probe needs a binding that's not on disk in this CI environment). Specifically signaled via probe exit code 64 | Doesn't contribute to drift OR to errors |
| `!` | `error` | Probe could not complete (spawn error, unexpected timeout, network failure for `npm view`) | Doesn't contribute to drift but reported separately; reprobe exit code is 1 if any errors occurred and no drift was detected |

#### Coverage map

The 11 paste-ready upstream issues at `docs/upstream-issues/` map to reprobe coverage as follows:

| # | Issue | Tracked via | Status |
|---|---|---|---|
| 01 | `@ruvector/graph-node` Cypher stub | binding-method probe | ✓ M22 |
| 02 | broken umbrella packages (`ruvector`, `@ruvector/sona`) | npm publication-status (`published-broken` heuristic) | n/a — different defect class for these specific packages; the `published-broken` infrastructure ratified at M17 covers Issue #08's siblings (`@ruvector/server`, `@ruvector/cluster`) |
| 03 | `@ruvector/core` VectorDb dimension singleton | binding-method probe | ✓ **M23** |
| 04 | sona MicroLora warmup | not single-subprocess-probeable (correctness/setup issue requiring stateful interaction) | unprobed |
| 05 | `@ruvector/ruvllm` no model-loading API | not single-subprocess-probeable (would require model-file fetch + correctness check) | unprobed |
| 06 | ruvllm wrapper case-rename mismatch | binding-method probe | ✓ **M23** |
| 07 | `@ruvector/rvagent-*` family unpublished | npm publication-status | ✓ M15.1 v0.3 |
| 08 | `@ruvector/server` + `@ruvector/cluster` broken-publish | npm publication-status (`published-broken`) | ✓ M17 |
| 09 | `@ruvector/graph-wasm` Cypher stub | binding-method probe | ✓ M22 |
| 10 | `@ruvector/ruvllm-wasm` no inference surface | binding-method probe | ✓ M22 |
| 11 | `@ruvector/router` delete deadlock | binding-method probe (SIGKILL-on-timeout) | ✓ M22 |

**6 of 11** issues have direct binding-method probes. **3 of 11** are covered by publication-status. **2 of 11** (#04, #05) are correctness/setup defects that don't lend themselves to single-script subprocess probes — the SDK's per-archetype `healthCheck()` tier-3 probes detect them at SDK consumer-run time, but reprobe can't.

#### Cadence

- **Required**: re-run reprobe at the close of every SDK milestone. The journal entry in `m6-scope.md` includes a "reprobe: 31/31 npm + 1/1 CLI + 6/6 binding-method probes match expected" line whenever it does (or names the drifted entries when it doesn't).
- **Recommended**: any consumer or CI integrating against `@ruvector/sdk` should run reprobe on a schedule (daily or weekly) AND on every SDK version bump. The script is dependency-free Node ESM and exits 0 / 1 cleanly — `npm test`-friendly.
- **Update protocol**: when drift fires, the next milestone's commit either updates the affected probe's `expect`/`expectStatus` (if the new state is a confirmed upstream fix) or files an upstream-issue if the new state is a regression.

#### Adding a new probe

The framework supports adding new entries cheaply:
- **NPM**: append to `PROBES` array with `{ pkg, expect, notes }`. Auto-runs.
- **CLI surface**: append to `CLI_PROBES` array with `{ bin, paths, expectAbsent, expectPresent, notes }`.
- **Binding-method**: drop a script at `tools/reprobe-bindings/probes/NN-name.mjs` (exit 0 = expected, 1 = drift, 64 = skipped); append to `BINDING_METHOD_PROBES` array with `{ name, issue, scriptPath, timeoutMs, timeoutIsExpected, notes }`. Subprocess isolation + SIGKILL-on-timeout handle hung NAPI calls automatically.

Per the M22/M23 milestones, ~30-50 LOC per new probe is the typical cost. The framework absorbs new probes well — each one adds one upstream signal to CI's monitoring surface.

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
