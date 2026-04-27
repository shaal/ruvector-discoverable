/**
 * Native (NAPI) backend wrapping `@ruvector/ruvllm`'s `RuvLLM` JS class
 * (which itself wraps the `RuvLlmEngine` NAPI binding).
 *
 * **M11 v0.1 surprise (see m11-scope.md):** my M6 scoping doc's claim
 * "@ruvector/ruvllm has no NAPI binding" was incorrect. The binding has
 * been published; this backend integrates it.
 *
 * **M11 Phase 1 scope:** `embed` + `similarity` + diagnostic accessors
 * (`stats`, `hasSimd`). `generate`, `stream`, `query`, `route`, `feedback`,
 * `addMemory`, `searchMemory` exist on the binding but produce gibberish
 * without a real model file loaded — same Cypher-stub failure mode. Those
 * are deferred to Phase 2 (where a `model:` option is wired and the
 * tier-3 probe gains a `generate-non-gibberish` assertion).
 *
 * The umbrella's CJS export works; the ESM build is broken upstream
 * (Issue #02 third sample). We use `createRequire` to load CJS from this
 * ESM module — same pattern as `native-core.ts` / `native-sona.ts`.
 */

import { createRequire } from 'node:module';
import { runCheck, type CheckResult } from '../core/health.js';
import { RuVectorError } from '../core/index.js';
import type {
  ChatMessage,
  ChatTemplateName,
  HnswRouter,
  LocalLLMBackend,
  LocalLLMBackendGenConfig,
  LocalLLMBackendQueryResponse,
  LocalLLMBackendRoutingDecision,
} from './localllm-backend.js';

interface UmbrellaExports {
  RuvLLM: RuvLLMConstructor;
}

interface RuvLLMConstructor {
  new (...args: unknown[]): RuvLLMInstance;
}

interface RuvLLMInstance {
  embed(text: string | readonly string[]): Promise<Float32Array | readonly Float32Array[]>;
  similarity(a: string, b: string): Promise<number>;
  // M12 finding: generate returns a *plain string*, not the M5 GenerateResult
  // shape. SDK wraps. Sync per upstream typedef but awaited defensively here.
  generate(prompt: string, config?: NativeGenConfig): string | Promise<string>;
  query(text: string, config?: NativeGenConfig): NativeQueryResponse | Promise<NativeQueryResponse>;
  route(text: string): NativeRoutingDecision | Promise<NativeRoutingDecision>;
  stats(): Record<string, unknown>;
  hasSimd?(): boolean;
  simdCapabilities?(): unknown;
  isNativeLoaded?(): boolean;
}

// Re-exported type aliases for backward compat with M11.x consumers.
export type NativeQueryResponse = LocalLLMBackendQueryResponse;
export type NativeRoutingDecision = LocalLLMBackendRoutingDecision;
type NativeGenConfig = LocalLLMBackendGenConfig;

export interface NativeRuvllmBackendOptions {
  /**
   * Optional resolver override. Defaults to `require('@ruvector/ruvllm')`.
   * Currently unused; reserved for v0.2 when WASM/CLI backends land and
   * the SDK needs explicit transport selection.
   */
  readonly bindingPath?: never;
}

export class NativeRuvllmBackend implements LocalLLMBackend {
  readonly kind = 'native' as const;
  /** Embedding dimension as observed at construction. Currently 768 for the published binding. */
  readonly embedDimensions: number;
  readonly capabilities: ReadonlySet<string>;
  private readonly _llm: RuvLLMInstance;
  private readonly _umbrella: UmbrellaExports;

  private constructor(umbrella: UmbrellaExports, llm: RuvLLMInstance, embedDims: number) {
    this._umbrella = umbrella;
    this._llm = llm;
    this.embedDimensions = embedDims;
    // Capabilities the NAPI binding exposes today. The 3 WASM-only ones
    // (chatTemplate, chatTemplateDetect, hnswRouting) are NOT in this set.
    this.capabilities = new Set<string>([
      'embed',
      'similarity',
      'generate',
      'query',
      'route',
    ]);
  }

