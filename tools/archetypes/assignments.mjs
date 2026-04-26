// M4 — Editorial archetype assignments.
//
// Source of truth: M3 catalog (catalog/catalog.json) + M1 ADR catalog.
// Each crate is assigned to one or more archetypes (or to a non-archetype
// category) with confidence + evidence. The generator (generate.mjs)
// applies bulk rules to crates not listed here, then emits per-archetype
// markdown views.
//
// SCOPE OF THIS PASS (v0.1, 2026-04-26):
// - 10 archetypes ratified: 8 seed + 2 evidence-driven additions
//   (LocalLLM, AgentFramework). See `archetypes` below for citations.
// - ~50 most-significant crates are hand-assigned with citations.
// - Bulk rules cover obvious cases (bindings, kernel, scaffolding).
// - Crates not matched by either remain in the catalog as "unclassified".
// - Confidence levels: high (clear evidence), medium (reasonable inference),
//   low (best guess pending more analysis). Don't promote v0.1 lows to
//   PRD-frozen archetype mappings without re-review.

// ---------------- Archetypes ----------------

export const archetypes = {
  // ----- Eight seed archetypes (PRD §5.2) -----

  KnowledgeBase: {
    seed: true,
    workload: 'RAG over documents and other unstructured corpora.',
    rationale: 'Primary expected entry point for SDK adopters. Hybrid search + Graph RAG + ColBERT + SONA learning is the differentiating pipeline upstream provides.',
    headline: true,
  },

  AgentMemory: {
    seed: true,
    workload: 'Long-term memory for AI agents — recall, hierarchy, feedback-driven improvement.',
    rationale: 'Distinct from KnowledgeBase because the workload writes more than it reads, prizes hierarchical/temporal recall, and benefits most from SONA continual learning.',
    headline: true,
  },

  CodebaseIndex: {
    seed: true,
    workload: 'Per-token code retrieval; symbol-aware indexing.',
    rationale: 'High-value SDK use case. Upstream support is currently THIN — ColBERT primitives in core, ruvector-decompiler is JS-only. Flagged as v0.2 risk: archetype may need to ship as recipes-on-top-of-KnowledgeBase rather than a first-class archetype.',
    headline: true,
    risk: 'thin-upstream-support',
  },

  RecommendationEngine: {
    seed: true,
    workload: 'User × item retrieval, collaborative filtering.',
    rationale: 'Bipartite GNN + temporal compression are upstream primitives that fit. Risk: similar to CodebaseIndex, no dedicated upstream crate exists.',
    headline: true,
    risk: 'thin-upstream-support',
  },

  TaxonomySearch: {
    seed: true,
    workload: 'Hierarchical / tree-shaped data retrieval.',
    rationale: 'Hyperbolic HNSW is upstream\'s differentiator here. Risk: ruvector-hyperbolic-hnsw is excluded from the default workspace per Cargo.toml. v0.2 task: confirm intended distribution path.',
    headline: true,
    risk: 'excluded-from-default-workspace',
  },

  TimeSeriesMemory: {
    seed: true,
    workload: 'Sequential, streaming, windowed retrieval.',
    rationale: 'Strong upstream support: Mamba SSM in attention, full delta-* family for change-detection, neural-trader-* for financial time series.',
    headline: true,
  },

  GenomicAnalyzer: {
    seed: true,
    workload: 'Bio sequence storage + variant calling + biomarker scoring.',
    rationale: 'rvDNA exists in npm packages and examples/dna; minimal Rust crate footprint. Risk: largely demo-stage. Demote to recipe if M4 v0.2 confirms no production crate.',
    headline: true,
    risk: 'demo-stage-only',
  },

  GraphReasoner: {
    seed: true,
    workload: 'Multi-hop graph queries, Cypher, sublinear graph algorithms.',
    rationale: 'Best-supported archetype: ruvector-graph (Cypher engine), ruvector-graph-transformer, ruvector-solver (sublinear PageRank), ruvector-sparsifier, ruvector-mincut family.',
    headline: true,
  },

  // ----- Two evidence-driven additions (PRD §6.9 allows this) -----

  LocalLLM: {
    seed: false,
    proposed_in: 'M4 v0.1',
    workload: 'Run LLMs locally on heterogeneous hardware (Metal/CUDA/WebGPU/CPU) without cloud APIs.',
    rationale: 'ruvllm alone is 1,547 items, an order of magnitude larger than any other crate. ADR-002 establishes it as a first-class component. Has dedicated CLI, WASM, and per-platform binary distributions in npm. Forcing this into an "advanced" namespace would be inverted opt-in failure: it IS upstream\'s headline differentiator from cloud vector DBs.',
    headline: true,
    citation_evidence: { adrs: ['ADR-002', 'ADR-004', 'ADR-008', 'ADR-009', 'ADR-010', 'ADR-011', 'ADR-013'], biggest_crates: ['ruvllm', 'ruvector-tiny-dancer-core', 'ruvector-sparse-inference'] },
  },

  AgentFramework: {
    seed: false,
    proposed_in: 'M4 v0.1',
    workload: 'Build, run, and orchestrate AI agents with policy, A2A communication, and tool dispatch.',
    rationale: 'rvAgent family is 10 nested crates totaling ~620 public items, with explicit ADRs (ADR-159 A2A protocol, ADR-104/105/107 framework structure, ADR-100 RVF integration). It is a distinct workload from AgentMemory: AgentMemory is the *substrate*, AgentFramework is the *orchestration layer* (protocols, policies, tools, sub-agents).',
    headline: true,
    citation_evidence: { adrs: ['ADR-100', 'ADR-104', 'ADR-105', 'ADR-107', 'ADR-108', 'ADR-112', 'ADR-113', 'ADR-159'], biggest_crates: ['rvagent-core', 'rvagent-a2a', 'rvagent-mcp', 'rvagent-middleware', 'rvagent-backends'] },
  },
};

