# Archetype: AgentMemory

*Auto-generated from `tools/archetypes/assignments.mjs` and `catalog/catalog.json`.*

**Seed archetype** (PRD §5.2).

**Workload.** Long-term memory for AI agents — recall, hierarchy, feedback-driven improvement.

**Why this archetype.** Distinct from KnowledgeBase because the workload writes more than it reads, prizes hierarchical/temporal recall, and benefits most from SONA continual learning.

Headline: ✅ exposed at SDK top-level.

## Members (5)

| Conf | Crate | Items | Flags | ADRs |
|---|---|--:|---|---|
| 🟢 | `ruvector-attention` | 329 | cfg=28 | ADR-014, ADR-015, ADR-025, ADR-044, +11 |
| 🟢 | `ruvector-mincut-gated-transformer` | 260 | cfg=48 | ADR-004, ADR-045, ADR-046, ADR-047, +4 |
| 🟢 | `ruvector-core` | 224 | cfg=49 | ADR-001, ADR-003, ADR-014, ADR-015, +11 |
| 🟢 | `sona` | 154 | napi=3 wasm=4 cfg=104 | ADR-014, ADR-025, ADR-044, ADR-057, +6 |
| 🟢 | `ruvector-gnn` | 84 | cfg=14 | ADR-014, ADR-025, ADR-045, ADR-046, +5 |

### Rationale per crate

- **`ruvector-attention`** — 50+ attention mechanisms incl. Mamba SSM, FlashAttention-3, MLA. Multi-archetype.
  - ADR evidence: ADR-015, ADR-044
- **`ruvector-mincut-gated-transformer`** — Dynamic attention gated by graph mincut.
  - ADR evidence: ADR-046
- **`ruvector-core`** — Foundation: hybrid search, RRF, ColBERT, Matryoshka, OPQ, LSM compaction. Listed in upstream README as the home of most retrieval primitives. Wired by every archetype.
  - ADR evidence: ADR-001, ADR-003, ADR-014
- **`sona`** — SONA continual learning (LoRA + EWC++). The "self-learning" half of upstream's pitch. NAPI-bound (3 items) so SDK consumer-facing.
  - ADR evidence: ADR-014, ADR-044, ADR-057
- **`ruvector-gnn`** — GNN layers learn from queries — multi-archetype core. Listed in PRD §5.2 as default-active for KnowledgeBase and AgentMemory.
  - ADR evidence: ADR-014, ADR-046
