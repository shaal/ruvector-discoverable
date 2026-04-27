/**
 * Sequential, streaming, windowed retrieval.
 *
 * **M8 v0.1 — third archetype with a real backend.** Wires to upstream
 * `@ruvector/core` (same binding as KnowledgeBase). Validates that the
 * catalog/probe pattern from M6.2/M7 ports to a third archetype with a
 * meaningfully different workload (timestamp-keyed sequential vectors).
 *
 * Active capabilities in v0.1 (probed via NativeCoreBackend.smokeCheck):
 *   - vectorInsert / vectorSearch                 — ruvector-core
 *   - health / metrics                            — ruvector-core
 *
 * Dormant in v0.1 (declared, no probe — bindings don't exist):
 *   - Mamba SSM attention                          — ruvector-attention (no published NAPI)
 *   - Delta indexing for incremental updates       — ruvector-delta-* (no published NAPI)
 *   - Temporal tensor compression                  — ruvector-temporal-tensor (no published NAPI)
 *   - Causal-graph layers                          — ruvector-graph-transformer temporal modules
 *   - Changepoint detection                        — would need streaming primitives + Mamba
 *
 * **Schema design.** Each point is stored as a vector in the shared
 * `@ruvector/core` VectorDb. The ID encodes both the streamId and the
 * timestamp so multiple streams can coexist and so window queries can
 * filter post-search by parsing the ID. v0.2 with proper metadata support
 * will replace this with a cleaner schema.
 *
 *   id format: `ts:<streamId>:<paddedMs>:<seq>`
 *
 * Window queries fetch a top-k neighbour set and then filter to the
 * requested window. Narrow windows therefore degrade recall — documented
 * loudly as a v0.1 limitation. v0.2 with delta indexing fixes this.
 */

import type { ExplainTrace } from '../core/explain.js';
import type { Pipeline } from '../core/pipeline.js';
import type { ActiveCapability, DormantCapability, ValueReport, ValueReportProvider } from '../core/value-report.js';
import type { HealthCheckProvider, HealthCheckResult } from '../core/health.js';
import { NotImplementedError, RuVectorError, summarize } from '../core/index.js';
import { NativeCoreBackend } from '../backends/native-core.js';

// ---------------- Public types ----------------

export interface TimeSeriesMemoryOptions {
  /** Stable name for this stream — multi-tenant separation. */
  readonly streamId: string;
  /** Vector dimensions for point embeddings. Required. */
  readonly dimensions: number;
  /** Distance metric. Default: 'Cosine'. */
  readonly distanceMetric?: 'Euclidean' | 'Cosine' | 'DotProduct' | 'Manhattan';
  /** Storage path. Default: in-memory (subject to upstream Finding C — see m6-scope.md). */
  readonly storage?: string;
  /**
   * Path to upstream @ruvector/core binary. Falls back to RUVECTOR_CORE_BINDING.
   * Required because @ruvector/core is not yet published on npm.
   */
  readonly bindingPath?: string;
  /** Granularity hint for temporal compression. Currently advisory only. */
  readonly bucketMs?: number;
  readonly capabilities?: TimeSeriesCapabilityConfig;
}

export interface TimeSeriesCapabilityConfig {
  /** Default: false in v0.1 — no NAPI binding. Toggle has no effect. */
  readonly mambaAttention?: boolean;
  /** Default: false in v0.1 — no NAPI binding. */
  readonly temporalCompression?: boolean;
  /** Default: false in v0.1 — no NAPI binding. */
  readonly deltaIndexing?: boolean;
  /** Default: false in v0.1 — no NAPI binding. */
  readonly causalLayers?: boolean;
}

export interface TimeSeriesPoint {
  readonly timestampMs: number;
  /**
   * v0.1 requires a `Float32Array` value — no embedder is wired. M5's wider
   * union (`string | number[] | Record`) is preserved at the type layer for
   * forward compatibility but throws at runtime.
   */
  readonly value: Float32Array | readonly number[] | string | Readonly<Record<string, unknown>>;
  readonly tags?: readonly string[];
}

