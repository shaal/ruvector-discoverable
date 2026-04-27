# ruvector-discoverable

**Task-first archetype-based SDK over [`github.com/ruvnet/ruvector`](https://github.com/ruvnet/ruvector).** Solves discoverability collapse (developers reach for `VectorDb` and stop, missing 95% of upstream's unique capability) by surfacing 6 task-first archetypes — `KnowledgeBase`, `AgentMemory`, `GraphReasoner`, `TimeSeriesMemory`, `LocalLLM`, `AgentFramework` — each with `.explain()` on every result, `getValueReport()` with 4-blocker dormant classification, and 11 paste-ready upstream-defect reports the SDK surfaces observably.

> **Status — v0.3 / pre-npm-publish.** The KB-family of archetypes (KB / TimeSeriesMemory / AgentMemory) is now publish-ready via `nativePackage: 'router'` — no `RUVECTOR_CORE_BINDING` env-var workaround needed. `npm install @ruvector/sdk @ruvector/router` is the target story; `@ruvector/sdk` itself isn't yet on npm. The full v1.0 archetype + CLI surface is implemented and verified. `tools/reprobe-bindings/reprobe.mjs` v0.5 monitors **38 upstream signals** (31 npm + 1 CLI + 6 binding-method probes); CI-gateable.

---

## Where to click first (by intent)

| You are… | Read |
|---|---|
| **An SDK consumer** wanting install + usage + the 6 archetypes + 3 CLI subcommands | **[`packages/sdk/README.md`](packages/sdk/README.md)** |
| **A new contributor** (or AI assistant) continuing development | **[`NEXT-SESSION.md`](NEXT-SESSION.md)** then **[`CLAUDE.md`](CLAUDE.md)** |
| **An upstream maintainer** (`ruvnet/ruvector`) looking for paste-ready bug reports | **[`docs/upstream-issues/`](docs/upstream-issues/)** (11 issues #01–#11) |
| **A RuVector power user** wanting the per-crate public-item catalog | **[`catalog/catalog.md`](catalog/catalog.md)** (M3 `syn`-parsed inventory of all 187 upstream crates) |

---

## Three things this SDK does that a vanilla wrapper doesn't

1. **Task-first archetypes, not feature flags.** You construct `KnowledgeBase`, not `VectorDb` configured for RAG. Each archetype activates a coherent capability bundle by default and surfaces what's still dormant.
2. **`.explain()` on every result.** Pipeline stages, latencies, capability-attributed score lift. Discoverability via using, not via reading docs.
3. **`getValueReport()` classifies dormant capabilities into 4 blockers.** `upstream-binding`, `upstream-bug`, `sdk-integration`, `design-deferred`. Each dormant entry includes `enable` text — copy-pasteable code to wire it. Aggregated across 7 user-facing layers (demos, upstream-issues, probe diagnostics, CLI doctor / recommend / audit, archetype JSDoc).

The full PRD lives at [`docs/plans/ruvector-sdk-prd.md`](docs/plans/ruvector-sdk-prd.md). The "five reinforcing patterns" framing is in §4.

---

## Quick start (when published)

```bash
# Future, once @ruvector/sdk publishes:
npm install @ruvector/sdk @ruvector/router @ruvector/graph-node @ruvector/ruvllm @ruvector/sona

# Today (pre-publish): clone this repo, install in-place
git clone https://github.com/shaal/ruvector-discoverable
cd ruvector-discoverable/packages/sdk
npm install && npm run build

# The canonical "v0.3 looks like this" demo — no env var needed
node examples/v03-publish-ready-demo/run.mjs
```

That demo wires all 5 archetypes (LocalLLM + GraphReasoner + KnowledgeBase + TimeSeriesMemory + AgentMemory) in one process with mixed dimensions (768 + 8 + 768) and exercises each end-to-end. Source: [`packages/sdk/examples/v03-publish-ready-demo/run.mjs`](packages/sdk/examples/v03-publish-ready-demo/run.mjs).

---

## Verifying the upstream surface

```bash
node tools/reprobe-bindings/reprobe.mjs
```

Returns 0 if all 38 monitored upstream signals match expected; 1 + a paste-ready Markdown drift block if anything changed. Probe categories: npm publication status (31), CLI surface contracts (1), binding-method behavior (6 — covers Issues #01 / #03 / #06 / #09 / #10 / #11 via subprocess-isolated probes). Full coverage map at PRD §11.6.

---

## Project history

The SDK was built milestone-by-milestone with a running journal at [`docs/plans/m6-scope.md`](docs/plans/m6-scope.md) (newest at top). M0 → M25 each correspond to one ratified deliverable; cumulative recording of what shipped, what was surprising, what's queued. See [`NEXT-SESSION.md`](NEXT-SESSION.md) for how to continue the workflow.

---

## License

[MIT](LICENSE) (matching upstream `ruvnet/ruvector`).
