# `@ruvector/router@0.1.30`: `VectorDb.delete(id)` hangs forever on existing IDs

## Affected versions

- `@ruvector/router@0.1.30` (npm) — `VectorDb.delete()` deadlocks on a non-empty database

## Summary

Live integration of `@ruvector/router@0.1.30` into the SDK's `RouterKbBackend` (M18) surfaced a critical defect: `VectorDb.delete(<existing-id>)` enters an infinite loop on the native side. Even Node's `setTimeout` does not fire — the call is synchronous and blocks the event loop entirely. Process must be `kill -9`'d.

`delete()` works correctly only on **empty databases** or for **non-existent IDs** (returns `false` cleanly). As soon as there's data and you try to delete a real ID, the binding hangs.

This is a substantial defect because it makes `@ruvector/router` unsuitable for any KB workload that mutates after initial ingest — even calling `delete` once after first insert locks the process. The SDK works around it by throwing `RuVectorError('CAPABILITY_DEFERRED', ...)` from `RouterKbBackend.deleteId` rather than passing through, but the workaround means router-backed KBs are append-only.

## Reproducer

```js
import * as ns from '@ruvector/router';
const mod = { ...(ns.default ?? {}), ...ns };

const db = new mod.VectorDb({ dimensions: 4, distanceMetric: mod.DistanceMetric.Cosine });

// Empty-db delete works:
console.log(db.delete('nonexistent'));  // → false

// Insert + delete a *non-existent* id works:
db.insert('a', new Float32Array([1, 0, 0, 0]));
console.log(db.delete('NONEXISTENT_ID'));  // → false (DB is non-empty, but id doesn't match)

// Same DB, delete an existing id:
console.log('count:', db.count(), 'ids:', db.getAllIds());  // → 1, ['a']
setTimeout(() => console.log('this never fires'), 1000).unref();
db.delete('a');
// → hangs forever. setTimeout never fires.
//   Process must be killed externally.
```

The hang signature: even `setTimeout` doesn't fire, which means the native call is genuinely blocking the JS event loop (a sync NAPI call doing an infinite loop / deadlock on the Rust side, not just a long-running async operation). `insertAsync` is irrelevant — the same hang occurs with sync `insert`.

## Expected

`db.delete(<existing-id>)` should:
1. Remove the vector from the index (HNSW deletion-with-tombstone is the standard approach when full removal is expensive).
2. Return `true` to indicate success.
3. Subsequent `db.count()` should reflect the removal.

If full removal is genuinely too expensive at this version, the binding should at minimum:
- Return cleanly (e.g., a no-op `true`) without hanging, OR
- Throw an explicit error documenting the limitation.

A silent infinite loop is the worst-case UX — consumers can't even distinguish "still working" from "hung forever" without manual `kill -9`.

## Actual

Per the reproducer above. Tested live on `@ruvector/router@0.1.30` installed fresh from npm (no other configuration).

## Workaround in downstream SDK

The SDK's `RouterKbBackend` (`packages/sdk/src/backends/router-kb.ts`):

- `deleteId()` throws `RuVectorError('CAPABILITY_DEFERRED', ...)` with a use-`nativePackage: 'core'` pointer instead of passing through to the native `delete()`. This prevents an unwary user from hanging the SDK process.
- `RouterKbBackend.smokeCheck` does NOT call `delete()` for cleanup — probe data leaks into the shared store. Probe IDs use a unique `__ruvsdk_probe_router_<timestamp>_<rand>_*` prefix to avoid cross-run collisions.
- The `vectorDelete` smoke-check probe is declared `unsupported` rather than run live — invoking it would hang the SDK's own healthCheck. The diagnostic string names Issue #11 explicitly.
- `KnowledgeBase.deleteId()` (and equivalent flows) work fine on `nativePackage: 'core'` (which uses `@ruvector/core`'s working delete); the limitation is only on `nativePackage: 'router'`.

## Suggested fix priority

This is the largest single defect in `@ruvector/router@0.1.30` — without delete, the package is append-only, which is unsuitable for many real KB workloads. Fix priorities:

1. **Stop the hang**. Even if delete is a no-op tombstone, returning cleanly is better than infinite loop. The SDK's smoke-check probe gets unblocked even with that minimal fix.
2. **Wire actual deletion**. HNSW deletion is hard but standard solutions exist (Lucene's tombstoning, Faiss's `remove_ids`, etc.). The SDK already documents Issue #03's dimension singleton in `@ruvector/core` — `@ruvector/router` likely shares the same Rust core with the same constraints.

## Cross-references

- Issue #03 — `@ruvector/core` VectorDb has shared dimension state across instances; `@ruvector/router` likely shares the same Rust core internals and may have inherited this too. Worth checking with a multi-VectorDb-construction probe.
- SDK reference: `packages/sdk/src/backends/router-kb.ts` — adapter that lives with this defect.
- SDK reference: `docs/plans/m6-scope.md` (M18 entry) — documents the discovery during M18 ratification implementation.

## SDK diagnostic that will detect resolution

The SDK's `RouterKbBackend.smokeCheck` declares `vectorDelete` as `unsupported` rather than running it (running would hang the SDK process). When upstream fixes the deadlock:

1. Upstream releases a new `@ruvector/router` version (e.g., 0.1.31 or 0.2.0).
2. `tools/reprobe-bindings/reprobe.mjs` v0.5 will detect the version bump and surface drift.
3. The next milestone can flip `vectorDelete` from declared-`unsupported` to a real probe + remove the `CAPABILITY_DEFERRED` throw on `RouterKbBackend.deleteId`.
4. SDK consumers see the fix via `getValueReport()` — same M6.2 self-correcting pattern.

`tools/reprobe-bindings/reprobe.mjs` v0.4 already tracks `@ruvector/router` with `expect: 'published'`. v0.5 should add an explicit version-tracking entry — when @ruvector/router publishes 0.1.31+, drift signals "check Issue #11 status."
