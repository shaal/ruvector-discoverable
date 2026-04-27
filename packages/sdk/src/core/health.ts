/**
 * Backend health-check infrastructure.
 *
 * Motivated by M6 v0.1: the upstream Cypher engine in @ruvector/graph-node@2.0.3
 * loads cleanly and exports `query()`, but the implementation is a stub that
 * always returns empty results. M6's scoping pass treated "binding loads" as
 * readiness; the demo's first run exposed the gap.
 *
 * Going forward, every adapter implements `smokeCheck()` which runs against an
 * isolated probe instance (NOT the user's data) and reports per-capability
 * functional status. The archetype exposes the aggregated result via
 * `healthCheck()`. v0.2 will wire detected results into `getValueReport()` so
 * dormant detection is dynamic, not hardcoded.
 */

export type CheckStatus =
  /** Method exists, was invoked, and produced a correct-looking result. */
  | 'ok'
  /** Method exists and ran but returned wrong/empty output for known input. */
  | 'broken'
  /** Method does not exist on this binding version. */
  | 'unsupported'
  /** Invocation threw an unexpected error. */
  | 'error';

export interface CheckResult {
  /** Stable capability ID. */
  readonly name: string;
  readonly status: CheckStatus;
  /** Human-readable diagnostic — surfaced in summaries and reports. */
  readonly detail?: string;
  readonly durationMs: number;
}

export interface HealthCheckResult {
  /** Archetype name, e.g. `'GraphReasoner'`. */
  readonly archetype: string;
  /** Backend kind that ran the checks. */
  readonly backend: 'native' | 'wasm' | 'http';
  /** Per-capability results in execution order. */
  readonly checks: readonly CheckResult[];
  /** Counts of each status across `checks`. */
  readonly statusCounts: Readonly<Record<CheckStatus, number>>;
  /** One-line synopsis suitable for logging. */
  readonly summary: string;
  readonly totalDurationMs: number;
  /** ISO-8601 timestamp. */
  readonly generatedAt: string;
}

export interface HealthCheckProvider {
  healthCheck(): Promise<HealthCheckResult>;
}

/** Helper: build a `HealthCheckResult` from a list of `CheckResult`. */
export function summarize(
  archetype: string,
  backend: HealthCheckResult['backend'],
  checks: readonly CheckResult[],
): HealthCheckResult {
  const counts: Record<CheckStatus, number> = { ok: 0, broken: 0, unsupported: 0, error: 0 };
  let total = 0;
  for (const c of checks) {
    counts[c.status]++;
    total += c.durationMs;
  }
  const partsList: string[] = [];
  if (counts.ok)         partsList.push(`${counts.ok} ok`);
  if (counts.broken)     partsList.push(`${counts.broken} broken`);
  if (counts.unsupported) partsList.push(`${counts.unsupported} unsupported`);
  if (counts.error)      partsList.push(`${counts.error} error`);
  return {
    archetype,
    backend,
    checks,
    statusCounts: counts,
    summary: `${archetype}/${backend}: ${partsList.join(', ') || 'no checks'} (${total.toFixed(2)}ms)`,
    totalDurationMs: total,
    generatedAt: new Date().toISOString(),
  };
}

/** Helper: time a single check and produce a `CheckResult`. */
export async function runCheck(
  name: string,
  fn: () => Promise<{ status: CheckStatus; detail?: string }>,
): Promise<CheckResult> {
  const start = performance.now();
  try {
    const result = await fn();
    return {
      name,
      status: result.status,
      ...(result.detail !== undefined && { detail: result.detail }),
      durationMs: performance.now() - start,
    };
  } catch (e) {
    return {
      name,
      status: 'error',
      detail: e instanceof Error ? e.message : String(e),
      durationMs: performance.now() - start,
    };
  }
}
