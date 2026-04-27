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
import { WasmLocalLLMBackend } from '../backends/wasm-ruvllm.js';
import type { ChatMessage, ChatTemplateName, HnswRouter, LocalLLMBackend } from '../backends/localllm-backend.js';

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

/**
 * Result shape of `LocalLLM.query` — automatic-routing variant of generate.
 * The binding returns this shape natively; the SDK passes through verbatim.
 */
export interface QueryResult {
  readonly text: string;
  /** Confidence in [0, 1]. Bounded by the `queryConfidenceBounded` tier-1 probe. */
  readonly confidence: number;
  /** Routed model identifier (binding-internal name). */
  readonly model: string;
  readonly contextSize: number;
  readonly latencyMs: number;
  /** Use this with `recordFeedback` once feedback wiring lands in Phase 3. */
  readonly requestId: string;
}

/**
 * Routing-only decision — `LocalLLM.route` returns this without generating
 * text. Useful for cost/latency budgeting before committing to generation.
 */
export interface RoutingDecision {
  readonly model: string;
  readonly contextSize: number;
  readonly temperature: number;
  readonly topP: number;
  readonly confidence: number;
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
  // ----- M12.1 Phase 2A — generate/query/route now wired via NAPI, but the
  // binding has no model_path config (see docs/upstream-issues/05). The
  // tier-1 probes observe gibberish output and classify these as upstream-bug.
  // When upstream wires a model loader, the same probes flip to ok and the
  // catalog rows move to active automatically — same M6.2 self-correcting
  // pattern as the Cypher stub.
  {
    name: 'generate',
    source: 'ruvllm',
    adrs: ['ADR-002', 'ADR-008'],
    probeName: 'generateNonGibberish',
    invocationKey: 'generate',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-bug',
    defaultDormantReason: 'STUB UPSTREAM (declared): @ruvector/ruvllm@2.5.4 NAPI binding has no model_path config field. ' +
      'Default-loaded weights produce gibberish. Run healthCheck() to confirm against the live binding.',
    defaultDormantLift: 'Local text generation without a cloud API.',
    defaultDormantEnable: 'Wait for upstream to expose a model-loading API in NAPI, OR use the CLI subprocess transport (Phase 2B).',
  },
  {
    name: 'query',
    source: 'ruvllm',
    adrs: ['ADR-002'],
    probeName: 'queryConfidenceBounded',
    invocationKey: 'query',
    // The shape is correct (confidence ∈ [0,1], all fields present); the
    // text content is gibberish for the same reason as generate. The probe
    // checks shape — so it'll report ok today even though the text is
    // garbage. That's intentional: the probe is for the contract, not the
    // model quality. Generate's probe is the model-quality signal.
    defaultStatus: 'active',
  },
  {
    name: 'route',
    source: 'ruvllm',
    adrs: ['ADR-002'],
    probeName: 'routeDecisionShape',
    invocationKey: 'route',
    // Same as query: shape is well-defined and observed-ok; semantic
    // accuracy depends on the underlying router which uses the same broken
    // default model. Useful for budgeting / dispatch logic regardless.
    defaultStatus: 'active',
  },
  {
    name: 'streaming',
    source: 'ruvllm',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'design-deferred',
    defaultDormantReason: 'Upstream StreamingGenerator simulates streaming by chunking the full response — not real token-by-token. v0.3 deferral pending native streaming support.',
    defaultDormantLift: 'Token-by-token streaming output for chat UIs.',
    defaultDormantEnable: 'Wait for upstream native streaming, then add stream() over either CLI SSE (Phase 2B) or upstream-NAPI streaming.',
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
  // ===== WASM-only capabilities (M17.2; gated on transport === 'wasm') =====
  // The WASM binding ships chat-template formatting and HNSW routing that
  // NAPI lacks. Default-dormant [upstream-binding] for native; the WASM
  // smoke-check probes flip them to `active` when transport=wasm.
  {
    name: 'chatTemplate',
    source: 'ruvllm-wasm',
    probeName: 'chatTemplate',
    invocationKey: 'formatChat',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'Chat template formatting is exposed only via @ruvector/ruvllm-wasm (ChatTemplateWasm). Use transport: \'wasm\' to access.',
    defaultDormantLift: 'Real llama3 / chatml / mistral / gemma / phi templates for prompt formatting.',
    defaultDormantEnable: 'await LocalLLM.create({ backend: { kind: \'wasm\' } }), then llm.formatChat(\'llama3\', messages)',
  },
  {
    name: 'chatTemplateDetect',
    source: 'ruvllm-wasm',
    probeName: 'chatTemplateDetect',
    invocationKey: 'detectChatTemplate',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'Auto-detect chat template from model id is exposed only via @ruvector/ruvllm-wasm. Use transport: \'wasm\'.',
    defaultDormantLift: 'Detect template from model name (e.g. \'llama-3-8b\' → \'llama3\') so callers don\'t hardcode.',
    defaultDormantEnable: 'await LocalLLM.create({ backend: { kind: \'wasm\' } }), then llm.detectChatTemplate(modelId)',
  },
  {
    name: 'hnswRouting',
    source: 'ruvllm-wasm',
    probeName: 'hnswRouting',
    invocationKey: 'createHnswRouter',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: 'In-process HNSW semantic router is exposed only via @ruvector/ruvllm-wasm (HnswRouterWasm). Use transport: \'wasm\' OR @ruvector/router (NAPI; M17 stealth find).',
    defaultDormantLift: 'Sub-millisecond pattern routing in-process, browser-compatible.',
    defaultDormantEnable: 'await LocalLLM.create({ backend: { kind: \'wasm\' } }), then llm.createHnswRouter(384, 1000)',
  },
];

// ---------------- Implementation ----------------

export class LocalLLM implements ValueReportProvider, HealthCheckProvider {
  private readonly _backend: LocalLLMBackend;
  private readonly _options: LocalLLMOptions;
  private _invocationCounts = new Map<string, number>();
  private _closed = false;
  private _lastHealth: HealthCheckResult | null = null;

