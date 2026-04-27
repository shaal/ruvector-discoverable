/**
 * Shared interface for KnowledgeBase backends.
 *
 * **M18** — extracted alongside the RouterKbBackend implementation,
 * mirroring the M17.1/M17.2 pattern (`graph-backend.ts`, `localllm-backend.ts`).
 * Both `NativeCoreBackend` (wrapping `@ruvector/core`) and `RouterKbBackend`
 * (wrapping `@ruvector/router`) implement this; the archetype dispatches on
 * `KnowledgeBaseOptions.nativePackage`.
 *
 * **Why two NAPI-layer backends instead of just native vs WASM**:
 * `@ruvector/core` is upstream's planned KB primary but **is not published
 * on npm** (M6 scoping verified); consumers need the `RUVECTOR_CORE_BINDING`
 * env-var workaround. `@ruvector/router` IS published (M17 stealth find;
 * v0.1.30) and ships a working `VectorDb` with insert / insertAsync /
 * search / searchAsync / delete / getAllIds / count. Same NAPI layer,
 * different package, different publication state.
 *
 * Per CLAUDE.md "never block on upstream": if the SDK can wire a
 * publish-ready alternative without rewriting upstream, ship it. M18 is
 * the reprobe-anticipated "wire it (sdk-integration) — classification was
 * wrong" path: when the M17 reprobe surfaced `@ruvector/router` as a
 * stealth-published package, the action item was "Wire it … OR update
 * dormant reason; classification was wrong." This milestone takes that
 * action.
 *
 * **Surface coverage**: `@ruvector/router.VectorDb` exposes the subset of
 * `@ruvector/core.VectorDb` that KnowledgeBase actually uses today
 * (insert / search / delete / count). Capabilities exclusive to
 * `@ruvector/core` (health / metrics / version reporting) are not on
 * `@ruvector/router`; the router-backed `KnowledgeBase` reports them
 * `unsupported` in its smoke-check, which the catalog reducer dormant-
 * classifies — same M6.2 self-correcting pattern.
 *
 * **TSM / AgentMemory follow-up**: TimeSeriesMemory and AgentMemory also
 * use `NativeCoreBackend` today. Migrating them to the router backend is
 * a v0.3 work-item — the surface they need (timestamp-keyed inserts,
 * agent-scoping) may require more than what `@ruvector/router` exposes;
 * needs its own scoping pass.
 */

import type { CheckResult } from '../core/health.js';

export interface KbVectorEntry {
  readonly id: string;
  readonly vector: Float32Array;
}

export interface KbSearchResult {
  readonly id: string;
  readonly score: number;
}

export interface KbHealthReport {
  readonly status: string;
  readonly version: string;
  readonly uptimeSeconds: number;
}

export interface KbBackend {
  readonly kind: 'native' | 'wasm' | 'http';
  /** Distinguishes which NAPI package powers this native backend. */
  readonly nativePackage: 'core' | 'router' | null;
  readonly capabilities: ReadonlySet<string>;

  insert(id: string, vector: Float32Array): Promise<string>;
  insertBatch(entries: readonly KbVectorEntry[]): Promise<readonly string[]>;
  search(vector: Float32Array, k: number): Promise<readonly KbSearchResult[]>;
  len(): Promise<number>;
  isEmpty(): Promise<boolean>;
  deleteId(id: string): Promise<boolean>;

  /** Optional — `null` on backends that don't expose health (e.g., router). */
  health(): KbHealthReport | null;
  /** Optional — `null` on backends that don't expose metrics. */
  metrics(): string | null;
  /** Optional — `null` on backends that don't expose a version string. */
  version(): string | null;

  close(): Promise<void>;
}

export interface KbBackendSmokeCheckable {
  smokeCheck(options: { dimensions?: number; bindingPath?: string }): Promise<readonly CheckResult[]>;
}
