# Archetype: TimeSeriesMemory

*Auto-generated from `tools/archetypes/assignments.mjs` and `catalog/catalog.json`.*

**Seed archetype** (PRD §5.2).

**Workload.** Sequential, streaming, windowed retrieval.

**Why this archetype.** Strong upstream support: Mamba SSM in attention, full delta-* family for change-detection, neural-trader-* for financial time series.

Headline: ✅ exposed at SDK top-level.

## Members (12)

| Conf | Crate | Items | Flags | ADRs |
|---|---|--:|---|---|
| 🟢 | `ruvector-attention` | 329 | cfg=28 | ADR-014, ADR-015, ADR-025, ADR-044, +11 |
| 🟢 | `ruvector-core` | 224 | cfg=49 | ADR-001, ADR-003, ADR-014, ADR-015, +11 |
| 🟢 | `ruvector-temporal-tensor` | 123 | cfg=26 | ADR-017, ADR-025, ADR-045, ADR-053, +1 |
| 🟢 | `ruvector-kalshi` | 65 |  | ADR-153 |
| 🟢 | `ruvector-delta-core` | 48 | cfg=4 | ADR-071, ADR-076 |
| 🟢 | `ruvector-delta-consensus` | 42 |  | ADR-045, ADR-107 |
| 🟢 | `neural-trader-strategies` | 33 |  | ADR-153 |
| 🟢 | `ruvector-delta-index` | 31 | orphan | — |
| 🟡 | `ruvector-delta-graph` | 30 | orphan | — |
| 🟢 | `neural-trader-core` | 11 |  | ADR-085, ADR-086, ADR-153 |
| 🟢 | `neural-trader-coherence` | 9 |  | ADR-085, ADR-086, ADR-153 |
| 🟢 | `neural-trader-replay` | 8 |  | ADR-085, ADR-086, ADR-153 |

### Rationale per crate

- **`ruvector-attention`** — 50+ attention mechanisms incl. Mamba SSM, FlashAttention-3, MLA. Multi-archetype.
  - ADR evidence: ADR-015, ADR-044
- **`ruvector-core`** — Foundation: hybrid search, RRF, ColBERT, Matryoshka, OPQ, LSM compaction. Listed in upstream README as the home of most retrieval primitives. Wired by every archetype.
  - ADR evidence: ADR-001, ADR-003, ADR-014
- **`ruvector-temporal-tensor`** — Temporal tensor compression and reuse.
  - ADR evidence: ADR-017
- **`ruvector-kalshi`** — Kalshi (prediction-market) integration per ADR-153.
  - ADR evidence: ADR-153
- **`ruvector-delta-core`** — Delta-behavior primitives for change tracking.
  - ADR evidence: ADR-016
- **`ruvector-delta-consensus`** — CRDTs for distributed change propagation.
- **`neural-trader-strategies`** — Strategy library.
- **`ruvector-delta-index`** — Delta indexing.
- **`ruvector-delta-graph`** — Delta-aware graph; spans both TimeSeries and Graph workloads.
- **`neural-trader-core`** — Reference financial TS application; demonstrates TimeSeriesMemory archetype shape.
- **`neural-trader-coherence`** — Coherence layer for trader.
- **`neural-trader-replay`** — Replay primitive.
