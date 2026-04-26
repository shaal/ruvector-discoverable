/**
 * Run an LLM on the local machine.
 *
 * Anchored by upstream's `ruvllm` (1,547 items, single largest crate). Promoted
 * from PRD §5.6 "advanced" candidates to a first-class archetype during M4
 * because (a) item count is an order of magnitude larger than any other crate
 * and (b) ADR-002, ADR-008, ADR-013 establish it as a headline component.
 *
 * Default-active capabilities (per M4):
 *   - Local model loading (GGUF, ONNX)              — ruvllm
 *   - TurboQuant 2-4 bit KV-cache quantization      — ruvllm
 *   - Sparse inference (PowerInfer-style)           — ruvector-sparse-inference
 *   - Tiny Dancer FastGRNN routing                  — ruvector-tiny-dancer-core
 *
 * Distinct from KnowledgeBase: this is the model runtime; KnowledgeBase is the
 * retrieval that feeds the model. Most adopters will use both together.
 */

import type { BackendSpec } from '../core/backend.js';
import type { ExplainTrace } from '../core/explain.js';
import type { Pipeline } from '../core/pipeline.js';
import type { ValueReport, ValueReportProvider } from '../core/value-report.js';
import { NotImplementedError } from '../core/index.js';

export interface LocalLLMOptions {
  /** Path or URL to the model file (e.g. `.gguf`, `.onnx`). */
  readonly model: string;
  readonly backend?: BackendSpec;
  /** Override capability defaults. */
  readonly capabilities?: LocalLLMCapabilityConfig;
  /** Per-device hints. SDK probes hardware; explicit hints override. */
  readonly device?: 'auto' | 'cpu' | 'cuda' | 'metal' | 'webgpu' | 'ane';
  readonly contextWindow?: number;
}

export interface LocalLLMCapabilityConfig {
  /** Default: true. */
  readonly turboQuant?: boolean;
  /** Default: 'auto' (on for context > 4k tokens). */
  readonly sparseInference?: 'auto' | boolean;
  /** Default: false. */
  readonly tinyDancerRouting?: boolean;
  /** Default: 'auto'. PowerInfer-style activation gating. */
  readonly h2oEviction?: 'auto' | boolean;
}

export interface GenerateOptions {
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly topP?: number;
  readonly stop?: readonly string[];
  /** Optional structured-output schema (JSON schema). */
  readonly responseSchema?: Readonly<Record<string, unknown>>;
  /** Optional tool definitions for function calling. */
  readonly tools?: readonly ToolDefinition[];
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface GenerateResult {
  readonly text: string;
  /** Optional structured payload when `responseSchema` was provided. */
  readonly structured?: unknown;
  /** Optional tool call when `tools` was provided and the model invoked one. */
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

export class LocalLLM implements ValueReportProvider {
  static async create(_options: LocalLLMOptions): Promise<LocalLLM> {
    throw new NotImplementedError('LocalLLM.create');
  }

  /** Single-shot generation. */
  generate(_prompt: string, _options?: GenerateOptions): Promise<GenerateResult> {
    throw new NotImplementedError('LocalLLM.generate');
  }

  /** Streaming generation. */
  stream(_prompt: string, _options?: GenerateOptions): AsyncIterable<StreamChunk> {
    throw new NotImplementedError('LocalLLM.stream');
  }

  /** Embed text(s) using the loaded model's embedder, when supported. */
  embed(_text: string | readonly string[]): Promise<readonly Float32Array[]> {
    throw new NotImplementedError('LocalLLM.embed');
  }

  getValueReport(): Promise<ValueReport> {
    throw new NotImplementedError('LocalLLM.getValueReport');
  }

  introspect(): Pipeline {
    throw new NotImplementedError('LocalLLM.introspect');
  }

  close(): Promise<void> {
    throw new NotImplementedError('LocalLLM.close');
  }
}
