#!/usr/bin/env node
// M11.3 — periodic re-probe of upstream surface contracts.
//
// Why this exists: M11 scoping found that my M6 v0.1 scoping doc claimed
// "@ruvector/ruvllm has no NAPI binding" — already false at the time it was
// written (the umbrella + platform packages were both published on npm).
// The SDK shipped four milestones with that misclassification load-bearing
// in its dormant-capability list.
//
// What this catches:
//
//   1. NPM publication drift — a package classified `upstream-binding`-blocked
//      may have been published since the last scoping pass. Output reclassifies
//      cleanly into m6-scope.md.
//
//   2. CLI surface drift (M11.3 v0.2 — added in M12.3) — an upstream CLI
//      binary's `--help` output may have gained a load-bearing flag/subcommand
//      that the SDK was waiting on (e.g., `ruvllm` shipping a `--model` flag
//      would unblock the deferred Phase 2B CLI subprocess transport), or
//      lost a command the SDK depended on (contract regression).
//
// Re-runnable: dependency-free Node ESM. Probes in parallel, ~3-5s total.
// Exits 0 on no drift, 1 on drift detected — CI can gate on it.
//
// To update the EXPECTED column: re-run the script, ratify changes, then
// edit the relevant table below. Each entry must point at a milestone or
// scoping doc that justifies its expected state.

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
const exec = promisify(execFile);

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');

// =====================================================================
// PROBES — NPM publication status
// =====================================================================
// Last ratified: 2026-04-27 (m11-scope.md). The umbrella @ruvector/ruvllm
// flip from "unpublished" to "published" was the original trigger for
// this tool.
const PROBES = [
  // ===== Positive controls =====
  { pkg: '@ruvector/ruvllm',                expect: 'published',   notes: 'LocalLLM (M11.1+) — drift here = upstream unpublished, very surprising' },
  { pkg: '@ruvector/graph-node',            expect: 'published',   notes: 'GraphReasoner (M6+)' },
  { pkg: '@ruvector/sona',                  expect: 'published',   notes: 'KnowledgeBase SONA (M10+)' },

  // ===== Dormant upstream-binding packages =====
  { pkg: '@ruvector/attention-node',        expect: 'unpublished', notes: 'TimeSeriesMemory.mambaAttention; KnowledgeBase hybridSearch (indirect)' },
  { pkg: '@ruvector/gnn-node',              expect: 'unpublished', notes: 'AgentMemory learned-index (M12+ scope)' },
  { pkg: '@ruvector/diskann-node',          expect: 'unpublished', notes: 'KnowledgeBase advanced/diskann (billion-scale)' },
  { pkg: '@ruvector/solver-node',           expect: 'unpublished', notes: 'GraphReasoner.sublinearPageRank' },
  { pkg: '@ruvector/sparsifier-node',       expect: 'unpublished', notes: 'GraphReasoner.graphSparsifier' },
  { pkg: '@ruvector/mincut-gated-transformer-node', expect: 'unpublished', notes: 'GraphReasoner.mincutGating' },
  { pkg: '@ruvector/temporal-tensor-node',  expect: 'unpublished', notes: 'TimeSeriesMemory.temporalCompression' },
  { pkg: '@ruvector/delta-node',            expect: 'unpublished', notes: 'TimeSeriesMemory.deltaIndexing' },
  { pkg: '@ruvector/tiny-dancer-node',      expect: 'unpublished', notes: 'LocalLLM.tinyDancerRouting' },
  { pkg: '@ruvector/sparse-inference-node', expect: 'unpublished', notes: 'LocalLLM.sparseInference' },
];

// =====================================================================
// CLI_PROBES — CLI surface contracts (M11.3 v0.2 / M12.3)
// =====================================================================
// Last ratified: 2026-04-27 (m12-scope.md M12.2 deferral).
//
// For each binary, runs `<bin> [helpArgs]`, captures stdout+stderr, and
// regex-tests each expectation:
//
//   - `expectAbsent`: substring/regex that should NOT appear in help output.
//      DRIFT if any appears — typically signals upstream shipped a feature
//      the SDK has been waiting on (e.g., `--model` flag → wire Phase 2B).
//
//   - `expectPresent`: substring/regex that should appear. DRIFT if missing
//      — signals contract regression (renamed, removed, or moved subcommand
//      the SDK was already using).
//
// `paths` is checked in order; first that exists is the binary used.
// `notes` names the affected SDK milestone for actionable reclassification.
const CLI_PROBES = [
  {
    bin: 'ruvllm',
    paths: [
      // The umbrella @ruvector/ruvllm ships its bin/cli.js; node_modules/.bin
      // symlinks it. Different node_modules locations depending on hoisting.
      'packages/sdk/node_modules/.bin/ruvllm',
      'node_modules/.bin/ruvllm',
    ],
    helpArgs: ['--help'],
    expectAbsent: [
      // M12.2 finding: these would unblock Phase 2B (deferred until upstream
      // ships any model-loading mechanism). Drift here = good news; wire CLI
      // transport. See docs/upstream-issues/05-no-model-loading-api.md.
      /--model\b/,
      /\bserve\b/,           // subcommand line in commands listing
      /\bload-model\b/,
      /--gguf\b/,
    ],
    expectPresent: [
      // Existing surface the SDK relies on (Phase 2A's NAPI path mirrors
      // these subcommand names). Drift here = contract regression.
      /\bquery\b/,
      /\bgenerate\b/,
      /\broute\b/,
      /\bmodels\b/,           // models list/download/status subgroup
      /\bembed\b/,
      /\bsimilarity\b/,
    ],
    notes: 'M12.2 deferred Phase 2B because none of expectAbsent appeared. Drift on absents → reconsider deferral.',
  },
];

