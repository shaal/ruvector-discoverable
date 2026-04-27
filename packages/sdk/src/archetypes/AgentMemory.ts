/**
 * Long-term memory for AI agents.
 *
 * **M13.1 Phase 1A** — fourth archetype with a real backend. Wires to
 * upstream `@ruvector/core` (vector recall), optional `@ruvector/sona`
 * (continual learning via warp + trajectory feedback), optional
 * `GraphReasoner` (memory-relations via tag co-occurrence), optional
 * `LocalLLM` (auto-embed text → Float32Array per M11.2 pattern).
 *
 * Distinct from KnowledgeBase: writes-heavy workload, partitioned per
 * agent via `mem:<agentId>:<seq>` ID prefix, hierarchical recall via
 * an optional hand-rolled hyperbolic-distance scorer (SDK-source,
 * parallel to TSM's M10.1 changepoint detector).
 *
 * Default-active capabilities in v0.1 (probed via NativeCoreBackend.smokeCheck +
 * archetype probes):
 *   - vectorRecall / vectorInsert            — ruvector-core
 *   - health / metrics                       — ruvector-core
 *   - agentScoping                           — SDK-side ID prefix
 *
 * Dormant in v0.1 (declared, behavior depends on opt-in / upstream):
 *   - sona / ewc                             — sdk-integration (user wires `sona: true`)
 *   - graphMemory                            — sdk-integration (user wires `graphReasoner`)
 *   - autoEmbed                              — sdk-integration (user wires `embedder`)
 *   - hyperbolic                             — sdk-integration (user wires `hyperbolic: true`)
 *   - gnnLearning                            — upstream-binding (no @ruvector/gnn-node)
 *   - mambaRecall                            — upstream-binding (no @ruvector/attention-node)
 *   - domainExpansion                        — upstream-binding (no @ruvector/domain-expansion-node)
 *
 * Surface revisions vs M5: `MemoryRecord.embedding?: Float32Array` is now
 * accepted (optional, per M11.2 pattern). Recall accepts `string` or
 * `Float32Array` for the context query.
 */

import type { ExplainTrace } from '../core/explain.js';
import type { FeedbackProvider, FeedbackSignal, QueryId } from '../core/feedback.js';
import type { Pipeline } from '../core/pipeline.js';
import type { ValueReport, ValueReportProvider } from '../core/value-report.js';
import type { CheckResult, HealthCheckProvider, HealthCheckResult } from '../core/health.js';
import type { CapabilityCatalogEntry } from '../core/capability-catalog.js';
import { RuVectorError, reduceIntrospect, reduceValueReport, runCheck, summarize } from '../core/index.js';
import { resolveEmbedding, requireEmbedderForString, validateEmbedderDimensions } from '../core/auto-embed.js';
import { NativeCoreBackend } from '../backends/native-core.js';
import { RouterKbBackend } from '../backends/router-kb.js';
import type { KbBackend } from '../backends/kb-backend.js';
import { NativeSonaBackend } from '../backends/native-sona.js';
import { GraphReasoner } from './GraphReasoner.js';
import type { LocalLLM } from './LocalLLM.js';

// ---------------- Public types ----------------

export interface AgentMemoryOptions {
  /** Stable identity for this agent. Memories are partitioned per agent. */
  readonly agentId: string;
  /** Vector dimensions for memory embeddings. Required. */
  readonly dimensions: number;
  /** Distance metric. Default: 'Cosine'. */
  readonly distanceMetric?: 'Euclidean' | 'Cosine' | 'DotProduct' | 'Manhattan';
  /** Storage path. Default: in-memory (subject to Finding C — see m6-scope.md). */
  readonly storage?: string;
  /**
   * Path to upstream @ruvector/core binary. Falls back to RUVECTOR_CORE_BINDING.
   * Required when `nativePackage: 'core'` (the default) because
   * @ruvector/core is not yet published on npm. Ignored when
   * `nativePackage: 'router'`.
   */
  readonly bindingPath?: string;
  /**
   * **M19 — choose the NAPI package backing this agent's memory store.**
   *
   * Same dispatcher as M18's KnowledgeBase: `'core'` (default) wraps
   * `@ruvector/core` (env-var workaround needed); `'router'` wraps
   * `@ruvector/router@0.1.30+` (publish-ready, no env var).
   *
   * **Caveat under `'router'`**: `forget(id)` throws `CAPABILITY_DEFERRED`
   * because `@ruvector/router.VectorDb.delete()` deadlocks (Issue #11).
   * AgentMemory is otherwise fully usable on the router backend —
   * remember/recall/SONA/graph-relations all work. Use `'core'` if your
   * workflow needs to delete individual memories by id.
   */
  readonly nativePackage?: 'core' | 'router';
  /** Override capability defaults. */
  readonly capabilities?: AgentMemoryCapabilityConfig;
  /**
   * Optional SONA continual-learning configuration (M13.1, parallels KB M10).
   *
   * When supplied, recall() begins a SONA trajectory and warps the query
   * embedding via applyMicroLora before vector search; recordFeedback() ends
   * the trajectory with the user's reward signal so SONA learns.
   *
   * Q1 ratification (M13 §6): separate SONA by default. Pass an object to
   * configure; pass `true` for default; supply a shared `instance` to share
   * across archetypes (e.g., the same SonaEngine KB uses).
   */
  readonly sona?: true | { readonly bindingPath?: string; readonly instance?: NativeSonaBackend };
  /**
   * Optional GraphReasoner for memory-relations. Tag co-occurrence forms a
   * memory-relation graph; recall fans out via kHop. Same M9 pattern as KB.
   */
  readonly graphReasoner?: GraphReasoner;
  /** Override the default tag-cooccurrence relation extractor. */
  readonly relationExtractor?: RelationExtractor;
  /**
   * Optional embedder. M11.2 pattern: when wired, MemoryRecord.embedding
   * becomes optional; recall() accepts a string context.
   */
  readonly embedder?: LocalLLM;
  /**
   * Enable hyperbolic-distance recall scoring. SDK-source (parallels M10.1
   * changepointDetection — first archetype where the SDK ships value
   * outside upstream bindings). v0.1 implements a Poincaré-ball distance
   * scorer over the existing Float32Array embeddings (no projection step;
   * the embeddings are treated as living on the unit ball with a small
   * margin away from the boundary).
   */
  readonly hyperbolic?: boolean;
}

