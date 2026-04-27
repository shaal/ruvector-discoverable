# M14 — AgentFramework Scoping Report

| Field | Value |
|---|---|
| Status | Scoping (no implementation yet) |
| Date | 2026-04-27 |
| Decision needed from user | Open Questions §6 below |
| Predecessors | `m11-scope.md` (LocalLLM), `m12-scope.md` (Phase 2 transports), `m13-scope.md` (AgentMemory; same 0-of-N-published shape) |

This is a scoping pass, not a ship-task. AgentFramework is the **last M5-frozen-stub**; after M14.x lands, the headline archetype frontier closes. Apply the M11→M13 lessons up front: re-probe before trusting earlier docs; live-probe binding internals; defer cleanly when upstream isn't ready; surface cross-archetype couplings.

---

## TL;DR

1. **Re-probe via `tools/reprobe-bindings/reprobe.mjs` (M11.3 v0.2)**: 0 drift. Live `npm view` on the rvagent-* family across 12 plausible naming conventions: **0 of 9 named bindings published**. More severe than AgentMemory's 2-of-5 ratio. The rvAgent crate family has no NAPI publication path today.

2. **Phase-1 is necessarily pure-SDK orchestration** over already-shipped archetypes. AgentFramework's "framework" job doesn't fundamentally need a binding — it's task lifecycle, tool dispatch, sub-agent recursion, and policy enforcement, all implementable in TS over the 5 working archetypes (LocalLLM / KB / TSM / GR / AgentMemory).

3. **The four headline protocols (A2A / ACP / MCP / sub-agent) split sharply on availability**:
   - **MCP** — the public `@modelcontextprotocol/sdk` exists on npm (not part of `@ruvector/*`). The SDK could integrate it directly Phase-1, exactly as it integrates `@ruvector/core`. MCP is the only protocol with a real, non-upstream-Ru path to Phase-1 active status.
   - **A2A** (ADR-159, SHAKE-256-fingerprint peer auth) — fully gated on `@ruvector/rvagent-a2a` publication.
   - **ACP** (client↔agent) — fully gated on `@ruvector/rvagent-acp`.
   - **Sub-agent dispatch** — implementable in pure SDK code as recursive `AgentFramework.run()` (no binding needed).

4. **All cross-archetype couplings are well-trodden** (M9 / M10 / M11.2 / M13.1 dependency-injection pattern). AgentFramework holds optional `{ llm, memory, kb, graph }` references and orchestrates them.

5. **The big unknown: tool-calling without a real model**. LocalLLM's `generate` produces gibberish today (Issue #05); structured tool-call output assumed by `TaskResult.toolCalls` requires either (a) a real model with tool-calling, (b) a regex/schema parser over model output, or (c) deferring tool-execution end-to-end testing. Same Cypher-stub-failure-mode as M6.

6. **Recommendation**: ship Phase-1A as a *pure-orchestration shell* — `run()` invokes the optional LLM and tracks `toolCalls`/`subagentCalls` from explicit `registerTool` registrations and explicit subagent compositions. A2A / ACP marked `[upstream-binding]`. MCP marked `[sdk-integration]` if Q1 ratifies the public `@modelcontextprotocol/sdk` path; otherwise `[upstream-binding]` until rvagent-mcp ships.

---

## What I verified live

### Re-probe (M11.3 v0.2, 2026-04-27)

```
13/13 npm + 1/1 CLI match expected. exit=0
```

No drift on the 13 packages and 1 CLI binary the project already tracks.

### rvagent-* family — publication status (live `npm view`)

| Probed name | Status |
|---|---|
| `@ruvector/rvagent-core` | unpublished |
| `@ruvector/rvagent-a2a` | unpublished |
| `@ruvector/rvagent-mcp` | unpublished |
| `@ruvector/rvagent-acp` | unpublished |
| `@ruvector/rvagent-middleware` | unpublished |
| `@ruvector/rvagent-backends` | unpublished |
| `@ruvector/rvagent-tools` | unpublished |
| `@ruvector/rvagent-subagents` | unpublished |
| `@ruvector/rvagent-cli` | unpublished |
| `@ruvector/agent-core` (alt name) | unpublished |
| `@ruvector/rvagent` (umbrella alt) | unpublished |
| `rvagent` (unscoped alt) | unpublished |

