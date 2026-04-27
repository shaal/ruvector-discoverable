# `rvagent-*` family: zero of nine named NAPI bindings published on npm

## Affected packages

The 9 named member crates of the upstream `rvAgent` family per M4 v0.1's archetype ratification (and ADRs 100/104/105/107/108/112/113/159 cited on the AgentFramework archetype). Probed live on 2026-04-27 against the public npm registry:

| Probed name | Status |
|---|---|
| `@ruvector/rvagent-core` | unpublished (E404) |
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

**0 of 9 named, 0 of 12 across alternative naming conventions.** Worst publication ratio of any archetype scoped by the integrating SDK to date — see `docs/plans/m14-scope.md` for full evidence.

## Summary

The SDK's M4 v0.1 archetype ratification (`docs/plans/m4-archetype-ratification.md` style; in this repo, the ratification narrative lives in `docs/plans/ruvector-sdk-prd.md` §5.2) promoted `AgentFramework` from "proposed" to first-class on the basis of the rvAgent crate family being a coherent 9-crate, 641-public-item story spanning the four protocols A2A / ACP / MCP and the orchestration scaffolding (middleware / backends / tools / subagents / cli).

**None of those nine crates ship a published NAPI binding on npm today.** A consumer who wants to use any rvAgent feature from JavaScript / TypeScript has no path forward via the @ruvector/* npm scope.

The integrating SDK has shipped its `AgentFramework` archetype as a pure-SDK orchestration shell over the *other* archetype bindings (`@ruvector/core`, `@ruvector/sona`, `@ruvector/graph-node`, `@ruvector/ruvllm`) — Architecture A from `m14-scope.md` — but A2A, ACP, MCP, and middleware/backends/tools/subagents are all dormant `[upstream-binding]` until the rvagent family publishes.

This is a coverage gap, not a defect — the crates exist in upstream Rust, they're just not bound to NAPI and published. Filing as an issue because (a) the gap blocks an entire archetype's headline, (b) it joins a pattern of upstream NAPI-publishing gaps the SDK has tracked across multiple milestones (Issues #02 broken-umbrella, #05 no-model-loading-API, #06 wrapper field-rename), and (c) a coordinated upstream publishing pass would resolve all of them together.

## Reproducer

```bash
for pkg in '@ruvector/rvagent-core' \
           '@ruvector/rvagent-a2a' \
           '@ruvector/rvagent-mcp' \
           '@ruvector/rvagent-acp' \
           '@ruvector/rvagent-middleware' \
           '@ruvector/rvagent-backends' \
           '@ruvector/rvagent-tools' \
           '@ruvector/rvagent-subagents' \
           '@ruvector/rvagent-cli'; do
  v=$(npm view "$pkg" version 2>&1 | head -1)
  if echo "$v" | grep -q E404; then
    echo "$pkg: unpublished"
  else
    echo "$pkg: $v"
  fi
done
```

Expected output: 9 of 9 lines print `<pkg>: unpublished`.

## Expected

A coordinated publishing pass that establishes per-platform NAPI bindings for each of the 9 named crates following the same shape as the already-shipped `@ruvector/graph-node` (with `@ruvector/graph-node-darwin-arm64` etc. as platform packages):

```
@ruvector/rvagent-core@<v>            (umbrella: JS wrapper + types)
  optionalDependencies:
    @ruvector/rvagent-core-darwin-arm64
    @ruvector/rvagent-core-darwin-x64
    @ruvector/rvagent-core-linux-x64-gnu
    @ruvector/rvagent-core-linux-arm64-gnu
    @ruvector/rvagent-core-win32-x64-msvc
```

Even a single seed package (`@ruvector/rvagent-core`) would unblock part of AgentFramework's surface; ideally all nine ship together so the catalog can flip from `[upstream-binding]` to `[ok]` in one pass.

## Actual

```
@ruvector/rvagent-core: unpublished
@ruvector/rvagent-a2a: unpublished
@ruvector/rvagent-mcp: unpublished
@ruvector/rvagent-acp: unpublished
@ruvector/rvagent-middleware: unpublished
@ruvector/rvagent-backends: unpublished
@ruvector/rvagent-tools: unpublished
@ruvector/rvagent-subagents: unpublished
@ruvector/rvagent-cli: unpublished
```

## Downstream impact

The integrating SDK's `AgentFramework` archetype has shipped (M14.1) as a pure-SDK orchestration shell over the 5 already-bound archetypes (KnowledgeBase / TimeSeriesMemory / GraphReasoner / LocalLLM / AgentMemory). Of the 12 capability rows in its catalog:

- **7 are default-active when wired**: taskExecution, toolDispatch, llmInvocation, kbContext, memoryRecall, subagentDispatch, policyEnforcement.
- **3 are dormant `[upstream-binding]`** directly because of this issue: `mcp` (gated on `@ruvector/rvagent-mcp`), `a2a` (gated on `@ruvector/rvagent-a2a`), `acp` (gated on `@ruvector/rvagent-acp`).
- **1 dormant `[upstream-bug]`** linked to Issue #05: `toolCallParsing`.
- **1 dormant `[sdk-integration]`** when graph isn't wired.

The headline four-protocol story (A2A / ACP / MCP / sub-agents) has only one of four working today (sub-agents — which is pure-SDK code, not a protocol implementation). MCP has a possible non-upstream-Ru path via the public `@modelcontextprotocol/sdk` (M14 §6 Q1 ratification candidate); A2A and ACP have no near-term workaround.

## Detection by an integrating SDK

The SDK's tooling already detects this: `tools/reprobe-bindings/reprobe.mjs` (M11.3) tracks publication-status drift on a maintained list of upstream packages. Adding the rvagent-* family to its `PROBES` table would let the next time upstream publishes any of them flip the SDK's catalog rows automatically:

```js
// In tools/reprobe-bindings/reprobe.mjs PROBES:
{ pkg: '@ruvector/rvagent-core',        expect: 'unpublished', notes: 'AgentFramework — entire family unpublished per Issue #07' },
{ pkg: '@ruvector/rvagent-a2a',         expect: 'unpublished', notes: 'AgentFramework.a2a' },
{ pkg: '@ruvector/rvagent-mcp',         expect: 'unpublished', notes: 'AgentFramework.mcp' },
{ pkg: '@ruvector/rvagent-acp',         expect: 'unpublished', notes: 'AgentFramework.acp' },
{ pkg: '@ruvector/rvagent-middleware',  expect: 'unpublished', notes: 'AgentFramework — middleware layer' },
{ pkg: '@ruvector/rvagent-backends',    expect: 'unpublished', notes: 'AgentFramework — backend integrations' },
{ pkg: '@ruvector/rvagent-tools',       expect: 'unpublished', notes: 'AgentFramework — tool registry' },
{ pkg: '@ruvector/rvagent-subagents',   expect: 'unpublished', notes: 'AgentFramework — subagent dispatch (SDK ships own)' },
{ pkg: '@ruvector/rvagent-cli',         expect: 'unpublished', notes: 'AgentFramework — CLI binary' },
```

When upstream publishes any of these, the next reprobe run produces a paste-ready Markdown drift block recommending the SDK's reclassification action. Same self-correcting pattern as Issues #01 (Cypher stub) and #05 (model-loading API): the SDK's diagnostic infrastructure observes the fix automatically.

## Suggested fix shape

Either:
1. **One coordinated publishing pass for all 9 packages** (the original M4-promoted shape).
2. **Seed-package-first**: ship `@ruvector/rvagent-core` alone, with the umbrella's typedefs in place even where the platform binaries haven't shipped yet. Lets downstream consumers code against the JS-wrapper types while waiting for full coverage. Same shape as `@ruvector/ruvllm@2.5.4` today (umbrella + types + one platform).
3. **Per-protocol packages first** (`-a2a`, `-mcp`, `-acp` as separate npm scopes). Lets the integrating SDK light up one protocol at a time as each ships.

Any path that publishes at least one of the 9 names is unblocking. The integrating SDK's reprobe tool catches the first published flip and produces actionable reclassification guidance.

## Related to

- **Issue #02** — third confirmed sample of broken/missing umbrella publishing (`ruvector`, `@ruvector/sona`, `@ruvector/ruvllm@2.5.4`'s ESM build). The rvagent family is a different shape (entirely-missing rather than broken-but-published) but reinforces the case for a publishing-pipeline audit across the @ruvector scope.
- **Issue #05** — the `toolCallParsing` capability dormant `[upstream-bug]` is downstream-affected too: even if rvagent-* publishes, LLM-driven tool-calling needs a real model to test, which depends on #05's model-loading API fix.
- **`docs/plans/m14-scope.md`** — full evidence and the AgentFramework Phase-1A path the SDK took *despite* this gap.
