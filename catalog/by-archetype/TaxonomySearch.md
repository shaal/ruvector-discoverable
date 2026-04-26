# Archetype: TaxonomySearch

*Auto-generated from `tools/archetypes/assignments.mjs` and `catalog/catalog.json`.*

**Seed archetype** (PRD §5.2).

**Workload.** Hierarchical / tree-shaped data retrieval.

**Why this archetype.** Hyperbolic HNSW is upstream's differentiator here. Risk: ruvector-hyperbolic-hnsw is excluded from the default workspace per Cargo.toml. v0.2 task: confirm intended distribution path.

> ⚠ Risk: `excluded-from-default-workspace`

Headline: ✅ exposed at SDK top-level.

## Members (2)

| Conf | Crate | Items | Flags | ADRs |
|---|---|--:|---|---|
| 🟢 | `ruvector-core` | 224 | cfg=49 | ADR-001, ADR-003, ADR-014, ADR-015, +11 |
| 🟢 | `ruvector-hyperbolic-hnsw` | 59 | risk:workspace-excluded | ADR-014, ADR-088, ADR-103 |

### Rationale per crate

- **`ruvector-core`** — Foundation: hybrid search, RRF, ColBERT, Matryoshka, OPQ, LSM compaction. Listed in upstream README as the home of most retrieval primitives. Wired by every archetype.
  - ADR evidence: ADR-001, ADR-003, ADR-014
- **`ruvector-hyperbolic-hnsw`** — Hyperbolic HNSW — hierarchy-aware search in Poincaré ball. Excluded from default workspace; confirm distribution path.
  - ADR evidence: ADR-088, ADR-103
