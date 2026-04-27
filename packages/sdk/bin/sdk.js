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

const HELP = `\
@ruvector/sdk — task-first archetypes over upstream ruvector

Usage:
  sdk doctor <config-path>     Introspect a running SDK config and report degradations
  sdk recommend                Phase-1B (not yet implemented; see docs/plans/m15-scope.md)
  sdk audit <config-path>      Phase-2 (not yet implemented)
  sdk --help                   Show this message

Examples:
  sdk doctor ./ruvector.config.ts
  sdk doctor packages/sdk/examples/sample-config.ts
`;

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

if (command === 'recommend' || command === 'audit') {
  process.stderr.write(
    `sdk ${command}: not yet implemented (Phase-1B/2 per docs/plans/m15-scope.md).\n` +
    `Phase-1A ships 'doctor' only — see https://github.com/ruvnet/ruvector for the upstream roadmap.\n`,
  );
  process.exit(2);
}

process.stderr.write(`sdk: unknown command '${command}'.\n${HELP}`);
process.exit(2);
