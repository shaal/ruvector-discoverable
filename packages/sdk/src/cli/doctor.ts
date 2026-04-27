/**
 * `doctor` — introspect a running SDK config and report degradations.
 *
 * **M15.1 Phase-1A** — first CLI subcommand. Pure presentation layer over
 * each archetype's existing `healthCheck()` + `getValueReport()` output;
 * no new SDK introspection logic. Per the M15 scoping doc:
 *
 *   "The SDK already produces every input doctor needs."
 *
 * Walks an object returned by `createSdk()` from a user-supplied config
 * file, awaits both methods on each value that implements
 * `HealthCheckProvider & ValueReportProvider`, formats the output, and
 * aggregates active/dormant counts across archetypes.
 *
 * Per M15 §6 Q4 ratification: loads the user's TS config via Node's
 * native dynamic `import()`. If Node's TS-strip support isn't available
 * (older Node versions), exits with an actionable error pointing at
 * `npx tsx`. No hard dependency on `tsx`.
 */

import type { HealthCheckProvider, HealthCheckResult } from '../core/health.js';
import type { ValueReport, ValueReportProvider, DormantBlocker } from '../core/value-report.js';
import { resolve as resolvePath } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

interface CombinedProvider {
  healthCheck(): Promise<HealthCheckResult>;
  getValueReport(): Promise<ValueReport>;
  close?(): Promise<void>;
}

interface DoctorOptions {
  /** Path to the user's config (typically `ruvector.config.ts`). */
  readonly configPath: string;
  /** Stream for output; default: process.stdout. Useful for tests. */
  readonly out?: NodeJS.WritableStream;
}

interface ArchetypeReport {
  readonly name: string;
  readonly health: HealthCheckResult;
  readonly value: ValueReport;
}

