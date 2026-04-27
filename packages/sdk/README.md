# `@ruvector/sdk`

Task-first archetypes over upstream [`ruvector`](https://github.com/ruvnet/ruvector). Six headline archetypes (`KnowledgeBase`, `AgentMemory`, `GraphReasoner`, `TimeSeriesMemory`, `LocalLLM`, `AgentFramework`), three CLI subcommands (`recommend`, `doctor`, `audit`), and a self-describing value-report system that tells you exactly what's working and what's blocked.

The SDK's premise: developers reach for `VectorDB` and stop, missing 95% of upstream's unique capability. The fix is a TypeScript surface that names each capability, surfaces the dormant ones with their blockers, and ships the cross-archetype glue that makes "RAG with Graph relations + continual learning" a one-line wire-up instead of a research project.

Status: pre-1.0. The full headline-archetype frontier is implemented, the CLI is complete, but several upstream NAPI bindings the SDK names are not yet published — see [Known gaps](#known-gaps) for the honest list. Every gap is observable via `getValueReport()` and trackable via `tools/reprobe-bindings/reprobe.mjs`; the SDK's blocker-classification gives you a precise map of what's pending.

---

## Install

```bash
npm install @ruvector/sdk
```

Requires Node ≥ 18. The `sdk doctor` and `sdk audit` subcommands load TypeScript config files; for that workflow you need either Node 22.6+ (`--experimental-strip-types` available) or `npx tsx`. The SDK runtime itself runs on plain ESM/CJS with no TS-strip dependency.

### Cross-platform note (v0.1)

The SDK's TypeScript surface ships fully; **runtime support varies by archetype** because some upstream NAPI bindings are not yet published on npm:

| Archetype | Runtime today | Reason |
|---|---|---|
| `LocalLLM` | ✓ works on darwin-arm64; other platforms via `@ruvector/ruvllm-<platform>` as those publish | NAPI binding shipped per-platform |
| `GraphReasoner` | ✓ works on platforms where `@ruvector/graph-node` ships | NAPI binding shipped per-platform |
| `KnowledgeBase` / `TimeSeriesMemory` / `AgentMemory` | requires `RUVECTOR_CORE_BINDING` env var pointing at an in-repo prebuilt `ruvector.node` | `@ruvector/core` is not yet on npm (a publication gap distinct from the seven tracked upstream issues) |
| `AgentFramework` | ✓ works (pure-SDK orchestration; no binding needed) | — |

When `@ruvector/core` publishes its platform packages, the env-var workaround goes away. The SDK's `tools/reprobe-bindings/reprobe.mjs` tracks publication status and will tell you when this changes.

### Optional: install the CLI globally

```bash
npm install -g @ruvector/sdk
sdk --help
```

Or run via npx without a global install:

```bash
npx @ruvector/sdk recommend
```

---

## 30-second example

Build a knowledge base with vector recall + auto-embedding. Demonstrates the cross-archetype DI pattern (KB receives a `LocalLLM` instance as its embedder; ingest accepts text-only documents).

```ts
import { KnowledgeBase, LocalLLM } from '@ruvector/sdk';

// 1. Create an LLM once (used as the embedder for KB).
const llm = await LocalLLM.create();

// 2. Create a KnowledgeBase wired to the LLM. dimensions must match
//    the embedder's output (768 for the published @ruvector/ruvllm).
const kb = await KnowledgeBase.create({
  dimensions: llm.embedDimensions,
  embedder: llm,
  // v0.1 only: explicit binding path until @ruvector/core publishes per-platform.
  bindingPath: process.env.RUVECTOR_CORE_BINDING,
});

// 3. Ingest text-only documents — KB derives embeddings via llm.embed() automatically.
await kb.ingest([
  { id: 'd1', text: 'Auth flow uses OAuth 2.1 with PKCE; tokens expire in 1h.' },
  { id: 'd2', text: 'Crypto module rotates keys nightly via the kms-rotate cron.' },
  { id: 'd3', text: 'Database schema migrations run via alembic in CI before deploy.' },
]);

// 4. Retrieve with a string query — same auto-embed path.
const result = await kb.retrieve('how do tokens get rotated?', { k: 2 });

console.log(result.citations);
// → [{ documentId: 'd1', score: 0.142, source: 'vector' },
//    { documentId: 'd2', score: 0.183, source: 'vector' }]

// 5. .explain() tells you exactly what ran:
console.log(result.explain.path);
// → ['vectorSearch']
console.log(result.explain.totalLatencyMs);
// → 4.2

// 6. getValueReport() tells you what's active and what's not:
await kb.healthCheck();  // populate observation cache
const report = await kb.getValueReport();
console.log(report.summary);
// → '5 of 10 unique capabilities active. 5 dormant (3 upstream-binding, 2 sdk-integration) — mixed (...).'
for (const d of report.dormant) {
  console.log(`  ⚠ [${d.blocker}] ${d.name} — ${d.enable}`);
}
// → ⚠ [upstream-binding] hybridSearch — Track @ruvector/core publishing of the hybrid surface...
// → ⚠ [sdk-integration ] graphRag     — await KnowledgeBase.create({ ..., graphReasoner: await GraphReasoner.create({ dimensions }) })
// → ⚠ [sdk-integration ] sona         — await KnowledgeBase.create({ ..., sona: true })
// → ...etc

await kb.close();
await llm.close();
```

That's the SDK's headline pattern: **task-first construction (`KnowledgeBase`, not `VectorDB`), cross-archetype DI (`embedder: llm`), self-describing health (`getValueReport`)**. Each archetype follows the same shape.

For the other 5 archetypes, see their respective demos in `packages/sdk/examples/`:

```
graph-reasoner-demo/    multi-hop graph queries via @ruvector/graph-node
time-series-memory-demo/ ms-keyed vector recall + changepoint detection
local-llm-demo/         embed + similarity (Phase 2A wires query/route/generate)
auto-embed-demo/        cross-archetype embedder propagation in 3 archetypes
agent-memory-demo/      per-agent memory + SONA continual learning
agent-framework-demo/   orchestration over the 5 other archetypes
```

---

## CLI

Three subcommands cover the full workflow from "what should I build?" through "is my config doing the right thing?".

### `sdk recommend` — generate a `ruvector.config.ts`

Interactive prompt asks 5 questions about your workload, then writes a typed config file with the right archetypes wired:

```bash
npx @ruvector/sdk recommend
```

Or run it non-interactively for CI / repo bootstrappers:

```bash
sdk recommend \
  --workload rag-over-docs \
  --data-size 1k-100k \
  --latency '<50ms' \
  --updates daily-batch \
  --generate no \
  --out ./ruvector.config.ts
```

Output names what was recommended AND what was skipped (with the dormant blocker reason verbatim from the catalog), so you know exactly what's active vs waiting:

```
→ Recommended: LocalLLM + GraphReasoner + KnowledgeBase
    coupled: KnowledgeBase ← { LocalLLM, GraphReasoner }
→ Skip:
    KnowledgeBase.colbertRerank  [upstream-binding] ColBERT not exposed in NAPI
    GraphReasoner.cypher  [upstream-bug] Issue #01 stub
    LocalLLM.generate  [upstream-bug] Issue #05 — no model_path config
→ Generated: ./ruvector.config.ts
```

### `sdk doctor` — introspect a running config

Loads your config, runs every archetype's `healthCheck()`, aggregates the results, surfaces actionable suggestions extracted from dormant `[sdk-integration]` rows:

```bash
sdk doctor ./ruvector.config.ts
```

Sample output:

```
Aggregate value report (3 archetypes):
  31 unique capabilities total: 13 active, 18 dormant.
  Dormant breakdown: 10 upstream-binding, 4 upstream-bug, 1 sdk-integration, 3 design-deferred.

Suggestions (1):
  • [KnowledgeBase.sona] await KnowledgeBase.create({ ..., sona: true })
```

### `sdk audit` — compare a config against best-practice for its workload

Reads `_meta.workload` from a recommend-generated config, compares the wired archetypes + couplings against the workloads-table template, reports drift:

```bash
sdk audit ./ruvector.config.ts
```

Three drift kinds: `missing-archetype`, `extra-archetype`, `missing-coupling`. Plus advisory `sdk-integration-suggestion` rows. Exit code is 1 on blocking drifts (CI-gateable), 0 on clean / advisory-only.

---

## The six archetypes

Each archetype is a coherent task-first surface over a subset of upstream's capabilities. All six follow the same shape: `static create(options)` constructor, optional cross-archetype DI fields, `healthCheck()` that exposes the live state, `getValueReport()` that classifies dormant capabilities into 4 blocker categories.

| Archetype | Task | Default-active capabilities |
|---|---|---|
| `KnowledgeBase` | RAG over documents | vector search, ingest, optional Graph RAG, optional SONA continual learning |
| `AgentMemory` | Per-agent state with continual learning | vector recall, agent-scoping, optional SONA, optional graph-relations, optional hyperbolic distance |
| `GraphReasoner` | Multi-hop graph queries | k-hop traversal, hyperedge search, graph stats |
| `TimeSeriesMemory` | Sequential / streaming retrieval | timestamp-keyed recall, changepoint detection (SDK-source) |
| `LocalLLM` | Run an LLM locally | embed (768d, unit-normalized), similarity, query, route |
| `AgentFramework` | Orchestrate the others | task lifecycle, tool dispatch, sub-agent recursion, subset policy enforcement |

All archetypes accept an optional `embedder: LocalLLM` for auto-embedding text inputs (M11.2 pattern). KB / AgentMemory accept an optional `graphReasoner` for relation-aware context. AgentFramework accepts all 4 of `{ llm, kb, memory, graph }` as DI dependencies for orchestration. The full DI graph is documented in each archetype's source comment.

---

## Known gaps

The SDK's premise is that gaps should be observable, not hidden. Seven upstream issues are tracked at [`docs/upstream-issues/`](../../docs/upstream-issues/) — each with a paste-ready bug report, a runtime reproducer, and the SDK's diagnostic that will detect when the issue is resolved upstream:

| # | Defect | Affected archetype |
|---|---|---|
| [01](../../docs/upstream-issues/01-graph-node-cypher-stub.md) | `@ruvector/graph-node` `query()` always returns empty (Cypher engine stub) | `GraphReasoner.cypher` |
| [02](../../docs/upstream-issues/02-broken-umbrella-packages.md) | Three umbrella packages publish without their `main`-referenced files | runtime install errors |
| [03](../../docs/upstream-issues/03-core-vectordb-construction-quirks.md) | `@ruvector/core` `VectorDb` shared state, dimension singleton, default-disk-storage | `KnowledgeBase` / `TimeSeriesMemory` / `AgentMemory` |
| [04](../../docs/upstream-issues/04-sona-microlora-warmup.md) | `SonaEngine.applyMicroLora` returns zero vector before any training | KB SONA wiring |
| [05](../../docs/upstream-issues/05-no-model-loading-api.md) | `@ruvector/ruvllm` NAPI has no `model_path` config; default model produces gibberish | `LocalLLM.generate` |
| [06](../../docs/upstream-issues/06-query-route-under-populated-fields.md) | `RuvLLM.query/route` JS wrapper drops 3-of-6 / 2-of-5 fields via case-rename mismatch | `LocalLLM.query` / `LocalLLM.route` |
| [07](../../docs/upstream-issues/07-rvagent-family-unpublished.md) | `@ruvector/rvagent-*` family (9 packages) entirely unpublished | `AgentFramework.{a2a,acp,mcp}` |

When upstream fixes any of these, the SDK's diagnostic infrastructure will surface the change automatically:

- **Tier-1 binding probes** flip from `broken` → `ok` on the next `healthCheck()`.
- **Catalog rows** flip from dormant → active without any SDK code change (the M6.2 / M11.3 self-correcting-classification pattern).
- **`reprobe.mjs`** detects npm publication changes (M11.3) AND CLI-flag changes (M11.3 v0.2 / M12.3) on the next run.

The SDK is designed so that "what's pending upstream" is one `getValueReport()` call away. No hidden state.

### Capabilities deliberately deferred (not upstream issues)

- `LocalLLM.streaming` — upstream `StreamingGenerator` simulates streaming by chunking the full response. Real native streaming is a Phase-2C work item.
- `AgentFramework.toolCallParsing` — LLM-driven tool-call parsing depends on a real model (Issue #05); deferred until #05 lands.
- `AgentFramework` MCP integration via the public `@modelcontextprotocol/sdk` — Phase-1B candidate, not yet shipped (M14 §6 Q1 ratification pending).

---

## Self-describing roadmap

The SDK doesn't need a separate roadmap document because every gap is queryable at runtime:

```ts
const report = await kb.getValueReport();
report.summary;       // "7 of 10 capabilities active. 3 dormant — mixed."
report.healthSource;  // 'observed' | 'declared' | 'mixed'
for (const d of report.dormant) {
  d.blocker;          // 'upstream-binding' | 'upstream-bug' | 'sdk-integration' | 'design-deferred'
  d.reason;           // why it's dormant (probe diagnostic or declared text)
  d.expectedLift;     // what activating it would buy you
  d.enable;           // copy-pasteable code to wire it (when sdk-integration)
}
```

Four blocker categories quoted across seven user-facing layers (per the M9.1 → M15.3 milestone sequence): demos, upstream-issue authoring, SDK probe diagnostics, CLI doctor surfacing, CLI doctor suggestions, CLI recommend Skips, CLI audit drift categories. One classification investment, seven payoffs.

Re-run drift detection at any time:

```bash
node tools/reprobe-bindings/reprobe.mjs
```

Tracks 22 npm packages + 1 CLI binary. Exit code 1 if any tracked package's publication status drifts from the last ratified scoping doc.

---

## Architecture

The SDK rests on five reinforcing patterns documented in the [PRD](../../docs/plans/ruvector-sdk-prd.md):

1. **Task-first archetypes** as the headline API surface (developers choose `KnowledgeBase`, not `VectorDB`).
2. **Inverted opt-in** — unique capabilities are on by default; generic mode requires explicit detour.
3. **`.explain()` on every result** — every operation returns a trace of which capabilities contributed.
4. **`getValueReport()`** detects dormant capabilities and recommends activation steps.
5. **`recommend` / `doctor` / `audit` CLI** maps developer-stated workloads to a generated config and validates the result.

Cross-archetype dependency injection: each archetype accepts optional refs to other archetypes via constructor options (`embedder: LocalLLM`, `graphReasoner: GraphReasoner`, `sona: SonaConfig`, `llm: LocalLLM` for AgentFramework). The user owns lifecycle; the SDK owns the wiring.

Two SDK-source capabilities (the SDK ships value before upstream is ready):

- `TimeSeriesMemory.detectChangepoints` — sliding-window mean-shift detector over an in-memory ring buffer.
- `AgentMemory.hyperbolic` — Poincaré-ball distance scorer for hierarchical-recall workloads.

Both surface as `source: '@ruvector/sdk'` in their value reports — distinguishable from upstream-bound capabilities.

---

## Examples

The `examples/` directory has runnable demos for every archetype + the cross-archetype patterns:

```
examples/
├── graph-reasoner-demo/run.mjs
├── knowledge-base-demo/run.mjs
├── time-series-memory-demo/run.mjs
├── local-llm-demo/run.mjs
├── auto-embed-demo/run.mjs               # M11.2 cross-archetype embedder
├── agent-memory-demo/run.mjs
├── agent-framework-demo/run.mjs
├── sample-config.ts                      # what `sdk doctor` points at
├── recommend-demo.sh                     # interactive + non-interactive recommend
├── recommend-drift-probe.mjs             # asserts workloads table consistency
├── audit-demo.sh                         # clean + drift cases
└── audit-test-incomplete-config.ts       # deliberately incomplete config
```

Run any of them:

```bash
RUVECTOR_CORE_BINDING="$(pwd)/../../ruvector/npm/core/platforms/darwin-arm64/ruvector.node" \
  node packages/sdk/examples/knowledge-base-demo/run.mjs
```

---

## Project history

The SDK was built milestone-by-milestone with a running journal at [`docs/plans/m6-scope.md`](../../docs/plans/m6-scope.md). Newest entries are at the top. Five scoping docs in [`docs/plans/`](../../docs/plans/) capture the design discussions for the larger milestones (M11 LocalLLM, M12 LocalLLM Phase 2, M13 AgentMemory, M14 AgentFramework, M15 CLI).

A few patterns surfaced repeatedly across milestones and are worth knowing about as a consumer:

- **Re-probe before trusting earlier docs.** M11 found that an earlier scoping claim ("`@ruvector/ruvllm` has no NAPI binding") was already false at the time it was written. M11.3 codified this as `tools/reprobe-bindings/reprobe.mjs`. M12.2 generalized it to CLI surface contracts (the `ruvllm` CLI's `--help` is now tracked); M11.3 v0.2 ships that extension.
- **Trust observed status over declared status.** Catalog rows declare a default `active`/`dormant`; tier-1 binding probes and tier-3 archetype probes override the declared status with what the live binding does. When upstream fixes a stub, the SDK reclassifies automatically.
- **The diagnostic infrastructure doubles as bug-report-evidence infrastructure.** Seven upstream issues were authored by lifting probe diagnostics verbatim into the issue body; no rewriting cost.

---

## License

MIT (matching upstream `ruvector`).

## Contributing

The SDK is the consumer-side companion to upstream `ruvector`. SDK-side issues belong here; upstream NAPI / Rust crate issues belong at [github.com/ruvnet/ruvector](https://github.com/ruvnet/ruvector). The SDK's [`docs/upstream-issues/`](../../docs/upstream-issues/) folder has paste-ready reports for the seven defects the SDK has surfaced — pull the body verbatim into a new upstream issue.
