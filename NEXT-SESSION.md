# Continuing this project in a new Claude Code session

This repo was built milestone-by-milestone using a specific workflow with Claude Code. To continue making progress without re-explaining context every session, follow this guide.

---

## TL;DR — the magic phrase

After a brief bootstrap (below), the workflow is:

1. Claude proposes the next ship-task with reasoning
2. You reply: **`please use ship-task and follow your recommendation on next task`**
3. Claude runs the [`ship-task` skill](https://docs.claude.com/en/docs/claude-code/skills) end-to-end (Phase 1: complete → Phase 2: confidence gate ≥95% → Phase 3: docs → Phase 4: commit)
4. Claude proposes the next next-task at the end of its summary
5. Repeat

That's it. Each iteration is one milestone, one commit, one ratified deliverable.

---

## Bootstrap message (paste at the start of every new session)

Open this repo in Claude Code, then paste the message below. It instructs Claude to read the right files, run baseline checks, and propose the next ship-task without you having to explain anything:

```
I'm continuing work on the ruvector SDK in this repo. The project ships
milestone-by-milestone via the /ship-task skill. Bootstrap before doing
anything:

  1. Read CLAUDE.md (operating principles, upstream-relationship policy,
     multi-archetype DI invariants).
  2. Read docs/plans/ruvector-sdk-prd.md — focus on §10 (success metrics)
     and §11 (SDK ↔ upstream relationship + monitoring surface).
  3. Read docs/plans/m6-scope.md from the bottom up — it's a running
     journal of milestone outcomes (M6 v0.1 → most recent) with the
     newest at top. Each "Update — Mx outcome" section captures what
     shipped, what was surprising, and what's queued.
  4. Skim the scoping docs in docs/plans/ for design context on the
     larger milestones: m11-scope.md (LocalLLM), m12-scope.md (LocalLLM
     Phase 2), m13-scope.md (AgentMemory), m14-scope.md (AgentFramework),
     m15-scope.md (CLI), m17-scope.md (multi-transport), m31-scope.md
     (AgentMemory full-state persistence).
  5. Read packages/sdk/README.md to understand the user-facing surface
     and the v0.3 publish-ready story (KB-family archetypes via
     nativePackage: 'router').
  6. `git log --oneline | head -30` to see the milestone sequence.
  7. `cd packages/sdk && npm run verify` to confirm a clean baseline.
  8. `node tools/reprobe-bindings/reprobe.mjs` to confirm 0 drift on
     the 38 monitored upstream signals. (Also enforced automatically by
     CI on every push to main and PR — see `.github/workflows/ci.yml`.)

Once you've read those, propose the next ship-task with reasoning, and
I'll confirm with "please use ship-task and follow your recommendation
on next task." Repeat per milestone.
```

---

## What's in the repo (orientation map)

| Path | Purpose |
|---|---|
| `CLAUDE.md` | **Operating principles.** Read this first in every session. Upstream-relationship policy, versioning, multi-archetype DI invariants, working-on-this-codebase guidance. |
| `docs/plans/ruvector-sdk-prd.md` | **Product Requirements Document.** Goals, archetypes, API spec, analysis process, success metrics (§10), SDK ↔ upstream policy (§11). |
| `docs/plans/m6-scope.md` | **Running journal.** Every milestone's outcome — newest at top. Use this to catch up on recent state and find each milestone's "Next ship-task candidates" section. |
| `docs/plans/m{11,12,13,14,15,17}-scope.md` | **Scoping docs** for the larger milestones. Each ends with ratified open questions whose answers shaped the implementation. |
| `docs/upstream-issues/` | **11 paste-ready bug reports** (#01–#11) for `github.com/ruvnet/ruvector`. The SDK names defects observably; users can paste these verbatim into upstream's issue tracker. |
| `tools/reprobe-bindings/reprobe.mjs` | **Ground truth on upstream surface contracts.** Run before relying on any prior-doc upstream claim. v0.5 tracks 38 signals (31 npm + 1 CLI + 6 binding-method probes). |
| `tools/reprobe-bindings/probes/` | Subprocess-isolated probe scripts for binding-method behavior (M22+M23). |
| `packages/sdk/` | **The SDK itself.** Source under `src/`, examples under `examples/`, CLI under `bin/`. |
| `packages/sdk/examples/v03-publish-ready-demo/` | **The canonical "v0.3 looks like this" demo.** Runs without `RUVECTOR_CORE_BINDING`; wires all 5 archetypes in one process with mixed dimensions. |

---

## The three discipline patterns to know

These show up across most milestones. Knowing them in advance means you can recognize when Claude applies them and trust the resulting work.

### 1. Drift-by-inversion

When you ship a new probe / classifier / drift detector, **deliberately break the input** to verify the failure path fires. Then restore. Caught real bugs in v0.2-polish (`--strict` exit-code), M17 ratification (`published-broken` heuristic), M17.1 (WASM smoke-check), M17.2 (chat-template assertion), M18 (KB router insert delta), M19 (TSM dispatcher), M21 (text storage), M22 (binding-method probe runner), M23 (skipped status routing).

### 2. M8.2 byte-stable diff

Capture canonical demo output **before** any refactor. Diff after. Structural changes should be intentional; diffs that are pure nondeterminism (timestamps, random IDs, FP variance) are ignorable. Three native demos (KB / TSM / AgentMemory) currently fail with Issue #03's dimension-mismatch — that's a *byte-stable failure mode*, not a regression, and Claude will say so explicitly.

### 3. Reprobe before trusting prior-doc claims

`tools/reprobe-bindings/reprobe.mjs` is the authoritative upstream-surface ground truth. Multiple times the SDK caught a stale claim from earlier docs — M11 found "@ruvector/ruvllm has no NAPI binding" was already false; M12 found `@ruvector/ruvllm` had no `model_path` config; M17 found `@ruvector/server` was published-but-broken; M17.1/M17.2 found wasm packages are at a different layer than NAPI; M18 found `@ruvector/router` was a stealth-published working VectorDb. **Run reprobe before relying on any "package X is unpublished" or "CLI Y has flag Z" claim.**

---

## When to deviate from the recommendation

Claude proposes the next ship-task at the end of each milestone summary. Sometimes you should redirect:

- **Scope is bigger than ~half a session?** Ask Claude to file a scoping doc first (`docs/plans/mN-scope.md`), ratify open questions, *then* implement. M11/M12/M13/M14/M15/M17 all followed this pattern.
- **The recommendation is upstream-blocked?** Pick a parallel win. Issue #08 blocks HTTP transport; M18/M19/M20 found a different unblock path (router) that didn't need upstream movement.
- **You see a paper-cut Claude didn't mention?** Just describe it. M21 fixed AgentMemory's text-placeholder paper-cut after the M20 demo surfaced it. Small fixes ship cleanly via the same workflow.

You can also propose your own task explicitly: `please use ship-task on <description>` works the same way.

---

## What if Claude can't reach 95% confidence?

Phase 2 of the ship-task skill is a confidence gate. Claude states a number, lists what's driving it, and either fixes the gaps or pauses. Common situations:

- **Specific concerns Claude can fix itself** (more tests, edge cases, rerunning a probe): expect Claude to iterate without prompting.
- **Genuine uncertainty about correctness/design** that an outside opinion would help: Claude may ask for a Grok second opinion. You'll get a paste-ready prompt; the response goes back to Claude critically (not deferentially).
- **Genuinely ambiguous requirement**: Claude pauses and tells you why. That's the gate working as designed.

**Don't pressure Claude past the gate.** An honest 78% that gets fixed to 96% is the value the gate delivers.

---

## Project-specific gotchas (the ones that bit historically)

1. **`@ruvector/core` Issue #03 — dimension singleton.** First VectorDb pins the global dim; second VectorDb at different dim throws "Dimension mismatch" on insert. Solution: use `nativePackage: 'router'` for KB/TSM/AgentMemory (M18/M19), which doesn't share core's singleton.

2. **`@ruvector/router` Issue #11 — `delete()` deadlock.** Sync NAPI infinite loop on delete-of-existing-id. Even `setTimeout` doesn't fire. The reprobe handles this via subprocess + SIGKILL-on-timeout. SDK consumers get `CAPABILITY_DEFERRED` from `forget()` / `deleteId()` under router.

3. **ESM-of-CJS interop.** `import('@ruvector/router')` hoists `VectorDb` (a class) to the namespace top-level but leaves `DistanceMetric` (a plain object) only on `m.default`. The SDK's `loadRouterModule()` helper merges them. Probes use `createRequire(packages/sdk/package.json)` + `pathToFileURL(modPath)` to resolve npm packages from utility scripts that live outside `packages/sdk/`.

4. **`agent-framework-demo` 5000ms POLICY_VIOLATION.** Environmentally fragile under timing variance. Not an M19/M21 regression; documented as a v0.2 work-item.

5. **The KB / TSM / AgentMemory native demos fail with Issue #03 in the same shell session as a 768-dim LocalLLM demo.** This is the dimension-singleton bleed-through. Run them in fresh node processes, or use `nativePackage: 'router'`.

---

## How milestones get named

The numbering follows the work, not a plan: M0 through M24 each correspond to one ratified deliverable. Sub-milestones (M11.1, M15.3, etc.) are ship-task slices of a scoped milestone. Hyphenated tags (v0.2-polish, M17-ratification) are for cross-cutting work that doesn't fit a single archetype/feature.

Don't worry about picking the next number — Claude will propose one consistent with the journal's history. If you're feeling stuck, just paste the bootstrap message above and ask "what's next?"

---

## Verifying you're on a clean baseline

Before any new milestone:

```bash
cd packages/sdk
npm run verify        # tsc --noEmit clean (src + examples)
cd ../..
node tools/reprobe-bindings/reprobe.mjs     # exit 0 means 38/38 signals match
git status             # working tree clean
```

If any of those fail without you having intended a change, fix the baseline before starting the next milestone. The journal entries assume each milestone starts from a clean state.

---

## Three things this repo is *not*

1. **Not the official `ruvector` SDK.** Upstream is `github.com/ruvnet/ruvector`. This is a *consumer* SDK that ships task-first archetypes over upstream's bindings. CLAUDE.md mission paragraph spells this out.
2. **Not a fork of upstream.** The SDK depends on upstream's published npm packages and consumes the in-repo `ruvector/` clone for development. Upstream's code is unmodified.
3. **Not a research project.** The SDK ships working code with confidence-gated milestones. The PRD §10 success metrics are the bar; #6 (reprobe-clean-on-every-release) is directly testable today.

---

## Helpful entry points by intent

- **"What's the current state?"** → `git log --oneline | head -10` then read the top entry of `docs/plans/m6-scope.md`.
- **"What's the SDK actually do?"** → `packages/sdk/README.md` first 30 lines + `examples/v03-publish-ready-demo/run.mjs`.
- **"What's still broken upstream?"** → `docs/upstream-issues/README.md` (table of 11 issues).
- **"What does Claude know that I don't?"** → `CLAUDE.md` (operating principles) + `docs/plans/ruvector-sdk-prd.md` §11 (policy).
- **"How do I pick a next task?"** → bottom of the most recent journal entry in `m6-scope.md` lists "Next ship-task candidates" with rationale.

---

*Maintained by milestone closes. If you find this doc out of sync with the codebase, that itself is a worthy ship-task: "please use ship-task to update NEXT-SESSION.md against the current state."*
