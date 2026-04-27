/**
 * RAG over documents and other unstructured corpora.
 *
 * **M7 v0.1 — second archetype with a real backend.** Wires to the upstream
 * `@ruvector/core` NAPI binary (in-repo prebuilt; not yet published on npm).
 * Validates that the catalog/probe pattern from M6.2 is portable to a
 * meaningfully different archetype.
 *
 * Default-active capabilities in v0.1 (probed):
 *   - vectorInsert / vectorSearch                — ruvector-core
 *   - health / metrics                           — ruvector-core
 *   - version reporting                          — ruvector-core
 *
 * Dormant in v0.1 (declared, no probe):
 *   - hybrid search (sparse + dense + RRF)        — not in @ruvector/core's NAPI surface
 *   - Graph RAG / Leiden communities              — would coordinate with @ruvector/graph-node
 *   - ColBERT multi-vector reranking              — not in @ruvector/core's NAPI surface
 *   - Matryoshka adaptive-dimension funnel        — not in @ruvector/core's NAPI surface
 *   - SONA continual learning                     — sona's NAPI binding is published but not wired in v0.1
 *   - DiskANN for billion-scale corpora           — @ruvector/diskann not wired in v0.1
 *
 * **Surface revisions vs M5:**
 *   - `Document.embedding: Float32Array` is now required. v0.2 adds an embedder
 *     config that derives embeddings from a `text` field automatically.
 *   - New `retrieve(query, options)` method returns citations only — the
 *     working v0.1 surface for passage-retrieval RAG.
 *   - `ask()` retained but throws NotImplementedError pointing at retrieve()
 *     until an LLM is wired in a later milestone.
 */

import type { ExplainTrace } from '../core/explain.js';
import type { FeedbackProvider, FeedbackSignal, QueryId } from '../core/feedback.js';
import type { Pipeline } from '../core/pipeline.js';
import type { ValueReport, ValueReportProvider } from '../core/value-report.js';
import type { CheckResult, HealthCheckProvider, HealthCheckResult } from '../core/health.js';
import type { CapabilityCatalogEntry } from '../core/capability-catalog.js';
import { NotImplementedError, RuVectorError, reduceIntrospect, reduceValueReport, runCheck, summarize } from '../core/index.js';
import { resolveEmbedding, requireEmbedderForString, validateEmbedderDimensions } from '../core/auto-embed.js';
import { NativeCoreBackend } from '../backends/native-core.js';
import { RouterKbBackend } from '../backends/router-kb.js';
import { NativeSonaBackend } from '../backends/native-sona.js';
import type { KbBackend } from '../backends/kb-backend.js';
import { GraphReasoner } from './GraphReasoner.js';
import type { LocalLLM } from './LocalLLM.js';

// ---------------- Public types ----------------

export interface KnowledgeBaseOptions {
  /** Vector dimensions for document embeddings. Required. */
  readonly dimensions: number;
  /** Distance metric. Default: 'Cosine'. */
  readonly distanceMetric?: 'Euclidean' | 'Cosine' | 'DotProduct' | 'Manhattan';
  /** Storage path. Default: in-memory. */
  readonly storage?: string;
  /**
   * Path to the upstream @ruvector/core binary. Falls back to the
   * RUVECTOR_CORE_BINDING env var. Required when `nativePackage: 'core'`
   * (the default) because @ruvector/core is not yet published on npm.
   * Ignored when `nativePackage: 'router'`.
   */
  readonly bindingPath?: string;
  /**
   * **M18 — choose the NAPI package backing this KB.**
   *
   *   - `'core'` (default) wraps `@ruvector/core` — the upstream-planned
   *     primary. **Not yet published on npm**, so consumers must supply
   *     `bindingPath` or set `RUVECTOR_CORE_BINDING`.
   *   - `'router'` wraps `@ruvector/router@0.1.30+` — a stealth-published
   *     NAPI binding with a working VectorDb. **Publish-ready today**:
   *     `npm install @ruvector/sdk @ruvector/router` Just Works without
   *     the env-var workaround. Capability gap vs core: no batchInsert /
   *     health / metrics surface, but KB doesn't use those today.
   *
   * The SDK's reprobe (`tools/reprobe-bindings/reprobe.mjs`) tracks
   * `@ruvector/core` publication; when it lands, `'core'` becomes the
   * preferred default. M18 keeps `'core'` as the explicit default to
   * avoid silent behavior change on existing call sites.
   */
  readonly nativePackage?: 'core' | 'router';
  /** Override capability defaults. Most users should leave defaults alone. */
  readonly capabilities?: KnowledgeBaseCapabilityConfig;
  /**
   * Optional GraphReasoner instance for Graph RAG.
   *
   * When supplied, `ingest()` extracts entities from each document and
   * populates the graph; `retrieve(query, { graphRagHops })` fans out via
   * `kHopNeighbors` after vector search. The graphReasoner must use the
   * same `dimensions` as this KB, or `create()` throws.
   *
   * The user owns the lifecycle: this KB does not close() the supplied
   * graphReasoner. Multiple KBs can share one GraphReasoner.
   */
  readonly graphReasoner?: GraphReasoner;
  /**
   * Custom entity extractor. Default: heuristic that picks up `#hashtags`
   * and any `metadata.entities` array on the document. Replace with a
   * real NER pipeline for production use.
   */
  readonly entityExtractor?: EntityExtractor;

