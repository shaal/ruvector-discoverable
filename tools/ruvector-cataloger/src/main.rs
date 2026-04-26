//! M3 — syn-based AST cataloger.
//!
//! Reads the M2 inventory (catalog/inventory-bootstrap.json), then for every
//! crate with a `src/lib.rs` parses the file and recursively resolves every
//! `mod foo;` declaration. Emits a structured catalog that captures what
//! ripgrep cannot:
//!
//!   - actual public-item kinds for `pub use` re-exports (deferred to v0.2 —
//!     v0.1 records the use-tree path string, like M2 does)
//!   - `#[cfg(...)]` gate stack accumulated through the module tree
//!   - `#[napi]` / `#[wasm_bindgen]` / `#[macro_export]` attached to the
//!     specific item they expose (M2 only counted attribute lines)
//!   - doc comments
//!   - precise spans (file + line)
//!
//! v0.1 limits, declared in the JSON's `notes` field:
//!   - cross-crate `pub use` chains not followed
//!   - feature flags not evaluated combinatorially — items inside `#[cfg(...)]`
//!     are recorded with their gate string, not filtered
//!   - macros are not expanded; NAPI/WASM bindings are observed at the
//!     attribute layer (we know which item they decorate, not what gets
//!     generated under it)

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use syn::spanned::Spanned;
use syn::{Attribute, Item, Visibility};

// ---------------- M2 input ----------------

#[derive(Debug, Deserialize)]
struct M2Catalog {
    crates: Vec<M2Crate>,
}

#[derive(Debug, Deserialize)]
struct M2Crate {
    name: String,
    path: String,
    category: String,
    is_adr_orphan: bool,
    adrs: Vec<String>,
    public_items_count: u64,
}

// ---------------- M3 output ----------------

#[derive(Debug, Default, Serialize)]
struct M3Catalog {
    version: String,
    phase: String,
    extracted_at: String,
    upstream_version: String,
    notes: String,
    stats: M3Stats,
    crates: Vec<ParsedCrate>,
}

#[derive(Debug, Default, Serialize)]
struct M3Stats {
    crates_attempted: usize,
    crates_with_lib_rs: usize,
    crates_without_lib_rs: usize,
    parse_failures: usize,
    files_parsed: usize,
    public_items_total: usize,
    by_kind: BTreeMap<String, usize>,
    by_category: BTreeMap<String, usize>,
    napi_items: usize,
    wasm_items: usize,
    macro_export_items: usize,
    cfg_gated_items: usize,
    items_with_doc: usize,
    deprecated_items: usize,
    adr_orphan_items: usize,
}

#[derive(Debug, Default, Serialize)]
struct ParsedCrate {
    name: String,
    path: String,
    category: String,
    is_adr_orphan: bool,
    adrs: Vec<String>,
    has_lib_rs: bool,
    parse_error: Option<String>,
    files_parsed: Vec<String>,
    items: Vec<PubItem>,
    napi_count: usize,
    wasm_count: usize,
    macro_export_count: usize,
}

#[derive(Debug, Serialize)]
struct PubItem {
    kind: String,            // fn | struct | enum | trait | const | static | type | mod | use | macro
    name: Option<String>,    // None for some `pub use` patterns
    module_path: String,     // dotted path inside the crate, e.g. "core::engine::Index"
    file: String,            // relative to upstream root
    line: usize,
    is_async: bool,
    is_unsafe: bool,
    is_napi: bool,
    is_wasm: bool,
    is_macro_export: bool,
    is_deprecated: bool,
    cfg_gates: Vec<String>,  // accumulated #[cfg(...)] from the mod stack and the item itself
    doc: Option<String>,
    signature: String,       // first line of the rendered item, capped
    extra: BTreeMap<String, String>, // kind-specific data (variant_count, field_count, ...)
}

// ---------------- Parsing ----------------

struct CrateParser<'a> {
    upstream: &'a Path,
    crate_root: PathBuf,        // absolute path to crate dir
    files_parsed: Vec<String>,  // relative-to-upstream
    items: Vec<PubItem>,
    parse_error: Option<String>,
}

impl<'a> CrateParser<'a> {
    fn new(upstream: &'a Path, crate_path_rel: &str) -> Self {
        Self {
            upstream,
            crate_root: upstream.join(crate_path_rel),
            files_parsed: Vec::new(),
            items: Vec::new(),
            parse_error: None,
        }
    }