**Worst ratio of any archetype scoped so far** (0 of 9 named, 0 of 12 alternatives). For comparison: M13 found 2 of 5 for AgentMemory; M11 found 1 of 4 for LocalLLM at first scoping (then revised to 4 of 4 after the ruvllm correction). M14 has no analogous upside.

### M5-frozen surface (`packages/sdk/src/archetypes/AgentFramework.ts`)

8 method stubs, all throwing:

- `static create(opts)` — currently no `dimensions` field, no DI fields. Phase-1 must add `{ llm?, memory?, kb?, graph? }`.
- `run(task: AgentTask): Promise<TaskResult>` — the main entry point.
- `registerTool({ name, description, handler })` — tool registration.
- `discoverPeers() / dispatchToPeer(peer, task)` — A2A surface.
- `getValueReport / introspect / close`.

`TaskResult` has `response: string`, `toolCalls`, `subagentCalls`, `costUsd`, `durationMs`, `explain` — orthogonal-ish to LocalLLM's `GenerateResult`. `PeerDescriptor` includes the SHAKE-256 fingerprint per ADR-159.

`AgentFrameworkCapabilityConfig` has 5 flags (`a2a`, `acp`, `mcp`, `policy`, `subagents`). After publication-status check:

| Flag | Status given current bindings |
|---|---|
| `a2a` | dormant `[upstream-binding]` — rvagent-a2a unpublished |
| `acp` | dormant `[upstream-binding]` — rvagent-acp unpublished |
| `mcp` | dormant `[sdk-integration]` if Q1 takes the `@modelcontextprotocol/sdk` path; otherwise `[upstream-binding]` |
| `policy` | active when wired (pure-SDK enforcement of TaskPolicy fields) |
| `subagents` | active when wired (recursive AgentFramework.run) |

### LocalLLM tool-calling — what's reachable today

`LocalLLM.generate` returns `GenerateResult` whose M5 surface has `toolCall?: { name, arguments }`. The published binding returns gibberish text today (Issue #05); the wrapped `GenerateResult.toolCall` field is **never populated** because the SDK's M12.1 wrapper doesn't parse model output for tool-call syntax. The path to populated `toolCall`:

- **(a)** Wait for upstream's binding to expose native tool-calling (would set `toolCall` directly from native).
- **(b)** Implement an SDK-side regex/JSON-extract parser that scans `generate(prompt).text` for tool-call patterns and populates `toolCall` from there.
- **(c)** Skip tool-calling end-to-end testing in Phase-1; document `TaskResult.toolCalls` as populated only from explicit `registerTool` invocations the framework makes itself, not from LLM-produced calls.

Per M11.3 lesson: don't trust earlier scoping prose about model output without re-probing. Once a real model file is loaded (per Phase 2B if upstream ever ships model loading, or via #05's fix), this becomes testable. Until then, (c) is the honest path.

---

## Three architectures for AgentFramework v0.1

### Architecture A — Pure-orchestration shell over the 5 working archetypes

`AgentFramework.create({ agentId, llm?, memory?, kb?, graph?, defaultPolicy? })`. `run(task)` executes:

1. Optional `kb.retrieve(prompt)` for context.
2. Optional `memory.recall(prompt)` for prior agent state.
3. Optional `llm.generate(promptWithContext)` for the response.
4. Tools dispatched only via explicit `registerTool` callbacks the framework invokes itself (not from LLM-produced calls; see (c) above).
5. Sub-agents via composition: a `subagents: AgentFramework[]` config that `run()` walks recursively.
6. Policy enforcement (TaskPolicy.maxTokens / maxCostUsd / maxDurationMs / maxConcurrency) entirely SDK-side.