// ---------------- Non-archetype categories ----------------
// These are cross-cutting roles. A crate may be both `core` and serve archetypes.

export const categories = {
  core:           { description: 'Foundational primitives shared by every archetype. Always wired in.' },
  bindings:       { description: 'Platform bridges (NAPI, WASM, FFI). Consumed by archetypes; not exposed directly.' },
  infrastructure: { description: 'Server, cluster, replication, routing. SDK uses internally; not in headline API.' },
  advanced:       { description: 'Available via `@ruvector/sdk/advanced`. Not in autocomplete-by-default. PRD §5.6 candidates plus M4 additions.' },
  scaffolding:    { description: 'Tests, benches, examples, demos. Not part of any archetype.' },
  out_of_headline:{ description: 'Real upstream surfaces with explicit non-headline distribution paths (postgres extension, FPGA, kernel).' },
  pending_review: { description: 'v0.1 did not editorially review. v0.2 work item.' },
};

// ---------------- Per-crate explicit assignments ----------------
// Format: name → { archetypes: [...], categories: [...], confidence, rationale, evidence }
// At least one of `archetypes` or `categories` must be non-empty.
// Evidence: { adrs: [...], items: ['key item names'], items_count?: N }

export const explicit = {
  // ===== Foundation / core =====

  'ruvector-core': {
    archetypes: ['KnowledgeBase', 'AgentMemory', 'TaxonomySearch', 'GraphReasoner', 'TimeSeriesMemory'],
    categories: ['core'],
    confidence: 'high',
    rationale: 'Foundation: hybrid search, RRF, ColBERT, Matryoshka, OPQ, LSM compaction. Listed in upstream README as the home of most retrieval primitives. Wired by every archetype.',
    evidence: { adrs: ['ADR-001', 'ADR-003', 'ADR-014'], items_count: 224 },
  },
  'ruvector-collections': { categories: ['core'], confidence: 'high', rationale: 'Multi-tenant collection management used across archetypes.', evidence: {} },
  'ruvector-snapshot':    { categories: ['core'], confidence: 'high', rationale: 'Point-in-time backup primitive.', evidence: {} },
  'ruvector-metrics':     { categories: ['core'], confidence: 'high', rationale: 'Observability primitive.', evidence: {} },
  'ruvector-filter':      { categories: ['core'], confidence: 'high', rationale: 'Metadata filtering used across archetypes.', evidence: {} },
  'ruvector-math':        { categories: ['core'], confidence: 'high', rationale: 'Wasserstein, Sinkhorn, KL, spectral clustering — math primitives used by multiple archetypes.', evidence: { adrs: ['ADR-044', 'ADR-088'], items_count: 186 } },
  'ruvector-coherence':   { categories: ['core'], confidence: 'medium', rationale: 'Signal-quality measurement used across pipelines. Could elevate to archetype if it grows.', evidence: { adrs: ['ADR-014'] } },
  'ruvector-profiler':    { categories: ['core'], confidence: 'high', rationale: 'Profiling/diagnostics primitive.', evidence: {} },
  'ruvector-bench':       { categories: ['scaffolding'], confidence: 'high', rationale: 'Benchmark harness only.', evidence: {} },

  // ===== KnowledgeBase =====

  'ruvector-rabitq':      { archetypes: ['KnowledgeBase'], confidence: 'high', rationale: 'Rotation binary quantization — efficiency layer for hybrid search.', evidence: { adrs: ['ADR-154'] } },
  'ruvector-cnn':         { archetypes: ['KnowledgeBase'], categories: ['advanced'], confidence: 'medium', rationale: 'MobileNet-V3 image embeddings for multimodal KnowledgeBase. Sub-archetype of KB; advanced for now.', evidence: { adrs: ['ADR-088', 'ADR-091', 'ADR-117'], items_count: 287 } },
  'ruvector-rulake':      { archetypes: ['KnowledgeBase'], confidence: 'high', rationale: 'Datalake substrate per ADR-155/156.', evidence: { adrs: ['ADR-155', 'ADR-156'] } },

  // ===== AgentMemory =====

  'ruvector-gnn':         { archetypes: ['AgentMemory', 'KnowledgeBase', 'GraphReasoner', 'RecommendationEngine'], confidence: 'high', rationale: 'GNN layers learn from queries — multi-archetype core. Listed in PRD §5.2 as default-active for KnowledgeBase and AgentMemory.', evidence: { adrs: ['ADR-014', 'ADR-046'], items_count: 84 } },
  'sona':                 { archetypes: ['AgentMemory', 'KnowledgeBase'], confidence: 'high', rationale: 'SONA continual learning (LoRA + EWC++). The "self-learning" half of upstream\'s pitch. NAPI-bound (3 items) so SDK consumer-facing.', evidence: { adrs: ['ADR-014', 'ADR-044', 'ADR-057'], items_count: 154 } },
  'ruvector-domain-expansion': { archetypes: ['AgentMemory'], confidence: 'medium', rationale: 'Cross-domain transfer learning — natural fit for agent memory bootstrap.', evidence: { adrs: ['ADR-068', 'ADR-071'], items_count: 90 } },

  // ===== GraphReasoner =====

  'ruvector-graph':                       { archetypes: ['GraphReasoner', 'KnowledgeBase'], confidence: 'high', rationale: 'Cypher engine + hyperedges. Core for both Graph RAG (KnowledgeBase) and multi-hop reasoning.', evidence: { adrs: ['ADR-046', 'ADR-047'], items_count: 329 } },
  'ruvector-graph-transformer':           { archetypes: ['GraphReasoner'], confidence: 'high', rationale: '8 verified modules per README: physics, bio, manifold, temporal, economic, etc.', evidence: { adrs: ['ADR-046', 'ADR-047', 'ADR-048'], items_count: 128 } },
  'ruvector-solver':                      { archetypes: ['GraphReasoner'], confidence: 'high', rationale: 'Sublinear PageRank, conjugate gradient, BMSSP — the upstream README\'s "8 algorithms".', evidence: { adrs: ['ADR-044', 'ADR-046'], items_count: 71 } },
  'ruvector-sparsifier':                  { archetypes: ['GraphReasoner'], confidence: 'high', rationale: 'Spectral sparsification — keeps a small shadow graph.', evidence: {} },
  'ruvector-mincut':                      { archetypes: ['GraphReasoner'], confidence: 'high', rationale: 'Mincut primitives. Big crate (479 items, 128 cfg-gated).', evidence: { adrs: ['ADR-014', 'ADR-046'], items_count: 479 } },
  'ruvector-mincut-gated-transformer':    { archetypes: ['GraphReasoner', 'AgentMemory'], confidence: 'high', rationale: 'Dynamic attention gated by graph mincut.', evidence: { adrs: ['ADR-046'], items_count: 260 } },
  'ruvector-attn-mincut':                 { archetypes: ['GraphReasoner'], confidence: 'high', rationale: 'Attention layer using mincut for pruning.', evidence: {} },
  'ruvector-dag':                         { archetypes: ['GraphReasoner'], confidence: 'high', rationale: 'Self-learning DAG execution for multi-step pipelines.', evidence: { adrs: ['ADR-053', 'ADR-054'], items_count: 196 } },

  // ===== TimeSeriesMemory =====

  'ruvector-attention':                   { archetypes: ['AgentMemory', 'TimeSeriesMemory', 'KnowledgeBase'], confidence: 'high', rationale: '50+ attention mechanisms incl. Mamba SSM, FlashAttention-3, MLA. Multi-archetype.', evidence: { adrs: ['ADR-015', 'ADR-044'], items_count: 329 } },
  'ruvector-temporal-tensor':             { archetypes: ['TimeSeriesMemory'], confidence: 'high', rationale: 'Temporal tensor compression and reuse.', evidence: { adrs: ['ADR-017'], items_count: 123 } },
  'ruvector-delta-core':                  { archetypes: ['TimeSeriesMemory'], confidence: 'high', rationale: 'Delta-behavior primitives for change tracking.', evidence: { adrs: ['ADR-016'] } },
  'ruvector-delta-index':                 { archetypes: ['TimeSeriesMemory'], confidence: 'high', rationale: 'Delta indexing.', evidence: {} },
  'ruvector-delta-graph':                 { archetypes: ['TimeSeriesMemory', 'GraphReasoner'], confidence: 'medium', rationale: 'Delta-aware graph; spans both TimeSeries and Graph workloads.', evidence: {} },
  'ruvector-delta-consensus':             { archetypes: ['TimeSeriesMemory'], confidence: 'high', rationale: 'CRDTs for distributed change propagation.', evidence: {} },

  // Neural-trader family — financial time series, TimeSeries archetype
  'neural-trader-core':                   { archetypes: ['TimeSeriesMemory'], confidence: 'high', rationale: 'Reference financial TS application; demonstrates TimeSeriesMemory archetype shape.', evidence: {} },
  'neural-trader-coherence':              { archetypes: ['TimeSeriesMemory'], confidence: 'high', rationale: 'Coherence layer for trader.', evidence: {} },
  'neural-trader-replay':                 { archetypes: ['TimeSeriesMemory'], confidence: 'high', rationale: 'Replay primitive.', evidence: {} },
  'neural-trader-strategies':             { archetypes: ['TimeSeriesMemory'], confidence: 'high', rationale: 'Strategy library.', evidence: {} },
  'ruvector-kalshi':                      { archetypes: ['TimeSeriesMemory'], confidence: 'high', rationale: 'Kalshi (prediction-market) integration per ADR-153.', evidence: { adrs: ['ADR-153'], items_count: 65 } },

  // ===== TaxonomySearch =====

  'ruvector-hyperbolic-hnsw': { archetypes: ['TaxonomySearch'], confidence: 'high', rationale: 'Hyperbolic HNSW — hierarchy-aware search in Poincaré ball. Excluded from default workspace; confirm distribution path.', evidence: { adrs: ['ADR-088', 'ADR-103'], items_count: 59 }, risk: 'workspace-excluded' },

  // ===== LocalLLM (proposed) =====

  'ruvllm':                  { archetypes: ['LocalLLM'], categories: ['core'], confidence: 'high', rationale: 'Headline LLM runtime. 1547 items, 343 cfg-gated. Single largest crate.', evidence: { adrs: ['ADR-002', 'ADR-008', 'ADR-013'], items_count: 1547 } },
  'ruvllm-cli':              { archetypes: ['LocalLLM'], categories: ['infrastructure'], confidence: 'high', rationale: 'LLM CLI.', evidence: {} },
  'ruvector-tiny-dancer-core':{ archetypes: ['LocalLLM'], confidence: 'high', rationale: 'FastGRNN agent-routing — lightweight LLM alternative per README.', evidence: { items_count: 50 } },
  'ruvector-sparse-inference': { archetypes: ['LocalLLM'], confidence: 'high', rationale: 'PowerInfer-style sparse activation; 2-10x faster on edge.', evidence: { adrs: ['ADR-025'], items_count: 177 } },

  // ===== AgentFramework (proposed) =====

  'rvagent-core':         { archetypes: ['AgentFramework'], confidence: 'high', rationale: 'Core agent runtime. 118 items, ADR-104/105/107.', evidence: { adrs: ['ADR-104', 'ADR-105', 'ADR-107', 'ADR-159'], items_count: 118 } },
  'rvagent-a2a':          { archetypes: ['AgentFramework'], confidence: 'high', rationale: 'Agent-to-agent protocol per ADR-159 (the bug-finding ADR from M3).', evidence: { adrs: ['ADR-159'], items_count: 115 } },
  'rvagent-acp':          { archetypes: ['AgentFramework'], confidence: 'high', rationale: 'Agent Communication Protocol (client ↔ agent).', evidence: { adrs: ['ADR-104'] } },
  'rvagent-mcp':          { archetypes: ['AgentFramework'], confidence: 'high', rationale: 'MCP integration (agent ↔ tool).', evidence: { adrs: ['ADR-104', 'ADR-105', 'ADR-108', 'ADR-112'], items_count: 92 } },
  'rvagent-middleware':   { archetypes: ['AgentFramework'], confidence: 'high', rationale: 'Middleware stack.', evidence: { adrs: ['ADR-159'], items_count: 96 } },
  'rvagent-backends':     { archetypes: ['AgentFramework'], confidence: 'high', rationale: 'Backend integrations (LLM providers, tools).', evidence: { adrs: ['ADR-107'], items_count: 88 } },
  'rvagent-cli':          { archetypes: ['AgentFramework'], categories: ['infrastructure'], confidence: 'high', rationale: 'Agent CLI.', evidence: {} },
  'rvagent-tools':        { archetypes: ['AgentFramework'], confidence: 'high', rationale: 'Built-in tool library.', evidence: { adrs: ['ADR-104', 'ADR-105'], items_count: 63 } },
  'rvagent-subagents':    { archetypes: ['AgentFramework'], confidence: 'high', rationale: 'Sub-agent dispatch.', evidence: { adrs: ['ADR-104'] } },

  // ===== Infrastructure =====

  'ruvector-server':       { categories: ['infrastructure'], confidence: 'high', rationale: 'HTTP/gRPC server — backend for SDK\'s `http` transport.', evidence: {} },
  'ruvector-cli':          { categories: ['infrastructure'], confidence: 'high', rationale: 'Top-level CLI.', evidence: {} },
  'ruvector-cluster':      { categories: ['infrastructure'], confidence: 'high', rationale: 'Cluster management with consistent hashing.', evidence: {} },
  'ruvector-raft':         { categories: ['infrastructure'], confidence: 'high', rationale: 'Raft consensus for leader election.', evidence: {} },
  'ruvector-replication':  { categories: ['infrastructure'], confidence: 'high', rationale: 'Multi-master replication, vector clocks.', evidence: {} },
  'ruvector-router-core':  { categories: ['infrastructure'], confidence: 'high', rationale: 'Semantic routing core.', evidence: {} },
  'ruvector-router-cli':   { categories: ['infrastructure'], confidence: 'high', rationale: 'Router CLI.', evidence: {} },
  'ruvector-router-ffi':   { categories: ['infrastructure', 'bindings'], confidence: 'high', rationale: 'Router FFI.', evidence: {} },
  'mcp-brain-server':      { categories: ['infrastructure'], confidence: 'high', rationale: 'pi.ruv.io shared-brain MCP server.', evidence: { adrs: ['ADR-057', 'ADR-059'] } },
  'mcp-brain':             { categories: ['infrastructure'], confidence: 'high', rationale: 'MCP brain client.', evidence: {} },
  'mcp-gate':              { categories: ['infrastructure'], confidence: 'high', rationale: 'MCP gateway.', evidence: {} },

  // ===== Advanced =====

  'prime-radiant':              { categories: ['advanced'], confidence: 'high', rationale: 'Coherence engine via sheaf-Laplacian. AI safety / hallucination detection.', evidence: { adrs: ['ADR-015', 'ADR-025'], items_count: 737 } },
  'ruvector-verified':          { categories: ['advanced'], confidence: 'high', rationale: 'Formal verification gates. Lean-agentic dependency in workspace Cargo.toml.', evidence: { adrs: ['ADR-046', 'ADR-047'], items_count: 66 } },
  'ruvector-domain-expansion': { categories: ['advanced'], confidence: 'medium', rationale: 'Already mapped to AgentMemory; also advanced for cross-domain transfer.', evidence: {} },
  'ruvector-nervous-system':    { categories: ['advanced'], confidence: 'high', rationale: 'Bio-inspired adaptive system with spiking networks.', evidence: { adrs: ['ADR-052', 'ADR-076'], items_count: 147 } },
  'ruvector-economy-wasm':      { categories: ['advanced'], confidence: 'high', rationale: 'Game-theoretic attention (Nash, Shapley).', evidence: {} },
  'ruvector-learning-wasm':     { categories: ['advanced'], confidence: 'medium', rationale: 'Specialized learning surface; review at v0.2.', evidence: {} },
  'ruvector-exotic-wasm':       { categories: ['advanced'], confidence: 'high', rationale: 'Exotic mechanisms.', evidence: {} },
  'ruvector-consciousness':     { categories: ['advanced'], confidence: 'high', rationale: 'IIT Phi, causal emergence (research).', evidence: { adrs: ['ADR-131', 'ADR-134'], items_count: 102 } },
  'ruvector-cognitive-container': { categories: ['advanced'], confidence: 'high', rationale: 'RVF-based cognitive container shim.', evidence: {} },
  'ruvector-decompiler':        { categories: ['advanced'], confidence: 'high', rationale: 'JS bundle decompiler. Adjacent capability.', evidence: { adrs: ['ADR-135', 'ADR-136', 'ADR-137'], items_count: 71 } },
  'ruvector-robotics':          { categories: ['advanced'], confidence: 'high', rationale: 'Robotics integration. ADR-orphan but real (164 items, 116 docs). Candidate for future Robotics archetype.', evidence: { items_count: 164 } },
  'ruqu-core':                  { categories: ['advanced'], confidence: 'high', rationale: 'Quantum coherence. ADR-orphan but 262 items, 223 docs.', evidence: { items_count: 262 } },
  'ruqu-algorithms':            { categories: ['advanced'], confidence: 'high', rationale: 'Quantum algorithms.', evidence: {} },
  'ruqu-exotic':                { categories: ['advanced'], confidence: 'high', rationale: 'Quantum exotic primitives.', evidence: {} },
  'ruQu':                       { categories: ['advanced'], confidence: 'high', rationale: 'Quantum top-level package.', evidence: { items_count: 216 } },
  'cognitum-gate-kernel':       { categories: ['advanced'], confidence: 'high', rationale: 'Cognitive AI gateway.', evidence: { adrs: ['ADR-014', 'ADR-087'], items_count: 63 } },
  'cognitum-gate-tilezero':     { categories: ['advanced'], confidence: 'high', rationale: 'TileZero acceleration.', evidence: { adrs: ['ADR-067'] } },
  'thermorust':                 { categories: ['advanced'], confidence: 'low', rationale: 'Thermodynamic primitives — name suggests physics-inspired. Review at v0.2.', evidence: {} },
  'ruvector-crv':               { categories: ['advanced'], confidence: 'low', rationale: 'CRV — abbreviation unclear. ADR-orphan. Review at v0.2.', evidence: {} },
  'rvlite':                     { categories: ['advanced'], confidence: 'medium', rationale: 'Lightweight rvf variant for edge.', evidence: { adrs: ['ADR-032'], items_count: 176 } },

  // ===== Out of headline (PRD §5.6 candidates) =====

  'ruvector-postgres':          { categories: ['out_of_headline'], confidence: 'high', rationale: 'PostgreSQL pgrx extension — separate distribution path. SDK consumes via HTTP, not embed.', evidence: { adrs: ['ADR-027', 'ADR-079'], items_count: 1001 } },
  'ruvector-fpga-transformer':  { categories: ['out_of_headline'], confidence: 'high', rationale: 'FPGA — hardware-specific.', evidence: { items_count: 191 } },
  'ruvector-fpga-transformer-wasm': { categories: ['out_of_headline'], confidence: 'high', rationale: 'FPGA wasm shim.', evidence: {} },
  'micro-hnsw-wasm':            { categories: ['out_of_headline'], confidence: 'high', rationale: 'Excluded from workspace — embedded variant.', evidence: { adrs: ['ADR-151'] } },

  // ===== Bindings (NAPI/WASM bridges) =====
  // Only a few hand-listed; the bulk_rules below catch the *-node and *-wasm pattern.

  'ruvector-attention-node':    { categories: ['bindings'], confidence: 'high', rationale: 'Top NAPI-binding crate (52 items). Surface for AgentMemory/TimeSeriesMemory archetypes in Node.', evidence: { adrs: ['ADR-145'] } },
  'ruvector-wasm':              { categories: ['bindings'], confidence: 'high', rationale: 'Top-level WASM bridge for ruvector-core.', evidence: { adrs: ['ADR-086', 'ADR-088'] } },
  'ruvector-node':              { categories: ['bindings'], confidence: 'high', rationale: 'Top-level NAPI bridge for ruvector-core.', evidence: {} },
  'ruvllm-wasm':                { categories: ['bindings'], confidence: 'high', rationale: 'WASM bridge for ruvllm — 59 wasm-decorated items.', evidence: { adrs: ['ADR-084'] } },

  // ===== RVF (cognitive containers) =====
  // RVF is its own subworkspace — most components route to advanced or core.

  'rvf-types':    { categories: ['core', 'advanced'], confidence: 'high', rationale: 'RVF types — core for the .rvf format. 282 items.', evidence: { adrs: ['ADR-031', 'ADR-033'], items_count: 282 } },
  'rvf-runtime': { categories: ['advanced'], confidence: 'high', rationale: 'RVF runtime executor.', evidence: { adrs: ['ADR-031', 'ADR-032'], items_count: 139 } },
  'rvf-wasm':     { categories: ['advanced', 'bindings'], confidence: 'high', rationale: 'RVF WASM bridge.', evidence: { adrs: ['ADR-037', 'ADR-038'] } },
  'rvf-wire':     { categories: ['advanced'], confidence: 'high', rationale: 'RVF wire format.', evidence: { adrs: ['ADR-031'] } },
  'rvf-crypto':   { categories: ['advanced'], confidence: 'high', rationale: 'Post-quantum signatures (ML-DSA-65, Ed25519).', evidence: {} },

  // ===== Ruvix kernel (entire subworkspace → out-of-headline) =====
  // Bulk-handled by rule below; explicit notes for clarity.

  // Robotics — proposed sub-category, advanced for now
  'agentic-robotics-core':      { categories: ['advanced'], confidence: 'medium', rationale: 'Agentic robotics — ADR-orphan but 6 nested crates. Candidate Robotics archetype if scope justifies.', evidence: {} },

  // Singletons that didn't match a name-based rule
  'ruvector-diskann':           { archetypes: ['KnowledgeBase'], confidence: 'high', rationale: 'SSD-backed billion-scale ANN with Vamana graph. Per upstream README, key for KnowledgeBase at scale.', evidence: { adrs: ['ADR-143', 'ADR-144', 'ADR-146'], items_count: 25 } },
  'ruvector-dither':            { categories: ['advanced'], confidence: 'low', rationale: 'Dithering primitive (visual). ADR-071 covers cognitum-gate; likely related. Review at v0.2.', evidence: { adrs: ['ADR-071'] } },
};