    fn parse_lib(&mut self) -> bool {
        let lib_rs = self.crate_root.join("src").join("lib.rs");
        if !lib_rs.exists() {
            return false;
        }
        self.parse_module_file(&lib_rs, &[], &[]);
        true
    }

    fn parse_module_file(&mut self, file: &Path, module_path: &[String], cfg_stack: &[String]) {
        let content = match fs::read_to_string(file) {
            Ok(s) => s,
            Err(e) => {
                self.parse_error = Some(format!("read {}: {}", file.display(), e));
                return;
            }
        };
        let parsed = match syn::parse_file(&content) {
            Ok(f) => f,
            Err(e) => {
                self.parse_error = Some(format!("parse {}: {}", file.display(), e));
                return;
            }
        };
        let rel = file
            .strip_prefix(self.upstream)
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|_| file.to_string_lossy().into_owned());
        self.files_parsed.push(rel.clone());
        self.walk_items(&parsed.items, file, module_path, cfg_stack);
    }

    fn walk_items(
        &mut self,
        items: &[Item],
        file: &Path,
        module_path: &[String],
        cfg_stack: &[String],
    ) {
        for item in items {
            // Compute attributes once so we can read them per-item-kind below.
            let attrs = item_attrs(item);
            let mut item_cfgs = collect_cfgs(attrs);
            let mut full_cfgs: Vec<String> =
                cfg_stack.iter().cloned().chain(item_cfgs.drain(..)).collect();
            let is_napi = has_attr_path(attrs, "napi");
            let is_wasm = has_attr_path(attrs, "wasm_bindgen");
            let is_macro_export = has_attr_path(attrs, "macro_export");
            let is_deprecated = has_attr_path(attrs, "deprecated");
            let doc = collect_doc(attrs);

            match item {
                Item::Fn(f) if is_pub(&f.vis) => {
                    let span = f.sig.ident.span().start();
                    let signature = render_first_line(&format!(
                        "pub {}fn {}{}(...)",
                        if f.sig.asyncness.is_some() { "async " } else { "" },
                        f.sig.ident,
                        render_generics(&f.sig.generics),
                    ));
                    self.items.push(PubItem {
                        kind: "fn".into(),
                        name: Some(f.sig.ident.to_string()),
                        module_path: module_path.join("::"),
                        file: rel_str(self.upstream, file),
                        line: span.line,
                        is_async: f.sig.asyncness.is_some(),
                        is_unsafe: f.sig.unsafety.is_some(),
                        is_napi,
                        is_wasm,
                        is_macro_export,
                        is_deprecated,
                        cfg_gates: full_cfgs,
                        doc,
                        signature,
                        extra: BTreeMap::new(),
                    });
                }
                Item::Struct(s) if is_pub(&s.vis) => {
                    let span = s.ident.span().start();
                    let mut extra = BTreeMap::new();
                    let (field_count, is_tuple) = match &s.fields {
                        syn::Fields::Named(n) => (n.named.len(), false),
                        syn::Fields::Unnamed(u) => (u.unnamed.len(), true),
                        syn::Fields::Unit => (0, false),
                    };
                    extra.insert("field_count".into(), field_count.to_string());
                    extra.insert("is_tuple".into(), is_tuple.to_string());
                    self.items.push(PubItem {
                        kind: "struct".into(),
                        name: Some(s.ident.to_string()),
                        module_path: module_path.join("::"),
                        file: rel_str(self.upstream, file),
                        line: span.line,
                        is_async: false,
                        is_unsafe: false,
                        is_napi,
                        is_wasm,
                        is_macro_export,
                        is_deprecated,
                        cfg_gates: full_cfgs,
                        doc,
                        signature: format!("pub struct {}{}", s.ident, render_generics(&s.generics)),
                        extra,
                    });
                }
                Item::Enum(e) if is_pub(&e.vis) => {
                    let span = e.ident.span().start();
                    let mut extra = BTreeMap::new();
                    extra.insert("variant_count".into(), e.variants.len().to_string());
                    self.items.push(PubItem {
                        kind: "enum".into(),
                        name: Some(e.ident.to_string()),
                        module_path: module_path.join("::"),
                        file: rel_str(self.upstream, file),
                        line: span.line,
                        is_async: false,
                        is_unsafe: false,
                        is_napi,
                        is_wasm,
                        is_macro_export,
                        is_deprecated,
                        cfg_gates: full_cfgs,
                        doc,
                        signature: format!("pub enum {}{}", e.ident, render_generics(&e.generics)),
                        extra,
                    });
                }
                Item::Trait(t) if is_pub(&t.vis) => {
                    let span = t.ident.span().start();
                    let mut extra = BTreeMap::new();
                    extra.insert("item_count".into(), t.items.len().to_string());
                    self.items.push(PubItem {
                        kind: "trait".into(),
                        name: Some(t.ident.to_string()),
                        module_path: module_path.join("::"),
                        file: rel_str(self.upstream, file),
                        line: span.line,
                        is_async: false,
                        is_unsafe: t.unsafety.is_some(),
                        is_napi,
                        is_wasm,
                        is_macro_export,
                        is_deprecated,
                        cfg_gates: full_cfgs,
                        doc,
                        signature: format!("pub trait {}{}", t.ident, render_generics(&t.generics)),
                        extra,
                    });
                }
                Item::Const(c) if is_pub(&c.vis) => {
                    let span = c.ident.span().start();
                    self.items.push(PubItem {
                        kind: "const".into(),
                        name: Some(c.ident.to_string()),
                        module_path: module_path.join("::"),
                        file: rel_str(self.upstream, file),
                        line: span.line,
                        is_async: false,
                        is_unsafe: false,
                        is_napi,
                        is_wasm,
                        is_macro_export,
                        is_deprecated,
                        cfg_gates: full_cfgs,
                        doc,
                        signature: format!("pub const {}: ...", c.ident),
                        extra: BTreeMap::new(),
                    });
                }
                Item::Static(s) if is_pub(&s.vis) => {
                    let span = s.ident.span().start();
                    self.items.push(PubItem {
                        kind: "static".into(),
                        name: Some(s.ident.to_string()),
                        module_path: module_path.join("::"),
                        file: rel_str(self.upstream, file),
                        line: span.line,
                        is_async: false,
                        is_unsafe: false,
                        is_napi,
                        is_wasm,
                        is_macro_export,
                        is_deprecated,
                        cfg_gates: full_cfgs,
                        doc,
                        signature: format!("pub static {}: ...", s.ident),
                        extra: BTreeMap::new(),
                    });
                }
                Item::Type(t) if is_pub(&t.vis) => {
                    let span = t.ident.span().start();
                    self.items.push(PubItem {
                        kind: "type".into(),
                        name: Some(t.ident.to_string()),
                        module_path: module_path.join("::"),
                        file: rel_str(self.upstream, file),
                        line: span.line,
                        is_async: false,
                        is_unsafe: false,
                        is_napi,
                        is_wasm,
                        is_macro_export,
                        is_deprecated,
                        cfg_gates: full_cfgs,
                        doc,
                        signature: format!("pub type {} = ...", t.ident),
                        extra: BTreeMap::new(),
                    });
                }
                Item::Use(u) if is_pub(&u.vis) => {
                    // v0.1: record the use-tree as text, don't resolve targets.
                    let tree_str = use_tree_to_string(&u.tree);
                    let line = u.use_token.span.start().line;
                    self.items.push(PubItem {
                        kind: "use".into(),
                        name: use_tree_leaf_name(&u.tree),
                        module_path: module_path.join("::"),
                        file: rel_str(self.upstream, file),
                        line,
                        is_async: false,
                        is_unsafe: false,
                        is_napi,
                        is_wasm,
                        is_macro_export,
                        is_deprecated,
                        cfg_gates: full_cfgs.clone(),
                        doc,
                        signature: format!("pub use {};", tree_str),
                        extra: {
                            let mut m = BTreeMap::new();
                            m.insert("path".into(), tree_str);
                            m
                        },
                    });
                }
                Item::Mod(m) => {
                    // Record the pub mod itself if visible.
                    if is_pub(&m.vis) {
                        let span = m.ident.span().start();
                        self.items.push(PubItem {
                            kind: "mod".into(),
                            name: Some(m.ident.to_string()),
                            module_path: module_path.join("::"),
                            file: rel_str(self.upstream, file),
                            line: span.line,
                            is_async: false,
                            is_unsafe: false,
                            is_napi,
                            is_wasm,
                            is_macro_export,
                            is_deprecated,
                            cfg_gates: full_cfgs.clone(),
                            doc: doc.clone(),
                            signature: format!("pub mod {};", m.ident),
                            extra: BTreeMap::new(),
                        });
                    }
                    // Recurse into the module body.
                    let mut new_path = module_path.to_vec();
                    new_path.push(m.ident.to_string());
                    let new_cfgs: Vec<String> = full_cfgs.clone();
                    if let Some((_, items)) = &m.content {
                        // Inline module — same file.
                        self.walk_items(items, file, &new_path, &new_cfgs);
                    } else {
                        // External module — find the file.
                        let path_attr = attrs
                            .iter()
                            .find(|a| a.path().is_ident("path"))
                            .and_then(parse_path_attr);
                        if let Some(child) = resolve_module_file(file, &m.ident.to_string(), path_attr.as_deref()) {
                            self.parse_module_file(&child, &new_path, &new_cfgs);
                        } else {
                            // Module file not found — common for cfg-gated platform mods. Silent.
                        }
                    }
                }
                Item::Macro(m) => {
                    // pub macros (declarative) — usually `#[macro_export] macro_rules! foo`.
                    if is_macro_export {
                        let name = m.ident.as_ref().map(|i| i.to_string());
                        let line = m.mac.path.span().start().line;
                        self.items.push(PubItem {
                            kind: "macro".into(),
                            name,
                            module_path: module_path.join("::"),
                            file: rel_str(self.upstream, file),
                            line,
                            is_async: false,
                            is_unsafe: false,
                            is_napi,
                            is_wasm,
                            is_macro_export: true,
                            is_deprecated,
                            cfg_gates: full_cfgs,
                            doc,
                            signature: "pub macro_rules! ...".into(),
                            extra: BTreeMap::new(),
                        });
                    }
                }
                _ => {}
            }
        }
    }
}

