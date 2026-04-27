# M13 — AgentMemory Scoping Report

| Field | Value |
|---|---|
| Status | Scoping (no implementation yet) |
| Date | 2026-04-27 |
| Decision needed from user | Open Questions §6 below |
| Predecessors | `m11-scope.md` (LocalLLM scoping pattern), `m12-scope.md` (transport-options pattern), `m6-scope.md` running journal (M9/M10/M11.2 cross-archetype patterns) |

This is a scoping pass, not a ship-task. Goal: figure out the realistic shape of AgentMemory before any implementation. AgentMemory has been deferred since M4 ratification because its headline differentiator (`gnnLearning` via `@ruvector/gnn-node`) is not on npm.

The scoping pass applies the M11→M12 lessons up front — re-probe before trusting earlier docs; live-probe binding internals; defer cleanly when upstream isn't ready; surface cross-archetype boundaries that earlier milestones flagged.

---

## TL;DR

1. **Re-probe via `tools/reprobe-bindings/reprobe.mjs` (M11.3 v0.2)**: 0 drift. `@ruvector/gnn-node`, `@ruvector/attention-node`, `@ruvector/domain-expansion(-node)` all remain unpublished — same as last 3 reprobes. Of AgentMemory's 5 named member crates, **only 2 have published NAPI bindings** (`@ruvector/sona` and `@ruvector/graph-node`); `@ruvector/core` (in-repo) provides basic vector recall.