  private constructor(backend: LocalLLMBackend, options: LocalLLMOptions) {
    this._backend = backend;
    this._options = options;
  }

  static async create(options: LocalLLMOptions = {}): Promise<LocalLLM> {
    const transport = resolveLocalLLMTransport(options.backend);
    let backend: LocalLLMBackend;
    if (transport === 'native') {
      backend = await NativeRuvllmBackend.create({});
    } else if (transport === 'wasm') {
      backend = await WasmLocalLLMBackend.create({});
    } else {
      throw new RuVectorError(
        'CAPABILITY_DEFERRED',
        'HTTP transport for LocalLLM is not yet implemented (M17.x deferred). The upstream @ruvector/server@0.1.0 package is broken-published per Issue #08.',
      );
    }
    return new LocalLLM(backend, options);
  }

  /**
   * Embedding dimension produced by `embed()`. 768 on the native binding;
   * `null` on the WASM transport (which does not expose embeddings — Issue #10).
   * Consumers using cross-archetype DI (e.g. `KnowledgeBase.create({ embedder: llm })`)
   * should null-check this when running over WASM transport.
   */
  get embedDimensions(): number {
    const dims = this._backend.embedDimensions;
    if (dims === null) {
      throw new RuVectorError(
        'CAPABILITY_DEFERRED',
        'embedDimensions is not available on the WASM transport — RuvLLMWasm has no embed method (Issue #10). Use transport: \'native\' for cross-archetype embedder DI.',
      );
    }
    return dims;
  }

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

  // ----- M12.1 Phase 2A — generate / query / route over the NAPI backend -----
  //
  // Quality caveat: the published @ruvector/ruvllm NAPI binding has no
  // model_path config field, so default-loaded weights produce gibberish.
  // The contract is honoured (string out for generate; rich object for
  // query / route) and the tier-1 `generateNonGibberish` probe surfaces the
  // upstream-bug status in getValueReport. When upstream ships model
  // loading, the probe flips, and these capabilities move to active with
  // no SDK code change. See docs/upstream-issues/05-no-model-loading-api.md.

  /**
   * Generate text. Returns a `GenerateResult` whose `text` is the binding's
   * raw output. Wrapping is thin: `tokensIn`/`tokensOut` are character-based
   * heuristics (≈ 4 chars/token) since the binding does not surface real
   * tokenizer counts. `explain` records the call.
   */
  async generate(prompt: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    this.assertOpen();
    const start = performance.now();
    const text = await this._backend.generate(prompt, {
      ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.topP !== undefined && { topP: options.topP }),
    });
    const totalMs = performance.now() - start;
    this.bump('generate');
    return {
      text,
      // Heuristic ≈ 4 chars/token — the JS-layer return type is plain string,
      // no tokenizer access. Documented in the QueryResult JSDoc for callers
      // who need accurate accounting.
      tokensIn: Math.max(1, Math.ceil(prompt.length / 4)),
      tokensOut: Math.max(0, Math.ceil(text.length / 4)),
      explain: {
        path: ['generate'],
        stages: [{ name: 'generate', source: 'ruvllm', durationMs: totalMs, note: `${text.length}-char output` }],
        capabilities: [{ name: 'generate', source: 'ruvllm', estimatedLift: null }],
        totalLatencyMs: totalMs,
      },
    };
  }

