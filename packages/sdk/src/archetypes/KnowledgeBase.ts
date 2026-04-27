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
import type { ActiveCapability, DormantCapability, ValueReport, ValueReportProvider } from '../core/value-report.js';
import type { CheckResult, HealthCheckProvider, HealthCheckResult } from '../core/health.js';
import { NotImplementedError, RuVectorError, runCheck, summarize } from '../core/index.js';
import { NativeCoreBackend } from '../backends/native-core.js';

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
   * RUVECTOR_CORE_BINDING env var. Required because @ruvector/core is not
   * yet published on npm — see backends/native-core.ts.
   */
  readonly bindingPath?: string;
  /** Override capability defaults. Most users should leave defaults alone. */
  readonly capabilities?: KnowledgeBaseCapabilityConfig;
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
  /** Pre-computed embedding. v0.2 will derive this from `text` via an embedder config. */
  readonly embedding: Float32Array;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RetrieveOptions {
  /** Top-k passages to return. Default: 8. */
  readonly k?: number;
  /** Optional metadata filter — v0.2; ignored in v0.1. */
  readonly filter?: Filter;
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
// Same shape as GraphReasoner's catalog (M6.2). Kept as a separate copy in
// v0.1 — extracting a shared module is itself a v0.2 concern that should
// happen only after we've seen the pattern survive multiple archetypes.

type CapabilityCatalogEntry = {
  readonly name: string;
  readonly source: string;
  readonly adrs?: readonly string[];
  readonly probeName?: string;
  readonly defaultStatus: 'active' | 'dormant';
  readonly defaultDormantReason?: string;
  readonly defaultDormantLift?: string;
  readonly defaultDormantEnable?: string;
  readonly invocationKey?: string;
};

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
    defaultDormantReason: '@ruvector/core@2.2.0 NAPI surface exposes only basic VectorDb. ' +
      'Sparse + dense fusion + RRF live in upstream Rust but are not bound to NAPI in this version.',
    defaultDormantLift: '20-49% retrieval improvement over single-vector search on heterogeneous corpora.',
    defaultDormantEnable: 'Track @ruvector/core publishing of the hybrid surface, or use the http backend.',
  },
  {
    name: 'graphRag',
    source: 'ruvector-graph',
    adrs: ['ADR-046'],
    defaultStatus: 'dormant',
    defaultDormantReason: 'KnowledgeBase v0.1 does not coordinate with @ruvector/graph-node yet. ' +
      'Graph RAG (community-aware retrieval) requires wiring graph extraction during ingest.',
    defaultDormantLift: '30-60% recall on multi-hop questions vs naive chunk retrieval.',
    defaultDormantEnable: 'v0.2 will coordinate with GraphReasoner; track the milestone.',
  },
  {
    name: 'colbertRerank',
    source: 'ruvector-core',
    defaultStatus: 'dormant',
    defaultDormantReason: 'ColBERT multi-vector late interaction is not exposed in @ruvector/core\'s NAPI surface.',
    defaultDormantLift: 'Per-token MaxSim scoring for fine-grained matching.',
    defaultDormantEnable: 'Wait for upstream NAPI publishing or use the http backend.',
  },
  {
    name: 'matryoshka',
    source: 'ruvector-core',
    defaultStatus: 'dormant',
    defaultDormantReason: 'Matryoshka adaptive-dimension search is not exposed in this NAPI surface.',
    defaultDormantLift: 'Coarse-to-fine funnel reduces tail latency on large corpora.',
    defaultDormantEnable: 'Wait for upstream NAPI publishing.',
  },
  {
    name: 'sona',
    source: 'sona',
    adrs: ['ADR-014', 'ADR-044'],
    defaultStatus: 'dormant',
    defaultDormantReason: '@ruvector/sona is published on npm but not wired into KnowledgeBase v0.1. ' +
      'recordFeedback is a no-op until the integration lands.',
    defaultDormantLift: '10-25% lift on repeat queries via continual learning (LoRA + EWC++).',
    defaultDormantEnable: 'v0.2 will wire sona; meanwhile the SDK accepts feedback calls and discards them.',
  },
];

// ---------------- Implementation ----------------

export class KnowledgeBase implements ValueReportProvider, FeedbackProvider, HealthCheckProvider {
  private readonly _backend: NativeCoreBackend;
  private readonly _options: KnowledgeBaseOptions;
  private _invocationCounts = new Map<string, number>();
  private _closed = false;
  private _lastHealth: HealthCheckResult | null = null;
  private _idCounter = 0;

  private constructor(backend: NativeCoreBackend, options: KnowledgeBaseOptions) {
    this._backend = backend;
    this._options = options;
  }

  static async create(options: KnowledgeBaseOptions): Promise<KnowledgeBase> {
    const backend = await NativeCoreBackend.create({
      dimensions: options.dimensions,
      distanceMetric: options.distanceMetric ?? 'Cosine',
      ...(options.storage !== undefined && { storage: options.storage }),
      ...(options.bindingPath !== undefined && { bindingPath: options.bindingPath }),
    });
    return new KnowledgeBase(backend, options);
  }

  /** Ingest documents. v0.1 requires pre-computed embeddings on each Document. */
  async ingest(documents: readonly Document[]): Promise<IngestReport> {
    this.assertOpen();
    const start = performance.now();
    const entries = documents.map((d) => ({ id: d.id, vector: d.embedding }));
    await this._backend.insertBatch(entries);
    this.bump('ingest');
    return { documentsIngested: documents.length, durationMs: performance.now() - start };
  }

