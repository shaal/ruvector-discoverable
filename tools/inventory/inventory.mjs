#!/usr/bin/env node
// M2 — Ripgrep-driven public-item inventory.
// Walks every real upstream crate (top-level + ruvix nested + rvf peer),
// extracts `pub` items and NAPI/WASM bindings, cross-references against
// the M1 ADR catalog, and emits:
//   catalog/inventory-bootstrap.json    — full catalog
//   catalog/inventory-bootstrap.md      — human view
//   catalog/hidden-features-bootstrap.md — ADR-orphan crates only (priority list for M3)
//
// Bootstrap quality (per PRD §6.5): does not resolve `pub use` re-exports,
// cfg-gated items, or macro-generated items. Treated as ~70% accurate.
// M3 (`syn` AST parser) supersedes this.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const UPSTREAM = join(REPO_ROOT, 'ruvector');
const CRATES_ROOT = join(UPSTREAM, 'crates');
const OUT_DIR = join(REPO_ROOT, 'catalog');

const ITEM_KINDS = ['fn', 'struct', 'trait', 'enum', 'const', 'static', 'type', 'mod', 'use', 'macro_rules!'];

function loadAdrCatalog() {
  const path = join(OUT_DIR, 'adrs.json');
  if (!existsSync(path)) {
    console.error('catalog/adrs.json not found — run M1 (extract-adrs) first.');
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function isLeafCrate(dirPath) {
  // A leaf crate has Cargo.toml with a [package] section. Workspace wrappers
  // have Cargo.toml with [workspace] but no [package].
  const toml = join(dirPath, 'Cargo.toml');
  if (!existsSync(toml)) return false;
  const text = readFileSync(toml, 'utf8');
  return /^\[package\]/m.test(text);
}

function listRealCrates() {
  // Walk the crates/ tree finding every leaf crate (dir with a [package] section).
  // Naming: start with basename. If two leaves share a basename, disambiguate
  // them by prepending their parent dir, repeating until unique. This keeps
  // simple names simple (`ruvector-core` stays `ruvector-core`) but preserves
  // real architectural duplicates (`rvf/rvf-adapters/sona` vs top-level `sona`).
  // Compatibility shim: `ruvix/crates/<X>` collapses to `ruvix/<X>` to match
  // the M1 ADR catalog's naming convention.
  const leaves = [];
  function walk(dir, depth = 0) {
    if (depth > 4) return;
    if (isLeafCrate(dir)) {
      leaves.push({ path: dir, rel: relative(CRATES_ROOT, dir) });
      return;
    }
    for (const entry of readdirSync(dir).sort()) {
      const p = join(dir, entry);
      if (!statSync(p).isDirectory()) continue;
      if (entry === 'target' || entry === 'node_modules' || entry === '.git') continue;
      walk(p, depth + 1);
    }
  }
  walk(CRATES_ROOT);

  // Apply the M1-compat ruvix collapse, then dedupe by walking up parents.
  const candidates = leaves.map((l) => {
    const parts = l.rel.split('/');
    if (parts[0] === 'ruvix' && parts[1] === 'crates') parts.splice(1, 1); // ruvix/crates/X → ruvix/X
    return { ...l, parts, name: parts[parts.length - 1] };
  });
  // Each candidate has a `depth` it currently uses (1 = basename only).
  // Only colliding candidates have their depth increased.
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
  return candidates
    .map((c) => ({ name: c.name, path: c.path }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

let cratePathIndex = null; // [{ name, prefix }] sorted by prefix length descending
function buildCratePathIndex(crates) {
  cratePathIndex = crates
    .map((c) => ({ name: c.name, prefix: relative(UPSTREAM, c.path) + '/' }))
    .sort((a, b) => b.prefix.length - a.prefix.length);
}

function readCargoMeta(cratePath) {
  // Tiny ad-hoc TOML reader: just pulls name and version from a [package] block.
  const tomlPath = join(cratePath, 'Cargo.toml');
  if (!existsSync(tomlPath)) return { has_manifest: false };
  const text = readFileSync(tomlPath, 'utf8');
  const pkgMatch = text.match(/\[package\]([\s\S]*?)(?=\n\[|$)/);
  if (!pkgMatch) return { has_manifest: true, has_package_section: false };
  const block = pkgMatch[1];
  const name = (block.match(/^\s*name\s*=\s*"([^"]+)"/m) || [])[1] || null;
  const version = (block.match(/^\s*version\s*=\s*(?:"([^"]+)"|\{[^}]*workspace\s*=\s*true)/m) || [])[1] || null;
  const edition = (block.match(/^\s*edition\s*=\s*"([^"]+)"/m) || [])[1] || null;
  // Detect crate-type to distinguish lib / proc-macro / cdylib (relevant for napi/wasm crates).
  const libBlock = (text.match(/\[lib\]([\s\S]*?)(?=\n\[|$)/) || [])[1];
  const crateType = libBlock ? (libBlock.match(/crate-type\s*=\s*\[([^\]]+)\]/) || [])[1]?.trim() ?? null : null;
  return {
    has_manifest: true,
    has_package_section: true,
    cargo_name: name,
    cargo_version: version,
    edition,
    crate_type: crateType,
  };
}

function rgLines(pattern, args = []) {
  // Returns list of { file, line, content } from running ripgrep.
  // Empty result is fine (rg exits 1). Other failures throw.
  try {
    const out = execFileSync(
      'rg',
      [
        '-n', '--no-heading', '--color=never', '--no-messages',
        '-g', 'crates/**/src/**/*.rs',
        '-g', '!**/target/**',
        '-g', '!**/tests/**',
        '-g', '!**/benches/**',
        '-g', '!**/examples/**',
        ...args,
        pattern,
        '.',
      ],
      { cwd: UPSTREAM, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
    );
    return parseRgOutput(out);
  } catch (err) {
    if (err.status === 1) return []; // no matches
    throw err;
  }
}

function parseRgOutput(out) {
  // Format: PATH:LINE:CONTENT  (PATH is './crates/.../foo.rs')
  return out
    .split('\n')
    .filter(Boolean)
    .map((row) => {
      // First two colons separate path / line / content. Path itself contains no colon
      // on this filesystem, so a simple split works.
      const i1 = row.indexOf(':');
      const i2 = row.indexOf(':', i1 + 1);
      if (i1 < 0 || i2 < 0) return null;
      const file = row.slice(0, i1).replace(/^\.\//, '');
      const line = parseInt(row.slice(i1 + 1, i2), 10);
      const content = row.slice(i2 + 1);
      return { file, line, content };
    })
    .filter(Boolean);
}

function pathToCrate(file) {
  // Use longest-prefix match against the leaf-crate path index. Generic: handles
  // any workspace wrapper layout, not just the ones we've seen.
  if (!cratePathIndex) throw new Error('cratePathIndex not initialized');
  for (const { name, prefix } of cratePathIndex) {
    if (file.startsWith(prefix)) return name;
  }
  return null;
}

function classifyPubItem(content) {
  // content is something like '    pub fn foo<T>(x: T) -> Self {'
  // or 'pub use crate::foo::Bar;'
  // or 'pub(crate) fn ignored() {'  ← already excluded by regex caller
  const m = content.match(/^\s*pub\s+(async\s+)?(?:unsafe\s+)?(fn|struct|trait|enum|const|static|type|mod|use|macro_rules!)\b\s*([A-Za-z_][A-Za-z0-9_]*)?/);
  if (!m) return null;
  return {
    kind: m[2],
    name: m[3] || null, // null is fine for `pub use crate::foo::*;` etc.
    is_async: Boolean(m[1]),
    raw: content.trim(),
  };
}

function buildInventory(adrCatalog, crates) {
  // One sweep for `pub ` items (then we filter out pub(crate)/pub(super)/pub(in) in JS).
  console.log('  Sweeping pub items with ripgrep...');
  const pubLines = rgLines('^\\s*pub\\s', []);
  console.log(`    ${pubLines.length} candidate lines`);

  console.log('  Sweeping #[napi] attributes...');
  const napiLines = rgLines('^\\s*#\\[napi', []);
  console.log(`    ${napiLines.length} matches`);

  console.log('  Sweeping #[wasm_bindgen] attributes...');
  const wasmLines = rgLines('^\\s*#\\[wasm_bindgen', []);
  console.log(`    ${wasmLines.length} matches`);

  console.log('  Sweeping #[macro_export] attributes...');
  const macroExportLines = rgLines('^\\s*#\\[macro_export', []);
  console.log(`    ${macroExportLines.length} matches`);

  // Build crate map. Each crate gets a `category` reflecting where it sits in
  // the workspace tree: "library" (default), "test", "bench", "example", or
  // "binary" (only main.rs, no lib.rs). M3 / SDK consumers can filter these.
  const crateByName = new Map(crates.map((c) => {
    const rel = relative(UPSTREAM, c.path);
    let category = 'library';
    if (/(^|\/)tests\//.test(rel)) category = 'test';
    else if (/(^|\/)benches\//.test(rel)) category = 'bench';
    else if (/(^|\/)examples\//.test(rel)) category = 'example';
    return [c.name, {
      name: c.name,
      path: rel,
      category,
      cargo: readCargoMeta(c.path),
      adrs: [],
      is_adr_orphan: false,
      files: new Set(),
      items: [],
      napi_bindings: [],
      wasm_bindings: [],
      macro_exports: [],
      excluded_pub_modifiers: 0,
    }];
  }));

  // Cross-reference ADRs. An M2 crate is an "ADR orphan" iff M1's reverse index
  // has no verified entry for it. This handles crates M1 didn't know existed
  // (rvAgent/rvm nested members) — they are orphans by definition.
  for (const c of crateByName.values()) {
    const ref = adrCatalog.crate_to_adrs[c.name];
    if (ref && ref.verified) {
      c.adrs = ref.adrs.slice();
      c.is_adr_orphan = false;
    } else {
      c.adrs = [];
      c.is_adr_orphan = true;
    }
  }

  // Bucket pub-item lines into crates.
  let mismatched = 0;
  for (const row of pubLines) {
    const crate = pathToCrate(row.file);
    if (!crate || !crateByName.has(crate)) { mismatched++; continue; }
    const c = crateByName.get(crate);
    c.files.add(row.file);
    // Filter out pub(crate)/pub(super)/pub(in ...) — restricted visibility, not exported.
    if (/^\s*pub\s*\(/.test(row.content)) { c.excluded_pub_modifiers++; continue; }
    const cls = classifyPubItem(row.content);
    if (!cls) continue;
    c.items.push({ ...cls, file: row.file, line: row.line });
  }
  if (mismatched) console.log(`  ⚠ ${mismatched} pub-line matches did not map to a known crate`);

  for (const row of napiLines) {
    const crate = pathToCrate(row.file);
    if (crate && crateByName.has(crate)) {
      crateByName.get(crate).napi_bindings.push({ file: row.file, line: row.line, content: row.content });
    }
  }
  for (const row of wasmLines) {
    const crate = pathToCrate(row.file);
    if (crate && crateByName.has(crate)) {
      crateByName.get(crate).wasm_bindings.push({ file: row.file, line: row.line, content: row.content });
    }
  }
  for (const row of macroExportLines) {
    const crate = pathToCrate(row.file);
    if (crate && crateByName.has(crate)) {
      crateByName.get(crate).macro_exports.push({ file: row.file, line: row.line });
    }
  }

  // Detect binary-only crates: 0 public items AND no lib.rs in src/.
  for (const c of crateByName.values()) {
    if (c.category === 'library' && c.items.length === 0) {
      const libPath = join(UPSTREAM, c.path, 'src', 'lib.rs');
      const mainPath = join(UPSTREAM, c.path, 'src', 'main.rs');
      if (!existsSync(libPath) && existsSync(mainPath)) c.category = 'binary';
    }
  }

  const cratesOut = [...crateByName.values()].map((c) => ({
    name: c.name,
    path: c.path,
    category: c.category,
    cargo: c.cargo,
    adrs: c.adrs,
    is_adr_orphan: c.is_adr_orphan,
    rs_files_with_pub_items: c.files.size,
    public_items_count: c.items.length,
    public_items_by_kind: countByKind(c.items),
    napi_count: c.napi_bindings.length,
    wasm_count: c.wasm_bindings.length,
    macro_export_count: c.macro_exports.length,
    excluded_pub_modifiers: c.excluded_pub_modifiers,
    public_items: c.items.sort(itemSort),
    napi_bindings: c.napi_bindings.sort(locSort),
    wasm_bindings: c.wasm_bindings.sort(locSort),
    macro_exports: c.macro_exports.sort(locSort),
  })).sort((a, b) => a.name.localeCompare(b.name));

  return cratesOut;
}

function countByKind(items) {
  const out = {};
  for (const it of items) out[it.kind] = (out[it.kind] || 0) + 1;
  return out;
}
function itemSort(a, b) { return a.file.localeCompare(b.file) || a.line - b.line; }
function locSort(a, b)  { return a.file.localeCompare(b.file) || a.line - b.line; }

function buildStats(crates) {
  const totalItems = crates.reduce((n, c) => n + c.public_items_count, 0);
  const byKind = {};
  for (const c of crates) for (const [k, n] of Object.entries(c.public_items_by_kind)) byKind[k] = (byKind[k] || 0) + n;

  const napiTotal = crates.reduce((n, c) => n + c.napi_count, 0);
  const wasmTotal = crates.reduce((n, c) => n + c.wasm_count, 0);
  const napiCrates = crates.filter((c) => c.napi_count > 0).map((c) => c.name);
  const wasmCrates = crates.filter((c) => c.wasm_count > 0).map((c) => c.name);

  const zeroItemCrates = crates.filter((c) => c.public_items_count === 0).map((c) => c.name);
  const orphans = crates.filter((c) => c.is_adr_orphan);
  const orphanItems = orphans.reduce((n, c) => n + c.public_items_count, 0);

  const byCategory = {};
  for (const c of crates) byCategory[c.category] = (byCategory[c.category] || 0) + 1;

  return {
    crates_scanned: crates.length,
    by_category: byCategory,
    public_items_total: totalItems,
    public_items_by_kind: Object.fromEntries(Object.entries(byKind).sort()),
    napi_bindings_total: napiTotal,
    wasm_bindings_total: wasmTotal,
    crates_with_napi: napiCrates,
    crates_with_wasm: wasmCrates,
    crates_with_zero_public_items: zeroItemCrates,
    adr_orphan_crates: orphans.length,
    adr_orphan_public_items_total: orphanItems,
  };
}

function renderInventoryMd(stats, crates) {
  const lines = [];
  lines.push('# Inventory Bootstrap (M2) — auto-generated\n');
  lines.push(`*Generated by \`tools/inventory/inventory.mjs\`. Bootstrap quality — see PRD §6.5.*\n`);
  lines.push('## Stats\n');
  lines.push(`- Crates scanned: **${stats.crates_scanned}**`);
  lines.push(`- Public items total: **${stats.public_items_total}**`);
  lines.push(`- NAPI bindings: **${stats.napi_bindings_total}** across ${stats.crates_with_napi.length} crates`);
  lines.push(`- WASM bindings: **${stats.wasm_bindings_total}** across ${stats.crates_with_wasm.length} crates`);
  lines.push(`- ADR-orphan crates: **${stats.adr_orphan_crates}** (${stats.adr_orphan_public_items_total} public items hidden behind no decision record)`);
  lines.push(`- Crates with zero public items found: ${stats.crates_with_zero_public_items.length}\n`);
  lines.push('### By kind\n');
  for (const [k, n] of Object.entries(stats.public_items_by_kind)) lines.push(`- \`${k}\`: ${n}`);
  lines.push('\n## Per-crate summary\n');
  lines.push('| Crate | ADRs | Items | fn | struct | trait | enum | mod | use | NAPI | WASM | Orphan |');
  lines.push('|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|');
  for (const c of crates) {
    const k = c.public_items_by_kind;
    lines.push([
      `\`${c.name}\``,
      c.adrs.length ? c.adrs.length : '—',
      c.public_items_count,
      k.fn || 0, k.struct || 0, k.trait || 0, k.enum || 0, k.mod || 0, k.use || 0,
      c.napi_count, c.wasm_count,
      c.is_adr_orphan ? '🟧' : '',
    ].join(' | ').replace(/^/, '| ') + ' |');
  }
  return lines.join('\n') + '\n';
}

function renderHiddenMd(crates) {
  const orphans = crates.filter((c) => c.is_adr_orphan).sort((a, b) => b.public_items_count - a.public_items_count);
  const lines = [];
  lines.push('# Hidden Features — ADR-orphan crates (M2 bootstrap)\n');
  lines.push('*These crates exist on disk but are referenced by no ADR.*');
  lines.push('*Sorted by public-item count — biggest hidden surfaces first. Priority targets for M3.*\n');
  for (const c of orphans) {
    lines.push(`## \`${c.name}\` — ${c.public_items_count} public items (${c.napi_count} NAPI, ${c.wasm_count} WASM)`);
    lines.push(`*${c.path}*\n`);
    if (c.public_items_count === 0) { lines.push('_(no `pub` items found by ripgrep — may be empty, generated, or all visibility-restricted)_\n'); continue; }
    lines.push('| Kind | Name | File:Line |');
    lines.push('|---|---|---|');
    // Show top 25 items per orphan crate to keep the file readable.
    for (const it of c.public_items.slice(0, 25)) {
      lines.push(`| \`${it.kind}\` | \`${it.name || '(unnamed)'}\` | \`${it.file}:${it.line}\` |`);
    }
    if (c.public_items.length > 25) lines.push(`\n_... +${c.public_items.length - 25} more — see \`catalog/inventory-bootstrap.json\`_\n`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log('Loading M1 ADR catalog...');
  const adrCatalog = loadAdrCatalog();
  console.log(`  ${adrCatalog.stats.adr_files_parsed} ADRs, ${adrCatalog.stats.real_crates_total} real crates known`);

  console.log('Listing crates from disk (leaf crates only — workspace wrappers excluded)...');
  const crates = listRealCrates();
  buildCratePathIndex(crates);
  console.log(`  ${crates.length} leaf crates found`);

  console.log('Building inventory (this is the heavy step)...');
  const inventory = buildInventory(adrCatalog, crates);
  const stats = buildStats(inventory);

  const out = {
    version: '0.1-bootstrap',
    phase: 'M2-ripgrep',
    extracted_at: new Date().toISOString(),
    upstream_version: '2.2.0',
    notes: 'Ripgrep-driven; does NOT resolve `pub use` chains, cfg gates, or macro-generated items. Treat as ~70% accurate. Authoritative inventory is M3 (syn AST parser).',
    stats,
    crates: inventory,
  };

  writeFileSync(join(OUT_DIR, 'inventory-bootstrap.json'), JSON.stringify(out, null, 2) + '\n');
  writeFileSync(join(OUT_DIR, 'inventory-bootstrap.md'), renderInventoryMd(stats, inventory));
  writeFileSync(join(OUT_DIR, 'hidden-features-bootstrap.md'), renderHiddenMd(inventory));

  console.log('\n=== Summary ===');
  console.log(`Crates scanned:            ${stats.crates_scanned}`);
  console.log(`Public items found:        ${stats.public_items_total}`);
  console.log(`  by kind:                 ${JSON.stringify(stats.public_items_by_kind)}`);
  console.log(`NAPI bindings:             ${stats.napi_bindings_total} (${stats.crates_with_napi.length} crates)`);
  console.log(`WASM bindings:             ${stats.wasm_bindings_total} (${stats.crates_with_wasm.length} crates)`);
  console.log(`ADR-orphan crates:         ${stats.adr_orphan_crates}`);
  console.log(`  hidden public items:     ${stats.adr_orphan_public_items_total}`);
  console.log(`Crates with 0 pub items:   ${stats.crates_with_zero_public_items.length}`);
  console.log(`\nWrote:`);
  console.log(`  catalog/inventory-bootstrap.json`);
  console.log(`  catalog/inventory-bootstrap.md`);
  console.log(`  catalog/hidden-features-bootstrap.md`);
}

main();