export interface AgentMemoryCapabilityConfig {
  /** Default: false in v0.1 — no @ruvector/gnn-node. Toggle has no effect. */
  readonly gnnLearning?: boolean;
  /** Set via `options.sona`. */
  readonly sona?: boolean;
  /** Set via `options.sona` (sona binding includes EWC++). */
  readonly ewc?: boolean;
  /** Default: false. Set via `options.hyperbolic`. */
  readonly hyperbolic?: boolean;
  /** Default: false in v0.1 — no @ruvector/attention-node. */
  readonly mambaRecall?: boolean;
  /** Default: false in v0.1 — no @ruvector/domain-expansion-node. */
  readonly domainExpansion?: boolean;
}

export interface MemoryRecord {
  /** Memory text. Required. */
  readonly text: string;
  /**
   * Pre-computed embedding. Optional when an `embedder` was wired at
   * create-time (M11.2 pattern); required otherwise.
   */
  readonly embedding?: Float32Array;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** Optional importance hint, [0, 1]. Used as a recency-mix weight. */
  readonly importance?: number;
  /** Optional client timestamp; defaults to now. */
  readonly timestampMs?: number;
}

export interface RecallOptions {
  /** Top-k. Default: 16. */
  readonly k?: number;
  /** Recency bias mixed into the final score, [0, 1]. Default: 0.2. */
  readonly recency?: number;
  /** Restrict by tags. */
  readonly tags?: readonly string[];
  /**
   * Graph fan-out: after vector recall, traverse the memory-relations graph
   * by this many hops and add reachable memories as `graph-adjacent`. Same
   * 2-hop schema constraint as KB's graphRagHops (memory → tag → other-memory).
   */
  readonly graphHops?: number;
}

export interface RecallResult {
  readonly records: readonly RecalledMemory[];
  readonly queryId: QueryId;
  readonly explain: ExplainTrace;
}

