# M15 — `recommend` / `doctor` CLI Scoping Report

| Field | Value |
|---|---|
| Status | Scoping (no implementation yet) |
| Date | 2026-04-27 |
| Decision needed from user | Open Questions §6 below |
| Predecessors | PRD §5.5; M11→M14 scoping pattern; M14.1 closed the archetype frontier |

This is a scoping pass, not a ship-task. With 6 of 6 archetypes shipped (M14.1), the SDK's center of gravity shifts from *what to build* to *how developers find what's there*. The `recommend` / `doctor` / `audit` CLI per PRD §5.5 is the user-facing answer.

Apply M11→M14 lessons: re-probe before trusting earlier docs (done — 0 drift); identify what's buildable today over already-shipped infrastructure (this whole milestone is pure SDK; no upstream dependencies); end with ratifyable open questions.

---

## TL;DR

1. **Re-probe (M11.3 v0.2)**: 0 drift. 13/13 npm + 1/1 CLI match expected. Same as M14.1.

2. **PRD §5.5 specifies three subcommands** — `recommend` (interactive prompt → generated config), `doctor` (introspect a running SDK and report degradations), `audit` (compare a config against best-practice for its archetype). The PRD example shows `KnowledgeBase + DiskANN + ColBERT + Graph RAG` as a sample recommendation — but **DiskANN and ColBERT are still upstream-binding-blocked** per the live reprobe. Phase-1 must recommend only what's actually shippable (and surface the dormant capabilities with the same M9.1 honesty the SDK already practices).

3. **All three subcommands are pure-SDK code with zero upstream dependencies.** `recommend` is a workload→config mapping table + a prompts library. `doctor` consumes existing `healthCheck()` + `getValueReport()` output from a running config. `audit` compares a static config against an in-memory best-practice template.

