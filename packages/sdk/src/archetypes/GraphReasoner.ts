/**
 * Multi-hop graph queries, Cypher, sublinear graph algorithms.
 *
 * Best-supported archetype upstream (11 crates, 1,866 items per M4).
 * The reference SDK example will be built against this archetype first.
 *
 * Default-active capabilities:
 *   - Cypher query engine                           — ruvector-graph
 *   - Graph transformers (8 verified modules)       — ruvector-graph-transformer
 *   - Sublinear PageRank / spectral methods         — ruvector-solver
 *   - Spectral graph sparsifier                     — ruvector-sparsifier
 *   - Mincut-gated attention                        — ruvector-mincut, -mincut-gated-transformer
 *   - DAG execution for multi-step queries          — ruvector-dag
 */

import type { BackendSpec } from '../core/backend.js';
import type { ExplainTrace } from '../core/explain.js';
import type { Pipeline } from '../core/pipeline.js';
import type { ValueReport, ValueReportProvider } from '../core/value-report.js';
import { NotImplementedError } from '../core/index.js';

export interface GraphReasonerOptions {
  /** Storage for the graph. Defaults to in-memory. */
  readonly storage?: string;
  readonly backend?: BackendSpec;
  readonly capabilities?: GraphReasonerCapabilityConfig;
}

export interface GraphReasonerCapabilityConfig {
  /** Default: true. */
  readonly cypher?: boolean;
  /** Default: true. */
  readonly graphTransformers?: boolean;
  /** Default: 'auto' — on when graph has > 10k nodes. */
  readonly sublinearSolvers?: 'auto' | boolean;
  /** Default: 'auto' — on when graph has > 100k edges. */
  readonly sparsifier?: 'auto' | boolean;
  /** Default: false. */
  readonly mincutGating?: boolean;
}

export interface Node {
  readonly id: string;
  readonly labels?: readonly string[];
  readonly properties?: Readonly<Record<string, unknown>>;
}

export interface Edge {
  readonly id?: string;
  readonly from: string;
  readonly to: string;
  readonly type: string;
  readonly properties?: Readonly<Record<string, unknown>>;
}

/**
 * Hyperedge — connects 3+ nodes at once. ruvector-graph supports these
 * natively (per upstream README); not all archetype paths use them.
 */
export interface Hyperedge {
  readonly id?: string;
  readonly nodes: readonly string[];
  readonly type: string;
  readonly properties?: Readonly<Record<string, unknown>>;
}

export interface CypherResult {
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  readonly explain: ExplainTrace;
}

export interface PageRankResult {
  readonly scores: readonly { id: string; score: number }[];
  readonly explain: ExplainTrace;
}

export interface CommunityDetectionResult {
  readonly communities: readonly { id: string; size: number; nodeIds: readonly string[] }[];
  readonly explain: ExplainTrace;
}

export class GraphReasoner implements ValueReportProvider {
  static async create(_options?: GraphReasonerOptions): Promise<GraphReasoner> {
    throw new NotImplementedError('GraphReasoner.create');
  }

  /** Bulk-add nodes. */
  addNodes(_nodes: readonly Node[]): Promise<{ added: number }> {
    throw new NotImplementedError('GraphReasoner.addNodes');
  }

  /** Bulk-add edges. */
  addEdges(_edges: readonly Edge[]): Promise<{ added: number }> {
    throw new NotImplementedError('GraphReasoner.addEdges');
  }

  /** Bulk-add hyperedges. */
  addHyperedges(_edges: readonly Hyperedge[]): Promise<{ added: number }> {
    throw new NotImplementedError('GraphReasoner.addHyperedges');
  }

  /** Run a Cypher query. */
  cypher(_query: string, _params?: Readonly<Record<string, unknown>>): Promise<CypherResult> {
    throw new NotImplementedError('GraphReasoner.cypher');
  }

  /** Sublinear PageRank — O(log n) for large graphs when sublinearSolvers is on. */
  pageRank(_options?: { topK?: number; damping?: number }): Promise<PageRankResult> {
    throw new NotImplementedError('GraphReasoner.pageRank');
  }

  /** Community detection (Leiden). */
  communities(_options?: { resolution?: number }): Promise<CommunityDetectionResult> {
    throw new NotImplementedError('GraphReasoner.communities');
  }

  getValueReport(): Promise<ValueReport> {
    throw new NotImplementedError('GraphReasoner.getValueReport');
  }

  introspect(): Pipeline {
    throw new NotImplementedError('GraphReasoner.introspect');
  }

  close(): Promise<void> {
    throw new NotImplementedError('GraphReasoner.close');
  }
}
