#!/usr/bin/env bash
# M15.2 — `sdk recommend` demonstration.
#
# Shows both invocations:
#   (1) Non-interactive — for CI / repo-bootstrappers / scripted use.
#   (2) Interactive — what a user typing answers would see.
#
# Run from the packages/sdk directory:
#   bash examples/recommend-demo.sh

set -e
cd "$(dirname "$0")/.."

if [ ! -f dist/cli/recommend.js ]; then
  echo "Building..."
  npm run build > /dev/null
fi

OUT_DIR="$(mktemp -d)"
echo
echo "=== M15.2 sdk recommend demo ==="
echo "Output dir: $OUT_DIR"
echo

# Invocation 1 — non-interactive: agent-orchestration (most complex coupling).
echo "--- (1) non-interactive: agent-orchestration ---"
node bin/sdk.js recommend \
  --workload agent-orchestration \
  --data-size 1k-100k \
  --latency '<200ms' \
  --updates streaming \
  --generate yes \
  --out "$OUT_DIR/agent-config.ts"

echo
echo "Generated config (first 25 lines):"
head -25 "$OUT_DIR/agent-config.ts"
echo "..."

# Invocation 2 — non-interactive: rag-over-docs (the PRD §5.5 example shape).
echo
echo "--- (2) non-interactive: rag-over-docs ---"
node bin/sdk.js recommend \
  --workload rag-over-docs \
  --data-size 1k-100k \
  --latency '<50ms' \
  --updates daily-batch \
  --generate no \
  --out "$OUT_DIR/rag-config.ts"

echo
echo "--- (3) drift probe ---"
RUVECTOR_CORE_BINDING="${RUVECTOR_CORE_BINDING:-$PWD/../../ruvector/npm/core/platforms/darwin-arm64/ruvector.node}" \
  node examples/recommend-drift-probe.mjs

echo
echo "Done. Configs written to $OUT_DIR."
echo
echo "To run interactively, omit the flags:"
echo "  node bin/sdk.js recommend"
echo
echo "To diagnose either generated config (Phase-1A):"
echo "  node bin/sdk.js doctor $OUT_DIR/rag-config.ts"