4. **Six canonical workloads map cleanly to the six archetypes**:
   - `rag-over-docs` → KnowledgeBase (+ optional GraphReasoner for Graph RAG, + LocalLLM for ask())
   - `agent-memory` → AgentMemory (+ optional SONA, + optional GraphReasoner for memory-relations)
   - `graph-reasoning` → GraphReasoner (+ optional KB for hybrid context)
   - `time-series-anomaly` → TimeSeriesMemory (+ changepoint detection)
   - `local-llm-inference` → LocalLLM (Phase 2A — gibberish today; document Issue #05)
   - `agent-orchestration` → AgentFramework (+ all 5 archetypes as optional DI)

5. **`doctor` is the highest-leverage subcommand** — it requires no new SDK code, just a thin CLI wrapper over `archetype.healthCheck()` and `archetype.getValueReport()` that the SDK already produces. Ships first.

6. **Recommendation**: ship Phase-1 as **doctor + recommend (interactive); audit deferred to Phase-2**. `doctor` is mostly already built (the SDK has all the data); `recommend` needs the workload→config mapping table; `audit` is the most subjective ("best-practice for its archetype" requires editorial calls beyond what the catalog encodes today).

---

## What I verified live

### Re-probe (M11.3 v0.2, 2026-04-27)

```
13/13 npm + 1/1 CLI match expected. exit=0
```

### PRD §5.5 verbatim

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

> The CLI also has `doctor` (introspect a running SDK and report degradations) and `audit` (compare a config against best-practice for its archetype).

The example's "Recommended: ... DiskANN ... ColBERT" is **aspirational**: per the live reprobe, `@ruvector/diskann-node` is unpublished and ColBERT is not exposed in `@ruvector/core`'s NAPI surface. Phase-1's `recommend` must distinguish what's *available* from what's *advertised in the PRD example*. Same M11.3 lesson: trust live state, not earlier prose.

### What the SDK already produces — `doctor`'s raw material

Every archetype's `healthCheck()` returns a `HealthCheckResult`:

```ts
{
  archetype: 'KnowledgeBase',
  backend: 'native',
  generatedAt: '2026-04-27T...',
  summary: 'KnowledgeBase/native: 8 ok, 1 unsupported (24.32ms)',
  statusCounts: { ok: 8, broken: 0, unsupported: 1, error: 0 },
  checks: [/* per-probe { name, status, detail, durationMs, tier } */],
}
```

And `getValueReport()` returns:

```ts
{
  active: [{ name, source, invocations, adrs }],
  dormant: [{ name, source, reason, expectedLift, enable, blocker, adrs }],
  summary: '8 of 12 active. 4 dormant (3 upstream-binding, 1 sdk-integration) — mixed (...)',
  healthSource: 'observed',
}
```

`doctor` is mostly a presentation layer: load a config, instantiate each archetype, await both methods, format the output. No new SDK introspection needed.

---

## Surface decisions

### Three subcommands

```
$ npx @ruvector/sdk recommend                  # interactive; emits ruvector.config.ts
$ npx @ruvector/sdk recommend --workload rag-over-docs --json   # non-interactive
$ npx @ruvector/sdk doctor [path/to/config]     # loads config; runs healthCheck on each archetype
$ npx @ruvector/sdk audit [path/to/config]      # compares config to best-practice template
```

### `recommend` flow (interactive)

1. Question 1: "What are you building?" → enum from the 6 canonical workloads, plus a free-form fallback.
2. Question 2: "How much data?" → `<1k`, `1k-100k`, `100k-1M`, `1M+` (the upper buckets unlock dormant `[upstream-binding]` recommendations like DiskANN once published).
3. Question 3: "Latency target p95?" → `<10ms`, `<50ms`, `<200ms`, `>200ms` (drives default backend choice).
4. Question 4: "Update pattern?" → `mostly-read`, `daily-batch`, `streaming`, `bursty` (drives whether to recommend KB-only vs KB+TSM hybrid, etc.).
5. Question 5: "Need text generation?" → yes/no (gates LocalLLM inclusion).

Output:

- Console: `Recommended: <archetypes>; Skip: <reasons>` per the PRD example.
- File: `ruvector.config.ts` with the actual SDK construction code.

### `ruvector.config.ts` shape

```ts
import { KnowledgeBase, GraphReasoner, LocalLLM } from '@ruvector/sdk';

export async function createSdk() {
  const llm = await LocalLLM.create();
  const graph = await GraphReasoner.create({ dimensions: llm.embedDimensions });
  const kb = await KnowledgeBase.create({
    dimensions: llm.embedDimensions,
    embedder: llm,
    graphReasoner: graph,
    sona: true,
  });
  return { llm, graph, kb };
}

export const _meta = {
  generatedBy: '@ruvector/sdk recommend',
  workload: 'rag-over-docs',
  generatedAt: '2026-04-27T...',
  rationale: '...one-paragraph why-each-piece...',
};
```

The `_meta` field lets `audit` later compare against the best-practice template for the same workload — even after the user edits the constructor args.

### `doctor` output

Effectively the demo output the SDK already produces, but loaded from the user's config rather than a hand-rolled demo. Wraps each archetype:

```
$ npx @ruvector/sdk doctor ruvector.config.ts
Loading config (workload=rag-over-docs)...
✓ LocalLLM:    3 ok, 3 broken (1.5s)        — see upstream-issues/05 for the 3 broken
✓ KnowledgeBase: 8 ok, 1 unsupported (25ms)
✓ GraphReasoner: 6 ok, 1 broken, 1 unsupported (1ms) — cypher upstream-bug per #01
Value report (combined):
  17 of 30 unique capabilities active across 3 archetypes.
  Dormant: 4 upstream-binding, 1 upstream-bug, 1 sdk-integration.
Suggestions:
  - autoEmbed already wired ✓
  - Issue #01 fix would activate cypher
  - Issue #05 fix would activate generate / query / route
```

---

## What's buildable Phase-1 (no upstream dependencies)

The whole CLI is pure-SDK orchestration over the 6 shipped archetypes. Three new modules:

- `packages/sdk/src/cli/recommend.ts` — interactive flow + workload→config mapper.
- `packages/sdk/src/cli/doctor.ts` — config loader + healthCheck/getValueReport renderer.
- `packages/sdk/src/cli/audit.ts` — best-practice template comparator (Phase-2 candidate).
- `packages/sdk/src/cli/workloads.ts` — the 6-workload mapping table (data only).
- `packages/sdk/bin/sdk.js` — dispatcher entry point exposed via `package.json#bin`.

External dependency: an interactive prompt library. Either `@inquirer/prompts` (the modern Inquirer.js successor; widely adopted) or hand-rolled with `node:readline`. Latter is dependency-free; fits the project's "dependency-free where possible" pattern (cf. `tools/extract-adrs/extract-adrs.mjs`, `tools/inventory/inventory.mjs`, `tools/reprobe-bindings/reprobe.mjs`).

I lean **dependency-free `node:readline`** to keep the SDK install footprint small. Q1 ratifies.

---

## Six canonical workloads → archetype-config mapping

| Workload key | Headline question | Recommends | Skips (with reason) |
|---|---|---|---|
| `rag-over-docs` | "RAG over technical documentation" | KB + LLM (+ Graph RAG if data > 1k docs) | DiskANN (`upstream-binding`); ColBERT (`upstream-binding`); Matryoshka (`upstream-binding`) |
| `agent-memory` | "Long-term agent memory" | AgentMemory + SONA (+ GraphReasoner for relations) | gnnLearning (`upstream-binding`); mambaRecall (`upstream-binding`); domainExpansion (`upstream-binding`) |
| `graph-reasoning` | "Multi-hop graph queries" | GraphReasoner (+ KB for hybrid context) | cypher (`upstream-bug` per Issue #01); Leiden (`upstream-binding`); pageRank (`upstream-binding`) |
| `time-series-anomaly` | "Sequential / streaming retrieval" | TimeSeriesMemory + changepoint | Mamba SSM (`upstream-binding`); deltaIndexing (`upstream-binding`); causalLayers (`upstream-binding`) |
| `local-llm-inference` | "Run an LLM locally" | LocalLLM (Phase 2A) | generate quality (`upstream-bug` per Issue #05); streaming (`design-deferred`); turboQuant (`upstream-binding`) |
| `agent-orchestration` | "Build an AI agent" | AgentFramework + LLM + AgentMemory + KB | A2A / ACP / MCP (`upstream-binding`); LLM-driven tool-call (`upstream-bug` per Issue #05) |

The "Skips" column quotes the SDK's own dormant-classification verbatim. **The recommend output is auditable from the catalog itself** — no editorial freelancing.

### Headline implication

The recommend CLI's output telegraphs the SDK's value-report honesty: every recommendation comes with a clear list of "what we DIDN'T recommend, and why." Same self-describing-roadmap property the SDK already has, surfaced earlier in the developer's journey.

---

## Phased v0.1 plan

**Phase 1A — `doctor` first** (~half-session)

Load a `ruvector.config.ts`, call its `createSdk()`, await `healthCheck()` + `getValueReport()` on each returned archetype, format the output. No new SDK introspection needed; the data is already there. Ships first because it has the highest user value (a single command shows "what's working in your config") and the lowest risk (no design choices to lock in).

**Phase 1B — `recommend` interactive** (~full session)

5-question prompt flow + workload→config mapping table + `ruvector.config.ts` codegen. Lifts the workloads table verbatim from §4 above. The codegen is template-string concatenation; the rationale paragraph is per-workload static text.

**Phase 1C — `audit`** (Phase-2 candidate; deferred)

Compare a user's config against the best-practice template for its `_meta.workload`. The hard part is editorial: "best-practice" requires opinionation that the catalog doesn't encode today. Defer until Phase-1A and 1B settle and real users surface the audit gap.

---

## How `doctor` consumes the existing infrastructure

The SDK already produces every input `doctor` needs. Concretely:

- `healthCheck()` returns probe results with `name`, `status`, `detail`, `tier`. `doctor` formats the rows.
- `getValueReport()` returns `active`, `dormant` arrays with `blocker` classification (M9.1 four-category model). `doctor` formats the rows AND aggregates across archetypes (e.g., total active across all wired archetypes).
- The dormant entries already include `enable` strings (M11.2/M13.1 pattern) — `doctor` surfaces these as "Suggestions" in its output verbatim.
- Cross-issue links (e.g., `[upstream-bug] cypher — see upstream-issues/01`) are already in the dormant text — `doctor` doesn't add this; it inherits.

**`doctor` is a thin presentation layer; ~80-100 LOC.** Same level of SDK-side glue as `tools/reprobe-bindings/reprobe.mjs`, but for a different layer.

---

## 6. Open Questions for the user

These ratify the M15.x sequencing. Each names my lean.

1. **Prompt library — dependency-free `node:readline` or `@inquirer/prompts`?** Inquirer is more polished (validation, multi-select, autocomplete) but adds a runtime dependency. `node:readline` is dependency-free and matches the project's tooling pattern.
   I lean **`node:readline`** for Phase-1 to keep install footprint small. v0.2 can swap to Inquirer if user feedback flags rough edges.

2. **`ruvector.config.ts` shape — generated TypeScript module exporting `createSdk()` (above), or generated JSON?** TS lets `doctor` `import()` it directly with type checking; JSON is simpler but loses the typed createSdk return.
   I lean **TS module**. The SDK is TypeScript-first; emitting TS keeps the user's project type-checked end-to-end.

3. **Workload→archetype mapping — encode in `cli/workloads.ts` (data-only), OR derive at runtime from each archetype's `getValueReport().active` defaults?** The latter avoids drift between recommend output and live capability state; the former is auditable in source.
   I lean **data-only** for Phase-1. Drift is caught by a unit test that asserts the table matches the live catalog. Runtime derivation adds complexity for the same outcome.

4. **`doctor` config-loading mechanism — `import()` the user's TS config (requires Node ESM TS support OR a build step), OR shell out to `tsx`/`ts-node`?** ESM-native TS imports require Node 22+ with `--experimental-strip-types`. `tsx`/`ts-node` is a runtime dep but more universal.
   I lean **`import()` with a `tsx` fallback**. The fallback adds a deferred error message that explains how to install tsx if the user's Node doesn't support TS-strip.

5. **Issue #07 (rvagent-* unpublication) — author standalone or fold into M14 scoping doc?** The pattern from #05/#06 has been "one upstream defect, one issue file." rvagent-* is 9 packages but one defect (an entire family unpublished); fits the pattern.
   I lean **standalone Issue #07**. ~30 minutes of writing; lifts the M14 scoping evidence directly.

---

## Findings worth surfacing regardless of M15 path

- **`doctor` lights up the M9.1 four-blocker classification at the user-facing layer.** Every dormant row's `blocker` (`upstream-binding` / `upstream-bug` / `sdk-integration` / `design-deferred`) gets surfaced in the doctor output. The classification work paid for itself on three layers now: dormant lists in demos (M9.1), upstream-issue authoring (M10.2 / M12.1 / M12.4), CLI surfacing (M15).

- **The PRD's recommend example mentions DiskANN + ColBERT** — neither shippable per current reprobe. The recommend CLI's first job is to be honest about what's available today without relitigating the PRD. Phase-1 explicitly says "ColBERT (upstream-binding)" in the Skips column rather than recommending it as the PRD example does.

- **The catalog now has six archetype-specific dormant lists**; combined they total 34 dormant entries (per M14.1). The recommend CLI won't recommend any of them as default-on; doctor lists them with their blockers. Worth tracking as the SDK's "what's still pending" census.

- **A `--non-interactive` mode of `recommend`** (`--workload rag-over-docs --data-size 100k --latency 50 --updates batch --generate yes`) maps cleanly to programmatic use cases (CI templates, repo bootstrappers like `npx create-ruvector-app`). Worth designing in Phase-1B alongside the interactive flow; same internal mapper for both paths.

- **Issue #07 evidence is already captured** in `m14-scope.md`'s reprobe table (0 of 9 named, 0 of 12 across alternatives). Authoring as a standalone issue is mostly a copy-out exercise — same M10.2 pattern that authored 4 issues at once.

---

*End of M15 scoping. Next ship-task: ratify §6 open questions with user → M15.1 (Phase-1A `doctor`) + Issue #07 as a parallel quick win.*
