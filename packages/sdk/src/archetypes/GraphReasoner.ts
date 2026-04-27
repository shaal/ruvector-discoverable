/**
 * Multi-hop graph queries, Cypher, hyperedges, k-hop traversal.
 *
 * **M6 v0.1 — first archetype with a real backend.** Wires to
 * `@ruvector/graph-node@2.0.3` via the native backend adapter.
 *
 * Default-active capabilities in v0.1:
 *   - Hyperedge insert + vector search    — ruvector-graph (HNSW over hyperedges)
 *   - K-hop graph traversal               — ruvector-graph
 *   - Graph statistics                    — ruvector-graph
 *
 * Dormant in v0.1 (reported by getValueReport):
 *   - Cypher query engine                 — STUB IN UPSTREAM. `@ruvector/graph-node@2.0.3`'s
 *                                           `query()` always returns empty nodes/edges,
 *                                           even for `MATCH (n) RETURN n`. The SDK still
 *                                           exposes `cypher()` so callers can experiment,
 *                                           but it logs a warning on first use.
 *   - Sublinear PageRank                  — ruvector-solver (no NAPI yet)
 *   - Leiden community detection          — ruvector-graph (not in NAPI)
 *   - Spectral graph sparsifier           — ruvector-sparsifier (no NAPI yet)
 *   - Mincut-gated attention              — ruvector-mincut-gated-transformer (no NAPI yet)
 *
 * Type revisions vs M5:
 *   - Node/Edge/Hyperedge now REQUIRE `embedding: Float32Array` to match the
 *     upstream binding. v0.2 will add an embedder config that derives the
 *     embedding from a string `text` field automatically.
 *   - `Edge.type` was renamed to `Edge.description` to match upstream.
 *   - `cypher()` result is now `{nodes, edges, stats}` not flat rows.
 *   - Added `kHopNeighbors`, `searchHyperedges`, `stats`, `subscribe`.
 *   - `pageRank()` and `communities()` retained but marked deferred-to-v0.2;
 *     they throw a clear error pointing at the underlying upstream gap.
 */

import type { BackendSpec } from '../core/backend.js';
import type { ExplainTrace } from '../core/explain.js';
import type { Pipeline } from '../core/pipeline.js';
import type { ValueReport, ValueReportProvider } from '../core/value-report.js';
import type { CheckResult, HealthCheckProvider, HealthCheckResult } from '../core/health.js';
import type { CapabilityCatalogEntry } from '../core/capability-catalog.js';
import { NotImplementedError, RuVectorError, reduceIntrospect, reduceValueReport, runCheck, summarize } from '../core/index.js';
import { resolveEmbedding, validateEmbedderDimensions } from '../core/auto-embed.js';
import { NativeGraphBackend } from '../backends/native-graph.js';
import { WasmGraphBackend } from '../backends/wasm-graph.js';
import type { GraphBackend } from '../backends/graph-backend.js';
import type { LocalLLM } from './LocalLLM.js';

// ---------------- Public types ----------------

export interface GraphReasonerOptions {
  /** Vector dimensions for node/edge/hyperedge embeddings. Required. */
  readonly dimensions: number;
  /** Distance metric for similarity. Default: `'Cosine'`. */
  readonly distanceMetric?: 'Euclidean' | 'Cosine' | 'DotProduct' | 'Manhattan';
  /** Storage path. If omitted, the graph runs in-memory only. */
  readonly storage?: string;
  readonly backend?: BackendSpec;
  readonly capabilities?: GraphReasonerCapabilityConfig;
  /**
   * Optional `LocalLLM` instance used to derive embeddings from text.
   *
   * **M11.2:** when wired, `embedding` becomes optional on `Node`, `Edge`,
   * and `Hyperedge` — missing embeddings are derived from `Node.text ?? id`
   * (Node) or `description` (Edge / Hyperedge). Pre-computed Float32Array
   * is the fast path and bypasses derivation.
   *
   * The embedder's `embedDimensions` must match this graph's `dimensions`,
   * or `create()` throws `EMBEDDER_DIM_MISMATCH`. The user owns the
   * embedder's lifecycle.
   */
  readonly embedder?: LocalLLM;
}

