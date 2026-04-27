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

interface UmbrellaExports {
  RuvLLM: RuvLLMConstructor;
}

interface RuvLLMConstructor {
  new (...args: unknown[]): RuvLLMInstance;
}

interface RuvLLMInstance {
  embed(text: string | readonly string[]): Promise<Float32Array | readonly Float32Array[]>;
  similarity(a: string, b: string): Promise<number>;
  stats(): Record<string, unknown>;
  hasSimd?(): boolean;
  simdCapabilities?(): unknown;
  isNativeLoaded?(): boolean;
}

export interface NativeRuvllmBackendOptions {
  /**
   * Optional resolver override. Defaults to `require('@ruvector/ruvllm')`.
   * Currently unused; reserved for v0.2 when WASM/CLI backends land and
   * the SDK needs explicit transport selection.
   */
  readonly bindingPath?: never;
}

export class NativeRuvllmBackend {
  readonly kind = 'native' as const;
  /** Embedding dimension as observed at construction. Currently 768 for the published binding. */
  readonly embedDimensions: number;
  private readonly _llm: RuvLLMInstance;
  private readonly _umbrella: UmbrellaExports;

  private constructor(umbrella: UmbrellaExports, llm: RuvLLMInstance, embedDims: number) {
    this._umbrella = umbrella;
    this._llm = llm;
    this.embedDimensions = embedDims;
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

  stats(): Record<string, unknown> {
    return this._llm.stats();
  }

  isNativeLoaded(): boolean {
    return this._llm.isNativeLoaded?.() ?? true; // umbrella always reports true when loaded
  }

  hasSimd(): boolean {
    return this._llm.hasSimd?.() ?? false;
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

    return [determ, norm, monotonic];
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
