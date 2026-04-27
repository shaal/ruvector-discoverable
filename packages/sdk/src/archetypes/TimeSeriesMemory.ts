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
import type { ValueReport, ValueReportProvider } from '../core/value-report.js';
import type { CheckResult, HealthCheckProvider, HealthCheckResult } from '../core/health.js';
import type { CapabilityCatalogEntry } from '../core/capability-catalog.js';
import { NotImplementedError, RuVectorError, reduceIntrospect, reduceValueReport, runCheck, summarize } from '../core/index.js';
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
// Reducer logic lives in core/capability-catalog.ts (extracted in M8.2).
// This file holds only the data.

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
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: '@ruvector/attention-node is not published on npm. Mamba SSM lives in upstream Rust but is not bound to NAPI in any v0.1-reachable version.',
    defaultDormantLift: 'Linear-time sequential modelling for long histories; better than vector-only similarity for recurring patterns.',
    defaultDormantEnable: 'Track @ruvector/attention-node publishing, or build the binding from source.',
  },
  {
    name: 'temporalCompression',
    source: 'ruvector-temporal-tensor',
    adrs: ['ADR-017'],
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'No published NAPI binding for ruvector-temporal-tensor. Bucketed compression must happen client-side until v0.2.',
    defaultDormantLift: '2-32x memory reduction with adaptive tier compression on long histories.',
    defaultDormantEnable: 'Track upstream publishing.',
  },
  {
    name: 'deltaIndexing',
    source: 'ruvector-delta-core',
    adrs: ['ADR-016'],
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'No published NAPI binding for the ruvector-delta-* family. Window queries in v0.1 use post-search filtering — narrow windows degrade recall.',
    defaultDormantLift: 'Native windowed indexing eliminates the post-filter recall loss.',
    defaultDormantEnable: 'Track upstream delta-* NAPI publishing.',
  },
  {
    name: 'causalLayers',
    source: 'ruvector-graph-transformer',
    adrs: ['ADR-046'],
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'Causal-graph temporal layers live in ruvector-graph-transformer but are not exposed in @ruvector/graph-node@2.0.3.',
    defaultDormantLift: 'Granger causality extraction; ODE-integrated continuous-time recall.',
    defaultDormantEnable: 'Track upstream NAPI exposure.',
  },
  {
    name: 'changepointDetection',
    source: 'ruvector-attention',
    defaultStatus: 'dormant',
    // sdk-integration: a trivial baseline (sliding-window L2 distance, CUSUM)
    // could ship in pure SDK code without any upstream change. Deliberate
    // v0.1 deferral; see m6-scope.md.
    defaultDormantBlocker: 'sdk-integration',
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
    const bindingChecks = await NativeCoreBackend.smokeCheck({
      dimensions: this._options.dimensions,
      ...(this._options.bindingPath !== undefined && { bindingPath: this._options.bindingPath }),
    });
    const archetypeChecks = await TimeSeriesMemory._archetypeProbe({
      dimensions: this._options.dimensions,
      distanceMetric: this._options.distanceMetric ?? 'Cosine',
      ...(this._options.bindingPath !== undefined && { bindingPath: this._options.bindingPath }),
    });
    this._lastHealth = summarize('TimeSeriesMemory', 'native', [...bindingChecks, ...archetypeChecks]);
    return this._lastHealth;
  }

  /**
   * Tier-3 (archetype-level) probe — exercises the SDK's own logic, not
   * just the binding. Specifically: insert known points with year-2100
   * timestamps, query with a window covering them, assert the result's
   * timestampMs roundtrips correctly. **This is the regression test for
   * the M8 `ms | 0` int32-truncation bug**: if the bug were back,
   * top.timestampMs would parse as 0 (not the year-2100 value) and the
   * assertion would fail.
   *
   * Uses a unique probe streamId per call so probe data doesn't collide
   * with user data. Cleans up via `NativeCoreBackend.deleteId` at end —
   * best-effort, leaks documented as a known cost of Finding B.
   */
  private static async _archetypeProbe(opts: {
    dimensions: number;
    distanceMetric: 'Euclidean' | 'Cosine' | 'DotProduct' | 'Manhattan';
    bindingPath?: string;
  }): Promise<readonly CheckResult[]> {
    let probe: TimeSeriesMemory | null = null;
    let probeIds: string[] = [];
    const probeStream = `__ruvsdk_probe_tsm_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const T0 = Date.parse('2100-01-01T00:00:00Z'); // far-future, outside any plausible user data
    const dims = opts.dimensions;
    const oneHot = (i: number): Float32Array => {
      const v = new Float32Array(dims);
      v[i % dims] = 1;
      return v;
    };

    const result = await runCheck('append+query+windowFilter', async () => {
      probe = await TimeSeriesMemory.create({
        streamId: probeStream,
        dimensions: opts.dimensions,
        distanceMetric: opts.distanceMetric,
        ...(opts.bindingPath !== undefined && { bindingPath: opts.bindingPath }),
      });
      // Three points across 2 minutes in 2100. Distinct embeddings.
      await probe.append({ timestampMs: T0,           value: oneHot(0) });
      await probe.append({ timestampMs: T0 + 60_000,  value: oneHot(1) });
      await probe.append({ timestampMs: T0 + 120_000, value: oneHot(2) });
      probeIds = [
        `ts:${probeStream}:${String(T0          ).padStart(15, '0')}:0`,
        `ts:${probeStream}:${String(T0 + 60_000 ).padStart(15, '0')}:1`,
        `ts:${probeStream}:${String(T0 + 120_000).padStart(15, '0')}:2`,
      ];

      // Query with a window covering all three. Top must match oneHot(0).
      const r = await probe.query(oneHot(0), {
        window: { fromMs: T0 - 1, toMs: T0 + 200_000 },
        k: 16,
      });
      if (r.points.length === 0) {
        return { status: 'broken' as const, detail: '0 points returned despite 3 in-window inserts (M8 ms|0 regression suspected)' };
      }
      const top = r.points[0];
      if (!top) return { status: 'broken' as const, detail: 'top result is undefined' };
      if (top.timestampMs !== T0) {
        return {
          status: 'broken' as const,
          detail: `expected top.timestampMs=${T0} (year 2100), got ${top.timestampMs} — likely an ID encoding bug in the SDK layer`,
        };
      }
      return {
        status: 'ok' as const,
        detail: `${r.points.length} points in-window; top.timestampMs roundtrips correctly`,
      };
    }, 'archetype');

    // Cleanup — best-effort. Probe data leaks into shared backend per Finding B,
    // but unique probeStream means it never appears in user queries.
    if (probe !== null) {
      const backend = (probe as TimeSeriesMemory)._backend;
      for (const id of probeIds) {
        try { await backend.deleteId(id); } catch {/* ignore */}
      }
      await (probe as TimeSeriesMemory).close();
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
    return reduceIntrospect('TimeSeriesMemory', {
      catalog: CAPABILITY_CATALOG,
      lastHealth: this._lastHealth,
    });
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
