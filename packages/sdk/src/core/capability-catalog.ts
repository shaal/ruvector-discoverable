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
  DormantBlocker,
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
  /**
   * What unblocks this capability when no probe observation overrides. M9.1
   * classification: `upstream-binding` waits for upstream NAPI publishing,
   * `upstream-bug` for an upstream fix, `sdk-integration` for SDK work,
   * `design-deferred` for an intentional v0.2+ scope decision.
   * Defaults to `sdk-integration` if unset (the most actionable category).
   */
  readonly defaultDormantBlocker?: DormantBlocker;
  /**
   * **M30** — override the blocker classification when a probe returns
   * `broken` or `error`. Default: `upstream-bug` (current behavior; the
   * binding-tier convention — a probe that fails is upstream's defect).
   *
   * Set this for SDK-source archetype-tier probes whose failure modes are
   * user-misconfig rather than upstream defects. M29's textPersistence
   * round-trip probe is the load-bearing example: an unwriteable
   * user-storage path produces `broken` with an `EACCES` detail, but the
   * actionable category is `sdk-integration` (user fixes their config),
   * not `upstream-bug` (no upstream change would help).
   *
   * Applies only to broken/error. The unsupported and active-with-no-probe
   * branches continue to use `defaultDormantBlocker`.
   */
  readonly dormantBlockerOnBroken?: DormantBlocker;
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

    // Derive blocker. Probe observation wins when present:
    //   broken      → binding does the wrong thing (upstream-bug)
    //   error       → binding crashed (treat as upstream-bug)
    //   unsupported → binding (or feature) isn't wired. The catalog's
    //                 `defaultDormantBlocker` is more accurate than a generic
    //                 'upstream-binding' for archetype-tier probes that signal
    //                 "user didn't opt in" (M11.2 autoEmbed pattern). When no
    //                 default is declared, `upstream-binding` remains the
    //                 sensible fallback for binding-tier "method not exposed".
    // Otherwise use the entry's declared default; fall back to sdk-integration
    // (the most actionable category — if untagged, it's likely SDK work).
    let blocker: DormantBlocker;
    if (probe?.status === 'broken' || probe?.status === 'error') {
      // M30: per-row override for SDK-source archetype probes whose
      // failure modes are user-misconfig (sdk-integration) rather than
      // upstream defects (upstream-bug, the binding-tier default).
      blocker = cap.dormantBlockerOnBroken ?? 'upstream-bug';
    } else if (probe?.status === 'unsupported') {
      blocker = cap.defaultDormantBlocker ?? 'upstream-binding';
    } else {
      blocker = cap.defaultDormantBlocker ?? 'sdk-integration';
    }

    dormant.push({
      name: cap.name,
      source: cap.source,
      reason,
      expectedLift: cap.defaultDormantLift ?? 'Lift not documented.',
      enable: cap.defaultDormantEnable ?? 'See archetype documentation.',
      blocker,
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

  // Break dormant down by blocker — surfaces which dormant entries are
  // SDK-actionable vs upstream-blocked.
  const blockerCounts: Record<DormantBlocker, number> = {
    'upstream-binding': 0,
    'upstream-bug': 0,
    'sdk-integration': 0,
    'design-deferred': 0,
  };
  for (const d of dormant) blockerCounts[d.blocker]++;
  const blockerParts: string[] = [];
  if (blockerCounts['upstream-binding']) blockerParts.push(`${blockerCounts['upstream-binding']} upstream-binding`);
  if (blockerCounts['upstream-bug'])     blockerParts.push(`${blockerCounts['upstream-bug']} upstream-bug`);
  if (blockerCounts['sdk-integration'])  blockerParts.push(`${blockerCounts['sdk-integration']} sdk-integration`);
  if (blockerCounts['design-deferred'])  blockerParts.push(`${blockerCounts['design-deferred']} design-deferred`);
  const blockerTag = blockerParts.length > 0 ? ` (${blockerParts.join(', ')})` : '';

  const summary = `${active.length} of ${totalCaps} unique capabilities active. ${dormant.length} dormant${blockerTag} — ${sourceTag}.`;

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