// ---------------- Helpers ----------------

fn is_pub(v: &Visibility) -> bool {
    matches!(v, Visibility::Public(_))
}

fn item_attrs(item: &Item) -> &[Attribute] {
    match item {
        Item::Const(i) => &i.attrs,
        Item::Enum(i) => &i.attrs,
        Item::ExternCrate(i) => &i.attrs,
        Item::Fn(i) => &i.attrs,
        Item::ForeignMod(i) => &i.attrs,
        Item::Impl(i) => &i.attrs,
        Item::Macro(i) => &i.attrs,
        Item::Mod(i) => &i.attrs,
        Item::Static(i) => &i.attrs,
        Item::Struct(i) => &i.attrs,
        Item::Trait(i) => &i.attrs,
        Item::TraitAlias(i) => &i.attrs,
        Item::Type(i) => &i.attrs,
        Item::Union(i) => &i.attrs,
        Item::Use(i) => &i.attrs,
        _ => &[],
    }
}

fn has_attr_path(attrs: &[Attribute], name: &str) -> bool {
    attrs.iter().any(|a| a.path().is_ident(name))
}

fn collect_cfgs(attrs: &[Attribute]) -> Vec<String> {
    attrs
        .iter()
        .filter(|a| a.path().is_ident("cfg") || a.path().is_ident("cfg_attr"))
        .map(|a| {
            // Render the attribute as text. tokens_to_string-ish.
            let tokens = a.meta.to_token_stream_string();
            tokens
        })
        .collect()
}