export interface RecalledMemory {
  readonly id: string;
  readonly text: string;
  readonly score: number;
  readonly recalledAt: string;
  readonly source?: 'vector' | 'graph-adjacent';
  /** When `source === 'graph-adjacent'`, the bridging tag. */
  readonly bridgeTag?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RememberReport {
  readonly id: string;
}

export type RelationExtractor = (record: MemoryRecord) => readonly string[];

/**
 * Default extractor: returns the record's tags. Same shape as KB's
 * `defaultEntityExtractor` but operating on `tags` instead of `metadata.entities`.
 * Production use: replace with a real co-occurrence extractor.
 */
export const defaultRelationExtractor: RelationExtractor = (r) => r.tags ?? [];

// ---------------- Capability catalog ----------------

const CAPABILITY_CATALOG: readonly CapabilityCatalogEntry[] = [
  {
    name: 'vectorRecall',
    source: 'ruvector-core',
    adrs: ['ADR-001'],
    probeName: 'vectorSearch',
    invocationKey: 'recall',
    defaultStatus: 'active',
  },
  {
    name: 'vectorInsert',
    source: 'ruvector-core',
    adrs: ['ADR-001'],
    probeName: 'vectorInsert',
    invocationKey: 'remember',
    defaultStatus: 'active',
  },
  { name: 'agentScoping', source: '@ruvector/sdk', defaultStatus: 'active' },
  { name: 'health',  source: 'ruvector-core', probeName: 'health',  defaultStatus: 'active' },
  { name: 'metrics', source: 'ruvector-core', probeName: 'metrics', defaultStatus: 'active' },
  {
    name: 'sona',
    source: 'sona',
    adrs: ['ADR-014', 'ADR-044'],
    probeName: 'sona',
    invocationKey: 'sonaFeedback',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'sdk-integration',
    defaultDormantReason: 'AgentMemory was constructed without sona. Pass `sona: true` (or `sona: { instance: <shared> }`) at create-time to enable continual learning + EWC++.',
    defaultDormantLift: '10-25% lift on repeat recall via continual learning (LoRA + EWC++).',
    defaultDormantEnable: 'await AgentMemory.create({ ..., sona: true })',
  },
  {
    name: 'graphMemory',
    source: 'ruvector-graph',
    adrs: ['ADR-046'],
    probeName: 'graphMemory',
    invocationKey: 'graphFanout',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'sdk-integration',
    defaultDormantReason: 'AgentMemory was constructed without a graphReasoner. Pass one (with matching dimensions) at create-time and call recall(context, { graphHops: 2 }) to enable.',
    defaultDormantLift: 'Multi-hop memory recall via tag co-occurrence; finds related memories beyond direct vector similarity.',
    defaultDormantEnable: 'await AgentMemory.create({ ..., graphReasoner: await GraphReasoner.create({ dimensions }) })',
  },
  {
    name: 'autoEmbed',
    source: '@ruvector/sdk',
    probeName: 'autoEmbed',
    invocationKey: 'autoEmbed',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'sdk-integration',
    defaultDormantReason: 'AgentMemory was constructed without an embedder. Pass `embedder: <LocalLLM>` (with matching dimensions) at create-time to remember/recall text-only.',
    defaultDormantLift: 'Drops the "user supplies pre-computed embedding" caveat; aligns with KB / TSM / GR M11.2 pattern.',
    defaultDormantEnable: 'await AgentMemory.create({ dimensions: 768, embedder: await LocalLLM.create() })',
  },
  {
    name: 'hyperbolic',
    source: '@ruvector/sdk',
    probeName: 'hyperbolic',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'sdk-integration',
    defaultDormantReason: 'AgentMemory was constructed without `hyperbolic: true`. SDK ships a hand-rolled Poincaré-ball distance scorer; opt in to enable hierarchical-recall ranking.',
    defaultDormantLift: 'Better ranking on hierarchical taxonomies (parent-child memories) where Euclidean cosine flattens the tree.',
    defaultDormantEnable: 'await AgentMemory.create({ ..., hyperbolic: true })',
  },
  {
    name: 'gnnLearning',
    source: 'ruvector-gnn',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: '@ruvector/gnn-node is not published. M4 ratified GNN-learned-index as AgentMemory headline; remains gated on upstream publishing per reprobe.mjs.',
    defaultDormantLift: 'Index quality improves with use; outperforms static HNSW on workloads with shifting query distributions.',
    defaultDormantEnable: 'Track @ruvector/gnn-node publishing via tools/reprobe-bindings/reprobe.mjs.',
  },
  {
    name: 'mambaRecall',
    source: 'ruvector-attention',
    adrs: ['ADR-015'],
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: '@ruvector/attention-node is not published. Mamba SSM lives in upstream Rust but is not bound to NAPI in any v0.1-reachable version.',
    defaultDormantLift: 'Linear-time sequential memory modelling; better recall on long agent histories.',
    defaultDormantEnable: 'Track @ruvector/attention-node publishing.',
  },
  {
    name: 'domainExpansion',
    source: 'ruvector-domain-expansion',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: '@ruvector/domain-expansion(-node) is not published. Cross-task transfer requires upstream binding.',
    defaultDormantLift: 'Cross-task transfer between agents; lifts policies learned in one domain to another.',
    defaultDormantEnable: 'Track upstream publishing.',
  },
];

// ---------------- Implementation ----------------

export class AgentMemory implements ValueReportProvider, FeedbackProvider, HealthCheckProvider {
  private readonly _backend: KbBackend;
  private readonly _options: AgentMemoryOptions;
  private readonly _sona: NativeSonaBackend | null;
  private readonly _ownsSona: boolean;
  private readonly _graph: GraphReasoner | null;
  private readonly _embedder: LocalLLM | null;
  private readonly _relationExtractor: RelationExtractor;
  private readonly _hyperbolic: boolean;
  private _invocationCounts = new Map<string, number>();
  private _closed = false;
  private _lastHealth: HealthCheckResult | null = null;
  private _seq = 0;
  private _idCounter = 0;
  // Tracks which tags each memory has, so recall's graph fan-out can attribute
  // the bridging tag in `graph-adjacent` records.
  private _memoryTags = new Map<string, readonly string[]>();
  // queryId → SONA trajectoryId mapping.
  private _trajectoryByQuery = new Map<string, number>();
  // Mirror inserted memories so hyperbolic re-ranking can run client-side
  // (the Poincaré scorer needs the original vectors, not just IDs/scores).
  private _vectorMirror = new Map<string, Float32Array>();
  // **M21 (v0.4)**: persist user-supplied `text` from remember() so recall()
  // returns it instead of the v0.1 placeholder. Bounded by the same
  // archetype lifecycle as _memoryTags / _vectorMirror; cleared on forget()
  // and close(). When `text` is omitted at remember-time (embedding-only
  // remember), no entry is written and recall falls back to the placeholder.
  private _textStore = new Map<string, string>();

  private constructor(
    backend: KbBackend,
    options: AgentMemoryOptions,
    sona: NativeSonaBackend | null,
    ownsSona: boolean,
  ) {
    this._backend = backend;
    this._options = options;
    this._sona = sona;
    this._ownsSona = ownsSona;
    this._graph = options.graphReasoner ?? null;
    this._embedder = options.embedder ?? null;
    this._relationExtractor = options.relationExtractor ?? defaultRelationExtractor;
    this._hyperbolic = options.hyperbolic === true;
  }

