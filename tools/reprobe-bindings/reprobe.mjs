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

import { execFile, spawn } from 'node:child_process';
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

  // ===== rvagent family (Issue #07; added M15.1 v0.3) =====
  // 0 of 9 named bindings published per the M14 reprobe. AgentFramework
  // ships its 4-protocol catalog with mcp/a2a/acp dormant `[upstream-binding]`
  // gated on these. When upstream publishes any one, the next reprobe
  // surfaces drift and recommends reclassification.
  { pkg: '@ruvector/rvagent-core',          expect: 'unpublished', notes: 'AgentFramework — entire family unpublished per Issue #07' },
  { pkg: '@ruvector/rvagent-a2a',           expect: 'unpublished', notes: 'AgentFramework.a2a (ADR-159)' },
  { pkg: '@ruvector/rvagent-mcp',           expect: 'unpublished', notes: 'AgentFramework.mcp (ADR-108)' },
  { pkg: '@ruvector/rvagent-acp',           expect: 'unpublished', notes: 'AgentFramework.acp' },
  { pkg: '@ruvector/rvagent-middleware',    expect: 'unpublished', notes: 'AgentFramework — middleware layer' },
  { pkg: '@ruvector/rvagent-backends',      expect: 'unpublished', notes: 'AgentFramework — backend integrations' },
  { pkg: '@ruvector/rvagent-tools',         expect: 'unpublished', notes: 'AgentFramework — tool registry' },
  { pkg: '@ruvector/rvagent-subagents',     expect: 'unpublished', notes: 'AgentFramework — subagent dispatch (SDK ships own)' },
  { pkg: '@ruvector/rvagent-cli',           expect: 'unpublished', notes: 'AgentFramework — CLI binary' },

  // ===== Transport surface (M17 ratification; v0.4) =====
  // M17 scoping live-probed these. Adds drift detection across the entire
  // PRD §5.1 backend story (native ✓ shipped; wasm + http outstanding).
  // expect 'published-broken' means: npm view returns a version, but the
  // tarball is missing files referenced by package.json#main. Drift in
  // either direction is meaningful (fixed → wire transport; lost →
  // upstream un-published).
  { pkg: '@ruvector/graph-wasm',            expect: 'published',         notes: 'WasmGraphBackend (M17.1) target; richer than graph-node per .d.ts (delete/import/export)' },
  { pkg: '@ruvector/ruvllm-wasm',           expect: 'published',         notes: 'WasmLocalLLMBackend (M17.2) target; 45 exports vs NAPI 14' },
  { pkg: '@ruvector/rvf-wasm',              expect: 'published',         notes: 'RVF wasm — adjacent to advanced/ surface; not currently consumed' },
  { pkg: '@ruvector/ruqu-wasm',             expect: 'published',         notes: 'Quantum-coherence wasm; advanced/ candidate' },
  { pkg: '@ruvector/ospipe-wasm',           expect: 'published',         notes: 'OS-pipe wasm; unrelated to current archetypes' },
  { pkg: '@ruvector/router',                expect: 'published',         notes: 'Stealth-published VectorDb (M17 finding); v0.3 candidate as KB backend independent of @ruvector/core' },
  { pkg: '@ruvector/server',                expect: 'published-broken',  notes: 'HTTP transport blocked by Issue #08 (broken-publish); drift = upstream republished cleanly' },
  { pkg: '@ruvector/cluster',               expect: 'published-broken',  notes: 'Cluster orchestration blocked by Issue #08 (broken-publish); same defect class' },
  { pkg: '@ruvector/rvf-mcp-server',        expect: 'published',         notes: 'MCP-shape server; AgentFramework Phase-1B candidate when MCP wire-up ratified' },
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
// BINDING_METHOD_PROBES — runtime behavior probes (M22 / v0.5)
// =====================================================================
//
// Each probe is a subprocess-isolated .mjs script that exercises a
// specific upstream binding method. The script exits 0 when the
// expected (defective) state holds and 1 (or otherwise non-zero) when
// the behavior changed — typically meaning upstream fixed the defect
// and the SDK should reclassify.
//
// Issue #11 specifically requires SIGKILL-on-timeout because the bug is
// a sync-NAPI infinite loop that ignores SIGTERM/setTimeout. Probes
// with `timeoutIsExpected: true` treat a timeout-kill as the
// expected outcome.
//
// Adding a new probe:
//   1. Drop a script at tools/reprobe-bindings/probes/NN-name.mjs
//   2. Add an entry below
//   3. Run reprobe; verify it shows "✓ expected" (or "✓ expected-hang")
// Probes that exit with code 64 are treated as 'skipped' rather than drift —
// e.g., the binding-not-available case. Mirrors GNU's "EX_USAGE" sentinel
// approach: a specific exit code conveys a structured outcome to the runner.
const PROBE_EXIT_SKIPPED = 64;