const PROBE_TIMEOUT_MS = 15_000;
const CLI_PROBE_TIMEOUT_MS = 10_000;

// =====================================================================
// NPM probe
// =====================================================================
async function probe(pkg) {
  try {
    const { stdout } = await exec('npm', ['view', pkg, 'version'], {
      timeout: PROBE_TIMEOUT_MS,
    });
    const v = stdout.trim();
    return v ? { status: 'published', version: v } : { status: 'unpublished', version: null };
  } catch (e) {
    if (e.killed || e.code === 'ETIMEDOUT') return { status: 'timeout', version: null };
    const stderr = (e.stderr ?? '').toString();
    if (stderr.includes('404') || stderr.includes('E404') || stderr.includes('not found')) {
      return { status: 'unpublished', version: null };
    }
    return { status: 'error', version: null, errorDetail: stderr.split('\n').slice(-3).join(' ').trim() || e.message };
  }
}

// =====================================================================
// CLI probe
// =====================================================================
function resolveBin(entry) {
  for (const p of entry.paths) {
    const abs = join(REPO_ROOT, p);
    if (existsSync(abs)) return abs;
  }
  return null;
}

async function probeCli(entry) {
  const bin = resolveBin(entry);
  if (bin === null) {
    return {
      status: 'binary-not-found',
      detail: `none of: ${entry.paths.join(', ')}`,
      drifts: [],
    };
  }
  let helpText;
  try {
    const { stdout, stderr } = await exec(bin, entry.helpArgs ?? ['--help'], {
      timeout: CLI_PROBE_TIMEOUT_MS,
      // Some CLIs print help to stderr; concatenate both to match either.
    });
    helpText = `${stdout}\n${stderr}`;
  } catch (e) {
    if (e.killed || e.code === 'ETIMEDOUT') {
      return { status: 'timeout', detail: `${bin} --help timed out`, drifts: [] };
    }
    // Some CLIs exit non-zero on `--help`; their stdout/stderr is still useful.
    const stdout = (e.stdout ?? '').toString();
    const stderr = (e.stderr ?? '').toString();
    if (stdout.length > 0 || stderr.length > 0) {
      helpText = `${stdout}\n${stderr}`;
    } else {
      return { status: 'error', detail: `${bin}: ${e.message.split('\n')[0]}`, drifts: [] };
    }
  }

  const drifts = [];
  for (const pat of entry.expectAbsent ?? []) {
    const re = pat instanceof RegExp ? pat : new RegExp(pat);
    if (re.test(helpText)) {
      drifts.push({ kind: 'absent-appeared', pattern: pat.toString() });
    }
  }
  for (const pat of entry.expectPresent ?? []) {
    const re = pat instanceof RegExp ? pat : new RegExp(pat);
    if (!re.test(helpText)) {
      drifts.push({ kind: 'present-missing', pattern: pat.toString() });
    }
  }
  return drifts.length > 0
    ? { status: 'drift', detail: `${drifts.length} drift(s) on ${bin}`, bin, drifts }
    : { status: 'ok', detail: `${(entry.expectAbsent?.length ?? 0)} absents + ${(entry.expectPresent?.length ?? 0)} presents match`, bin, drifts: [] };
}

// =====================================================================
// Main
// =====================================================================
console.log('# Upstream re-probe (M11.3 v0.2)\n');
const startedAt = new Date().toISOString();
console.log(`Probed ${PROBES.length} npm packages + ${CLI_PROBES.length} CLI binaries at ${startedAt}.\n`);