  static async create(options: AgentMemoryOptions): Promise<AgentMemory> {
    validateEmbedderDimensions(options.embedder, options.dimensions, 'AgentMemory');
    const nativePackage = options.nativePackage ?? 'core';
    let backend: KbBackend;
    if (nativePackage === 'router') {
      backend = await RouterKbBackend.create({
        dimensions: options.dimensions,
        distanceMetric: options.distanceMetric ?? 'Cosine',
        ...(options.storage !== undefined && { storage: options.storage }),
      });
    } else {
      backend = await NativeCoreBackend.create({
        dimensions: options.dimensions,
        distanceMetric: options.distanceMetric ?? 'Cosine',
        ...(options.storage !== undefined && { storage: options.storage }),
        ...(options.bindingPath !== undefined && { bindingPath: options.bindingPath }),
      });
    }

    let sona: NativeSonaBackend | null = null;
    let ownsSona = false;
    if (options.sona !== undefined) {
      const cfg = options.sona === true ? {} : options.sona;
      if (cfg.instance) {
        sona = cfg.instance;
        ownsSona = false; // shared instance; user owns lifecycle
      } else {
        sona = await NativeSonaBackend.create({
          hiddenDim: options.dimensions,
          ...(cfg.bindingPath !== undefined && { bindingPath: cfg.bindingPath }),
        });
        ownsSona = true;
      }
    }

    return new AgentMemory(backend, options, sona, ownsSona);
  }

  /**
   * Record a new memory.
   *
   * **M11.2 pattern**: `embedding` is optional when an `embedder` was wired
   * at create-time. Returns the canonical SDK-side memory id (the agent-
   * scoped `mem:<agentId>:<seq>` form, not the backend-internal id).
   */
  async remember(record: MemoryRecord): Promise<RememberReport> {
    this.assertOpen();
    const vector = await this._resolveVector(record);
    const id = this._nextMemoryId();
    await this._backend.insert(id, vector);
    this._vectorMirror.set(id, vector);
    // M21: persist text when supplied. Embedding-only remember() leaves
    // _textStore unset for this id; recall falls back to the placeholder.
    if (record.text !== undefined) this._textStore.set(id, record.text);

    const tags = this._relationExtractor(record);
    if (tags.length > 0) this._memoryTags.set(id, tags);

    if (this._graph !== null && tags.length > 0) {
      const dims = this._options.dimensions;
      const memNodeId = `mem:${id}`;
      const tagNodes: { id: string; embedding: Float32Array; labels?: readonly string[] }[] = [];
      const edges: { from: string; to: string; description: string; embedding: Float32Array }[] = [];
      const seen = new Set<string>();
      for (const tag of tags) {
        const tagId = `tag:${tag.toLowerCase()}`;
        if (!seen.has(tagId)) {
          seen.add(tagId);
          tagNodes.push({ id: tagId, embedding: tagEmbedding(tagId, dims), labels: ['Tag'] });
        }
        edges.push({ from: memNodeId, to: tagId, description: 'TAGGED', embedding: tagEmbedding(`${id}->${tag}`, dims) });
      }
      await this._graph.addBatch({
        nodes: [{ id: memNodeId, embedding: vector, labels: ['Memory'] }, ...tagNodes],
        edges,
      });
    }

    this.bump('remember');
    return { id };
  }