2. **AgentMemory's headline `gnnLearning` capability is blocked.** Same shape as M11's pre-Phase-1 LocalLLM (the differentiator gated on a binding upstream hasn't shipped). Mamba-recall and domain-expansion equally blocked.

3. **What CAN ship Phase-1**: a SONA-warmed memory layer over `@ruvector/core` for vector recall, plus optional cross-archetype coupling to a `GraphReasoner` for memory-relations (same M9 pattern KB uses today). 4 of 6 capability flags from the M5 surface flip to active; 3 stay dormant `[upstream-binding]`; `hyperbolic` stays dormant `[sdk-integration]` until either upstream publishes or the SDK ships a hand-rolled hyperbolic-distance scorer.

4. **Live finding worth surfacing**: `RuvLLM` (LocalLLM's NAPI binding) already exposes `addMemory(content, metadata)` and `searchMemory(text, k)` returning `{id, score, content, metadata}` — almost the exact shape AgentMemory's `recall()` needs. This is what M11.1 design-deferred called "the localMemory boundary." M13 must pick whether AgentMemory is a thin wrapper over `RuvLLM`'s memory layer, an independent backend, or a hybrid.

5. **Two cross-archetype questions deferred from earlier milestones come due here**:
   - **shared-SONA** (M12 §6 Q5): does AgentMemory share KB's SONA instance, or run its own? If shared, one engine learns from query-relevance + memory-importance signals together — opaque interaction effects but coherent. If separate, two engines can drift apart.
   - **localMemory boundary** (M11.1 design-deferred): see §3 above.

6. **Recommendation**: ship M13.1 as **Phase 1A** — sona + core only, with optional `graphReasoner` coupling. Defer the LocalLLM-localMemory delegation question to Phase 1B and the GNN to whenever `@ruvector/gnn-node` ships (caught by reprobe.mjs).

---

## What I verified live

### Re-probe (M11.3 v0.2, 2026-04-27)

```
13/13 npm + 1/1 CLI match expected.
```

All 13 tracked npm packages match the last ratification; the `ruvllm` CLI's `expectAbsent` (no `--model`, no `serve`) and `expectPresent` (query/generate/route/models/embed/similarity) both still hold. No drift on AgentMemory-relevant bindings; no surprise discovery of a newly-published gnn-node.

### AgentMemory's named bindings — publication status

Per `npm view <pkg> version`:

| Binding (per M4 ratification) | npm name | Status |
|---|---|---|
| `ruvector-gnn` | `@ruvector/gnn-node` | **unpublished** (still — M11/M11.3/M11.3v0.2 all confirm) |
| `sona` | `@ruvector/sona` | published 0.1.6 |
| `ruvector-attention` (Mamba) | `@ruvector/attention-node` | **unpublished** |
| `ruvector-graph` | `@ruvector/graph-node` | published 2.0.3 (used by GraphReasoner) |
| `ruvector-domain-expansion` | `@ruvector/domain-expansion(-node)` | **unpublished** (both name variants checked) |

2 of 5 published. Same pattern as M11's pre-Phase-1 LocalLLM situation, where most-named bindings were unpublished and only the umbrella was reachable.

### M5-frozen AgentMemory surface (`packages/sdk/src/archetypes/AgentMemory.ts`)

- `static create(options): Promise<AgentMemory>` — throws.
- `remember(record: MemoryRecord): Promise<{ id: string }>` — throws.
- `recall(context: string, options?: RecallOptions): Promise<RecallResult>` — throws.
- `forget(id: string): Promise<boolean>` — throws.
- `recordFeedback(queryId, signal): Promise<void>` — throws.
- `getValueReport()` / `introspect()` / `close()` — throws.

`MemoryRecord` already takes `text` (string), `tags`, `metadata`, `importance`, `timestampMs` — **no embedding field**. Same M5 ergonomics as M11.2's KnowledgeBase: text-first, embedder-derived. M13 should align with M11.2's pattern: optional `embedder: LocalLLM` at create-time; pre-computed Float32Array fast path via a sibling `rememberEmbedded(record & {embedding})` or by accepting `Float32Array | string` on the existing API.

`AgentMemoryCapabilityConfig` has 6 flags: `gnnLearning`, `sona`, `ewc`, `hyperbolic`, `mambaRecall`, `domainExpansion`. After publication-status check:

| Flag | Status given current bindings |
|---|---|
| `gnnLearning` | dormant `[upstream-binding]` — gated on `@ruvector/gnn-node` |
| `sona` | active when wired (same M10 pattern) |
| `ewc` | active when wired — sona binding exposes EWC++ via `withConfig({ ewcLambda })` |
| `hyperbolic` | dormant — needs either `@ruvector/hyperbolic-hnsw` (excluded from default workspace per PRD §A) OR an SDK-side hyperbolic-distance scorer |
| `mambaRecall` | dormant `[upstream-binding]` — gated on `@ruvector/attention-node` |
| `domainExpansion` | dormant `[upstream-binding]` — gated on `@ruvector/domain-expansion(-node)` |

### `RuvLLM`'s memory surface (live, from `node_modules/@ruvector/ruvllm/dist/cjs/engine.js`)

```js
searchMemory(text, k = 10) {
  if (this.native) {
    const results = this.native.searchMemory(text, k);
    return results.map(r => ({
      id: r.id,
      score: r.score,
      content: r.content,
      metadata: JSON.parse(r.metadata || '{}'),
    }));
  }
  // ... fallback path
}

addMemory(content, metadata) {
  if (this.native) {
    return this.native.addMemory(content, metadata ? JSON.stringify(metadata) : undefined);
  }
  // ... fallback path
}
```

The `searchMemory` return shape `{id, score, content, metadata}` is **almost the exact `RecalledMemory` shape AgentMemory's `recall()` needs**. M5 declared `RecalledMemory: { id, text, score, recalledAt, metadata? }` — `text`/`content` is a rename, `recalledAt` would be SDK-generated, otherwise identical.

This is the M11.1 "localMemory boundary" decision come due. The binding ships an HNSW-backed memory layer; AgentMemory either uses it (cheap implementation, but tightly couples AgentMemory to an instantiated `RuvLLM`) or stands alone over `@ruvector/core` (independent lifecycle, slightly more code).

### `@ruvector/sona` — already proven for cross-archetype use (M10 in KB)

KnowledgeBase's M10 wiring uses `SonaEngine.withConfig({ hiddenDim })`, `beginTrajectory`/`setTrajectoryRoute`/`endTrajectory`/`tick`, `applyMicroLora`. AgentMemory can use the same primitives identically — recall is a "trajectory" exactly like retrieve was; reward signals come from `recordFeedback`.

The only new question is whether AgentMemory creates its own `SonaEngine` or accepts a shared one from another archetype.

---

## Three architectures for AgentMemory v0.1

### Architecture A — Independent backend (parallels KB)

`AgentMemory` owns its own `NativeCoreBackend` instance for vector recall, optional `NativeSonaBackend`, optional `GraphReasoner` coupling. No dependency on `LocalLLM`.

Pros:
- Cleanest separation. `AgentMemory.create()` doesn't require any other archetype.
- Same patterns as KB/TSM/GR — well-trodden.
- Tier-3 probe template lifts cleanly from KB's `_archetypeProbe` (insert 3 distinct memories, recall with one as query, assert correct match).

Cons:
- The binding's `searchMemory` already does this work. Reimplementing on top of `core` is somewhat redundant.
- Three separate `NativeCoreBackend` instances (KB, TSM, AgentMemory) compete for the shared-state VectorDb (Finding B from M7). Fine — IDs are partitioned by per-archetype prefix — but it's worth naming.

### Architecture B — Thin wrapper over `LocalLLM.searchMemory`/`addMemory`

`AgentMemory.create({ llm: LocalLLM })` requires a wired LocalLLM. `remember()` calls `llm.addMemory()`; `recall()` calls `llm.searchMemory()`.

Pros:
- Smallest implementation. No new backend needed.
- Inherits the binding's HNSW memory layer (potentially better than ad-hoc core wiring).
- Forces the cross-archetype coupling explicit, which is honest.

Cons:
- Tightly couples AgentMemory to LocalLLM. Users without an LLM can't use AgentMemory.
- The binding's memory persistence model is undocumented (per-instance? per-process? to disk?). Same kind of uncertainty M11.1 surfaced for `generate`'s model loading; risks the same kind of M12-style discovery later.
- Forfeits the optional graph-relation pattern (no straightforward way to expose `searchMemory` results as graph nodes).
- The binding produces gibberish text for `generate` today; if `addMemory`/`searchMemory` quality also depends on the broken default model in any way (TBD), AgentMemory inherits the defect.

### Architecture C — Hybrid: own backend + optional delegation

`AgentMemory` defaults to Architecture A. Accepts an optional `localMemory: LocalLLM` config; when wired, delegates `remember`/`recall` to the LocalLLM's binding instead of using its own core backend. Tier-3 probes per delegation choice.

Pros:
- Both audiences supported: standalone agent memory AND LLM-coupled memory.
- The choice-flip exposes the binding's quality difference if any (the SDK's value report would show two `[active]` rows for memory layer when both wired, with different `source` tags).

Cons:
- More code. Two implementations of the same surface.
- Test matrix doubles.

---

## Recommendation: **Architecture A for v0.1**, with Architecture C as a v0.2 follow-up if user demand emerges

Rationale:
- Independent backend matches every shipped archetype's pattern. Lower cognitive load for users.
- The binding's memory layer (Architecture B's draw) is **untested for quality**. Until probed, it's the same kind of "looks fine, may be gibberish" risk M12.1 surfaced for `generate`. Defaulting to it would be M11.3-lesson territory: ship the safer path and re-probe later.
- If a user asks for LocalLLM-delegation, adding it as a v0.2 option (Architecture C) is a 1-session task.

