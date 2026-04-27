/**
 * Run an LLM locally on the user's hardware.
 *
 * **M11.1 Phase 1 scope** — `embed` + `similarity` only. `generate` and
 * `stream` retain their M5 type surface but throw at runtime until Phase 2
 * wires a real model file (the binding's default-loaded weights produce
 * gibberish — same Cypher-stub failure mode as M6).
 *
 * Active capabilities probed at tier-3:
 *   - embed produces deterministic, unit-normalized vectors
 *   - similarity is monotonic on strong-signal pairs (cat↔dog > cat↔banana)
 *
 * Dormant in Phase 1:
 *   - generate / stream                           — design-deferred to Phase 2
 *   - query / route                               — design-deferred (need model file)
 *   - feedback continual learning                 — design-deferred (would route to sona)
 *   - addMemory / searchMemory                    — design-deferred (overlap with AgentMemory)
 *   - TurboQuant KV-cache compression             — upstream-binding (not exposed in NAPI surface)
 *   - Tiny Dancer FastGRNN routing                — upstream-binding (no @ruvector/tiny-dancer-node)
 *   - Sparse inference (PowerInfer)               — upstream-binding (no @ruvector/sparse-inference-node)
 */

import type { ExplainTrace } from '../core/explain.js';
import type { Pipeline } from '../core/pipeline.js';
import type { ValueReport, ValueReportProvider } from '../core/value-report.js';
import type { CheckResult, HealthCheckProvider, HealthCheckResult } from '../core/health.js';
import type { CapabilityCatalogEntry } from '../core/capability-catalog.js';
import type { BackendSpec } from '../core/backend.js';
import { NotImplementedError, RuVectorError, reduceIntrospect, reduceValueReport, summarize } from '../core/index.js';
import { NativeRuvllmBackend } from '../backends/native-ruvllm.js';

// ---------------- Public types ----------------

export interface LocalLLMOptions {
  /**
   * Path or URL to the model file (e.g. `.gguf`, `.onnx`).
   *
   * **Phase 1 caveat:** v0.1 does not yet wire model loading. Supplying
   * this option has no effect; calls to `generate`/`stream` will still
   * throw with an actionable error until Phase 2 lands.
   */
  readonly model?: string;

  readonly backend?: BackendSpec;

  /** Override capability defaults. */
  readonly capabilities?: LocalLLMCapabilityConfig;

  readonly device?: 'auto' | 'cpu' | 'cuda' | 'metal' | 'webgpu' | 'ane';
  readonly contextWindow?: number;
}

export interface LocalLLMCapabilityConfig {
  readonly turboQuant?: boolean;
  readonly sparseInference?: 'auto' | boolean;
  readonly tinyDancerRouting?: boolean;
  readonly h2oEviction?: 'auto' | boolean;
}

