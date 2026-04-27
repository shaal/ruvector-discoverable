# `@ruvector/graph-wasm@2.0.2`: missing methods + broken hyperedges + silent importCypher + Cypher stub

## Affected versions

- `@ruvector/graph-wasm@2.0.2` (npm) — multiple defects affecting GraphReasoner WASM transport

## Summary

Live integration of `@ruvector/graph-wasm@2.0.2` into the SDK's `WasmGraphBackend` (M17.1) surfaced four distinct issues with the WASM binding's `GraphDB`:

1. **Cypher engine is a stub** — same defect class as Issue #01 on `@ruvector/graph-node@2.0.3`. `query()` returns 0 nodes/edges regardless of the input query, even for `MATCH (n) RETURN n` after inserts.
2. **`createHyperedge` is unusable** — throws `"Failed to add hyperedge: Invalid input: Entity <uuid> not found in hypergraph"` even when the constituent nodes were just created via `createNode`. The hypergraph appears to be a separate index that `createNode` doesn't populate; no public method puts entities into it.
3. **`importCypher` is a silent no-op** — returns a non-zero count claiming statements were imported, but `stats()` shows the node/edge counts unchanged. No error thrown; the consumer can't tell the import didn't happen.
4. **Four central methods are missing entirely** — `kHopNeighbors`, `searchHyperedges`, `batchInsert`, and `subscribe` are all in `@ruvector/graph-node`'s NAPI surface but absent from `@ruvector/graph-wasm`'s class. This forces SDK consumers wanting graph traversal or hyperedge-vector-search to use the native transport — a regression for browser-targeted apps.

The SDK ships `WasmGraphBackend` covering only the working surface (`createNode`, `createEdge`, `getNode`, `getEdge`, `stats`, `deleteNode`, `deleteEdge`, `exportCypher`); the four missing methods throw `RuVectorError('CAPABILITY_DEFERRED', ...)` with a transport-pointer message; the broken three surface as `dormant [upstream-bug]` in `getValueReport()`.

## Reproducers

### 1. Cypher stub (same as Issue #01 in native)

```js
import * as m from '@ruvector/graph-wasm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
await m.default({ module_or_path: readFileSync(req.resolve('@ruvector/graph-wasm/ruvector_graph_wasm_bg.wasm')) });

const db = new m.GraphDB('cosine');
db.createNode(['User'], { name: 'Alice' });
db.createNode(['User'], { name: 'Bob' });
console.log(JSON.stringify(db.stats()));
// → {"nodeCount":2,"edgeCount":0, ...}

const r = await db.query('MATCH (n) RETURN n');
console.log('nodes:', r.nodes.length, 'edges:', r.edges.length);
// → nodes: 0 edges: 0     ← stub: stats says 2 nodes, query returns 0
```

### 2. `createHyperedge` "Entity not found in hypergraph"

```js
const db = new m.GraphDB('cosine');
const a = db.createNode(['User'], { name: 'Alice' });
const b = db.createNode(['User'], { name: 'Bob' });
console.log(db.stats());
// → {"nodeCount":2, "edgeCount":0, "hyperedgeCount":0, "hypergraphEntities":0, ...}

await db.createHyperedge([a, b], 'COLLABORATES', new Float32Array([0.1, 0.2, 0.3, 0.4]), 0.95);
// → throws: "Failed to add hyperedge: Invalid input: Entity <uuid> not found in hypergraph"
```

The error message references the freshly-returned UUIDs from `createNode`. Note `stats()` exposes `hypergraphEntities: 0` — confirming the hypergraph is a separate population that `createNode` doesn't write into. There is no public method on `GraphDB` to add an entity to the hypergraph index.

### 3. `importCypher` silent no-op

```js
const db = new m.GraphDB('cosine');
const before = db.stats().nodeCount;  // 0
const n = await db.importCypher(['CREATE (a:Person {name: "Charlie"})']);
const after = db.stats().nodeCount;   // 0
console.log({ before, after, returned: n });
// → { before: 0, after: 0, returned: 1 }
// importCypher returned `1` (claiming 1 statement imported) but no node was added.
```

