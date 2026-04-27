# Publishing pipeline: `@ruvector/server` and `@ruvector/cluster` publish without their `main` files

## Affected versions

- `@ruvector/server@0.1.0` (npm) — broken
- `@ruvector/cluster@0.1.0` (npm) — broken

This is the same defect class as Issue #02 (`ruvector@0.2.23` and `@ruvector/sona@0.1.6` umbrella packages), affecting two different packages.

## Summary

Both `@ruvector/server@0.1.0` and `@ruvector/cluster@0.1.0` publish to npm with `package.json` manifests that declare `main`/`bin` paths *not present* in the published tarball. After `npm install <pkg>`, neither package can be `require`'d, imported, or invoked via its declared bin — the install succeeds but the package is empty beyond `package.json` + `README.md`.

This blocks the entire HTTP-transport surface for downstream SDK consumers. The upstream `ruvector-server` Rust crate (axum-based REST API on port 6333; routes for `health` / `collections` / `points`; CORS + gzip) is real and functional, but the npm distribution that would let JS consumers depend on it is missing its files.

## Reproducers

### `@ruvector/server`

```bash
$ mkdir /tmp/probe-server && cd /tmp/probe-server && npm init -y
$ npm install @ruvector/server
+ @ruvector/server@0.1.0

$ ls node_modules/@ruvector/server/
package.json
README.md

$ cat node_modules/@ruvector/server/package.json | grep -E '"main"|"bin"|"files"' -A2
"main": "index.js",
"types": "index.d.ts",
"bin": {
    "ruvector-server": "./bin/ruvector-server"
"files": [
    "*.js",
    "*.d.ts",
    "bin/"
]

$ node -e "require('@ruvector/server')"
Cannot find module '/private/tmp/probe-server/node_modules/@ruvector/server/index.js'

$ ls node_modules/@ruvector/server/bin 2>&1
ls: node_modules/@ruvector/server/bin: No such file or directory
```

The `files: ["*.js", "*.d.ts", "bin/"]` array names the assets that should be included; none of them appear in the tarball.

### `@ruvector/cluster`

```bash
$ npm install @ruvector/cluster
+ @ruvector/cluster@0.1.0

$ ls node_modules/@ruvector/cluster/
package.json
README.md

$ cat node_modules/@ruvector/cluster/package.json | grep -E '"main"' -A1
"main": "index.js",

$ node -e "require('@ruvector/cluster')"
Cannot find module '/.../node_modules/@ruvector/cluster/index.js'
```

Same shape: `main` declared, file absent.

## Expected

After `npm install @ruvector/server`, `require('@ruvector/server')` should return an object exposing the HTTP-server / client surface the Rust crate ships. The `bin/ruvector-server` should launch the axum server (currently runnable only by building the crate from source via `cargo run --release` from the upstream checkout).

After `npm install @ruvector/cluster`, similar — the cluster orchestration surface should be importable.

## Actual

Both packages install but immediately fail to import. The bin entry is missing. The `files` array's globs match nothing in the published tarball.

## Likely upstream cause

Same as Issue #02: the build pipeline that compiles `index.js` / `index.d.ts` / `bin/*` runs *before* `npm publish` is invoked from a different working directory, so `npm publish` packs only the source-tree files (`package.json` + `README.md`) and not the build outputs.

## Workaround in downstream SDK

The integrating SDK has no Node-loadable workaround for the HTTP transport. Two options remain:

1. **Build `ruvector-server` from source** via `cargo build --release` from the upstream checkout, run it as a separate process, and have the SDK speak HTTP to `127.0.0.1:6333`. Adds a Rust toolchain dependency on the consumer's machine.
2. **Wait on an upstream republish** that ships the missing files.

The SDK currently classifies the entire HTTP transport `dormant [upstream-bug]` and links to this issue.

## Cross-references

- Issue #02 (`02-broken-umbrella-packages.md`) — same defect class, three different packages (`ruvector`, `@ruvector/sona`, etc.)
- Upstream crate: `crates/ruvector-server/` — exists, builds, runs. The crate isn't the problem; the npm distribution is.
- SDK reference: `docs/plans/m17-scope.md` — captures the live probe that surfaced this defect.

## Suggested fix

Audit the `npm publish` pipeline for both packages. The fix that worked for the `@ruvector/graph-node` family (which publishes its `.node` binaries cleanly) likely applies — bake the build outputs into the source tree before publish, or extend the `prepublishOnly` hook to invoke the build step in the same working directory.

A pipeline-level audit is preferable to a per-package fix, given Issue #02 hits the same defect on different packages.

## SDK diagnostic that will detect resolution

When upstream republishes with the files included, the SDK's reprobe will surface drift via `tools/reprobe-bindings/reprobe.mjs` (v0.4 added these two packages with `expect: 'published-broken'`). The next milestone after that drift either:

1. Wires `@ruvector/server` as the HTTP transport for KB / TSM / AgentMemory (M18 candidate, pending), OR
2. If the `expect` was wrong and the packages are still broken, updates the probe's expectation to `published` (no drift) and re-files this issue with the new tarball state.
