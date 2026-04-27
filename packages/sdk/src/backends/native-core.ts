/**
 * Native (NAPI) backend for KnowledgeBase. Wraps upstream `@ruvector/core`'s
 * `ruvector.node` binary.
 *
 * **v0.1 binding-resolution caveat.** `@ruvector/core` is **not published on
 * npm registry** (M6 scoping verified this). The binary ships only in the
 * upstream repo at `ruvector/npm/core/platforms/<platform>/ruvector.node`.
 * Therefore the backend resolves the binding via, in order:
 *   1. constructor's explicit `bindingPath` option
 *   2. `process.env.RUVECTOR_CORE_BINDING`
 *   3. throw with an actionable error
 *
 * v0.2 should switch to npm-resolution as soon as upstream publishes the
 * platform packages.
 */

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { runCheck, type CheckResult } from '../core/health.js';
import { RuVectorError } from '../core/index.js';

// Shape of the upstream binding's exports — kept here as a private type because
// no published d.ts exists for the in-repo binary.
interface CoreBinding {
  VectorDb: new (options: { dimensions: number; storagePath?: string; distanceMetric?: string }) => CoreVectorDb;
  CollectionManager: unknown;
  getHealth(): { status: string; version: string; uptimeSeconds: number };
  getMetrics(): string;
  hello(): string;
  version(): string;
}

interface CoreVectorDb {
  insert(entry: { id?: string; vector: Float32Array | number[] }): Promise<string>;
  insertBatch(entries: readonly { id?: string; vector: Float32Array | number[] }[]): Promise<readonly string[]>;
  search(query: { vector: Float32Array | number[]; k: number; efSearch?: number }): Promise<readonly { id: string; score: number }[]>;
  delete(id: string): Promise<boolean>;
  get(id: string): Promise<{ id?: string; vector: Float32Array | number[] } | null>;
  len(): Promise<number>;
  isEmpty(): Promise<boolean>;
}

const PROBE_IDS = ['__ruvsdk_probe_1', '__ruvsdk_probe_2', '__ruvsdk_probe_3'] as const;

export interface NativeCoreBackendOptions {
  /** Vector dimensions. Required. */
  readonly dimensions: number;
  /** Distance metric. Default: 'Cosine'. */
  readonly distanceMetric?: 'Euclidean' | 'Cosine' | 'DotProduct' | 'Manhattan';
  /** Persistence path. Defaults to in-memory. */
  readonly storage?: string;
  /**
   * Explicit path to the upstream `ruvector.node` binary.
   * Falls back to `process.env.RUVECTOR_CORE_BINDING` if omitted.
   */
  readonly bindingPath?: string;
}

export class NativeCoreBackend {
  readonly kind = 'native' as const;
  readonly capabilities: ReadonlySet<string>;
  private readonly _db: CoreVectorDb;
  private readonly _binding: CoreBinding;
  private readonly _options: NativeCoreBackendOptions;

  private constructor(binding: CoreBinding, db: CoreVectorDb, options: NativeCoreBackendOptions) {
    this._binding = binding;
    this._db = db;
    this._options = options;
    this.capabilities = new Set([
      'vectorInsert',
      'vectorSearch',
      'vectorDelete',
      'vectorGet',
      'collectionStats',
      'metrics',
      'health',
    ]);
  }

  static async create(options: NativeCoreBackendOptions): Promise<NativeCoreBackend> {
    const binding = loadBinding(options.bindingPath);
    const db = new binding.VectorDb({
      dimensions: options.dimensions,
      ...(options.storage !== undefined && { storagePath: options.storage }),
      distanceMetric: options.distanceMetric ?? 'Cosine',
    });
    return new NativeCoreBackend(binding, db, options);
  }

  // ----- Inserts -----

  async insert(id: string, vector: Float32Array): Promise<string> {
    return this._db.insert({ id, vector });
  }

  async insertBatch(entries: readonly { id: string; vector: Float32Array }[]): Promise<readonly string[]> {
    return this._db.insertBatch(entries);
  }

  // ----- Reads -----

  async search(vector: Float32Array, k: number): Promise<readonly { id: string; score: number }[]> {
    return this._db.search({ vector, k });
  }

  async len(): Promise<number> {
    return this._db.len();
  }

  async deleteId(id: string): Promise<boolean> {
    return this._db.delete(id);
  }

  async isEmpty(): Promise<boolean> {
    return this._db.isEmpty();
  }

  health(): { status: string; version: string; uptimeSeconds: number } {
    return this._binding.getHealth();
  }

  metrics(): string {
    return this._binding.getMetrics();
  }

  version(): string {
    return this._binding.version();
  }

  async close(): Promise<void> {
    // Upstream binding has no explicit close. Native state is GC'd.
  }

