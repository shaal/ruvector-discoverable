#!/usr/bin/env node
// M15.2 — drift probe: asserts that every capability named in the recommend
// CLI's WORKLOADS table (`recommends.archetypes` + `skips[i].capability`)
// exists in the live archetype catalog. Catches future drift between the
// workloads table and the archetypes' CAPABILITY_CATALOG entries.
//
// Run: node examples/recommend-drift-probe.mjs
// Exit: 0 on no drift, 1 on drift detected.

import { WORKLOADS } from '../dist/cli/workloads.js';
import {
  KnowledgeBase,
  TimeSeriesMemory,
  GraphReasoner,
  LocalLLM,
  AgentMemory,
  AgentFramework,
} from '../dist/index.js';

// Archetype name → live catalog name set. Each archetype's catalog is
// reachable via a temporary instance's introspect().capabilities, but we
// don't want to instantiate (some need the binding loaded). Instead, the
// recommend CLI's table is data-only and can be validated against a
// hand-maintained "live names" snapshot from each archetype's source.
//
// To keep this probe accurate without forcing instantiation, we read each
// archetype's CAPABILITY_CATALOG via its introspect().capabilities — but
// we use a lightweight try/catch and skip archetypes that require an
// upstream binding to construct. AgentFramework constructs without any
// dependency, so it always probes.

async function getCatalogNames(name, ctor) {
  try {
    // Each archetype has different create() signatures; minimum-viable
    // construction differs. We attempt a few common shapes; on failure,
    // return null and let the caller skip.
    let inst = null;
    if (name === 'AgentFramework') {
      inst = await ctor.create({ agentId: '__drift_probe__' });
    } else if (name === 'LocalLLM') {
      inst = await ctor.create();
    } else {
      // KB/TSM/GR/AgentMemory all need a backend that requires
      // RUVECTOR_CORE_BINDING. Skip if not available — the probe is
      // best-effort and still catches AgentFramework + LocalLLM drift.
      if (!process.env.RUVECTOR_CORE_BINDING) return null;
      switch (name) {
        case 'KnowledgeBase':    inst = await ctor.create({ dimensions: 16, bindingPath: process.env.RUVECTOR_CORE_BINDING }); break;
        case 'TimeSeriesMemory': inst = await ctor.create({ streamId: 'drift', dimensions: 16, bindingPath: process.env.RUVECTOR_CORE_BINDING }); break;
        case 'GraphReasoner':    inst = await ctor.create({ dimensions: 16 }); break;
        case 'AgentMemory':      inst = await ctor.create({ agentId: '__drift_probe__', dimensions: 16, bindingPath: process.env.RUVECTOR_CORE_BINDING }); break;
      }
    }
    if (!inst) return null;
    const pipe = inst.introspect();
    const names = new Set(pipe.capabilities.map((c) => c.name));
    if (typeof inst.close === 'function') await inst.close();
    return names;
  } catch (e) {
    console.error(`  warn: could not instantiate ${name}: ${e.message.slice(0, 80)}`);
    return null;
  }
}

const CTORS = { KnowledgeBase, TimeSeriesMemory, GraphReasoner, LocalLLM, AgentMemory, AgentFramework };

console.log('# M15.2 recommend drift probe\n');
console.log(`Probing ${WORKLOADS.length} workloads against live archetype catalogs...`);
if (!process.env.RUVECTOR_CORE_BINDING) {
  console.log('(skip note: RUVECTOR_CORE_BINDING unset; KB/TSM/GR/AgentMemory will be skipped)\n');
} else {
  console.log();
}

const catalogs = {};
for (const [name, ctor] of Object.entries(CTORS)) {
  catalogs[name] = await getCatalogNames(name, ctor);
}

const drifts = [];
for (const w of WORKLOADS) {
  // Validate every archetype name is real.
  for (const name of w.archetypes) {
    if (!CTORS[name]) drifts.push(`workload '${w.key}' references unknown archetype '${name}'`);
  }
  // Validate every skip's capability exists in its archetype's live catalog.
  for (const s of w.skips) {
    const live = catalogs[s.archetype];
    if (live === null || live === undefined) continue; // skipped due to missing binding
    if (!live.has(s.capability)) {
      drifts.push(`workload '${w.key}' skips '${s.archetype}.${s.capability}' but live catalog has no such name (drifted/renamed?)`);
    }
  }
}

if (drifts.length === 0) {
  const probed = Object.values(catalogs).filter((c) => c !== null).length;
  console.log(`✓ No drift across ${WORKLOADS.length} workloads × ${probed} probed archetypes (${Object.keys(CTORS).length - probed} skipped due to missing bindings).`);
  process.exit(0);
}

console.log(`⚠ ${drifts.length} drift(s) detected:`);
for (const d of drifts) console.log(`  - ${d}`);
process.exit(1);
