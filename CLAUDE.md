# CLAUDE.md — RuVector SDK operating principles

This file captures load-bearing context for any AI assistant (or human) working on this repo. Read it before starting a ship-task. Update it when an operating principle changes — not when individual milestones land.

---

## Mission

The RuVector SDK is a **consumer** of upstream [`github.com/ruvnet/ruvector`](https://github.com/ruvnet/ruvector). **We do not control upstream.** The SDK's job is:

1. **Make RuVector's existing capabilities discoverable and usable** via task-first archetypes (`KnowledgeBase`, `AgentMemory`, `GraphReasoner`, `TimeSeriesMemory`, `LocalLLM`, `AgentFramework`).
2. **Track upstream churn** — additions, regressions, defects — and adjust the SDK without forcing avoidable breakage on SDK consumers.
3. **Classify every capability** as `active` (working today) or `dormant` (and why). Four blocker categories: `upstream-binding` (binding not published), `upstream-bug` (binding published but defective), `sdk-integration` (SDK code missing), `design-deferred` (intentionally not yet shipped).
4. **Surface upstream defects as paste-ready bug reports** rather than block on fixes. The SDK's diagnostic infrastructure doubles as bug-report-evidence infrastructure (`docs/upstream-issues/`).

The PRD's full goal/non-goal list is at [`docs/plans/ruvector-sdk-prd.md`](docs/plans/ruvector-sdk-prd.md) §2. The mission above is the working summary.

---

## SDK ↔ Upstream relationship policy

This is the core operating constraint. Every milestone decision should be checked against it.

### Hard rules

1. **Never block SDK delivery on an upstream fix.** File a paste-ready issue at `docs/upstream-issues/`, classify the affected capability `dormant [upstream-bug]` or `[upstream-binding]`, and ship around it. The SDK has 8 such issues filed (#01–#08); none have blocked a milestone.
2. **Re-probe before relying on any "package X is unpublished" or "CLI Y has flag Z" claim from earlier docs.** M11/M12/M17 each caught a stale upstream-state claim that earlier scoping had treated as fact. `tools/reprobe-bindings/reprobe.mjs` is the authoritative source. **Run it at every milestone close.**
3. **Trust observed status over declared status.** Catalog rows declare a default `active`/`dormant`; tier-1 binding probes and tier-3 archetype probes override the declared status with what the live binding does. When upstream fixes a stub, the SDK reclassifies automatically (M6.2 / M11.3 self-correcting-classification pattern). Hand-maintained dormant lists rot; observed ones don't.
4. **The diagnostic infrastructure is the bug-report-evidence infrastructure.** Every paste-ready issue under `docs/upstream-issues/` was authored by lifting probe diagnostics verbatim into the issue body. No editorial rewriting; the SDK's `[observed via probe '...', status=broken] ...` strings ARE the upstream evidence.

### Soft rules

5. **Every commit message names what was caught + fixed live during the work**, so the milestone journal entry can quote it. Pattern shows up in M11.2, M12.1, M13.1, M14.1, M15.2, M15.3, M16, v0.2-polish, M17-scoping.
6. **Capture canonical demo output before any refactor; diff after.** M8.2 proved this works; every later milestone uses the protocol.
7. **Drift-by-inversion**: when you ship a new probe / classifier / drift detector, verify the FAILURE path fires by deliberately breaking the input. M11.3 / M12.5 / M15.2 / M15.3 / v0.2-polish / M17-scoping all use this; it catches false-positives the happy path can't.
8. **Tier-3 probes assert result quality, not just method existence** — see M8.1, M11.1 `similarityMonotonic`, M13.1 hyperbolic Poincaré. "The method exists and returns" is not a readiness gate; "the method returns a correct result for a known input" is. M6 v0.1's Cypher stub is the canonical example of the gap.

---

## Versioning

The SDK adopts semver with explicit upstream-snapshot tracking, because upstream churn is the largest source of breakage we'll see.

### How SDK version maps to upstream

- **Patch** (`0.0.x`) — SDK-only changes: doc fixes, internal refactors, new probe rows, classification updates. Upstream snapshot unchanged.
- **Minor** (`0.x.0`) — Additive surface changes: new archetype, new CLI subcommand, new transport backend, dormant→active flips driven by upstream changes the SDK now exposes. Old code paths still work.
- **Major** (`x.0.0`) — Breaking SDK surface change. Reserved for: upstream forced a non-translatable break the SDK can't shim; OR an SDK-side architectural rewrite. Both should be rare.

### Upstream snapshot

Every SDK release names a **verified upstream snapshot** — the set of upstream package versions probed at release time. This is captured by `tools/reprobe-bindings/reprobe.mjs`'s `PROBES` table at the release commit. Re-running reprobe at the same SDK version against today's npm registry reveals drift; that drift is what new SDK milestones respond to.

When upstream publishes:

- **Additive change** (new method, new package): SDK minor-bump on the next milestone to expose. The new capability gets a catalog row and a probe.
- **Surface regression** (method removed/renamed, package un-published): SDK records reproducer at `docs/upstream-issues/`, classifies affected capability `dormant [upstream-bug]`, surfaces the change in `getValueReport`. CHANGELOG names the user-facing impact. SDK consumers see the regression *via the SDK's value report*, not as a runtime crash.
- **Defect fix** (broken binding starts working): SDK reclassifies dormant→active automatically. The next reprobe surfaces the publication change; the next archetype `healthCheck()` flips the status. No SDK code change needed (M6.2 pattern).

### What this implies for SDK consumers

The SDK's `getValueReport()` always names the **observed upstream-package versions** it's running against. Users can compare to the SDK release's "verified snapshot" to know if they're on a tested path. If observed differs from verified (user installed a newer upstream binding manually), the SDK's probe diagnostics still apply — they probe behavior, not version strings.

---

## Working on this codebase

- **Use `/ship-task`** for end-to-end milestones with a confidence gate. Phase 2's confidence-check is the whole point — don't collapse it.
- **Reprobe first** if a session might rely on upstream-state claims older than the last milestone close.
- **One milestone per session.** The journal at `docs/plans/m6-scope.md` records each one; new entries go at the top.
- **Defer scoping passes for any milestone bigger than ~half a session.** Pattern: `mN-scope.md` filed first, ratified by user, then `mN.x` ship-tasks deliver against ratified open questions. M11/M12/M13/M14/M15/M17 all followed this.
- **Per-archetype demos are SDK-source canonical outputs.** Refactors must keep them byte-stable modulo nondeterminism (timestamps, random IDs, FP variance). M8.2 protocol.
- **Small changes deserve confidence checks too.** The v0.2-polish ship-task caught a $? pipeline bug during a 5-LOC `--strict` flag test; that bug would have shipped without the gate.

---

## Key reference points

| Path | What it is |
|---|---|
| [`docs/plans/ruvector-sdk-prd.md`](docs/plans/ruvector-sdk-prd.md) | Product Requirements Document — Part A (SDK product) + Part B (analysis process). §11 names the SDK ↔ upstream policy. |
| [`docs/plans/m6-scope.md`](docs/plans/m6-scope.md) | Running journal of every milestone outcome. Newest at top. Read bottom-up to learn the project's history; top-down to catch up since last session. |
| [`docs/plans/m11-scope.md`](docs/plans/m11-scope.md) → [`m17-scope.md`](docs/plans/m17-scope.md) | Per-milestone scoping passes (LocalLLM / Phase 2 / AgentMemory / AgentFramework / CLI / Transports). Each ends with ratified open questions whose answers shaped the implementation milestones. |
| [`docs/upstream-issues/`](docs/upstream-issues/) | Paste-ready bug reports for upstream. 8 issues filed as of M17-ratification. |
| [`tools/reprobe-bindings/reprobe.mjs`](tools/reprobe-bindings/reprobe.mjs) | Ground-truth on upstream surface contracts. Re-runnable; CI-gateable. v0.4 tracks 31 npm + 1 CLI. |
| [`packages/sdk/src/`](packages/sdk/src/) | The SDK itself. Six archetypes under `archetypes/`; backends under `backends/`; CLI under `cli/`; cross-cutting under `core/`. |
| [`packages/sdk/README.md`](packages/sdk/README.md) | Top-of-funnel SDK doc. Status callout near top names current pre-publish state. |

---

*Last revised: M17 ratification (2026-04-27). Update when an operating principle changes — not at every milestone.*
