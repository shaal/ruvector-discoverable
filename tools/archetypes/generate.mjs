#!/usr/bin/env node
// M4 — Generates per-archetype catalog views from editorial assignments.
//
// Reads:
//   - tools/archetypes/assignments.mjs (the editorial source)
//   - catalog/catalog.json (M3 ground truth)
//
// Writes:
//   - catalog/by-archetype/<name>.md      (one per archetype, headline first)
//   - catalog/by-category/<name>.md       (one per non-archetype category)
//   - catalog/uncategorized.md            (crates not yet hand-reviewed)
//   - catalog/archetype-coverage.md       (top-level summary)
//
// Honest about confidence: each crate row carries its assignment confidence
// so a reader can tell "high-evidence" mappings from "best-guess pending".

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { archetypes, categories, explicit, bulkRules } from './assignments.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(REPO_ROOT, 'catalog');

const m3 = JSON.parse(readFileSync(join(OUT_DIR, 'catalog.json'), 'utf8'));

// ---------------- Apply assignments ----------------
// Build a per-crate enriched record.

function enrichedCrate(c) {
  const base = {
    name: c.name,
    path: c.path,
    items: c.items.length,
    napi: c.napi_count,
    wasm: c.wasm_count,
    cfg: c.items.filter((i) => i.cfg_gates.length).length,
    docs: c.items.filter((i) => i.doc).length,
    is_orphan: c.is_adr_orphan,
    adrs: c.adrs,
    category_tag: c.category, // M2/M3 category (library/test/bench/example/binary)
    archetypes: [],
    categories: [],
    confidence: null,
    rationale: null,
    bulk_rule_reason: null,
    risk: null,
    evidence: {},
  };
  const exp = explicit[c.name];
  if (exp) {
    base.archetypes = exp.archetypes || [];
    base.categories = exp.categories || [];
    base.confidence = exp.confidence;
    base.rationale = exp.rationale;
    base.evidence = exp.evidence || {};
    base.risk = exp.risk || null;
    base.source = 'explicit';
    return base;
  }
  for (const rule of bulkRules) {
    if (rule.match(c)) {
      base.categories = rule.assign.categories || [];
      base.archetypes = rule.assign.archetypes || [];
      base.confidence = rule.confidence;
      base.bulk_rule_reason = rule.reason;
      base.source = 'bulk';
      return base;
    }
  }
  base.categories = ['pending_review'];
  base.confidence = 'pending';
  base.source = 'unassigned';
  return base;
}

const enriched = m3.crates.map(enrichedCrate);

// Index by archetype and category.
const byArchetype = {};
for (const a of Object.keys(archetypes)) byArchetype[a] = [];
const byCategory = {};
for (const c of Object.keys(categories)) byCategory[c] = [];

for (const c of enriched) {
  for (const a of c.archetypes) {
    if (!byArchetype[a]) byArchetype[a] = []; // tolerate proposed-but-undeclared
    byArchetype[a].push(c);
  }
  for (const cat of c.categories) {
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(c);
  }
}

// Sort each bucket by items desc.
for (const k of Object.keys(byArchetype)) byArchetype[k].sort((a, b) => b.items - a.items);
for (const k of Object.keys(byCategory)) byCategory[k].sort((a, b) => b.items - a.items);

// ---------------- Render ----------------

function fmtRow(c) {
  const flags = [
    c.napi ? `napi=${c.napi}` : null,
    c.wasm ? `wasm=${c.wasm}` : null,
    c.cfg ? `cfg=${c.cfg}` : null,
    c.is_orphan ? 'orphan' : null,
    c.risk ? `risk:${c.risk}` : null,
  ].filter(Boolean).join(' ');
  const adrs = c.adrs.slice(0, 4).join(', ') + (c.adrs.length > 4 ? `, +${c.adrs.length - 4}` : '');
  const conf = c.confidence === 'high' ? '🟢' : c.confidence === 'medium' ? '🟡' : c.confidence === 'low' ? '🟠' : c.confidence === 'pending' ? '⏳' : '·';
  return `| ${conf} | \`${c.name}\` | ${c.items} | ${flags} | ${adrs || '—'} |`;
}