### Phased v0.1 plan

**Phase 1A — `core` + `sona` over hand-rolled vector recall**

`AgentMemory.create({ agentId, dimensions, embedder?, sona?: true | { ... }, graphReasoner? })`.

Wired:
- Vector recall via `NativeCoreBackend` (same as KB). Per-agent ID prefix `mem:<agentId>:<seq>`.
- Optional `embedder` for text inputs (same M11.2 pattern).
- Optional SONA — `recall` warps query embedding via `applyMicroLora` before search; `recordFeedback` ends a trajectory with reward.
- Optional `graphReasoner` — memory-relations (e.g. tag co-occurrence) form a graph; recall fans out via kHop. Same M9 pattern as KB Graph RAG.

Tier-3 probes (lift from KB pattern):
- `agentMemoryRecall`: insert 3 distinct memories, recall with one as the context, assert correct top-1. Strong-signal text pair like "user prefers terse responses" / "user prefers verbose responses" / "user is a night owl" — recall query "preference brevity" should rank #1 = the terse one.
- `sona-trajectory` (when sona wired): same 3-binding-probe summary as KB's M10.
- `memoryRelations` (when graphReasoner wired): same shape as KB's `graphRagProbe`.

Catalog (using the M9.1 4-blocker classification):

| Capability | Default status | Blocker | Notes |
|---|---|---|---|
| `vectorRecall` | active | — | core-backed |
| `vectorInsert` | active | — | core-backed |
| `agentScoping` | active | — | SDK-side ID prefix |
| `health` / `metrics` | active | — | core probes |
| `sona` | dormant | `sdk-integration` | flips to active when user wires sona |
| `graphMemory` | dormant | `sdk-integration` | flips to active when user wires graphReasoner |
| `autoEmbed` | dormant | `sdk-integration` | flips to active when user wires embedder (M11.2 pattern) |
| `gnnLearning` | dormant | `upstream-binding` | gated on `@ruvector/gnn-node` |
| `mambaRecall` | dormant | `upstream-binding` | gated on `@ruvector/attention-node` |
| `domainExpansion` | dormant | `upstream-binding` | gated on `@ruvector/domain-expansion-node` |
| `hyperbolic` | dormant | `sdk-integration` | could ship a hand-rolled hyperbolic-distance scorer in v0.2 |