fn collect_doc(attrs: &[Attribute]) -> Option<String> {
    let mut docs: Vec<String> = Vec::new();
    for a in attrs {
        if !a.path().is_ident("doc") {
            continue;
        }
        if let syn::Meta::NameValue(nv) = &a.meta {
            if let syn::Expr::Lit(syn::ExprLit { lit: syn::Lit::Str(s), .. }) = &nv.value {
                docs.push(s.value().trim().to_string());
            }
        }
    }
    if docs.is_empty() {
        None
    } else {
        let joined = docs.join("\n");
        Some(if joined.len() > 400 {
            format!("{}...", &joined[..397])
        } else {
            joined
        })
    }
}

trait MetaToString {
    fn to_token_stream_string(&self) -> String;
}
impl MetaToString for syn::Meta {
    fn to_token_stream_string(&self) -> String {
        use quote::ToTokens;
        let mut s = String::new();
        let ts = self.to_token_stream();
        s.push_str(&ts.to_string());
        // Compress whitespace.
        s.split_whitespace().collect::<Vec<_>>().join(" ")
    }
}

fn render_generics(g: &syn::Generics) -> String {
    if g.params.is_empty() {
        String::new()
    } else {
        let names: Vec<String> = g
            .params
            .iter()
            .map(|p| match p {
                syn::GenericParam::Type(t) => t.ident.to_string(),
                syn::GenericParam::Lifetime(l) => format!("'{}", l.lifetime.ident),
                syn::GenericParam::Const(c) => format!("const {}", c.ident),
            })
            .collect();
        format!("<{}>", names.join(", "))
    }
}

