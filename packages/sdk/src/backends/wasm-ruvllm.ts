/**
 * WASM backend for LocalLLM. Wraps `@ruvector/ruvllm-wasm@2.0.0`.
 *
 * **M17.2 — second LocalLLM transport.** Mirrors the M17.1 dispatcher
 * pattern. Owns the WASM init lifecycle (Q4 ratification): byte-load on
 * Node, default fetch flow on browser. User code is transport-agnostic.
 *
 * **Critical caveat — surface scope** (live-probed at M17.2):
 *
 * The WASM binding does NOT expose the end-user inference surface. Its
 * main `RuvLLMWasm` class has only `initialize / getPoolStats / reset /
 * static formatChat / static version` — **no `embed`, `similarity`,
 * `generate`, `query`, or `route`**. Those are NAPI-only.
 *
 * The 45 exports are mostly compute primitives (`BufferPoolWasm`,
 * `InferenceArenaWasm`, `ParallelInference.attention(q, k, v, …)`,
 * `KvCacheConfigWasm`, `MicroLoraWasm`, `SonaInstantWasm`) — building
 * blocks for someone implementing inference manually, not user-facing
 * inference calls.
 *
 * **What WASM DOES add** (that NAPI lacks):
 *   - `ChatTemplateWasm.format(messages)` — real llama3 / chatml /
 *     mistral / gemma / phi templates. Working.
 *   - `detectChatTemplate(modelId)` — auto-detect template from model
 *     name. Working.
 *   - `HnswRouterWasm` — in-process HNSW semantic router with
 *     addPattern + route. Working.
 *
 * **What WASM has but is broken** (Issue #10):
 *   - `RuvLLMWasm.formatChat(template, messages)` — throws "null pointer
 *     passed to rust" even with valid inputs. Use the underlying
 *     `ChatTemplateWasm.format()` directly instead.
 *
 * Per CLAUDE.md "never block on upstream": this backend ships the 3
 * working WASM-only capabilities, throws `CAPABILITY_DEFERRED` on the 5
 * inference methods (with a "use transport: 'native'" pointer), and Issue
 * #10 documents the gap so upstream can prioritize.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Type-only imports of WASM classes (they have private constructors so
// InstanceType<typeof Cls> fails; reference the class type directly).
import type { ChatTemplateWasm as WasmChatTemplate, HnswRouterWasm as WasmHnswRouterClass } from '@ruvector/ruvllm-wasm';

import { RuVectorError } from '../core/index.js';
import { runCheck, type CheckResult } from '../core/health.js';
import type {
  ChatMessage,
  ChatTemplateName,
  HnswRouter,
  HnswRouteResult,
  LocalLLMBackend,
  LocalLLMBackendGenConfig,
  LocalLLMBackendQueryResponse,
  LocalLLMBackendRoutingDecision,
} from './localllm-backend.js';

type RuvllmWasmModule = typeof import('@ruvector/ruvllm-wasm');

export interface WasmLocalLLMBackendOptions {
  readonly wasmSource?: ArrayBufferView | URL | string;
}

let _initPromise: Promise<RuvllmWasmModule> | null = null;
let _constructWarned = false;

async function loadWasm(wasmSource: WasmLocalLLMBackendOptions['wasmSource']): Promise<RuvllmWasmModule> {
  if (_initPromise !== null) return _initPromise;
  _initPromise = (async () => {
    const mod = await import('@ruvector/ruvllm-wasm');
    const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;
    if (isNode) {
      let bytes: ArrayBufferView;
      if (wasmSource instanceof Uint8Array || ArrayBuffer.isView(wasmSource)) {
        bytes = wasmSource as ArrayBufferView;
      } else {
        const require = createRequire(import.meta.url);
        const wasmPath = require.resolve('@ruvector/ruvllm-wasm/ruvllm_wasm_bg.wasm');
        bytes = readFileSync(wasmPath);
      }
      await mod.default({ module_or_path: bytes });
    } else {
      const arg = wasmSource !== undefined ? { module_or_path: wasmSource as URL | string } : undefined;
      await mod.default(arg as Parameters<RuvllmWasmModule['default']>[0]);
    }
    return mod;
  })();
  return _initPromise;
}

export class WasmLocalLLMBackend implements LocalLLMBackend {
  readonly kind = 'wasm' as const;
  readonly capabilities: ReadonlySet<string>;
  /** WASM has no embedding method; embedDimensions is null to distinguish from native's 768. */
  readonly embedDimensions: number | null = null;
  private readonly _mod: RuvllmWasmModule;
  private readonly _llm: InstanceType<RuvllmWasmModule['RuvLLMWasm']>;

  private constructor(mod: RuvllmWasmModule, llm: InstanceType<RuvllmWasmModule['RuvLLMWasm']>) {
    this._mod = mod;
    this._llm = llm;
    // The 3 working WASM-only capabilities. Inference methods are NOT
    // listed because they aren't supported on this transport.
    this.capabilities = new Set<string>([
      'chatTemplate',
      'chatTemplateDetect',
      'hnswRouting',
    ]);
  }

  static async create(options: WasmLocalLLMBackendOptions = {}): Promise<WasmLocalLLMBackend> {
    const mod = await loadWasm(options.wasmSource);
    const llm = new mod.RuvLLMWasm();
    try { llm.initialize(); } catch {/* graceful — initialize() may not be required for static-method use */}
    if (!_constructWarned) {
      _constructWarned = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[ruvector-sdk] LocalLLM with transport=\'wasm\' supports only chat template ' +
        'formatting (formatChat / detectChatTemplate) and HNSW routing (createHnswRouter). ' +
        'Inference methods (embed / similarity / generate / query / route) throw ' +
        'CAPABILITY_DEFERRED — use transport=\'native\' for end-user inference. See Issue #10.',
      );
    }
    return new WasmLocalLLMBackend(mod, llm);
  }

  // ----- Inference: NOT supported on WASM transport (Issue #10) -----

  async embedOne(_text: string): Promise<Float32Array> {
    throw new RuVectorError(
      'CAPABILITY_DEFERRED',
      'embed is not exposed on @ruvector/ruvllm-wasm@2.0.0 — RuvLLMWasm has no embed method (Issue #10). Use transport: \'native\'.',
    );
  }
  async embedBatch(_texts: readonly string[]): Promise<readonly Float32Array[]> {
    throw new RuVectorError(
      'CAPABILITY_DEFERRED',
      'embed is not exposed on @ruvector/ruvllm-wasm@2.0.0 (Issue #10). Use transport: \'native\'.',
    );
  }
  async similarity(_a: string, _b: string): Promise<number> {
    throw new RuVectorError(
      'CAPABILITY_DEFERRED',
      'similarity is not exposed on @ruvector/ruvllm-wasm@2.0.0 (Issue #10). Use transport: \'native\'.',
    );
  }
  async generate(_prompt: string, _config?: LocalLLMBackendGenConfig): Promise<string> {
    throw new RuVectorError(
      'CAPABILITY_DEFERRED',
      'generate is not exposed on @ruvector/ruvllm-wasm@2.0.0 — RuvLLMWasm provides only initialize/reset/formatChat (Issue #10). Use transport: \'native\'; note Issue #05 still applies to the native generate path.',
    );
  }
  async query(_text: string, _config?: LocalLLMBackendGenConfig): Promise<LocalLLMBackendQueryResponse> {
    throw new RuVectorError(
      'CAPABILITY_DEFERRED',
      'query is not exposed on @ruvector/ruvllm-wasm@2.0.0 (Issue #10). Use transport: \'native\'.',
    );
  }
  async route(_text: string): Promise<LocalLLMBackendRoutingDecision> {
    throw new RuVectorError(
      'CAPABILITY_DEFERRED',
      'route is not exposed on @ruvector/ruvllm-wasm@2.0.0 (Issue #10). Use transport: \'native\' or use createHnswRouter() for HNSW-based routing.',
    );
  }

  // ----- WASM-only working surface -----

  async formatChat(template: ChatTemplateName, messages: readonly ChatMessage[]): Promise<string> {
    // Use ChatTemplateWasm.format() directly. RuvLLMWasm.formatChat is broken
    // upstream ("null pointer passed to rust" — Issue #10).
    const tmpl = this._buildTemplate(template);
    const wasmMsgs = messages.map((m) => {
      switch (m.role) {
        case 'user': return this._mod.ChatMessageWasm.user(m.content);
        case 'assistant': return this._mod.ChatMessageWasm.assistant(m.content);
        case 'system': return this._mod.ChatMessageWasm.system(m.content);
      }
    });
    return tmpl.format(wasmMsgs);
  }

  async detectChatTemplate(modelId: string): Promise<ChatTemplateName> {
    const tmpl = this._mod.detectChatTemplate(modelId);
    const name = tmpl.name;
    if (name === 'chatml' || name === 'llama3' || name === 'mistral' || name === 'gemma' || name === 'phi') {
      return name;
    }
    // Fallback to chatml when upstream returns a name we don't model in our enum.
    return 'chatml';
  }

  async createHnswRouter(dimensions: number, maxPatterns: number): Promise<HnswRouter> {
    const router = new this._mod.HnswRouterWasm(dimensions, maxPatterns);
    return new WasmHnswRouter(router);
  }

  // ----- Diagnostics -----

  stats(): Record<string, unknown> {
    try {
      return { poolStats: JSON.parse(this._llm.getPoolStats()) };
    } catch {
      return { poolStats: this._llm.getPoolStats() };
    }
  }

  hasSimd(): boolean {
    return this._mod.is_simd_available?.() ?? false;
  }

  isNativeLoaded(): boolean {
    return false; // by definition: this is the WASM transport
  }

  async close(): Promise<void> {
    try { (this._llm as unknown as { free?: () => void }).free?.(); } catch {/* ignore */}
  }

  // ----- Internals -----

  private _buildTemplate(name: ChatTemplateName): WasmChatTemplate {
    switch (name) {
      case 'chatml':  return this._mod.ChatTemplateWasm.chatml();
      case 'llama3':  return this._mod.ChatTemplateWasm.llama3();
      case 'mistral': return this._mod.ChatTemplateWasm.mistral();
      case 'gemma':   return this._mod.ChatTemplateWasm.gemma();
      case 'phi':     return this._mod.ChatTemplateWasm.phi();
    }
  }

  /**
   * Smoke-check the WASM backend.
   *
   * Reports `unsupported` for the 5 inference methods (Issue #10 — they
   * aren't exposed on the WASM binding at all) and exercises the 3 working
   * WASM-only methods. Plus a probe for the broken `RuvLLMWasm.formatChat`
   * that catches "null pointer passed to rust" — when upstream fixes it,
   * the same probe flips to `ok` (M6.2 self-correcting pattern).
   */
  static async smokeCheck(): Promise<readonly CheckResult[]> {
    const mod = await loadWasm(undefined);

    // 5 inference methods that aren't on the binding — dormant unsupported.
    const inferenceUnsupported: CheckResult[] = (['embedDeterministic', 'embedUnitNorm', 'similarityMonotonic', 'generateNonGibberish', 'queryConfidenceBounded', 'routeDecisionShape'] as const).map((name) => ({
      name,
      status: 'unsupported' as const,
      detail: 'WASM transport: RuvLLMWasm has no embed/similarity/generate/query/route methods (Issue #10). Use transport: \'native\' for end-user inference.',
      durationMs: 0,
      tier: 'binding' as const,
    }));

    const chatTemplate = await runCheck('chatTemplate', async () => {
      const tmpl = mod.ChatTemplateWasm.llama3();
      const msgs = [mod.ChatMessageWasm.user('Hello'), mod.ChatMessageWasm.assistant('Hi!')];
      const formatted = tmpl.format(msgs);
      if (typeof formatted !== 'string' || formatted.length === 0) {
        return { status: 'broken' as const, detail: `format() returned: ${JSON.stringify(formatted).slice(0, 50)}` };
      }
      // Real llama3 templates contain `<|begin_of_text|>` and `<|eot_id|>`.
      if (formatted.includes('<|begin_of_text|>') && formatted.includes('<|eot_id|>')) {
        return { status: 'ok' as const, detail: `${formatted.length}-char llama3 chat formatted (begin/eot tokens present)` };
      }
      return { status: 'broken' as const, detail: `template output missing llama3 tokens: ${formatted.slice(0, 60)}…` };
    });

    const chatTemplateDetect = await runCheck('chatTemplateDetect', async () => {
      const t = mod.detectChatTemplate('llama-3-8b');
      if (t.name === 'llama3') return { status: 'ok' as const, detail: `detected 'llama3' for 'llama-3-8b'` };
      return { status: 'broken' as const, detail: `expected 'llama3', got '${t.name}'` };
    });

    const hnswRouting = await runCheck('hnswRouting', async () => {
      const router = new mod.HnswRouterWasm(4, 100);
      const ok = router.addPattern(new Float32Array([1, 0, 0, 0]), 'rust', JSON.stringify({ domain: 'rust' }));
      if (!ok) return { status: 'broken' as const, detail: 'addPattern returned false on first call' };
      const results = router.route(new Float32Array([0.95, 0.05, 0, 0]), 1);
      if (results.length !== 1 || results[0]?.name !== 'rust') {
        return { status: 'broken' as const, detail: `expected 1 hit named 'rust', got ${JSON.stringify(results.map((r) => r.name))}` };
      }
      const score = results[0]?.score ?? 0;
      if (score < 0.9 || score > 1.0) {
        return { status: 'broken' as const, detail: `cosine score=${score.toFixed(4)} for near-parallel vectors out of [0.9, 1.0]` };
      }
      return { status: 'ok' as const, detail: `add+route ok; cosine score=${score.toFixed(4)}` };
    });

    // Probe the known-broken RuvLLMWasm.formatChat — should report broken
    // until upstream fixes the null-pointer bug (Issue #10).
    const ruvllmFormatChat = await runCheck('ruvllmFormatChat', async () => {
      const tmpl = mod.ChatTemplateWasm.llama3();
      const msgs = [mod.ChatMessageWasm.user('Hello')];
      try {
        const formatted = mod.RuvLLMWasm.formatChat(tmpl, msgs);
        if (typeof formatted === 'string' && formatted.length > 0) {
          return { status: 'ok' as const, detail: `${formatted.length}-char output; upstream bug fixed?` };
        }
        return { status: 'broken' as const, detail: `formatChat returned ${JSON.stringify(formatted).slice(0, 50)}` };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          status: 'broken' as const,
          detail: `RuvLLMWasm.formatChat throws: ${msg.slice(0, 80)}. Issue #10 — use ChatTemplateWasm.format() directly.`,
        };
      }
    });

    return [...inferenceUnsupported, chatTemplate, chatTemplateDetect, hnswRouting, ruvllmFormatChat];
  }
}

class WasmHnswRouter implements HnswRouter {
  private readonly _r: WasmHnswRouterClass;

  constructor(r: WasmHnswRouterClass) {
    this._r = r;
  }

  addPattern(embedding: Float32Array, name: string, metadata?: Readonly<Record<string, unknown>>): boolean {
    return this._r.addPattern(embedding, name, JSON.stringify(metadata ?? {}));
  }

  route(query: Float32Array, topK: number): readonly HnswRouteResult[] {
    const results = this._r.route(query, topK);
    return results.map((r: { name: string; score: number }) => ({ name: r.name, score: r.score }));
  }

  get dimensions(): number { return this._r.dimensions; }
  get patternCount(): number { return this._r.patternCount; }
}