  /**
   * Query with automatic routing. Returns the binding's `QueryResponse` shape
   * (text + confidence + model + contextSize + latencyMs + requestId).
   * Same model-quality caveat as `generate`.
   */
  async query(text: string, options: GenerateOptions = {}): Promise<QueryResult> {
    this.assertOpen();
    this.bump('query');
    return await this._backend.query(text, {
      ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.topP !== undefined && { topP: options.topP }),
    });
  }

  /**
   * Routing-only — get the model + parameter recommendation for a query
   * without running generation. Useful for cost/latency budgeting.
   */
  async route(text: string): Promise<RoutingDecision> {
    this.assertOpen();
    this.bump('route');
    return await this._backend.route(text);
  }

  /** @deprecated Phase 2C — upstream's StreamingGenerator simulates streaming; real native streaming is upstream work. */
  stream(_prompt: string, _options?: GenerateOptions): AsyncIterable<StreamChunk> {
    throw new NotImplementedError(
      'LocalLLM.stream — Phase 2C deferral. Upstream\'s StreamingGenerator chunks the ' +
      'full response post-generation (not real token-by-token). Real streaming requires ' +
      'either upstream NAPI streaming support or the CLI subprocess transport (Phase 2B)\'s SSE endpoint.'
    );
  }

  // ----- WASM-only public surface (M17.2) -----

  /**
   * Format a chat conversation using a named template (llama3 / chatml /
   * mistral / gemma / phi). WASM-only — throws CAPABILITY_DEFERRED on
   * native transport. See M17.2 — `ChatTemplateWasm` ships in
   * `@ruvector/ruvllm-wasm@2.0.0`; the NAPI binding has no equivalent.
   */
  async formatChat(template: ChatTemplateName, messages: readonly ChatMessage[]): Promise<string> {
    this.assertOpen();
    this.bump('formatChat');
    return this._backend.formatChat(template, messages);
  }

  /**
   * Auto-detect chat template from a model identifier (e.g. `'llama-3-8b'`
   * → `'llama3'`). WASM-only.
   */
  async detectChatTemplate(modelId: string): Promise<ChatTemplateName> {
    this.assertOpen();
    this.bump('detectChatTemplate');
    return this._backend.detectChatTemplate(modelId);
  }

  /**
   * Construct an in-process HNSW semantic router. WASM-only — throws
   * `CAPABILITY_DEFERRED` on native transport. Useful for sub-millisecond
   * pattern routing in browser environments. Returns a handle with
   * `addPattern` / `route` / `dimensions` / `patternCount`.
   */
  async createHnswRouter(dimensions: number, maxPatterns: number): Promise<HnswRouter> {
    this.assertOpen();
    this.bump('createHnswRouter');
    return this._backend.createHnswRouter(dimensions, maxPatterns);
  }

  // ----- Cross-cutting -----

  async healthCheck(): Promise<HealthCheckResult> {
    this.assertOpen();
    const transport = this._backend.kind;
    const checks = transport === 'wasm'
      ? await WasmLocalLLMBackend.smokeCheck()
      : await NativeRuvllmBackend.smokeCheck();
    this._lastHealth = summarize('LocalLLM', transport, checks);
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
export type { ChatMessage, ChatTemplateName, HnswRouter, HnswRouteResult } from '../backends/localllm-backend.js';

/**
 * Resolve the requested transport from `BackendSpec`. Per M17 §6 Q5:
 * explicit-first, auto-fallback. Defaults: native in Node, wasm in browser.
 * HTTP requires explicit opt-in.
 */
function resolveLocalLLMTransport(spec: BackendSpec | undefined): 'native' | 'wasm' | 'http' {
  if (spec === undefined || spec === 'auto') {
    const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;
    return isNode ? 'native' : 'wasm';
  }
  if (typeof spec === 'string') {
    if (spec === 'native' || spec === 'wasm' || spec === 'http') return spec;
    throw new RuVectorError('INVALID_INPUT', `Unknown transport '${spec}'. Expected 'native' | 'wasm' | 'http' | 'auto'.`);
  }
  return spec.kind === 'auto'
    ? (typeof process !== 'undefined' && process.versions?.node !== undefined ? 'native' : 'wasm')
    : spec.kind;
}
