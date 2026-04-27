/**
 * `audit` — compare a config against best-practice for its workload.
 *
 * **M15.3 Phase-2** — third and final CLI subcommand. Closes the PRD §5.5
 * three-subcommand surface (`recommend` + `doctor` + `audit`).
 *
 * Audit reads the user's `ruvector.config.ts`'s exported `_meta` (workload
 * key + answers, baked in by `recommend`), compares the runtime-instantiated
 * `createSdk()` result against the WORKLOADS table's recommended template
 * for that workload, and surfaces three drift categories:
 *
 *   (a) missing-archetype — recommended but not in createSdk's return
 *   (b) extra-archetype   — in createSdk's return but not in the workload's recommended set
 *   (c) missing-coupling  — KB/AM/AF wired without their recommended cross-archetype DI
 *
 * Plus configuration-quality checks against the live `healthCheck` /
 * `getValueReport` output: dormant entries with `sdk-integration` blocker
 * surface as "you could enable this; here's how" suggestions, lifted
 * verbatim from each catalog row's `enable` string (M11.2/M13.1 pattern).
 *
 * Audit is non-destructive — never modifies the user's config. The output
 * names what the user could change; the user decides whether to act.
 */

import { existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { HealthCheckResult, HealthCheckProvider } from '../core/health.js';
import type { ValueReport, ValueReportProvider, DormantBlocker } from '../core/value-report.js';
import { findWorkload, type Archetype, type WorkloadRecommendation } from './workloads.js';

interface CombinedProvider {
  healthCheck(): Promise<HealthCheckResult>;
  getValueReport(): Promise<ValueReport>;
  close?(): Promise<void>;
}

export interface AuditOptions {
  readonly configPath: string;
  readonly out?: NodeJS.WritableStream;
}

export interface AuditDrift {
  readonly kind: 'missing-archetype' | 'extra-archetype' | 'missing-coupling' | 'sdk-integration-suggestion';
  readonly archetype?: Archetype | string;
  readonly capability?: string;
  readonly detail: string;
  readonly remediation: string;
}

export interface AuditReport {
  readonly workload: string | null;
  readonly recommended: readonly Archetype[];
  readonly observed: readonly string[];
  readonly drifts: readonly AuditDrift[];
}

/** Run audit end-to-end. Returns the gathered report for programmatic use. */
export async function runAudit(options: AuditOptions): Promise<AuditReport> {
  const out = options.out ?? process.stdout;
  const write = (s: string): void => { out.write(s + '\n'); };

  const absPath = resolvePath(process.cwd(), options.configPath);
  if (!existsSync(absPath)) {
    write(`✗ audit: config file not found at ${absPath}`);
    throw new AuditError('CONFIG_NOT_FOUND', `Config file not found: ${absPath}`);
  }
  write(`Loading config from ${options.configPath}...`);

  let mod: { createSdk?: () => Promise<Record<string, unknown>> | Record<string, unknown>; _meta?: { workload?: string; answers?: unknown; rationale?: string } };
  try {
    mod = await import(pathToFileURL(absPath).href) as typeof mod;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Unknown file extension|TypeScript|cannot find|--experimental-strip-types/i.test(msg)) {
      write(`✗ audit: failed to import ${options.configPath}.`);
      write(`  Native TS-strip not available in this Node (${process.version}).`);
      write(`  Workarounds:`);
      write(`    1. Run with: npx tsx node_modules/.bin/sdk audit ${options.configPath}`);
      write(`    2. Build the config to JS first: tsc ${options.configPath} --outDir .audit-tmp && audit .audit-tmp/$(basename ${options.configPath} .ts).js`);
      write(`    3. Upgrade to Node 22.6+ which supports --experimental-strip-types.`);
      throw new AuditError('IMPORT_FAILED', `Cannot import ${absPath}: ${msg}`);
    }
    throw new AuditError('IMPORT_FAILED', `Cannot import ${absPath}: ${msg}`);
  }

  if (typeof mod.createSdk !== 'function') {
    write(`✗ audit: config does not export \`createSdk\`. Expected: export async function createSdk() { ... }`);
    throw new AuditError('CONFIG_SHAPE_INVALID', 'Config must export an async createSdk() function.');
  }

  // _meta.workload is the audit anchor — without it, we don't know what
  // template to compare against. Configs from `sdk recommend` (M15.2) bake
  // it in automatically; hand-written configs need to add it explicitly.
  const meta = mod._meta;
  const workloadKey = meta?.workload;
  if (!workloadKey) {
    write('');
    write('⚠ audit: config does not export `_meta.workload`.');
    write('  Audit needs `_meta = { workload: "<key>" }` to know which best-practice template to compare against.');
    write('  Either:');
    write('    (a) regenerate the config via `sdk recommend` (M15.2 bakes _meta automatically), OR');
    write('    (b) add `export const _meta = { workload: "<key>" }` to your existing config.');
    write(`  Workload keys: ${require_keys().join(', ')}`);
    return { workload: null, recommended: [], observed: [], drifts: [] };
  }
  const recommendation = findWorkload(workloadKey);
  if (!recommendation) {
    write(`✗ audit: \`_meta.workload\` is "${workloadKey}" but that's not a known workload key.`);
    write(`  Known: ${require_keys().join(', ')}`);
    throw new AuditError('UNKNOWN_WORKLOAD', `Unknown workload: ${workloadKey}`);
  }

  const sdk = await mod.createSdk();
  if (typeof sdk !== 'object' || sdk === null) {
    write(`✗ audit: createSdk() did not return an object. Got: ${typeof sdk}`);
    throw new AuditError('CONFIG_SHAPE_INVALID', `createSdk() returned ${typeof sdk}; expected object.`);
  }

  // Map createSdk's return values to archetype names via the constructor name.
  // The recommend codegen uses short names (`llm`, `kb`, etc.) — we don't
  // assume a particular key naming, we look at the values' constructor.name.
  const observedArchetypes = new Map<string, CombinedProvider>();
  for (const [key, value] of Object.entries(sdk)) {
    if (!isCombinedProvider(value)) continue;
    const ctorName = (value as { constructor?: { name?: string } }).constructor?.name ?? key;
    observedArchetypes.set(ctorName, value);
  }

  write('');
  write(`Workload: ${recommendation.key}  —  "${recommendation.headline}"`);
  write('');

  const drifts: AuditDrift[] = [];
  const recommendedSet = new Set<string>(recommendation.archetypes);
  const observedSet = new Set<string>(observedArchetypes.keys());

  // (a) missing-archetype
  for (const name of recommendation.archetypes) {
    if (!observedSet.has(name)) {
      drifts.push({
        kind: 'missing-archetype',
        archetype: name,
        detail: `'${recommendation.key}' recommends ${name}, but createSdk() did not return one.`,
        remediation: `Add ${name}.create({ ... }) to createSdk() and include it in the returned object.`,
      });
    }
  }

  // (b) extra-archetype
  for (const name of observedSet) {
    if (!recommendedSet.has(name)) {
      drifts.push({
        kind: 'extra-archetype',
        archetype: name,
        detail: `createSdk() returns ${name}, but '${recommendation.key}' does not recommend it.`,
        remediation: `Remove ${name} from createSdk(), OR change \`_meta.workload\` to one that includes it.`,
      });
    }
  }

  // (c) missing-coupling — surfaced via getValueReport's dormant rows. If
  // the workload's coupling list says "KB ← LocalLLM" but KB's value report
  // shows autoEmbed dormant `[sdk-integration]`, the user wired KB without
  // the embedder. The dormant `enable` string is the actionable advice.
  // Since coupling state isn't directly inspectable from outside, we use
  // the value-report as the authoritative source.
  const valueReports = new Map<string, ValueReport>();
  for (const [name, provider] of observedArchetypes) {
    await provider.healthCheck();
    valueReports.set(name, await provider.getValueReport());
  }
  for (const c of recommendation.couplings) {
    if (!observedSet.has(c.from)) continue;
    const vr = valueReports.get(c.from);
    if (!vr) continue;
    // The coupling is "implemented" when the relevant capability rows are
    // active. e.g., KB ← LocalLLM means KB's autoEmbed should be active.
    // KB ← GraphReasoner means graphRag should be active. These names map
    // 1-to-1 to dormant rows in the catalog; surface any that are still
    // sdk-integration-blocked.
    for (const inj of c.injects) {
      const expectedCapName = expectedCouplingCapability(c.from, inj);
      if (!expectedCapName) continue;
      const dormantRow = vr.dormant.find((d) => d.name === expectedCapName);
      if (dormantRow && dormantRow.blocker === 'sdk-integration') {
        drifts.push({
          kind: 'missing-coupling',
          archetype: c.from,
          capability: expectedCapName,
          detail: `${c.from} is wired but its coupling to ${inj} is missing (${c.from}.${expectedCapName} is dormant [sdk-integration]).`,
          remediation: dormantRow.enable,
        });
      }
    }
  }

  // (d) sdk-integration suggestions across all observed archetypes — these
  // aren't drift relative to the workload template, but they're actionable
  // configuration-quality wins. Same M11.2/M13.1 surfacing pattern doctor uses.
  for (const [name, vr] of valueReports) {
    for (const d of vr.dormant) {
      if (d.blocker !== 'sdk-integration') continue;
      // De-dupe: don't repeat a row already named in missing-coupling drifts.
      const alreadyNamed = drifts.some((dr) =>
        dr.kind === 'missing-coupling' && dr.archetype === name && dr.capability === d.name,
      );
      if (alreadyNamed) continue;
      drifts.push({
        kind: 'sdk-integration-suggestion',
        archetype: name,
        capability: d.name,
        detail: `${name}.${d.name} is dormant [sdk-integration]: ${d.reason.slice(0, 120)}${d.reason.length > 120 ? '…' : ''}`,
        remediation: d.enable,
      });
    }
  }

  // Output.
  write(`Recommended: ${[...recommendedSet].join(' + ')}`);
  write(`Observed:    ${[...observedSet].join(' + ') || '(none — createSdk returned no archetype-shaped values)'}`);
  write('');

  if (drifts.length === 0) {
    write(`✓ Audit clean — config matches '${recommendation.key}' template.`);
  } else {
    const counts: Record<AuditDrift['kind'], number> = {
      'missing-archetype': 0,
      'extra-archetype': 0,
      'missing-coupling': 0,
      'sdk-integration-suggestion': 0,
    };
    for (const d of drifts) counts[d.kind]++;
    write(`⚠ ${drifts.length} finding${drifts.length === 1 ? '' : 's'}:`);
    write(`    ${counts['missing-archetype']} missing-archetype, ` +
      `${counts['extra-archetype']} extra-archetype, ` +
      `${counts['missing-coupling']} missing-coupling, ` +
      `${counts['sdk-integration-suggestion']} sdk-integration-suggestion`);
    write('');
    for (const d of drifts) {
      const tag = `[${d.kind}]`;
      write(`  ${tag.padEnd(34)} ${d.detail}`);
      write(`    → ${d.remediation}`);
    }
  }

  // Best-effort cleanup.
  for (const provider of observedArchetypes.values()) {
    if (typeof provider.close === 'function') {
      try { await provider.close(); } catch {/* ignore */}
    }
  }

  return {
    workload: recommendation.key,
    recommended: [...recommendedSet] as Archetype[],
    observed: [...observedSet],
    drifts,
  };
}