const BINDING_METHOD_PROBES = [
  {
    name: 'graph-node-cypher-stub',
    issue: '#01',
    scriptPath: 'tools/reprobe-bindings/probes/01-graph-node-cypher-stub.mjs',
    timeoutMs: 10_000,
    timeoutIsExpected: false,
    notes: 'Cypher engine stub in @ruvector/graph-node@2.0.x. Drift = upstream wired Cypher; flip GraphReasoner.cypher dormant→active.',
  },
  {
    name: 'core-dimension-singleton',
    issue: '#03',
    scriptPath: 'tools/reprobe-bindings/probes/03-core-dimension-singleton.mjs',
    timeoutMs: 10_000,
    timeoutIsExpected: false,
    notes: '@ruvector/core VectorDb pins process-global dimension on first insert. Skipped if RUVECTOR_CORE_BINDING + ruvector/ fallback are both unavailable. Drift = router-style multi-instance isolation now possible under core too.',
  },
  {
    name: 'ruvllm-wrapper-case-rename',
    issue: '#06',
    scriptPath: 'tools/reprobe-bindings/probes/06-ruvllm-wrapper-case-rename.mjs',
    timeoutMs: 15_000,
    timeoutIsExpected: false,
    notes: '@ruvector/ruvllm umbrella JS wrapper drops 3-of-6 query fields + 2-of-5 route fields via snake_case→camelCase mismatch. Native populated; wrapper-only defect. Drift = wrapper fixed.',
  },
  {
    name: 'graph-wasm-cypher-stub',
    issue: '#09',
    scriptPath: 'tools/reprobe-bindings/probes/09-graph-wasm-cypher-stub.mjs',
    timeoutMs: 10_000,
    timeoutIsExpected: false,
    notes: 'Cypher engine stub in @ruvector/graph-wasm@2.0.x (same defect class as #01). Drift = WasmGraphBackend cypher works.',
  },
  {
    name: 'ruvllm-wasm-no-inference',
    issue: '#10',
    scriptPath: 'tools/reprobe-bindings/probes/10-ruvllm-wasm-no-inference.mjs',
    timeoutMs: 10_000,
    timeoutIsExpected: false,
    notes: 'RuvLLMWasm has no embed/similarity/generate/query/route. Drift = upstream shipped inference; wire WasmLocalLLMBackend.',
  },
  {
    name: 'router-delete-deadlock',
    issue: '#11',
    scriptPath: 'tools/reprobe-bindings/probes/11-router-delete-deadlock.mjs',
    // Short timeout — Issue #11 is a sync infinite loop. 3s is plenty;
    // no real `delete` on a 1-node DB takes anywhere near that.
    timeoutMs: 3_000,
    timeoutIsExpected: true,
    notes: '@ruvector/router@0.1.30 VectorDb.delete(<existing-id>) hangs. Probe hangs as expected; SIGKILL after timeout. Drift = exit-before-timeout = bug fixed.',
  },
];
const BINDING_METHOD_TIMEOUT_DEFAULT_MS = 10_000;

