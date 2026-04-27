# M17 — Multi-Transport Backend Scoping Report

| Field | Value |
|---|---|
| Status | Scoping (no implementation yet) |
| Date | 2026-04-27 |
| Decision needed from user | Open Questions §6 below |
| Predecessors | M11 / M12 scoping (LocalLLM); M6 v0.1 native-graph adapter; v0.2 polish batch |
| PRD reference | §5.1 Backends — `native` ✓ shipped; `wasm` and `http` outstanding |

This is a scoping pass, not a ship-task. Goal: figure out the realistic shape of the WASM and HTTP backends *before* committing to delivery, same pattern as M6 / M11 / M12 / M13 / M14 / M15 scoping docs.

---

## TL;DR

1. **WASM is mostly real today.** `@ruvector/graph-wasm@2.0.2` and `@ruvector/ruvllm-wasm@2.0.0` are both published, both load successfully in pure Node (with explicit `init({ module_or_path: <bytes> })`), and both expose live class surfaces. `graph-wasm` is in fact **richer than `graph-node`** — adds `deleteNode/deleteEdge/importCypher/exportCypher` not in the NAPI binding. The "WASM is the degraded fallback" assumption from PRD §5.1 is wrong; WASM is at least a peer and in some cases a superset.

2. **HTTP is gated by a broken-publish defect.** `@ruvector/server@0.1.0` is on npm but ships only `package.json` + `README.md` — the `main: "index.js"` and `bin: "./bin/ruvector-server"` references are dangling. Same defect class as Issue #02's three umbrella packages, distinct package. The upstream `ruvector-server` crate is real (axum REST API on port 6333, routes for collections/health/points), but no consumable npm distribution. Issue #08 candidate.

3. **`@ruvector/cluster@0.1.0` is broken-published the same way.** Both `server` and `cluster` ship only the metadata + README. Cluster orchestration won't reach the SDK without resolving this.

4. **Stealth win: `@ruvector/router@0.1.30` is published and works.** Real `VectorDb` class with `insert/insertAsync/search/searchAsync/delete/getAllIds/count`. This is a *different* binding from `@ruvector/core` (which remains unpublished) and could enable a publish-ready KnowledgeBase backend independent of the transport story. Worth a parallel investigation, not on M17's critical path.

5. **Recommendation: WASM-first, HTTP-deferred-pending-Issue-#08.** WASM has a working binding today, addresses the PRD §3 edge/browser persona, and lets the SDK validate the multi-backend abstraction with one transport before tackling the broken-publish gate. HTTP work proceeds only after upstream resolves Issue #08 OR after the SDK adopts a build-from-Rust-crate workaround (operationally heavier, harder to ship to consumers).

6. **Two parallel quick wins to file alongside M17 ratification:**
   - **Issue #08** — `@ruvector/server@0.1.0` + `@ruvector/cluster@0.1.0` broken-publish (paste-ready bug report).
   - **`reprobe.mjs` v0.4** — add `@ruvector/server`, `@ruvector/cluster`, `@ruvector/router`, `@ruvector/graph-wasm`, `@ruvector/ruvllm-wasm`, `@ruvector/rvf-wasm`, `@ruvector/ruqu-wasm`, `@ruvector/ospipe-wasm`, `@ruvector/rvf-mcp-server` rows. Current 22-package surface contract misses 9+ relevant packages — drift detection is blind to publication changes in the entire transport surface.

---

## What I verified live

### Re-probe (M16 v0.2 baseline, 2026-04-27)

`tools/reprobe-bindings/reprobe.mjs`: **0 drift across 22 npm + 1 CLI**. Existing tracked surface is stable.

### npm publication probes — 8 transport candidates (NOT in current reprobe)