/** Run doctor end-to-end. Returns the gathered reports for programmatic use. */
export async function runDoctor(options: DoctorOptions): Promise<readonly ArchetypeReport[]> {
  const out = options.out ?? process.stdout;
  const write = (s: string): void => { out.write(s + '\n'); };

  const absPath = resolvePath(process.cwd(), options.configPath);
  if (!existsSync(absPath)) {
    write(`✗ doctor: config file not found at ${absPath}`);
    throw new DoctorError('CONFIG_NOT_FOUND', `Config file not found: ${absPath}`);
  }
  write(`Loading config from ${options.configPath}...`);

  // M15 §6 Q4 — native dynamic import; tsx fallback on TS-strip absence.
  let mod: { createSdk?: () => Promise<Record<string, unknown>> | Record<string, unknown> };
  try {
    mod = await import(pathToFileURL(absPath).href) as typeof mod;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Unknown file extension|TypeScript|cannot find|--experimental-strip-types/i.test(msg)) {
      write(`✗ doctor: failed to import ${options.configPath}.`);
      write(`  Native TS-strip not available in this Node (${process.version}).`);
      write(`  Workarounds:`);
      write(`    1. Run with: npx tsx node_modules/.bin/sdk doctor ${options.configPath}`);
      write(`    2. Build the config to JS first: tsc ${options.configPath} --outDir .doctor-tmp && doctor .doctor-tmp/$(basename ${options.configPath} .ts).js`);
      write(`    3. Upgrade to Node 22.6+ which supports --experimental-strip-types.`);
      throw new DoctorError('IMPORT_FAILED', `Cannot import ${absPath}: ${msg}`);
    }
    throw new DoctorError('IMPORT_FAILED', `Cannot import ${absPath}: ${msg}`);
  }

  if (typeof mod.createSdk !== 'function') {
    write(`✗ doctor: config does not export \`createSdk\`. Expected: export async function createSdk() { ... }`);
    throw new DoctorError('CONFIG_SHAPE_INVALID', 'Config must export an async createSdk() function.');
  }
  const sdk = await mod.createSdk();
  if (typeof sdk !== 'object' || sdk === null) {
    write(`✗ doctor: createSdk() did not return an object. Got: ${typeof sdk}`);
    throw new DoctorError('CONFIG_SHAPE_INVALID', `createSdk() returned ${typeof sdk}; expected object.`);
  }
  write('');

  // Walk the returned object; pick out values that implement both
  // HealthCheckProvider and ValueReportProvider. Other values (configs,
  // raw bindings) are silently skipped — doctor only reports on
  // archetypes-shaped things.
  const reports: ArchetypeReport[] = [];
  for (const [key, value] of Object.entries(sdk)) {
    if (!isCombinedProvider(value)) continue;
    const archetypeName = (value as { constructor?: { name?: string } }).constructor?.name ?? key;
    const health = await value.healthCheck();
    const valueReport = await value.getValueReport();
    reports.push({ name: archetypeName, health, value: valueReport });
  }

  if (reports.length === 0) {
    write('✗ doctor: createSdk() returned no archetype-shaped values.');
    write('  An archetype must implement both healthCheck() and getValueReport().');
    write('  Check that you are returning instances created via Archetype.create({ ... }).');
    return [];
  }

  // Per-archetype rendering.
  for (const r of reports) {
    write(`${r.name}:`);
    write(`  ${r.health.summary}`);
    for (const c of r.health.checks) {
      const icon = healthIcon(c.status);
      write(`    ${icon} ${c.name.padEnd(28)} ${c.status.padEnd(12)} ${c.detail ?? ''}`);
    }
    write('');
  }

  // Cross-archetype aggregation.
  let totalActive = 0;
  let totalDormant = 0;
  const blockerCounts: Record<DormantBlocker, number> = {
    'upstream-binding': 0,
    'upstream-bug': 0,
    'sdk-integration': 0,
    'design-deferred': 0,
  };
  const suggestions: string[] = [];
  for (const r of reports) {
    totalActive += r.value.active.length;
    totalDormant += r.value.dormant.length;
    for (const d of r.value.dormant) blockerCounts[d.blocker]++;
    // Suggestions: surface the dormant entries' M11.2/M13.1 `enable` strings
    // verbatim — these already say "do X to flip this to active."
    for (const d of r.value.dormant) {
      if (d.blocker === 'sdk-integration') {
        suggestions.push(`  • [${r.name}.${d.name}] ${d.enable}`);
      }
    }
  }
  write(`Aggregate value report (${reports.length} archetype${reports.length === 1 ? '' : 's'}):`);
  write(`  ${totalActive + totalDormant} unique capabilities total: ${totalActive} active, ${totalDormant} dormant.`);
  const breakdown = formatBlockerBreakdown(blockerCounts);
  if (breakdown) write(`  Dormant breakdown: ${breakdown}.`);
  write('');

  if (suggestions.length > 0) {
    write(`Suggestions (${suggestions.length}):`);
    for (const s of suggestions) write(s);
    write('');
  } else {
    write(`No SDK-integration suggestions — every dormant capability is upstream-blocked or design-deferred.`);
    write('');
  }

  // Best-effort cleanup.
  for (const r of reports) {
    const provider = (sdk as Record<string, unknown>)[r.name.charAt(0).toLowerCase() + r.name.slice(1)];
    if (provider && typeof (provider as { close?: () => Promise<void> }).close === 'function') {
      try { await (provider as { close: () => Promise<void> }).close(); } catch {/* ignore */}
    }
  }
  // Generic walk of all values for close (covers cases where the entry-key
  // doesn't match the archetype-name camelCase).
  for (const value of Object.values(sdk)) {
    if (typeof (value as { close?: () => Promise<void> }).close === 'function') {
      try { await (value as { close: () => Promise<void> }).close(); } catch {/* ignore */}
    }
  }

  return reports;
}

// ---------------- Internals ----------------

function isCombinedProvider(v: unknown): v is CombinedProvider {
  return v !== null
    && typeof v === 'object'
    && typeof (v as { healthCheck?: unknown }).healthCheck === 'function'
    && typeof (v as { getValueReport?: unknown }).getValueReport === 'function';
}

function healthIcon(status: HealthCheckResult['checks'][number]['status']): string {
  switch (status) {
    case 'ok': return '✓';
    case 'broken': return '✗';
    case 'unsupported': return '·';
    case 'error': return '!';
    default: return '?';
  }
}

function formatBlockerBreakdown(counts: Record<DormantBlocker, number>): string {
  const parts: string[] = [];
  if (counts['upstream-binding']) parts.push(`${counts['upstream-binding']} upstream-binding`);
  if (counts['upstream-bug'])     parts.push(`${counts['upstream-bug']} upstream-bug`);
  if (counts['sdk-integration'])  parts.push(`${counts['sdk-integration']} sdk-integration`);
  if (counts['design-deferred'])  parts.push(`${counts['design-deferred']} design-deferred`);
  return parts.join(', ');
}

class DoctorError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'DoctorError';
  }
}

export { DoctorError };

// Implementor declares that we're exporting a `ValueReportProvider` shape
// the helper imports purely as a type — keeps the unused-import lint clean.
type _Implements = HealthCheckProvider & ValueReportProvider;
void ({} as _Implements);