11 catalog rows; 5 default-active, 3 sdk-integration (user-toggle), 3 upstream-binding (probe via reprobe.mjs).

Effort: 1 focused session, lifting heavily from KB's M9/M10/M11.2 patterns.

**Phase 1B — open question (cross-archetype boundaries)**

Two questions block 1B's shape:
- shared-SONA (see §6 Q1).
- localMemory boundary (see §6 Q2).

Whichever way each ratifies, the work is small (1 session each). Sequencing is the open question.

**Phase 2 — when upstream publishes**

`@ruvector/gnn-node` flips `[upstream-binding]` to `[ok]` per reprobe.mjs. Same when `@ruvector/attention-node` ships. The catalog already names them; the wiring is a separate ship-task per binding.

---

## Cross-archetype boundaries

### KnowledgeBase ↔ AgentMemory

Both write text-tagged objects with vector embeddings. KB calls them `Document`; AgentMemory calls them `MemoryRecord`. KB's reads dominate; AgentMemory's writes dominate. They share `@ruvector/core` underneath (both via `NativeCoreBackend`), and both need M11.2 auto-embedding.

Decision: **separate backends, shared core**. Per-archetype ID prefixes (`doc:` / `mem:<agentId>:`) keep them safely partitioned given Finding B's shared-state caveat.

### AgentMemory ↔ GraphReasoner

Same pattern as KB's M9 Graph RAG. Memory-relations form a graph; recall fans out via kHop. Tag co-occurrence is the simplest entity-extraction story (same default extractor pattern). M13.1 follows M9 verbatim with `MemoryRecord.tags` standing in for `Document.metadata.entities`.

### AgentMemory ↔ LocalLLM (the localMemory question)

Open. See §6 Q2.

### AgentMemory ↔ KB SONA — shared engine?

Open. See §6 Q1.

---

## 6. Open Questions for the user

These ratify the M13.x sequencing. Each names my lean.

1. **Shared SONA across archetypes?** KB has its own `NativeSonaBackend` instance. Should AgentMemory share KB's, run its own, or expose both shapes?
   - Pros (shared): coherent learning across query-relevance + memory-importance signals.
   - Cons (shared): opaque interaction effects between signals; can't tell whether KB or AgentMemory drove a given LoRA update.
   - Pros (separate): isolation, easier debugging.
   - Cons (separate): two engines learning from disjoint data; the project's "one continuous learning loop" narrative weakens.

   I lean **separate by default, opt-in to shared via a constructor option** (`AgentMemory.create({ sona: kb._sonaInstance })`). Same M9 dependency-injection pattern. Ratifies sharing as a feature, not the default.