fn render_first_line(s: &str) -> String {
    let line = s.lines().next().unwrap_or(s).trim_end();
    if line.len() > 200 {
        format!("{}...", &line[..197])
    } else {
        line.to_string()
    }
}

fn rel_str(upstream: &Path, file: &Path) -> String {
    file.strip_prefix(upstream)
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|_| file.to_string_lossy().into_owned())
}

fn parse_path_attr(a: &Attribute) -> Option<String> {
    if let syn::Meta::NameValue(nv) = &a.meta {
        if let syn::Expr::Lit(syn::ExprLit { lit: syn::Lit::Str(s), .. }) = &nv.value {
            return Some(s.value());
        }
    }
    None
}

fn resolve_module_file(parent_file: &Path, mod_name: &str, path_attr: Option<&str>) -> Option<PathBuf> {
    let parent_dir = parent_file.parent()?;
    if let Some(p) = path_attr {
        let candidate = parent_dir.join(p);
        return if candidate.exists() { Some(candidate) } else { None };
    }
    let parent_stem = parent_file.file_stem()?.to_string_lossy().into_owned();
    let is_root = parent_stem == "lib" || parent_stem == "main" || parent_stem == "mod";
    let search_dir = if is_root {
        parent_dir.to_path_buf()
    } else {
        parent_dir.join(&parent_stem)
    };
    let direct = search_dir.join(format!("{}.rs", mod_name));
    if direct.exists() {
        return Some(direct);
    }
    let nested = search_dir.join(mod_name).join("mod.rs");
    if nested.exists() {
        return Some(nested);
    }
    None
}

fn use_tree_to_string(tree: &syn::UseTree) -> String {
    use quote::ToTokens;
    let ts = tree.to_token_stream();
    ts.to_string().split_whitespace().collect::<Vec<_>>().join(" ")
}

fn use_tree_leaf_name(tree: &syn::UseTree) -> Option<String> {
    match tree {
        syn::UseTree::Name(n) => Some(n.ident.to_string()),
        syn::UseTree::Rename(r) => Some(r.rename.to_string()),
        syn::UseTree::Path(p) => use_tree_leaf_name(&p.tree),
        syn::UseTree::Glob(_) => Some("*".into()),
        syn::UseTree::Group(_) => None,
    }
}

// ---------------- Driver ----------------

