# Archetype: KnowledgeBase

*Auto-generated from `tools/archetypes/assignments.mjs` and `catalog/catalog.json`.*

**Seed archetype** (PRD §5.2).

**Workload.** RAG over documents and other unstructured corpora.

**Why this archetype.** Primary expected entry point for SDK adopters. Hybrid search + Graph RAG + ColBERT + SONA learning is the differentiating pipeline upstream provides.

Headline: ✅ exposed at SDK top-level.

## Members (9)

| Conf | Crate | Items | Flags | ADRs |
|---|---|--:|---|---|
| 🟢 | `ruvector-attention` | 329 | cfg=28 | ADR-014, ADR-015, ADR-025, ADR-044, +11 |
| 🟢 | `ruvector-graph` | 329 | cfg=75 | ADR-014, ADR-046, ADR-047, ADR-058, +2 |
| 🟡 | `ruvector-cnn` | 287 | cfg=114 | ADR-088, ADR-091, ADR-091, ADR-117, +2 |
| 🟢 | `ruvector-core` | 224 | cfg=49 | ADR-001, ADR-003, ADR-014, ADR-015, +11 |
| 🟢 | `sona` | 154 | napi=3 wasm=4 cfg=104 | ADR-014, ADR-025, ADR-044, ADR-057, +6 |
| 🟢 | `ruvector-gnn` | 84 | cfg=14 | ADR-014, ADR-025, ADR-045, ADR-046, +5 |
| 🟢 | `ruvector-rabitq` | 40 |  | ADR-154, ADR-155, ADR-157, ADR-158 |
| 🟢 | `ruvector-rulake` | 35 |  | ADR-155, ADR-157 |
| 🟢 | `ruvector-diskann` | 25 | cfg=4 | ADR-143, ADR-144, ADR-146, ADR-148 |

### Rationale per crate

- **`ruvector-attention`** — 50+ attention mechanisms incl. Mamba SSM, FlashAttention-3, MLA. Multi-archetype.
  - ADR evidence: ADR-015, ADR-044
- **`ruvector-graph`** — Cypher engine + hyperedges. Core for both Graph RAG (KnowledgeBase) and multi-hop reasoning.
  - ADR evidence: ADR-046, ADR-047
- **`ruvector-cnn`** — MobileNet-V3 image embeddings for multimodal KnowledgeBase. Sub-archetype of KB; advanced for now.
  - ADR evidence: ADR-088, ADR-091, ADR-117
- **`ruvector-core`** — Foundation: hybrid search, RRF, ColBERT, Matryoshka, OPQ, LSM compaction. Listed in upstream README as the home of most retrieval primitives. Wired by every archetype.
  - ADR evidence: ADR-001, ADR-003, ADR-014
- **`sona`** — SONA continual learning (LoRA + EWC++). The "self-learning" half of upstream's pitch. NAPI-bound (3 items) so SDK consumer-facing.
  - ADR evidence: ADR-014, ADR-044, ADR-057
- **`ruvector-gnn`** — GNN layers learn from queries — multi-archetype core. Listed in PRD §5.2 as default-active for KnowledgeBase and AgentMemory.
  - ADR evidence: ADR-014, ADR-046
- **`ruvector-rabitq`** — Rotation binary quantization — efficiency layer for hybrid search.
  - ADR evidence: ADR-154
- **`ruvector-rulake`** — Datalake substrate per ADR-155/156.
  - ADR evidence: ADR-155, ADR-156
- **`ruvector-diskann`** — SSD-backed billion-scale ANN with Vamana graph. Per upstream README, key for KnowledgeBase at scale.
  - ADR evidence: ADR-143, ADR-144, ADR-146
