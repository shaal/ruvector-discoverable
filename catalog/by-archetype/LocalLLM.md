# Archetype: LocalLLM

*Auto-generated from `tools/archetypes/assignments.mjs` and `catalog/catalog.json`.*

**Proposed in M4 v0.1** — evidence-driven addition. See PRD §6.9 for the archetype-evolution rule that allows this.

**Workload.** Run LLMs locally on heterogeneous hardware (Metal/CUDA/WebGPU/CPU) without cloud APIs.

**Why this archetype.** ruvllm alone is 1,547 items, an order of magnitude larger than any other crate. ADR-002 establishes it as a first-class component. Has dedicated CLI, WASM, and per-platform binary distributions in npm. Forcing this into an "advanced" namespace would be inverted opt-in failure: it IS upstream's headline differentiator from cloud vector DBs.

Headline: ✅ exposed at SDK top-level.

## Members (4)

| Conf | Crate | Items | Flags | ADRs |
|---|---|--:|---|---|
| 🟢 | `ruvllm` | 1547 | cfg=343 | ADR-003, ADR-007, ADR-008, ADR-013, +16 |
| 🟢 | `ruvector-sparse-inference` | 177 | cfg=3 | ADR-025 |
| 🟢 | `ruvector-tiny-dancer-core` | 50 | orphan | — |
| 🟢 | `ruvllm-cli` | 0 | orphan | — |

### Rationale per crate

- **`ruvllm`** — Headline LLM runtime. 1547 items, 343 cfg-gated. Single largest crate.
  - ADR evidence: ADR-002, ADR-008, ADR-013
- **`ruvector-sparse-inference`** — PowerInfer-style sparse activation; 2-10x faster on edge.
  - ADR evidence: ADR-025
- **`ruvector-tiny-dancer-core`** — FastGRNN agent-routing — lightweight LLM alternative per README.
- **`ruvllm-cli`** — LLM CLI.

### Archetype-level citation evidence
- ADRs: ADR-002, ADR-004, ADR-008, ADR-009, ADR-010, ADR-011, ADR-013
- Biggest crates: `ruvllm`, `ruvector-tiny-dancer-core`, `ruvector-sparse-inference`