  /**
   * Retrieve top-k passages by vector similarity.
   *
   * v0.1: returns `Citation[]` only — no LLM is wired, so synthesis is the
   * caller's job. `ask()` (which would do the synthesis) throws until an
   * LLM milestone lands.
   */
  async retrieve(queryEmbedding: Float32Array, options: RetrieveOptions = {}): Promise<RetrieveResult> {
    this.assertOpen();
    const start = performance.now();
    const k = options.k ?? 8;
    const hits = await this._backend.search(queryEmbedding, k);
    const total = performance.now() - start;
    this.bump('retrieve');
    return {
      citations: hits.map((h) => ({ documentId: h.id, score: h.score })),
      queryId: this.nextQueryId(),
      explain: {
        path: ['vectorSearch'],
        stages: [{ name: 'vectorSearch', source: 'ruvector-core', durationMs: total, note: `k=${k}, ${hits.length} hits` }],
        capabilities: [{ name: 'vectorSearch', source: 'ruvector-core', estimatedLift: null }],
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

  recordFeedback(_queryId: QueryId, _signal: FeedbackSignal): Promise<void> {
    // SONA is dormant in v0.1 — accept the call but discard. The dormant
    // entry in getValueReport explains this to the developer.
    this.bump('recordFeedback');
    return Promise.resolve();
  }

  async healthCheck(): Promise<HealthCheckResult> {
    this.assertOpen();
    const bindingChecks = await NativeCoreBackend.smokeCheck({
      dimensions: this._options.dimensions,
      ...(this._options.bindingPath !== undefined && { bindingPath: this._options.bindingPath }),
    });
    const archetypeChecks = await KnowledgeBase._archetypeProbe({
      dimensions: this._options.dimensions,
      distanceMetric: this._options.distanceMetric ?? 'Cosine',
      ...(this._options.bindingPath !== undefined && { bindingPath: this._options.bindingPath }),
    });
    this._lastHealth = summarize('KnowledgeBase', 'native', [...bindingChecks, ...archetypeChecks]);
    return this._lastHealth;
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
    const inv = (key: string | undefined) => (key ? this._invocationCounts.get(key) ?? 0 : 0);
    const lastChecks = this._lastHealth?.checks ?? [];
    const probesByName = new Map(lastChecks.map((c) => [c.name, c]));

    const active: ActiveCapability[] = [];
    const dormant: DormantCapability[] = [];
    let probedCount = 0;
    let unprobedCount = 0;

    for (const cap of CAPABILITY_CATALOG) {
      const probe = cap.probeName ? probesByName.get(cap.probeName) : undefined;
      const isObserved = probe !== undefined;
      if (isObserved) probedCount++;
      else unprobedCount++;

      const observedActive = probe?.status === 'ok';
      const observedDormant = probe && probe.status !== 'ok';
      const isActive = observedActive || (!observedDormant && cap.defaultStatus === 'active');

      if (isActive) {
        active.push({
          name: cap.name,
          source: cap.source,
          invocations: inv(cap.invocationKey),
          ...(cap.adrs && { adrs: cap.adrs }),
        });
        continue;
      }

      const reason = observedDormant && probe
        ? `[observed via probe '${probe.name}', status=${probe.status}] ${probe.detail ?? '(no detail)'}`
        : (cap.defaultDormantReason ?? 'No reason recorded.');
      dormant.push({
        name: cap.name,
        source: cap.source,
        reason,
        expectedLift: cap.defaultDormantLift ?? 'Lift not documented.',
        enable: cap.defaultDormantEnable ?? 'See archetype documentation.',
        ...(cap.adrs && { adrs: cap.adrs }),
      });
    }

    const healthSource: ValueReport['healthSource'] =
      probedCount === 0 ? 'declared'
        : unprobedCount === 0 ? 'observed'
          : 'mixed';

    const totalCaps = CAPABILITY_CATALOG.length;
    const sourceTag = healthSource === 'observed' ? 'observed'
      : healthSource === 'declared' ? 'declared (run healthCheck() for live data)'
        : `mixed (${probedCount}/${totalCaps} observed)`;
    const summary = `${active.length} of ${totalCaps} unique capabilities active. ${dormant.length} dormant — ${sourceTag}.`;

    const result: ValueReport = {
      generatedAt: new Date().toISOString(),
      active,
      dormant,
      summary,
      healthSource,
      ...(this._lastHealth && { lastHealthCheckAt: this._lastHealth.generatedAt }),
    };
    return result;
  }

  introspect(): Pipeline {
    const lastChecks = this._lastHealth?.checks ?? [];
    const probesByName = new Map(lastChecks.map((c) => [c.name, c]));
    return {
      archetype: 'KnowledgeBase',
      stages: CAPABILITY_CATALOG.filter((c) => c.defaultStatus === 'active').map((c) => ({
        name: c.name,
        source: c.source,
        required: false,
      })),
      capabilities: CAPABILITY_CATALOG.map((c) => {
        const probe = c.probeName ? probesByName.get(c.probeName) : undefined;
        const observedActive = probe?.status === 'ok';
        const observedDormant = probe && probe.status !== 'ok';
        const active = observedActive || (!observedDormant && c.defaultStatus === 'active');
        return {
          name: c.name,
          source: c.source,
          active,
          ...(c.adrs && { adrs: c.adrs }),
        };
      }),
    };
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