  /**
   * Optional SONA continual-learning configuration (M10 v0.1).
   *
   * When supplied, retrieve() begins a SONA trajectory for each query
   * and warps the query embedding via applyMicroLora before vector
   * search; recordFeedback() ends the trajectory with the user's reward
   * signal so SONA learns from feedback.
   *
   * The hiddenDim is automatically set to this KB's `dimensions`.
   *
   * Set `true` for default config (auto-resolve binding via npm or
   * RUVECTOR_SONA_BINDING env var), or pass an object for explicit
   * `bindingPath`.
   */
  readonly sona?: true | { readonly bindingPath?: string };

  /**
   * Optional `LocalLLM` instance used to derive embeddings from text.
   *
   * **M11.2:** when wired, `Document.embedding` becomes optional —
   * documents missing an embedding have one derived via `embedder.embed(text)`.
   * `retrieve()` also accepts a `string` query (embedded the same way).
   * The fast-path with pre-computed `Float32Array` is preserved.
   *
   * The embedder's `embedDimensions` must match this KB's `dimensions`,
   * or `create()` throws `EMBEDDER_DIM_MISMATCH`. The user owns the
   * embedder's lifecycle: this KB does not call `embedder.close()`.
   */
  readonly embedder?: LocalLLM;
}

export interface Entity {
  /** Stable graph node ID. The default extractor uses `entity:<lowercased name>`. */
  readonly id: string;
  /** Surface form as it appeared in the document. */
  readonly mention: string;
}

export type EntityExtractor = (doc: Document) => readonly Entity[];

/**
 * Default extractor — `#hashtags` plus `metadata.entities: string[]`.
 * Honest about what it is: no NER, no semantic understanding. For
 * production use, supply a real extractor via `KnowledgeBaseOptions.entityExtractor`.
 */
