# Archetype: RecommendationEngine

*Auto-generated from `tools/archetypes/assignments.mjs` and `catalog/catalog.json`.*

**Seed archetype** (PRD §5.2).

**Workload.** User × item retrieval, collaborative filtering.

**Why this archetype.** Bipartite GNN + temporal compression are upstream primitives that fit. Risk: similar to CodebaseIndex, no dedicated upstream crate exists.

> ⚠ Risk: `thin-upstream-support`

Headline: ✅ exposed at SDK top-level.

## Members (1)

| Conf | Crate | Items | Flags | ADRs |
|---|---|--:|---|---|
| 🟢 | `ruvector-gnn` | 84 | cfg=14 | ADR-014, ADR-025, ADR-045, ADR-046, +5 |

### Rationale per crate

- **`ruvector-gnn`** — GNN layers learn from queries — multi-archetype core. Listed in PRD §5.2 as default-active for KnowledgeBase and AgentMemory.
  - ADR evidence: ADR-014, ADR-046
