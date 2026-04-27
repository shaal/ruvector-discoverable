/**
 * The "what are you NOT using" report. Each archetype implements
 * {@link ValueReportProvider#getValueReport} so a developer can see at a glance
 * which unique-to-RuVector capabilities are dormant in their integration —
 * directly addressing the discoverability problem in PRD §1.
 */

export interface ValueReport {
  /** ISO-8601 timestamp of when this report was generated. */
  readonly generatedAt: string;
  /** Capabilities currently active in the wired pipeline. */
  readonly active: readonly ActiveCapability[];
  /** Capabilities upstream supports for this archetype but the user hasn't enabled. */
  readonly dormant: readonly DormantCapability[];
  /**
   * Optional headline summary, e.g. "3 of 7 unique capabilities active".
   * Populated when the report is generated; consumers may also derive their own.
   */
  readonly summary?: string;
  /**
   * Whether the dormant list was derived from observation (a recent healthCheck),
   * from static declaration, or a mix of both. Lets consumers tell "we measured this"
   * apart from "we said this in code." See M6.2.
   */
  readonly healthSource: 'observed' | 'declared' | 'mixed';
  /**
   * ISO-8601 timestamp of the healthCheck whose results this report consulted,
   * if any. Absent when `healthSource` is `'declared'`.
   */
  readonly lastHealthCheckAt?: string;
}

export interface ActiveCapability {
  /** Stable ID (e.g. `hybrid-search`). */
  readonly name: string;
  /** Source crate name from the M3 catalog. */
  readonly source: string;
  /** How many invocations this archetype has handled with this capability. */
  readonly invocations: number;
  /** ADR IDs that document this capability, where known. */
  readonly adrs?: readonly string[];
}

/**
 * Why a capability is dormant. Two-tier classification (M9.1):
 *
 * - `upstream-binding`: the upstream binding doesn't expose this surface at
 *   all. Action: wait for upstream to publish the NAPI/WASM/HTTP method.
 * - `upstream-bug`: the binding exposes the surface but observation shows it's
 *   broken (e.g. M6's Cypher stub). Action: file upstream OR wait for fix.
 * - `sdk-integration`: the SDK could wire this with currently-available
 *   bindings but hasn't yet. Action: this is on the SDK roadmap, not blocked
 *   on anyone else. (M9 v0.1 demonstrated `graphRag` flipping from this
 *   category to active by SDK-side integration alone.)
 * - `design-deferred`: intentionally out of scope for the current SDK
 *   milestone — a deliberate "not yet" rather than a missing piece.
 */
export type DormantBlocker =
  | 'upstream-binding'
  | 'upstream-bug'
  | 'sdk-integration'
  | 'design-deferred';

export interface DormantCapability {
  readonly name: string;
  readonly source: string;
  /** Why it's dormant. e.g. "No feedback signal recorded in 7 days". */
  readonly reason: string;
  /** Free-form prose. e.g. "15-25% lift on repeat queries". */
  readonly expectedLift: string;
  /** One-line code hint to enable. e.g. "kb.recordFeedback(queryId, { score: 1 })". */
  readonly enable: string;
  /** ADR IDs that document this capability, where known. */
  readonly adrs?: readonly string[];
  /**
   * What category of work unblocks this capability. Derived from probe status
   * when observed (broken→upstream-bug, unsupported→upstream-binding) or from
   * the catalog entry's `defaultDormantBlocker` otherwise. See {@link DormantBlocker}.
   */
  readonly blocker: DormantBlocker;
}

export interface ValueReportProvider {
  getValueReport(): Promise<ValueReport>;
}