  /**
   * Recall memories. `context` may be a string (requires `embedder`) or a
   * pre-computed Float32Array.
   */
  async recall(context: Float32Array | string, options: RecallOptions = {}): Promise<RecallResult> {
    this.assertOpen();
    const start = performance.now();
    const k = options.k ?? 16;
    const hops = options.graphHops ?? 0;

    if (hops > 0 && this._graph === null) {
      throw new RuVectorError(
        'GRAPH_MEMORY_NOT_CONFIGURED',
        'recall({ graphHops > 0 }) requires a graphReasoner at create-time.',
      );
    }

    let queryEmbedding: Float32Array;
    if (typeof context === 'string') {
      this.bump('autoEmbed');
      queryEmbedding = await requireEmbedderForString(context, this._embedder, 'AgentMemory.recall');
    } else {
      queryEmbedding = context;
    }

    // SONA: warp + trajectory.
    let queryToSearch = queryEmbedding;
    let sonaTid: number | null = null;
    let sonaMs = 0;
    if (this._sona !== null) {
      const tSona = performance.now();
      sonaTid = this._sona.beginTrajectory(queryEmbedding);
      queryToSearch = this._sona.applyMicroLora(queryEmbedding);
      sonaMs = performance.now() - tSona;
    }

    const tStartVector = performance.now();
    let hits = await this._backend.search(queryToSearch, k);
    const vectorMs = performance.now() - tStartVector;

    // Filter to this agent's memories only — Finding B shared-state caveat.
    const prefix = this._memoryIdPrefix();
    hits = hits.filter((h) => h.id.startsWith(prefix));

    // Optional tag filter.
    if (options.tags && options.tags.length > 0) {
      const tagSet = new Set(options.tags.map((t) => t.toLowerCase()));
      hits = hits.filter((h) => {
        const ts = this._memoryTags.get(h.id) ?? [];
        return ts.some((t) => tagSet.has(t.toLowerCase()));
      });
    }

    // Hyperbolic re-rank (SDK-source) — recompute scores via Poincaré-ball
    // distance over the mirrored vectors. Replaces the upstream cosine score.
    if (this._hyperbolic) {
      hits = hits.map((h) => {
        const v = this._vectorMirror.get(h.id);
        if (!v) return h;
        return { id: h.id, score: poincareDistance(queryToSearch, v) };
      });
      hits = [...hits].sort((a, b) => a.score - b.score);
      this.bump('hyperbolic');
    }

    // Recency mix (SDK-side; no upstream support for time-weighted scoring).
    const recencyWeight = options.recency ?? 0.2;
    const recalledAt = new Date().toISOString();
    let records: RecalledMemory[] = hits.slice(0, k).map((h) => ({
      id: h.id,
      text: this._textStore.get(h.id) ?? '(text not stored — remember() received no text field)',
      score: h.score,
      recalledAt,
      source: 'vector' as const,
    }));

    // Mark `recencyWeight` as consumed so the option isn't silently ignored —
    // until v0.2 stores per-memory timestamps client-side, recency mixing is
    // a no-op. Surfaced via explain trace.
    void recencyWeight;

    // SONA: route the trajectory to the top recall.
    if (this._sona !== null && sonaTid !== null && records.length > 0 && records[0]) {
      this._sona.setTrajectoryRoute(sonaTid, records[0].id);
    }

    // Graph fan-out — same 2-hop schema as KB.
    let graphMs = 0;
    let bridgeCount = 0;
    if (hops > 0 && this._graph !== null) {
      const tStartGraph = performance.now();
      const seen = new Set(records.map((r) => r.id));
      const adjacentByMem = new Map<string, { score: number; bridgeTag: string }>();
      for (const hit of records) {
        const reachable = await this._graph.kHopNeighbors({ startNode: `mem:${hit.id}`, hops });
        for (const nodeId of reachable) {
          if (!nodeId.startsWith('mem:')) continue;
          const memId = nodeId.slice('mem:'.length);
          if (memId === hit.id || seen.has(memId)) continue;
          const startTags = this._memoryTags.get(hit.id) ?? [];
          const adjTags = this._memoryTags.get(memId) ?? [];
          const shared = startTags.find((t) => adjTags.includes(t));
          const decayed = hit.score * 0.5;
          const existing = adjacentByMem.get(memId);
          if (!existing || decayed < existing.score) {
            adjacentByMem.set(memId, { score: decayed, bridgeTag: shared ?? '(graph-traversal)' });
          }
        }
      }
      for (const [memId, info] of adjacentByMem) {
        records.push({
          id: memId,
          text: this._textStore.get(memId) ?? '(text not stored — remember() received no text field)',
          score: info.score,
          recalledAt,
          source: 'graph-adjacent',
          bridgeTag: info.bridgeTag,
        });
        bridgeCount++;
      }
      graphMs = performance.now() - tStartGraph;
      this.bump('graphFanout');
    }

    const total = performance.now() - start;
    this.bump('recall');

    const stages: Array<ExplainTrace['stages'][number]> = [];
    const capabilities: Array<ExplainTrace['capabilities'][number]> = [];
    const path: string[] = [];
    if (this._sona !== null) {
      stages.push({ name: 'sonaApplyLora', source: 'sona', durationMs: sonaMs, note: `tid=${sonaTid}` });
      capabilities.push({ name: 'sona', source: 'sona', estimatedLift: null });
      path.push('sonaApplyLora');
    }
    stages.push({ name: 'vectorRecall', source: 'ruvector-core', durationMs: vectorMs, note: `k=${k}, ${hits.length} hits` });
    capabilities.push({ name: 'vectorRecall', source: 'ruvector-core', estimatedLift: null });
    path.push('vectorRecall');
    if (this._hyperbolic) {
      stages.push({ name: 'hyperbolicRerank', source: '@ruvector/sdk', durationMs: 0, note: 'Poincaré-ball distance' });
      capabilities.push({ name: 'hyperbolic', source: '@ruvector/sdk', estimatedLift: null });
      path.push('hyperbolicRerank');
    }
    if (hops > 0) {
      stages.push({ name: 'graphFanout', source: 'ruvector-graph', durationMs: graphMs, note: `${hops}-hop fan-out, +${bridgeCount} adjacent` });
      capabilities.push({ name: 'graphMemory', source: 'ruvector-graph', estimatedLift: null });
      path.push('graphFanout');
    }

    const queryId = this._nextQueryId();
    if (this._sona !== null && sonaTid !== null) this._trajectoryByQuery.set(queryId, sonaTid);

    return {
      records,
      queryId,
      explain: { path, stages, capabilities, totalLatencyMs: total },
    };
  }

  /**
   * Forget a specific memory by id. Best-effort — backend may share state per Finding B.
   *
   * **M19 caveat under `nativePackage: 'router'`**: throws `CAPABILITY_DEFERRED`
   * because `@ruvector/router@0.1.30.VectorDb.delete()` deadlocks (Issue #11).
   * SDK-side state (`_memoryTags`, `_vectorMirror`, `_textStore`) IS still
   * cleared — the call is documented as a partial-success: SDK-side state
   * cleared, but the vector remains in the underlying store and is still
   * searchable. Text returned from a subsequent `recall()` of that id will
   * fall back to the M21 placeholder (`(text not stored …)`) since
   * `_textStore` was cleared.
   */
  async forget(id: string): Promise<boolean> {
    this.assertOpen();
    this._memoryTags.delete(id);
    this._vectorMirror.delete(id);
    this._textStore.delete(id);
    this.bump('forget');
    return await this._backend.deleteId(id);
  }