export interface GenerateOptions {
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly topP?: number;
  readonly stop?: readonly string[];
  readonly responseSchema?: Readonly<Record<string, unknown>>;
  readonly tools?: readonly ToolDefinition[];
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface GenerateResult {
  readonly text: string;
  readonly structured?: unknown;
  readonly toolCall?: { readonly name: string; readonly arguments: Readonly<Record<string, unknown>> };
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly explain: ExplainTrace;
}

export interface StreamChunk {
  readonly delta: string;
  readonly tokenIndex: number;
  readonly isFinal: boolean;
}

// ---------------- Capability catalog ----------------

const CAPABILITY_CATALOG: readonly CapabilityCatalogEntry[] = [
  {
    name: 'embed',
    source: 'ruvllm',
    adrs: ['ADR-002'],
    probeName: 'embedDeterministic',
    invocationKey: 'embed',
    defaultStatus: 'active',
  },
  {
    name: 'embedUnitNorm',
    source: 'ruvllm',
    probeName: 'embedUnitNorm',
    defaultStatus: 'active',
  },
  {
    name: 'similarity',
    source: 'ruvllm',
    probeName: 'similarityMonotonic',
    invocationKey: 'similarity',
    defaultStatus: 'active',
  },
  // ----- Dormant: design-deferred (could ship in Phase 2; need a real model) -----
  {
    name: 'generate',
    source: 'ruvllm',
    adrs: ['ADR-002', 'ADR-008'],
    invocationKey: 'generate',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'design-deferred',
    defaultDormantReason: 'Phase 1 deliberately omits generate/stream. The binding\'s default-loaded weights produce gibberish (same Cypher-stub failure mode as M6) — Phase 2 will require an explicit `model:` option and a tier-3 probe asserting non-gibberish output.',
    defaultDormantLift: 'Local text generation without a cloud API.',
    defaultDormantEnable: 'Wait for Phase 2 (M11.x); meanwhile use embed + similarity for retrieval-only pipelines.',
  },
  {
    name: 'streaming',
    source: 'ruvllm',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'design-deferred',
    defaultDormantReason: 'Phase 2 work, gated on the same model-file requirement as generate.',
    defaultDormantLift: 'Token-by-token streaming output for chat UIs.',
    defaultDormantEnable: 'Wait for Phase 2.',
  },
  {
    name: 'feedback',
    source: 'ruvllm',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'design-deferred',
    defaultDormantReason: 'The binding exposes feedback() but Phase 1 leaves it unwired. v0.2 may route LocalLLM feedback into a shared SONA instance (cross-archetype coordination, same pattern as M9 Graph RAG).',
    defaultDormantLift: 'Per-query feedback drives continual learning of the routing layer.',
    defaultDormantEnable: 'Wire `recordFeedback` in Phase 2 alongside generate.',
  },
  {
    name: 'localMemory',
    source: 'ruvllm',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'design-deferred',
    defaultDormantReason: 'The binding exposes addMemory/searchMemory; the SDK leaves them unwired in Phase 1 to avoid duplicating AgentMemory archetype scope. v0.2 decides where the API surface lives.',
    defaultDormantLift: 'Per-LLM memory layer bypassing the shared KB.',
    defaultDormantEnable: 'Settle archetype boundaries (LocalLLM vs AgentMemory) in v0.2.',
  },
  // ----- Dormant: upstream-binding -----
  {
    name: 'turboQuantKvCache',
    source: 'ruvllm',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: '6-8x KV-cache compression advertised in the upstream README, but no method is exposed in the @ruvector/ruvllm NAPI surface today.',
    defaultDormantLift: '2-4 bit asymmetric KV quantization with H2O / PyramidKV eviction; <0.5% perplexity loss.',
    defaultDormantEnable: 'Wait for upstream to expose TurboQuant via NAPI.',
  },
  {
    name: 'tinyDancerRouting',
    source: 'ruvector-tiny-dancer-core',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: '@ruvector/tiny-dancer-node is not published. FastGRNN routing exists in the Rust crate but isn\'t bound to NAPI in any v0.1-reachable version.',
    defaultDormantLift: 'Lightweight LLM-router alternative; sub-millisecond decisions for agent dispatch.',
    defaultDormantEnable: 'Track @ruvector/tiny-dancer-node publishing.',
  },
  {
    name: 'sparseInference',
    source: 'ruvector-sparse-inference',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'No published NAPI binding for ruvector-sparse-inference. PowerInfer-style activation gating exists in the Rust crate.',
    defaultDormantLift: '2-10x faster inference on edge by activating only needed neurons.',
    defaultDormantEnable: 'Track upstream NAPI publishing.',
  },
];

// ---------------- Implementation ----------------

export class LocalLLM implements ValueReportProvider, HealthCheckProvider {
  private readonly _backend: NativeRuvllmBackend;
  private readonly _options: LocalLLMOptions;
  private _invocationCounts = new Map<string, number>();
  private _closed = false;
  private _lastHealth: HealthCheckResult | null = null;