// =====================================================================
// NPM probe
// =====================================================================
//
// Two-phase probe:
//   Phase 1 — `npm view <pkg> version` answers "is anything published?"
//   Phase 2 — for entries where `expect === 'published-broken'`, also run
//             `npm view <pkg> main files` and verify the tarball is still
//             missing the main-referenced files (Issue #02 / #08 pattern).
//             Drift = files appeared = upstream republished cleanly.
//
// Returns one of:
//   { status: 'published',        version: '...' }
//   { status: 'published-broken', version: '...', detail: 'main=X but tarball lacks X' }
//   { status: 'unpublished',      version: null }
//   { status: 'timeout',          version: null }
//   { status: 'error',            version: null, errorDetail: '...' }
async function probe(pkg, expect) {
  try {
    const { stdout } = await exec('npm', ['view', pkg, 'version'], {
      timeout: PROBE_TIMEOUT_MS,
    });
    const v = stdout.trim();
    if (!v) return { status: 'unpublished', version: null };

    // For published-broken expectations, do the tarball-content check.
    if (expect === 'published-broken') {
      const brokenDetail = await checkBrokenPublish(pkg);
      if (brokenDetail) {
        return { status: 'published-broken', version: v, detail: brokenDetail };
      }
      // The package is now published cleanly — drift event.
      return { status: 'published', version: v };
    }
    return { status: 'published', version: v };
  } catch (e) {
    if (e.killed || e.code === 'ETIMEDOUT') return { status: 'timeout', version: null };
    const stderr = (e.stderr ?? '').toString();
    if (stderr.includes('404') || stderr.includes('E404') || stderr.includes('not found')) {
      return { status: 'unpublished', version: null };
    }
    return { status: 'error', version: null, errorDetail: stderr.split('\n').slice(-3).join(' ').trim() || e.message };
  }
}

/**
 * Returns null if the package is published with its main-referenced file
 * present (or its main isn't declared), else returns a human-readable detail
 * string describing what's missing from the tarball.
 *
 * Uses `npm view <pkg> --json` to fetch main + files declarations without
 * downloading the tarball. That's deliberately cheap; the `npm pack
 * --dry-run` alternative actually fetches the tarball and is slower. The
 * file-list npm returns from `view` is the same as the tarball's files.
 */
