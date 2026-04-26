/**
 * Static (non-running) introspection of an archetype's wired pipeline.
 * Returned by `archetype.introspect()`. Useful for tooling and the doctor CLI;
 * also for assertion in tests ("ensure SONA is wired").
 */

export interface Pipeline {
  /** Archetype name, e.g. `'KnowledgeBase'`. */
  readonly archetype: string;
  /** Stages that will run on the default code path. */
  readonly stages: readonly PipelineStage[];
  /** Capabilities the pipeline depends on (active or optional). */
  readonly capabilities: readonly PipelineCapability[];
}

export interface PipelineStage {
  readonly name: string;
  /** Source crate name from the M3 catalog. */
  readonly source: string;
  /** Whether the stage is required (failure aborts the run) or optional. */
  readonly required: boolean;
}

export interface PipelineCapability {
  readonly name: string;
  readonly source: string;
  /** Whether the capability is wired in (active) or just declared as available. */
  readonly active: boolean;
  /** ADR IDs documenting this capability. */
  readonly adrs?: readonly string[];
}