`exportCypher` works correctly and produces valid CREATE statements; the reverse path appears to be wired only at the count-return level, not at the actual graph-mutation level.

### 4. Missing methods (`kHopNeighbors`, `searchHyperedges`, `batchInsert`, `subscribe`)

Per `node_modules/@ruvector/graph-wasm/ruvector_graph_wasm.d.ts`:

```ts
export class GraphDB {
  // PRESENT:
  createEdge, createNode, createHyperedge, deleteEdge, deleteNode,
  exportCypher, importCypher, getEdge, getNode, getHyperedge, query, stats

  // ABSENT (vs @ruvector/graph-node 2.0.3's NAPI surface):
  // kHopNeighbors, searchHyperedges, batchInsert, subscribe
}
```

The native binding's `GraphDatabase` exposes all four.

## Expected

1. `query('MATCH (n) RETURN n')` should return the inserted nodes (or fail loudly if Cypher is intentionally not implemented — silent empty results are the worst-case UX).
2. `createHyperedge([nodeA, nodeB], desc, embedding)` with nodes that exist via `createNode` should succeed.
3. `importCypher` should either produce visible nodes/edges in `stats()` after the call, or throw rather than return a misleading success count.
4. `kHopNeighbors` / `searchHyperedges` / `batchInsert` / `subscribe` should be exposed (preferred) or explicitly documented as native-only.

## Actual

All four issues observed live on `@ruvector/graph-wasm@2.0.2` installed fresh from npm.

## Workaround in downstream SDK

The SDK's `WasmGraphBackend` (`packages/sdk/src/backends/wasm-graph.ts`):

- Implements only the methods that work; the missing four throw `RuVectorError('CAPABILITY_DEFERRED', ...)` with a "use transport: 'native'" pointer.
- The broken three (Cypher / createHyperedge / importCypher) are passed through; the smoke-check observes their `broken` status and the value report classifies them `dormant [upstream-bug]` automatically. When upstream fixes any, the SDK's classification flips to `active` on the next health check (M6.2 self-correcting pattern).
- `batchInsert` is synthesized atop per-call `createNode` / `createEdge` (slower than a real batch).

## Suggested fix priority

In order of consumer impact:

1. **`createHyperedge` first** — hyperedges are the most differentiating feature of `ruvector-graph` vs other graph DBs.
2. **`kHopNeighbors`** — most commonly-used graph traversal primitive.
3. **`importCypher`** — return-value-without-effect is worse than throwing.
4. **Cypher stub** — same priority as Issue #01; one fix likely covers both bindings.
5. **`searchHyperedges` + `batchInsert` + `subscribe`** — round out the parity story.

## Cross-references

- Issue #01 — `@ruvector/graph-node@2.0.3` Cypher stub (likely shares root cause with WASM Cypher stub here)
- Issue #02 / #08 — broken-publish defect class for npm packages
- SDK reference: `packages/sdk/src/backends/wasm-graph.ts` — adapter that lives with these defects
- SDK reference: `docs/plans/m17-scope.md` — original M17 scoping (anticipated some gaps; full scope surfaced at M17.1 implementation)

## SDK diagnostic that will detect resolution

The SDK's tier-1 binding probes (`WasmGraphBackend.smokeCheck`) include named probes for `cypher`, `cypherExport`, `cypherImport`, `nodeDelete`, plus declared-`unsupported` results for `kHopNeighbors` / `searchHyperedges`. When upstream fixes any, the next `healthCheck()` flips the corresponding catalog row from `dormant` → `active` with no SDK code change. `tools/reprobe-bindings/reprobe.mjs` v0.4 already tracks `@ruvector/graph-wasm`; surface-contract probes (similar to M11.3 v0.2 CLI checks) can extend it once the .d.ts gains the four absent methods.