// ---------------- Bulk rules ----------------
// Applied in order to crates not in `explicit`. First matching rule wins.

// Bulk rules match on either name or path. Path-matching is required for
// ruvix/rvm nested members because their on-disk names are often unprefixed
// (e.g., `bcm2711`, `boot`, `cap`, `rvm-types`) due to the collision-only
// naming rule — the parent workspace doesn't appear in the name unless
// disambiguation requires it.
export const bulkRules = [
  { match: (c) => c.category === 'test',    assign: { categories: ['scaffolding'] }, confidence: 'high', reason: 'Test crate per M2 category tag.' },
  { match: (c) => c.category === 'bench',   assign: { categories: ['scaffolding'] }, confidence: 'high', reason: 'Bench crate per M2 category tag.' },
  { match: (c) => c.category === 'example', assign: { categories: ['scaffolding'] }, confidence: 'high', reason: 'Example crate per M2 category tag.' },
  { match: (c) => c.path?.startsWith('crates/ruvix/'), assign: { categories: ['out_of_headline', 'advanced'] }, confidence: 'high', reason: 'RuVix bare-metal cognitive kernel — out-of-headline per PRD §5.6.' },
  { match: (c) => c.path?.startsWith('crates/rvm/'),   assign: { categories: ['advanced'] }, confidence: 'medium', reason: 'rvm subworkspace nested members.' },
  { match: (c) => c.path?.startsWith('crates/rvf/'),   assign: { categories: ['advanced'] }, confidence: 'medium', reason: 'rvf subworkspace member — advanced cognitive container infrastructure.' },
  { match: (c) => /-wasm$/.test(c.name),    assign: { categories: ['bindings'] }, confidence: 'high', reason: 'WASM bridge crate by name convention.' },
  { match: (c) => /-node$/.test(c.name),    assign: { categories: ['bindings'] }, confidence: 'high', reason: 'NAPI bridge crate by name convention.' },
  { match: (c) => /-cli$/.test(c.name),     assign: { categories: ['infrastructure'] }, confidence: 'medium', reason: 'CLI crate by name convention.' },
  { match: (c) => /-ffi$/.test(c.name),     assign: { categories: ['bindings'] }, confidence: 'high', reason: 'FFI bridge crate by name convention.' },
  { match: (c) => /^rvf-/.test(c.name),     assign: { categories: ['advanced'] }, confidence: 'medium', reason: 'rvf-* crate by name convention.' },
  { match: (c) => /^agentic-robotics-/.test(c.name), assign: { categories: ['advanced'] }, confidence: 'medium', reason: 'agentic-robotics-* family — robotics integration, advanced category until a Robotics archetype is justified.' },
];
