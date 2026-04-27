/**
 * Native (NAPI) backend for GraphReasoner. Wraps @ruvector/graph-node@2.0.x.
 *
 * Adapter responsibilities:
 *   - resolve sane defaults (Cosine distance, in-memory storage)
 *   - translate SDK types to upstream JsNode/JsEdge/JsHyperedge shapes
 *   - hold the GraphDatabase instance for the archetype's lifetime
 *
 * Intentionally thin. The archetype owns "what the user calls"; the backend
 * owns "how it gets to the binary."
 *
 * v0.2 will add WasmGraphBackend and HttpGraphBackend siblings under a
 * common interface; v0.1 keeps just this one to validate the pattern.
 */

import {
  GraphDatabase,
  JsDistanceMetric,
  type JsBatchInsert,
  type JsBatchResult,
  type JsEdge,
  type JsGraphOptions,
  type JsHyperedge,
  type JsHyperedgeQuery,
  type JsHyperedgeResult,
  type JsNode,
  type JsQueryResult,
  type JsGraphStats,
} from '@ruvector/graph-node';

import type { Edge, Hyperedge, HyperedgeSearchOptions, Node } from '../archetypes/GraphReasoner.js';
import { RuVectorError } from '../core/index.js';
import { runCheck, type CheckResult } from '../core/health.js';

// Inputs the backend accepts have a *required* embedding. The public Node /
// Edge / Hyperedge types make `embedding` optional (M11.2: derivable via a
// wired LocalLLM). Resolution happens in the archetype layer; by the time
// values reach the backend, embeddings must be present.
type ResolvedNode = Omit<Node, 'embedding'> & { readonly embedding: Float32Array };
type ResolvedEdge = Omit<Edge, 'embedding'> & { readonly embedding: Float32Array };
type ResolvedHyperedge = Omit<Hyperedge, 'embedding'> & { readonly embedding: Float32Array };

export interface NativeGraphBackendOptions {
  readonly dimensions: number;
  readonly distanceMetric: 'Euclidean' | 'Cosine' | 'DotProduct' | 'Manhattan';
  readonly storagePath?: string;
}

export class NativeGraphBackend {
  readonly kind = 'native' as const;
  readonly capabilities: ReadonlySet<string>;
  private readonly _db: GraphDatabase;

  private constructor(db: GraphDatabase) {
    this._db = db;
    // Capabilities the binding exposes today (v0.1).
    this.capabilities = new Set<string>([
      'cypher',
      'kHopTraversal',
      'hyperedgeSearch',
      'transactions',
      'graphChangeSubscription',
      'graphStats',
    ]);
  }

  static async create(options: NativeGraphBackendOptions): Promise<NativeGraphBackend> {
    const opts: JsGraphOptions = {
      distanceMetric: options.distanceMetric as JsDistanceMetric,
      dimensions: options.dimensions,
    };
    if (options.storagePath !== undefined) {
      // `open` returns a constructed instance from a path. The constructor form
      // doesn't take a storagePath; use `open` for persistent mode.
      // Note upstream's JsGraphOptions accepts storagePath but the constructor
      // doesn't fully wire it through — `open` is the correct path for v0.1.
      const db = GraphDatabase.open(options.storagePath);
      return new NativeGraphBackend(db);
    }
    const db = new GraphDatabase(opts);
    return new NativeGraphBackend(db);
  }

  // ----- Inserts -----

  async createNode(node: ResolvedNode): Promise<string> {
    return this._db.createNode(toJsNode(node));
  }

  async createEdge(edge: ResolvedEdge): Promise<string> {
    return this._db.createEdge(toJsEdge(edge));
  }

  async createHyperedge(edge: ResolvedHyperedge): Promise<string> {
    return this._db.createHyperedge(toJsHyperedge(edge));
  }

  async batchInsert(input: { nodes: readonly ResolvedNode[]; edges: readonly ResolvedEdge[] }): Promise<JsBatchResult> {
    const batch: JsBatchInsert = {
      nodes: input.nodes.map(toJsNode),
      edges: input.edges.map(toJsEdge),
    };
    return this._db.batchInsert(batch);
  }

  // ----- Reads -----

  async cypher(query: string): Promise<JsQueryResult> {
    return this._db.query(query);
  }

  async kHopNeighbors(startNode: string, hops: number): Promise<readonly string[]> {
    if (hops < 0 || !Number.isInteger(hops)) {
      throw new RuVectorError('INVALID_INPUT', `kHopNeighbors hops must be a non-negative integer, got ${hops}`);
    }
    return this._db.kHopNeighbors(startNode, hops);
  }

  async searchHyperedges(options: HyperedgeSearchOptions): Promise<readonly JsHyperedgeResult[]> {
    const q: JsHyperedgeQuery = {
      embedding: options.embedding,
      k: options.k,
    };
    return this._db.searchHyperedges(q);
  }

  async stats(): Promise<JsGraphStats> {
    return this._db.stats();
  }

  subscribe(listener: (change: unknown) => void): void {
    this._db.subscribe(listener);
  }