export interface QueryWindow {
  readonly fromMs: number;
  readonly toMs: number;
}

export interface TemporalQueryOptions {
  readonly window?: QueryWindow;
  /** Top-k candidates fetched BEFORE window filter. Default: 32. */
  readonly k?: number;
  readonly tags?: readonly string[];
  /** When true, returns only changepoints in the window (currently throws). */
  readonly changepoints?: boolean;
}

export interface TemporalResult {
  readonly points: readonly RecalledPoint[];
  readonly changepoints: readonly Changepoint[];
  readonly explain: ExplainTrace;
}

export interface RecalledPoint {
  readonly timestampMs: number;
  readonly score: number;
  readonly id: string;
}

export interface Changepoint {
  readonly timestampMs: number;
  readonly confidence: number;
  readonly note?: string;
}

// ---------------- Capability catalog ----------------
// Same shape as M6.2 GraphReasoner / M7 KnowledgeBase. Third copy in
// v0.1 — confirms the duplication is sustainable for at least one more
// archetype before extraction. v0.2 should pull a `core/catalog.ts`.

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
    name: 'vectorInsert',
    source: 'ruvector-core',
    adrs: ['ADR-001'],
    probeName: 'vectorInsert',
    defaultStatus: 'active',
    invocationKey: 'append',
  },
  {
    name: 'vectorSearch',
    source: 'ruvector-core',
    adrs: ['ADR-001'],
    probeName: 'vectorSearch',
    defaultStatus: 'active',
    invocationKey: 'query',
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
  {
    name: 'mambaAttention',
    source: 'ruvector-attention',
    adrs: ['ADR-015'],
    defaultStatus: 'dormant',
    defaultDormantReason: '@ruvector/attention-node is not published on npm. Mamba SSM lives in upstream Rust but is not bound to NAPI in any v0.1-reachable version.',
    defaultDormantLift: 'Linear-time sequential modelling for long histories; better than vector-only similarity for recurring patterns.',
    defaultDormantEnable: 'Track @ruvector/attention-node publishing, or build the binding from source.',
  },
  {
    name: 'temporalCompression',
    source: 'ruvector-temporal-tensor',
    adrs: ['ADR-017'],
    defaultStatus: 'dormant',
    defaultDormantReason: 'No published NAPI binding for ruvector-temporal-tensor. Bucketed compression must happen client-side until v0.2.',
    defaultDormantLift: '2-32x memory reduction with adaptive tier compression on long histories.',
    defaultDormantEnable: 'Track upstream publishing.',
  },
  {
    name: 'deltaIndexing',
    source: 'ruvector-delta-core',
    adrs: ['ADR-016'],
    defaultStatus: 'dormant',
    defaultDormantReason: 'No published NAPI binding for the ruvector-delta-* family. Window queries in v0.1 use post-search filtering — narrow windows degrade recall.',
    defaultDormantLift: 'Native windowed indexing eliminates the post-filter recall loss.',
    defaultDormantEnable: 'Track upstream delta-* NAPI publishing.',
  },
  {
    name: 'causalLayers',
    source: 'ruvector-graph-transformer',
    adrs: ['ADR-046'],
    defaultStatus: 'dormant',
    defaultDormantReason: 'Causal-graph temporal layers live in ruvector-graph-transformer but are not exposed in @ruvector/graph-node@2.0.3.',
    defaultDormantLift: 'Granger causality extraction; ODE-integrated continuous-time recall.',
    defaultDormantEnable: 'Track upstream NAPI exposure.',
  },
  {
    name: 'changepointDetection',
    source: 'ruvector-attention',
    defaultStatus: 'dormant',
    defaultDormantReason: 'detectChangepoints() throws in v0.1 — no streaming primitives in @ruvector/core; Mamba SSM (the natural backend) is not bound. v0.2 may add a trivial baseline.',
    defaultDormantLift: 'Real-time anomaly detection without a fitted model.',
    defaultDormantEnable: 'Wait for v0.2 baseline OR Mamba binding publication.',
  },
];