Pros:
- Buildable today. No upstream gating.
- DI pattern matches M9/M10/M11.2/M13.1; fifth archetype using the same shape; auto-embed-style helper-extraction (M13.2) precedent now stands ready for a future "shared-lifecycle" extraction if a 6th case emerges.
- Tier-3 probe template lifts cleanly: insert a fake tool, run a task that should invoke it (via explicit registration in a probe), assert the result.
- A2A / ACP / MCP all dormant `[upstream-binding]` (or `[sdk-integration]` for MCP if Q1 picks public-SDK integration). Honest about what's blocked.

Cons:
- Tool-call orchestration is *passive* (only what the framework explicitly invokes), not LLM-driven. Until a real model lands, this is the only honest path; once a model lands, the SDK can add a tool-call parser.
- `discoverPeers / dispatchToPeer` throw `[upstream-binding]` errors; the demo can't show A2A.

### Architecture B — Integrate the public `@modelcontextprotocol/sdk` for MCP

Same as A, plus an MCP integration layer that registers the SDK's tools as MCP-discoverable. `AgentFramework.create({ ..., mcp: { server: <port> } })` exposes the agent over MCP; `mcp: { client: <endpoint> }` consumes external MCP servers.

Pros:
- One actual protocol works in Phase-1 (MCP).
- The public MCP SDK is a stable dependency; not gated on upstream Ru.
- Demos can show real tool-discovery via MCP (the headline rvAgent capability).

Cons:
- New runtime dependency. Adds an external npm package the SDK depends on.
- MCP's API surface might evolve; pinning is needed.
- Doesn't help A2A or ACP (those stay upstream-blocked).

### Architecture C — A2A as SDK-source (parallel to M10.1 changepoint / M13.1 hyperbolic)

