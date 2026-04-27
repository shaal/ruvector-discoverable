# `@ruvector/graph-node@2.0.3`: `query()` returns empty for any Cypher input

## Affected versions

- `@ruvector/graph-node@2.0.3` (npm)
- `@ruvector/graph-node-darwin-arm64@2.0.2` (the platform package the umbrella resolves)

Tested on macOS 25.3.0 / aarch64-apple-darwin / Node 22.22.0.

## Summary

The `query()` and `querySync()` methods on `GraphDatabase` always return `{ nodes: [], edges: [] }` regardless of the Cypher input — even for `MATCH (n) RETURN n`. Inserts work, k-hop traversal works, hyperedge search works, `stats()` correctly reports inserted node and edge counts. **Only Cypher query execution is non-functional.**

This makes the headline `@ruvector/graph-node` capability advertised in the package description ("Cypher queries") functionally unusable in the published binary.

## Reproducer

```js
import { GraphDatabase } from '@ruvector/graph-node';
const db = new GraphDatabase({ dimensions: 4, distanceMetric: 'Cosine' });
await db.batchInsert({
  nodes: [
    { id: 'a', embedding: new Float32Array([1, 0, 0, 0]), labels: ['User'] },
    { id: 'b', embedding: new Float32Array([0, 1, 0, 0]), labels: ['Doc'] },
  ],
  edges: [
    { from: 'a', to: 'b', description: 'OWNS', embedding: new Float32Array([0, 0, 1, 0]) },
  ],
});
console.log('stats:', await db.stats());
// { totalNodes: 2, totalEdges: 1, avgDegree: 1 }   ← inserts confirmed

for (const q of [
  'MATCH (n) RETURN n',
  'MATCH (u:User) RETURN u',
  'MATCH (u:User)-[:OWNS]->(d:Doc) RETURN u, d',
  'MATCH (u)-[r]->(d) RETURN u, r, d',
]) {
  const r = await db.query(q);
  console.log(q.padEnd(46), '→', r.nodes.length, 'nodes,', r.edges.length, 'edges');
}
```

## Expected

`MATCH (n) RETURN n` should return both inserted nodes (`a` and `b`). Each subsequent query should return the appropriate subset matching the pattern.

## Actual

Every query returns `0 nodes, 0 edges`:

```
stats: { totalNodes: 2, totalEdges: 1, avgDegree: 1 }
MATCH (n) RETURN n                             → 0 nodes, 0 edges
MATCH (u:User) RETURN u                        → 0 nodes, 0 edges
MATCH (u:User)-[:OWNS]->(d:Doc) RETURN u, d    → 0 nodes, 0 edges
MATCH (u)-[r]->(d) RETURN u, r, d              → 0 nodes, 0 edges
```

`querySync` exhibits identical behavior. `kHopNeighbors`, `searchHyperedges`, `createNode`, `createEdge`, `batchInsert`, `stats`, `subscribe` all work correctly.

## Detection by an integrating SDK

A downstream SDK's tier-2 smoke check surfaced this automatically by inserting a known node, running `MATCH (n) RETURN n`, and asserting the result includes that node. Diagnostic produced:

```
✗ cypher  broken  MATCH (n) RETURN n returned 0 nodes despite stats showing 2.
                  Cypher engine is a stub in this binding version.
```

## Suggested fix

Either (a) wire the Cypher engine through the NAPI binding properly, or (b) remove `query`/`querySync` from the binding's exported surface in v2.0.4 with a deprecation note pointing to `kHopNeighbors` / `searchHyperedges` until the engine ships. Option (b) is friendlier to integrators because the current shape — `query()` exists, accepts Cypher syntax, returns the right *shape* of result — looks like a working API and only fails after the user trusts it.

A documentation note in the meantime would prevent integrators from building features that look like they work in CI smoke tests but return empty in production.
