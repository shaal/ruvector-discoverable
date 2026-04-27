# `@ruvector/sona`: `applyMicroLora` returns a zero vector before any training

## Affected versions

- `@ruvector/sona-darwin-arm64@0.1.5` (npm) — observed on darwin-arm64 / Node 22.22.0.

## Summary

`SonaEngine.applyMicroLora(input, strength)` is documented as applying the current LoRA delta to an input vector. On a freshly-constructed engine — before any trajectories with feedback have been ticked — the function **returns a zero vector** (norm = 0) regardless of the input.

The natural integrator expectation is that an untrained LoRA delta should be approximately the zero matrix and `applyMicroLora(x) ≈ x`. The actual behavior is the opposite extreme: it returns zeros, which makes any downstream cosine-similarity search return uniform "max-distance" scores for every candidate (since cosine to a zero vector is undefined / collapses to 1 in many implementations).

This breaks the natural composition pattern of "wire SONA on day 1, retrievals are unaffected; SONA's effect grows with feedback." Wiring SONA on day 1 currently breaks retrieval entirely until enough trajectories have been completed for the LoRA to learn a non-zero direction.

## Reproducer

```js
const { SonaEngine } = require('./sona.darwin-arm64.node');
const e = SonaEngine.withConfig({ hiddenDim: 16 });

const x = Array.from({ length: 16 }, (_, i) => Math.sin(i));
const y = e.applyMicroLora(x, 1.0);

// Compute cosine(x, y) and L2 distance — expected: cos≈1, L2≈0
const dot = x.reduce((s, xi, i) => s + xi * y[i], 0);
const nx = Math.sqrt(x.reduce((s, xi) => s + xi * xi, 0));
const ny = Math.sqrt(y.reduce((s, yi) => s + yi * yi, 0));
const cos = dot / (nx * ny);
const l2 = Math.sqrt(x.reduce((s, xi, i) => s + (xi - y[i]) ** 2, 0));

console.log('cos(x, applyMicroLora(x))  =', cos.toFixed(4));
console.log('L2(x, applyMicroLora(x))   =', l2.toFixed(4));
console.log('input norm:', nx.toFixed(4));
console.log('output norm:', ny.toFixed(4));
```

## Expected (for a freshly-constructed engine, no feedback yet)

```
cos(x, applyMicroLora(x))  ≈ 1.00
L2(x, applyMicroLora(x))   ≈ 0.00
input norm  ≈ output norm
```

## Actual (verbatim output from the reproducer above)

```
cos(x, applyMicroLora(x))  = 0.0000
L2(x, applyMicroLora(x))   = 2.8054
input norm:                  2.8054
output norm:                 0.0000
first 4 components x: [ '0.000', '0.841', '0.909', '0.141' ]
first 4 components y: [ '0.000', '0.000', '0.000', '0.000' ]
```

**`applyMicroLora` returned an all-zero vector.** Output norm = 0; cosine collapsed to 0; L2 distance equals the input norm (which is consistent with `y = 0`).

## Downstream impact

In a downstream SDK demo running `KnowledgeBase` against `@ruvector/core` with SONA wired but zero feedback recorded:

```
Plain retrieve (vector-only):
  vector  auth-spec      score=2.03e-11   ← top by similarity
  vector  monitoring     score=8.35e-1
  vector  crypto-notes   score=9.42e-1

Retrieve with SONA wired (zero feedback yet):
  vector  auth-spec      score=1.00e+0    ← all 3 docs report identical max-distance score
  vector  monitoring     score=1.00e+0
  vector  db-design      score=1.00e+0
```

All scores collapse to `1.00e+0` because the warped query is the zero vector and every candidate is at the same (effectively undefined) cosine distance. Top-ranking by score becomes meaningless until SONA has trained.

## Detection by an integrating SDK

A downstream SDK's tier-3 archetype probe would catch a regression in this property if it asserted `cos(x, applyMicroLora(x)) > 0.99` before any trajectory has been closed with feedback. The SDK's M10 v0.1 demo currently documents the observation in narration:

> note: with SONA wired, retrieval goes through sonaApplyLora before vectorSearch.
> At zero training the LoRA delta is essentially identity; after many trajectories
> with reward signals, the warp learns to pull rewarded routes closer.

The narration then has to caveat that the "essentially identity" claim isn't borne out by the binding's actual behavior at zero training.

## Suggested fixes

In rough order of preference:

1. **`applyMicroLora` should return its input** (or a near-identity transform of it) when no patterns have been stored. This is the principle-of-least-surprise fix: an untrained LoRA is the zero delta, and `x + 0·x = x`, not `0`. The current "return zeros" behavior looks like a missing if-check before applying the LoRA matrix.

2. **Add an explicit `bypassUntilTrained: boolean` config option** so integrators can opt into the "transparent until feedback" semantics. Useful even if #1 is fixed, for users who want to reason about when SONA's effect kicks in.

3. **Document the current behavior loudly.** If returning zero is intentional (e.g., to force callers to gate `applyMicroLora` on `getStats().patternsStored > 0`), the JSDoc and README should say so explicitly with the recommended pattern.

#1 is by far the most natural fix and matches what every other LoRA implementation does at zero training.

## Context for upstream

The SDK that found this is integrating SONA into a `KnowledgeBase` archetype where `recordFeedback(queryId, signal)` calls `endTrajectory(tid, signal.score)` and `tick()`. The expected user journey is: wire SONA, ingest docs, retrieve+feedback for a while, observe gradually-warped rankings. The warping starts immediately — before any feedback exists — which inverts the feedback→improvement causality the API suggests.