console.log('## NPM publication status\n');
const results = await Promise.all(PROBES.map(async (p) => ({ ...p, observed: await probe(p.pkg) })));
console.log('| Status | Package | Expected | Observed | Notes |');
console.log('|---|---|---|---|---|');
for (const r of results) {
  const matches = r.observed.status === r.expect;
  const emoji = matches ? '✓'
    : r.observed.status === 'timeout' ? '?'
      : r.observed.status === 'error' ? '!'
        : '⚠';
  const obs = r.observed.version ? `published@${r.observed.version}`
    : r.observed.status === 'error' ? `error: ${r.observed.errorDetail ?? '(no detail)'}`
      : r.observed.status;
  console.log(`| ${emoji} | \`${r.pkg}\` | ${r.expect} | ${obs} | ${r.notes} |`);
}

const npmDrifts = results.filter((r) => r.observed.status !== r.expect && r.observed.status !== 'error');
const npmErrors = results.filter((r) => r.observed.status === 'error');

console.log('\n## CLI surface contracts (M12.3 — added per M12.2 lesson)\n');
const cliResults = await Promise.all(CLI_PROBES.map(async (e) => ({ ...e, observed: await probeCli(e) })));
console.log('| Status | Binary | Asserts | Notes |');
console.log('|---|---|---|---|');
for (const r of cliResults) {
  const o = r.observed;
  const emoji = o.status === 'ok' ? '✓'
    : o.status === 'binary-not-found' ? '·'
      : o.status === 'timeout' ? '?'
        : o.status === 'error' ? '!'
          : '⚠';
  const asserts = `${(r.expectAbsent?.length ?? 0)} absent + ${(r.expectPresent?.length ?? 0)} present`;
  const obs = o.status === 'ok' ? 'ok' : o.detail;
  console.log(`| ${emoji} | \`${r.bin}\` (${asserts}) | ${obs} | ${r.notes} |`);
}

const cliDrifts = cliResults.filter((r) => r.observed.status === 'drift');
const cliBinaryMissing = cliResults.filter((r) => r.observed.status === 'binary-not-found');
const cliErrors = cliResults.filter((r) => r.observed.status === 'error' || r.observed.status === 'timeout');

const totalDrifts = npmDrifts.length + cliDrifts.length;
const totalErrors = npmErrors.length + cliErrors.length;

if (cliBinaryMissing.length > 0) {
  console.log(`\n**${cliBinaryMissing.length} CLI binary(ies) not found** — probably an environment without those packages installed.`);
  console.log('CLI surface drift cannot be assessed for these. Re-run from a directory where they install.');
}

if (totalErrors > 0) {
  console.log(`\n**${totalErrors} probe(s) errored or timed out.** Re-run when network is stable; partial results above may be unreliable.`);
}

if (totalDrifts === 0) {
  console.log(`\n**No drift.** ${PROBES.length - npmErrors.length}/${PROBES.length} npm + ${cliResults.length - cliErrors.length - cliBinaryMissing.length}/${cliResults.length} CLI match expected.`);
  console.log('Suggested cadence: re-run at every milestone close, or quarterly.');
  process.exit(totalErrors > 0 ? 1 : 0);
}

console.log(`\n## ⚠ Drift detected (${totalDrifts})\n`);
console.log('Paste this block into `docs/plans/m6-scope.md` (or the active scoping doc) and reclassify the affected SDK dormant entries:\n');
console.log('```markdown');
console.log(`### Re-probe drift — ${startedAt}`);
console.log('');
for (const d of npmDrifts) {
  const obs = d.observed.version ? `published@${d.observed.version}` : d.observed.status;
  const action = d.expect === 'unpublished' && obs.startsWith('published')
    ? 'Wire it (sdk-integration) OR update dormant reason; classification was wrong.'
    : d.expect === 'published' && d.observed.status === 'unpublished'
      ? 'Upstream un-published or registry name changed — investigate before re-classifying.'
      : 'Investigate.';
  console.log(`- npm: \`${d.pkg}\`: expected=\`${d.expect}\`, observed=\`${obs}\``);
  console.log(`  - Affected: ${d.notes}`);
  console.log(`  - Action: ${action}`);
}
for (const d of cliDrifts) {
  console.log(`- cli: \`${d.bin}\` (resolved at \`${d.observed.bin}\`)`);
  for (const dd of d.observed.drifts) {
    const action = dd.kind === 'absent-appeared'
      ? 'Upstream shipped a feature the SDK was waiting on — re-evaluate the deferred milestone.'
      : 'Contract regression — SDK code that depended on this surface needs review.';
    console.log(`  - ${dd.kind}: ${dd.pattern}  → ${action}`);
  }
  console.log(`  - Affected: ${d.notes}`);
}
console.log('```');
process.exit(1);
