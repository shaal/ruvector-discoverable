/**
 * Native (NAPI) backend wrapping `@ruvector/sona`'s SonaEngine.
 *
 * **v0.1 binding-resolution caveat.** Same situation as `@ruvector/core`:
 * the upstream npm package `@ruvector/sona@0.1.6` is published-but-broken
 * (its `package.json#main` references files not present in the tarball).
 * The platform-specific package `@ruvector/sona-darwin-arm64` ships a
 * working `.node` binary, which we load directly.
 *
 * Resolution order:
 *   1. constructor's explicit `bindingPath`
 *   2. `process.env.RUVECTOR_SONA_BINDING`
 *   3. auto-resolve `@ruvector/sona-<platform>` via require.resolve
 *   4. throw with actionable error
 *
 * SonaEngine's API is trajectory-based:
 *   - `beginTrajectory(input: number[])` → trajectoryId
 *   - `setTrajectoryRoute(tid, routeId: string)`
 *   - `addTrajectoryContext(tid, context: string)`
 *   - `endTrajectory(tid, reward: number)`
 *   - `tick()` triggers learning
 *   - `applyMicroLora(input: number[])` → number[] (LoRA-warped vector)
 *
 * KnowledgeBase begins a trajectory at retrieve()-time, sets the route to
 * the top citation, and ends with the user's feedback score on
 * recordFeedback(). After enough trajectories with positive feedback,
 * applyMicroLora warps query embeddings toward rewarded docs.
 */

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { runCheck, type CheckResult } from '../core/health.js';
import { RuVectorError } from '../core/index.js';

interface SonaBinding {
  SonaEngine: SonaEngineConstructor;
}

interface SonaEngineConstructor {
  withConfig(config: { hiddenDim: number }): SonaEngineInstance;
  new (...args: unknown[]): SonaEngineInstance;
}

interface SonaEngineInstance {
  beginTrajectory(input: readonly number[]): number;
  setTrajectoryRoute(tid: number, routeId: string): void;
  addTrajectoryContext(tid: number, context: string): void;
  addTrajectoryStep(tid: number, ...args: unknown[]): unknown;
  endTrajectory(tid: number, reward: number): void;
  tick(): unknown;
  forceLearn(): unknown;
  flush(): unknown;
  findPatterns(...args: unknown[]): unknown;
  getStats(): string;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  applyMicroLora(input: readonly number[], strength?: number): number[];
  applyBaseLora(input: readonly number[]): number[];
}

export interface NativeSonaBackendOptions {
  /** Hidden dimension; must match the host archetype's vector dimensions. */
  readonly hiddenDim: number;
  /** Explicit path to the .node binary. Falls back to env var, then auto-resolve. */
  readonly bindingPath?: string;
}

export class NativeSonaBackend {
  readonly kind = 'native' as const;
  private readonly _engine: SonaEngineInstance;
  private readonly _hiddenDim: number;
  private readonly _binding: SonaBinding;
  private readonly _bindingPath: string;

  private constructor(binding: SonaBinding, engine: SonaEngineInstance, hiddenDim: number, bindingPath: string) {
    this._binding = binding;
    this._engine = engine;
    this._hiddenDim = hiddenDim;
    this._bindingPath = bindingPath;
  }

  static async create(options: NativeSonaBackendOptions): Promise<NativeSonaBackend> {
    const { binding, path } = loadBinding(options.bindingPath);
    const engine = binding.SonaEngine.withConfig({ hiddenDim: options.hiddenDim });
    return new NativeSonaBackend(binding, engine, options.hiddenDim, path);
  }

  get hiddenDim(): number { return this._hiddenDim; }

  /** Begin a trajectory with an input embedding. Returns a numeric trajectoryId. */
  beginTrajectory(input: Float32Array): number {
    if (input.length !== this._hiddenDim) {
      throw new RuVectorError(
        'INVALID_INPUT',
        `SonaEngine expects input length ${this._hiddenDim}, got ${input.length}`,
      );
    }
    return this._engine.beginTrajectory(Array.from(input));
  }

  setTrajectoryRoute(tid: number, routeId: string): void {
    this._engine.setTrajectoryRoute(tid, routeId);
  }

