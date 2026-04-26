/**
 * Per-result trace of which capabilities contributed.
 *
 * Every archetype's result type carries this. The type is the same across
 * archetypes, but `path` and `stages` will differ. Designed to be human-readable
 * when console.log'd AND machine-readable for dev tools.
 */
export interface ExplainTrace {
  /** Pipeline stage names in execution order. e.g. ['embed', 'hybrid', 'rrf', 'leiden', 'colbert-rerank']. */
  readonly path: readonly string[];

  /** Per-stage detail (same length as `path`). */
  readonly stages: readonly ExplainStage[];

  /** Capability-attributed score lift. May be empty if the run did not measure attribution. */
  readonly capabilities: readonly CapabilityContribution[];

  readonly totalLatencyMs: number;
}

export interface ExplainStage {
  readonly name: string;
  /** Source crate name from the M3 catalog (e.g. `ruvector-graph`). */
  readonly source: string;
  readonly durationMs: number;
  /** Free-form note (e.g. "fused 247 candidates with RRF"). */
  readonly note?: string;
}

export interface CapabilityContribution {
  /** Stable ID of the capability (e.g. `sona`, `graph-rag`, `colbert-rerank`). */
  readonly name: string;
  readonly source: string;
  /** Estimated relative lift, in [0, 1], or `null` if attribution wasn't computed. */
  readonly estimatedLift: number | null;
  readonly note?: string;
}