function renderArchetypeMd(name, meta, members) {
  const lines = [];
  lines.push(`# Archetype: ${name}\n`);
  lines.push(`*Auto-generated from \`tools/archetypes/assignments.mjs\` and \`catalog/catalog.json\`.*\n`);
  if (meta.seed) lines.push(`**Seed archetype** (PRD §5.2).\n`);
  else if (meta.proposed_in) lines.push(`**Proposed in ${meta.proposed_in}** — evidence-driven addition. See PRD §6.9 for the archetype-evolution rule that allows this.\n`);
  lines.push(`**Workload.** ${meta.workload}\n`);
  lines.push(`**Why this archetype.** ${meta.rationale}\n`);
  if (meta.risk) lines.push(`> ⚠ Risk: \`${meta.risk}\`\n`);
  if (meta.headline) lines.push(`Headline: ✅ exposed at SDK top-level.\n`);
  lines.push(`## Members (${members.length})\n`);
  if (members.length === 0) {
    lines.push(`_No crates assigned yet._`);
  } else {
    lines.push(`| Conf | Crate | Items | Flags | ADRs |`);
    lines.push(`|---|---|--:|---|---|`);
    for (const m of members) lines.push(fmtRow(m));
    lines.push('');
    lines.push('### Rationale per crate\n');
    for (const m of members) {
      lines.push(`- **\`${m.name}\`** — ${m.rationale || m.bulk_rule_reason || '(no rationale)'}`);
      if (m.evidence?.adrs?.length) lines.push(`  - ADR evidence: ${m.evidence.adrs.join(', ')}`);
      if (m.evidence?.items?.length) lines.push(`  - Item evidence: ${m.evidence.items.slice(0, 5).map((x) => `\`${x}\``).join(', ')}`);
    }
  }
  if (meta.citation_evidence) {
    lines.push('\n### Archetype-level citation evidence');
    if (meta.citation_evidence.adrs?.length) lines.push(`- ADRs: ${meta.citation_evidence.adrs.join(', ')}`);
    if (meta.citation_evidence.biggest_crates?.length) lines.push(`- Biggest crates: ${meta.citation_evidence.biggest_crates.map((x) => `\`${x}\``).join(', ')}`);
  }
  return lines.join('\n') + '\n';
}

function renderCategoryMd(name, meta, members) {
  const lines = [];
  lines.push(`# Category: ${name}\n`);
  lines.push(`*Auto-generated. Cross-cutting role, not an archetype.*\n`);
  lines.push(`${meta.description}\n`);
  lines.push(`## Members (${members.length})\n`);
  if (members.length === 0) {
    lines.push('_No crates assigned._');
  } else {
    lines.push(`| Conf | Crate | Items | Flags | ADRs |`);
    lines.push(`|---|---|--:|---|---|`);
    for (const m of members) lines.push(fmtRow(m));
  }
  return lines.join('\n') + '\n';
}

function renderUncategorizedMd(unassigned) {
  const lines = [];
  lines.push('# Uncategorized — pending v0.2 editorial review\n');
  lines.push(`*${unassigned.length} crates were not matched by an explicit assignment or a bulk rule. Each needs a hand decision in v0.2: assign to an archetype, place in a category, or propose a new archetype.*\n`);
  lines.push(`Sorted by item count — biggest first.\n`);
  lines.push(`| Crate | Items | Flags | ADRs | M3 category |`);
  lines.push(`|---|--:|---|---|---|`);
  unassigned.sort((a, b) => b.items - a.items);
  for (const m of unassigned) {
    const flags = [
      m.napi ? `napi=${m.napi}` : null,
      m.wasm ? `wasm=${m.wasm}` : null,
      m.is_orphan ? 'orphan' : null,
    ].filter(Boolean).join(' ');
    const adrs = m.adrs.slice(0, 3).join(', ') + (m.adrs.length > 3 ? ', +' + (m.adrs.length - 3) : '');
    lines.push(`| \`${m.name}\` | ${m.items} | ${flags} | ${adrs || '—'} | ${m.category_tag} |`);
  }
  return lines.join('\n') + '\n';
}

function renderCoverageMd(stats, unassigned) {
  const lines = [];
  lines.push('# Archetype coverage — M4 v0.1\n');
  lines.push(`*Auto-generated.*\n`);
  lines.push('## Per-archetype coverage\n');
  lines.push('| Archetype | Headline | Members | Items covered |');
  lines.push('|---|---|--:|--:|');
  for (const [name, meta] of Object.entries(archetypes)) {
    const members = byArchetype[name] || [];
    const items = members.reduce((n, c) => n + c.items, 0);
    lines.push(`| ${meta.proposed_in ? '_' : ''}${name}${meta.proposed_in ? ` (proposed ${meta.proposed_in})_` : ''} | ${meta.headline ? '✅' : '—'} | ${members.length} | ${items} |`);
  }
  lines.push('\n## Per-category coverage\n');
  lines.push('| Category | Members | Items |');
  lines.push('|---|--:|--:|');
  for (const [name, meta] of Object.entries(categories)) {
    const members = byCategory[name] || [];
    const items = members.reduce((n, c) => n + c.items, 0);
    lines.push(`| \`${name}\` | ${members.length} | ${items} |`);
  }
  lines.push('\n## Assignment source\n');
  lines.push('| Source | Count |');
  lines.push('|---|--:|');
  lines.push(`| explicit (hand-authored) | ${stats.explicit} |`);
  lines.push(`| bulk-rule | ${stats.bulk} |`);
  lines.push(`| unassigned (pending v0.2) | ${stats.unassigned} |`);
  lines.push(`| **total crates** | **${stats.total}** |\n`);
  lines.push(`## Confidence breakdown\n`);
  for (const [k, v] of Object.entries(stats.byConf)) lines.push(`- ${k}: ${v}`);
  return lines.join('\n') + '\n';
}

// ---------------- Write ----------------

function ensureDir(p) { mkdirSync(p, { recursive: true }); }

const archDir = join(OUT_DIR, 'by-archetype');
const catDir = join(OUT_DIR, 'by-category');
ensureDir(archDir);
ensureDir(catDir);

for (const [name, meta] of Object.entries(archetypes)) {
  const members = byArchetype[name] || [];
  writeFileSync(join(archDir, `${name}.md`), renderArchetypeMd(name, meta, members));
}
for (const [name, meta] of Object.entries(categories)) {
  const members = byCategory[name] || [];
  writeFileSync(join(catDir, `${name}.md`), renderCategoryMd(name, meta, members));
}

const unassigned = enriched.filter((c) => c.source === 'unassigned');
writeFileSync(join(OUT_DIR, 'uncategorized.md'), renderUncategorizedMd(unassigned));

const stats = {
  total: enriched.length,
  explicit: enriched.filter((c) => c.source === 'explicit').length,
  bulk: enriched.filter((c) => c.source === 'bulk').length,
  unassigned: unassigned.length,
  byConf: {},
};
for (const c of enriched) stats.byConf[c.confidence] = (stats.byConf[c.confidence] || 0) + 1;
writeFileSync(join(OUT_DIR, 'archetype-coverage.md'), renderCoverageMd(stats, unassigned));

// Console summary.
console.log(`\nM4 v0.1 — ${enriched.length} crates processed`);
console.log(`  explicit:    ${stats.explicit}`);
console.log(`  bulk-rule:   ${stats.bulk}`);
console.log(`  unassigned:  ${stats.unassigned} (pending v0.2)`);
console.log(`  by confidence:`, stats.byConf);
console.log(`\nPer-archetype:`);
for (const [name] of Object.entries(archetypes)) {
  const m = byArchetype[name] || [];
  const items = m.reduce((n, c) => n + c.items, 0);
  console.log(`  ${name.padEnd(22)} ${String(m.length).padStart(3)} crates  ${String(items).padStart(5)} items`);
}
console.log(`\nWrote ${Object.keys(archetypes).length} archetype files, ${Object.keys(categories).length} category files.`);
console.log(`Wrote catalog/uncategorized.md and catalog/archetype-coverage.md.`);