  addTrajectoryContext(tid: number, context: string): void {
    this._engine.addTrajectoryContext(tid, context);
  }

  /** Close a trajectory with a reward in [-1, 1]. Triggers async learning. */
  endTrajectory(tid: number, reward: number): void {
    this._engine.endTrajectory(tid, reward);
  }

  /** Apply the current LoRA delta to a query embedding, returning the warped vector. */
  applyMicroLora(input: Float32Array, strength = 1.0): Float32Array {
    if (input.length !== this._hiddenDim) {
      throw new RuVectorError(
        'INVALID_INPUT',
        `SonaEngine expects input length ${this._hiddenDim}, got ${input.length}`,
      );
    }
    const out = this._engine.applyMicroLora(Array.from(input), strength);
    return Float32Array.from(out);
  }

  /** Run a learning tick. Returns whatever the binding gave us; usually null. */
  tick(): unknown {
    return this._engine.tick();
  }

  /**
   * Parse the binding's debug-stringified `CoordinatorStats` into a structured object.
   * Best-effort regex parse; if upstream changes the format, returns the raw string.
   */
  stats(): SonaStats {
    const raw = this._engine.getStats();
    const fields: Record<string, string | number | boolean> = {};
    const re = /(\w+):\s*([\w.-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const [, key, val] = m;
      if (!key) continue;
      const v = val ?? '';
      if (v === 'true') fields[key] = true;
      else if (v === 'false') fields[key] = false;
      else if (/^-?\d+(\.\d+)?$/.test(v)) fields[key] = Number.parseFloat(v);
      else fields[key] = v;
    }
    return {
      raw,
      trajectoriesBuffered: numField(fields, 'trajectories_buffered'),
      trajectoriesDropped: numField(fields, 'trajectories_dropped'),
      patternsStored: numField(fields, 'patterns_stored'),
      ewcTasks: numField(fields, 'ewc_tasks'),
      bufferSuccessRate: numField(fields, 'buffer_success_rate'),
    };
  }

  isEnabled(): boolean { return this._engine.isEnabled(); }

  async close(): Promise<void> {
    // No explicit close on SonaEngine; binding state is GC'd.
  }

  /**
   * Smoke-check this backend against an isolated probe. Verifies the basic
   * trajectory cycle (begin → route → end → tick) completes without error
   * and the stats reflect the buffered trajectory.
   *
   * Does NOT verify that learning observably affects retrieval — that
   * requires many trajectories, takes time, and is checked at the
   * archetype tier-3 layer (KnowledgeBase._sonaProbe).
   */
  static async smokeCheck(options: { bindingPath?: string; hiddenDim?: number }): Promise<readonly CheckResult[]> {
    const dims = options.hiddenDim ?? 64;
    let binding: SonaBinding | null = null;
    let path = '';
    try {
      const loaded = loadBinding(options.bindingPath);
      binding = loaded.binding;
      path = loaded.path;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return ['sonaConstruct', 'sonaTrajectory', 'sonaApplyLora'].map((name) => ({
        name,
        status: 'unsupported' as const,
        detail: `binding not loaded: ${detail}`,
        durationMs: 0,
        tier: 'binding' as const,
      }));
    }

    const construct = await runCheck('sonaConstruct', async () => {
      try {
        const e = binding!.SonaEngine.withConfig({ hiddenDim: dims });
        if (!e.isEnabled()) return { status: 'broken' as const, detail: 'engine.isEnabled() returned false on fresh construct' };
        return { status: 'ok' as const, detail: `withConfig(hiddenDim=${dims}); enabled=true; binding=${path}` };
      } catch (err) {
        return { status: 'error' as const, detail: err instanceof Error ? err.message : String(err) };
      }
    });

    const engine = binding.SonaEngine.withConfig({ hiddenDim: dims });

    const trajectory = await runCheck('sonaTrajectory', async () => {
      const input = new Array(dims).fill(0.5);
      const tid = engine.beginTrajectory(input);
      if (typeof tid !== 'number') return { status: 'broken' as const, detail: `beginTrajectory returned ${typeof tid}, expected number` };
      engine.setTrajectoryRoute(tid, '__ruvsdk_probe_route');
      engine.addTrajectoryContext(tid, '__ruvsdk_probe_ctx');
      engine.endTrajectory(tid, 1.0);
      const stats = engine.getStats();
      // Stats string contains "trajectories_buffered: N" — at least 1 expected post-end.
      const m = /trajectories_buffered:\s*(\d+)/.exec(stats);
      const buffered = m && m[1] ? Number.parseInt(m[1], 10) : 0;
      if (buffered < 1) return { status: 'broken' as const, detail: `expected trajectories_buffered ≥ 1 after endTrajectory; got ${buffered}; stats=${stats.slice(0, 100)}` };
      return { status: 'ok' as const, detail: `trajectory cycle ok (tid=${tid}, buffered=${buffered})` };
    });

    const applyLora = await runCheck('sonaApplyLora', async () => {
      const input = new Array(dims).fill(0.3);
      const out = engine.applyMicroLora(input, 1.0);
      if (!Array.isArray(out)) return { status: 'broken' as const, detail: `applyMicroLora returned ${typeof out}, expected array` };
      if (out.length !== dims) return { status: 'broken' as const, detail: `applyMicroLora returned length ${out.length}, expected ${dims}` };
      return { status: 'ok' as const, detail: `LoRA apply returned ${out.length}-dim vector` };
    });

    return [construct, trajectory, applyLora];
  }
}

export interface SonaStats {
  /** Original debug-stringified `CoordinatorStats` from the binding. */
  readonly raw: string;
  readonly trajectoriesBuffered: number;
  readonly trajectoriesDropped: number;
  readonly patternsStored: number;
  readonly ewcTasks: number;
  readonly bufferSuccessRate: number;
}

// ---------------- Helpers ----------------

function numField(fields: Record<string, string | number | boolean>, key: string): number {
  const v = fields[key];
  return typeof v === 'number' ? v : 0;
}

function loadBinding(explicitPath?: string): { binding: SonaBinding; path: string } {
  const path = resolveBindingPath(explicitPath);
  if (!existsSync(path)) {
    throw new RuVectorError(
      'BINDING_NOT_FOUND',
      `Failed to load @ruvector/sona native binding at "${path}". ` +
      `The umbrella @ruvector/sona package is published but broken (M6 finding); ` +
      `install @ruvector/sona-<platform> directly OR set RUVECTOR_SONA_BINDING.`,
    );
  }
  const requireFromHere = createRequire(import.meta.url);
  return { binding: requireFromHere(path) as SonaBinding, path };
}

function resolveBindingPath(explicit?: string): string {
  if (explicit !== undefined && explicit.length > 0) return explicit;
  const env = process.env['RUVECTOR_SONA_BINDING'];
  if (env !== undefined && env.length > 0) return env;
  // Auto-resolve via the platform package, e.g. @ruvector/sona-darwin-arm64.
  const platform = process.platform;
  const arch = process.arch;
  const platformPkgs = [
    `@ruvector/sona-${platform}-${arch}`,
    // libc variant for linux
    `@ruvector/sona-${platform}-${arch}-gnu`,
  ];
  const requireFromHere = createRequire(import.meta.url);
  for (const pkg of platformPkgs) {
    try {
      // Resolve the package.json to find the dir
      const pkgJsonPath = requireFromHere.resolve(`${pkg}/package.json`);
      const dir = pkgJsonPath.replace(/\/package\.json$/, '');
      // Convention: <pkg>/<binaryName>.<platform>-<arch>.node
      const candidates = [
        `${dir}/sona.${platform}-${arch}.node`,
        `${dir}/sona.${platform}-${arch}-gnu.node`,
      ];
      for (const c of candidates) if (existsSync(c)) return c;
    } catch {/* package not installed; try next */}
  }
  throw new RuVectorError(
    'BINDING_PATH_REQUIRED',
    `Could not auto-resolve @ruvector/sona platform binding for ${platform}-${arch}. ` +
    `Install the matching @ruvector/sona-<platform> package OR set RUVECTOR_SONA_BINDING.`,
  );
}