  async close(): Promise<void> {
    // Upstream binding has no explicit close. Drop our reference.
    // (The .node binary cleans up its own native state when GC'd.)
  }

  /**
   * Smoke-check this backend's working surface.
   *
   * Runs against an **isolated probe instance** — not the user's data — so
   * the smoke check is safe to invoke at any time and never mutates the
   * archetype's graph. Each capability is exercised with a minimal known
   * input and the result is classified by what we got back.
   *
   * Designed for the Cypher-stub case from M6 v0.1: we insert a known node,
   * call `query('MATCH (n) RETURN n')`, and check if it returns it. If the
   * query returns nothing despite stats showing the node exists, we mark
   * cypher as `broken` with a diagnostic. Every future binding regression of
   * this shape gets caught the same way.
   */
  static async smokeCheck(): Promise<readonly CheckResult[]> {
    const probe = new GraphDatabase({ dimensions: 4, distanceMetric: JsDistanceMetric.Cosine });
    const v = (n: number): Float32Array => new Float32Array([n, n + 0.1, n + 0.2, n + 0.3]);

    const insertNode = await runCheck('insertNode', async () => {
      const id = await probe.createNode({ id: 'probe-a', embedding: v(1), labels: ['Probe'] });
      return id === 'probe-a'
        ? { status: 'ok', detail: '1 node inserted, id round-tripped' }
        : { status: 'broken', detail: `expected id 'probe-a', got '${id}'` };
    });

    const insertEdge = await runCheck('insertEdge', async () => {
      await probe.createNode({ id: 'probe-b', embedding: v(2), labels: ['Probe'] });
      await probe.createEdge({ from: 'probe-a', to: 'probe-b', description: 'PROBE_LINK', embedding: v(3) });
      return { status: 'ok' };
    });

    const stats = await runCheck('stats', async () => {
      const s = await probe.stats();
      if (s.totalNodes === 2 && s.totalEdges === 1) return { status: 'ok', detail: `${s.totalNodes} nodes, ${s.totalEdges} edges` };
      return { status: 'broken', detail: `expected 2/1, got ${s.totalNodes}/${s.totalEdges}` };
    });

    const kHop = await runCheck('kHopNeighbors', async () => {
      const r = await probe.kHopNeighbors('probe-a', 1);
      // Expectation: at least probe-a itself + probe-b (1 hop away) reachable.
      const has = r.includes('probe-a') && r.includes('probe-b');
      return has
        ? { status: 'ok', detail: `${r.length} reachable from probe-a` }
        : { status: 'broken', detail: `expected to reach probe-b, got ${JSON.stringify(r)}` };
    });

    const hyperedge = await runCheck('hyperedgeSearch', async () => {
      await probe.createHyperedge({ nodes: ['probe-a', 'probe-b'], description: 'PROBE_HE', embedding: v(4) });
      const hits = await probe.searchHyperedges({ embedding: v(4), k: 5 });
      return hits.length >= 1
        ? { status: 'ok', detail: `${hits.length} hits, top score ${hits[0]?.score.toExponential(2) ?? 'n/a'}` }
        : { status: 'broken', detail: 'searchHyperedges returned 0 hits for an exact-match query' };
    });

    // The stub-detector. We insert exactly one node above; if MATCH (n) returns
    // anything other than [some node], the binding's Cypher engine is broken.
    const cypher = await runCheck('cypher', async () => {
      const r = await probe.query('MATCH (n) RETURN n');
      // The probe inserted 2 nodes earlier in this same run.
      // A working Cypher engine returns >= 1 node here.
      if (r.nodes.length >= 1) return { status: 'ok', detail: `${r.nodes.length} nodes returned` };
      return {
        status: 'broken',
        detail: `MATCH (n) RETURN n returned 0 nodes despite stats showing ${(await probe.stats()).totalNodes}. ` +
                'Cypher engine is a stub in this binding version.',
      };
    });

    return [insertNode, insertEdge, stats, kHop, hyperedge, cypher];
  }
}

// ---------------- Translators ----------------

function toJsNode(n: ResolvedNode): JsNode {
  return {
    id: n.id,
    embedding: n.embedding,
    ...(n.labels !== undefined && { labels: [...n.labels] }),
    ...(n.properties !== undefined && { properties: { ...n.properties } }),
  };
}

function toJsEdge(e: ResolvedEdge): JsEdge {
  return {
    from: e.from,
    to: e.to,
    description: e.description,
    embedding: e.embedding,
    ...(e.confidence !== undefined && { confidence: e.confidence }),
    ...(e.metadata !== undefined && { metadata: { ...e.metadata } }),
  };
}

function toJsHyperedge(h: ResolvedHyperedge): JsHyperedge {
  return {
    nodes: [...h.nodes],
    description: h.description,
    embedding: h.embedding,
    ...(h.confidence !== undefined && { confidence: h.confidence }),
    ...(h.metadata !== undefined && { metadata: { ...h.metadata } }),
  };
}
