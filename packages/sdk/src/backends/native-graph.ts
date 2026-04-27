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

  async createNode(node: Node): Promise<string> {
    return this._db.createNode(toJsNode(node));
  }

  async createEdge(edge: Edge): Promise<string> {
    return this._db.createEdge(toJsEdge(edge));
  }

  async createHyperedge(edge: Hyperedge): Promise<string> {
    return this._db.createHyperedge(toJsHyperedge(edge));
  }

  async batchInsert(input: { nodes: readonly Node[]; edges: readonly Edge[] }): Promise<JsBatchResult> {
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
}

// ---------------- Translators ----------------

function toJsNode(n: Node): JsNode {
  return {
    id: n.id,
    embedding: n.embedding,
    ...(n.labels !== undefined && { labels: [...n.labels] }),
    ...(n.properties !== undefined && { properties: { ...n.properties } }),
  };
}

function toJsEdge(e: Edge): JsEdge {
  return {
    from: e.from,
    to: e.to,
    description: e.description,
    embedding: e.embedding,
    ...(e.confidence !== undefined && { confidence: e.confidence }),
    ...(e.metadata !== undefined && { metadata: { ...e.metadata } }),
  };
}

function toJsHyperedge(h: Hyperedge): JsHyperedge {
  return {
    nodes: [...h.nodes],
    description: h.description,
    embedding: h.embedding,
    ...(h.confidence !== undefined && { confidence: h.confidence }),
    ...(h.metadata !== undefined && { metadata: { ...h.metadata } }),
  };
}
