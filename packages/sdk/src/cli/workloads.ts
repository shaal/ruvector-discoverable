/**
 * Workload → archetype mapping table.
 *
 * **M15.2 Phase-1B** — data-only file (per M15 §6 Q3 ratification). Each row
 * names a canonical workload, the archetypes the recommend CLI should wire,
 * the optional cross-archetype DI couplings, and the "Skips" — capabilities
 * the user might expect to see active but that won't be (with the dormant
 * blocker classification quoted verbatim from each archetype's
 * CAPABILITY_CATALOG).
 *
 * Audit invariant: every name appearing in `recommends.archetypes` and in
 * `skips[i].capability` must be a real entry in the live catalog. The drift
 * probe (`examples/recommend-drift-probe.mjs`) enforces this — when a
 * future archetype refactor renames a capability, the probe catches the
 * stale entry here before the recommend CLI ships incorrect advice.
 */

export type WorkloadKey =
  | 'rag-over-docs'
  | 'agent-memory'
  | 'graph-reasoning'
  | 'time-series-anomaly'
  | 'local-llm-inference'
  | 'agent-orchestration';

export type Archetype =
  | 'KnowledgeBase'
  | 'AgentMemory'
  | 'GraphReasoner'
  | 'TimeSeriesMemory'
  | 'LocalLLM'
  | 'AgentFramework';

export interface WorkloadRecommendation {
  /** Stable key (used by `--workload <key>` flag and by `_meta.workload`). */
  readonly key: WorkloadKey;
  /** Headline question shown in the interactive flow. */
  readonly headline: string;
  /** One-paragraph rationale baked into the generated config's `_meta.rationale`. */
  readonly rationale: string;
  /** Archetypes wired in `createSdk()`. Order matters; later archetypes can DI earlier ones. */
  readonly archetypes: readonly Archetype[];
  /**
   * Cross-archetype DI couplings — `{ from: 'KnowledgeBase', injects: ['LocalLLM', 'GraphReasoner'] }`
   * tells the codegen to pass those references into KB's create-options.
   */
  readonly couplings: readonly Coupling[];
  /** Capabilities the user might expect but should know are NOT active. */
  readonly skips: readonly SkipReason[];
}

export interface Coupling {
  readonly from: Archetype;
  readonly injects: readonly Archetype[];
}

export interface SkipReason {
  /** Capability name as it appears in the relevant archetype's CAPABILITY_CATALOG. */
  readonly capability: string;
  /** Which archetype's catalog declares this capability. */
  readonly archetype: Archetype;
  /** Why this capability is dormant — `[upstream-binding]`, `[upstream-bug]`, `[design-deferred]`. */
  readonly reasonShort: string;
}

// ---------------- Table ----------------

