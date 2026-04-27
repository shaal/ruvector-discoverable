#!/usr/bin/env node
// @ruvector/sdk CLI dispatcher.
//
// M15.1 Phase-1A — only `doctor` is wired. `recommend` and `audit` come
// in M15.2+ per m15-scope.md's phased plan.
//
// Run via either `npx @ruvector/sdk <command>` or
// `node node_modules/.bin/sdk <command>`. The bin field in package.json
// makes both forms work after install.

import { runDoctor } from '../dist/cli/doctor.js';
import { runRecommend } from '../dist/cli/recommend.js';
import { runAudit } from '../dist/cli/audit.js';

const HELP = `\
@ruvector/sdk — task-first archetypes over upstream ruvector

Usage:
  sdk recommend [flags]        Generate a ruvector.config.ts (interactive or non-interactive)
  sdk doctor <config-path>     Introspect a running SDK config and report degradations
  sdk audit <config-path>      Compare a config against best-practice for its workload
  sdk --help                   Show this message

recommend flags (omit any to run interactively):
  --workload   <key>           rag-over-docs | agent-memory | graph-reasoning |
                               time-series-anomaly | local-llm-inference | agent-orchestration
  --data-size  <bucket>        <1k | 1k-100k | 100k-1M | 1M+
  --latency    <bucket>        <10ms | <50ms | <200ms | >200ms
  --updates    <pattern>       mostly-read | daily-batch | streaming | bursty
  --generate   <yes|no>        whether to wire LocalLLM Phase 2A
  --out        <path>          output path (default: ./ruvector.config.ts)

Examples:
  sdk doctor ./ruvector.config.ts
  sdk recommend                                        # interactive
  sdk recommend --workload rag-over-docs --data-size 1k-100k \\
                --latency '<50ms' --updates daily-batch --generate no \\
                --out ./ruvector.config.ts             # non-interactive
`;

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--') && i + 1 < args.length) {
      flags[a.slice(2)] = args[i + 1];
      i++;
    }
  }
  return flags;
}

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '--help' || command === '-h' || command === 'help') {
  process.stdout.write(HELP);
  process.exit(0);
}

if (command === 'doctor') {
  const configPath = args[1];
  if (!configPath) {
    process.stderr.write('sdk doctor: missing <config-path>.\nUsage: sdk doctor <config-path>\n');
    process.exit(2);
  }
  try {
    await runDoctor({ configPath });
    process.exit(0);
  } catch (e) {
    // runDoctor already printed the diagnostic; exit non-zero so CI can gate.
    if (e && typeof e === 'object' && 'code' in e) {
      process.exit(1);
    }
    process.stderr.write(`sdk doctor: unexpected error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}

if (command === 'recommend') {
  const rest = args.slice(1);
  const flags = parseFlags(rest);
  // Build fromFlags only when at least one workload-relevant flag was set.
  // If none, run interactive.
  const fromFlags = {};
  if (flags.workload)             fromFlags.workload = flags.workload;
  if (flags['data-size'])         fromFlags.dataSize = flags['data-size'];
  if (flags.latency)              fromFlags.latency = flags.latency;
  if (flags.updates)              fromFlags.updates = flags.updates;
  if (flags.generate !== undefined) fromFlags.generate = flags.generate === 'yes' || flags.generate === 'true';
  const opts = { fromFlags };
  if (flags.out) opts.outPath = flags.out;
  try {
    await runRecommend(opts);
    process.exit(0);
  } catch (e) {
    process.stderr.write(`sdk recommend: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}

if (command === 'audit') {
  const configPath = args[1];
  if (!configPath) {
    process.stderr.write('sdk audit: missing <config-path>.\nUsage: sdk audit <config-path>\n');
    process.exit(2);
  }
  try {
    const report = await runAudit({ configPath });
    // Exit 0 if clean; 1 if any drift was reported (excluding pure
    // sdk-integration-suggestions, which are advisory). CI can gate on
    // strict-drift via this exit code.
    const blockingDrifts = report.drifts.filter((d) => d.kind !== 'sdk-integration-suggestion');
    process.exit(blockingDrifts.length > 0 ? 1 : 0);
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e) {
      process.exit(1);
    }
    process.stderr.write(`sdk audit: unexpected error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}

process.stderr.write(`sdk: unknown command '${command}'.\n${HELP}`);
process.exit(2);