  private constructor(backend: NativeRuvllmBackend, options: LocalLLMOptions) {
    this._backend = backend;
    this._options = options;
  }

  static async create(options: LocalLLMOptions = {}): Promise<LocalLLM> {
    const backend = await NativeRuvllmBackend.create({});
    return new LocalLLM(backend, options);
  }

  /** Embedding dimension produced by `embed()`. 768 for the published binding. */
  get embedDimensions(): number { return this._backend.embedDimensions; }

  /**
   * Embed text(s) into unit-normalized Float32Array vectors.
   *
   * v0.1: returns a single Float32Array for string input, or an array of
   * Float32Arrays for string[] input. Vectors have `embedDimensions` length
   * (currently 768) and unit L2 norm.
   */
  async embed(text: string): Promise<Float32Array>;
  async embed(text: readonly string[]): Promise<readonly Float32Array[]>;
  async embed(text: string | readonly string[]): Promise<Float32Array | readonly Float32Array[]> {
    this.assertOpen();
    this.bump('embed');
    if (typeof text === 'string') {
      return this._backend.embedOne(text);
    }
    return this._backend.embedBatch(text);
  }

  /**
   * Cosine similarity between two strings. v0.1: monotonic on strong-signal
   * semantic pairs (cat↔dog > cat↔banana). Less reliable on close-call pairs
   * — use embed() + your own scoring if you need calibrated similarity.
   */
  async similarity(a: string, b: string): Promise<number> {
    this.assertOpen();
    this.bump('similarity');
    return this._backend.similarity(a, b);
  }

  // ----- Phase 2 deferrals (M5 surface preserved; runtime throws) -----

  /** @deprecated Phase 2 — throws until a real model file is wired. */
  generate(_prompt: string, _options?: GenerateOptions): Promise<GenerateResult> {
    throw new NotImplementedError(
      'LocalLLM.generate — deferred to Phase 2. The binding loads but its default ' +
      'weights produce gibberish (same Cypher-stub failure mode caught by tier-3 probes ' +
      'across the SDK). Phase 2 will accept a `model:` option, wire the binding\'s ' +
      'model loader, and add a tier-3 `generate-non-gibberish` assertion. ' +
      'Use embed() + similarity() for v0.1 retrieval workflows.'
    );
  }

  /** @deprecated Phase 2. */
  stream(_prompt: string, _options?: GenerateOptions): AsyncIterable<StreamChunk> {
    throw new NotImplementedError('LocalLLM.stream — Phase 2 (gated on the same model-file requirement as generate).');
  }

  // ----- Cross-cutting -----

  async healthCheck(): Promise<HealthCheckResult> {
    this.assertOpen();
    const checks = await NativeRuvllmBackend.smokeCheck();
    this._lastHealth = summarize('LocalLLM', 'native', checks);
    return this._lastHealth;
  }

  async getValueReport(): Promise<ValueReport> {
    return reduceValueReport({
      catalog: CAPABILITY_CATALOG,
      lastHealth: this._lastHealth,
      invocationCounts: this._invocationCounts,
    });
  }

  introspect(): Pipeline {
    return reduceIntrospect('LocalLLM', {
      catalog: CAPABILITY_CATALOG,
      lastHealth: this._lastHealth,
    });
  }

  /** Diagnostic accessor: backend stats. */
  stats(): Record<string, unknown> { return this._backend.stats(); }
  hasSimd(): boolean { return this._backend.hasSimd(); }

  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    await this._backend.close();
  }

  // ----- Internals -----

  private assertOpen(): void {
    if (this._closed) throw new RuVectorError('CLOSED', 'LocalLLM is closed.');
  }

  private bump(method: string): void {
    this._invocationCounts.set(method, (this._invocationCounts.get(method) ?? 0) + 1);
  }
}

// Re-export type-only references so the module's type surface is self-contained
// for consumers reading via the umbrella (matches the M5 export pattern).
export type { CheckResult };
