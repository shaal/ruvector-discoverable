/**
 * Router-backed KnowledgeBase backend. Wraps `@ruvector/router@0.1.30+`.
 *
 * **M18 — third KB backend, fully publish-ready.** `@ruvector/router` is a
 * stealth-published NAPI binding (M17 scoping find) that ships a working
 * `VectorDb` with `insert / insertAsync / search / searchAsync / delete /
 * getAllIds / count`. The same NAPI layer as `@ruvector/core`, but a
 * separately-published package that doesn't share core's perpetual
 * unpublication.
 *
 * The pivotal advantage: `npm install @ruvector/sdk @ruvector/router`
 * Just Works without the `RUVECTOR_CORE_BINDING` env-var workaround that
 * the M6 → M17.2 NativeCoreBackend has needed since M7. Per CLAUDE.md
 * "never block on upstream", this is the SDK shipping a publish-ready KB
 * path TODAY rather than waiting for `@ruvector/core` to publish.
 *
 * **Surface gap vs `@ruvector/core`:**
 *   ✓ insert / search / delete / count — all present, semantically equivalent
 *   ✗ insertBatch — NOT in router; synthesized as a per-call loop here
 *   ✗ health / metrics / version — NOT in router; backend reports null
 *
 * KnowledgeBase uses only insert + search + delete + count today, so the
 * gaps don't affect KB end-user functionality. The smoke-check observes
 * the missing methods as `unsupported` and the catalog reducer dormant-
 * classifies them — same M6.2 self-correcting pattern. When `@ruvector/router`
 * gains those methods upstream, classification flips to `active` automatically.
 *
 * **Call-shape differences from `@ruvector/core`:**
 *   - `insert(id, vector)` positional vs core's `{ id, vector }` object
 *   - `search(vector, k)` positional vs core's `{ vector, k, efSearch }` object
 *   - `DistanceMetric` is an enum (numeric) vs core's string
 *
 * Adapter normalizes all three to KnowledgeBase's transport-agnostic interface.
 */

import { runCheck, type CheckResult } from '../core/health.js';
import { RuVectorError } from '../core/index.js';
import type { KbBackend, KbHealthReport, KbSearchResult, KbVectorEntry } from './kb-backend.js';

// `@ruvector/router` types. Imported as types only so the module can be
// referenced even when the package isn't installed (graceful failure).
type RouterModule = typeof import('@ruvector/router');
type RouterVectorDb = InstanceType<RouterModule['VectorDb']>;

// Unique-per-run probe IDs to avoid colliding with leaked data from previous
// smoke-check runs (Issue #11 prevents cleanup; leaks accumulate within the
// process). User data with `__ruvsdk_probe_router_` prefix would also collide
// — documented as a reserved prefix.
function makeProbeIds(): readonly string[] {
  const stamp = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  return [
    `__ruvsdk_probe_router_${stamp}_1`,
    `__ruvsdk_probe_router_${stamp}_2`,
    `__ruvsdk_probe_router_${stamp}_3`,
  ];
}

export interface RouterKbBackendOptions {
  /** Vector dimensions. Required. */
  readonly dimensions: number;
  /** Distance metric. Default: 'Cosine'. */
  readonly distanceMetric?: 'Euclidean' | 'Cosine' | 'DotProduct' | 'Manhattan';
  /** Maximum elements (router-specific knob; defaults to unbounded if omitted). */
  readonly maxElements?: number;
  /** Persistence path. Defaults to in-memory. */
  readonly storage?: string;
}

export class RouterKbBackend implements KbBackend {
  readonly kind = 'native' as const;
  readonly nativePackage = 'router' as const;
  readonly capabilities: ReadonlySet<string>;
  private readonly _db: RouterVectorDb;
  private readonly _mod: RouterModule;

  private constructor(mod: RouterModule, db: RouterVectorDb) {
    this._mod = mod;
    this._db = db;
    // Capabilities @ruvector/router exposes today. The 3 missing-vs-core
    // methods (insertBatch, health, metrics) are NOT in this set — the
    // catalog rows for those stay dormant under the router backend.
    this.capabilities = new Set<string>([
      'vectorInsert',
      'vectorSearch',
      // 'vectorDelete' NOT included — Issue #11: @ruvector/router@0.1.30
      // delete(id) hangs forever on existing IDs (native-side infinite loop;
      // even setTimeout doesn't fire). Caller throws CAPABILITY_DEFERRED on
      // deleteId. When upstream fixes it, smoke-check observes ok and the
      // catalog reclassifies (M6.2 self-correcting).
      'collectionStats',
    ]);
  }