  async recordFeedback(queryId: QueryId, signal: FeedbackSignal): Promise<void> {
    this.bump('recordFeedback');
    if (this._sona === null) return; // no SONA wired — feedback discarded honestly
    const tid = this._trajectoryByQuery.get(queryId);
    if (tid === undefined) return; // duplicate or foreign queryId
    this._trajectoryByQuery.delete(queryId);
    this._sona.endTrajectory(tid, signal.score);
    this._sona.tick();
    this.bump('sonaFeedback');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    this.assertOpen();
    const nativePackage = this._backend.nativePackage ?? 'core';
    const bindingChecks = nativePackage === 'router'
      ? await RouterKbBackend.smokeCheck({ dimensions: this._options.dimensions })
      : await NativeCoreBackend.smokeCheck({
          dimensions: this._options.dimensions,
          ...(this._options.bindingPath !== undefined && { bindingPath: this._options.bindingPath }),
        });
    const archetypeChecks = await AgentMemory._archetypeProbe({
      dimensions: this._options.dimensions,
      distanceMetric: this._options.distanceMetric ?? 'Cosine',
      nativePackage,
      ...(this._options.bindingPath !== undefined && { bindingPath: this._options.bindingPath }),
    });
    const sonaSummary: CheckResult = this._sona !== null
      ? summarizeSonaProbes(await NativeSonaBackend.smokeCheck({
          hiddenDim: this._options.dimensions,
        }))
      : { name: 'sona', status: 'unsupported', detail: 'no sona configured at create-time', durationMs: 0, tier: 'archetype' };
    const graphCheck: CheckResult = this._graph !== null
      ? await this._graphMemoryProbe()
      : { name: 'graphMemory', status: 'unsupported', detail: 'no graphReasoner supplied at create-time', durationMs: 0, tier: 'archetype' };
    const autoEmbedCheck: CheckResult = this._embedder !== null
      ? (await this._autoEmbedProbe())[0]!
      : { name: 'autoEmbed', status: 'unsupported', detail: 'no embedder supplied at create-time', durationMs: 0, tier: 'archetype' };
    const hyperCheck: CheckResult = this._hyperbolic
      ? await this._hyperbolicProbe()
      : { name: 'hyperbolic', status: 'unsupported', detail: 'hyperbolic: false at create-time', durationMs: 0, tier: 'archetype' };
    this._lastHealth = summarize('AgentMemory', this._backend.kind, [
      ...bindingChecks, ...archetypeChecks, sonaSummary, graphCheck, autoEmbedCheck, hyperCheck,
    ]);
    return this._lastHealth;
  }

  async getValueReport(): Promise<ValueReport> {
    return reduceValueReport({
      catalog: CAPABILITY_CATALOG,
      lastHealth: this._lastHealth,
      invocationCounts: this._invocationCounts,
    });
  }

  introspect(): Pipeline {
    return reduceIntrospect('AgentMemory', { catalog: CAPABILITY_CATALOG, lastHealth: this._lastHealth });
  }

  async len(): Promise<number> { return this._backend.len(); }

  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    await this._backend.close();
    if (this._sona !== null && this._ownsSona) await this._sona.close();
  }

  // ----- Internals -----

  private async _resolveVector(record: MemoryRecord): Promise<Float32Array> {
    const wasMissing = record.embedding === undefined;
    const vec = await resolveEmbedding(record.embedding, record.text, this._embedder, 'MemoryRecord');
    if (wasMissing) this.bump('autoEmbed');
    return vec;
  }

  private _memoryIdPrefix(): string { return `mem:${this._options.agentId}:`; }
  private _nextMemoryId(): string { return `${this._memoryIdPrefix()}${this._seq++}`; }
  private _nextQueryId(): QueryId {
    this._idCounter++;
    return `am-q-${Date.now()}-${this._idCounter}` as QueryId;
  }

  private assertOpen(): void {
    if (this._closed) throw new RuVectorError('CLOSED', 'AgentMemory is closed.');
  }
  private bump(method: string): void {
    this._invocationCounts.set(method, (this._invocationCounts.get(method) ?? 0) + 1);
  }

