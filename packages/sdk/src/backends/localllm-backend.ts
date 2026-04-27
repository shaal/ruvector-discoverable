/**
 * Shared interface for LocalLLM backends.
 *
 * **M17.2** — extracted alongside the WasmLocalLLMBackend implementation,
 * mirroring the M17.1 pattern (`graph-backend.ts`). Both NativeRuvllmBackend
 * and WasmLocalLLMBackend implement this; the archetype dispatches on
 * `options.backend?.kind`.
 *
 * **Surface gap reality** (live-probed at M17.2): the NAPI binding
 * (`@ruvector/ruvllm@2.5.4`) and the WASM binding (`@ruvector/ruvllm-wasm@2.0.0`)
 * are at substantively different layers of the stack:
 *
 *   - **NAPI** is the end-user inference surface — `embed(text)`,
 *     `similarity(a, b)`, `generate(prompt)`, `query(text)`, `route(text)`.
 *     14 methods, all on `RuvLLM.prototype`. These are what apps call.
 *
 *   - **WASM** is a compute-primitives layer — `BufferPoolWasm`,
 *     `InferenceArenaWasm`, `ParallelInference.attention(q, k, v, …)`,
 *     `KvCacheConfigWasm`. 45 exports, but the main `RuvLLMWasm` class
 *     has only `initialize/getPoolStats/reset/static formatChat/static version`.
 *     **No embed/similarity/generate/query/route.** WASM is what someone
 *     implementing an inference engine would compose; not what apps call.
 *
 * WASM does add three capabilities NAPI lacks:
 *   - `chatTemplate` — `ChatTemplateWasm.format(messages)` for llama3 /
 *     chatml / mistral / gemma / phi templates. Works.
 *   - `chatTemplateDetect` — `detectChatTemplate(modelId)`. Works.
 *   - `hnswRouting` — `HnswRouterWasm` with addPattern + route. Works.
 *
 * The interface lists the union. Adapters implement what their binding
 * supports. Methods missing from a transport throw
 * `RuVectorError('CAPABILITY_DEFERRED', ...)` with a transport-pointer.
 *
 * Per CLAUDE.md "never block on upstream": the SDK ships what each
 * transport offers, names the gaps explicitly via `getValueReport()`,
 * and files paste-ready issues for upstream defects.
 */

import type { CheckResult } from '../core/health.js';

export interface LocalLLMBackendGenConfig {
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly topP?: number;
  readonly topK?: number;
  readonly repetitionPenalty?: number;
}

export interface LocalLLMBackendQueryResponse {
  readonly text: string;
  readonly confidence: number;
  readonly model: string;
  readonly contextSize: number;
  readonly latencyMs: number;
  readonly requestId: string;
}

export interface LocalLLMBackendRoutingDecision {
  readonly model: string;
  readonly contextSize: number;
  readonly temperature: number;
  readonly topP: number;
  readonly confidence: number;
}

export type ChatTemplateName = 'chatml' | 'llama3' | 'mistral' | 'gemma' | 'phi';

export interface ChatMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
}

export interface HnswRouteResult {
  readonly name: string;
  readonly score: number;
}

/**
 * Programmatic handle to a WASM-only HNSW router. Returned by
 * `LocalLLMBackend.createHnswRouter()`. Native transport throws
 * `CAPABILITY_DEFERRED` from `createHnswRouter`.
 */
export interface HnswRouter {
  /** Add a named pattern. Returns true on success, false if max-patterns hit. */
  addPattern(embedding: Float32Array, name: string, metadata?: Readonly<Record<string, unknown>>): boolean;
  /** Find top-k similar patterns to the query embedding. */
  route(query: Float32Array, topK: number): readonly HnswRouteResult[];
  readonly dimensions: number;
  readonly patternCount: number;
}

export interface LocalLLMBackend {
  readonly kind: 'native' | 'wasm' | 'http';
  readonly capabilities: ReadonlySet<string>;
  /** Embedding dimension. May be `null` on transports that don't expose embeddings. */
  readonly embedDimensions: number | null;

  // ----- End-user inference (native today; WASM throws CAPABILITY_DEFERRED) -----
  embedOne(text: string): Promise<Float32Array>;
  embedBatch(texts: readonly string[]): Promise<readonly Float32Array[]>;
  similarity(a: string, b: string): Promise<number>;
  generate(prompt: string, config?: LocalLLMBackendGenConfig): Promise<string>;
  query(text: string, config?: LocalLLMBackendGenConfig): Promise<LocalLLMBackendQueryResponse>;
  route(text: string): Promise<LocalLLMBackendRoutingDecision>;

  // ----- WASM-only (native throws CAPABILITY_DEFERRED) -----
  /** Format a chat conversation using a named template. WASM-only via ChatTemplateWasm. */
  formatChat(template: ChatTemplateName, messages: readonly ChatMessage[]): Promise<string>;
  /** Auto-detect chat template from model id. WASM-only via detectChatTemplate(). */
  detectChatTemplate(modelId: string): Promise<ChatTemplateName>;
  /** Construct an HNSW router for in-process semantic routing. WASM-only via HnswRouterWasm. */
  createHnswRouter(dimensions: number, maxPatterns: number): Promise<HnswRouter>;

  // ----- Diagnostics -----
  stats(): Record<string, unknown>;
  hasSimd(): boolean;
  isNativeLoaded(): boolean;
  close(): Promise<void>;
}

export interface LocalLLMBackendSmokeCheckable {
  smokeCheck(): Promise<readonly CheckResult[]>;
}