| Package | Status | Files in tarball | Verdict |
|---|---|---|---|
| `@ruvector/graph-wasm` | **published @ 2.0.2** | `*.wasm` + `*.js` + `*.d.ts` + README + package.json | ✓ usable |
| `@ruvector/ruvllm-wasm` | **published @ 2.0.0** | `*.wasm` + `*.js` + `*.d.ts` + README + package.json | ✓ usable (45 exports) |
| `@ruvector/rvf-wasm` | published @ 0.1.6 | (not deep-probed) | likely usable |
| `@ruvector/ruqu-wasm` | published @ 2.0.6 | (not deep-probed) | likely usable |
| `@ruvector/ospipe-wasm` | published @ 0.1.1 | (not deep-probed) | unrelated to SDK archetypes |
| `@ruvector/server` | **published @ 0.1.0** | `package.json` + `README.md` only | ✗ broken (Issue #08) |
| `@ruvector/cluster` | **published @ 0.1.0** | `package.json` + `README.md` only | ✗ broken (Issue #08) |
| `@ruvector/router` | **published @ 0.1.30** | `index.js` + `index.d.ts` + README + package.json | ✓ usable; stealth win |
| `@ruvector/rvf-mcp-server` | published @ 0.1.4 | `dist/` + `src/` + tsconfig | ✓ usable; MCP-shape |

`@ruvector/ruvector-wasm`, `@ruvector/ruvector-wasm-unified`, `@ruvector/cognitum-gate-wasm`: **unpublished** despite existing in `npm/packages/`.

### `@ruvector/graph-wasm@2.0.2` live probe

```js
import * as g from '@ruvector/graph-wasm';
const wasmBytes = fs.readFileSync(require.resolve('@ruvector/graph-wasm/ruvector_graph_wasm_bg.wasm'));
await g.default({ module_or_path: wasmBytes });

g.version()             → "2.0.2"
new g.GraphDB().proto   → ['createEdge', 'createNode', 'deleteEdge', 'deleteNode',
                            'exportCypher', 'getHyperedge', 'importCypher',
                            'createHyperedge', 'query', 'stats', 'getEdge', 'getNode']
```

**Compared to `@ruvector/graph-node@2.0.3`'s NAPI surface** (per M6 scoping):
- ✓ Both have `createNode/createEdge/createHyperedge/query/stats/getEdge/getNode`
- ✗ NAPI lacks: `deleteNode/deleteEdge/importCypher/exportCypher` — WASM-only **per .d.ts**, behavior unverified
- ⚠ `query()` may also be the same Cypher stub from Issue #01 — needs a tier-3 probe in M17.1 to confirm.

**Constructor access caveat**: `JsNode`/`JsEdge`/`JsHyperedge` have `private constructor()` in the .d.ts — `new JsNode(...)` is rejected. WASM uses a different shape than NAPI's public `new JsNode({...})`; either there's a `GraphDB.createNode(opts)` factory path or the constructors are exposed via wasm-bindgen's `__wbg_*` machinery. Live invocation flow is **unverified**; M17.1 must establish the actual call pattern before claiming the four extra methods (`deleteNode/deleteEdge/importCypher/exportCypher`) are accessible.

**Init lifecycle finding**: default `init()` uses `fetch` (browser-target wasm-bindgen). In Node, must pass bytes explicitly. Adapter owns this once per archetype lifetime; users don't see it.

### `@ruvector/ruvllm-wasm@2.0.0` live probe

45 exports. `.d.ts` inspection of `RuvLLMWasm`:

```ts
class RuvLLMWasm {
  static formatChat(template: ChatTemplateWasm, messages: ChatMessageWasm[]): string;
  getPoolStats(): string;
  initialize(): void;
  initializeWithConfig(config: KvCacheConfigWasm): void;
  // [Symbol.dispose], free()
}
```

**Critical caveat — NO model_path here either.** `initializeWithConfig` takes a `KvCacheConfigWasm` (KV-cache parameters), **not** a model file. M11/M12's diagnosis that the published bindings have no `model_path` config field appears to apply to WASM as well — the surface for actual GGUF loading must be elsewhere in the 45 exports (candidates: `MicroLoraWasm`, `SonaInstantWasm`, or standalone functions like `ParallelInference`), or it's genuinely absent at the public WASM layer. Either outcome is a real M17.2 finding; speculation that "WASM is the workaround for Issue #05" is **disproven** for this method and **unverified** elsewhere.

The richer 45-export surface (MicroLoraWasm, KvCacheWasm, HnswRouterWasm, SonaInstantWasm, ChatMessageWasm, ChatTemplateWasm, ParallelInference, …) is real — but "richer surface" ≠ "Issue #05 workaround." A full surface diff in M17.2 establishes which capabilities actually flip from `dormant` → `active` under WASM transport.

### `@ruvector/router@0.1.30` live probe (stealth)

```js
const db = new VectorDb({ dimensions: 4, distanceMetric: DistanceMetric.Cosine });
db.insert('a', new Float32Array([1,0,0,0]));
db.insert('b', new Float32Array([0,1,0,0]));
db.insert('c', new Float32Array([0.99, 0.05, 0.05, 0.05]));
db.count();              → 3
db.search(v_a, 2);       → [{id:'a', score:0}, {id:'c', score:0.0038}]
```

**Confirmed semantically correct**: cosine distance returns 0 for self-match, ~0.004 for near-parallel vector. This is publication-ready. Cosine/Euclidean/DotProduct/Manhattan distance metrics, HNSW config knobs, optional persistence per `.d.ts`. Could be a publish-ready alternative for the KB backend's vector path while `@ruvector/core` remains unpublished. **Not a transport question** — separate workstream, parallel to M17.

### `ruvector-server` upstream crate (`crates/ruvector-server/`)

Cargo.toml: `axum 0.7` + `tokio` + `tower` + `tower-http (cors+trace+compression)`. Real REST API.

`src/lib.rs` Config defaults: `host: "127.0.0.1"`, `port: 6333` (Qdrant-compatible). Routes: `health`, `collections`, `points`. CORS-enabled, gzip-compressed.

The crate exists, builds, runs. The publication problem is the npm tarball's missing files, not the upstream code itself.

### Existing SDK backends layer

`packages/sdk/src/backends/` already has 4 native siblings:

```
native-core.ts     — KnowledgeBase / TimeSeriesMemory / AgentMemory base
native-graph.ts    — GraphReasoner over @ruvector/graph-node
native-ruvllm.ts   — LocalLLM over @ruvector/ruvllm
native-sona.ts     — SONA continual learning
```

`native-graph.ts` already has the comment:

> *v0.2 will add WasmGraphBackend and HttpGraphBackend siblings under a common interface; v0.1 keeps just this one to validate the pattern.*

The abstraction was anticipated. M17 is the milestone that delivers on the comment.

---

## Where the SDK's PRD §5.1 narrative diverges from reality

PRD §5.1 said:

> **Backends (pluggable, one API):**
>   - `native` — wraps @ruvector/core and friends (NAPI). Default in Node.
>   - `wasm` — wraps the upstream WASM bundles. Default in browser.
>   - `http` — talks to ruvector-server. For remote / serverless deployments.
> Backend selection is automatic from environment, overridable via constructor option.

Reality differences after M17 probes:

| PRD claim | Live finding |
|---|---|
| `native` wraps `@ruvector/core` | True for KB/TSM/AgentMemory; **but `@ruvector/core` is itself unpublished** — only available via `RUVECTOR_CORE_BINDING` env var. The "default in Node" path requires manual env setup today. |
| `wasm` for browsers | True — but Node also works with explicit init bytes. WASM is a peer transport, not a browser-only fallback. |
| `wasm` is degraded vs native | **False for graph** — WASM has delete/import/export the native binding lacks. |
| `http` talks to `ruvector-server` | The Rust crate exists; the npm distribution is broken-published. Either build from source or wait on upstream Issue #08. |
| Backend auto-selection | Not implemented yet (no current archetype reads `globalThis.window` or similar — all assume native). M17 owns the dispatcher. |

---

## Three candidate paths for M17 delivery

### Path A — WASM-first *(recommended)*

Scope: **WasmGraphBackend** (M17.1) + **WasmLocalLLMBackend** (M17.2). HTTP deferred.

Per-milestone shape:
- **M17.1** — `WasmGraphBackend` for GraphReasoner. Wraps `@ruvector/graph-wasm@2.0.2`. Adapter owns the `init({ module_or_path: bytes })` lifecycle (loads from `require.resolve` path in Node, from the bundler-resolved URL in browsers). Implements the same interface as `NativeGraphBackend`. The dispatcher in `GraphReasoner.create()` picks `wasm` if `options.transport === 'wasm'` OR `typeof window !== 'undefined' && options.transport !== 'native'`.
  - **Validation gate** (per M6 generalization): WASM `query()` may share Issue #01's Cypher-stub bug. Smoke-check probe verifies stats/createNode/createEdge/kHopNeighbors *and* whether the WASM Cypher returns nodes. Result drives whether `cypher` is `active` or `dormant [upstream-bug]` in the WASM-backed value report. Same self-correcting classification.
  - **New finding to surface**: `deleteNode/deleteEdge/importCypher/exportCypher` are WASM-only. The catalog gains four new capability rows whose `active` is gated on `transport === 'wasm'`. PRD §5.1's "WASM is the degraded fallback" claim is overturned.

- **M17.2** — `WasmLocalLLMBackend` for LocalLLM. Wraps `@ruvector/ruvllm-wasm@2.0.0`. The 45-export surface is substantially richer than the NAPI's 14 methods. Subset for Phase 2A: embed/similarity (matching M11.1) + investigate which of `ChatTemplateWasm`/`MicroLoraWasm`/`ParallelInference` enables `query`/`route` honest enough to flip Issue #05 / #06 mitigations.
  - **Open question (refined post-probe)**: `RuvLLMWasm.initializeWithConfig` takes `KvCacheConfigWasm`, **not** a model file. Whether *any other* WASM export accepts a GGUF path (candidates: MicroLoraWasm, SonaInstantWasm, standalone fns) is **unverified**. M17.2 establishes the answer by full surface diff. Either outcome is useful — it either unblocks Issue #05 mitigations or confirms the defect is transport-agnostic and Issue #05 needs a different fix.

Effort: 2 ship-tasks (M17.1 + M17.2). M17.1 is the lower-risk first slice (existing native-graph adapter pattern to mirror). M17.2 needs a Phase 2A surface scoping pass of its own.

Risk: low for M17.1 (every dependency probed, init lifecycle worked). Medium for M17.2 (45-export surface is substantively more than M11 explored; surface-mapping work is real).

### Path B — HTTP-first

Scope: build a `ruvector-server`-backed HTTP transport for KB/TSM/AgentMemory (the archetypes blocked on `@ruvector/core`).

Blocking gate: Issue #08 (`@ruvector/server@0.1.0` ships only README). Two sub-paths:
- **B.i** — Wait on upstream republish. Indeterminate timeline (Issues #02/#03/#04/#05/#06/#07 are all open; no commitment to fix order).
- **B.ii** — Build the Rust crate ourselves and wrap. The `cargo build --release` of `ruvector-server` produces a binary; the SDK either spawns it as a subprocess (operationally heavier than the M12 CLI-subprocess path because it's a long-running daemon) or talks to a user-managed instance over HTTP.

Effort: at least 1 scoping pass + 1 implementation milestone, plus Issue #08 authoring. B.ii also requires a Rust toolchain on the user's machine — a dependency the SDK has so far avoided.

Risk: high. Both sub-paths take the SDK into operational territory it hasn't been in (subprocess management, HTTP retry/timeout policy, service discovery). The M17 abstraction can't be validated until at least one HTTP archetype works end-to-end.

### Path C — Parallel WASM + HTTP

Combine A and B: ship WasmGraphBackend (M17.1) immediately; in parallel, file Issue #08 and start B.ii on the assumption upstream won't fix soon.

Effort: ~1.5× Path A's. Adds operational complexity (managing two transport adapters that share an interface but differ wildly in lifecycle).

Risk: medium-high. The risk isn't technical — it's *interface design*. Designing the backend abstraction around two transports built simultaneously is harder than around one (which is then extended for the second). Path A locks the abstraction first, Path C floats it.

---

## Recommendation

**Path A.** Concrete reasons:

1. **WASM has a working binding today.** Every probe in this scoping pass succeeded. Path B has a binary blocker (Issue #08 broken-publish) that the SDK can't fix unilaterally.
2. **Browser-persona is a unique adoption-driver in PRD §3.** "Edge / browser developer" is one of five named personas; WASM is the only path to serving them. HTTP serves a different persona (remote/serverless), and that persona is already partially served by `ruvector-cli` subprocess workflows (M11.3 v0.2).
3. **Multi-transport abstraction is validated by 1 transport before being claimed by 3.** M17.1 proves the dispatcher pattern; M17.2 (or M18 HTTP) extends it. Path C's "design two transports together" is harder.
4. **The 4 WASM-only graph capabilities (delete/import/export) are SDK-level value, not transport-level value.** Shipping WASM puts those into the catalog; users get more capability per backend, not just transport variety.
5. **HTTP can wait on Issue #08 fix or on a future build-from-source decision.** The deferment is honest: the SDK can name in `getValueReport` that HTTP transport is `dormant [upstream-bug]` linked to Issue #08, just as it does for any other dormant capability.

Path B / C are not *wrong*. They're slower wins than A and add operational surface the SDK has so far avoided. Defer until Path A's abstraction is proven.

---

## Open questions for ratification

These are the decisions that lock the next ship-task's contents. My leans included; the user ratifies.

1. **Path A vs B vs C?** — Lean A (WASM-first, HTTP after Issue #08).

2. **Issue #08 (`@ruvector/server` + `@ruvector/cluster` broken-publish): file standalone or fold into Issue #02?** — Lean **standalone**. Issue #02 covers three specific umbrella packages by name; #08 covers two different packages with the same defect class. Listing the new packages in #02 dilutes its scope; a separate report makes the upstream-fix tractable. (Same precedent as Issue #07 spinning out of #02.)

3. **`reprobe.mjs` v0.4: extend by which packages?** — Lean **add 9** rows: `@ruvector/server`, `@ruvector/cluster`, `@ruvector/router`, `@ruvector/graph-wasm`, `@ruvector/ruvllm-wasm`, `@ruvector/rvf-wasm`, `@ruvector/ruqu-wasm`, `@ruvector/ospipe-wasm`, `@ruvector/rvf-mcp-server`. The first two have `expect: 'broken'` annotations; rest are `expect: 'published'`. Drift surfaces if upstream republishes #08 packages or drops any of the 7 working ones.

4. **WASM init lifecycle: hide in `archetype.create()` or expose explicit `await sdk.init()`?** — Lean **hide in `create()`**. Same UX as native (sync constructor from user's POV, async work happens internally). Adapter reads .wasm bytes from `require.resolve` in Node, defers to bundler in browser. User code is identical across transports.

5. **Backend auto-selection rule?** — Lean **explicit-first, auto-fallback**: `options.transport: 'native' | 'wasm' | 'http'` overrides; default is `typeof process !== 'undefined' && process.versions?.node ? 'native' : 'wasm'`. HTTP requires explicit opt-in (no env-sniff to avoid surprising remote calls).

6. **`@ruvector/router` stealth-publication: M17 concern or v0.3 separate workstream?** — Lean **separate workstream**. M17 is multi-transport; router is "alternative to unpublished `@ruvector/core` for KB's vector path." Combining the two confuses the abstraction layer (router is itself NAPI, not a transport choice). Worth its own scoping pass post-M17.

7. **WASM Cypher stub: assume same as Issue #01 or smoke-probe to confirm?** — Lean **smoke-probe** during M17.1. A 30-line probe call with `MATCH (n) RETURN n` after an insert tells us whether WASM shares the bug. Either outcome is useful (active capability OR a third paste-ready issue lifting the diagnostic verbatim, per M11.2 / M12.4 / M12.5 pattern).

---

## Cross-references

- PRD §5.1 — defines the three-backend story M17 delivers on
- PRD §3 — names the edge/browser persona that motivates WASM-first
- m6-scope.md — M6 v0.1 native-graph adapter pattern M17.1 mirrors
- m11-scope.md — M11 first noticed `@ruvector/ruvllm-wasm` exists; deferred live-probe to M17 (this doc)
- m12-scope.md — M12 surfaced `model_path`-missing in NAPI; M17.2 may find WASM differs
- docs/upstream-issues/ — paste-ready issues #01–#07; #08 (broken `@ruvector/server` + `cluster`) joins this folder if Q2 ratifies
- packages/sdk/src/backends/native-graph.ts:11-14 — comment block anticipating WasmGraphBackend / HttpGraphBackend siblings
- tools/reprobe-bindings/reprobe.mjs — extends in v0.4 per Q3

---

*End of M17 scoping. Awaiting ratification per Open Questions §6.*