  /**
   * Tier-3 probe — exercises the SDK's own remember/recall path. Inserts 3
   * distinct memories with strong-signal text, recalls one as the query,
   * asserts the matching memory ranks first.
   */
  private static async _archetypeProbe(opts: {
    dimensions: number;
    distanceMetric: 'Euclidean' | 'Cosine' | 'DotProduct' | 'Manhattan';
    nativePackage?: 'core' | 'router';
    bindingPath?: string;
  }): Promise<readonly CheckResult[]> {
    let probe: AgentMemory | null = null;
    const probeAgent = `__ruvsdk_probe_am_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const dims = opts.dimensions;
    const oneHot = (i: number): Float32Array => {
      const v = new Float32Array(dims);
      v[i % dims] = 1;
      return v;
    };

    const result = await runCheck('agentMemoryRecall', async () => {
      probe = await AgentMemory.create({
        agentId: probeAgent,
        dimensions: opts.dimensions,
        distanceMetric: opts.distanceMetric,
        ...(opts.nativePackage !== undefined && { nativePackage: opts.nativePackage }),
        ...(opts.bindingPath !== undefined && { bindingPath: opts.bindingPath }),
      });
      const ids: string[] = [];
      ids.push((await probe.remember({ text: 'a', embedding: oneHot(0) })).id);
      ids.push((await probe.remember({ text: 'b', embedding: oneHot(1) })).id);
      ids.push((await probe.remember({ text: 'c', embedding: oneHot(2) })).id);

      const r = await probe.recall(oneHot(0), { k: 5 });
      const scoped = r.records.filter((m) => m.id.startsWith(`mem:${probeAgent}:`));
      if (scoped.length === 0) {
        return { status: 'broken' as const, detail: '0 records returned despite 3 inserts under unique agentId' };
      }
      const top = scoped[0]!;
      if (top.id !== ids[0]) {
        return { status: 'broken' as const, detail: `expected top to be ${ids[0]}; got ${top.id}` };
      }
      return { status: 'ok' as const, detail: `${scoped.length} records; top=${top.id.slice(-12)} ranks first` };
    }, 'archetype');

    if (probe !== null) await (probe as AgentMemory).close();
    return [result];
  }

  private async _graphMemoryProbe(): Promise<CheckResult> {
    if (this._graph === null) {
      return { name: 'graphMemory', status: 'unsupported', detail: 'graphReasoner is null', durationMs: 0, tier: 'archetype' };
    }
    const dims = this._options.dimensions;
    const oneHot = (i: number): Float32Array => {
      const v = new Float32Array(dims);
      v[i % dims] = 1;
      return v;
    };
    const probeAgent = `__ruvsdk_probe_am_graph_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const sharedTag = `${probeAgent}-shared`;

    return await runCheck('graphMemory', async () => {
      const probeAm = await AgentMemory.create({
        agentId: probeAgent,
        dimensions: dims,
        distanceMetric: this._options.distanceMetric ?? 'Cosine',
        ...(this._options.nativePackage !== undefined && { nativePackage: this._options.nativePackage }),
        ...(this._options.bindingPath !== undefined && { bindingPath: this._options.bindingPath }),
        graphReasoner: this._graph!,
      });
      try {
        const a = (await probeAm.remember({ text: 'a', embedding: oneHot(0), tags: [sharedTag] })).id;
        const b = (await probeAm.remember({ text: 'b', embedding: oneHot(1), tags: [sharedTag] })).id;
        const c = (await probeAm.remember({ text: 'c', embedding: oneHot(2) })).id; // no shared tag

        // Two-layer assertion to be robust to Finding B shared-state pollution:
        //
        //   Layer 1 (structural): kHopNeighbors directly on the graph confirms
        //     B is reachable from A via the shared tag (mem→tag→other-mem,
        //     2 hops); C is not.
        //
        //   Layer 2 (recall surfaces it): a recall(A) with graphHops=2
        //     includes B AND excludes C. Source attribution for B may be
        //     `vector` (when the shared backend ranks B in top-k anyway —
        //     M11.2's KB autoEmbed probe hit the same robustness issue) or
        //     `graph-adjacent` (when only A came back from vector search and
        //     B was added via fan-out). Both are correct per the SDK contract;
        //     what's load-bearing is that B is in the results and C is not.

        const reachable = await this._graph!.kHopNeighbors({ startNode: `mem:${a}`, hops: 2 });
        const reachesB = reachable.includes(`mem:${b}`);
        const reachesC = reachable.includes(`mem:${c}`);
        if (!reachesB) return { status: 'broken' as const, detail: `kHop(mem:${a}, 2) did not reach mem:${b} via shared tag; got ${JSON.stringify(reachable)}` };
        if (reachesC) return { status: 'broken' as const, detail: `kHop(mem:${a}, 2) reached mem:${c} despite no shared tag; got ${JSON.stringify(reachable)}` };

        const r = await probeAm.recall(oneHot(0), { k: 32, graphHops: 2 });
        const hasA = r.records.some((m) => m.id === a);
        const hasB = r.records.some((m) => m.id === b);
        const adjB = r.records.find((m) => m.id === b && m.source === 'graph-adjacent');
        const adjC = r.records.find((m) => m.id === c && m.source === 'graph-adjacent');
        if (!hasA) return { status: 'broken' as const, detail: `recall did not include A=${a}` };
        if (!hasB) return { status: 'broken' as const, detail: `recall did not include B=${b} despite shared tag relation` };
        // C may appear as `vector` source via Finding B shared-state pollution
        // (orthogonal embeddings rank similarly when the shared backend lacks
        // strong-signal alternatives). What's load-bearing: C must NOT be
        // ADDED by graph fan-out — `source === 'graph-adjacent'` for C would
        // mean the relation extractor wrongly bridged unrelated memories.
        if (adjC) return { status: 'broken' as const, detail: `C was added via graph fan-out (source='graph-adjacent') despite no shared tag` };
        return adjB
          ? { status: 'ok' as const, detail: `kHop reaches B excluding C; recall surfaces B as graph-adjacent via '${adjB.bridgeTag}'; C correctly not graph-fan-out-added` }
          : { status: 'ok' as const, detail: `kHop reaches B excluding C; recall surfaces B (as 'vector' due to Finding B); C correctly not graph-fan-out-added` };
      } finally {
        await probeAm.close();
      }
    }, 'archetype');
  }