// ---------------- Internals ----------------

/**
 * Map a coupling (from-archetype, injected-archetype) to the catalog
 * capability name that flips active when the coupling is present. Only
 * the cases that actually exist in the SDK today are listed; others
 * return null (no coupling-quality check possible without inspecting
 * private archetype state, which audit refuses to do).
 */
function expectedCouplingCapability(from: string, inj: string): string | null {
  if (from === 'KnowledgeBase' && inj === 'LocalLLM') return 'autoEmbed';
  if (from === 'KnowledgeBase' && inj === 'GraphReasoner') return 'graphRag';
  if (from === 'TimeSeriesMemory' && inj === 'LocalLLM') return 'autoEmbed';
  if (from === 'GraphReasoner' && inj === 'LocalLLM') return 'autoEmbed';
  if (from === 'AgentMemory' && inj === 'LocalLLM') return 'autoEmbed';
  if (from === 'AgentMemory' && inj === 'GraphReasoner') return 'graphMemory';
  // AgentFramework's couplings to llm/kb/memory/graph map to its own
  // catalog rows: llmInvocation, kbContext, memoryRecall, graphReasoning.
  if (from === 'AgentFramework' && inj === 'LocalLLM') return 'llmInvocation';
  if (from === 'AgentFramework' && inj === 'KnowledgeBase') return 'kbContext';
  if (from === 'AgentFramework' && inj === 'AgentMemory') return 'memoryRecall';
  if (from === 'AgentFramework' && inj === 'GraphReasoner') return 'graphReasoning';
  return null;
}

function isCombinedProvider(v: unknown): v is CombinedProvider {
  return v !== null
    && typeof v === 'object'
    && typeof (v as { healthCheck?: unknown }).healthCheck === 'function'
    && typeof (v as { getValueReport?: unknown }).getValueReport === 'function';
}

function require_keys(): readonly string[] {
  // Lazy import to avoid a top-level cycle if WORKLOADS ever adds runtime helpers.
  return ['rag-over-docs', 'agent-memory', 'graph-reasoning', 'time-series-anomaly', 'local-llm-inference', 'agent-orchestration'];
}

class AuditError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'AuditError';
  }
}

export { AuditError };

// Type-only marker so the imported HealthCheckProvider/ValueReportProvider
// stay live (lint-clean).
type _Implements = HealthCheckProvider & ValueReportProvider;
void ({} as _Implements);

// Type-only marker so the DormantBlocker import stays referenced.
void (null as unknown as DormantBlocker);