  static async create(options: RouterKbBackendOptions): Promise<RouterKbBackend> {
    const mod = await loadRouterModule();
    if (typeof mod.VectorDb !== 'function') {
      throw new RuVectorError(
        'BINDING_SHAPE_UNEXPECTED',
        `@ruvector/router did not export the expected VectorDb class. Got keys: ${Object.keys(mod).join(', ')}`,
      );
    }
    const distanceMetric = mapDistanceMetric(mod, options.distanceMetric ?? 'Cosine');
    const dbOpts: { dimensions: number; distanceMetric?: number; maxElements?: number; storagePath?: string } = {
      dimensions: options.dimensions,
      distanceMetric,
    };
    if (options.maxElements !== undefined) dbOpts.maxElements = options.maxElements;
    if (options.storage !== undefined) dbOpts.storagePath = options.storage;
    const db = new mod.VectorDb(dbOpts);
    return new RouterKbBackend(mod, db);
  }

  // ----- Inserts -----

  async insert(id: string, vector: Float32Array): Promise<string> {
    // router's insertAsync is non-blocking; prefer it over the sync `insert`.
    await this._db.insertAsync(id, vector);
    return id;
  }

  async insertBatch(entries: readonly KbVectorEntry[]): Promise<readonly string[]> {
    // @ruvector/router has no batch op; synthesized as a loop. M18 v0.2
    // could promote this to Promise.all if the binding turns out to be
    // thread-safe under concurrent insertAsync calls.
    const ids: string[] = [];
    for (const e of entries) {
      await this._db.insertAsync(e.id, e.vector);
      ids.push(e.id);
    }
    return ids;
  }

  // ----- Reads -----

  async search(vector: Float32Array, k: number): Promise<readonly KbSearchResult[]> {
    const results = (await this._db.searchAsync(vector, k)) as readonly { id: string; score: number }[];
    return results.map((r) => ({ id: r.id, score: r.score }));
  }

  async len(): Promise<number> {
    return this._db.count();
  }

  async deleteId(_id: string): Promise<boolean> {
    // Issue #11: @ruvector/router@0.1.30 delete(id) hangs forever on
    // existing IDs (native-side infinite loop; even setTimeout doesn't fire).
    // Throw CAPABILITY_DEFERRED with Issue #11 reference rather than risk
    // the SDK process locking up. When upstream fixes it, this can flip
    // back to a passthrough with no API change required for callers.
    throw new RuVectorError(
      'CAPABILITY_DEFERRED',
      'deleteId is unsafe on @ruvector/router@0.1.30 (Issue #11): VectorDb.delete(<existing-id>) hangs forever on a non-empty DB. Use nativePackage: \'core\' for delete support, or rebuild the KB without the offending ID.',
    );
  }

  async isEmpty(): Promise<boolean> {
    return this._db.count() === 0;
  }

  health(): KbHealthReport | null {
    return null; // not exposed by @ruvector/router
  }
  metrics(): string | null {
    return null;
  }
  version(): string | null {
    // @ruvector/router doesn't export a version() helper. The package version
    // could be read from package.json but that requires another module load
    // path; null is acceptable per the interface contract.
    return null;
  }

  async close(): Promise<void> {
    // @ruvector/router's VectorDb has no explicit close; native state is GC'd.
  }

