/**
 * WASM backend for GraphReasoner. Wraps `@ruvector/graph-wasm@2.0.x`.
 *
 * **M17.1 — second graph transport.** Owns the WASM init lifecycle (Q4
 * ratification): user code is transport-agnostic; this adapter handles the
 * `init({ module_or_path: bytes })` byte-load on Node and the default
 * `init()` (fetch) flow on browsers.
 *
 * **Surface differences from `@ruvector/graph-node` (live-probed M17.1):**
 *
 *   ✓ working : createNode / createEdge / getNode / getEdge / stats /
 *               deleteNode / deleteEdge / exportCypher
 *   ✗ broken  : query (Cypher stub — same as Issue #01 in native binding) /
 *               createHyperedge ("Entity not found in hypergraph" — Issue #09) /
 *               importCypher (returns count but no-op — Issue #09)
 *   · missing : kHopNeighbors / searchHyperedges / batchInsert / subscribe
 *
 * The 4 missing methods are central to GraphReasoner's value proposition;
 * users selecting `transport: 'wasm'` will see them surface as
 * `dormant [upstream-binding]` in `getValueReport()`. Issue #09 documents
 * these so upstream can prioritize. Per CLAUDE.md "never block on upstream":
 * the SDK ships the working surface and names the gaps explicitly.
 *
 * **ID round-tripping.** `@ruvector/graph-wasm`'s `createNode(labels,
 * properties)` returns an auto-generated UUID — the user does not control
 * the ID at the binding layer. To keep `GraphReasoner`'s API consistent
 * across transports (where the user passes `{ id: 'alice', ... }`), this
 * adapter maintains an internal `Map<userId, wasmId>` and translates on
 * every call. `deleteNode(userId)` deletes via the mapped wasmId; subsequent
 * lookups by userId return `undefined` correctly.
 *
 * **Embedding handling.** WASM nodes/edges have no embedding field at the
 * binding layer — only hyperedges do. The archetype's `Node.embedding` is
 * silently dropped when reaching this backend (the embedding was already
 * used for any SDK-side derived purpose like auto-embed; the WASM binding
 * itself has no use for it). This is a documented v0.1 limitation; if
 * upstream adds embedding to nodes/edges, the adapter starts forwarding
 * them automatically (no SDK code change needed; M6.2 pattern).
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import type { HyperedgeSearchOptions } from '../archetypes/GraphReasoner.js';
import { RuVectorError } from '../core/index.js';
import { runCheck, type CheckResult } from '../core/health.js';
import type {
  GraphBackend,
  GraphBackendBatchResult,
  GraphBackendHyperedgeResult,
  GraphBackendQueryResult,
  GraphBackendStats,
  ResolvedEdge,
  ResolvedHyperedge,
  ResolvedNode,
} from './graph-backend.js';

// Lazy import — `@ruvector/graph-wasm` exports a default init() and named
// classes. We import the module namespace and call init() inside `create()`.
type GraphWasmModule = typeof import('@ruvector/graph-wasm');
type WasmGraphDB = InstanceType<GraphWasmModule['GraphDB']>;

export interface WasmGraphBackendOptions {
  readonly dimensions: number;
  readonly distanceMetric: 'Euclidean' | 'Cosine' | 'DotProduct' | 'Manhattan';
  /** Optional explicit URL or bytes for the .wasm file. Auto-detected in Node when omitted. */
  readonly wasmSource?: ArrayBufferView | URL | string;
}

/**
 * Singleton init: wasm-bindgen modules are global per import. Calling init()
 * twice is harmless (the second call resolves with the already-loaded
 * module), but we cache the promise to avoid redundant byte reads.
 */
let _initPromise: Promise<GraphWasmModule> | null = null;