2. **`AgentMemory.addMemory/recall` vs `LocalLLM.addMemory/searchMemory` boundary?** The binding ships a memory layer; M11.1 left it design-deferred. Three options:
   - **a)** AgentMemory owns the API; LocalLLM doesn't expose its memory layer publicly.
   - **b)** Both expose; LocalLLM is per-instance/transient, AgentMemory is per-agent/persistent.
   - **c)** LocalLLM.memory delegates to AgentMemory under the hood when one is wired.

   I lean **(b)**: both keep their surface; the SDK's value-report `source` field (`@ruvector/core` vs `ruvllm`) makes it obvious which layer a result came from. (a) loses a real API the binding ships. (c) couples LocalLLM to AgentMemory in a way the M9/M10/M11.2 patterns deliberately avoided.

3. **`hyperbolic` capability — defer to upstream-binding or ship a hand-rolled scorer?** `@ruvector/hyperbolic-hnsw` is excluded from the default workspace (PRD Appendix A). If AgentMemory ships a Poincaré-ball distance scorer over flat embeddings (~30 LOC), the `hyperbolic` flag activates with `source: '@ruvector/sdk'` (parallel to TSM's M10.1 changepoint detector — first capability where the SDK was the source). Drift signal: when `@ruvector/hyperbolic-hnsw` is published, switch transports and the SDK's hand-rolled scorer becomes a fallback.

   I lean **hand-rolled, sdk-source**. Same precedent as M10.1's changepoint detector — proves the SDK can ship value before upstream is ready.

4. **`MemoryRecord` shape: keep M5 as-is, or align with M11.2 patterns?** M5's `MemoryRecord` has `text` + tags/metadata/importance/timestampMs — no embedding. M11.2 made KB's `Document.embedding` optional with `embedder` derivation. Should AgentMemory's `MemoryRecord` be the same? The tier-3 `agentMemoryRecall` probe assumes text-only inputs; pre-computed `Float32Array` is the fast path.

   I lean **align with M11.2** — same shape as KB. Document.embedding is optional, embedder-derivable; MemoryRecord.embedding should be too.

5. **GNN, Mamba, domain-expansion deferral framing**: explicitly mark these `[upstream-binding]` in the M13.1 catalog (so the value report tells the story honestly), OR design them out of the v0.1 surface entirely (so users don't see them in autocomplete)?

   I lean **explicit dormant rows** — same M11.1 pattern with LocalLLM's `tinyDancerRouting` etc. The value-report dormant story is part of the SDK's headline value. Users see the capability, see why it's blocked, see how it'd unblock. Reprobe.mjs's drift detection backstops the "when upstream ships" path automatically.

---

## Findings worth surfacing regardless of M13 path

- **`@ruvector/sona` is already cross-archetype proven** (KB uses it via M10). The wiring template is settled — `withConfig({ hiddenDim })`, the trajectory pattern, `applyMicroLora`. AgentMemory can lift KB's `NativeSonaBackend` adapter verbatim. Worth noting since the same template will likely apply to any future archetype needing continual learning.

- **The M11.2 cross-archetype coupling pattern (optional `embedder: LocalLLM`)** has now shipped 3 times (KB, TSM, GR). AgentMemory will be the 4th. After the 4th, `_resolveEmbeddings` extraction (the v0.2 work-item from M11.2) becomes the right move — three samples was enough to ratify the reducer extraction in M8.2; four samples should ratify the auto-embed-helper extraction.

- **`@ruvector/hyperbolic-hnsw` is excluded from the default workspace** (PRD Appendix A; the cataloger work in M3 confirmed it). Expecting `@ruvector/hyperbolic-hnsw-node` to ever ship as a separate npm package is speculative. The SDK's hand-rolled scorer (Q3 above) is the more reliable path.

- **The `RuvLLM.searchMemory` shape mirrors `RecalledMemory` almost exactly** — `{id, score, content, metadata}` vs M5's `{id, text, score, recalledAt, metadata?}`. If Q2 ratifies (a) or (c), the wrapping is trivial. (b) keeps the two shapes parallel without merging them.

---

*End of M13 scoping. Next ship-task: ratify §6 open questions with user → M13.1 (Phase 1A — `core` + optional `sona`/`graphReasoner` over hand-rolled recall).*