// ---------------- ID schema ----------------
// `ts:<streamId>:<paddedMs>:<seq>` — padding keeps lexical order = temporal order.
// 15-digit padding covers ms timestamps up to year ~33,658.
//
// **Implementation note.** Use `Math.trunc(ms)` rather than `ms | 0` for
// integer coercion — bitwise operators silently coerce to *signed 32-bit*,
// which overflows for any millisecond timestamp after 2003-09-09.
// M8 v0.1 surfaced this on first-run: every demo sample got encoded with
// timestamp portion `000000000000000` and window filtering dropped them all.
// Caught by adding a debug print to compare repro-without-window (worked) and
// demo-with-window (failed).
const TS_PAD = 15;
function padTs(ms: number): string {
  return String(Math.max(0, Math.trunc(ms))).padStart(TS_PAD, '0');
}
function buildId(streamId: string, ms: number, seq: number): string {
  return `ts:${streamId}:${padTs(ms)}:${seq}`;
}
const ID_RE = /^ts:([^:]+):(\d{15}):(\d+)$/;
function parseId(id: string): { streamId: string; timestampMs: number; seq: number } | null {
  const m = ID_RE.exec(id);
  if (!m) return null;
  return {
    streamId: m[1] ?? '',
    timestampMs: Number.parseInt(m[2] ?? '0', 10),
    seq: Number.parseInt(m[3] ?? '0', 10),
  };
}

// ---------------- Implementation ----------------

export class TimeSeriesMemory implements ValueReportProvider, HealthCheckProvider {
  private readonly _backend: NativeCoreBackend;
  private readonly _options: TimeSeriesMemoryOptions;
  private _invocationCounts = new Map<string, number>();
  private _closed = false;
  private _lastHealth: HealthCheckResult | null = null;
  private _seq = 0;

  private constructor(backend: NativeCoreBackend, options: TimeSeriesMemoryOptions) {
    this._backend = backend;
    this._options = options;
  }

  static async create(options: TimeSeriesMemoryOptions): Promise<TimeSeriesMemory> {
    const backend = await NativeCoreBackend.create({
      dimensions: options.dimensions,
      distanceMetric: options.distanceMetric ?? 'Cosine',
      ...(options.storage !== undefined && { storage: options.storage }),
      ...(options.bindingPath !== undefined && { bindingPath: options.bindingPath }),
    });
    return new TimeSeriesMemory(backend, options);
  }

  async append(point: TimeSeriesPoint): Promise<void> {
    this.assertOpen();
    const vector = this.coerceValue(point.value);
    const id = buildId(this._options.streamId, point.timestampMs, this._seq++);
    await this._backend.insert(id, vector);
    this.bump('append');
  }

  async appendBatch(points: readonly TimeSeriesPoint[]): Promise<{ written: number }> {
    this.assertOpen();
    if (points.length === 0) return { written: 0 };
    const entries = points.map((p) => ({
      id: buildId(this._options.streamId, p.timestampMs, this._seq++),
      vector: this.coerceValue(p.value),
    }));
    await this._backend.insertBatch(entries);
    // Bump `append` (not `appendBatch`) so the catalog's invocationKey aggregates
    // both single + batch writes under one capability counter.
    this.bump('append');
    return { written: points.length };
  }