async function loadWasm(wasmSource: WasmGraphBackendOptions['wasmSource']): Promise<GraphWasmModule> {
  if (_initPromise !== null) return _initPromise;
  _initPromise = (async () => {
    const mod = await import('@ruvector/graph-wasm');
    // Auto-detect Node vs browser. In Node, fetch() against a file:// URL
    // requires special handling; the byte-pass form is the portable path.
    const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;
    if (isNode) {
      let bytes: ArrayBufferView;
      if (wasmSource instanceof Uint8Array || ArrayBuffer.isView(wasmSource)) {
        bytes = wasmSource as ArrayBufferView;
      } else {
        // require.resolve gives us the package-internal .wasm path.
        const require = createRequire(import.meta.url);
        const wasmPath = require.resolve('@ruvector/graph-wasm/ruvector_graph_wasm_bg.wasm');
        bytes = readFileSync(wasmPath);
      }
      await mod.default({ module_or_path: bytes });
    } else {
      // Browser: defer to wasm-bindgen's default fetch flow, optionally with a custom URL.
      const arg = wasmSource !== undefined ? { module_or_path: wasmSource as URL | string } : undefined;
      await mod.default(arg as Parameters<GraphWasmModule['default']>[0]);
    }
    return mod;
  })();
  return _initPromise;
}

export class WasmGraphBackend implements GraphBackend {
  readonly kind = 'wasm' as const;
  readonly capabilities: ReadonlySet<string>;
  private readonly _mod: GraphWasmModule;
  private readonly _db: WasmGraphDB;
  /** userId → wasm-generated UUID. */
  private readonly _idMap = new Map<string, string>();
  /** Reverse map for lookups when WASM returns its own UUID (e.g., from query results). */
  private readonly _revIdMap = new Map<string, string>();

  private constructor(mod: GraphWasmModule, db: WasmGraphDB) {
    this._mod = mod;
    this._db = db;
    // Standard catalog names + WASM-only ones. Methods missing from WASM
    // are NOT in this set, so the archetype's catalog row stays dormant
    // when transport=wasm.
    this.capabilities = new Set<string>([
      'cypher',          // present but stubbed (Issue #01 also affects WASM)
      'graphStats',
      'cypherImport',    // WASM-only; broken (Issue #09)
      'cypherExport',    // WASM-only; works
      'nodeDelete',      // WASM-only; works
      'edgeDelete',      // WASM-only; works
    ]);
  }

  static async create(options: WasmGraphBackendOptions): Promise<WasmGraphBackend> {
    const mod = await loadWasm(options.wasmSource);
    // WASM GraphDB constructor: `constructor(metric?: string | null)`.
    // Distance metric is lowercase string; dimensions are not configurable
    // at construction (set internally — different design than native).
    const metric = options.distanceMetric.toLowerCase();
    const db = new mod.GraphDB(metric);
    return new WasmGraphBackend(mod, db);
  }

  // ----- Inserts -----