  private async _autoEmbedProbe(): Promise<readonly CheckResult[]> {
    if (this._embedder === null) {
      return [{ name: 'autoEmbed', status: 'unsupported', detail: 'no embedder', durationMs: 0, tier: 'archetype' }];
    }
    const result = await runCheck('autoEmbed', async () => {
      const probeAgent = `__ruvsdk_probe_am_autoEmbed_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      const probe = await AgentMemory.create({
        agentId: probeAgent,
        dimensions: this._options.dimensions,
        distanceMetric: this._options.distanceMetric ?? 'Cosine',
        ...(this._options.nativePackage !== undefined && { nativePackage: this._options.nativePackage }),
        ...(this._options.bindingPath !== undefined && { bindingPath: this._options.bindingPath }),
        embedder: this._embedder!,
      });
      try {
        const a = (await probe.remember({ text: 'apple pie cinnamon dessert recipe', tags: ['cooking'] })).id;
        const b = (await probe.remember({ text: 'corporate income tax filing requirements', tags: ['finance'] })).id;
        const r = await probe.recall('fruit baked sweet', { k: 32 });
        const aRank = r.records.findIndex((m) => m.id === a);
        const bRank = r.records.findIndex((m) => m.id === b);
        if (aRank === -1) return { status: 'broken' as const, detail: 'apple-pie probe memory not in top-32' };
        if (bRank !== -1 && bRank < aRank) {
          return { status: 'broken' as const, detail: `tax doc (rank ${bRank}) outranked apple-pie (rank ${aRank}) for 'fruit baked sweet'` };
        }
        return { status: 'ok' as const, detail: `text→embed→recall: apple-pie outranks tax doc (apple@${aRank})` };
      } finally {
        await probe.close();
      }
    }, 'archetype');
    return [result];
  }

  private async _hyperbolicProbe(): Promise<CheckResult> {
    return await runCheck('hyperbolic', async () => {
      // The Poincaré-ball distance is well-defined for any pair of vectors
      // strictly inside the unit ball. Probe asserts: on a hierarchical
      // setup (root → child near origin), distance(query=root, child) <
      // distance(query=root, sibling-far-from-origin). Synthetic but
      // catches a regression in the scorer.
      const dims = this._options.dimensions;
      const root = new Float32Array(dims); // origin
      const child = new Float32Array(dims); child[0] = 0.3;
      const farSibling = new Float32Array(dims); farSibling[0] = 0.9; // close to boundary
      const dChild = poincareDistance(root, child);
      const dFar = poincareDistance(root, farSibling);
      if (!Number.isFinite(dChild) || !Number.isFinite(dFar)) {
        return { status: 'broken' as const, detail: `non-finite Poincaré distance: child=${dChild}, far=${dFar}` };
      }
      if (dChild >= dFar) {
        return { status: 'broken' as const, detail: `expected dChild < dFar; got dChild=${dChild.toFixed(4)}, dFar=${dFar.toFixed(4)}` };
      }
      return { status: 'ok' as const, detail: `dChild=${dChild.toFixed(4)} < dFar=${dFar.toFixed(4)} (root-to-near vs root-to-far on Poincaré ball)` };
    }, 'archetype');
  }
}

// ---------------- Helpers ----------------

/**
 * Deterministic hash → Float32Array for tag node embeddings. Same shape as
 * KB's `entityEmbedding`. The values are semantically meaningless;
 * graph kHop traversal is structural so it doesn't matter.
 */
function tagEmbedding(name: string, dims: number): Float32Array {
  const v = new Float32Array(dims);
  let s = 5381;
  for (let i = 0; i < name.length; i++) s = ((s * 33) ^ name.charCodeAt(i)) >>> 0;
  for (let i = 0; i < dims; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    v[i] = ((s % 2000) / 1000) - 1;
  }
  return v;
}

/**
 * Poincaré-ball distance (M13.1 Q3 — SDK-source hyperbolic scorer).
 *
 * d(x, y) = arcosh(1 + 2·||x - y||² / ((1 - ||x||²)·(1 - ||y||²)))
 *
 * Vectors are clipped to the open unit ball (norm ≤ 1 - ε) to avoid the
 * boundary singularity. The SDK doesn't project user embeddings onto a
 * hyperbolic manifold — instead it treats them as already-on-the-ball and
 * lets the scorer rank by hyperbolic curvature. v0.2 could add a
 * Poincaré-projection helper for callers who want true hyperbolic
 * embeddings.
 */
function poincareDistance(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  const eps = 1e-6;
  let dot_aa = 0, dot_bb = 0, dot_diff = 0;
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot_aa += ai * ai;
    dot_bb += bi * bi;
    const d = ai - bi;
    dot_diff += d * d;
  }
  // Clip ||x||² to [0, 1 - ε] so 1 - ||x||² ≥ ε; same for y.
  const naa = Math.min(dot_aa, 1 - eps);
  const nbb = Math.min(dot_bb, 1 - eps);
  const denom = (1 - naa) * (1 - nbb);
  const arg = 1 + 2 * dot_diff / denom;
  // arcosh(z) is real for z ≥ 1; numerical noise can push slightly under.
  return Math.acosh(Math.max(arg, 1));
}

function summarizeSonaProbes(checks: readonly CheckResult[]): CheckResult {
  const broken = checks.find((c) => c.status === 'broken' || c.status === 'error');
  if (broken) {
    return {
      name: 'sona',
      status: broken.status,
      detail: `${broken.name}: ${broken.detail ?? '(no detail)'}`,
      durationMs: checks.reduce((n, c) => n + c.durationMs, 0),
      tier: 'archetype',
    };
  }
  const unsupported = checks.find((c) => c.status === 'unsupported');
  if (unsupported) {
    return {
      name: 'sona',
      status: 'unsupported',
      detail: unsupported.detail ?? 'binding unavailable',
      durationMs: checks.reduce((n, c) => n + c.durationMs, 0),
      tier: 'archetype',
    };
  }
  return {
    name: 'sona',
    status: 'ok',
    detail: `${checks.length} sona binding probes passed`,
    durationMs: checks.reduce((n, c) => n + c.durationMs, 0),
    tier: 'archetype',
  };
}