  static async create(_options: NativeRuvllmBackendOptions = {}): Promise<NativeRuvllmBackend> {
    const require = createRequire(import.meta.url);
    let umbrella: UmbrellaExports;
    try {
      umbrella = require('@ruvector/ruvllm') as UmbrellaExports;
    } catch (e) {
      throw new RuVectorError(
        'BINDING_NOT_FOUND',
        '@ruvector/ruvllm could not be loaded. Run `npm install @ruvector/ruvllm @ruvector/ruvllm-<platform>` ' +
        'where <platform> is darwin-arm64, darwin-x64, linux-x64-gnu, etc. ' +
        `Underlying error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    if (typeof umbrella.RuvLLM !== 'function') {
      throw new RuVectorError(
        'BINDING_SHAPE_UNEXPECTED',
        `@ruvector/ruvllm did not export the expected RuvLLM class. Got keys: ${Object.keys(umbrella).join(', ')}`,
      );
    }
    const llm = new umbrella.RuvLLM();
    // Probe the embedding dimension once at construct-time so callers know.
    const probe = await llm.embed('__ruvsdk_probe_embed_dim__');
    // Cross-realm `instanceof Float32Array` fails because the binding's
    // typed array comes from a different module realm. Duck-type instead:
    // length is a number, byte-per-element is 4 (Float32), buffer is real.
    const probeArr = asFloat32Array(probe);
    if (probeArr === null) {
      throw new RuVectorError(
        'BINDING_BAD_RETURN',
        `RuvLLM.embed("...") returned ${describe(probe)}, expected Float32Array. Binding may be incompatible.`,
      );
    }
    return new NativeRuvllmBackend(umbrella, llm, probeArr.length);
  }

  /** Embed a single string. Returns a unit-normalized Float32Array of `embedDimensions` length. */
  async embedOne(text: string): Promise<Float32Array> {
    const v = await this._llm.embed(text);
    const arr = asFloat32Array(v);
    if (arr !== null) return arr;
    throw new RuVectorError('BINDING_BAD_RETURN', `Expected Float32Array from embed(string), got ${describe(v)}`);
  }

  /** Embed multiple strings in one binding call. */
  async embedBatch(texts: readonly string[]): Promise<readonly Float32Array[]> {
    if (texts.length === 0) return [];
    // The published binding's RuvLLM.embed only accepts a single string —
    // passing an array throws `StringExpected`. v0.1 dispatches per-string;
    // future binding versions that accept arrays can be added as a
    // capability-detection branch here.
    const out: Float32Array[] = [];
    for (const t of texts) out.push(await this.embedOne(t));
    return out;
  }

  /** Cosine similarity between two strings (upstream's reference implementation). */
  async similarity(a: string, b: string): Promise<number> {
    return this._llm.similarity(a, b);
  }

  /**
   * Generate text. M12 finding: the JS-layer `generate` returns a plain
   * `string`, not the M5 `GenerateResult` object — wrapping happens at the
   * archetype layer. This method returns the raw upstream string.
   *
   * **Quality caveat**: the published binding's NAPI `NativeConfig` has no
   * model-path field, so default-loaded weights produce gibberish. The
   * tier-1 `generateNonGibberish` smoke-check probe (added in M12.1) catches
   * this from observation. See `docs/upstream-issues/05-no-model-loading-api.md`.
   */
  async generate(prompt: string, config: NativeGenConfig = {}): Promise<string> {
    return await this._llm.generate(prompt, config);
  }

  /**
   * Query with automatic routing. Returns the binding's `QueryResponse` shape
   * verbatim (text + confidence + model + contextSize + latencyMs + requestId).
   * Same model-quality caveat as `generate`.
   */
  async query(text: string, config: NativeGenConfig = {}): Promise<NativeQueryResponse> {
    return await this._llm.query(text, config);
  }

  /**
   * Routing-only — get the model + parameter recommendation for a query
   * without running generation. Returns `RoutingDecision` shape.
   */
  async route(text: string): Promise<NativeRoutingDecision> {
    return await this._llm.route(text);
  }

  stats(): Record<string, unknown> {
    return this._llm.stats();
  }

  isNativeLoaded(): boolean {
    return this._llm.isNativeLoaded?.() ?? true; // umbrella always reports true when loaded
  }

  hasSimd(): boolean {
    return this._llm.hasSimd?.() ?? false;
  }

  // ----- WASM-only (native rejects with clear pointer to wasm transport) -----

  async formatChat(_template: ChatTemplateName, _messages: readonly ChatMessage[]): Promise<string> {
    throw new RuVectorError('CAPABILITY_DEFERRED', 'formatChat is not available on the native transport (@ruvector/ruvllm@2.5.4 NAPI has no chat-template helper). Use transport: \'wasm\' to access ChatTemplateWasm-backed formatting.');
  }
  async detectChatTemplate(_modelId: string): Promise<ChatTemplateName> {
    throw new RuVectorError('CAPABILITY_DEFERRED', 'detectChatTemplate is not available on the native transport. Use transport: \'wasm\' to access detectChatTemplate().');
  }
  async createHnswRouter(_dimensions: number, _maxPatterns: number): Promise<HnswRouter> {
    throw new RuVectorError('CAPABILITY_DEFERRED', 'createHnswRouter is not available on the native transport. Use transport: \'wasm\' to access HnswRouterWasm — or use @ruvector/router@0.1.30 (NAPI; M17 stealth find).');
  }

  async close(): Promise<void> {
    // Umbrella's RuvLLM has no explicit close. Native state is GC'd.
  }

  /**
   * Smoke-check this backend with three result-quality assertions:
   *
   *   1. `embedDeterministic` — same input → identical vectors (L2 distance = 0).
   *      Catches a binding that adds noise to its embeddings.
   *
   *   2. `embedUnitNorm` — `norm(embed(x)) ≈ 1.0`. Catches a binding that
   *      returns un-normalized or zero vectors. A failure here would mask
   *      every downstream similarity call.
   *
   *   3. `similarityMonotonic` — `sim(cat, dog) > sim(cat, banana)`.
   *      Strong-signal pair: live-probed values are 0.9997 vs 0.9815
   *      (gap of 0.018, well above noise). Catches a binding that returns
   *      a constant or doesn't actually compute semantic similarity.
   *
   * Probes against an isolated `RuvLLM` instance — the binding's `embed`
   * is read-only on the model so cleanup isn't needed.
   */
  static async smokeCheck(): Promise<readonly CheckResult[]> {
    let umbrella: UmbrellaExports;
    try {
      const require = createRequire(import.meta.url);
      umbrella = require('@ruvector/ruvllm') as UmbrellaExports;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return ['embedDeterministic', 'embedUnitNorm', 'similarityMonotonic'].map((name) => ({
        name,
        status: 'unsupported' as const,
        detail: `binding not loaded: ${detail}`,
        durationMs: 0,
        tier: 'binding' as const,
      }));
    }
    const probe = new umbrella.RuvLLM();

    const determ = await runCheck('embedDeterministic', async () => {
      const v1 = asFloat32Array(await probe.embed('hello world'));
      const v2 = asFloat32Array(await probe.embed('hello world'));
      if (!v1 || !v2) return { status: 'broken', detail: 'embed did not return Float32Array' };
      let max = 0;
      for (let i = 0; i < v1.length; i++) {
        const d = Math.abs((v1[i] ?? 0) - (v2[i] ?? 0));
        if (d > max) max = d;
      }
      if (max === 0) return { status: 'ok', detail: `dim=${v1.length}, identical across calls` };
      if (max < 1e-6) return { status: 'ok', detail: `dim=${v1.length}, max delta ${max.toExponential(2)} (within float noise)` };
      return { status: 'broken', detail: `same input produced different vectors (max delta ${max.toExponential(2)})` };
    });

    const norm = await runCheck('embedUnitNorm', async () => {
      const v = asFloat32Array(await probe.embed('hello world'));
      if (!v) return { status: 'broken', detail: 'embed did not return Float32Array' };
      let s = 0;
      for (const x of v) s += x * x;
      const n = Math.sqrt(s);
      if (n === 0) return { status: 'broken', detail: 'embed returned a zero vector — every similarity collapses' };
      if (Math.abs(n - 1.0) < 1e-3) return { status: 'ok', detail: `norm = ${n.toFixed(4)} (unit-normalized)` };
      return { status: 'broken', detail: `expected unit norm; got ${n.toFixed(4)}` };
    });

    // M12.1 — three new binding-tier probes that observe generate/query/route
    // contract. The first (generateNonGibberish) is the load-bearing flip
    // signal: defaults to broken (upstream binding has no model_path config),
    // and will auto-flip to ok when upstream wires real weights or a model
    // loader. Same M6.2 self-correcting pattern as the Cypher stub.

    const nativeLoaded = probe.isNativeLoaded?.() ?? false;

    const genNonGibberish = await runCheck('generateNonGibberish', async () => {
      if (!nativeLoaded) {
        // M12 finding: the JS fallback returns a help message that's ≥80%
        // alphanumeric, which would pass the assertion as a false positive.
        // Require native to be loaded; otherwise mark unsupported.
        return { status: 'unsupported', detail: 'isNativeLoaded()=false; binding running in JS fallback mode' };
      }
      const out = await probe.generate('Once upon a time', { maxTokens: 20 });
      if (typeof out !== 'string') {
        return { status: 'broken', detail: `expected string, got ${typeof out}` };
      }
      const trimmed = out.trim();
      if (trimmed.length === 0) {
        return { status: 'broken', detail: 'generate returned empty string' };
      }

      // Three conjunctive assertions. M12.1 first attempt used only the
      // alphanumeric-ratio check at ≥80% and FALSE-POSITIVED on observed
      // gibberish ("hadeachqthat##lyallhad...") because the model emits
      // letter-noise with very few spaces — 82% alphanumeric, but barely
      // any whitespace and run-on word-like fragments. Real English text
      // has ~15-18% whitespace and avg word length ~5 chars.

      // Assertion 1: ≥ 80% alphanumeric + whitespace (catches non-text
      // punctuation noise like "##*}{[")
      let alnumWs = 0;
      for (const ch of trimmed) {
        if (/[A-Za-z0-9\s]/.test(ch)) alnumWs++;
      }
      const alnumRatio = alnumWs / trimmed.length;

      // Assertion 2: ≥ 8% whitespace (real English ≥ 12% typically; 8%
      // gives buffer for short outputs). Catches "letter-noise without
      // spaces" failure mode that broke the v1 probe.
      let ws = 0;
      for (const ch of trimmed) {
        if (/\s/.test(ch)) ws++;
      }
      const wsRatio = ws / trimmed.length;

      // Assertion 3: longest run of non-whitespace ≤ 25 chars (longest
      // English word is ~20; real text rarely exceeds 25 between spaces).
      let curRun = 0;
      let maxRun = 0;
      for (const ch of trimmed) {
        if (/\s/.test(ch)) { curRun = 0; }
        else { curRun++; if (curRun > maxRun) maxRun = curRun; }
      }

      const sample = trimmed.slice(0, 40).replace(/\s+/g, ' ');
      const detailBase = `alnum/ws=${(alnumRatio * 100).toFixed(0)}%, ws=${(wsRatio * 100).toFixed(0)}%, longest-run=${maxRun} chars`;

      if (alnumRatio < 0.8) {
        return {
          status: 'broken',
          detail: `${detailBase} — ${(alnumRatio * 100).toFixed(0)}% alphanumeric/whitespace (need ≥80%). Sample: "${sample}${trimmed.length > 40 ? '...' : ''}". NAPI binding has no model_path config (see upstream-issues/05).`,
        };
      }
      if (wsRatio < 0.08) {
        return {
          status: 'broken',
          detail: `${detailBase} — only ${(wsRatio * 100).toFixed(1)}% whitespace (need ≥8%); real English text has ~15%. Sample: "${sample}${trimmed.length > 40 ? '...' : ''}". NAPI binding has no model_path config (see upstream-issues/05).`,
        };
      }
      if (maxRun > 25) {
        return {
          status: 'broken',
          detail: `${detailBase} — longest non-whitespace run is ${maxRun} chars (longest English word ≈ 20). Sample: "${sample}${trimmed.length > 40 ? '...' : ''}". NAPI binding has no model_path config (see upstream-issues/05).`,
        };
      }
      return {
        status: 'ok',
        detail: `${detailBase} — ${trimmed.length} chars; passes all three assertions`,
      };
    });

    const queryBounded = await runCheck('queryConfidenceBounded', async () => {
      if (!nativeLoaded) {
        return { status: 'unsupported', detail: 'isNativeLoaded()=false; binding running in JS fallback mode' };
      }
      const r = await probe.query('What is machine learning?');
      if (typeof r !== 'object' || r === null) {
        return { status: 'broken', detail: `expected object, got ${typeof r}` };
      }
      const conf = r.confidence;
      if (typeof conf !== 'number' || !Number.isFinite(conf)) {
        return { status: 'broken', detail: `confidence is not a finite number: ${conf}` };
      }
      if (conf < 0 || conf > 1) {
        return { status: 'broken', detail: `confidence=${conf.toFixed(4)} out of [0,1]` };
      }
      // M12.4 corrected attribution (was M12.1): the JS-layer wrapper claims
      // to return 6 fields and only delivers 3. M12.1 attributed this to
      // "native struct under-populated" — wrong. M12.4 probed the platform
      // binding directly and found the native side returns ALL six fields
      // populated in camelCase. The defect is in the umbrella's wrapper
      // (`engine.js`) which renames snake_case → camelCase that the native
      // binding has already done: every `result.context_size` lookup hits
      // `undefined`. See docs/upstream-issues/06-query-route-under-populated-fields.md.
      // Probe enumerates which fields are undefined for actionable diagnostic.
      const missing: string[] = [];
      if (typeof r.text !== 'string') missing.push(`text(${typeof r.text})`);
      if (typeof r.model !== 'string') missing.push(`model(${typeof r.model})`);
      if (typeof r.contextSize !== 'number') missing.push(`contextSize(${typeof r.contextSize})`);
      if (typeof r.latencyMs !== 'number') missing.push(`latencyMs(${typeof r.latencyMs})`);
      if (typeof r.requestId !== 'string') missing.push(`requestId(${typeof r.requestId})`);
      if (missing.length > 0) {
        return {
          status: 'broken',
          detail: `confidence ok (${conf.toFixed(3)}) but missing/wrong-type fields: ${missing.join(', ')}. JS-wrapper case-rename mismatch: snake_case lookups against camelCase native return — see upstream-issues/06.`,
        };
      }
      return { status: 'ok', detail: `confidence=${conf.toFixed(3)}; model='${r.model}'; ${r.text.length}-char text; latency=${r.latencyMs.toFixed(2)}ms` };
    });

    const routeShape = await runCheck('routeDecisionShape', async () => {
      if (!nativeLoaded) {
        return { status: 'unsupported', detail: 'isNativeLoaded()=false; binding running in JS fallback mode' };
      }
      const r = await probe.route('build a vector database');
      if (typeof r !== 'object' || r === null) {
        return { status: 'broken', detail: `expected object, got ${typeof r}` };
      }
      const missing: string[] = [];
      if (typeof r.model !== 'string') missing.push(`model(${typeof r.model})`);
      if (typeof r.contextSize !== 'number') missing.push(`contextSize(${typeof r.contextSize})`);
      if (typeof r.temperature !== 'number') {
        missing.push(`temperature(${typeof r.temperature})`);
      } else if (r.temperature < 0 || r.temperature > 2) {
        return { status: 'broken', detail: `temperature=${r.temperature} out of [0,2]` };
      }
      if (typeof r.topP !== 'number') {
        missing.push(`topP(${typeof r.topP})`);
      } else if (r.topP < 0 || r.topP > 1) {
        return { status: 'broken', detail: `topP=${r.topP} out of [0,1]` };
      }
      if (typeof r.confidence !== 'number') missing.push(`confidence(${typeof r.confidence})`);
      if (missing.length > 0) {
        return {
          status: 'broken',
          detail: `RoutingDecision missing/wrong-type fields: ${missing.join(', ')}. JS-wrapper case-rename mismatch (same defect as queryConfidenceBounded) — see upstream-issues/06.`,
        };
      }
      return { status: 'ok', detail: `model='${r.model}', T=${r.temperature.toFixed(2)}, topP=${r.topP.toFixed(2)}, conf=${r.confidence.toFixed(2)}` };
    });

    const monotonic = await runCheck('similarityMonotonic', async () => {
      const related = await probe.similarity('cat', 'dog');
      const unrelated = await probe.similarity('cat', 'banana');
      // Live-probed gap on the default model: 0.9997 vs 0.9815 (~0.02).
      // Allow a small margin in case the model changes; the assertion is
      // monotonicity, not a specific gap.
      if (typeof related !== 'number' || typeof unrelated !== 'number') {
        return { status: 'broken', detail: `similarity returned non-numbers (${typeof related}, ${typeof unrelated})` };
      }
      if (related > unrelated) {
        return { status: 'ok', detail: `sim(cat,dog)=${related.toFixed(4)} > sim(cat,banana)=${unrelated.toFixed(4)}` };
      }
      return {
        status: 'broken',
        detail: `expected sim(cat,dog) > sim(cat,banana); got ${related.toFixed(4)} ≤ ${unrelated.toFixed(4)} — model likely defaults to a non-semantic stub`,
      };
    });

    return [determ, norm, monotonic, genNonGibberish, queryBounded, routeShape];
  }
}

// ---------------- Cross-realm helpers ----------------
// `instanceof Float32Array` fails when the typed array comes from a different
// module realm (the @ruvector/ruvllm binding ships its own typed-array
// constructors). Duck-type instead: real Float32Arrays have BYTES_PER_ELEMENT
// === 4, a `buffer` that's an ArrayBuffer, a numeric `length`, and indexable
// numeric values. If we get one we can't recognize, return null and let the
// caller error with a `describe()`-formatted message.

function asFloat32Array(v: unknown): Float32Array | null {
  if (v instanceof Float32Array) return v;
  // Cross-realm typed array: same shape, different constructor realm.
  if (
    v !== null &&
    typeof v === 'object' &&
    typeof (v as { length?: unknown }).length === 'number' &&
    (v as { BYTES_PER_ELEMENT?: unknown }).BYTES_PER_ELEMENT === 4 &&
    (v as { buffer?: unknown }).buffer instanceof ArrayBuffer
  ) {
    const view = v as { buffer: ArrayBuffer; byteOffset: number; length: number };
    return new Float32Array(view.buffer, view.byteOffset, view.length);
  }
  // Plain JS Array of numbers — what `@ruvector/ruvllm`'s umbrella JS layer
  // actually returns from `embed()` (the underlying NAPI binding probably
  // returns a typed array; the wrapper converts). Copy into a Float32Array
  // for the SDK's typed surface.
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'number') {
    return Float32Array.from(v as readonly number[]);
  }
  return null;
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(len=${v.length})`;
  if (typeof v === 'object') {
    const ctor = (v as { constructor?: { name?: string } }).constructor?.name ?? 'Object';
    const keys = Object.keys(v as object).slice(0, 4).join(',');
    return `${ctor}{${keys}}`;
  }
  return typeof v;
}
