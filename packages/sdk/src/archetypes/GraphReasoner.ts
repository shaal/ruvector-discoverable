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
import { NotImplementedError, RuVectorError } from '../core/index.js';
import { NativeGraphBackend } from '../backends/native-graph.js';

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
  readonly embedding: Float32Array;
  readonly labels?: readonly string[];
  /** Property values must be strings (upstream constraint). */
  readonly properties?: Readonly<Record<string, string>>;
}

export interface Edge {
  readonly from: string;
  readonly to: string;
  /** Edge label / description. Upstream calls this `description`; treats it as the edge type. */
  readonly description: string;
  readonly embedding: Float32Array;
  /** Confidence in [0, 1]. */
  readonly confidence?: number;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface Hyperedge {
  readonly nodes: readonly string[];
  readonly description: string;
  readonly embedding: Float32Array;
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

export class GraphReasoner implements ValueReportProvider {
  // Internal state. Public API hides the backend.
  private readonly _backend: NativeGraphBackend;
  private readonly _options: GraphReasonerOptions;
  private _invocationCounts = new Map<string, number>();
  private _closed = false;

  private constructor(backend: NativeGraphBackend, options: GraphReasonerOptions) {
    this._backend = backend;
    this._options = options;
  }

  /** Open or create a graph. */
  static async create(options: GraphReasonerOptions): Promise<GraphReasoner> {
    const backend = await NativeGraphBackend.create({
      dimensions: options.dimensions,
      distanceMetric: options.distanceMetric ?? 'Cosine',
      storagePath: options.storage,
    });
    return new GraphReasoner(backend, options);
  }

  /** Bulk-add nodes. Uses batchInsert under the hood when the count is large. */
  async addNodes(nodes: readonly Node[]): Promise<{ added: number }> {
    this.assertOpen();
    if (nodes.length === 0) return { added: 0 };
    const result = await this._backend.batchInsert({ nodes, edges: [] });
    this.bump('addNodes');
    return { added: result.nodeIds.length };
  }

  /** Bulk-add edges. */
  async addEdges(edges: readonly Edge[]): Promise<{ added: number }> {
    this.assertOpen();
    if (edges.length === 0) return { added: 0 };
    const result = await this._backend.batchInsert({ nodes: [], edges });
    this.bump('addEdges');
    return { added: result.edgeIds.length };
  }

  /** Bulk-add nodes AND edges in a single round-trip. */
  async addBatch(input: { nodes?: readonly Node[]; edges?: readonly Edge[] }): Promise<{ nodesAdded: number; edgesAdded: number }> {
    this.assertOpen();
    const result = await this._backend.batchInsert({
      nodes: input.nodes ?? [],
      edges: input.edges ?? [],
    });
    this.bump('addBatch');
    return { nodesAdded: result.nodeIds.length, edgesAdded: result.edgeIds.length };
  }

  /** Bulk-add hyperedges. (One per round-trip — no batch op in upstream binding.) */
  async addHyperedges(edges: readonly Hyperedge[]): Promise<{ added: number }> {
    this.assertOpen();
    let added = 0;
    for (const e of edges) {
      await this._backend.createHyperedge(e);
      added++;
    }
    this.bump('addHyperedges');
    return { added };
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
      // eslint-disable-next-line no-console
      console.warn(
        '[ruvector-sdk] cypher() is currently a stub in @ruvector/graph-node@2.0.3 — ' +
        'returns empty results regardless of query. Use kHopNeighbors / searchHyperedges / stats ' +
        'for working graph operations in v0.1.'
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
    const inv = (name: string) => this._invocationCounts.get(name) ?? 0;
    return {
      generatedAt: new Date().toISOString(),
      active: [
        { name: 'kHopTraversal',    source: 'ruvector-graph', invocations: inv('kHopNeighbors'),   adrs: ['ADR-046'] },
        { name: 'hyperedgeSearch',  source: 'ruvector-graph', invocations: inv('searchHyperedges'), adrs: ['ADR-046'] },
        { name: 'graphStats',       source: 'ruvector-graph', invocations: inv('stats') },
      ],
      dormant: [
        {
          name: 'cypher',
          source: 'ruvector-graph',
          reason: 'STUB UPSTREAM: @ruvector/graph-node@2.0.3 query() always returns empty results. ' +
                  'Inserts, k-hop, hyperedge search, and stats work; only Cypher query execution is non-functional.',
          expectedLift: 'Cypher pattern matching for arbitrary multi-hop queries.',
          enable: 'File upstream issue or wait for binding fix; meanwhile use kHopNeighbors + searchHyperedges.',
          adrs: ['ADR-046', 'ADR-047'],
        },
        {
          name: 'sublinearPageRank',
          source: 'ruvector-solver',
          reason: 'No published NAPI binding for ruvector-solver in this SDK version (v0.1).',
          expectedLift: 'O(log n) PageRank for graphs > 100k nodes; otherwise irrelevant.',
          enable: 'Track @ruvector/solver-node publishing, or use the http backend.',
          adrs: ['ADR-044', 'ADR-046'],
        },
        {
          name: 'leidenCommunities',
          source: 'ruvector-graph',
          reason: 'Implementation exists upstream but is not exposed in @ruvector/graph-node@2.0.3.',
          expectedLift: '30-60% better recall on multi-hop queries via community-aware retrieval.',
          enable: 'File upstream issue to expose Leiden in the NAPI surface, or implement via http backend.',
          adrs: ['ADR-046'],
        },
        {
          name: 'graphSparsifier',
          source: 'ruvector-sparsifier',
          reason: 'No published NAPI binding for ruvector-sparsifier in this SDK version (v0.1).',
          expectedLift: 'O(n log n) edges instead of O(n²) for very dense graphs.',
          enable: 'Track upstream publishing, or use the http backend.',
        },
        {
          name: 'mincutGating',
          source: 'ruvector-mincut-gated-transformer',
          reason: 'No published NAPI binding (v0.1).',
          expectedLift: 'Dynamic attention pruning for traversal-heavy queries.',
          enable: 'Track upstream publishing.',
        },
      ],
      summary: '3 of 8 unique capabilities active (kHopTraversal, hyperedgeSearch, graphStats). 5 dormant — including Cypher (stub upstream) and 4 awaiting NAPI publishing.',
    };
  }

  introspect(): Pipeline {
    return {
      archetype: 'GraphReasoner',
      stages: [
        { name: 'kHopTraversal',   source: 'ruvector-graph', required: false },
        { name: 'hyperedgeSearch', source: 'ruvector-graph', required: false },
      ],
      capabilities: [
        { name: 'kHopTraversal',    source: 'ruvector-graph',          active: true,  adrs: ['ADR-046'] },
        { name: 'hyperedgeSearch',  source: 'ruvector-graph',          active: true,  adrs: ['ADR-046'] },
        { name: 'graphStats',       source: 'ruvector-graph',          active: true },
        { name: 'cypher',           source: 'ruvector-graph',          active: false, adrs: ['ADR-046', 'ADR-047'] },
        { name: 'sublinearPageRank', source: 'ruvector-solver',        active: false, adrs: ['ADR-044'] },
        { name: 'leidenCommunities', source: 'ruvector-graph',         active: false, adrs: ['ADR-046'] },
        { name: 'graphSparsifier',  source: 'ruvector-sparsifier',     active: false },
        { name: 'mincutGating',     source: 'ruvector-mincut-gated-transformer', active: false },
      ],
    };
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