export const WORKLOADS: readonly WorkloadRecommendation[] = [
  {
    key: 'rag-over-docs',
    headline: 'RAG over technical documentation',
    rationale:
      'Three-archetype RAG stack: KnowledgeBase for vector recall, GraphReasoner for ' +
      'memory-relations via Graph RAG (M9 cross-archetype DI), LocalLLM for autoEmbed ' +
      '(M11.2) and eventual generation (Phase 2A — gibberish today per Issue #05).',
    archetypes: ['LocalLLM', 'GraphReasoner', 'KnowledgeBase'],
    couplings: [{ from: 'KnowledgeBase', injects: ['LocalLLM', 'GraphReasoner'] }],
    skips: [
      { capability: 'hybridSearch',  archetype: 'KnowledgeBase', reasonShort: '[upstream-binding] @ruvector/core has no NAPI hybrid surface' },
      { capability: 'colbertRerank', archetype: 'KnowledgeBase', reasonShort: '[upstream-binding] ColBERT not exposed in NAPI' },
      { capability: 'matryoshka',    archetype: 'KnowledgeBase', reasonShort: '[upstream-binding] Matryoshka not exposed' },
      { capability: 'cypher',        archetype: 'GraphReasoner', reasonShort: '[upstream-bug] Issue #01 stub' },
      { capability: 'generate',      archetype: 'LocalLLM',      reasonShort: '[upstream-bug] Issue #05 — no model_path config' },
    ],
  },
  {
    key: 'agent-memory',
    headline: 'Long-term agent memory',
    rationale:
      'Per-agent state via AgentMemory + SONA continual learning (M10/M13.1). ' +
      'Optional GraphReasoner for memory-relations via tag co-occurrence. ' +
      'LocalLLM provides autoEmbed for text-only memories.',
    archetypes: ['LocalLLM', 'GraphReasoner', 'AgentMemory'],
    couplings: [{ from: 'AgentMemory', injects: ['LocalLLM', 'GraphReasoner'] }],
    skips: [
      { capability: 'gnnLearning',     archetype: 'AgentMemory', reasonShort: '[upstream-binding] @ruvector/gnn-node not published' },
      { capability: 'mambaRecall',     archetype: 'AgentMemory', reasonShort: '[upstream-binding] @ruvector/attention-node not published' },
      { capability: 'domainExpansion', archetype: 'AgentMemory', reasonShort: '[upstream-binding] @ruvector/domain-expansion-node not published' },
    ],
  },
  {
    key: 'graph-reasoning',
    headline: 'Multi-hop graph queries',
    rationale:
      'GraphReasoner via @ruvector/graph-node for kHopNeighbors + searchHyperedges. ' +
      'Optional KnowledgeBase for hybrid-context retrieval. LocalLLM for autoEmbed ' +
      'on text-only nodes/edges.',
    archetypes: ['LocalLLM', 'GraphReasoner'],
    couplings: [],
    skips: [
      { capability: 'cypher',            archetype: 'GraphReasoner', reasonShort: '[upstream-bug] Issue #01 stub' },
      { capability: 'leidenCommunities', archetype: 'GraphReasoner', reasonShort: '[upstream-binding] not exposed in @ruvector/graph-node@2.0.3' },
      { capability: 'sublinearPageRank', archetype: 'GraphReasoner', reasonShort: '[upstream-binding] @ruvector/solver-node not published' },
      { capability: 'graphSparsifier',   archetype: 'GraphReasoner', reasonShort: '[upstream-binding] @ruvector/sparsifier-node not published' },
      { capability: 'mincutGating',      archetype: 'GraphReasoner', reasonShort: '[upstream-binding] @ruvector/mincut-gated-transformer-node not published' },
    ],
  },
  {
    key: 'time-series-anomaly',
    headline: 'Sequential / streaming retrieval with changepoints',
    rationale:
      'TimeSeriesMemory for ms-keyed vector recall + the M10.1 SDK-source ' +
      'changepoint detector (sliding-window mean-shift). LocalLLM for autoEmbed ' +
      'on text-tagged time-series points.',
    archetypes: ['LocalLLM', 'TimeSeriesMemory'],
    couplings: [],
    skips: [
      { capability: 'mambaAttention',      archetype: 'TimeSeriesMemory', reasonShort: '[upstream-binding] @ruvector/attention-node not published' },
      { capability: 'temporalCompression', archetype: 'TimeSeriesMemory', reasonShort: '[upstream-binding] @ruvector/temporal-tensor-node not published' },
      { capability: 'deltaIndexing',       archetype: 'TimeSeriesMemory', reasonShort: '[upstream-binding] @ruvector/delta-node not published — narrow window queries degrade recall' },
      { capability: 'causalLayers',        archetype: 'TimeSeriesMemory', reasonShort: '[upstream-binding] not exposed in @ruvector/graph-node' },
    ],
  },
  {
    key: 'local-llm-inference',
    headline: 'Run an LLM locally',
    rationale:
      'LocalLLM Phase 2A — embed/similarity/query/route working today; generate ' +
      'returns gibberish until upstream Issue #05 (no model_path config) lands. ' +
      'Standalone use case; no cross-archetype coupling needed.',
    archetypes: ['LocalLLM'],
    couplings: [],
    skips: [
      { capability: 'generate',          archetype: 'LocalLLM', reasonShort: '[upstream-bug] Issue #05 — gibberish without model file' },
      { capability: 'streaming',         archetype: 'LocalLLM', reasonShort: '[design-deferred] simulated chunking only; native streaming is upstream work' },
      { capability: 'turboQuantKvCache', archetype: 'LocalLLM', reasonShort: '[upstream-binding] not exposed in NAPI surface' },
      { capability: 'tinyDancerRouting', archetype: 'LocalLLM', reasonShort: '[upstream-binding] @ruvector/tiny-dancer-node not published' },
      { capability: 'sparseInference',   archetype: 'LocalLLM', reasonShort: '[upstream-binding] @ruvector/sparse-inference-node not published' },
    ],
  },
  {
    key: 'agent-orchestration',
    headline: 'Build an AI agent (orchestration over the SDK)',
    rationale:
      'AgentFramework Phase-1A — task lifecycle, tool dispatch, sub-agent recursion, ' +
      'subset policy enforcement (M14.1). Wires LocalLLM + KnowledgeBase + AgentMemory + ' +
      'GraphReasoner via the M11.2/M13.1 DI pattern. 0 of 4 protocols (A2A/ACP/MCP) ' +
      'currently active per Issue #07.',
    archetypes: ['LocalLLM', 'GraphReasoner', 'KnowledgeBase', 'AgentMemory', 'AgentFramework'],
    couplings: [
      { from: 'KnowledgeBase', injects: ['LocalLLM', 'GraphReasoner'] },
      { from: 'AgentMemory',   injects: ['LocalLLM', 'GraphReasoner'] },
      { from: 'AgentFramework', injects: ['LocalLLM', 'KnowledgeBase', 'AgentMemory', 'GraphReasoner'] },
    ],
    skips: [
      { capability: 'mcp',             archetype: 'AgentFramework', reasonShort: '[upstream-binding] @ruvector/rvagent-mcp not published (Issue #07)' },
      { capability: 'a2a',             archetype: 'AgentFramework', reasonShort: '[upstream-binding] @ruvector/rvagent-a2a not published (Issue #07)' },
      { capability: 'acp',             archetype: 'AgentFramework', reasonShort: '[upstream-binding] @ruvector/rvagent-acp not published (Issue #07)' },
      { capability: 'toolCallParsing', archetype: 'AgentFramework', reasonShort: '[upstream-bug] LLM-driven tool calling depends on Issue #05 fix' },
    ],
  },
];

export function findWorkload(key: string): WorkloadRecommendation | null {
  return WORKLOADS.find((w) => w.key === key) ?? null;
}