Same as A or B, plus a hand-rolled in-process peer registry: `AgentFramework.discoverPeers()` returns peers from a process-local registry; `dispatchToPeer(peer, task)` calls `peer.run(task)` directly. SHAKE-256 fingerprinting is real (Node's crypto), but no real network protocol — local-only.

Pros:
- Continues the SDK-source pattern (changepoint detection, hyperbolic scorer). The SDK ships value before upstream is ready.
- Demos can show in-process A2A.

Cons:
- "In-process A2A" is a misnomer; A2A's whole point per ADR-159 is *inter-process* peer discovery + auth. An in-process version is a smaller thing entirely.
- Risk of confusing users about what's actually shipped vs upstream-pending.
- Effort: ~half-session; benefit: marginal.

---

## Recommendation: **Architecture A + Q1 ratification on B**

Rationale:
- **A is the load-bearing scope**: pure orchestration over the 5 archetypes is what makes "AgentFramework exists" true. Without the orchestration shell, no protocol matters.
- **B is high-leverage if the user wants MCP today**: the public `@modelcontextprotocol/sdk` is real and mature. One npm dependency unlocks the headline rvAgent capability that has any near-term path. But it's a DI/dependency-policy decision, not a technical one.
- **C is too marginal** for v0.1. SDK-source A2A is mostly cosplay; defer until either (a) upstream rvagent-a2a ships, or (b) a real cross-process peer registry is needed by users.

### Phased v0.1 plan

**Phase 1A — pure-orchestration shell (Architecture A)**

`AgentFramework.create({ agentId, llm?, memory?, kb?, graph?, defaultPolicy? })`.

Wired:
- `run(task)` orchestrates an optional context-fetch (KB), optional memory-recall (AgentMemory), LLM call (LocalLLM), policy enforcement (SDK-side), tool dispatch (explicit `registerTool` callbacks), sub-agent dispatch (composition).
- `registerTool` builds an in-memory tool registry; `run` may call them when explicit framework logic wants to.
- `discoverPeers / dispatchToPeer` throw `[upstream-binding]` errors per Q3 (or hand-rolled per Architecture C if ratified — I lean against).
- Sub-agent dispatch via `subagents: AgentFramework[]` config.

Tier-3 probes:
- `agentFrameworkRun` — register a synthetic tool, invoke `run({ prompt: "use the tool" })` with explicit framework-side dispatch (no LLM tool-call parsing required), assert the registered handler ran.
- `policyEnforcement` — set `maxTokens: 1`, run a task whose context exceeds it, assert `run` rejects with a `POLICY_VIOLATION` before invoking the LLM.
- `subagentDispatch` — wire a child AgentFramework, dispatch a task into it, assert the result came back via `TaskResult.subagentCalls`.

Catalog (12 rows, mirroring the M13 → M13.1 11-row model):

| Capability | Default | Blocker |
|---|---|---|
| `taskExecution` | active | — |
| `policyEnforcement` | dormant→active when `policy: true` | sdk-integration |
| `toolDispatch` | active | — |
| `llmInvocation` | dormant→active when `llm` wired | sdk-integration |
| `kbContext` | dormant→active when `kb` wired | sdk-integration |
| `memoryRecall` | dormant→active when `memory` wired | sdk-integration |
| `graphReasoning` | dormant→active when `graph` wired | sdk-integration |
| `subagentDispatch` | dormant→active when `subagents` wired | sdk-integration |
| `mcp` | dormant `[sdk-integration]` if Q1 ratifies public-SDK; `[upstream-binding]` otherwise | — |
| `a2a` | dormant `[upstream-binding]` | — |
| `acp` | dormant `[upstream-binding]` | — |
| `tool-call-parsing` | dormant `[upstream-bug]` (depends on real model output via Issue #05) | — |

Effort: 1 focused session, lifting heavily from M13.1's pattern (DI of optional cross-archetype refs, CAPABILITY_CATALOG, tier-3 probe template).

**Phase 1B — `@modelcontextprotocol/sdk` integration if Q1 ratifies**

Adds MCP-server and MCP-client modes via the public SDK. ~half-session; the public SDK is well-documented.

**Phase 2 — when upstream publishes**

`@ruvector/rvagent-a2a` flips `[upstream-binding]` to `[ok]` per reprobe.mjs (after extending CLI_PROBES / PROBES with the rvagent family). Same for rvagent-acp, rvagent-mcp, rvagent-middleware, etc.

---

## Cross-archetype boundaries

### AgentFramework ↔ LocalLLM

`run(task)` calls `llm.generate(promptWithContext)`. The wired LLM is the Phase 2A NAPI surface — gibberish today per Issue #05. AgentFramework's tier-3 `agentFrameworkRun` probe assertion stops at "the framework called `llm.generate` and got a string back"; it does *not* assert the string is meaningful. Same shape as Issue #06's contract-vs-quality split.

### AgentFramework ↔ AgentMemory

`run(task)` calls `memory.recall(task.prompt)` for relevant agent state. After tool execution, `run` may call `memory.remember({ text: result.response })` to learn from the interaction. Same DI pattern as KB↔SONA in M10.

### AgentFramework ↔ KnowledgeBase

`run(task)` calls `kb.retrieve(task.prompt)` for documentation context. The retrieved citations get baked into the LLM's prompt.

### AgentFramework ↔ GraphReasoner

`run(task)` *may* call `graph.kHopNeighbors` for relation-aware context fetching (e.g., "find docs related to the entity in the prompt"). Less central than the other three couplings; could reasonably defer.

### AgentFramework ↔ AgentFramework (sub-agents)

`AgentFramework.create({ subagents: [other] })` composes. `run` walks the tree recursively. No cycles allowed (probe asserts `subagents.includes(self) === false`).

---

## 6. Open Questions for the user

These ratify the M14.x sequencing. Each names my lean.

1. **Integrate `@modelcontextprotocol/sdk` for MCP in Phase-1?** Pros: one of the four protocols is `[active]` Phase-1 instead of dormant; demos show real MCP discovery. Cons: new external runtime dependency; pinning policy needed.
   I lean **yes — adopt the public MCP SDK**. The four-protocol story (A2A / ACP / MCP / subagents) is the AgentFramework headline; having three of four dormant is honest but underwhelming. MCP via `@modelcontextprotocol/sdk` is the one near-term path to a non-cosplay protocol.

2. **Tool-call parsing — wait for upstream-fixed LLM (Issue #05) or ship an SDK-side regex/schema parser now?** With the broken default model, parsing is testing untestable output. With a real model (Issue #05 fixed), parsing is straightforward.
   I lean **defer parsing entirely in Phase-1A**. Document `TaskResult.toolCalls` as populated only from explicit framework-side invocations. Add a parser in Phase-2 once Issue #05 lands. This is the M11.1-style "ship the contract, defer the quality."

3. **A2A as SDK-source (Architecture C) or fully defer?** In-process A2A is small and serves as a stub but doesn't deliver A2A's headline value (cross-process peer discovery + auth).
   I lean **fully defer** (Architecture A, no C). Same logic as M11.3 v0.2's "feature appears in upstream → SDK can wire when ready"; cosplay is a bad precedent.

4. **Policy enforcement scope — full M5 surface (`maxTokens` + `maxCostUsd` + `maxDurationMs` + `maxConcurrency`) or subset?** `maxCostUsd` requires per-LLM-call cost tracking; `maxConcurrency` requires a process-level semaphore.
   I lean **subset for Phase-1A**: `maxTokens`, `maxDurationMs`, `maxConcurrency` are pure-SDK; `maxCostUsd` requires per-LLM-call cost models that don't exist for the upstream binding (which has no model-loading mechanism, hence no cost). Defer `maxCostUsd` to Phase-2 alongside #05.

5. **Headline narrative for the v0.1 LP**: the project now has 5 archetypes shipped + 1 frame-only. AgentFramework Phase-1A delivers task orchestration but no real protocols (1 of 4 if Q1 ratifies; 0 of 4 otherwise). Is that v1.0-shippable, or does the milestone need to wait for at least one upstream rvagent-* binding?
   I lean **ship Phase-1A as v1.0 with explicit dormant-row honesty**. The PRD's success metric is "developers discover capabilities from `.explain()` and `getValueReport()`" — a 4-protocol catalog with 1 active and 3 dormant-with-clear-reasons IS the success metric.

---

## Findings worth surfacing regardless of M14 path

- **Five archetypes share an emerging "lifecycle" pattern**: KB / TSM / GR / LocalLLM / AgentMemory each have `_options`, `_invocationCounts`, `_closed`, `_lastHealth`, plus archetype-specific state. AgentFramework will be the 6th. After implementing M14.1, a `core/archetype-base.ts` extraction could emerge — same M8.2 / M13.2 three-then-extract precedent applied to lifecycle plumbing rather than reducer or auto-embed.

- **The M11.2 cross-archetype-DI pattern has shipped six times** (KB→GR, KB→SONA, KB→LocalLLM via embedder, TSM→LocalLLM, GR→LocalLLM, AgentMemory→all-three). AgentFramework's `{ llm, memory, kb, graph }` constructor will be the 7th and 8th uses. The `validateEmbedderDimensions` helper extracted in M13.2 is a precedent for a more general `validateOptionalDependency<T>(dep, archetypeName)` utility — not yet warranted but worth tracking.

- **Issue #05's SDK-side detection is now load-bearing for AgentFramework**: a `tool-call-parsing` capability marked `[upstream-bug]` linked to Issue #05 means a single upstream model-loader fix unblocks both LocalLLM Phase 2 AND AgentFramework's tool-call quality. One coordinated upstream pass closes both.

- **The PRD's `recommend` / `doctor` CLI (§5.5)** becomes interesting once 6 archetypes ship: a developer can answer "I'm building an agent system" and get a config that wires AgentFramework + AgentMemory + KB + LocalLLM by default. Worth adding to the post-M14 roadmap.

---

*End of M14 scoping. Next ship-task: ratify §6 open questions with user → M14.1 (Phase-1A pure-orchestration shell).*