async function checkBrokenPublish(pkg) {
  try {
    const { stdout } = await exec('npm', ['view', pkg, '--json'], {
      timeout: PROBE_TIMEOUT_MS,
    });
    const meta = JSON.parse(stdout);
    const main = typeof meta.main === 'string' ? meta.main : null;
    if (!main) return null; // No main declared = no broken-main concern.
    // `npm view --json` returns `dist.fileCount`. Broken-publish packages
    // (Issue #02 / #08) ship with fileCount=2 (just package.json + README)
    // even when their package.json declares a `main` referencing a missing
    // file. Working packages with a main almost always have fileCount >= 3
    // (package.json + README + at least the main file).
    const fileCount = meta?.dist?.fileCount ?? null;
    if (fileCount !== null && fileCount <= 2) {
      const unpackedSize = meta?.dist?.unpackedSize ?? '?';
      return `main='${main}' declared; tarball fileCount=${fileCount} (unpackedSize=${unpackedSize}B) — main file missing`;
    }
    return null;
  } catch {
    // If the deep check fails for any reason (network, parse), assume the
    // expected `broken` state still holds rather than erroring the whole
    // reprobe. The phase-1 `published` status is still informative.
    return 'tarball-content check skipped (npm view --json unavailable)';
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
// Binding-method probe (M22 / v0.5) — subprocess-isolated, SIGKILL-safe
// =====================================================================
//
// Spawns the probe script in a child Node process, captures stdout +
// exit, and enforces a hard timeout via setTimeout-then-kill('SIGKILL').
// SIGKILL is required because Issue #11 (and any future upstream bug
// of the same class) is a sync NAPI infinite loop that ignores SIGTERM.
//
// Returns one of:
//   { status: 'expected',      detail }  — probe exit 0; bug present
//   { status: 'expected-hang', detail }  — killed by timeout AND
//                                            timeoutIsExpected=true
//   { status: 'skipped',       detail }  — probe exit PROBE_EXIT_SKIPPED (64);
//                                            prerequisite missing (e.g. binding
//                                            not on disk). Doesn't count toward
//                                            drift OR errors.
//   { status: 'drift',         detail }  — exit !=0 (and !=64), OR killed
//                                            when timeoutIsExpected=false
//   { status: 'error',         detail }  — script could not run (missing
//                                            file, spawn error)
async function probeBindingMethod(entry) {
  const scriptAbs = join(REPO_ROOT, entry.scriptPath);
  if (!existsSync(scriptAbs)) {
    return { status: 'error', detail: `probe script not found: ${entry.scriptPath}` };
  }
  const timeoutMs = entry.timeoutMs ?? BINDING_METHOD_TIMEOUT_DEFAULT_MS;

  return new Promise((resolveResult) => {
    const child = spawn(process.execPath, [scriptAbs], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      try { child.kill('SIGKILL'); } catch {/* ignore */}
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.once('error', (err) => {
      clearTimeout(timer);
      resolveResult({ status: 'error', detail: `spawn error: ${err.message}` });
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      const lastLine = stdout.trim().split('\n').filter(Boolean).pop() ?? '';
      if (killed) {
        if (entry.timeoutIsExpected) {
          resolveResult({ status: 'expected-hang', detail: `timed out after ${timeoutMs}ms (expected per Issue ${entry.issue})` });
        } else {
          resolveResult({
            status: 'drift',
            detail: `unexpected timeout after ${timeoutMs}ms (probe should not hang). Last stdout: ${lastLine || '(none)'}`,
          });
        }
        return;
      }
      if (code === 0) {
        resolveResult({ status: 'expected', detail: lastLine || 'exit 0' });
        return;
      }
      if (code === PROBE_EXIT_SKIPPED) {
        // Probe declined to run (prerequisite missing, e.g. binding-not-on-disk).
        // Not drift; not an error. Documented per-probe outcome.
        resolveResult({ status: 'skipped', detail: lastLine || `exit ${PROBE_EXIT_SKIPPED}` });
        return;
      }
      // Non-zero exit. Drift: behavior changed, classification was wrong.
      const detail = lastLine || stderr.trim().split('\n').filter(Boolean).pop() || `exit ${code} signal ${signal ?? '(none)'}`;
      resolveResult({ status: 'drift', detail });
    });
  });
}

// =====================================================================
// Main
// =====================================================================
console.log('# Upstream re-probe (M11.3 v0.5 — M22 + M23: 6 binding-method probes)\n');
const startedAt = new Date().toISOString();
console.log(`Probed ${PROBES.length} npm packages + ${CLI_PROBES.length} CLI binaries + ${BINDING_METHOD_PROBES.length} binding-method probes at ${startedAt}.\n`);

console.log('## NPM publication status\n');
const results = await Promise.all(PROBES.map(async (p) => ({ ...p, observed: await probe(p.pkg, p.expect) })));
console.log('| Status | Package | Expected | Observed | Notes |');
console.log('|---|---|---|---|---|');
for (const r of results) {
  const matches = r.observed.status === r.expect;
  const emoji = matches ? '✓'
    : r.observed.status === 'timeout' ? '?'
      : r.observed.status === 'error' ? '!'
        : '⚠';
  const obs = r.observed.status === 'published-broken' ? `broken@${r.observed.version}`
    : r.observed.version ? `published@${r.observed.version}`
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

console.log('\n## Binding-method behavior probes (M22 — runtime defects)\n');
console.log('Subprocess-isolated probes that exercise upstream binding methods directly. Each ' +
  'expects the documented defect to still be present (exit 0); a non-zero exit (or unexpected ' +
  'timeout) signals upstream behavior changed — likely a fix worth reclassifying.\n');
const bmResults = [];
for (const e of BINDING_METHOD_PROBES) {
  // Run sequentially. Probe #11 SIGKILLs its child after timeout; running
  // probes in parallel could starve the OS of subprocess slots when the
  // hung child is still being reaped.
  bmResults.push({ ...e, observed: await probeBindingMethod(e) });
}
console.log('| Status | Probe | Issue | Outcome |');
console.log('|---|---|---|---|');
for (const r of bmResults) {
  const o = r.observed;
  const emoji = (o.status === 'expected' || o.status === 'expected-hang') ? '✓'
    : o.status === 'skipped' ? '·'
      : o.status === 'error' ? '!'
        : '⚠';
  const detail = (o.detail ?? '').replace(/\|/g, '\\|').slice(0, 110);
  console.log(`| ${emoji} | \`${r.name}\` | ${r.issue} | ${detail} |`);
}
const bmDrifts = bmResults.filter((r) => r.observed.status === 'drift');
const bmErrors = bmResults.filter((r) => r.observed.status === 'error');
const bmSkipped = bmResults.filter((r) => r.observed.status === 'skipped');
const bmExpected = bmResults.filter((r) => r.observed.status === 'expected' || r.observed.status === 'expected-hang');

const totalDrifts = npmDrifts.length + cliDrifts.length + bmDrifts.length;
const totalErrors = npmErrors.length + cliErrors.length + bmErrors.length;

if (cliBinaryMissing.length > 0) {
  console.log(`\n**${cliBinaryMissing.length} CLI binary(ies) not found** — probably an environment without those packages installed.`);
  console.log('CLI surface drift cannot be assessed for these. Re-run from a directory where they install.');
}

if (totalErrors > 0) {
  console.log(`\n**${totalErrors} probe(s) errored or timed out.** Re-run when network is stable; partial results above may be unreliable.`);
}

if (totalDrifts === 0) {
  const bmSkippedSuffix = bmSkipped.length > 0 ? ` (${bmSkipped.length} skipped — prerequisite unavailable)` : '';
  console.log(`\n**No drift.** ${PROBES.length - npmErrors.length}/${PROBES.length} npm + ${cliResults.length - cliErrors.length - cliBinaryMissing.length}/${cliResults.length} CLI + ${bmExpected.length}/${BINDING_METHOD_PROBES.length} binding-method probes match expected${bmSkippedSuffix}.`);
  console.log('Suggested cadence: re-run at every milestone close, or quarterly.');
  process.exit(totalErrors > 0 ? 1 : 0);
}

console.log(`\n## ⚠ Drift detected (${totalDrifts})\n`);
console.log('Paste this block into `docs/plans/m6-scope.md` (or the active scoping doc) and reclassify the affected SDK dormant entries:\n');
console.log('```markdown');
console.log(`### Re-probe drift — ${startedAt}`);
console.log('');
for (const d of npmDrifts) {
  const obs = d.observed.status === 'published-broken' ? `broken@${d.observed.version}`
    : d.observed.version ? `published@${d.observed.version}`
      : d.observed.status;
  const action = d.expect === 'unpublished' && d.observed.status.startsWith('published')
    ? 'Wire it (sdk-integration) OR update dormant reason; classification was wrong.'
    : d.expect === 'published' && d.observed.status === 'unpublished'
      ? 'Upstream un-published or registry name changed — investigate before re-classifying.'
      : d.expect === 'published-broken' && d.observed.status === 'published'
        ? 'Upstream republished cleanly — Issue #02 / #08 may be fixed; verify, then close issue + wire transport.'
        : d.expect === 'published-broken' && d.observed.status === 'unpublished'
          ? 'Upstream un-published the broken package — re-evaluate transport plan.'
          : 'Investigate.';
  console.log(`- npm: \`${d.pkg}\`: expected=\`${d.expect}\`, observed=\`${obs}\``);
  if (d.observed.detail) console.log(`  - Detail: ${d.observed.detail}`);
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
for (const d of bmDrifts) {
  console.log(`- binding-method: \`${d.name}\` (Issue ${d.issue})`);
  console.log(`  - Detail: ${d.observed.detail}`);
  console.log(`  - Affected: ${d.notes}`);
  console.log(`  - Action: Upstream behavior changed — verify, then update the SDK's catalog/probe classification accordingly. Same M6.2 self-correcting flow.`);
}
console.log('```');
process.exit(1);
