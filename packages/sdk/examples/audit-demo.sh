#!/usr/bin/env bash
# M15.3 — `sdk audit` demonstration.
#
# Shows audit run against:
#   (1) a sample-config-shaped config (expected: 0 drifts, 1 advisory)
#   (2) a deliberately-incomplete config (expected: 2 missing-archetype drifts, exit 1)
#
# Run from the packages/sdk directory:
#   bash examples/audit-demo.sh

set +e  # keep going past expected non-zero exit on demo (2)
cd "$(dirname "$0")/.."

if [ ! -f dist/cli/audit.js ]; then
  echo "Building..."
  npm run build > /dev/null
fi

BINDING="${RUVECTOR_CORE_BINDING:-$PWD/../../ruvector/npm/core/platforms/darwin-arm64/ruvector.node}"

echo
echo "=== M15.3 sdk audit demo ==="
echo

# (1) Audit against a complete config — sample-config.ts has _meta.workload =
# 'rag-over-docs' and wires LocalLLM + GraphReasoner + KnowledgeBase. Expect:
# 0 missing/extra/coupling drifts, 1 advisory (KB.sona).
echo "--- (1) audit against complete config (sample-config.ts) ---"
RUVECTOR_CORE_BINDING="$BINDING" node bin/sdk.js audit examples/sample-config.ts
echo "exit=$?"
echo

# (2) Audit against a deliberately-incomplete config — claims rag-over-docs
# but only wires LocalLLM. Expect: 2 missing-archetype drifts (GR + KB),
# exit 1.
echo "--- (2) audit against incomplete config (audit-test-incomplete-config.ts) ---"
RUVECTOR_CORE_BINDING="$BINDING" node bin/sdk.js audit examples/audit-test-incomplete-config.ts
echo "exit=$?"
echo
echo "Done."