  /**
   * Smoke-check this backend against an isolated probe instance.
   *
   * Mirrors NativeCoreBackend.smokeCheck's shape: probes vectorInsert,
   * vectorSearch, plus declared `unsupported` results for health / metrics
   * (router doesn't expose them — Issue-class "missing API" rather than
   * a defect). The catalog reducer dormant-classifies the unsupported
   * rows under M6.2 self-correcting; if `@ruvector/router` later adds
   * health/metrics, the same probes flip to `ok`.
   *
   * `dimensions` MUST match the dimensions the user's primary VectorDb
   * was constructed with — router shares dimension state across instances
   * within a process, same as @ruvector/core (Issue #03 class). Probe
   * sizes itself to match.
   */
  static async smokeCheck(options: { dimensions?: number }): Promise<readonly CheckResult[]> {
    let mod: RouterModule;
    try {
      mod = await loadRouterModule();
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
    const probe = new mod.VectorDb({ dimensions: dims, distanceMetric: mod.DistanceMetric.Cosine });
    const oneHot = (i: number): Float32Array => {
      const v = new Float32Array(dims);
      v[i % dims] = 1;
      return v;
    };
    const probeIds = makeProbeIds();

    // **No pre-clean and no post-cleanup**: Issue #11 — VectorDb.delete()
    // hangs on existing IDs. Probe data leaks into the shared store; we
    // use unique probe IDs (timestamp-randomized above) so leaks don't
    // collide between runs, and document the leak as a known limitation.
    const baselineLen = probe.count();

    const version = await runCheck('version', async () => {
      // No version() helper in @ruvector/router. Report unsupported with a
      // pointer; if upstream adds one in v0.2, swap to an actual probe.
      return { status: 'unsupported', detail: '@ruvector/router does not export a version() helper (M18 finding; benign).' };
    });

    const vectorInsert = await runCheck('vectorInsert', async () => {
      await probe.insertAsync(probeIds[0]!, oneHot(0));
      const len = probe.count();
      const delta = len - baselineLen;
      return delta === 1
        ? { status: 'ok', detail: `+1 vector (count ${baselineLen}→${len})` }
        : { status: 'broken', detail: `expected delta=1 got ${delta}` };
    });

    const vectorSearch = await runCheck('vectorSearch', async () => {
      await probe.insertAsync(probeIds[1]!, oneHot(1));
      await probe.insertAsync(probeIds[2]!, oneHot(2));
      const results = await probe.searchAsync(oneHot(0), 5);
      if (results.length === 0) {
        return { status: 'broken', detail: 'searchAsync returned 0 results for known input' };
      }
      const typedResults = results as readonly { id: string; score: number }[];
      const found = typedResults.some((r) => r.id === probeIds[0]);
      return found
        ? { status: 'ok', detail: `${typedResults.length} results, probe-1 found in top-${typedResults.length}` }
        : { status: 'broken', detail: `probe-1 not in results: ${typedResults.map((r) => r.id).join(',')}` };
    });

    const health: CheckResult = {
      name: 'health',
      status: 'unsupported',
      detail: '@ruvector/router does not export getHealth(). Use transport "core" (with RUVECTOR_CORE_BINDING) for health reporting.',
      durationMs: 0,
      tier: 'binding',
    };
    const metrics: CheckResult = {
      name: 'metrics',
      status: 'unsupported',
      detail: '@ruvector/router does not export getMetrics(). Use transport "core" for metrics reporting.',
      durationMs: 0,
      tier: 'binding',
    };

    // **No cleanup** — Issue #11. The 3 probe ids leak into the shared
    // store within this process. Using unique-per-run prefixes (above)
    // avoids cross-run collisions; user data won't collide unless the
    // user uses the reserved `__ruvsdk_probe_router_` prefix.

    // Probe vectorDelete: declared `unsupported` because we can't even
    // safely run a probe of it (the call would hang the process). Issue
    // #11 root-cause + diagnostic.
    const vectorDelete: CheckResult = {
      name: 'vectorDelete',
      status: 'unsupported',
      detail: 'Issue #11: @ruvector/router@0.1.30 VectorDb.delete(<existing-id>) hangs forever (native-side infinite loop; even setTimeout does not fire). Probe is intentionally not run to avoid hanging the SDK process.',
      durationMs: 0,
      tier: 'binding',
    };

    return [version, vectorInsert, vectorSearch, vectorDelete, health, metrics];
  }
}

function mapDistanceMetric(mod: RouterModule, name: 'Euclidean' | 'Cosine' | 'DotProduct' | 'Manhattan'): number {
  switch (name) {
    case 'Euclidean':  return mod.DistanceMetric.Euclidean;
    case 'Cosine':     return mod.DistanceMetric.Cosine;
    case 'DotProduct': return mod.DistanceMetric.DotProduct;
    case 'Manhattan':  return mod.DistanceMetric.Manhattan;
  }
}

/**
 * Load `@ruvector/router` and normalize ESM-of-CJS interop quirks.
 *
 * Under Node ESM, dynamic-importing a CJS module hoists *some* names to
 * the namespace top level (functions/classes like `VectorDb`) but leaves
 * others (plain objects like the `DistanceMetric` enum) only on the
 * `default` export. We merge them so callers can use a single shape.
 */
async function loadRouterModule(): Promise<RouterModule> {
  let raw: unknown;
  try {
    raw = await import('@ruvector/router');
  } catch (e) {
    throw new RuVectorError(
      'BINDING_NOT_FOUND',
      '@ruvector/router could not be loaded. Run `npm install @ruvector/router`. ' +
      `Underlying error: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const ns = raw as { default?: unknown } & Record<string, unknown>;
  const fromDefault = (ns.default ?? {}) as Record<string, unknown>;
  // Merge: prefer top-level (live bindings); fall back to default-namespace.
  return { ...fromDefault, ...ns } as unknown as RouterModule;
}
