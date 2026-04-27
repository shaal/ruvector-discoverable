#!/usr/bin/env node
// M11.3 — periodic re-probe of upstream NAPI binding publication status.
//
// Why this exists: M11 scoping found that my M6 v0.1 scoping doc claimed
// "@ruvector/ruvllm has no NAPI binding" — already false at the time it was
// written (the umbrella + platform packages were both published on npm).
// The SDK shipped four milestones with that misclassification load-bearing
// in its dormant-capability list.
//
// What this catches: any upstream package that appears in the SDK's
// `upstream-binding`-classified dormant entries but has been published on
// npm since the last scoping pass. Output is paste-ready into m6-scope.md.
//
// Inverse: also catches a package the SDK assumed published that has been
// unpublished or deprecated (rare but possible).
//
// Re-runnable: dependency-free Node ESM. Probes in parallel, ~3-5s total.
// Exits 0 on no drift, 1 on drift detected — CI can gate on it.
//
// To update the EXPECTED column: re-run the script, ratify changes, then
// edit the PROBES table below. Each entry must point at a milestone or
// scoping doc that justifies its expected state.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);

// Last ratified: 2026-04-27 (m11-scope.md) — the umbrella @ruvector/ruvllm
// flip from "unpublished" to "published" was the trigger for this tool.
//
// Each row tracks an upstream package whose publication status the SDK's
// dormant-capability classification depends on. `expect` reflects the most
// recent ratified scoping; `notes` names the affected SDK capability(ies)
// so a drift report tells you exactly which catalog rows to reclassify.
const PROBES = [
  // ===== Positive controls =====
  // Confirms network + npm registry are reachable. A "drift" on these means
  // the script lost network, not that upstream unpublished a load-bearing
  // package — but flag both as `?` for human review either way.
  { pkg: '@ruvector/ruvllm',                expect: 'published',   notes: 'LocalLLM (M11.1+) — drift here = upstream unpublished, very surprising' },
  { pkg: '@ruvector/graph-node',            expect: 'published',   notes: 'GraphReasoner (M6+)' },
  { pkg: '@ruvector/sona',                  expect: 'published',   notes: 'KnowledgeBase SONA (M10+)' },

  // ===== Dormant upstream-binding packages =====
  // Every entry below maps to one or more dormant rows in the SDK's value
  // reports with `blocker: 'upstream-binding'`. If any flips to `published`,
  // the SDK can either wire it (sdk-integration work) or, at minimum, drop
  // its dormant text claiming the package isn't on npm.
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

const PROBE_TIMEOUT_MS = 15_000;

async function probe(pkg) {
  try {
    const { stdout } = await exec('npm', ['view', pkg, 'version'], {
      timeout: PROBE_TIMEOUT_MS,
      // Suppress npm's own warnings on stderr; we only care about stdout.
    });
    const v = stdout.trim();
    return v ? { status: 'published', version: v } : { status: 'unpublished', version: null };
  } catch (e) {
    // Timeout: probe inconclusive — treat as drift candidate, surface as `?`.
    if (e.killed || e.code === 'ETIMEDOUT') return { status: 'timeout', version: null };
    // npm view exits non-zero (E404) when the package doesn't exist on the
    // registry. The error's stderr usually says "404 Not Found" — treat as
    // unpublished. Other failure modes (network down, registry down) also
    // bubble up here; we conservatively classify as 'unpublished' but the
    // diagnostic carries the underlying message for investigation.
    const stderr = (e.stderr ?? '').toString();
    if (stderr.includes('404') || stderr.includes('E404') || stderr.includes('not found')) {
      return { status: 'unpublished', version: null };
    }
    return { status: 'error', version: null, errorDetail: stderr.split('\n').slice(-3).join(' ').trim() || e.message };
  }
}

console.log('# Upstream NAPI binding re-probe (M11.3)\n');
const startedAt = new Date().toISOString();
console.log(`Probed ${PROBES.length} packages at ${startedAt}.\n`);

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

const drifts = results.filter((r) => r.observed.status !== r.expect && r.observed.status !== 'error');
const errors = results.filter((r) => r.observed.status === 'error');

if (errors.length > 0) {
  console.log(`\n**${errors.length} probe(s) errored** — registry unreachable or unexpected npm output.`);
  console.log('Re-run when network is stable; partial results above may be unreliable.');
}

if (drifts.length === 0) {
  console.log(`\n**No drift.** ${results.length - errors.length} of ${results.length} packages match expected; ${errors.length} errored.`);
  console.log('Suggested cadence: re-run at every milestone close, or quarterly.');
  process.exit(errors.length > 0 ? 1 : 0);
}

console.log(`\n## ⚠ Drift detected (${drifts.length})\n`);
console.log('Paste this block into `docs/plans/m6-scope.md` (or the active scoping doc) and reclassify the affected SDK dormant entries:\n');
console.log('```markdown');
console.log(`### Re-probe drift — ${startedAt}`);
console.log('');
for (const d of drifts) {
  const obs = d.observed.version ? `published@${d.observed.version}` : d.observed.status;
  const action = d.expect === 'unpublished' && obs.startsWith('published')
    ? 'Wire it (sdk-integration) OR update dormant reason; classification was wrong.'
    : d.expect === 'published' && d.observed.status === 'unpublished'
      ? 'Upstream un-published or registry name changed — investigate before re-classifying.'
      : 'Investigate.';
  console.log(`- \`${d.pkg}\`: expected=\`${d.expect}\`, observed=\`${obs}\``);
  console.log(`  - Affected: ${d.notes}`);
  console.log(`  - Action: ${action}`);
}
console.log('```');
process.exit(1);
