/**
 * Sequential, streaming, windowed retrieval.
 *
 * Default-active capabilities (per M4):
 *   - Mamba SSM attention                           — ruvector-attention
 *   - Temporal tensor compression                   — ruvector-temporal-tensor
 *   - Delta indexing for incremental updates        — ruvector-delta-* family
 *   - Causal layers                                 — ruvector-attention (graph-transformer temporal)
 */

import type { BackendSpec } from '../core/backend.js';
import type { ExplainTrace } from '../core/explain.js';
import type { Pipeline } from '../core/pipeline.js';
import type { ValueReport, ValueReportProvider } from '../core/value-report.js';
import { NotImplementedError } from '../core/index.js';

export interface TimeSeriesMemoryOptions {
  /** Stable name for this stream (multi-tenant separation). */
  readonly streamId: string;
  readonly backend?: BackendSpec;
  readonly storage?: string;
  /** Granularity of temporal compression buckets. */
  readonly bucketMs?: number;
  readonly capabilities?: TimeSeriesCapabilityConfig;
}

export interface TimeSeriesCapabilityConfig {
  /** Default: true. */
  readonly mambaAttention?: boolean;
  /** Default: true. */
  readonly temporalCompression?: boolean;
  /** Default: true. */
  readonly deltaIndexing?: boolean;
  /** Default: false. Causal-graph layers; opt in for time-aware retrieval. */
  readonly causalLayers?: boolean;
}

export interface TimeSeriesPoint {
  readonly timestampMs: number;
  /** Either a vector or a payload that the configured embedder can convert. */
  readonly value: Float32Array | readonly number[] | string | Readonly<Record<string, unknown>>;
  readonly tags?: readonly string[];
}

export interface QueryWindow {
  readonly fromMs: number;
  readonly toMs: number;
}

export interface TemporalQueryOptions {
  readonly window?: QueryWindow;
  readonly k?: number;
  readonly tags?: readonly string[];
  /** Default: false. If true, returns the changepoints in the window instead of nearest neighbours. */
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
  readonly value: Float32Array | string | Readonly<Record<string, unknown>>;
}

export interface Changepoint {
  readonly timestampMs: number;
  readonly confidence: number;
  readonly note?: string;
}

export class TimeSeriesMemory implements ValueReportProvider {
  static async create(_options: TimeSeriesMemoryOptions): Promise<TimeSeriesMemory> {
    throw new NotImplementedError('TimeSeriesMemory.create');
  }

  append(_point: TimeSeriesPoint): Promise<void> {
    throw new NotImplementedError('TimeSeriesMemory.append');
  }

  appendBatch(_points: readonly TimeSeriesPoint[]): Promise<{ written: number }> {
    throw new NotImplementedError('TimeSeriesMemory.appendBatch');
  }

  /** Query for similar points in a window. */
  query(_query: TimeSeriesPoint['value'], _options?: TemporalQueryOptions): Promise<TemporalResult> {
    throw new NotImplementedError('TimeSeriesMemory.query');
  }

  /** Detect changepoints in the recent window without a similarity query. */
  detectChangepoints(_options?: { window?: QueryWindow }): Promise<readonly Changepoint[]> {
    throw new NotImplementedError('TimeSeriesMemory.detectChangepoints');
  }

  getValueReport(): Promise<ValueReport> {
    throw new NotImplementedError('TimeSeriesMemory.getValueReport');
  }

  introspect(): Pipeline {
    throw new NotImplementedError('TimeSeriesMemory.introspect');
  }

  close(): Promise<void> {
    throw new NotImplementedError('TimeSeriesMemory.close');
  }
}