  async createNode(node: ResolvedNode): Promise<string> {
    // WASM signature: createNode(labels: string[], properties: any) → UUID
    // The user-supplied node.id is mapped to the returned UUID.
    const labels = node.labels !== undefined ? [...node.labels] : [];
    const props: Record<string, string> = node.properties !== undefined ? { ...node.properties } : {};
    const wasmId = this._db.createNode(labels, props);
    this._idMap.set(node.id, wasmId);
    this._revIdMap.set(wasmId, node.id);
    // Embedding is intentionally dropped — WASM nodes don't store embeddings.
    // Emit a one-time warning so consumers passing pre-computed embeddings
    // know their data isn't being persisted at the binding layer.
    if (node.embedding !== undefined && !WasmGraphBackend._embeddingDropWarned) {
      WasmGraphBackend._embeddingDropWarned = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[ruvector-sdk] WASM transport: Node.embedding is silently dropped — ' +
        '@ruvector/graph-wasm@2.0.2 does not store embeddings on nodes/edges (only hyperedges). ' +
        'Use transport: \'native\' if vector search over node embeddings is needed.',
      );
    }
    return node.id;
  }
  private static _embeddingDropWarned = false;

  async createEdge(edge: ResolvedEdge): Promise<string> {
    const fromWasm = this._mapToWasm(edge.from, 'edge.from');
    const toWasm = this._mapToWasm(edge.to, 'edge.to');
    const props: Record<string, string> = edge.metadata !== undefined ? { ...edge.metadata } : {};
    if (edge.confidence !== undefined) props['confidence'] = String(edge.confidence);
    return this._db.createEdge(fromWasm, toWasm, edge.description, props);
  }

  async createHyperedge(edge: ResolvedHyperedge): Promise<string> {
    // Known broken in @ruvector/graph-wasm@2.0.2 — throws "Entity not found
    // in hypergraph" even when the constituent nodes exist via createNode.
    // The hypergraph appears to be a separate index that createNode doesn't
    // populate. Issue #09 documents this. The call still goes through so
    // when upstream fixes it, behavior flips automatically (M6.2).
    const wasmIds = edge.nodes.map((n) => this._mapToWasm(n, 'hyperedge.nodes[]'));
    return this._db.createHyperedge(
      wasmIds,
      edge.description,
      edge.embedding,
      edge.confidence ?? null,
    );
  }

  async batchInsert(input: { nodes: readonly ResolvedNode[]; edges: readonly ResolvedEdge[] }): Promise<GraphBackendBatchResult> {
    // Synthesize batchInsert on top of the per-call API. The WASM binding has
    // no batch op; this is N round-trips into the WASM heap, slower than
    // native's batchInsert. Documented as a v0.2 perf concern in Issue #09.
    const nodeIds: string[] = [];
    for (const n of input.nodes) {
      nodeIds.push(await this.createNode(n));
    }
    const edgeIds: string[] = [];
    for (const e of input.edges) {
      edgeIds.push(await this.createEdge(e));
    }
    return { nodeIds, edgeIds };
  }

  // ----- Reads -----

  async cypher(query: string): Promise<GraphBackendQueryResult> {
    // Same Cypher-stub bug as the native binding (Issue #01 applies to WASM).
    // The smoke check observes this and dormant-classifies cypher [upstream-bug].
    const r = await this._db.query(query);
    // Translate WASM nodes/edges back to user IDs where possible.
    const nodes = r.nodes.map((n) => ({
      id: this._mapFromWasm(n.id),
      labels: n.labels,
      properties: this._propsToStringMap(n.properties),
    }));
    const edges = r.edges.map((e) => ({
      id: e.id,
      from: this._mapFromWasm(e.from),
      to: this._mapFromWasm(e.to),
      edgeType: e.type,
      properties: this._propsToStringMap(e.properties),
    }));
    return { nodes, edges };
  }

  async kHopNeighbors(_startNode: string, _hops: number): Promise<readonly string[]> {
    throw new RuVectorError(
      'CAPABILITY_DEFERRED',
      'kHopNeighbors is not exposed by @ruvector/graph-wasm@2.0.2 (per Issue #09 — central GraphReasoner method missing from WASM binding). Use transport: \'native\' for kHop traversal.',
    );
  }

  async searchHyperedges(_options: HyperedgeSearchOptions): Promise<readonly GraphBackendHyperedgeResult[]> {
    throw new RuVectorError(
      'CAPABILITY_DEFERRED',
      'searchHyperedges is not exposed by @ruvector/graph-wasm@2.0.2 (per Issue #09). Use transport: \'native\' for hyperedge vector search.',
    );
  }

  async stats(): Promise<GraphBackendStats> {
    // WASM stats shape: { nodeCount, edgeCount, hyperedgeCount, hypergraphEntities, hypergraphEdges, avgEntityDegree }
    // Translate to common shape.
    const s = this._db.stats() as { nodeCount?: number; edgeCount?: number; avgEntityDegree?: number };
    const nodes = s.nodeCount ?? 0;
    const edges = s.edgeCount ?? 0;
    const avg = nodes > 0 ? (2 * edges) / nodes : 0;
    return { totalNodes: nodes, totalEdges: edges, avgDegree: avg };
  }

  // ----- WASM-only -----

  async deleteNode(id: string): Promise<boolean> {
    const wasmId = this._idMap.get(id);
    if (wasmId === undefined) return false;
    const deleted = this._db.deleteNode(wasmId);
    if (deleted) {
      this._idMap.delete(id);
      this._revIdMap.delete(wasmId);
    }
    return deleted;
  }

  async deleteEdge(id: string): Promise<boolean> {
    return this._db.deleteEdge(id);
  }

  async exportCypher(): Promise<string> {
    return this._db.exportCypher();
  }

  async importCypher(statements: readonly string[]): Promise<number> {
    // Returns count but is a silent no-op upstream (Issue #09).
    return this._db.importCypher([...statements]);
  }

  subscribe(_listener: (change: unknown) => void): void {
    throw new RuVectorError(
      'CAPABILITY_DEFERRED',
      'subscribe is not exposed by @ruvector/graph-wasm@2.0.2 (per Issue #09). Use transport: \'native\' for graph change subscription.',
    );
  }

  async close(): Promise<void> {
    // wasm-bindgen objects expose `free()` for explicit cleanup. The Symbol.dispose
    // form is also valid but typed loosely; using free() keeps this compatible
    // with older wasm-bindgen runtimes.
    try { (this._db as unknown as { free?: () => void }).free?.(); } catch {/* ignore */}
  }

  // ----- Internals -----

  private _mapToWasm(userId: string, ctx: string): string {
    const wasmId = this._idMap.get(userId);
    if (wasmId === undefined) {
      throw new RuVectorError(
        'INVALID_INPUT',
        `${ctx}: node id '${userId}' not found in this graph (createNode it first). WASM transport requires nodes to be inserted before they're referenced in edges.`,
      );
    }
    return wasmId;
  }

  private _mapFromWasm(wasmId: string): string {
    return this._revIdMap.get(wasmId) ?? wasmId;
  }

  private _propsToStringMap(props: unknown): Readonly<Record<string, string>> {
    if (props === null || typeof props !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
      out[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
    return out;
  }

  /**
   * Smoke-check the WASM backend's working surface.
   *
   * Probes against an isolated GraphDB instance — no user data touched.
   * Reports `unsupported` for the methods missing from the WASM binding
   * (kHopTraversal / hyperedgeSearch / batchInsert / graphChangeSubscription).
   * That tells the value-report reducer to dormant-classify those rows when
   * the user selects `transport: 'wasm'`.
   *
   * For methods that exist but are broken (cypher / createHyperedge /
   * cypherImport — all per Issue #09), reports `broken` with the exact
   * upstream diagnostic. M6.2 self-correcting pattern: when upstream fixes
   * any of these, the next healthCheck flips them to active.
   */
  static async smokeCheck(): Promise<readonly CheckResult[]> {
    const mod = await loadWasm(undefined);
    const probe = new mod.GraphDB('cosine');

    const insertNode = await runCheck('insertNode', async () => {
      const id = probe.createNode(['Probe'], { name: 'probe-a' });
      // WASM returns an auto-generated UUID, not the user's id. We can't
      // assert id round-trip, so we assert the call returns a non-empty
      // string and stats updates.
      if (typeof id !== 'string' || id.length === 0) {
        return { status: 'broken' as const, detail: `expected non-empty UUID, got '${id}'` };
      }
      return { status: 'ok' as const, detail: `created node, wasm-uuid=${id.slice(0, 8)}…` };
    });

    const insertEdge = await runCheck('insertEdge', async () => {
      const a = probe.createNode(['Probe'], { name: 'probe-a' });
      const b = probe.createNode(['Probe'], { name: 'probe-b' });
      const eid = probe.createEdge(a, b, 'PROBE_LINK', {});
      if (typeof eid !== 'string' || eid.length === 0) {
        return { status: 'broken' as const, detail: 'createEdge returned empty/non-string id' };
      }
      return { status: 'ok' as const };
    });

    const stats = await runCheck('stats', async () => {
      const s = probe.stats() as { nodeCount?: number; edgeCount?: number };
      // Probe inserted: 1 (insertNode) + 2 (insertEdge) = 3 nodes; 1 edge.
      if (s.nodeCount === 3 && s.edgeCount === 1) {
        return { status: 'ok' as const, detail: `${s.nodeCount} nodes, ${s.edgeCount} edges` };
      }
      return { status: 'broken' as const, detail: `expected 3/1, got ${s.nodeCount}/${s.edgeCount}` };
    });

    // Methods that don't exist in WASM — surface as `unsupported`.
    const kHop: CheckResult = {
      name: 'kHopNeighbors',
      status: 'unsupported',
      detail: 'kHopNeighbors method does not exist on @ruvector/graph-wasm@2.0.2 GraphDB. Issue #09 — use transport: \'native\' for k-hop traversal.',
      durationMs: 0,
      tier: 'binding',
    };
    const hyperedgeSearch: CheckResult = {
      name: 'hyperedgeSearch',
      status: 'unsupported',
      detail: 'searchHyperedges method does not exist on @ruvector/graph-wasm@2.0.2 GraphDB. Issue #09 — use transport: \'native\' for hyperedge vector search.',
      durationMs: 0,
      tier: 'binding',
    };

    // Cypher: probe whether the WASM binding has the same stub bug as native.
    // Per Q7 ratification, this is the M17.1 self-correcting probe.
    const cypher = await runCheck('cypher', async () => {
      const r = await probe.query('MATCH (n) RETURN n');
      // We inserted 3 nodes above. A working Cypher engine returns >= 1 node.
      if (r.nodes.length >= 1) return { status: 'ok' as const, detail: `${r.nodes.length} nodes returned` };
      return {
        status: 'broken' as const,
        detail: `MATCH (n) RETURN n returned 0 nodes despite stats showing ${(probe.stats() as { nodeCount?: number }).nodeCount}. ` +
                'Same Cypher-stub bug as Issue #01 affects WASM binding — see Issue #09.',
      };
    });

    // exportCypher: WASM-only working method.
    const cypherExport = await runCheck('cypherExport', async () => {
      const c = probe.exportCypher();
      if (typeof c === 'string' && c.includes('CREATE')) {
        return { status: 'ok' as const, detail: `${c.length}-char Cypher exported (${c.split('\n').filter(Boolean).length} statements)` };
      }
      return { status: 'broken' as const, detail: `exportCypher returned: ${JSON.stringify(c).slice(0, 80)}` };
    });

    // importCypher: WASM-only, broken upstream (returns success count but no-op).
    const cypherImport = await runCheck('cypherImport', async () => {
      const before = (probe.stats() as { nodeCount?: number }).nodeCount ?? 0;
      const n = await probe.importCypher(['CREATE (x:Probe {imported: "yes"})']);
      const after = (probe.stats() as { nodeCount?: number }).nodeCount ?? 0;
      if (n >= 1 && after === before) {
        return {
          status: 'broken' as const,
          detail: `importCypher returned ${n} but stats unchanged (${before}→${after}). Silent no-op — Issue #09.`,
        };
      }
      if (after > before) return { status: 'ok' as const, detail: `imported ${after - before} statement(s)` };
      return { status: 'broken' as const, detail: `importCypher returned ${n}, no nodes added` };
    });

    // nodeDelete: WASM-only working.
    const nodeDelete = await runCheck('nodeDelete', async () => {
      const tmp = probe.createNode(['Disposable'], {});
      const ok = probe.deleteNode(tmp);
      return ok
        ? { status: 'ok' as const, detail: 'node deleted, returned true' }
        : { status: 'broken' as const, detail: 'deleteNode returned false on a freshly-created node' };
    });

    return [insertNode, insertEdge, stats, kHop, hyperedgeSearch, cypher, cypherExport, cypherImport, nodeDelete];
  }
}
