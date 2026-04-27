/**
 * Shared reducer for archetype `getValueReport()` and `introspect()`.
 *
 * The pattern was inlined separately in three archetypes (GraphReasoner,
 * KnowledgeBase, TimeSeriesMemory) across M6.2 → M7 → M8 because the
 * abstraction was deliberately deferred until enough sample points
 * confirmed the shape was stable. Three archetypes converged on the
 * same structure with zero per-archetype variation in the reducer
 * body — the M8.2 extraction.
 *
 * Each archetype owns its `CAPABILITY_CATALOG` (data + ADR refs +
 * dormant-default text) and its own state (invocation counts, cached
 * health). The reducer here is pure: catalog × cached health ×
 * invocation counts → ValueReport / Pipeline.
 */

import type { HealthCheckResult } from './health.js';
import type { Pipeline } from './pipeline.js';
import type {
  ActiveCapability,
  DormantCapability,
  ValueReport,
} from './value-report.js';

export type CapabilityCatalogEntry = {
  /** Stable capability ID (e.g. `cypher`, `kHopTraversal`, `vectorSearch`). */
  readonly name: string;
  /** Source crate name from the M3 catalog (e.g. `ruvector-graph`). */
  readonly source: string;
  /** ADR IDs that document this capability. */
  readonly adrs?: readonly string[];
  /** Optional probe name from `smokeCheck` / archetype-tier probes. */
  readonly probeName?: string;
  /** Status when no observation is available. */
  readonly defaultStatus: 'active' | 'dormant';
  /** Free-form dormant reason used when no observation available. */
  readonly defaultDormantReason?: string;
  readonly defaultDormantLift?: string;
  readonly defaultDormantEnable?: string;
  /** Maps an `invocationCounts` key to populate `ActiveCapability.invocations`. */
  readonly invocationKey?: string;
};

export interface ReducerInputs {
  readonly catalog: readonly CapabilityCatalogEntry[];
  readonly lastHealth: HealthCheckResult | null;
  readonly invocationCounts: ReadonlyMap<string, number>;
}

export function reduceValueReport(inputs: ReducerInputs): ValueReport {
  const { catalog, lastHealth, invocationCounts } = inputs;
  const inv = (key: string | undefined) => (key ? invocationCounts.get(key) ?? 0 : 0);
  const lastChecks = lastHealth?.checks ?? [];
  const probesByName = new Map(lastChecks.map((c) => [c.name, c]));

  const active: ActiveCapability[] = [];
  const dormant: DormantCapability[] = [];
  let probedCount = 0;
  let unprobedCount = 0;

  for (const cap of catalog) {
    const probe = cap.probeName ? probesByName.get(cap.probeName) : undefined;
    const isObserved = probe !== undefined;
    if (isObserved) probedCount++;
    else unprobedCount++;

    const observedActive = probe?.status === 'ok';
    const observedDormant = probe && probe.status !== 'ok';
    const isActive = observedActive || (!observedDormant && cap.defaultStatus === 'active');

    if (isActive) {
      active.push({
        name: cap.name,
        source: cap.source,
        invocations: inv(cap.invocationKey),
        ...(cap.adrs && { adrs: cap.adrs }),
      });
      continue;
    }

    const reason = observedDormant && probe
      ? `[observed via probe '${probe.name}', status=${probe.status}] ${probe.detail ?? '(no detail)'}`
      : (cap.defaultDormantReason ?? 'No reason recorded.');
    dormant.push({
      name: cap.name,
      source: cap.source,
      reason,
      expectedLift: cap.defaultDormantLift ?? 'Lift not documented.',
      enable: cap.defaultDormantEnable ?? 'See archetype documentation.',
      ...(cap.adrs && { adrs: cap.adrs }),
    });
  }

  const healthSource: ValueReport['healthSource'] =
    probedCount === 0 ? 'declared'
      : unprobedCount === 0 ? 'observed'
        : 'mixed';

  const totalCaps = catalog.length;
  const sourceTag = healthSource === 'observed' ? 'observed'
    : healthSource === 'declared' ? 'declared (run healthCheck() for live data)'
      : `mixed (${probedCount}/${totalCaps} observed)`;
  const summary = `${active.length} of ${totalCaps} unique capabilities active. ${dormant.length} dormant — ${sourceTag}.`;

  const result: ValueReport = {
    generatedAt: new Date().toISOString(),
    active,
    dormant,
    summary,
    healthSource,
    ...(lastHealth && { lastHealthCheckAt: lastHealth.generatedAt }),
  };
  return result;
}

export function reduceIntrospect(
  archetypeName: string,
  inputs: Pick<ReducerInputs, 'catalog' | 'lastHealth'>,
): Pipeline {
  const { catalog, lastHealth } = inputs;
  const lastChecks = lastHealth?.checks ?? [];
  const probesByName = new Map(lastChecks.map((c) => [c.name, c]));
  // Compute each capability's currently-active state once. `stages` is the
  // active subset; `capabilities` carries the same flag plus the dormant rest.
  // M8.2 unification: stages used to differ across archetypes (GR filtered by
  // probeName, KB/TSM filtered by defaultStatus). Now both follow the same
  // post-observation overlay so introspect.stages always equals the active
  // capabilities reported by getValueReport — eliminating drift.
  const annotated = catalog.map((c) => {
    const probe = c.probeName ? probesByName.get(c.probeName) : undefined;
    const observedActive = probe?.status === 'ok';
    const observedDormant = probe && probe.status !== 'ok';
    const active = observedActive || (!observedDormant && c.defaultStatus === 'active');
    return { entry: c, active };
  });
  return {
    archetype: archetypeName,
    stages: annotated
      .filter((a) => a.active)
      .map((a) => ({
        name: a.entry.name,
        source: a.entry.source,
        required: false,
      })),
    capabilities: annotated.map((a) => ({
      name: a.entry.name,
      source: a.entry.source,
      active: a.active,
      ...(a.entry.adrs && { adrs: a.entry.adrs }),
    })),
  };
}