export interface GraphReasonerCapabilityConfig {
  /** Default: true. */
  readonly cypher?: boolean;
  /** Default: 'auto' — on when graph has > 10k nodes. *Deferred to v0.2.* */
  readonly sublinearSolvers?: 'auto' | boolean;
  /** Default: 'auto' — on when graph has > 100k edges. *Deferred to v0.2.* */
  readonly sparsifier?: 'auto' | boolean;
  /** Default: false. *Deferred to v0.2.* */
  readonly mincutGating?: boolean;
  /** Default: false. *Deferred to v0.2.* */
  readonly graphTransformers?: boolean;
}

export interface Node {
  readonly id: string;
  /**
   * Pre-computed embedding. Optional when an `embedder` was wired at
   * create-time — derived from `text ?? id` in that case. Required
   * (and dimension-checked by the upstream binding) without an embedder.
   */
  readonly embedding?: Float32Array;
  /** Optional text used to derive `embedding` when an embedder is wired. Falls back to `id`. */
  readonly text?: string;
  readonly labels?: readonly string[];
  /** Property values must be strings (upstream constraint). */
  readonly properties?: Readonly<Record<string, string>>;
}

export interface Edge {
  readonly from: string;
  readonly to: string;
  /** Edge label / description. Upstream calls this `description`; treats it as the edge type. */
  readonly description: string;
  /**
   * Pre-computed embedding. Optional when an `embedder` was wired at
   * create-time — derived from `description` in that case.
   */
  readonly embedding?: Float32Array;
  /** Confidence in [0, 1]. */
  readonly confidence?: number;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface Hyperedge {
  readonly nodes: readonly string[];
  readonly description: string;
  /**
   * Pre-computed embedding. Optional when an `embedder` was wired at
   * create-time — derived from `description`.
   */
  readonly embedding?: Float32Array;
  readonly confidence?: number;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface NodeResult {
  readonly id: string;
  readonly labels: readonly string[];
  readonly properties: Readonly<Record<string, string>>;
}

export interface EdgeResult {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly edgeType: string;
  readonly properties: Readonly<Record<string, string>>;
}

export interface CypherResult {
  readonly nodes: readonly NodeResult[];
  readonly edges: readonly EdgeResult[];
  readonly stats?: GraphStats;
  readonly explain: ExplainTrace;
}

export interface GraphStats {
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly avgDegree: number;
}

export interface HyperedgeSearchOptions {
  readonly embedding: Float32Array;
  readonly k: number;
}

export interface HyperedgeSearchResult {
  readonly id: string;
  readonly score: number;
}

export interface KHopOptions {
  readonly startNode: string;
  readonly hops: number;
}

export type GraphChangeListener = (change: unknown) => void;

// ---------------- Implementation ----------------

// Capability catalog — single source of truth for which capabilities the
// archetype claims. Each entry's defaultStatus is used when no observation is
// available; an optional probeName maps into the smoke-check result (M6.1).
// When a probe exists and a healthCheck has run, the observed status
// overrides the declared one.
//
// The reducer logic that consumes this lives in core/capability-catalog.ts
// (extracted in M8.2 after three archetypes confirmed the shape was stable).

const CAPABILITY_CATALOG: readonly CapabilityCatalogEntry[] = [
  {
    name: 'kHopTraversal',
    source: 'ruvector-graph',
    adrs: ['ADR-046'],
    probeName: 'kHopNeighbors',
    defaultStatus: 'active',
    invocationKey: 'kHopNeighbors',
  },
  {
    name: 'hyperedgeSearch',
    source: 'ruvector-graph',
    adrs: ['ADR-046'],
    probeName: 'hyperedgeSearch',
    defaultStatus: 'active',
    invocationKey: 'searchHyperedges',
  },
  {
    name: 'graphStats',
    source: 'ruvector-graph',
    probeName: 'stats',
    defaultStatus: 'active',
    invocationKey: 'stats',
  },
  {
    name: 'cypher',
    source: 'ruvector-graph',
    adrs: ['ADR-046', 'ADR-047'],
    probeName: 'cypher',
    // Declared dormant in v0.1 because we already know the upstream binding's
    // query() is a stub. The smoke check confirms this from observation; if
    // upstream ships 2.0.4 with a working engine, the observation will flip
    // this to active without any code change here.
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-bug',
    defaultDormantReason: 'STUB UPSTREAM (declared): @ruvector/graph-node@2.0.3 query() returns empty results. Run healthCheck() to confirm against the live binding.',
    defaultDormantLift: 'Cypher pattern matching for arbitrary multi-hop queries.',
    defaultDormantEnable: 'File upstream issue or wait for binding fix; meanwhile use kHopNeighbors + searchHyperedges.',
    invocationKey: 'cypher',
  },
  {
    name: 'sublinearPageRank',
    source: 'ruvector-solver',
    adrs: ['ADR-044', 'ADR-046'],
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'No published NAPI binding for ruvector-solver in this SDK version (v0.1).',
    defaultDormantLift: 'O(log n) PageRank for graphs > 100k nodes; otherwise irrelevant.',
    defaultDormantEnable: 'Track @ruvector/solver-node publishing, or use the http backend.',
  },
  {
    name: 'leidenCommunities',
    source: 'ruvector-graph',
    adrs: ['ADR-046'],
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'Implementation exists upstream but is not exposed in @ruvector/graph-node@2.0.3.',
    defaultDormantLift: '30-60% better recall on multi-hop queries via community-aware retrieval.',
    defaultDormantEnable: 'File upstream issue to expose Leiden in the NAPI surface, or implement via http backend.',
  },
  {
    name: 'graphSparsifier',
    source: 'ruvector-sparsifier',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'No published NAPI binding for ruvector-sparsifier in this SDK version (v0.1).',
    defaultDormantLift: 'O(n log n) edges instead of O(n²) for very dense graphs.',
    defaultDormantEnable: 'Track upstream publishing, or use the http backend.',
  },
  {
    name: 'autoEmbed',
    source: '@ruvector/sdk',
    probeName: 'autoEmbed',
    invocationKey: 'autoEmbed',
    // M11.2: SDK-side cross-archetype embedding propagation. Default dormant
    // because it requires the user to wire a LocalLLM at create-time.
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'sdk-integration',
    defaultDormantReason: 'GraphReasoner was constructed without an embedder. Pass ' +
      '`embedder: <LocalLLM>` (with matching dimensions) at create-time to addNodes/addEdges/addHyperedges with optional embedding.',
    defaultDormantLift: 'Drops the "user supplies pre-computed embedding on every Node/Edge/Hyperedge" caveat.',
    defaultDormantEnable: 'await GraphReasoner.create({ dimensions: 768, embedder: await LocalLLM.create() })',
  },
  {
    name: 'mincutGating',
    source: 'ruvector-mincut-gated-transformer',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'No published NAPI binding (v0.1).',
    defaultDormantLift: 'Dynamic attention pruning for traversal-heavy queries.',
    defaultDormantEnable: 'Track upstream publishing.',
  },
  // ===== WASM-only capabilities (M17.1; gated on transport === 'wasm') =====
  // These methods exist only in @ruvector/graph-wasm. Native backend declares
  // them dormant [upstream-binding] (no NAPI delete API per @ruvector/graph-node@2.0.3);
  // WASM smokeCheck reports observed status — `cypherImport` is broken
  // upstream per Issue #09; `cypherExport` / `nodeDelete` / `edgeDelete` work.
  {
    name: 'cypherExport',
    source: 'ruvector-graph',
    probeName: 'cypherExport',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'Cypher export is exposed only via @ruvector/graph-wasm. Use transport: \'wasm\' to access.',
    defaultDormantLift: 'Round-trip a graph to/from Cypher CREATE statements; useful for backups and migration.',
    defaultDormantEnable: 'await GraphReasoner.create({ ..., backend: { kind: \'wasm\' } })',
  },
  {
    name: 'cypherImport',
    source: 'ruvector-graph',
    probeName: 'cypherImport',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'Cypher import is exposed only via @ruvector/graph-wasm; use transport: \'wasm\'. Note: the WASM implementation is currently a silent no-op (Issue #09).',
    defaultDormantLift: 'Bulk-load a graph from Cypher CREATE statements.',
    defaultDormantEnable: 'await GraphReasoner.create({ ..., backend: { kind: \'wasm\' } }) — but Issue #09 currently blocks real imports.',
  },
  {
    name: 'nodeDelete',
    source: 'ruvector-graph',
    probeName: 'nodeDelete',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'Node deletion is exposed only via @ruvector/graph-wasm. Native @ruvector/graph-node@2.0.3 has no delete API — graphs are append-only on native transport.',
    defaultDormantLift: 'Remove nodes after the graph is built (otherwise builders leak data).',
    defaultDormantEnable: 'await GraphReasoner.create({ ..., backend: { kind: \'wasm\' } })',
  },
  {
    name: 'edgeDelete',
    source: 'ruvector-graph',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'Edge deletion is exposed only via @ruvector/graph-wasm. Use transport: \'wasm\' to access.',
    defaultDormantLift: 'Remove edges after the graph is built (otherwise builders leak data).',
    defaultDormantEnable: 'await GraphReasoner.create({ ..., backend: { kind: \'wasm\' } })',
  },
];

export class GraphReasoner implements ValueReportProvider, HealthCheckProvider {
  // Internal state. Public API hides the backend.
  private readonly _backend: GraphBackend;
  private readonly _options: GraphReasonerOptions;
  private readonly _embedder: LocalLLM | null;
  private _invocationCounts = new Map<string, number>();
  private _closed = false;
  private _lastHealth: HealthCheckResult | null = null;

  private constructor(backend: GraphBackend, options: GraphReasonerOptions) {
    this._backend = backend;
    this._options = options;
    this._embedder = options.embedder ?? null;
  }

  /** Open or create a graph. Dispatches to native, WASM, or HTTP transport. */
  static async create(options: GraphReasonerOptions): Promise<GraphReasoner> {
    validateEmbedderDimensions(options.embedder, options.dimensions, 'GraphReasoner');
    const transport = resolveTransport(options.backend);
    const distanceMetric = options.distanceMetric ?? 'Cosine';
    let backend: GraphBackend;
    if (transport === 'native') {
      backend = await NativeGraphBackend.create({
        dimensions: options.dimensions,
        distanceMetric,
        ...(options.storage !== undefined && { storagePath: options.storage }),
      });
    } else if (transport === 'wasm') {
      backend = await WasmGraphBackend.create({
        dimensions: options.dimensions,
        distanceMetric,
      });
    } else {
      throw new RuVectorError(
        'CAPABILITY_DEFERRED',
        'HTTP transport is not yet implemented (M17.x deferred). The upstream @ruvector/server@0.1.0 package is broken-published per Issue #08.',
      );
    }
    return new GraphReasoner(backend, options);
  }

  /** Bulk-add nodes. Uses batchInsert under the hood when the count is large. */
  async addNodes(nodes: readonly Node[]): Promise<{ added: number }> {
    this.assertOpen();
    if (nodes.length === 0) return { added: 0 };
    const resolved = await this._resolveNodes(nodes);
    const result = await this._backend.batchInsert({ nodes: resolved, edges: [] });
    this.bump('addNodes');
    return { added: result.nodeIds.length };
  }

  /** Bulk-add edges. */
  async addEdges(edges: readonly Edge[]): Promise<{ added: number }> {
    this.assertOpen();
    if (edges.length === 0) return { added: 0 };
    const resolved = await this._resolveEdges(edges);
    const result = await this._backend.batchInsert({ nodes: [], edges: resolved });
    this.bump('addEdges');
    return { added: result.edgeIds.length };
  }

  /** Bulk-add nodes AND edges in a single round-trip. */
  async addBatch(input: { nodes?: readonly Node[]; edges?: readonly Edge[] }): Promise<{ nodesAdded: number; edgesAdded: number }> {
    this.assertOpen();
    const resolvedNodes = await this._resolveNodes(input.nodes ?? []);
    const resolvedEdges = await this._resolveEdges(input.edges ?? []);
    const result = await this._backend.batchInsert({
      nodes: resolvedNodes,
      edges: resolvedEdges,
    });
    this.bump('addBatch');
    return { nodesAdded: result.nodeIds.length, edgesAdded: result.edgeIds.length };
  }

  /** Bulk-add hyperedges. (One per round-trip — no batch op in upstream binding.) */
  async addHyperedges(edges: readonly Hyperedge[]): Promise<{ added: number }> {
    this.assertOpen();
    const resolved = await this._resolveHyperedges(edges);
    let added = 0;
    for (const e of resolved) {
      await this._backend.createHyperedge(e);
      added++;
    }
    this.bump('addHyperedges');
    return { added };
  }

  /**
   * Resolve missing embeddings on Nodes via the wired embedder, falling
   * back to `text` then `id`. Throws `MISSING_EMBEDDING` if a node lacks an
   * embedding and no embedder is wired.
   */
  private async _resolveNodes(nodes: readonly Node[]): Promise<readonly (Node & { embedding: Float32Array })[]> {
    const out: (Node & { embedding: Float32Array })[] = [];
    for (const n of nodes) {
      const wasMissing = n.embedding === undefined;
      const vec = await resolveEmbedding(n.embedding, n.text ?? n.id, this._embedder, `Node '${n.id}'`);
      if (wasMissing) this.bump('autoEmbed');
      out.push({ ...n, embedding: vec });
    }
    return out;
  }

  private async _resolveEdges(edges: readonly Edge[]): Promise<readonly (Edge & { embedding: Float32Array })[]> {
    const out: (Edge & { embedding: Float32Array })[] = [];
    for (const e of edges) {
      const wasMissing = e.embedding === undefined;
      const vec = await resolveEmbedding(e.embedding, e.description, this._embedder, `Edge '${e.from}->${e.to}'`);
      if (wasMissing) this.bump('autoEmbed');
      out.push({ ...e, embedding: vec });
    }
    return out;
  }

  private async _resolveHyperedges(edges: readonly Hyperedge[]): Promise<readonly (Hyperedge & { embedding: Float32Array })[]> {
    const out: (Hyperedge & { embedding: Float32Array })[] = [];
    for (const h of edges) {
      const wasMissing = h.embedding === undefined;
      const vec = await resolveEmbedding(h.embedding, h.description, this._embedder, `Hyperedge '${h.description}'`);
      if (wasMissing) this.bump('autoEmbed');
      out.push({ ...h, embedding: vec });
    }
    return out;
  }

  /**
   * Run a Cypher query.
   *
   * **Upstream limitation in v0.1:** `@ruvector/graph-node@2.0.3`'s `query()`
   * is a stub — it always returns empty `nodes`/`edges` arrays. The SDK
   * still calls through so the contract is intact, but logs a one-time
   * warning per archetype instance on first invocation. The fix lands when
   * upstream wires Cypher through the NAPI binding.
   */
  async cypher(query: string): Promise<CypherResult> {
    this.assertOpen();
    if (!this._cypherWarned) {
      this._cypherWarned = true;
      const transport = this._backend.kind;
      const pkg = transport === 'wasm' ? '@ruvector/graph-wasm@2.0.2' : '@ruvector/graph-node@2.0.3';
      const fallback = transport === 'wasm'
        ? 'Use stats / getNode / exportCypher for working operations on WASM transport.'
        : 'Use kHopNeighbors / searchHyperedges / stats for working graph operations in v0.1.';
      // eslint-disable-next-line no-console
      console.warn(
        `[ruvector-sdk] cypher() is currently a stub in ${pkg} — ` +
        `returns empty results regardless of query. ${fallback}`
      );
    }
    const start = performance.now();
    const result = await this._backend.cypher(query);
    const total = performance.now() - start;
    this.bump('cypher');
    return {
      nodes: result.nodes,
      edges: result.edges,
      stats: result.stats,
      explain: {
        path: ['cypher'],
        stages: [
          { name: 'cypher', source: 'ruvector-graph', durationMs: total, note: `${result.nodes.length} nodes, ${result.edges.length} edges (stub upstream)` },
        ],
        capabilities: [
          { name: 'cypher', source: 'ruvector-graph', estimatedLift: null, note: 'upstream stub — see archetype docs' },
        ],
        totalLatencyMs: total,
      },
    };
  }
  private _cypherWarned = false;

  /** K-hop neighbours from a starting node. */
  async kHopNeighbors(options: KHopOptions): Promise<readonly string[]> {
    this.assertOpen();
    this.bump('kHopNeighbors');
    return this._backend.kHopNeighbors(options.startNode, options.hops);
  }

  /** Vector search over hyperedge embeddings. */
  async searchHyperedges(options: HyperedgeSearchOptions): Promise<readonly HyperedgeSearchResult[]> {
    this.assertOpen();
    this.bump('searchHyperedges');
    return this._backend.searchHyperedges(options);
  }

  /** Graph statistics (totals + avg degree). */
  async stats(): Promise<GraphStats> {
    this.assertOpen();
    return this._backend.stats();
  }

  /** Subscribe to graph change events. Returns an unsubscribe function. */
  subscribe(listener: GraphChangeListener): () => void {
    this.assertOpen();
    this._backend.subscribe(listener);
    // Upstream subscribe doesn't yet return an unsubscribe handle in v2.0.3.
    // We return a no-op so callers can still write the unsub-on-close pattern.
    return () => {/* upstream v0.1 limitation — no per-listener unsubscribe */};
  }

  // ----- Deferred to v0.2 (no upstream NAPI binding yet) -----

  /** @deprecated Deferred to v0.2 — `ruvector-solver` has no published NAPI binding. */
  async pageRank(_options?: { topK?: number; damping?: number }): Promise<never> {
    throw new RuVectorError(
      'CAPABILITY_DEFERRED',
      'pageRank() is deferred to v0.2: ruvector-solver has no published @ruvector/solver-node package on npm. ' +
      'Track upstream publishing or implement via HTTP backend.'
    );
  }

  /** @deprecated Deferred to v0.2 — Leiden community detection isn't exposed in the NAPI binding. */
  async communities(_options?: { resolution?: number }): Promise<never> {
    throw new RuVectorError(
      'CAPABILITY_DEFERRED',
      'communities() is deferred to v0.2: Leiden community detection exists in ruvector-graph but ' +
      'is not exposed by @ruvector/graph-node@2.0.3.'
    );
  }

  // ----- Cross-cutting -----

  async getValueReport(): Promise<ValueReport> {
    return reduceValueReport({
      catalog: CAPABILITY_CATALOG,
      lastHealth: this._lastHealth,
      invocationCounts: this._invocationCounts,
    });
  }

  introspect(): Pipeline {
    return reduceIntrospect('GraphReasoner', {
      catalog: CAPABILITY_CATALOG,
      lastHealth: this._lastHealth,
    });
  }

  /**
   * Run a smoke check against an isolated probe instance of the backend.
   *
   * Does NOT touch the user's graph. Each capability is exercised with a
   * known input and the result classified as `ok` / `broken` / `unsupported`
   * / `error`. Idempotent — run any time. The Cypher-stub from M6 v0.1
   * surfaces as `broken` here automatically.
   *
   * The result is cached on the archetype instance so subsequent calls to
   * `getValueReport()` and `introspect()` consult observation rather than
   * the static catalog. Cached result is reset only by another `healthCheck()`
   * call (it does not auto-expire — backend behavior is presumed stable).
   */
  async healthCheck(): Promise<HealthCheckResult> {
    this.assertOpen();
    const transport = this._backend.kind;
    const bindingChecks = transport === 'wasm'
      ? await WasmGraphBackend.smokeCheck()
      : await NativeGraphBackend.smokeCheck();
    // archetype probe only meaningful on native (uses kHopNeighbors which
    // is missing on WASM per Issue #09).
    const archetypeChecks = transport === 'native'
      ? await GraphReasoner._archetypeProbe({
          dimensions: this._options.dimensions,
          distanceMetric: this._options.distanceMetric ?? 'Cosine',
        })
      : [];
    // M11.2: auto-embed probe (only runs when the user supplied an embedder
    // AND the transport supports kHopNeighbors — which is what the probe
    // asserts on).
    const autoEmbedChecks = transport === 'native' && this._embedder !== null
      ? await this._autoEmbedProbe()
      : [{
          name: 'autoEmbed',
          status: 'unsupported' as const,
          detail: this._embedder === null
            ? 'no embedder supplied at create-time'
            : 'autoEmbed probe requires kHopNeighbors which is unsupported on WASM transport (Issue #09)',
          durationMs: 0,
          tier: 'archetype' as const,
        }];
    this._lastHealth = summarize('GraphReasoner', transport, [...bindingChecks, ...archetypeChecks, ...autoEmbedChecks]);
    return this._lastHealth;
  }

  /**
   * Tier-3 probe for M11.2 — exercises addNodes (text-only) → kHop. Inserts
   * two nodes connected by an edge using only `text`/`id` (no embedding),
   * then asserts kHop traversal works. The probe doesn't assert semantic
   * ranking because GR's kHop is structural; the embedding values don't
   * affect reachability. The semantic assertion lives in KB / TSM probes.
   */
  private async _autoEmbedProbe(): Promise<readonly CheckResult[]> {
    if (this._embedder === null) {
      return [{ name: 'autoEmbed', status: 'unsupported' as const, detail: 'no embedder configured', durationMs: 0, tier: 'archetype' as const }];
    }
    const prefix = `__ruvsdk_probe_gr_autoEmbed_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const idA = `${prefix}-alice`;
    const idB = `${prefix}-bob`;

    const result = await runCheck('autoEmbed', async () => {
      const probe = await GraphReasoner.create({
        dimensions: this._options.dimensions,
        distanceMetric: this._options.distanceMetric ?? 'Cosine',
        embedder: this._embedder!,
      });
      try {
        // No `embedding` on any of these — derived via embedder.
        await probe.addBatch({
          nodes: [
            { id: idA, text: 'researcher Alice working on graph algorithms', labels: ['Probe'] },
            { id: idB, text: 'engineer Bob shipping graph databases', labels: ['Probe'] },
          ],
          edges: [
            { from: idA, to: idB, description: 'COLLABORATES_WITH' },
          ],
        });
        const reachable = await probe.kHopNeighbors({ startNode: idA, hops: 1 });
        if (!reachable.includes(idB)) {
          return {
            status: 'broken' as const,
            detail: `kHop(${idA.slice(-12)}, 1) did not reach ${idB.slice(-12)} after text-only addBatch: ${JSON.stringify(reachable)}`,
          };
        }
        return {
          status: 'ok' as const,
          detail: `text-only addBatch+kHop: ${idA.slice(-12)} reached ${idB.slice(-12)} (${reachable.length} reachable)`,
        };
      } finally {
        await probe.close().catch(() => {/* ignore */});
      }
    }, 'archetype');

    return [result];
  }

  /**
   * Tier-3 probe — exercises the SDK's own addNodes/addEdges/kHopNeighbors
   * path. Two nodes connected by one edge; kHop from one with hops=1 must
   * include the other.
   *
   * **Cleanup limitation:** `@ruvector/graph-node@2.0.3` has no delete API
   * on `GraphDatabase`, so probe data leaks into the shared graph store.
   * The probe uses unique IDs (`__ruvsdk_probe_gr_<run>_*`) so leaks don't
   * collide with user data, but the leak is permanent within the process.
   * Filed as a v0.2 cleanup item.
   */
  private static async _archetypeProbe(opts: {
    dimensions: number;
    distanceMetric: 'Euclidean' | 'Cosine' | 'DotProduct' | 'Manhattan';
  }): Promise<readonly CheckResult[]> {
    const prefix = `__ruvsdk_probe_gr_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const idA = `${prefix}-a`;
    const idB = `${prefix}-b`;
    const dims = opts.dimensions;
    const oneHot = (i: number): Float32Array => {
      const v = new Float32Array(dims);
      v[i % dims] = 1;
      return v;
    };

    const result = await runCheck('addNodes+addEdges+kHop', async () => {
      const probe = await GraphReasoner.create({
        dimensions: opts.dimensions,
        distanceMetric: opts.distanceMetric,
      });
      try {
        await probe.addBatch({
          nodes: [
            { id: idA, embedding: oneHot(0), labels: ['Probe'] },
            { id: idB, embedding: oneHot(1), labels: ['Probe'] },
          ],
          edges: [
            { from: idA, to: idB, description: 'PROBE_LINK', embedding: oneHot(2) },
          ],
        });
        const reachable = await probe.kHopNeighbors({ startNode: idA, hops: 1 });
        const found = reachable.includes(idB);
        return found
          ? { status: 'ok' as const, detail: `kHop(${idA.slice(-8)}, 1) reached ${idB.slice(-8)} (${reachable.length} reachable total)` }
          : { status: 'broken' as const, detail: `kHop(${idA.slice(-8)}, 1) did not include ${idB.slice(-8)}: ${JSON.stringify(reachable)}` };
      } finally {
        // No delete API; close the probe but data leaks (documented).
        await probe.close().catch(() => {/* ignore */});
      }
    }, 'archetype');

    return [result];
  }

  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    await this._backend.close();
  }

  // ----- Internals -----

  private assertOpen(): void {
    if (this._closed) {
      throw new RuVectorError('CLOSED', 'GraphReasoner is closed.');
    }
  }

  private bump(method: string): void {
    this._invocationCounts.set(method, (this._invocationCounts.get(method) ?? 0) + 1);
  }
}

// Suppress unused-import warning for NotImplementedError — kept for parity with
// the other M5 archetypes which still use it. Once those land in M6+, this
// re-export is dropped.
export { NotImplementedError };

/**
 * Resolve the requested transport from `BackendSpec`. Per M17 §6 Q5:
 * explicit-first, auto-fallback. Defaults: native in Node, wasm in browser.
 * HTTP requires explicit opt-in (no env-sniff to avoid surprising remote calls).
 */
function resolveTransport(spec: BackendSpec | undefined): 'native' | 'wasm' | 'http' {
  if (spec === undefined || spec === 'auto') {
    const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;
    return isNode ? 'native' : 'wasm';
  }
  if (typeof spec === 'string') {
    if (spec === 'native' || spec === 'wasm' || spec === 'http') return spec;
    throw new RuVectorError('INVALID_INPUT', `Unknown transport '${spec}'. Expected 'native' | 'wasm' | 'http' | 'auto'.`);
  }
  return spec.kind === 'auto'
    ? (typeof process !== 'undefined' && process.versions?.node !== undefined ? 'native' : 'wasm')
    : spec.kind;
}
