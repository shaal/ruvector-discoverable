# M31 — AgentMemory `_memoryTags` + `_vectorMirror` Persistence Scoping Report

| Field | Value |
|---|---|
| Status | **Scoping** — ratification pending. No source changes in this milestone. |
| Date | 2026-04-28 |
| Predecessors | M27 (sidecar mechanism) / M28 (catalog row) / M29 (round-trip probe) / M30 (per-row blocker override) |
| PRD reference | §5.4 AgentMemory (durability); §11.6 (upstream-tracking surface, no new probes anticipated) |
| Next ship-task | **M31.1** post-ratification — implement v2 schema + persist tags; **M31.2** persist vectors (or reconstruct, per Q1) |

This is a scoping pass, not a ship-task. Goal: figure out the realistic shape of full-state persistence for AgentMemory *before* committing to delivery, same pattern as m11/m12/m13/m14/m15/m17 scoping docs.

---

## TL;DR

1. **Two SDK-side maps survive remember() but not restart**: `_memoryTags` (drives `recall({ tags })` filter and graph-fanout bridge attribution) and `_vectorMirror` (drives hyperbolic re-rank). Both are silently no-op for pre-restart memories today — the kind of degradation that's hard to notice.
2. **Tags are easy: persist alongside text in a v2 sidecar.** No backend has a metadata channel; SDK-side persistence is the only path. Strings are tiny; serialization is trivial.
3. **Vectors are harder.** Two sub-questions: (a) encoding (base64 vs plain array vs sibling binary file), (b) persist-vs-reconstruct (router can't reconstruct via per-id lookup — no `get(id)` in `@ruvector/router.VectorDb`; core CAN reconstruct via `get(id)` but the `KbBackend` interface doesn't expose it).
4. **Graph relations are out of M31's scope.** `_graph` (a GraphReasoner) is user-supplied DI; AgentMemory doesn't own that storage. GraphReasoner's own persistence (via `@ruvector/graph-node.GraphDatabase.open(path)`) is orthogonal. M31 documents the boundary; user is responsible for wiring graph persistence at the GraphReasoner-DI layer.
5. **`_trajectoryByQuery` is correctly session-only.** queryIds are issued per-session for in-flight `recordFeedback()`; persisting them across restart would be incorrect (a restored sonaTid wouldn't refer to a live SONA trajectory in the new process).
6. **Schema v1 → v2 is straightforward.** `loadTextStore` already does version validation; extend to accept v1 (with empty tags/vectors maps) and v2 (with both fields populated). Lazy upgrade: next remember/forget after v1 load writes v2. M27's atomic write semantics carry over.
7. **M30 catalog row covers all three concerns automatically.** `textPersistence` already classifies the persistence layer's health; M31's broader payload is exercised by the same write/rename/read round-trip in M29's probe. Either rename the row to `statePersistence` or expand the existing row's lift text — no new probe needed.
8. **Recommendation: Architecture A (persist tags now in M31.1; vectors as base64 in M31.2; document graph boundary).** Avoids the reconstruct-vs-persist split-personality of mixing core/router behaviors; sidecar stays the single source of durable SDK-state truth.

---

## What I verified live

### State map (current code, M30 baseline)

| State | Type | M27 status | What it drives | Recoverability without persist |
|---|---|---|---|---|
| `_textStore` | `Map<id, string>` | ✓ persisted (v1) | `recall().records[i].text` | None — text is user-supplied, not derivable |
| `_seq` | `number` | ✓ persisted (v1) | next memory ID; collision avoidance | Could be derived from max-id-in-backend, but not all backends enumerate IDs cleanly |
| `_memoryTags` | `Map<id, string[]>` | ✗ lost on restart | `recall({ tags })` filter; graph fan-out bridge attribution | None — tags are user-supplied, not derivable |
| `_vectorMirror` | `Map<id, Float32Array>` | ✗ lost on restart | hyperbolic re-rank (Poincaré-ball distance) | **Maybe.** `@ruvector/core.VectorDb.get(id)` exists; `@ruvector/router.VectorDb` does NOT have per-id get |
| `_trajectoryByQuery` | `Map<queryId, sonaTid>` | session-only by design | in-flight `recordFeedback()` resolution | N/A — queryIds are per-session; restoring breaks SONA's trajectory invariant |
| `_invocationCounts` | `Map<method, number>` | session-only by design | populates `ActiveCapability.invocations` in value reports | N/A — persisting would conflate "since this instance" with "since first remember ever," changing report semantics |
| `_idCounter` | `number` | session-only by design | per-query unique queryId stamping | N/A — queryIds are not durable identifiers |
| Graph relations (mem→tag→other-mem) | external (GraphReasoner DI) | not M31's scope | `recall({ graphHops > 0 })` | Persists IFF the user wired GraphReasoner with `storagePath` |

Confirmed via `grep -n` against `packages/sdk/src/archetypes/AgentMemory.ts` (M30 HEAD).

### Backend surface (live `node -e` probes against installed packages)

```
# @ruvector/router.VectorDb
proto: count, delete, getAllIds, insert, insertAsync, search, searchAsync
       ^^^^^^^^^^^^^^^^^^^^ no per-id get; getAllIds enumerates but doesn't return vectors
```

```
# @ruvector/graph-node.GraphDatabase
static: open                          ← persistent constructor
proto:  getStoragePath, isPersistent, ← exposes its own persistence state
        batchInsert, createNode, createEdge, kHopNeighbors, query, ...
```

```
# @ruvector/core.VectorDb (per packages/sdk/src/backends/native-core.ts)
get(id): Promise<{ id?, vector }>     ← per-id retrieval available
```

**Implication**: vector reconstruction is binding-dependent. Under `nativePackage: 'core'`, the SDK could iterate IDs and call `get(id)` to rebuild `_vectorMirror`. Under `nativePackage: 'router'`, the same path doesn't exist; vectors must persist or hyperbolic re-rank silently no-ops post-restart.

### `KbBackend` interface coverage (current)

```ts
insert(id, vector) → string
insertBatch(entries) → string[]
search(vector, k) → KbSearchResult[]
deleteId(id) → boolean
len() → number
isEmpty() → boolean
```

No `get(id)` method on the interface. Adding one is a per-backend ask: native-core gets it from `CoreVectorDb.get`; router has no equivalent surface today (Issue #11 + missing per-id get is two distinct gaps).

### M27 sidecar v1 schema

```json
{
  "version": 1,
  "agentId": "...",
  "seq": 5,
  "texts": { "mem:agent:0": "...", "mem:agent:1": "...", ... }
}
```

`loadTextStore` validates `version: 1` literal; any other version throws `TEXT_STORE_CORRUPT`. v2 will need a relaxed check that accepts both.

---

## What features break post-restart today (M30 HEAD)

Each of these was tested by reading the code path — `_memoryTags` empty + `_vectorMirror` empty are the post-restart in-memory state in v1.

1. **`recall({ tags: ['preferences'] })`**: filter at `AgentMemory.ts:538` reads `_memoryTags.get(h.id) ?? []`. Empty map → no hit matches the tag set → result list is empty for pre-restart memories. Silent: the user gets 0 records back without an error.
2. **Graph fan-out bridge attribution**: at `AgentMemory.ts:589-590`, `startTags` and `adjTags` come from `_memoryTags`. With empty map, every bridge attributes via the fallback `'(graph-traversal)'` rather than naming the shared tag. Functional (the graph-adjacent recall still returns), but the "why was this surfaced?" diagnostic is lost.
3. **Hyperbolic re-rank**: at `AgentMemory.ts:547`, `_vectorMirror.get(h.id)` returns undefined. The `if (!v) return h;` short-circuit keeps the upstream cosine score unchanged. Functional (no crash) but the hyperbolic capability silently no-ops for pre-restart memories.

None of these are observable as errors; that's the failure-mode profile that motivates persistence.

---

## Three architectures for M31

### Architecture A — Persist all SDK-side state in v2 sidecar *(recommended)*

Extends the M27 sidecar to include tags + vectors. Single source of truth for SDK-side state durability.

**v2 schema:**
```json
{
  "version": 2,
  "agentId": "...",
  "seq": 5,
  "texts": { "mem:agent:0": "..." },
  "tags":  { "mem:agent:0": ["preferences", "ui"] },
  "vectors": { "mem:agent:0": "<base64-Float32Array>" }
}
```

**Vector encoding: base64.** A 768-dim Float32Array is 3072 bytes raw → 4096 chars base64. JSON-safe; round-trip is `Buffer.from(b64, 'base64').buffer` ↔ `Buffer.from(arr.buffer).toString('base64')`. Smaller than plain-array (~6-8 KB), human-inspectable enough (still legible as a single string per id), no separate file path to manage.

**Backend-agnostic.** Both `nativePackage: 'core'` and `nativePackage: 'router'` work the same way. No per-backend reconstruct logic.

**Migration**: lazy. `loadTextStore` accepts both v1 and v2. v1 → empty tags/vectors maps. Next remember/forget rewrites the file as v2.

**Effort**: ~80 LOC of source + ~30 LOC of demo extension. M31.1 ships tags; M31.2 ships vectors. Each independently shippable, each preserves M27's write-through atomicity.

**Risk**: low. Schema bump is mechanical; sidecar size grows by ~4 KB/memory (vs ~50 bytes/memory in v1) — at 10k memories, ~40 MB sidecar. Could matter at scale, but full-rewrite-per-call (M27 trade-off) means it's already a v0.5-not-v1 concern. A future v1 milestone could move to journal-append.

### Architecture B — Persist tags; reconstruct vectors lazily

Tags persist in v2. Vectors do NOT persist. Instead:

- Under `nativePackage: 'core'`: `_vectorMirror` is rebuilt on demand. First `recall({...})` after restart calls `backend.get(id)` for each hit's id, populating the mirror lazily. Adds ~ms latency per first-touch.
- Under `nativePackage: 'router'`: hyperbolic re-rank reports `unsupported [post-restart]` for pre-restart memories. The `_vectorMirror` returns null; the existing `if (!v) return h;` short-circuit keeps the upstream cosine. Document this as a router-specific degradation.

**Pros**: smaller sidecar (~50 bytes/memory instead of ~4 KB). No vector encoding decision needed.

**Cons**: split-personality across backends. Two paths to reason about. Adds a `KbBackend.get(id)` method that router can't implement. Hyperbolic re-rank becomes silently transport-dependent.

### Architecture C — Sibling binary file for vectors

Tags persist in v2 sidecar. Vectors persist in a SEPARATE binary file: `${storage}.${agentId}.vectors.bin` containing concatenated Float32Array bytes, with an index in the v2 sidecar mapping id → byte offset.

**Pros**: most space-efficient. No JSON parser overhead on huge vector blobs. Aligns with how upstream storage typically structures its own vector files.

**Cons**: two-file durability story. Atomic write across two files needs more careful sequencing (write-vectors-tmp → rename-vectors → write-sidecar-tmp → rename-sidecar). Crash recovery is non-trivial (vectors file modified but sidecar not yet → orphaned bytes). Significantly more complex than A.

---

## Recommendation: **Architecture A** (single-sidecar v2, base64-encoded vectors)

Reasons:

1. **Backend-agnostic** simplifies the mental model. Users don't need to know that hyperbolic re-rank degrades differently on router vs core. M30's `dormantBlockerOnBroken: 'sdk-integration'` already covers any persistence failures uniformly.
2. **Schema-versioned migration is a known-pattern.** M27's `loadTextStore` already does version validation; extending to accept v1 is a one-line addition. Lazy upgrade preserves M27's "last write wins" durability semantics.
3. **`KbBackend.get(id)` is a meaningful interface change** that we'd need to motivate independently. M31 shouldn't bundle that work.
4. **Sidecar size** is the only honest concern. At 768-dim × 4 bytes × 4/3 base64 inflation ≈ 4 KB/memory, a 10k-memory agent is ~40 MB sidecar. Full-rewrite-per-call (M27 inherited trade-off) means write latency would grow to ~tens-of-ms per remember(). For v0.5, acceptable; documented limitation.
5. **Architecture C's two-file durability is over-engineering for v0.5.** Crash recovery across two files needs ~50 LOC of journal logic; A keeps M27's single-rename atomicity.

Architecture B is not *wrong*, but it makes the SDK's behavior bind-package-dependent in a way that contradicts the v0.3 publish-ready story (router-only deployment must work the same as core). Defer until concrete user demand for "tiny sidecars" emerges.

---

## Cross-archetype boundaries

### Graph relations (out of M31's scope)

`_graph` is a `GraphReasoner` instance the user supplies via DI. AgentMemory writes `mem:<id>` and `tag:<id>` nodes plus `TAGGED` edges into it (via `addBatch`). The persistence of those nodes/edges is the GraphReasoner's responsibility, not AgentMemory's.

GraphReasoner today wraps `@ruvector/graph-node.GraphDatabase`, which has `GraphDatabase.open(path)` for persistent mode. If the user constructs `await GraphReasoner.create({ storagePath: '/path/to/graph' })`, graph relations persist. If not, they're in-memory.

**M31 documents this boundary**: AgentMemory's value report should NOT claim graph-relations persistence. The user's GraphReasoner DI does or doesn't, independent of AgentMemory's `storage` option. A future milestone might add a unified durability story across archetypes (cross-archetype DI scoping doc territory), but it's separate work.

### M30 catalog row interaction

`textPersistence` is the catalog row M28 added and M30 wired up. After M31.1 (tags persist) and M31.2 (vectors persist), the row's lift becomes broader: "all SDK-side state (text + tags + vectors + seq) persists across restart."

Two paths:
- **Path X (recommended)**: rename the row from `textPersistence` → `statePersistence`. Backwards-incompatible for any code reading the catalog by name; mitigation = grep for `'textPersistence'` and rewrite (low blast radius — it's referenced in 1 demo and 1 catalog entry).
- **Path Y**: keep `textPersistence` as the name; expand the lift text. Backwards-compatible but the name lies a little.

Lean Path X — names should describe what they classify. The rename is a one-commit change with M31.1.

### Reprobe coverage

M31 introduces no upstream surface change; existing reprobe tracking (38 signals) stays as-is. PRD §11.6's coverage map needs no update.

---

## Open questions for the user

These are the decisions that lock M31.1's contents. Each has a lean for ratification.

1. **Architecture A, B, or C?** Lean: **A** (single-sidecar v2, base64-encoded vectors). Backend-agnostic; smallest delta from M27.

2. **Vector encoding under Architecture A?** Lean: **base64**. JSON-safe, round-trip is straightforward via Node's `Buffer`. Plain-array is human-readable but ~2x larger; binary-sibling-file is over-engineered for v0.5.

3. **v1 sidecar compatibility on load?** Lean: **silently accept v1; treat tags + vectors as empty maps; next write upgrades to v2.** Failing on v1 with `TEXT_STORE_VERSION_MISMATCH` is technically correct but breaks user data without a migration tool.

4. **Catalog row name?** Lean: **rename `textPersistence` → `statePersistence`** with M31.1. The row's lift describes broader scope post-M31; the name should match. ~3 occurrences to update.

5. **Schema bump procedure: lazy or eager?** Lean: **lazy** (only write v2 when something changes; v1 stays v1 until next remember/forget). Preserves "no surprise writes" — user's existing v1 file isn't rewritten just because they opened the SDK and called healthCheck.

6. **Graph relations**: confirm out-of-scope (user's GraphReasoner DI handles its own persistence)? Lean: **yes, document the boundary in M31's source comment + journal entry, defer cross-archetype unified durability to a separate scoping pass**.

7. **Order of delivery — combined M31.1 (tags+vectors) or split M31.1 (tags) → M31.2 (vectors)?** Lean: **split**. Tags are a small, contained change (~30 LOC) with clear value (recall({tags}) works after restart). Vectors are a meaningfully bigger change (encoding, larger sidecar size, more probe surface). Splitting preserves the milestone-by-milestone discipline; each ship-task ≤ half a session. M31.1 ships tags; M31.2 ships vectors with the catalog rename.

8. **`KbBackend.get(id)` interface addition?** Out of scope per Architecture A — but worth noting: if Architecture B were chosen (or for a future use case), adding `get(id)` to the interface is a parallel scoping doc. Today, no archetype needs it. Deferred indefinitely.

9. **Sidecar scale concern**: full-rewrite-per-call inherited from M27. At 10k memories ≈ 40 MB rewrite per remember(). Lean: **defer journal-append milestone until concrete user complaints**. Document the trade-off in M31.1's JSDoc + journal entry. v1 milestone candidate.

---

## Findings worth surfacing regardless of M31 path

- **`@ruvector/router.VectorDb` lacks `get(id)`**. Issue-class candidate for a future paste-ready upstream report? Comparable to Issue #11 (delete deadlock) — same package, surface gap. M31 surfaces this; whether to file an upstream issue is a separate user call. Today the SDK works around it via Architecture A's persist-vectors path.

- **`_seq` could theoretically be derived** from `getAllIds()` + parsing `mem:<agent>:<seq>` IDs, but that's circular logic for the M27 reason: we issue the next ID before the backend even sees it. Persisting `_seq` is the right call. Not changing in M31.

- **Hyperbolic re-rank is the only consumer of `_vectorMirror` post-write**. If hyperbolic were `unsupported` (which it is by default until user opts in via `hyperbolic: true`), `_vectorMirror`'s persistence wouldn't matter. M31's vector persistence is *only* useful when `hyperbolic: true`. Could be argued: persist vectors only when hyperbolic was opted in. Lean: **persist always when storage is set**; conditionally persisting based on opt-ins makes the schema runtime-state-dependent, which complicates upgrades.

---

## Cross-references

- **PRD §5.4** — defines AgentMemory's durability story M31 delivers on
- **m6-scope.md** — M27/M28/M29/M30 journal entries (newest at top); M27 is the predecessor mechanism, M30 is the catalog-row final state
- **m17-scope.md** — pattern reference for this scoping doc structure
- **m13-scope.md** — original AgentMemory scoping; M31 extends its v0.1 "in-process state" model to v0.5 durability
- **packages/sdk/src/archetypes/AgentMemory.ts** — `_memoryTags` (line 337), `_vectorMirror` (line 342), `_textStore` (line 356), `_textStorePath` (line 359), `loadTextStore` (line 1120), `_persistTextStoreIfBacked` (line 777)
- **packages/sdk/src/backends/router-kb.ts** — the router VectorDb adapter; surface gap (`getAllIds` but no `get`) is the primary motivation for Architecture A over B
- **packages/sdk/src/backends/native-core.ts:39** — `CoreVectorDb.get(id)` exists, but `KbBackend` doesn't expose it. M31 doesn't change this.
