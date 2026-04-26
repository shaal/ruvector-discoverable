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
}

export interface ValueReportProvider {
  getValueReport(): Promise<ValueReport>;
}
