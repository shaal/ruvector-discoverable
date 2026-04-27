/**
 * Shared interface for GraphReasoner backends.
 *
 * **M17.1** — extracted as part of the multi-transport milestone. Both
 * `NativeGraphBackend` and `WasmGraphBackend` implement this; the archetype
 * dispatches to whichever was selected by `options.backend?.kind`.
 *
 * Per the ratified M17 §6 questions:
 * - WASM init lifecycle is hidden inside the backend (Q4) — `create()` does
 *   the byte-load on Node / fetch on browser; user code is transport-agnostic.
 * - Backend selection is explicit-first, auto-fallback (Q5) — Node defaults
 *   to native, browser defaults to wasm, http requires opt-in. The dispatch
 *   logic lives in `GraphReasoner.create()` and consults this interface.
 *
 * **Surface gap reality** (per M17.1 live probes): the WASM and native
 * bindings expose substantively different APIs. WASM ships with auto-
 * generated UUIDs (no user-controlled IDs at the binding layer), no
 * `kHopNeighbors` / `searchHyperedges` / `batchInsert` / `subscribe`, and
 * a broken `createHyperedge` (Issue #09). It does add `deleteNode` /
 * `deleteEdge` / `exportCypher` / `importCypher` (also broken) that
 * native lacks.
 *
 * The interface lists the *union* of methods. Each adapter implements
 * what its binding supports. Methods not supported by a transport throw
 * `RuVectorError('CAPABILITY_DEFERRED', ...)` with a transport-pointer
 * message. The archetype's `getValueReport()` reflects this via the
 * smoke-check `unsupported` status overlaid on the catalog (M6.2 pattern).
 */

import type { CheckResult } from '../core/health.js';
import type { Edge, Hyperedge, HyperedgeSearchOptions, Node } from '../archetypes/GraphReasoner.js';

export type ResolvedNode = Omit<Node, 'embedding'> & { readonly embedding: Float32Array };
export type ResolvedEdge = Omit<Edge, 'embedding'> & { readonly embedding: Float32Array };
export type ResolvedHyperedge = Omit<Hyperedge, 'embedding'> & { readonly embedding: Float32Array };

/** Common shape returned from `stats()`. Backends translate their native shape into this. */
export interface GraphBackendStats {
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly avgDegree: number;
}

/** Common shape returned from `cypher()` / `query()`. */
export interface GraphBackendQueryResult {
  readonly nodes: readonly { id: string; labels: readonly string[]; properties: Readonly<Record<string, string>> }[];
  readonly edges: readonly { id: string; from: string; to: string; edgeType: string; properties: Readonly<Record<string, string>> }[];
  readonly stats?: GraphBackendStats;
}

export interface GraphBackendBatchResult {
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
}

export interface GraphBackendHyperedgeResult {
  readonly id: string;
  readonly score: number;
}

export interface GraphBackend {
  readonly kind: 'native' | 'wasm' | 'http';
  /**
   * Capability set — names of standard catalog rows this backend supports.
   * The archetype consults this before dispatching, but adapters MUST also
   * fail cleanly on direct invocation: methods listed below throw
   * `CAPABILITY_DEFERRED` when not in `capabilities`.
   */
  readonly capabilities: ReadonlySet<string>;

  // ----- Inserts (most adapters support; WASM has UUID round-tripping internal) -----
  createNode(node: ResolvedNode): Promise<string>;
  createEdge(edge: ResolvedEdge): Promise<string>;
  createHyperedge(edge: ResolvedHyperedge): Promise<string>;
  batchInsert(input: { nodes: readonly ResolvedNode[]; edges: readonly ResolvedEdge[] }): Promise<GraphBackendBatchResult>;

  // ----- Reads -----
  cypher(query: string): Promise<GraphBackendQueryResult>;
  kHopNeighbors(startNode: string, hops: number): Promise<readonly string[]>;
  searchHyperedges(options: HyperedgeSearchOptions): Promise<readonly GraphBackendHyperedgeResult[]>;
  stats(): Promise<GraphBackendStats>;

  // ----- WASM-only (native adapters throw CAPABILITY_DEFERRED) -----
  deleteNode(id: string): Promise<boolean>;
  deleteEdge(id: string): Promise<boolean>;
  exportCypher(): Promise<string>;
  importCypher(statements: readonly string[]): Promise<number>;

  subscribe(listener: (change: unknown) => void): void;
  close(): Promise<void>;
}

export interface GraphBackendSmokeCheckable {
  smokeCheck(): Promise<readonly CheckResult[]>;
}
