# Archetype: GraphReasoner

*Auto-generated from `tools/archetypes/assignments.mjs` and `catalog/catalog.json`.*

**Seed archetype** (PRD §5.2).

**Workload.** Multi-hop graph queries, Cypher, sublinear graph algorithms.

**Why this archetype.** Best-supported archetype: ruvector-graph (Cypher engine), ruvector-graph-transformer, ruvector-solver (sublinear PageRank), ruvector-sparsifier, ruvector-mincut family.

Headline: ✅ exposed at SDK top-level.

## Members (11)

| Conf | Crate | Items | Flags | ADRs |
|---|---|--:|---|---|
| 🟢 | `ruvector-mincut` | 479 | cfg=128 | ADR-014, ADR-025, ADR-045, ADR-046, +10 |
| 🟢 | `ruvector-graph` | 329 | cfg=75 | ADR-014, ADR-046, ADR-047, ADR-058, +2 |
| 🟢 | `ruvector-mincut-gated-transformer` | 260 | cfg=48 | ADR-004, ADR-045, ADR-046, ADR-047, +4 |
| 🟢 | `ruvector-core` | 224 | cfg=49 | ADR-001, ADR-003, ADR-014, ADR-015, +11 |
| 🟢 | `ruvector-dag` | 196 | cfg=124 | ADR-016, ADR-053, ADR-054 |
| 🟢 | `ruvector-graph-transformer` | 128 | cfg=104 | ADR-025, ADR-046, ADR-047, ADR-048, +8 |
| 🟢 | `ruvector-gnn` | 84 | cfg=14 | ADR-014, ADR-025, ADR-045, ADR-046, +5 |
| 🟢 | `ruvector-solver` | 71 | cfg=19 | ADR-025, ADR-044, ADR-045, ADR-046, +7 |
| 🟢 | `ruvector-sparsifier` | 38 |  | ADR-116, ADR-117, ADR-151 |
| 🟡 | `ruvector-delta-graph` | 30 | orphan | — |
| 🟢 | `ruvector-attn-mincut` | 27 |  | ADR-151, ADR-153 |

### Rationale per crate

- **`ruvector-mincut`** — Mincut primitives. Big crate (479 items, 128 cfg-gated).
  - ADR evidence: ADR-014, ADR-046
- **`ruvector-graph`** — Cypher engine + hyperedges. Core for both Graph RAG (KnowledgeBase) and multi-hop reasoning.
  - ADR evidence: ADR-046, ADR-047
- **`ruvector-mincut-gated-transformer`** — Dynamic attention gated by graph mincut.
  - ADR evidence: ADR-046
- **`ruvector-core`** — Foundation: hybrid search, RRF, ColBERT, Matryoshka, OPQ, LSM compaction. Listed in upstream README as the home of most retrieval primitives. Wired by every archetype.
  - ADR evidence: ADR-001, ADR-003, ADR-014
- **`ruvector-dag`** — Self-learning DAG execution for multi-step pipelines.
  - ADR evidence: ADR-053, ADR-054
- **`ruvector-graph-transformer`** — 8 verified modules per README: physics, bio, manifold, temporal, economic, etc.
  - ADR evidence: ADR-046, ADR-047, ADR-048
- **`ruvector-gnn`** — GNN layers learn from queries — multi-archetype core. Listed in PRD §5.2 as default-active for KnowledgeBase and AgentMemory.
  - ADR evidence: ADR-014, ADR-046
- **`ruvector-solver`** — Sublinear PageRank, conjugate gradient, BMSSP — the upstream README's "8 algorithms".
  - ADR evidence: ADR-044, ADR-046
- **`ruvector-sparsifier`** — Spectral sparsification — keeps a small shadow graph.
- **`ruvector-delta-graph`** — Delta-aware graph; spans both TimeSeries and Graph workloads.
- **`ruvector-attn-mincut`** — Attention layer using mincut for pruning.
