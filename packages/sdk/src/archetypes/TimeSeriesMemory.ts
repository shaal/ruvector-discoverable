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
import { validateEmbedderDimensions } from '../core/auto-embed.js';
import { NativeCoreBackend } from '../backends/native-core.js';
import type { LocalLLM } from './LocalLLM.js';

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
  /**
   * Maximum number of recent points retained in the SDK-side ring buffer
   * for changepoint detection. Defaults to 1000. Detection on windows
   * older than the ring buffer's earliest entry returns empty with an
   * explain note; v0.2 with delta-* bindings would do native windowed scans.
   */
  readonly maxRecentForChangepoints?: number;
  /** Sliding-window size (left + right) for changepoint detection. Default 5. */
  readonly changepointWindow?: number;
  readonly capabilities?: TimeSeriesCapabilityConfig;
  /**
   * Optional `LocalLLM` instance used to derive embeddings from string
   * `value`s on `TimeSeriesPoint`. **M11.2:** when wired, append/query
   * accept text directly; otherwise the runtime continues to throw on
   * string inputs (preserving v0.1 behaviour).
   *
   * The embedder's `embedDimensions` must match this stream's `dimensions`,
   * or `create()` throws `EMBEDDER_DIM_MISMATCH`. The user owns the
   * embedder's lifecycle; this archetype does not call `embedder.close()`.
   */
  readonly embedder?: LocalLLM;
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
    name: 'autoEmbed',
    source: '@ruvector/sdk',
    probeName: 'autoEmbed',
    invocationKey: 'autoEmbed',
    // M11.2: embed string values via wired LocalLLM. Default dormant; flips
    // active when the user passes `embedder` and the tier-3 probe passes.
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'sdk-integration',
    defaultDormantReason: 'TimeSeriesMemory was constructed without an embedder. Pass ' +
      '`embedder: <LocalLLM>` (with matching dimensions) at create-time to append/query string values directly.',
    defaultDormantLift: 'Drops the "Float32Array only" runtime restriction on point values; aligns with KB and GR.',
    defaultDormantEnable: 'await TimeSeriesMemory.create({ streamId, dimensions: 768, embedder: await LocalLLM.create() })',
  },
  {
    name: 'changepointDetection',
    source: '@ruvector/sdk',
    probeName: 'changepointDetection',
    invocationKey: 'detectChangepoints',
    // M10.1: SDK ships a sliding-window mean-shift baseline detector.
    // No upstream change required — pure SDK code over the in-memory
    // ring buffer of recent appended points. v0.2+ would add Mamba-SSM
    // (when @ruvector/attention-node ships) as a more sophisticated
    // alternative; for now the baseline detects clear discontinuities
    // reliably.
    defaultStatus: 'active',
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

interface RingPoint {
  readonly timestampMs: number;
  readonly value: Float32Array;
}

export class TimeSeriesMemory implements ValueReportProvider, HealthCheckProvider {
  private readonly _backend: NativeCoreBackend;
  private readonly _options: TimeSeriesMemoryOptions;
  private readonly _embedder: LocalLLM | null;
  private _invocationCounts = new Map<string, number>();
  private _closed = false;
  private _lastHealth: HealthCheckResult | null = null;
  private _seq = 0;
  // M10.1: ring buffer of recent points for changepoint detection.
  // Bounded; oldest are dropped on overflow. Detection on windows that
  // predate the ring's earliest entry returns empty with an explain note.
  private _recent: RingPoint[] = [];
  private readonly _maxRecent: number;
  private readonly _cpWindow: number;

  private constructor(backend: NativeCoreBackend, options: TimeSeriesMemoryOptions) {
    this._backend = backend;
    this._options = options;
    this._embedder = options.embedder ?? null;
    this._maxRecent = Math.max(2, options.maxRecentForChangepoints ?? 1000);
    this._cpWindow = Math.max(1, options.changepointWindow ?? 5);
  }

  private pushRecent(point: RingPoint): void {
    this._recent.push(point);
    if (this._recent.length > this._maxRecent) {
      // Drop oldest. Array.shift() is O(n); fine for v0.1 sizes (1000s).
      this._recent.shift();
    }
  }

  static async create(options: TimeSeriesMemoryOptions): Promise<TimeSeriesMemory> {
    validateEmbedderDimensions(options.embedder, options.dimensions, 'TimeSeriesMemory');
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
    const vector = await this.coerceValue(point.value);
    const id = buildId(this._options.streamId, point.timestampMs, this._seq++);
    await this._backend.insert(id, vector);
    this.pushRecent({ timestampMs: point.timestampMs, value: vector });
    this.bump('append');
  }

  async appendBatch(points: readonly TimeSeriesPoint[]): Promise<{ written: number }> {
    this.assertOpen();
    if (points.length === 0) return { written: 0 };
    // Sequential coerce: keeps `_seq` increment in input order and matches the
    // M11.1 finding that the published binding rejects array embed inputs
    // anyway, so per-string dispatch is the real underlying behaviour.
    const entries: { id: string; vector: Float32Array }[] = [];
    for (const p of points) {
      const vector = await this.coerceValue(p.value);
      entries.push({ id: buildId(this._options.streamId, p.timestampMs, this._seq++), vector });
    }
    await this._backend.insertBatch(entries);
    // Mirror to the ring buffer for changepoint detection.
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const e = entries[i];
      if (p && e) this.pushRecent({ timestampMs: p.timestampMs, value: e.vector });
    }
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
    const start = performance.now();
    const vector = await this.coerceValue(value);
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

    // M10.1: optionally compute changepoints over the same window.
    const { changepoints, ringBufferNote } = options.changepoints === true
      ? this.runChangepointDetection(options.window)
      : { changepoints: [] as readonly Changepoint[], ringBufferNote: null as string | null };
    if (options.changepoints === true) this.bump('detectChangepoints');

    return {
      points: scoped,
      changepoints,
      explain: {
        path: options.changepoints === true
          ? ['vectorSearch', 'streamFilter', 'windowFilter', 'changepointDetection']
          : ['vectorSearch', 'streamFilter', 'windowFilter'],
        stages: [
          { name: 'vectorSearch', source: 'ruvector-core', durationMs: total, note: `k=${k}, ${hits.length} raw hits` },
          { name: 'streamFilter', source: '@ruvector/sdk', durationMs: 0, note: `kept ${scoped.length} matching streamId='${this._options.streamId}'` },
          ...(options.window ? [{ name: 'windowFilter', source: '@ruvector/sdk', durationMs: 0, note: `window=[${options.window.fromMs}..${options.window.toMs}]` }] : []),
          ...(options.changepoints === true ? [{
            name: 'changepointDetection',
            source: '@ruvector/sdk',
            durationMs: 0,
            note: `${changepoints.length} changepoint(s) found${ringBufferNote ? `; ${ringBufferNote}` : ''}`,
          }] : []),
        ],
        capabilities: [
          { name: 'vectorSearch', source: 'ruvector-core', estimatedLift: null },
          ...(options.changepoints === true ? [{ name: 'changepointDetection', source: '@ruvector/sdk', estimatedLift: null }] : []),
        ],
        totalLatencyMs: total,
      },
    };
  }

  /**
   * Detect changepoints in the recent window via sliding-window mean-shift.
   *
   * Algorithm (M10.1 baseline):
   *   1. Filter ring-buffer to the requested window (default: entire ring).
   *   2. Sort by timestamp.
   *   3. For each interior position t (with at least `_cpWindow` points on each side):
   *      compute leftMean = mean of vectors in [t - w, t),
   *              rightMean = mean of vectors in [t, t + w].
   *      delta = ||leftMean - rightMean||.
   *   4. Threshold = max(2 × median(delta), tiny epsilon). Flag points with delta > threshold.
   *   5. Confidence = (delta - threshold) / (max - threshold), clamped to [0, 1].
   *
   * Limitations: detection is bounded by the ring buffer (default 1000 points).
   * Requests for windows older than the buffer's earliest entry return empty.
   * v0.2 with delta-* bindings would scan storage natively.
   */
  async detectChangepoints(options?: { window?: QueryWindow }): Promise<readonly Changepoint[]> {
    this.assertOpen();
    this.bump('detectChangepoints');
    return this.runChangepointDetection(options?.window).changepoints;
  }

  private runChangepointDetection(window?: QueryWindow): { changepoints: readonly Changepoint[]; ringBufferNote: string | null } {
    const w = this._cpWindow;
    let ringBufferNote: string | null = null;

    // 1. Window filter
    let pts = this._recent;
    if (window) {
      pts = pts.filter((p) => p.timestampMs >= window.fromMs && p.timestampMs <= window.toMs);
      const earliest = this._recent[0]?.timestampMs;
      if (earliest !== undefined && earliest > window.fromMs) {
        ringBufferNote = `ring buffer earliest=${earliest} > window.fromMs=${window.fromMs}; older points unavailable (M10.1 v0.1)`;
      }
    }
    if (pts.length < 2 * w + 1) {
      return { changepoints: [], ringBufferNote: ringBufferNote ?? `need ≥${2 * w + 1} points; have ${pts.length}` };
    }

    // 2. Sort by ts
    const sorted = [...pts].sort((a, b) => a.timestampMs - b.timestampMs);

    // 3. Sliding-window deltas
    const deltas: Array<{ ts: number; delta: number }> = [];
    for (let t = w; t <= sorted.length - w; t++) {
      const leftMean = vectorMean(sorted.slice(t - w, t).map((p) => p.value));
      const rightMean = vectorMean(sorted.slice(t, t + w).map((p) => p.value));
      const delta = vectorL2Distance(leftMean, rightMean);
      const point = sorted[t];
      if (point) deltas.push({ ts: point.timestampMs, delta });
    }
    if (deltas.length === 0) return { changepoints: [], ringBufferNote };

    // 4. Adaptive threshold = max(2 × median(delta), tiny epsilon)
    const sortedDeltas = [...deltas].map((d) => d.delta).sort((a, b) => a - b);
    const median = sortedDeltas[Math.floor(sortedDeltas.length / 2)] ?? 0;
    const max = sortedDeltas[sortedDeltas.length - 1] ?? 0;
    const threshold = Math.max(median * 2, 1e-6);

    // 5. Flag points exceeding threshold; assign confidence
    const range = max - threshold;
    const changepoints: Changepoint[] = [];
    for (const d of deltas) {
      if (d.delta > threshold) {
        const confidence = range > 0 ? Math.max(0, Math.min(1, (d.delta - threshold) / range)) : 0.5;
        changepoints.push({
          timestampMs: d.ts,
          confidence,
          note: `delta=${d.delta.toFixed(4)} threshold=${threshold.toFixed(4)} median=${median.toFixed(4)}`,
        });
      }
    }

    // Optional: merge changepoints within `w` time-positions of each other,
    // keeping the highest-confidence representative. Not implemented in v0.1
    // — over-reporting is honest; a real consumer can post-filter.

    return { changepoints, ringBufferNote };
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
    const cpChecks = await TimeSeriesMemory._changepointProbe({
      dimensions: this._options.dimensions,
      distanceMetric: this._options.distanceMetric ?? 'Cosine',
      ...(this._options.bindingPath !== undefined && { bindingPath: this._options.bindingPath }),
    });
    // M11.2: auto-embed probe (only runs when the user supplied an embedder).
    const autoEmbedChecks = this._embedder !== null
      ? await this._autoEmbedProbe()
      : [{
          name: 'autoEmbed',
          status: 'unsupported' as const,
          detail: 'no embedder supplied at create-time',
          durationMs: 0,
          tier: 'archetype' as const,
        }];
    this._lastHealth = summarize('TimeSeriesMemory', 'native', [...bindingChecks, ...archetypeChecks, ...cpChecks, ...autoEmbedChecks]);
    return this._lastHealth;
  }

  /**
   * Tier-3 probe for M11.2. Constructs a temp stream sharing the user's
   * embedder, appends three string-only points (two cooking, one tax-related),
   * queries with a string about baked sweets, and asserts the cooking points
   * outrank the tax point. Same polysemous-pair logic as M11.1.
   */
  private async _autoEmbedProbe(): Promise<readonly CheckResult[]> {
    if (this._embedder === null) {
      return [{ name: 'autoEmbed', status: 'unsupported' as const, detail: 'no embedder configured', durationMs: 0, tier: 'archetype' as const }];
    }
    const result = await runCheck('autoEmbed', async () => {
      const probeStream = `__ruvsdk_probe_tsm_autoEmbed_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      const probe = await TimeSeriesMemory.create({
        streamId: probeStream,
        dimensions: this._options.dimensions,
        distanceMetric: this._options.distanceMetric ?? 'Cosine',
        ...(this._options.bindingPath !== undefined && { bindingPath: this._options.bindingPath }),
        embedder: this._embedder!,
      });
      try {
        const T0 = Date.parse('2100-01-01T00:00:00Z'); // far-future, isolated from real data
        const tCookA = T0;
        const tTax = T0 + 60_000;
        const tCookB = T0 + 120_000;
        await probe.append({ timestampMs: tCookA, value: 'apple pie cinnamon dessert recipe' });
        await probe.append({ timestampMs: tTax,   value: 'corporate income tax filing requirements' });
        await probe.append({ timestampMs: tCookB, value: 'banana bread recipe sweet baked' });
        const r = await probe.query('fruit baked sweet', {
          window: { fromMs: T0 - 1, toMs: T0 + 200_000 },
          k: 16,
        });
        if (r.points.length < 2) {
          return { status: 'broken' as const, detail: `expected ≥2 in-window points; got ${r.points.length}` };
        }
        const top = r.points[0];
        if (!top) return { status: 'broken' as const, detail: 'no top point' };
        const cookingTimes = new Set([tCookA, tCookB]);
        if (!cookingTimes.has(top.timestampMs)) {
          return {
            status: 'broken' as const,
            detail: `top point ts=${top.timestampMs} matches the tax-filing point; expected a cooking point for query 'fruit baked sweet'`,
          };
        }
        return {
          status: 'ok' as const,
          detail: `string→embed→query: top point ts=${top.timestampMs} is a cooking point (vs tax point at ts=${tTax})`,
        };
      } finally {
        await probe.close();
      }
    }, 'archetype');
    return [result];
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

  /**
   * Tier-3 probe for the changepoint detector. Inserts a known step
   * function (10 baseline + 10 anomaly points), runs the detector, and
   * asserts a changepoint is found within ±1 position of the known shift.
   */
  private static async _changepointProbe(opts: {
    dimensions: number;
    distanceMetric: 'Euclidean' | 'Cosine' | 'DotProduct' | 'Manhattan';
    bindingPath?: string;
  }): Promise<readonly CheckResult[]> {
    const result = await runCheck('changepointDetection', async () => {
      const probe = await TimeSeriesMemory.create({
        streamId: `__ruvsdk_probe_cp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
        dimensions: opts.dimensions,
        distanceMetric: opts.distanceMetric,
        ...(opts.bindingPath !== undefined && { bindingPath: opts.bindingPath }),
        changepointWindow: 3,
      });
      try {
        // Build a clear step function: 10 points near oneHot(0), 10 near oneHot(1).
        // Probe data is appended to the SDK-side ring buffer regardless of
        // whether the upstream binding shares state (Finding B).
        const T0 = Date.parse('2100-01-01T00:00:00Z'); // far-future
        const oneHot = (i: number): Float32Array => {
          const v = new Float32Array(opts.dimensions);
          v[i % opts.dimensions] = 1;
          return v;
        };
        const stepAt = T0 + 10 * 1000;
        const points: TimeSeriesPoint[] = [];
        for (let i = 0; i < 10; i++) points.push({ timestampMs: T0 + i * 1000, value: oneHot(0) });
        for (let i = 0; i < 10; i++) points.push({ timestampMs: T0 + (10 + i) * 1000, value: oneHot(1) });
        await probe.appendBatch(points);

        const cps = await probe.detectChangepoints();
        if (cps.length === 0) {
          return { status: 'broken' as const, detail: 'no changepoints detected for clear step at i=10' };
        }
        // Find the changepoint closest to the known step
        const closest = cps.reduce((best, c) => Math.abs(c.timestampMs - stepAt) < Math.abs(best.timestampMs - stepAt) ? c : best);
        const offsetSec = Math.abs(closest.timestampMs - stepAt) / 1000;
        // Allow ±1 position (1 second in this construction)
        if (offsetSec > 1) {
          return { status: 'broken' as const, detail: `top changepoint off by ${offsetSec.toFixed(0)}s from known step (expected ±1s)` };
        }
        return { status: 'ok' as const, detail: `${cps.length} cp(s); closest at ±${offsetSec.toFixed(0)}s, confidence=${closest.confidence.toFixed(2)}` };
      } finally {
        await probe.close();
      }
    }, 'archetype');
    return [result];
  }

  private async coerceValue(value: TimeSeriesPoint['value']): Promise<Float32Array> {
    if (value instanceof Float32Array) return value;
    if (Array.isArray(value)) {
      const f = new Float32Array(value.length);
      for (let i = 0; i < value.length; i++) f[i] = (value[i] as number) ?? 0;
      return f;
    }
    // M11.2: string → embedder. Bumps autoEmbed invocation counter so the
    // value-report's autoEmbed row reflects real usage.
    if (typeof value === 'string') {
      if (this._embedder === null) {
        throw new NotImplementedError(
          'TimeSeriesMemory.append/query value-coercion — string inputs require an embedder. ' +
          'Pass `embedder: <LocalLLM>` (with matching dimensions) at create-time, or pass Float32Array / number[].'
        );
      }
      this.bump('autoEmbed');
      return this._embedder.embed(value);
    }
    throw new NotImplementedError(
      'TimeSeriesMemory.append/query value-coercion — v0.1 only accepts Float32Array, number[], or string ' +
      '(when an embedder is wired). Record values are deferred to v0.2.'
    );
  }
}

// ---------------- Helpers ----------------

function vectorMean(vectors: readonly Float32Array[]): Float32Array {
  if (vectors.length === 0) return new Float32Array();
  const dims = vectors[0]?.length ?? 0;
  const out = new Float32Array(dims);
  for (const v of vectors) {
    for (let i = 0; i < dims; i++) out[i]! += v[i] ?? 0;
  }
  for (let i = 0; i < dims; i++) out[i]! /= vectors.length;
  return out;
}

function vectorL2Distance(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}