  /**
   * Smoke-check this backend against an isolated probe instance.
   *
   * Same pattern as NativeGraphBackend — establishes that the catalog/probe
   * approach from M6.2 is genuinely portable to a second adapter.
   *
   * `dimensions` MUST match the dimensions the user's primary VectorDb was
   * constructed with. M7 v0.1 surfaced an upstream quirk: the binding caches
   * dimensions on the first VectorDb instance and rejects subsequent inserts
   * that don't match. We work around it by sizing the probe to the same
   * dimensions; the workaround is documented in m6-scope.md.
   */
  static async smokeCheck(options: { bindingPath?: string; dimensions?: number }): Promise<readonly CheckResult[]> {
    let binding: CoreBinding | null = null;
    try {
      binding = loadBinding(options.bindingPath);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return ['version', 'vectorInsert', 'vectorSearch', 'health', 'metrics'].map((name) => ({
        name,
        status: 'unsupported' as const,
        detail: `binding not loaded: ${detail}`,
        durationMs: 0,
      }));
    }

    const dims = options.dimensions ?? 4;
    const probe = new binding.VectorDb({ dimensions: dims, distanceMetric: 'Cosine' });
    const oneHot = (i: number): Float32Array => {
      const v = new Float32Array(dims);
      v[i % dims] = 1;
      return v;
    };

    // Pre-clean to handle the case where a previous probe left state. Best-effort.
    for (const id of PROBE_IDS) {
      try { await probe.delete(id); } catch {/* ignore */}
    }

    // Capture baseline len. M7 v0.1 surfaced an upstream quirk: `new VectorDb()`
    // does NOT produce isolated instances — it shares state with prior live
    // instances. Therefore probe assertions must be deltas, not absolutes.
    const baselineLen = await probe.len();

    const version = await runCheck('version', async () => {
      const v = binding!.version();
      return typeof v === 'string' && v.length > 0
        ? { status: 'ok', detail: `version=${v}` }
        : { status: 'broken', detail: `expected non-empty string, got ${JSON.stringify(v)}` };
    });

    const vectorInsert = await runCheck('vectorInsert', async () => {
      const id = await probe.insert({ id: PROBE_IDS[0], vector: oneHot(0) });
      const len = await probe.len();
      const delta = len - baselineLen;
      if (id === PROBE_IDS[0] && delta === 1) return { status: 'ok', detail: `+1 vector (len ${baselineLen}→${len})` };
      return { status: 'broken', detail: `id=${id}, expected delta=1 got ${delta}` };
    });

    const vectorSearch = await runCheck('vectorSearch', async () => {
      await probe.insert({ id: PROBE_IDS[1], vector: oneHot(1) });
      await probe.insert({ id: PROBE_IDS[2], vector: oneHot(2) });
      const results = await probe.search({ vector: oneHot(0), k: 5 });
      if (results.length === 0) return { status: 'broken', detail: 'search returned 0 results for known input' };
      // Closest match to oneHot(0) among PROBE_IDS should be PROBE_IDS[0].
      // The user's data may also be in the shared store; require that PROBE_IDS[0]
      // appears in the top-k results — that's a sufficient correctness check.
      const found = results.some((r) => r.id === PROBE_IDS[0]);
      return found
        ? { status: 'ok', detail: `${results.length} results, probe-1 found in top-${results.length}` }
        : { status: 'broken', detail: `probe-1 not in results: ${results.map(r => r.id).join(',')}` };
    });

    const health = await runCheck('health', async () => {
      const h = binding!.getHealth();
      if (h && h.status === 'healthy' && typeof h.version === 'string') {
        return { status: 'ok', detail: `status=${h.status}, version=${h.version}` };
      }
      return { status: 'broken', detail: `unexpected health: ${JSON.stringify(h)}` };
    });

    const metrics = await runCheck('metrics', async () => {
      const m = binding!.getMetrics();
      // Empty string is a legitimate "no operations recorded yet" response.
      if (typeof m === 'string') {
        return { status: 'ok', detail: m.length > 0 ? `${m.length} bytes` : '(empty — no ops yet)' };
      }
      return { status: 'broken', detail: `expected string, got ${typeof m}` };
    });

    // Clean up: delete probe vectors so the user's len() isn't inflated.
    // This is best-effort — if delete throws, the probe leaves residue and
    // the user gets a slightly inflated count (visible, not corrupting).
    for (const id of PROBE_IDS) {
      try { await probe.delete(id); } catch {/* ignore */}
    }

    return [version, vectorInsert, vectorSearch, health, metrics];
  }
}

// ---------------- Binding loader ----------------

function loadBinding(explicitPath?: string): CoreBinding {
  const path = resolveBindingPath(explicitPath);
  if (!existsSync(path)) {
    throw new RuVectorError(
      'BINDING_NOT_FOUND',
      `Failed to load @ruvector/core native binding at "${path}". ` +
      `@ruvector/core is not published on npm; supply bindingPath or set ` +
      `RUVECTOR_CORE_BINDING to point at upstream's prebuilt .node file ` +
      `(e.g. ruvector/npm/core/platforms/darwin-arm64/ruvector.node).`
    );
  }
  const requireFromHere = createRequire(import.meta.url);
  return requireFromHere(path) as CoreBinding;
}

function resolveBindingPath(explicit?: string): string {
  if (explicit !== undefined && explicit.length > 0) return explicit;
  const env = process.env['RUVECTOR_CORE_BINDING'];
  if (env !== undefined && env.length > 0) return env;
  throw new RuVectorError(
    'BINDING_PATH_REQUIRED',
    `KnowledgeBase v0.1 requires either NativeCoreBackendOptions.bindingPath or the ` +
    `RUVECTOR_CORE_BINDING environment variable. @ruvector/core is not yet published ` +
    `on npm; this resolves automatically once it is.`
  );
}
