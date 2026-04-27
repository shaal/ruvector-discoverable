# `@ruvector/core` VectorDb: three construction-time quirks

## Affected versions

- The in-repo prebuilt `ruvector/npm/core/platforms/<platform>/ruvector.node` (version reported as `2.2.0` via `version()`).

`@ruvector/core` is not on npm; this report is against the upstream-shipped binary.

## Summary

Three closely related quirks affect `new VectorDb(options)` and would surprise any integrator. None are fatal — workarounds exist — but each took meaningful debugging time to discover, and the API contract (constructor takes options) suggests the behaviors are unintended.

The three behaviors are:

| # | Behavior | Workaround |
|---|---|---|
| A | `new VectorDb({dimensions: N})` caches `N` on the first construction; subsequent constructions with a different dimension reject inserts. | Always use the same `dimensions` per process. |
| B | Multiple `new VectorDb(...)` calls in the same process do not produce isolated instances — they share the same backing store. | Probe instances must use unique IDs and clean up; cannot rely on isolation. |
| C | Omitting `storagePath` writes to `./ruvector.db` in the current working directory rather than running in-memory. | Always pass an explicit `storagePath`, including for "in-memory" use cases. |

## Reproducers

### Quirk A: dimension singleton

```js
const { VectorDb } = require('./ruvector.node');
const a = new VectorDb({ dimensions: 16, distanceMetric: 'Cosine' });
await a.insert({ id: 'a', vector: new Float32Array(16).fill(1) });

const b = new VectorDb({ dimensions: 4, distanceMetric: 'Cosine' });
try {
  await b.insert({ id: 'b', vector: new Float32Array(4).fill(1) });
  console.log('ok');
} catch (e) {
  console.log('error:', e.message);
}
// → error: Insert failed: Dimension mismatch: expected 16, got 4
```

The second instance was constructed with `dimensions: 4` but the binding rejects 4-dim vectors because the first instance's 16 was cached.

### Quirk B: shared state across instances

```js
const a = new VectorDb({ dimensions: 8, distanceMetric: 'Cosine' });
console.log('a.len before:', await a.len()); // 0

const b = new VectorDb({ dimensions: 8, distanceMetric: 'Cosine' });
await b.insert({ id: 'b1', vector: new Float32Array(8) });
console.log('a.len after b inserts:', await a.len()); // 1, not 0

const c = new VectorDb({ dimensions: 8, distanceMetric: 'Cosine' });
console.log('c.len:', await c.len()); // 1, not 0 — c "sees" b's insert
```

### Quirk C: default-storage-to-disk

```js
$ rm -f ruvector.db
$ ls ruvector.db
ls: ruvector.db: No such file or directory

$ node -e "
  const { VectorDb } = require('./ruvector.node');
  // No storagePath option:
  const db = new VectorDb({ dimensions: 4, distanceMetric: 'Cosine' });
  db.insert({ id: 'x', vector: new Float32Array([1,2,3,4]) });
"

$ ls -la ruvector.db
-rw-r--r-- 1 user staff 16384 ... ruvector.db
```

The constructor's option-object has no `storage: 'memory'` / `inMemory: true` flag in the binding's accepted shape, so the omission is interpreted as "use default path" rather than "in-memory."

## Expected

- (A) Each `new VectorDb(...)` should accept its own dimension setting.
- (B) Each `new VectorDb(...)` should be an isolated instance with its own backing store.
- (C) Omitting `storagePath` should run in-memory (matching the API documentation in the in-repo TypeScript definitions: `storagePath?: string` — optional, no documented default-to-disk behavior).

## Actual

See reproducers above. All three behaviors are deterministic and reproducible.

## Why it matters for integrators

A downstream SDK building a "smoke check" pattern needs to construct a probe instance with a known dimension, insert a known vector, verify it round-trips, and clean up — without polluting the user's main instance. With these quirks:

- (A) means the probe must use the *same* dimension as the user's main instance.
- (B) means probe IDs must be carefully prefixed and best-effort deleted, with the user's `len()` still inflated during the probe window.
- (C) means the user's first run leaks a `ruvector.db` in their cwd unexpectedly.

The integrating SDK's diagnostic at one point during M7 v0.1 (an early build of the smoke check):

```
✗ vectorInsert  broken  id=probe-1, len=6
```

`len=6` from a single-insert probe was the signal that exposed quirk B — the probe was an "isolated" instance per the API but its `len()` reflected leftover state from earlier instances in the same process. Fixed by switching to delta-based assertions.

## Suggested fixes

- (A) Most surprising — fix recommended. Each `VectorDb` instance should hold its own dimension. If there's a singleton-by-design reason (e.g., shared HNSW index across instances), document it loudly and reject the second-instance constructor with a clear error rather than silently caching.
- (B) Same as (A) — fix recommended; if intentional, document and rename the constructor to something like `VectorDb.openShared(...)`.
- (C) Documentation fix — either add `storagePath: 'memory'` as a recognized value, or document that omission means default-to-disk and recommend an explicit ephemeral path for in-memory use cases.

If (A) and (B) are functioning as designed (some shared global engine), an explicit `VectorDb.create({ dimensions, storagePath })` factory that names a persistent store would be clearer than the `new VectorDb({...})` shape that suggests independent instances.
