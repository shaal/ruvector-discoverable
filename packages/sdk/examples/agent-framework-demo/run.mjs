#!/usr/bin/env node
// M14.1 — AgentFramework Phase-1A demo. Pure-orchestration shell over the
// 5 already-shipped archetypes. The framework wires LocalLLM (M11.1+) +
// AgentMemory (M13.1) + KnowledgeBase (M7+) via the M11.2/M13.1 DI pattern;
// dispatches to a synthetic sub-agent; runs an explicit framework-driven
// tool call; reports the value-report's "0-of-4 protocols active" honesty.
//
// Run: RUVECTOR_CORE_BINDING="$PWD/../../ruvector/npm/core/platforms/darwin-arm64/ruvector.node" \
//      node examples/agent-framework-demo/run.mjs

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import {
  AgentFramework,
  AgentMemory,
  KnowledgeBase,
  LocalLLM,
} from '../../dist/index.js';

const explicitBinding = process.env.RUVECTOR_CORE_BINDING
  ?? resolve(process.cwd(), '..', '..', 'ruvector', 'npm', 'core', 'platforms', 'darwin-arm64', 'ruvector.node');

if (!existsSync(explicitBinding)) {
  console.error(`@ruvector/core binding not found at ${explicitBinding}.`);
  process.exit(1);
}

console.log('M14.1 — AgentFramework Phase-1A: orchestration over 5 archetypes\n');

// Wire the 4 cross-archetype dependencies. LocalLLM provides generate/embed;
// AgentMemory and KnowledgeBase share dimensions=768 to match the embedder.
const llm = await LocalLLM.create();
const dims = llm.embedDimensions;
console.log(`LocalLLM ready: embedDimensions=${dims}`);

const kb = await KnowledgeBase.create({
  dimensions: dims,
  bindingPath: explicitBinding,
  embedder: llm,
});
const memory = await AgentMemory.create({
  agentId: 'demo-agent',
  dimensions: dims,
  bindingPath: explicitBinding,
  embedder: llm,
});

// Sub-agent: a smaller framework instance that the parent dispatches to.
// No LLM wired on the child; the child responds with an empty string but
// the dispatch shape is captured in subagentCalls.
const child = await AgentFramework.create({ agentId: 'child-agent' });

// Parent framework: full DI, plus a subset policy (Q4) and a tool.
const fw = await AgentFramework.create({
  agentId: 'orchestrator',
  llm,
  kb,
  memory,
  subagents: [child],
  defaultPolicy: { maxTokens: 100, maxDurationMs: 5000, maxConcurrency: 4 },
});
fw.registerTool({
  name: 'search-docs',
  description: 'Search internal documentation by keyword',
  handler: async (args) => ({ found: 3, query: args }),
});

console.log('\n[0] Health check (3 archetype-tier probes + 3 wired-checks):');
const h = await fw.healthCheck();
console.log(`  ${h.summary}`);
for (const c of h.checks) {
  const icon = c.status === 'ok' ? '✓' : c.status === 'broken' ? '✗' : c.status === 'unsupported' ? '·' : '!';
  console.log(`    ${icon} ${c.name.padEnd(22)} ${c.status.padEnd(12)} ${c.detail ?? ''}`);
}

// Seed KB with two demo documents so the run() context-fetch returns something.
console.log('\n[1] Seed KB with 2 docs (text-only via embedder):');
const ingestPrefix = `__demo_af_${Date.now()}`;
await kb.ingest([
  { id: `${ingestPrefix}-deploy`, text: 'deploy runbook: rolling restart, blue-green' },
  { id: `${ingestPrefix}-rollback`, text: 'rollback procedure: revert deployment within 5 minutes' },
]);
console.log(`  ingested 2 docs`);

console.log('\n[2] run() — orchestrates kb.retrieve → memory.recall → llm.generate → subagent dispatch:');
const r = await fw.run({ prompt: 'how do I deploy safely?' });
console.log(`  taskId       : ${r.taskId}`);
console.log(`  durationMs   : ${r.durationMs.toFixed(2)}`);
console.log(`  costUsd      : ${r.costUsd}  (Q4: maxCostUsd deferred to Phase-2)`);
console.log(`  response     : ${JSON.stringify(r.response.slice(0, 60))}${r.response.length > 60 ? '…' : ''}`);
console.log(`  toolCalls    : ${r.toolCalls.length}  (Q2: only framework-driven invokeTool populates these)`);
console.log(`  subagentCalls: ${r.subagentCalls.length}`);
for (const s of r.subagentCalls) {
  const respPreview = s.response ? `"${s.response.slice(0, 30)}${s.response.length > 30 ? '…' : ''}"` : '(no response)';
  console.log(`    → ${s.agentId}  ${respPreview}`);
}
console.log(`  explain.path : [${r.explain.path.join(' → ')}]`);

console.log('\n[3] invokeTool() — explicit framework-driven dispatch (Q2 ratification):');
const invoked = await fw.invokeTool('search-docs', { query: 'rollback' });
console.log(`  tool='${invoked.tool}', args=${JSON.stringify(invoked.arguments)}, result=${JSON.stringify(invoked.result)}`);

console.log('\n[4] Q3: A2A surface throws upstream-binding (rvagent-a2a unpublished):');
try {
  await fw.discoverPeers();
  console.log('  ✗ discoverPeers did NOT throw');
} catch (e) {
  console.log(`  ✓ ${e.code}: ${e.message.slice(0, 90)}…`);
}

console.log('\nValue report (post-healthCheck):');
const vr = await fw.getValueReport();
console.log(`  source: ${vr.healthSource}`);
console.log(`  ${vr.summary}`);
console.log(`  active:`);
for (const a of vr.active) console.log(`    ✓ ${a.name.padEnd(22)} ${a.invocations} invocations  [${a.source}]`);
console.log(`  dormant:`);
for (const d of vr.dormant) {
  console.log(`    ⚠ [${d.blocker.padEnd(17)}] ${d.name.padEnd(22)} — ${d.reason.slice(0, 65)}${d.reason.length > 65 ? '…' : ''}`);
}

console.log('\nClosing.');
await fw.close();
await child.close();
await memory.close();
await kb.close();
await llm.close();
console.log('Done.');