fn main() {
    let upstream = PathBuf::from(std::env::var("UPSTREAM").unwrap_or_else(|_| "ruvector".into()));
    let m2_path = PathBuf::from("catalog/inventory-bootstrap.json");
    let out_dir = PathBuf::from("catalog");

    eprintln!("Loading M2 inventory from {}...", m2_path.display());
    let m2_text = fs::read_to_string(&m2_path).expect("read m2 inventory");
    let m2: M2Catalog = serde_json::from_str(&m2_text).expect("parse m2");
    eprintln!("  {} crates", m2.crates.len());

    let mut catalog = M3Catalog {
        version: "0.1".into(),
        phase: "M3-syn-ast".into(),
        extracted_at: now_iso(),
        upstream_version: "2.2.0".into(),
        notes: "v0.1: intra-crate parsing only. No cross-crate `pub use` resolution, no per-feature combinatorial expansion, no macro expansion. cfg gates are recorded as strings, not evaluated. Items inside #[cfg(...)] are present in the catalog regardless of feature config.".into(),
        ..Default::default()
    };
    catalog.stats.crates_attempted = m2.crates.len();

    for cm in &m2.crates {
        let mut parser = CrateParser::new(&upstream, &cm.path);
        let has_lib = parser.parse_lib();
        let pc = ParsedCrate {
            name: cm.name.clone(),
            path: cm.path.clone(),
            category: cm.category.clone(),
            is_adr_orphan: cm.is_adr_orphan,
            adrs: cm.adrs.clone(),
            has_lib_rs: has_lib,
            parse_error: parser.parse_error.clone(),
            files_parsed: parser.files_parsed.clone(),
            napi_count: parser.items.iter().filter(|i| i.is_napi).count(),
            wasm_count: parser.items.iter().filter(|i| i.is_wasm).count(),
            macro_export_count: parser.items.iter().filter(|i| i.is_macro_export).count(),
            items: parser.items,
        };
        if has_lib {
            catalog.stats.crates_with_lib_rs += 1;
        } else {
            catalog.stats.crates_without_lib_rs += 1;
        }
        if pc.parse_error.is_some() {
            catalog.stats.parse_failures += 1;
        }
        catalog.stats.files_parsed += pc.files_parsed.len();
        catalog.stats.public_items_total += pc.items.len();
        for it in &pc.items {
            *catalog.stats.by_kind.entry(it.kind.clone()).or_insert(0) += 1;
            if it.is_napi { catalog.stats.napi_items += 1; }
            if it.is_wasm { catalog.stats.wasm_items += 1; }
            if it.is_macro_export { catalog.stats.macro_export_items += 1; }
            if !it.cfg_gates.is_empty() { catalog.stats.cfg_gated_items += 1; }
            if it.doc.is_some() { catalog.stats.items_with_doc += 1; }
            if it.is_deprecated { catalog.stats.deprecated_items += 1; }
            if pc.is_adr_orphan { catalog.stats.adr_orphan_items += 1; }
        }
        *catalog.stats.by_category.entry(pc.category.clone()).or_insert(0) += 1;
        catalog.crates.push(pc);
    }

    catalog.crates.sort_by(|a, b| a.name.cmp(&b.name));

    fs::create_dir_all(&out_dir).unwrap();

    let out_json = out_dir.join("catalog.json");
    fs::write(&out_json, serde_json::to_string_pretty(&catalog).unwrap()).unwrap();
    eprintln!("Wrote {}", out_json.display());

    write_summary_md(&catalog, &out_dir.join("catalog.md"));
    write_diff_md(&m2, &catalog, &out_dir.join("m2-vs-m3-diff.md"));

    // Console summary.
    eprintln!("\n=== M3 summary ===");
    eprintln!("Crates attempted:       {}", catalog.stats.crates_attempted);
    eprintln!("  with src/lib.rs:      {}", catalog.stats.crates_with_lib_rs);
    eprintln!("  without lib.rs:       {}", catalog.stats.crates_without_lib_rs);
    eprintln!("  parse failures:       {}", catalog.stats.parse_failures);
    eprintln!("Files parsed:           {}", catalog.stats.files_parsed);
    eprintln!("Public items:           {}", catalog.stats.public_items_total);
    eprintln!("  by kind:              {:?}", catalog.stats.by_kind);
    eprintln!("NAPI-bound items:       {}", catalog.stats.napi_items);
    eprintln!("WASM-bound items:       {}", catalog.stats.wasm_items);
    eprintln!("#[macro_export] items:  {}", catalog.stats.macro_export_items);
    eprintln!("cfg-gated items:        {}", catalog.stats.cfg_gated_items);
    eprintln!("with doc comment:       {}", catalog.stats.items_with_doc);
    eprintln!("deprecated:             {}", catalog.stats.deprecated_items);
    eprintln!("ADR-orphan items:       {}", catalog.stats.adr_orphan_items);
}

fn now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    // Minimal ISO-ish without chrono dep.
    format!("{}", secs) + "Z (epoch seconds)"
}