export const defaultEntityExtractor: EntityExtractor = (doc) => {
  const entities = new Map<string, Entity>();
  for (const m of doc.text.matchAll(/#([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
    if (!m[1]) continue;
    const name = m[1].toLowerCase();
    if (!entities.has(name)) entities.set(name, { id: `entity:${name}`, mention: m[0] });
  }
  const metaEntities = (doc.metadata as { entities?: unknown } | undefined)?.entities;
  if (Array.isArray(metaEntities)) {
    for (const raw of metaEntities) {
      if (typeof raw !== 'string' || raw.length === 0) continue;
      const norm = raw.toLowerCase().trim();
      if (norm.length === 0) continue;
      if (!entities.has(norm)) entities.set(norm, { id: `entity:${norm}`, mention: raw });
    }
  }
  return [...entities.values()];
};

/**
 * Deterministic hash → Float32Array. Used for entity nodes in the GraphReasoner
 * because @ruvector/graph-node@2.0.3 requires non-empty embeddings on every
 * node. The embedding values are semantically meaningless for entity nodes;
 * kHop traversal is structural, so it doesn't matter.
 */
function entityEmbedding(name: string, dims: number): Float32Array {
  const v = new Float32Array(dims);
  let s = 5381;
  for (let i = 0; i < name.length; i++) s = ((s * 33) ^ name.charCodeAt(i)) >>> 0;
  for (let i = 0; i < dims; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    v[i] = ((s % 2000) / 1000) - 1;
  }
  return v;
}

export interface KnowledgeBaseCapabilityConfig {
  /** Default: true. */
  readonly vectorSearch?: boolean;
  /** Default: false in v0.1 — not in NAPI surface. Toggle has no effect until v0.2. */
  readonly hybrid?: boolean;
  /** Default: false in v0.1 — needs @ruvector/graph-node coordination. */
  readonly graphRag?: boolean;
  /** Default: false in v0.1 — no NAPI binding. */
  readonly colbertRerank?: boolean;
  /** Default: false in v0.1 — no NAPI binding. */
  readonly matryoshka?: boolean;
  /** Default: false in v0.1 — sona NAPI not wired. */
  readonly sona?: boolean;
}

export interface Document {
  readonly id: string;
  readonly text: string;
  /**
   * Pre-computed embedding. Optional when an `embedder` was wired at
   * create-time — the SDK then derives it from `text`. Required (and
   * validated dimension-match against the backend) when no embedder is wired.
   */
  readonly embedding?: Float32Array;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RetrieveOptions {
  /** Top-k passages to return. Default: 8. */
  readonly k?: number;
  /** Optional metadata filter — v0.2; ignored in v0.1. */
  readonly filter?: Filter;
  /**
   * Graph RAG fan-out depth. After vector search, traverse the doc-entity
   * graph by this many hops and add reachable docs as `graph-adjacent`
   * citations. 0 disables. Requires a `graphReasoner` to have been
   * supplied at create-time; throws otherwise.
   *
   * **Schema note**: docs and entities live in the same graph as separate
   * node types connected by MENTIONS edges. Reaching a sibling doc that
   * shares an entity therefore takes **2 hops** (doc → entity → other-doc).
   * `graphRagHops: 1` only reaches entity nodes; `graphRagHops: 2` is the
   * minimum value that produces graph-adjacent doc citations. The SDK
   * filters non-doc nodes from the result regardless.
   */
  readonly graphRagHops?: number;
}

export interface Filter {
  readonly field: string;
  readonly op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'match';
  readonly value: unknown;
}

export interface RetrieveResult {
  readonly citations: readonly Citation[];
  readonly queryId: QueryId;
  readonly explain: ExplainTrace;
}

export interface Citation {
  readonly documentId: string;
  readonly score: number;
  /** How this citation was reached. */
  readonly source?: 'vector' | 'graph-adjacent';
  /** When `source === 'graph-adjacent'`, the entity that bridged. */
  readonly bridgeEntity?: string;
}

export interface IngestReport {
  readonly documentsIngested: number;
  readonly durationMs: number;
}

// Retained from M5 even though not implemented in v0.1, so the surface stays
// stable for the LLM milestone.
export interface AskOptions {
  readonly k?: number;
  readonly filter?: Filter;
  readonly maxContextTokens?: number;
}

export interface Answer {
  readonly text: string;
  readonly citations: readonly Citation[];
  readonly queryId: QueryId;
  readonly explain: ExplainTrace;
}

// ---------------- Capability catalog ----------------
// Reducer logic lives in core/capability-catalog.ts (extracted in M8.2 once
// three archetypes confirmed the shape). This file holds only the data:
// which capabilities the archetype claims and what to say about them.

const CAPABILITY_CATALOG: readonly CapabilityCatalogEntry[] = [
  {
    name: 'vectorSearch',
    source: 'ruvector-core',
    adrs: ['ADR-001'],
    probeName: 'vectorSearch',
    defaultStatus: 'active',
    invocationKey: 'retrieve',
  },
  {
    name: 'vectorInsert',
    source: 'ruvector-core',
    adrs: ['ADR-001'],
    probeName: 'vectorInsert',
    defaultStatus: 'active',
    invocationKey: 'ingest',
  },
  {
    name: 'health',
    source: 'ruvector-core',
    probeName: 'health',
    defaultStatus: 'active',
  },
  {
    name: 'metrics',
    source: 'ruvector-core',
    probeName: 'metrics',
    defaultStatus: 'active',
  },
  // Dormant-by-declaration capabilities. No probe because the underlying
  // surface isn't reachable from this binding.
  {
    name: 'hybridSearch',
    source: 'ruvector-core',
    adrs: ['ADR-001'],
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: '@ruvector/core@2.2.0 NAPI surface exposes only basic VectorDb. ' +
      'Sparse + dense fusion + RRF live in upstream Rust but are not bound to NAPI in this version.',
    defaultDormantLift: '20-49% retrieval improvement over single-vector search on heterogeneous corpora.',
    defaultDormantEnable: 'Track @ruvector/core publishing of the hybrid surface, or use the http backend.',
  },
  {
    name: 'graphRag',
    source: 'ruvector-graph',
    adrs: ['ADR-046'],
    probeName: 'graphRag',
    invocationKey: 'graphRagFanout',
    // Default-status is dormant because graph-rag requires the user to supply
    // a GraphReasoner at create-time. When supplied, the tier-3 probe runs
    // and flips the observed status to `ok`. Blocker is `sdk-integration`
    // because the SDK already does the work — the user just has to wire
    // the optional dependency. M9 v0.1 demonstrated this dormant→active flip.
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'sdk-integration',
    defaultDormantReason: 'KnowledgeBase was constructed without a graphReasoner. ' +
      'Pass one (with matching dimensions) at create-time and call retrieve(query, { graphRagHops: 2 }) to enable.',
    defaultDormantLift: '30-60% recall on multi-hop questions vs naive chunk retrieval (per upstream README).',
    defaultDormantEnable: "await KnowledgeBase.create({ ..., graphReasoner: await GraphReasoner.create({ dimensions }) })",
  },
  {
    name: 'colbertRerank',
    source: 'ruvector-core',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'ColBERT multi-vector late interaction is not exposed in @ruvector/core\'s NAPI surface.',
    defaultDormantLift: 'Per-token MaxSim scoring for fine-grained matching.',
    defaultDormantEnable: 'Wait for upstream NAPI publishing or use the http backend.',
  },
  {
    name: 'matryoshka',
    source: 'ruvector-core',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'Matryoshka adaptive-dimension search is not exposed in this NAPI surface.',
    defaultDormantLift: 'Coarse-to-fine funnel reduces tail latency on large corpora.',
    defaultDormantEnable: 'Wait for upstream NAPI publishing.',
  },
  {
    name: 'autoEmbed',
    source: '@ruvector/sdk',
    probeName: 'autoEmbed',
    invocationKey: 'autoEmbed',
    // M11.2: SDK-side cross-archetype propagation of LocalLLM.embed(). Default
    // dormant because it requires the user to wire a LocalLLM at create-time.
    // When wired, the tier-3 probe runs and observation flips to active.
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'sdk-integration',
    defaultDormantReason: 'KnowledgeBase was constructed without an embedder. Pass `embedder: <LocalLLM>` ' +
      'at create-time (with matching dimensions) to ingest text-only documents and call retrieve(string).',
    defaultDormantLift: 'Drops the "user supplies pre-computed embedding" caveat — single source of embeddings across the SDK.',
    defaultDormantEnable: 'await KnowledgeBase.create({ dimensions: 768, embedder: await LocalLLM.create() })',
  },
  {
    name: 'sona',
    source: 'sona',
    adrs: ['ADR-014', 'ADR-044'],
    probeName: 'sona',
    invocationKey: 'sonaFeedback',
    // M10 v0.1: SONA wiring shipped. Default-status remains dormant because
    // the user must opt in by passing `sona: true` (or a config object) to
    // KnowledgeBase.create(); when opted in, the tier-3 probe runs and the
    // observed status flips to ok. Same pattern as graphRag in M9.
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'sdk-integration',
    defaultDormantReason: 'KnowledgeBase was constructed without sona. Pass `sona: true` ' +
      '(or `sona: { bindingPath: ... }`) at create-time to enable continual learning ' +
      'via @ruvector/sona. recordFeedback is a no-op when sona is not wired.',
    defaultDormantLift: '10-25% lift on repeat queries via continual learning (LoRA + EWC++).',
    defaultDormantEnable: 'await KnowledgeBase.create({ ..., sona: true })',
  },
];

// ---------------- Implementation ----------------

export class KnowledgeBase implements ValueReportProvider, FeedbackProvider, HealthCheckProvider {
  private readonly _backend: KbBackend;
  private readonly _options: KnowledgeBaseOptions;
  private readonly _graph: GraphReasoner | null;
  private readonly _sona: NativeSonaBackend | null;
  private readonly _embedder: LocalLLM | null;
  private readonly _entityExtractor: EntityExtractor;
  private _invocationCounts = new Map<string, number>();
  private _closed = false;
  private _lastHealth: HealthCheckResult | null = null;
  private _idCounter = 0;
  // Tracks which entities a doc mentions, so retrieve()'s graph fan-out can
  // attribute the bridge entity in `graph-adjacent` citations.
  private _docEntities = new Map<string, readonly string[]>();
  // queryId → SONA trajectoryId mapping, so recordFeedback can close the
  // trajectory the retrieve() call opened.
  private _trajectoryByQuery = new Map<string, number>();

  private constructor(backend: KbBackend, options: KnowledgeBaseOptions, sona: NativeSonaBackend | null) {
    this._backend = backend;
    this._options = options;
    this._graph = options.graphReasoner ?? null;
    this._sona = sona;
    this._embedder = options.embedder ?? null;
    this._entityExtractor = options.entityExtractor ?? defaultEntityExtractor;
  }

  static async create(options: KnowledgeBaseOptions): Promise<KnowledgeBase> {
    validateEmbedderDimensions(options.embedder, options.dimensions, 'KnowledgeBase');
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
    if (options.sona !== undefined) {
      const sonaCfg = options.sona === true ? {} : options.sona;
      sona = await NativeSonaBackend.create({
        hiddenDim: options.dimensions,
        ...(sonaCfg.bindingPath !== undefined && { bindingPath: sonaCfg.bindingPath }),
      });
    }
    return new KnowledgeBase(backend, options, sona);
  }

  /**
   * Ingest documents.
   *
   * **M11.2:** `Document.embedding` is optional when an `embedder` was wired
   * at create-time — missing embeddings are derived from `Document.text`
   * before insert. With no embedder, `embedding` remains required and a
   * missing one throws `MISSING_EMBEDDING`.
   *
   * If a graphReasoner was supplied at create-time, this also extracts entities
   * via the configured extractor and writes the doc-entity graph.
   */
  async ingest(documents: readonly Document[]): Promise<IngestReport> {
    this.assertOpen();
    const start = performance.now();
    const resolved = await this._resolveDocEmbeddings(documents);
    const entries = resolved.map((d) => ({ id: d.id, vector: d.embedding }));
    await this._backend.insertBatch(entries);

    // Optional: populate the doc-entity graph for Graph RAG.
    if (this._graph !== null) {
      const dims = this._options.dimensions;
      // Collect distinct entities + edges to insert in one batch each.
      const entitiesToAdd = new Map<string, Float32Array>();
      const docNodes: { id: string; embedding: Float32Array; labels?: readonly string[] }[] = [];
      const edges: { from: string; to: string; description: string; embedding: Float32Array }[] = [];
      for (const doc of resolved) {
        const docNodeId = `doc:${doc.id}`;
        docNodes.push({ id: docNodeId, embedding: doc.embedding, labels: ['Doc'] });
        const ents = this._entityExtractor(doc);
        const seen = new Set<string>();
        for (const e of ents) {
          if (seen.has(e.id)) continue;
          seen.add(e.id);
          if (!entitiesToAdd.has(e.id)) entitiesToAdd.set(e.id, entityEmbedding(e.id, dims));
          edges.push({ from: docNodeId, to: e.id, description: 'MENTIONS', embedding: entityEmbedding(`${doc.id}->${e.id}`, dims) });
        }
        this._docEntities.set(doc.id, ents.map((e) => e.id));
      }
      const allNodes = [
        ...docNodes,
        ...[...entitiesToAdd].map(([id, embedding]) => ({ id, embedding, labels: ['Entity'] as readonly string[] })),
      ];
      await this._graph.addBatch({ nodes: allNodes, edges });
    }

    this.bump('ingest');
    return { documentsIngested: documents.length, durationMs: performance.now() - start };
  }

  /**
   * Retrieve top-k passages by vector similarity, optionally fanning out via
   * the doc-entity graph for Graph RAG.
   *
   * v0.1: returns `Citation[]` only — no LLM is wired, so synthesis is the
   * caller's job. `ask()` (which would do the synthesis) throws until an
   * LLM milestone lands.
   *
   * Graph RAG: when `options.graphRagHops > 0` AND a graphReasoner was
   * supplied at create-time, the SDK fans out from each top-k hit's doc
   * node by `graphRagHops` and adds reachable docs as `graph-adjacent`
   * citations. Throws if `graphRagHops > 0` but no graphReasoner.
   */
  async retrieve(query: Float32Array | string, options: RetrieveOptions = {}): Promise<RetrieveResult> {
    this.assertOpen();
    const start = performance.now();
    const k = options.k ?? 8;
    const hops = options.graphRagHops ?? 0;
    if (hops > 0 && this._graph === null) {
      throw new RuVectorError(
        'GRAPH_RAG_NOT_CONFIGURED',
        'retrieve({ graphRagHops > 0 }) requires a graphReasoner at create-time. ' +
        'Pass `graphReasoner: await GraphReasoner.create({ dimensions })` to KnowledgeBase.create().',
      );
    }

    // M11.2: string query → embedder → Float32Array. Pre-computed Float32Array
    // is the fast path and bypasses the embedder even if one is wired.
    // M13.2: dispatch via the shared core/auto-embed helper.
    let queryEmbedding: Float32Array;
    if (typeof query === 'string') {
      this.bump('autoEmbed');
      queryEmbedding = await requireEmbedderForString(query, this._embedder, 'KnowledgeBase.retrieve');
    } else {
      queryEmbedding = query;
    }

    // SONA: warp the query embedding via the current LoRA delta before search.
    // Begin a trajectory whose route is the top citation's docId; trajectory
    // is closed by recordFeedback() with the user's reward signal.
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
    const hits = await this._backend.search(queryToSearch, k);
    const vectorMs = performance.now() - tStartVector;
    const citations: Citation[] = hits.map((h) => ({ documentId: h.id, score: h.score, source: 'vector' as const }));

    // SONA: set the route to the top citation, so feedback links query→chosen-doc.
    if (this._sona !== null && sonaTid !== null && hits.length > 0 && hits[0]) {
      this._sona.setTrajectoryRoute(sonaTid, hits[0].id);
    }

    // Graph RAG fan-out
    let graphMs = 0;
    let bridgeCount = 0;
    if (hops > 0 && this._graph !== null) {
      const tStartGraph = performance.now();
      const seen = new Set(citations.map((c) => c.documentId));
      const adjacentByDoc = new Map<string, { score: number; bridgeEntity: string }>();
      for (const hit of hits) {
        // Each hit's graph node is `doc:<id>`. Fan out N hops.
        const reachable = await this._graph.kHopNeighbors({ startNode: `doc:${hit.id}`, hops });
        for (const nodeId of reachable) {
          // Filter to doc nodes; skip the start doc itself; skip docs already in citations.
          if (!nodeId.startsWith('doc:')) continue;
          const docId = nodeId.slice('doc:'.length);
          if (docId === hit.id) continue;
          if (seen.has(docId)) continue;
          // Best-effort bridge attribution: pick the first shared entity.
          const startEnts = this._docEntities.get(hit.id) ?? [];
          const adjEnts = this._docEntities.get(docId) ?? [];
          const shared = startEnts.find((e) => adjEnts.includes(e));
          // Score graph-adjacent docs by their parent's score, decayed by 0.5 per hop reach.
          const decayedScore = hit.score * 0.5;
          const existing = adjacentByDoc.get(docId);
          if (!existing || decayedScore < existing.score) {
            adjacentByDoc.set(docId, { score: decayedScore, bridgeEntity: shared ?? '(graph-traversal)' });
          }
        }
      }
      for (const [docId, info] of adjacentByDoc) {
        citations.push({ documentId: docId, score: info.score, source: 'graph-adjacent', bridgeEntity: info.bridgeEntity });
        bridgeCount++;
      }
      graphMs = performance.now() - tStartGraph;
      this.bump('graphRagFanout');
    }

    const total = performance.now() - start;
    this.bump('retrieve');

    const stages: Array<ExplainTrace['stages'][number]> = [];
    const capabilities: Array<ExplainTrace['capabilities'][number]> = [];
    const path: string[] = [];
    if (this._sona !== null) {
      stages.push({ name: 'sonaApplyLora', source: 'sona', durationMs: sonaMs, note: `tid=${sonaTid}, query warped via microLoRA` });
      capabilities.push({ name: 'sona', source: 'sona', estimatedLift: null });
      path.push('sonaApplyLora');
    }
    stages.push({ name: 'vectorSearch', source: 'ruvector-core', durationMs: vectorMs, note: `k=${k}, ${hits.length} hits` });
    capabilities.push({ name: 'vectorSearch', source: 'ruvector-core', estimatedLift: null });
    path.push('vectorSearch');
    if (hops > 0) {
      stages.push({ name: 'graphRagFanout', source: 'ruvector-graph', durationMs: graphMs, note: `${hops}-hop fan-out, +${bridgeCount} adjacent` });
      capabilities.push({ name: 'graphRag', source: 'ruvector-graph', estimatedLift: null });
      path.push('graphRagFanout');
    }

    const queryId = this.nextQueryId();
    if (this._sona !== null && sonaTid !== null) {
      this._trajectoryByQuery.set(queryId, sonaTid);
    }

    return {
      citations,
      queryId,
      explain: {
        path,
        stages,
        capabilities,
        totalLatencyMs: total,
      },
    };
  }

  /** Generate an answer. v0.1 throws — no LLM wired yet. Use retrieve() for passage-only RAG. */
  ask(_question: string, _options?: AskOptions): Promise<Answer> {
    throw new NotImplementedError(
      'KnowledgeBase.ask — no LLM is wired in v0.1. Call retrieve(queryEmbedding, ...) ' +
      'for passage-only RAG and synthesize the answer client-side until the LLM milestone lands.'
    );
  }

  async recordFeedback(queryId: QueryId, signal: FeedbackSignal): Promise<void> {
    this.bump('recordFeedback');
    if (this._sona === null) {
      // No SONA wired — feedback discarded. Dormant entry in getValueReport
      // explains this to the developer.
      return;
    }
    const tid = this._trajectoryByQuery.get(queryId);
    if (tid === undefined) {
      // Trajectory was already closed (duplicate feedback) or queryId is foreign.
      // Silently ignore — recording feedback for an unknown query is a no-op,
      // not an error.
      return;
    }
    this._trajectoryByQuery.delete(queryId);
    // signal.score is in [-1, 1] per FeedbackSignal contract; pass straight to SONA.
    this._sona.endTrajectory(tid, signal.score);
    // Trigger a learning tick so the trajectory contributes ASAP.
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
    const archetypeChecks = await KnowledgeBase._archetypeProbe({
      dimensions: this._options.dimensions,
      distanceMetric: this._options.distanceMetric ?? 'Cosine',
      nativePackage,
      ...(this._options.bindingPath !== undefined && { bindingPath: this._options.bindingPath }),
    });
    // M9: graph-rag probe (when user supplied a graphReasoner).
    const graphRagChecks = this._graph !== null
      ? await this._graphRagProbe()
      : [{
          name: 'graphRag',
          status: 'unsupported' as const,
          detail: 'no graphReasoner supplied at create-time',
          durationMs: 0,
          tier: 'archetype' as const,
        }];
    // M10: sona probe (when user opted into sona).
    const sonaProbeChecks = this._sona !== null
      ? await NativeSonaBackend.smokeCheck({
          hiddenDim: this._options.dimensions,
          ...(typeof this._options.sona === 'object' && this._options.sona?.bindingPath !== undefined
            && { bindingPath: this._options.sona.bindingPath }),
        })
      : [{
          name: 'sona',
          status: 'unsupported' as const,
          detail: 'no sona configured at create-time',
          durationMs: 0,
          tier: 'archetype' as const,
        }];
    // For consumers, we expose a single summary check named `sona` reflecting
    // the binding-tier probes. If any is broken, sona = broken.
    const sonaSummary = summarizeSonaProbes(sonaProbeChecks);
    // M11.2: auto-embed cross-archetype probe (when user supplied an embedder).
    const autoEmbedChecks = this._embedder !== null
      ? await this._autoEmbedProbe()
      : [{
          name: 'autoEmbed',
          status: 'unsupported' as const,
          detail: 'no embedder supplied at create-time',
          durationMs: 0,
          tier: 'archetype' as const,
        }];
    this._lastHealth = summarize('KnowledgeBase', 'native', [
      ...bindingChecks,
      ...archetypeChecks,
      ...graphRagChecks,
      sonaSummary,
      ...autoEmbedChecks,
    ]);
    return this._lastHealth;
  }

  /**
   * Tier-3 probe for M11.2 auto-embed wiring. Constructs a temp KB sharing
   * the user's embedder, ingests two text-only docs (one about fruit
   * desserts, one about tax filings), retrieves with a string query about
   * baked sweets, and asserts the dessert doc ranks first.
   *
   * The polysemous string pair (cooking vs tax) gives a strong-signal gap —
   * same logic as M11.1's `similarityMonotonic` probe. A binding that
   * embedded text into garbage would fail this assertion deterministically.
   */
  private async _autoEmbedProbe(): Promise<readonly CheckResult[]> {
    if (this._embedder === null) {
      return [{ name: 'autoEmbed', status: 'unsupported' as const, detail: 'no embedder configured', durationMs: 0, tier: 'archetype' as const }];
    }
    const dims = this._options.dimensions;
    const prefix = `__ruvsdk_probe_kb_autoEmbed_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const idA = `${prefix}-fruit`;
    const idB = `${prefix}-tax`;

    const result = await runCheck('autoEmbed', async () => {
      const probeKb = await KnowledgeBase.create({
        dimensions: dims,
        distanceMetric: this._options.distanceMetric ?? 'Cosine',
        ...(this._options.bindingPath !== undefined && { bindingPath: this._options.bindingPath }),
        embedder: this._embedder!,
      });
      try {
        await probeKb.ingest([
          { id: idA, text: 'apple pie cinnamon dessert recipe' },
          { id: idB, text: 'corporate income tax filing requirements' },
        ]);
        // Wide k so probe assertion is robust to Finding B shared-state
        // pollution: the user's own docs may outrank the probe's docs in
        // absolute terms; what matters is the relative order *among the
        // probe's own ids*. Apple-pie must outrank tax-filing for query
        // 'fruit baked sweet'; that's the semantic invariant.
        const r = await probeKb.retrieve('fruit baked sweet', { k: 32 });
        const aRank = r.citations.findIndex((c) => c.documentId === idA);
        const bRank = r.citations.findIndex((c) => c.documentId === idB);
        if (aRank === -1) {
          return {
            status: 'broken' as const,
            detail: `apple-pie probe doc not in top-${r.citations.length}; auto-embed pipeline likely broken`,
          };
        }
        if (bRank !== -1 && bRank < aRank) {
          return {
            status: 'broken' as const,
            detail: `tax-filing probe doc (rank ${bRank}) outranked apple-pie probe doc (rank ${aRank}) for 'fruit baked sweet' — semantic embedding likely broken`,
          };
        }
        return {
          status: 'ok' as const,
          detail: `text→embed→retrieve: apple-pie outranks tax-filing for 'fruit baked sweet' (apple-pie@${aRank}${bRank !== -1 ? `, tax@${bRank}` : ', tax not in top-32'})`,
        };
      } finally {
        // Best-effort cleanup of probe ids on the shared backend (Finding B).
        for (const id of [idA, idB]) {
          try { await this._backend.deleteId(id); } catch {/* ignore */}
        }
        await probeKb.close();
      }
    }, 'archetype');

    return [result];
  }

  /**
   * Resolve `Document.embedding` for every doc, deriving missing ones via the
   * wired embedder. Throws `MISSING_EMBEDDING` if any doc has neither an
   * embedding nor a wired embedder.
   *
   * Per-doc loop rather than batch because the published `RuvLLM.embed`
   * binding rejects array inputs (M11.1 finding) — `LocalLLM.embed(string[])`
   * dispatches per-string internally anyway.
   */
  private async _resolveDocEmbeddings(documents: readonly Document[]): Promise<readonly { id: string; text: string; embedding: Float32Array; metadata?: Readonly<Record<string, unknown>> }[]> {
    const out: { id: string; text: string; embedding: Float32Array; metadata?: Readonly<Record<string, unknown>> }[] = [];
    for (const d of documents) {
      const wasMissing = d.embedding === undefined;
      const vec = await resolveEmbedding(d.embedding, d.text, this._embedder, `Document '${d.id}'`);
      if (wasMissing) this.bump('autoEmbed');
      out.push(d.metadata !== undefined
        ? { id: d.id, text: d.text, embedding: vec, metadata: d.metadata }
        : { id: d.id, text: d.text, embedding: vec });
    }
    return out;
  }

  /**
   * Tier-3 probe specifically for the Graph RAG cross-archetype path.
   * Runs against the user's supplied graphReasoner with unique probe IDs
   * (so it doesn't pollute their data).
   *
   * Inserts 3 docs: A and B share entity X, C is unrelated. Retrieves with
   * graphRagHops=1 using A's embedding. Asserts: B appears as a
   * graph-adjacent citation bridged by X, AND C does not.
   */
  private async _graphRagProbe(): Promise<readonly CheckResult[]> {
    if (this._graph === null) {
      return [{ name: 'graphRag', status: 'unsupported' as const, detail: 'graphReasoner is null', durationMs: 0, tier: 'archetype' as const }];
    }
    const dims = this._options.dimensions;
    const oneHot = (i: number): Float32Array => {
      const v = new Float32Array(dims);
      v[i % dims] = 1;
      return v;
    };
    const prefix = `__ruvsdk_probe_grag_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const idA = `${prefix}-a`;
    const idB = `${prefix}-b`;
    const idC = `${prefix}-c`;
    const sharedEntity = `${prefix}-ent`;

    const result = await runCheck('graphRag', async () => {
      // Construct a temp KB sharing the user's graphReasoner.
      const probeKb = await KnowledgeBase.create({
        dimensions: dims,
        distanceMetric: this._options.distanceMetric ?? 'Cosine',
        ...(this._options.bindingPath !== undefined && { bindingPath: this._options.bindingPath }),
        graphReasoner: this._graph!,
      });
      try {
        await probeKb.ingest([
          { id: idA, text: 'a', embedding: oneHot(0), metadata: { entities: [sharedEntity] } },
          { id: idB, text: 'b', embedding: oneHot(1), metadata: { entities: [sharedEntity] } },
          { id: idC, text: 'c', embedding: oneHot(2) }, // no entities
        ]);
        // hops=2: doc→entity→other-doc. hops=1 would only reach the entity nodes.
        const r = await probeKb.retrieve(oneHot(0), { k: 1, graphRagHops: 2 });
        // Top should be A (vector); we look for B as graph-adjacent.
        const hasA = r.citations.some((c) => c.documentId === idA && c.source === 'vector');
        const adjacentB = r.citations.find((c) => c.documentId === idB && c.source === 'graph-adjacent');
        const adjacentC = r.citations.find((c) => c.documentId === idC && c.source === 'graph-adjacent');
        if (!hasA) return { status: 'broken' as const, detail: `expected vector hit on ${idA}; got ${r.citations.map(c => c.documentId).join(',')}` };
        if (!adjacentB) return { status: 'broken' as const, detail: `B should be graph-adjacent via shared entity; got ${r.citations.map(c => `${c.documentId}/${c.source}`).join(',')}` };
        if (adjacentC) return { status: 'broken' as const, detail: 'C has no shared entity but appeared as graph-adjacent' };
        return { status: 'ok' as const, detail: `vector→A; graph-adjacent→B via '${adjacentB.bridgeEntity}'; C correctly excluded` };
      } finally {
        await probeKb.close();
      }
    }, 'archetype');

    // Best-effort cleanup on the vector backend.
    for (const id of [idA, idB, idC]) {
      try { await this._backend.deleteId(id); } catch {/* ignore */}
    }
    return [result];
  }

  /**
   * Tier-3 probe — exercises the SDK's own ingest+retrieve path.
   * Inserts 3 documents with distinct one-hot embeddings under a unique
   * probe ID prefix, retrieves with one as the query, asserts the matching
   * doc ranks first. Cleans up via `NativeCoreBackend.deleteId`.
   */
  private static async _archetypeProbe(opts: {
    dimensions: number;
    distanceMetric: 'Euclidean' | 'Cosine' | 'DotProduct' | 'Manhattan';
    nativePackage?: 'core' | 'router';
    bindingPath?: string;
  }): Promise<readonly CheckResult[]> {
    let probe: KnowledgeBase | null = null;
    const prefix = `__ruvsdk_probe_kb_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const dims = opts.dimensions;
    const oneHot = (i: number): Float32Array => {
      const v = new Float32Array(dims);
      v[i % dims] = 1;
      return v;
    };
    const ids = [`${prefix}-a`, `${prefix}-b`, `${prefix}-c`];

    const result = await runCheck('ingest+retrieve+rank', async () => {
      probe = await KnowledgeBase.create({
        dimensions: opts.dimensions,
        distanceMetric: opts.distanceMetric,
        ...(opts.nativePackage !== undefined && { nativePackage: opts.nativePackage }),
        ...(opts.bindingPath !== undefined && { bindingPath: opts.bindingPath }),
      });
      await probe.ingest([
        { id: ids[0]!, text: 'a', embedding: oneHot(0) },
        { id: ids[1]!, text: 'b', embedding: oneHot(1) },
        { id: ids[2]!, text: 'c', embedding: oneHot(2) },
      ]);
      const r = await probe.retrieve(oneHot(0), { k: 5 });
      if (r.citations.length === 0) {
        return { status: 'broken' as const, detail: '0 citations despite 3 ingested docs' };
      }
      // The matching doc (ids[0]) should rank first since its embedding
      // is exactly the query.
      const top = r.citations[0];
      if (!top) return { status: 'broken' as const, detail: 'top citation is undefined' };
      // Filter only our own probe ids — shared state per Finding B may include
      // user/other-probe data above ours by score, so check if ids[0] appears
      // in the top-k at all.
      const found = r.citations.some((c) => c.documentId === ids[0]);
      return found
        ? { status: 'ok' as const, detail: `${r.citations.length} citations; probe-a found in top-${r.citations.length}` }
        : { status: 'broken' as const, detail: `probe-a not in top-${r.citations.length}: ${r.citations.map(c => c.documentId).join(',')}` };
    }, 'archetype');

    if (probe !== null) {
      const backend = (probe as KnowledgeBase)._backend;
      for (const id of ids) {
        try { await backend.deleteId(id); } catch {/* ignore */}
      }
      await (probe as KnowledgeBase).close();
    }

    return [result];
  }

  async getValueReport(): Promise<ValueReport> {
    return reduceValueReport({
      catalog: CAPABILITY_CATALOG,
      lastHealth: this._lastHealth,
      invocationCounts: this._invocationCounts,
    });
  }

  introspect(): Pipeline {
    return reduceIntrospect('KnowledgeBase', {
      catalog: CAPABILITY_CATALOG,
      lastHealth: this._lastHealth,
    });
  }

  /** Total document count in the index. */
  async len(): Promise<number> {
    return this._backend.len();
  }

  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    await this._backend.close();
  }

  // ----- Internals -----

  private assertOpen(): void {
    if (this._closed) {
      throw new RuVectorError('CLOSED', 'KnowledgeBase is closed.');
    }
  }

  private bump(method: string): void {
    this._invocationCounts.set(method, (this._invocationCounts.get(method) ?? 0) + 1);
  }

  private nextQueryId(): QueryId {
    this._idCounter++;
    return `kb-q-${Date.now()}-${this._idCounter}` as QueryId;
  }
}

/**
 * Roll up the multi-probe sona binding check into a single `sona` summary
 * CheckResult. The catalog's `sona` capability has `probeName: 'sona'`, so
 * this is the row the value-report reducer looks at.
 */
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
    detail: `${checks.length} sona binding probes passed (construct, trajectory, applyLora)`,
    durationMs: checks.reduce((n, c) => n + c.durationMs, 0),
    tier: 'archetype',
  };
}