  /**
   * Query for similar points, optionally restricted to a time window.
   * v0.1 limitation: window filtering is post-search. The backend returns the
   * top-k nearest neighbours; the SDK then drops anything outside the window.
   * Narrow windows therefore degrade recall — surfaced via the `deltaIndexing`
   * dormant entry. Use a generous `k` to compensate.
   */
  async query(value: TimeSeriesPoint['value'], options: TemporalQueryOptions = {}): Promise<TemporalResult> {
    this.assertOpen();
    if (options.changepoints === true) {
      throw new NotImplementedError(
        'TimeSeriesMemory.query({ changepoints: true }) — changepoint detection is deferred ' +
        'until either ruvector-attention-node ships or v0.2 adds a trivial baseline. ' +
        'Use detectChangepoints() to discover the same deferral with the same message.'
      );
    }
    const start = performance.now();
    const vector = this.coerceValue(value);
    const k = options.k ?? 32;
    const hits = await this._backend.search(vector, k);

    // Post-filter: scope to this stream and (optionally) the requested window.
    const scoped: RecalledPoint[] = [];
    for (const h of hits) {
      const parsed = parseId(h.id);
      if (!parsed || parsed.streamId !== this._options.streamId) continue;
      if (options.window) {
        if (parsed.timestampMs < options.window.fromMs) continue;
        if (parsed.timestampMs > options.window.toMs) continue;
      }
      scoped.push({ timestampMs: parsed.timestampMs, score: h.score, id: h.id });
    }
    const total = performance.now() - start;
    this.bump('query');

    return {
      points: scoped,
      changepoints: [], // never populated in v0.1
      explain: {
        path: ['vectorSearch', 'streamFilter', 'windowFilter'],
        stages: [
          { name: 'vectorSearch', source: 'ruvector-core', durationMs: total, note: `k=${k}, ${hits.length} raw hits` },
          { name: 'streamFilter', source: '@ruvector/sdk', durationMs: 0, note: `kept ${scoped.length} matching streamId='${this._options.streamId}'` },
          ...(options.window ? [{ name: 'windowFilter', source: '@ruvector/sdk', durationMs: 0, note: `window=[${options.window.fromMs}..${options.window.toMs}]` }] : []),
        ],
        capabilities: [{ name: 'vectorSearch', source: 'ruvector-core', estimatedLift: null }],
        totalLatencyMs: total,
      },
    };
  }

  /** Detect changepoints. v0.1 throws — no streaming primitive in @ruvector/core. */
  detectChangepoints(_options?: { window?: QueryWindow }): Promise<readonly Changepoint[]> {
    throw new NotImplementedError(
      'TimeSeriesMemory.detectChangepoints — deferred to v0.2 (or until ruvector-attention-node ' +
      'publishes Mamba SSM bindings). v0.1 cannot detect changepoints without a streaming model. ' +
      'Workaround: query() over windows and inspect score deltas client-side.'
    );
  }

  async len(): Promise<number> {
    return this._backend.len();
  }

  async healthCheck(): Promise<HealthCheckResult> {
    this.assertOpen();
    const checks = await NativeCoreBackend.smokeCheck({
      dimensions: this._options.dimensions,
      ...(this._options.bindingPath !== undefined && { bindingPath: this._options.bindingPath }),
    });
    this._lastHealth = summarize('TimeSeriesMemory', 'native', checks);
    return this._lastHealth;
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
      archetype: 'TimeSeriesMemory',
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

  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    await this._backend.close();
  }

  // ----- Internals -----

  private assertOpen(): void {
    if (this._closed) {
      throw new RuVectorError('CLOSED', 'TimeSeriesMemory is closed.');
    }
  }

  private bump(method: string): void {
    this._invocationCounts.set(method, (this._invocationCounts.get(method) ?? 0) + 1);
  }

  private coerceValue(value: TimeSeriesPoint['value']): Float32Array {
    if (value instanceof Float32Array) return value;
    if (Array.isArray(value)) {
      const f = new Float32Array(value.length);
      for (let i = 0; i < value.length; i++) f[i] = (value[i] as number) ?? 0;
      return f;
    }
    throw new NotImplementedError(
      'TimeSeriesMemory.append/query value-coercion — v0.1 only accepts Float32Array (or number[]). ' +
      'String and Record inputs require an embedder, which is deferred to v0.2.'
    );
  }
}
