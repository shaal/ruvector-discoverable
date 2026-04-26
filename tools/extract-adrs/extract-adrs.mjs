#!/usr/bin/env node
// Phase 0 — ADR skeleton extractor.
// Walks upstream docs/adr/, parses every ADR-NNN-*.md into a structured record,
// emits catalog/adrs.json (machine-readable) and catalog/adrs.md (human view).
//
// Re-runnable: produces deterministic output (sorted, no timestamps inside records).
// The only timestamp is the top-level extracted_at.
//
// Three header formats are supported (observed in the corpus):
//   A) bold key-value lines: **Status**: Proposed
//   B) markdown subsections: ## Status \n Accepted
//   C) markdown tables: | **Status** | Accepted |

import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const ADR_DIR = join(REPO_ROOT, 'ruvector', 'docs', 'adr');
const OUT_DIR = join(REPO_ROOT, 'catalog');

const ADR_FILE_RE = /^ADR-(\d{3,4})([a-z])?-(.+)\.md$/;
const STATUS_TOKENS = [
  'Proposed', 'Accepted', 'Rejected', 'Superseded', 'Deprecated', 'Draft',
  'Implemented', 'Active', 'Approved', 'Deployed', 'Shipped', 'Ready',
  'In Progress', 'In Review', 'Partially', 'Phase',
];

function listEntries(dir) {
  return readdirSync(dir).map((name) => {
    const full = join(dir, name);
    const s = statSync(full);
    return { name, full, isDir: s.isDirectory(), size: s.size };
  });
}

