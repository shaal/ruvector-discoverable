# Upstream issue reports

These markdown files are paste-ready bug reports for `github.com/ruvnet/ruvector`. Each consolidates one or more findings the SDK accumulated while integrating against upstream NAPI bindings (M6 → M17 in `m6-scope.md`).

The SDK's diagnostic output (`getValueReport()`, `healthCheck().checks`, the smoke-check `[observed via probe]` strings) is the evidence in each report — that infrastructure was built precisely so that observations would convert directly into reproducible upstream issues.

## Filing instructions

1. Open https://github.com/ruvnet/ruvector/issues
2. Pick one of the files below and copy its body into a new issue.
3. The first H1 line is the issue title; everything else goes in the body.
4. Versions noted in each report were observed on darwin-arm64 with the upstream cloned at the SHA pinned by `ruvector/.git`.

## Reports

| File | Severity | Affected packages |
|---|---|---|
| [`01-graph-node-cypher-stub.md`](01-graph-node-cypher-stub.md) | Functional bug | `@ruvector/graph-node@2.0.3` |
| [`02-broken-umbrella-packages.md`](02-broken-umbrella-packages.md) | Publishing pipeline | `ruvector@0.2.23`, `@ruvector/sona@0.1.6` |
| [`03-core-vectordb-construction-quirks.md`](03-core-vectordb-construction-quirks.md) | API design | `@ruvector/core@2.2.0` |
| [`04-sona-microlora-warmup.md`](04-sona-microlora-warmup.md) | Behavior + docs | `@ruvector/sona@0.1.6` |
| [`05-no-model-loading-api.md`](05-no-model-loading-api.md) | API gap | `@ruvector/ruvllm@2.5.4`, `@ruvector/ruvllm-darwin-arm64@2.0.1` |
| [`06-query-route-under-populated-fields.md`](06-query-route-under-populated-fields.md) | Wrapper bug | `@ruvector/ruvllm@2.5.4` |
| [`07-rvagent-family-unpublished.md`](07-rvagent-family-unpublished.md) | Coverage gap | `@ruvector/rvagent-*` (9 packages) |
| [`08-server-cluster-broken-publish.md`](08-server-cluster-broken-publish.md) | Publishing pipeline | `@ruvector/server@0.1.0`, `@ruvector/cluster@0.1.0` |

## How the SDK found these

Each finding came from one of three layers of automated checks:

1. **Tier-1/2 binding probes** (`smokeCheck`): exercise each NAPI method with a known input and assert on the result. Surfaced finding #1 (the Cypher stub returns empty for known data) and finding #3 (insert/search dimension and state quirks).
2. **Tier-3 archetype probes** (`_archetypeProbe`): exercise the SDK's own logic over the binding. Surfaced finding #4 (the SDK's KB ranking shifted when SONA was wired even before any feedback).
3. **Manual install + load attempts**: surfaced finding #2 (umbrella packages fail to import after `npm install`).

The diagnostic strings reproduced in each report (`[observed via probe '...', status=broken] ...`) are verbatim from the SDK's `getValueReport().dormant[i].reason`. The reproducers are the smallest possible JS snippets that surface each behavior independently.