fn write_summary_md(c: &M3Catalog, path: &Path) {
    let mut s = String::new();
    s.push_str("# M3 — AST Catalog\n\n");
    s.push_str(&format!("*Generated by `tools/ruvector-cataloger`. {}.*\n\n", c.extracted_at));
    s.push_str(&format!("> {}\n\n", c.notes));
    s.push_str("## Stats\n\n");
    s.push_str(&format!("- Crates attempted: **{}**\n", c.stats.crates_attempted));
    s.push_str(&format!("- With `src/lib.rs`: {}\n", c.stats.crates_with_lib_rs));
    s.push_str(&format!("- Without `lib.rs` (binary or empty): {}\n", c.stats.crates_without_lib_rs));
    s.push_str(&format!("- Parse failures: {}\n", c.stats.parse_failures));
    s.push_str(&format!("- Files parsed: {}\n", c.stats.files_parsed));
    s.push_str(&format!("- **Public items: {}**\n", c.stats.public_items_total));
    s.push_str(&format!("- NAPI-bound items: **{}**\n", c.stats.napi_items));
    s.push_str(&format!("- WASM-bound items: **{}**\n", c.stats.wasm_items));
    s.push_str(&format!("- `#[macro_export]` items: {}\n", c.stats.macro_export_items));
    s.push_str(&format!("- cfg-gated items: {}\n", c.stats.cfg_gated_items));
    s.push_str(&format!("- Items with doc comment: **{}** ({:.1}%)\n",
        c.stats.items_with_doc,
        100.0 * c.stats.items_with_doc as f64 / c.stats.public_items_total.max(1) as f64));
    s.push_str(&format!("- Deprecated items: {}\n", c.stats.deprecated_items));
    s.push_str(&format!("- Items in ADR-orphan crates: **{}**\n\n", c.stats.adr_orphan_items));
    s.push_str("### By kind\n\n");
    for (k, v) in &c.stats.by_kind {
        s.push_str(&format!("- `{}`: {}\n", k, v));
    }
    s.push_str("\n### By category\n\n");
    for (k, v) in &c.stats.by_category {
        s.push_str(&format!("- `{}`: {}\n", k, v));
    }
    fs::write(path, s).unwrap();
    eprintln!("Wrote {}", path.display());
}

fn write_diff_md(m2: &M2Catalog, m3: &M3Catalog, path: &Path) {
    let mut s = String::new();
    s.push_str("# M2 (ripgrep) vs M3 (syn) — Cross-validation\n\n");
    s.push_str("Per-crate item-count comparison. Differences are expected and informative:\n\n");
    s.push_str("- **M2 > M3** — items captured by regex that the AST didn't see. Most common cause: items inside macros, code in `tests/`/`benches/`/`examples/` that ripgrep matched, or modules ripgrep saw but our `mod` resolver didn't link from `lib.rs`.\n");
    s.push_str("- **M3 > M2** — items the AST resolved that regex missed. Most common cause: items spanning multiple lines, items inside inline `mod { ... }` blocks ripgrep didn't classify, or `pub` qualifiers ripgrep mis-classified.\n\n");

    let m2_by_name: BTreeMap<&str, u64> = m2.crates.iter().map(|c| (c.name.as_str(), c.public_items_count)).collect();
    let m3_by_name: BTreeMap<&str, usize> = m3.crates.iter().map(|c| (c.name.as_str(), c.items.len())).collect();
    let mut all_names: BTreeSet<&str> = BTreeSet::new();
    all_names.extend(m2_by_name.keys());
    all_names.extend(m3_by_name.keys());

    let mut rows: Vec<(String, u64, usize, i64)> = all_names
        .into_iter()
        .map(|n| {
            let a = *m2_by_name.get(n).unwrap_or(&0);
            let b = *m3_by_name.get(n).unwrap_or(&0);
            (n.to_string(), a, b, b as i64 - a as i64)
        })
        .collect();
    rows.sort_by_key(|(_, _, _, d)| -d.abs());

    s.push_str("## Top 40 crates by absolute M2/M3 delta\n\n");
    s.push_str("| Crate | M2 (rg) | M3 (syn) | Δ |\n|---|--:|--:|--:|\n");
    for (name, a, b, d) in rows.iter().take(40) {
        s.push_str(&format!("| `{}` | {} | {} | {:+} |\n", name, a, b, d));
    }
    s.push_str("\n");

    let m2_total: u64 = m2.crates.iter().map(|c| c.public_items_count).sum();
    let m3_total: usize = m3.crates.iter().map(|c| c.items.len()).sum();
    s.push_str(&format!("\n**Totals.** M2: {} items. M3: {} items. Δ = {:+}.\n",
        m2_total, m3_total, m3_total as i64 - m2_total as i64));

    fs::write(path, s).unwrap();
    eprintln!("Wrote {}", path.display());
}