function parseHeader(text) {
  // Format A accepts both **Status**: X and **Status:** X
  const a = text.match(/\*\*Status\*\*\s*:\s*([^\n]+)/) || text.match(/\*\*Status\s*:\*\*\s*([^\n]+)/);
  // Format B: `## Status` followed by a line of value (which may start with bold)
  const b = text.match(/^##\s+Status\s*\n+\s*([^\n]+)/m);
  // Format C: | **Status** | X |  — also accept the same without bold around the label
  const c = text.match(/\|\s*\*\*Status\*\*\s*\|\s*([^|\n]+?)\s*\|/)
         || text.match(/\|\s*Status\s*\|\s*([^|\n]+?)\s*\|/);

  const rawStatus = (a || b || c || [])[1]?.trim() ?? null;

  const aDate = text.match(/\*\*Date\*\*\s*:\s*([^\n]+)/) || text.match(/\*\*Date\s*:\*\*\s*([^\n]+)/);
  const bDate = text.match(/^##\s+Date\s*\n+\s*([^\n]+)/m);
  const cDate = text.match(/\|\s*\*\*Date\*\*\s*\|\s*([^|\n]+?)\s*\|/)
             || text.match(/\|\s*Date\s*\|\s*([^|\n]+?)\s*\|/);
  const rawDate = (aDate || bDate || cDate || [])[1]?.trim() ?? null;

  const formatDetected = a ? 'A' : b ? 'B' : c ? 'C' : 'unknown';

  return { rawStatus, rawDate, formatDetected };
}

function normalizeStatus(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[*_`]/g, '').trim();
  for (const tok of STATUS_TOKENS) {
    if (cleaned.toLowerCase().startsWith(tok.toLowerCase())) return tok;
  }
  return cleaned.split(/[\s—–-]/)[0] || cleaned;
}

function extractTitle(text, idStr) {
  const m = text.match(/^#\s+(.+)$/m);
  if (!m) return null;
  // Strip "ADR-NNN: " or "ADR-NNN — " prefix
  return m[1].replace(new RegExp(`^${idStr}\\s*[:—–-]\\s*`, 'i'), '').trim();
}

function findAdrRefs(text, selfId) {
  const refs = new Set();
  const re = /ADR-(\d{3,4})/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const idStr = `ADR-${m[1]}`;
    if (idStr !== selfId) refs.add(idStr);
  }
  return [...refs].sort();
}

function findSupersedeRels(text) {
  const supersedes = new Set();
  const supersededBy = new Set();

  // "supersedes ADR-NNN" / "supersedes: ADR-NNN"
  const supRe = /supersed(?:es|ing)[:\s]+(?:by\s+)?ADR-(\d{3,4})/gi;
  // "superseded by ADR-NNN"
  const supByRe = /superseded\s+by\s+ADR-(\d{3,4})/gi;

  let m;
  while ((m = supByRe.exec(text)) !== null) supersededBy.add(`ADR-${m[1]}`);
  // Reset and run supersedes (but we already swallowed the "by" cases above; need to skip those)
  while ((m = supRe.exec(text)) !== null) {
    // m[0] includes "by" if it was a "superseded by"; skip those
    if (!/superseded\s+by/i.test(m[0])) supersedes.add(`ADR-${m[1]}`);
  }
  return { supersedes: [...supersedes].sort(), supersededBy: [...supersededBy].sort() };
}

function findCrateRefs(text) {
  const crates = new Set();
  // crates/<name> path references — capture ONLY the first path segment (the crate name).
  // Anything deeper (e.g., crates/foo/src) is a file reference inside that crate, not a
  // separate crate. The 'ruvix' subworkspace is a known special case: crates/ruvix/crates/<sub>.
  const pathRe = /crates\/([a-zA-Z0-9_-]+)(?:\/(?:crates\/([a-zA-Z0-9_-]+))?)?/g;
  let m;
  while ((m = pathRe.exec(text)) !== null) {
    if (m[1] === 'ruvix' && m[2]) {
      crates.add(`ruvix/${m[2]}`); // nested workspace member
    } else {
      crates.add(m[1]);
    }
  }
  // Backtick-quoted crate-name patterns (ruvector-*, rvf-*, ruqu-*, rvagent-*, ruvix-*,
  // plus a few standalone names from upstream Cargo.toml).
  const tickRe = /`(ruvector-[a-zA-Z0-9_-]+|rvf-[a-zA-Z0-9_-]+|ruqu-[a-zA-Z0-9_-]+|rvagent-[a-zA-Z0-9_-]+|ruvix-[a-zA-Z0-9_-]+|sona|ruvllm|prime-radiant|rvlite|thermorust|cognitum-gate-[a-z]+|mcp-(?:gate|brain|brain-server)|neural-trader-[a-z]+)`/g;
  while ((m = tickRe.exec(text)) !== null) crates.add(m[1]);
  return [...crates].sort();
}

function findFirstParagraph(text) {
  // Skip the H1 line and the metadata block; find the first prose paragraph
  // after a "Context" or "Summary" section if present, else first non-meta paragraph.
  const ctx = text.match(/^##\s+(?:Context|Summary|Background|Overview)\s*\n+([\s\S]+?)(?=\n##\s|\Z)/mi);
  const block = ctx ? ctx[1] : text;
  const paras = block
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('#') && !p.startsWith('|') && !p.startsWith('**Status') && !p.startsWith('**Date') && !p.startsWith('**Authors'));
  const first = paras[0] || '';
  return first.length > 320 ? first.slice(0, 317) + '...' : first;
}

function parseAdr(filePath, fileName) {
  const m = fileName.match(ADR_FILE_RE);
  if (!m) return null;
  const id = parseInt(m[1], 10);
  const subLetter = m[2] || '';
  const idStr = `ADR-${m[1]}${subLetter}`;
  const slug = m[3];
  const text = readFileSync(filePath, 'utf8');
  const lineCount = text.split('\n').length;
  const sizeBytes = Buffer.byteLength(text, 'utf8');

  const { rawStatus, rawDate, formatDetected } = parseHeader(text);
  const title = extractTitle(text, idStr);
  const adrRefs = findAdrRefs(text, idStr);
  const { supersedes, supersededBy } = findSupersedeRels(text);
  const crateRefs = findCrateRefs(text);
  const summary = findFirstParagraph(text);

  return {
    id,
    sub_letter: subLetter || null,
    id_str: idStr,
    title,
    slug,
    file: relative(REPO_ROOT, filePath),
    status: normalizeStatus(rawStatus),
    status_raw: rawStatus,
    date: rawDate,
    format_detected: formatDetected,
    supersedes,
    superseded_by: supersededBy,
    references_adrs: adrRefs,
    references_crates: crateRefs,
    size_bytes: sizeBytes,
    line_count: lineCount,
    summary_first_para: summary,
  };
}

function loadRealCrates() {
  // Build the authoritative set of real upstream crate names from disk.
  // Walks the entire crates/ tree and recognizes any directory whose
  // Cargo.toml has a [package] section as a leaf crate. Naming follows the
  // M2 convention (collision-free disambiguation):
  //   - ruvix nested → "ruvix/<X>"
  //   - rvm   nested → "rvm/<X>"  (collapsed like ruvix)
  //   - everything else → basename, with parent prepended only on collision
  // This replaced an earlier hardcoded version that only knew ruvix and rvf,
  // missing all 10 rvAgent/rvagent-* nested crates and 10 rvm/* nested crates,
  // which incorrectly marked them as ADR-orphans even when ADR-159 etc.
  // explicitly referenced them.
  const cratesRoot = join(REPO_ROOT, 'ruvector', 'crates');

  function isLeafCrate(dirPath) {
    const toml = join(dirPath, 'Cargo.toml');
    if (!existsSync(toml)) return false;
    return /^\[package\]/m.test(readFileSync(toml, 'utf8'));
  }

  const leaves = [];
  function walk(dir, depth = 0) {
    if (depth > 4) return;
    if (isLeafCrate(dir)) {
      leaves.push({ path: dir, rel: dir.slice(cratesRoot.length + 1) });
      return;
    }
    for (const entry of readdirSync(dir).sort()) {
      const p = join(dir, entry);
      try {
        if (!statSync(p).isDirectory()) continue;
      } catch { continue; }
      if (entry === 'target' || entry === 'node_modules' || entry === '.git') continue;
      walk(p, depth + 1);
    }
  }
  walk(cratesRoot);

  // Collapse `ruvix/crates/X` → `ruvix/X` and `rvm/crates/X` → `rvm/X` to
  // match the M2 catalog's naming.
  const candidates = leaves.map((l) => {
    const parts = l.rel.split('/');
    if ((parts[0] === 'ruvix' || parts[0] === 'rvm') && parts[1] === 'crates') parts.splice(1, 1);
    return { parts, name: parts[parts.length - 1] };
  });
  // Collision-only depth-extending dedup.
  for (const c of candidates) c.depth = 1;
  for (let pass = 0; pass < 5; pass++) {
    const counts = {};
    for (const c of candidates) counts[c.name] = (counts[c.name] || 0) + 1;
    const colliding = candidates.filter((c) => counts[c.name] > 1);
    if (colliding.length === 0) break;
    for (const c of colliding) {
      if (c.depth < c.parts.length) {
        c.depth++;
        c.name = c.parts.slice(-c.depth).join('/');
      }
    }
  }
  return new Set(candidates.map((c) => c.name));
}

function buildCatalog() {
  const entries = listEntries(ADR_DIR);
  const adrFiles = entries.filter((e) => !e.isDir && ADR_FILE_RE.test(e.name));
  const supplementaryDirs = entries.filter((e) => e.isDir).map((e) => e.name).sort();
  const otherFiles = entries.filter((e) => !e.isDir && !ADR_FILE_RE.test(e.name)).map((e) => e.name);

  const realCrates = loadRealCrates();

  const adrs = adrFiles
    .map((f) => parseAdr(f.full, f.name))
    .filter(Boolean)
    .sort((a, b) => a.id - b.id || (a.sub_letter || '').localeCompare(b.sub_letter || ''));

  // Stats
  const ids = adrs.map((a) => a.id);
  const highestId = Math.max(...ids);
  const idSet = new Set(ids);
  const missingIds = [];
  for (let i = 1; i <= highestId; i++) if (!idSet.has(i)) missingIds.push(i);

  const byStatus = {};
  const byFormat = {};
  for (const a of adrs) {
    const s = a.status || 'unknown';
    byStatus[s] = (byStatus[s] || 0) + 1;
    byFormat[a.format_detected] = (byFormat[a.format_detected] || 0) + 1;
  }

  // Crate-to-ADR reverse index, with verification against real on-disk crates.
  // Each entry is { adrs: [...], verified: bool } so consumers can tell
  // "ADR mentions a thing that still exists" from "ADR mentions a name that
  // doesn't match any current crate" (renamed / removed / external dep).
  const crateToAdrs = {};
  for (const a of adrs) {
    for (const c of a.references_crates) {
      (crateToAdrs[c] ||= { adrs: [], verified: realCrates.has(c) }).adrs.push(a.id_str);
    }
  }
  const verifiedCount = Object.values(crateToAdrs).filter((v) => v.verified).length;
  const unverifiedRefs = Object.entries(crateToAdrs)
    .filter(([, v]) => !v.verified)
    .map(([k]) => k)
    .sort();
  // Real crates that NO ADR mentions — high-signal "code without a decision record".
  const cratesWithoutAdrs = [...realCrates].filter((c) => !crateToAdrs[c]).sort();

  // Quality flags for review
  const noStatus = adrs.filter((a) => !a.status).map((a) => a.id_str);
  const unknownFormat = adrs.filter((a) => a.format_detected === 'unknown').map((a) => a.id_str);
  const noCrateRefs = adrs.filter((a) => a.references_crates.length === 0).map((a) => a.id_str);
  const noSummary = adrs.filter((a) => !a.summary_first_para).map((a) => a.id_str);

  return {
    version: '1.0',
    extracted_at: new Date().toISOString(),
    source_dir: relative(REPO_ROOT, ADR_DIR),
    upstream_repo: 'https://github.com/ruvnet/ruvector',
    stats: {
      adr_files_parsed: adrs.length,
      supplementary_dirs: supplementaryDirs.length,
      other_files: otherFiles.length,
      highest_id: highestId,
      missing_ids: missingIds,
      missing_ids_count: missingIds.length,
      by_status: Object.fromEntries(Object.entries(byStatus).sort()),
      by_format: byFormat,
      crate_refs_total: Object.keys(crateToAdrs).length,
      crate_refs_verified: verifiedCount,
      crate_refs_unverified: Object.keys(crateToAdrs).length - verifiedCount,
      real_crates_total: realCrates.size,
      real_crates_with_no_adr: cratesWithoutAdrs.length,
      review_flags: {
        no_status: noStatus,
        unknown_format: unknownFormat,
        no_crate_refs_count: noCrateRefs.length, // list omitted if huge
        no_summary_count: noSummary.length,
      },
    },
    crate_to_adrs: Object.fromEntries(
      Object.entries(crateToAdrs)
        .map(([k, v]) => [k, { adrs: v.adrs.sort(), verified: v.verified }])
        .sort(([a], [b]) => a.localeCompare(b))
    ),
    unverified_crate_refs: unverifiedRefs,
    real_crates_with_no_adr: cratesWithoutAdrs,
    supplementary_dirs: supplementaryDirs,
    other_files: otherFiles,
    adrs,
  };
}

function renderMarkdown(catalog) {
  const lines = [];
  lines.push('# ADR Skeleton — auto-generated\n');
  lines.push(`*Generated by \`tools/extract-adrs/extract-adrs.mjs\` on ${catalog.extracted_at}*\n`);
  lines.push(`*Source: \`${catalog.source_dir}\` — do not edit by hand.*\n`);
  lines.push('## Stats\n');
  lines.push(`- ADRs parsed: **${catalog.stats.adr_files_parsed}**`);
  lines.push(`- Highest ID: **ADR-${String(catalog.stats.highest_id).padStart(3, '0')}**`);
  lines.push(`- Missing IDs in range: **${catalog.stats.missing_ids_count}** (${catalog.stats.missing_ids.map((n) => `ADR-${String(n).padStart(3, '0')}`).join(', ') || 'none'})`);
  lines.push(`- Supplementary dirs: ${catalog.supplementary_dirs.map((d) => `\`${d}\``).join(', ')}\n`);
  lines.push('### By status\n');
  for (const [k, v] of Object.entries(catalog.stats.by_status)) lines.push(`- ${k}: ${v}`);
  lines.push('\n### By header format\n');
  for (const [k, v] of Object.entries(catalog.stats.by_format)) lines.push(`- Format ${k}: ${v}`);
  lines.push('\n### Review flags\n');
  const f = catalog.stats.review_flags;
  lines.push(`- ADRs with no parseable status: ${f.no_status.length} ${f.no_status.length ? `(${f.no_status.join(', ')})` : ''}`);
  lines.push(`- ADRs with unknown header format: ${f.unknown_format.length} ${f.unknown_format.length ? `(${f.unknown_format.join(', ')})` : ''}`);
  lines.push(`- ADRs with no crate references: ${f.no_crate_refs_count}`);
  lines.push(`- ADRs with no summary paragraph: ${f.no_summary_count}\n`);

  lines.push('## ADR index\n');
  lines.push('| ID | Title | Status | Date | Refs crates | Refs ADRs |');
  lines.push('|---|---|---|---|---|---|');
  for (const a of catalog.adrs) {
    const crates = a.references_crates.slice(0, 3).join(', ') + (a.references_crates.length > 3 ? `, +${a.references_crates.length - 3}` : '');
    const refs = a.references_adrs.slice(0, 3).join(', ') + (a.references_adrs.length > 3 ? `, +${a.references_adrs.length - 3}` : '');
    lines.push(`| ${a.id_str} | ${(a.title || '').replace(/\|/g, '\\|')} | ${a.status || ''} | ${a.date || ''} | ${crates} | ${refs} |`);
  }

  lines.push('\n## ADR ↔ code drift\n');
  lines.push(`- Real upstream crates on disk: **${catalog.stats.real_crates_total}**`);
  lines.push(`- Crate-name refs in ADRs: **${catalog.stats.crate_refs_total}** (${catalog.stats.crate_refs_verified} verified against on-disk crates, ${catalog.stats.crate_refs_unverified} unverified)`);
  lines.push(`- Real crates with **no** ADR coverage: **${catalog.stats.real_crates_with_no_adr}** — these are high-signal targets for the M3 cataloger (code with no decision record).`);
  if (catalog.real_crates_with_no_adr.length) {
    lines.push('\n<details><summary>Real crates with no ADR coverage</summary>\n');
    for (const c of catalog.real_crates_with_no_adr) lines.push(`- \`${c}\``);
    lines.push('\n</details>\n');
  }
  if (catalog.unverified_crate_refs.length) {
    lines.push('\n<details><summary>Unverified crate refs (renamed / removed / external)</summary>\n');
    for (const c of catalog.unverified_crate_refs) lines.push(`- \`${c}\``);
    lines.push('\n</details>\n');
  }

  lines.push('\n## Crate → ADRs reverse index (verified only)\n');
  lines.push('| Crate | ADRs |');
  lines.push('|---|---|');
  for (const [crate, entry] of Object.entries(catalog.crate_to_adrs)) {
    if (!entry.verified) continue;
    lines.push(`| \`${crate}\` | ${entry.adrs.join(', ')} |`);
  }

  return lines.join('\n') + '\n';
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const catalog = buildCatalog();
  writeFileSync(join(OUT_DIR, 'adrs.json'), JSON.stringify(catalog, null, 2) + '\n');
  writeFileSync(join(OUT_DIR, 'adrs.md'), renderMarkdown(catalog));
  console.log(`✓ Parsed ${catalog.stats.adr_files_parsed} ADRs`);
  console.log(`✓ Highest ID: ADR-${String(catalog.stats.highest_id).padStart(3, '0')}`);
  console.log(`✓ Missing IDs: ${catalog.stats.missing_ids_count}`);
  console.log(`✓ Format breakdown:`, catalog.stats.by_format);
  console.log(`✓ Status breakdown:`, catalog.stats.by_status);
  console.log(`✓ Crates referenced: ${Object.keys(catalog.crate_to_adrs).length}`);
  console.log(`✓ Wrote ${join(OUT_DIR, 'adrs.json')}`);
  console.log(`✓ Wrote ${join(OUT_DIR, 'adrs.md')}`);
  if (catalog.stats.review_flags.no_status.length || catalog.stats.review_flags.unknown_format.length) {
    console.log(`⚠ Review flags surfaced — see catalog/adrs.md`);
  }
}

main();
