#!/usr/bin/env node
// M27 — AgentMemory text persistence to backend (sidecar JSON).
//
// Demonstrates that AgentMemory's text store survives a process restart
// when constructed with a `storage` path. Persistence is implemented
// SDK-side as a sidecar JSON co-located with the storage path:
// `${storage}.${agentId}.text.json`. Upstream NAPI bindings have no
// metadata channel, so persistence lives at the SDK layer.
//
// Why this demo uses subprocess: `@ruvector/router` holds a lock on its
// `storagePath` that isn't released until the process exits (its `close`
// method is a no-op; native state is GC'd). For a real user — process A
// exits, process B starts — the lock releases cleanly at process termination.
// The demo simulates that honestly via `child_process.spawnSync` instead
// of pretending single-process close-and-reopen works on every backend.
//
// What this demo proves:
//   [1] First-run remember() writes the sidecar with version + agentId +
//       seq + texts. Inspected via direct fs read.
//   [2] After a real process restart at the same storage path, _seq
//       resumes (post-restart `remember()` issues mem:agent:3, not
//       mem:agent:0).
//   [3] Drift-by-inversion: removing the sidecar before restart resets
//       _seq to 0 — proving the load-from-disk path is what restores
//       state, not a coincidence.
//
// Run: node examples/agent-memory-persist-demo/run.mjs

import { spawnSync } from 'node:child_process';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIMS = 8;
const AGENT_ID = 'persist-demo-agent';

const dir = await mkdtemp(join(tmpdir(), 'am-persist-'));
const storage = join(dir, 'agent.db');
const expectedSidecar = `${storage}.${AGENT_ID}.text.json`;

console.log(`# M27 — AgentMemory text persistence to backend\n`);
console.log(`storage          = ${storage}`);
console.log(`expected sidecar = ${expectedSidecar}\n`);

// Each phase runs in a child. The child exits before the parent inspects
// disk state — no shared router-lock contention. Each child spawn is
// equivalent to "user starts the SDK, does work, exits."
function runPhase(label, code) {
  const args = ['-e', code];
  const env = { ...process.env, AGENT_ID, DIMS: String(DIMS), STORAGE: storage };
  const res = spawnSync(process.execPath, args, { cwd: HERE, env, encoding: 'utf8' });
  if (res.status !== 0) {
    console.error(`[${label}] child exited ${res.status}`);
    console.error(res.stdout);
    console.error(res.stderr);
    process.exit(1);
  }
  return res.stdout.trimEnd();
}

const remember3 = `
import { AgentMemory } from '${join(HERE, '..', '..', 'dist', 'index.js')}';
const oneHot = (i) => { const v = new Float32Array(+process.env.DIMS); v[i % +process.env.DIMS] = 1; return v; };
const am = await AgentMemory.create({
  agentId: process.env.AGENT_ID,
  dimensions: +process.env.DIMS,
  distanceMetric: 'Cosine',
  nativePackage: 'router',
  storage: process.env.STORAGE,
});
console.log('textStorePath=' + am.textStorePath());
await am.remember({ text: 'user prefers dark mode',     embedding: oneHot(0), tags: ['preferences'] });
await am.remember({ text: 'user prefers compact UI',    embedding: oneHot(0), tags: ['preferences'] });
await am.remember({ text: 'user works in EST timezone', embedding: oneHot(2), tags: ['profile'] });
await am.close();
console.log('phase1-done');
`;

const reopenRemember1 = `
import { AgentMemory } from '${join(HERE, '..', '..', 'dist', 'index.js')}';
const oneHot = (i) => { const v = new Float32Array(+process.env.DIMS); v[i % +process.env.DIMS] = 1; return v; };
const am = await AgentMemory.create({
  agentId: process.env.AGENT_ID,
  dimensions: +process.env.DIMS,
  distanceMetric: 'Cosine',
  nativePackage: 'router',
  storage: process.env.STORAGE,
});
const r = await am.remember({ text: 'user is a software engineer', embedding: oneHot(3), tags: ['profile'] });
console.log('newId=' + r.id);
await am.close();
`;

// --- Phase 1 ---
console.log('## [1] First-run remember() in child process');
const out1 = runPhase('phase1', remember3);
console.log(out1.split('\n').map((l) => `  ${l}`).join('\n'));

// --- Inspect the sidecar from the parent (child exited; lock released) ---
console.log(`\n## [2] Sidecar exists post-child-exit: ${existsSync(expectedSidecar)}`);
{
  const raw = await readFile(expectedSidecar, 'utf8');
  const parsed = JSON.parse(raw);
  console.log(`  version=${parsed.version}, agentId=${parsed.agentId}, seq=${parsed.seq}`);
  console.log(`  texts (${Object.keys(parsed.texts).length} entries):`);
  for (const [id, text] of Object.entries(parsed.texts)) {
    console.log(`    ${id} → "${text}"`);
  }
}

// --- Phase 3: reopen in fresh child; verify seq resumed ---
console.log('\n## [3] Reopen at same storage path (fresh child): _seq resumes');
const out3 = runPhase('phase3', reopenRemember1);
const expected3 = `mem:${AGENT_ID}:3`;
console.log(`  child says: ${out3}`);
console.log(`  expected:   newId=${expected3}`);
const ok3 = out3.includes(`newId=${expected3}`);
console.log(`  ${ok3 ? '✓' : '✗'} seq counter ${ok3 ? 'resumed correctly across processes' : 'did NOT resume'}`);

// --- Sidecar should now contain 4 entries ---
{
  const raw = await readFile(expectedSidecar, 'utf8');
  const parsed = JSON.parse(raw);
  console.log(`  sidecar after [3]: seq=${parsed.seq}, ${Object.keys(parsed.texts).length} text entries`);
}

// --- Drift-by-inversion: delete sidecar, reopen, confirm seq resets to 0 ---
console.log('\n## [4] Drift-by-inversion: delete sidecar, reopen, confirm seq resets');
await rm(expectedSidecar);
console.log(`  removed ${expectedSidecar}`);
console.log(`  sidecar exists post-rm: ${existsSync(expectedSidecar)}`);
const out4 = runPhase('phase4', reopenRemember1);
const expected4 = `mem:${AGENT_ID}:0`;
console.log(`  child says: ${out4}`);
console.log(`  expected:   newId=${expected4}`);
const ok4 = out4.includes(`newId=${expected4}`);
console.log(`  ${ok4 ? '✓' : '✗'} seq ${ok4 ? 'reset to 0 (drift confirmed; load-from-disk is what was restoring state)' : 'did NOT reset (something else is restoring state — investigate)'}`);

await rm(dir, { recursive: true, force: true });

if (ok3 && ok4) {
  console.log('\n# OK — text-store sidecar persists across real cross-process restart.');
  process.exit(0);
} else {
  console.log('\n# FAIL — see above');
  process.exit(1);
}
