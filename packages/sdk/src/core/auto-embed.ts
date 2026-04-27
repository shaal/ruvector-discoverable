/**
 * Shared cross-archetype auto-embed helpers.
 *
 * The pattern was inlined separately in four archetypes (KnowledgeBase,
 * TimeSeriesMemory, GraphReasoner, AgentMemory) across M11.2 → M13.1
 * because the abstraction was deliberately deferred until enough sample
 * points confirmed the shape was stable. Four archetypes converged on the
 * same structure with zero per-archetype variation in the dim-validation
 * and missing-embedding handling — the M13.2 extraction.
 *
 * Same precedent as M8.2's `core/capability-catalog.ts` extraction: three
 * archetypes confirmed the reducer shape; M8.2 then collapsed the duplication.
 *
 * Each archetype owns its per-shape resolver (`_resolveDocEmbeddings` for KB,
 * `coerceValue` for TSM string→Float32, `_resolveNodes`/`_resolveEdges`/
 * `_resolveHyperedges` for GR, `_resolveVector` for AgentMemory). Those
 * resolvers now delegate the shared parts here:
 *
 *   - `validateEmbedderDimensions` — create-time dim check.
 *   - `resolveEmbedding` — pre-computed Float32Array fast path; otherwise
 *     embedder.embed(text); throws MISSING_EMBEDDING if neither is available.
 *   - `requireEmbedderForString` — single-shot guard for `retrieve(string)`-
 *     style call sites that need the embedder for a query, not an item.
 */

import type { LocalLLM } from '../archetypes/LocalLLM.js';
import { RuVectorError } from './index.js';

/**
 * Validate that an optional embedder's `embedDimensions` matches the
 * archetype's configured `dimensions`. Call once at archetype.create().
 *
 * Throws `EMBEDDER_DIM_MISMATCH` with an actionable message that includes
 * both numbers and a remediation hint. The archetype name is interpolated
 * so the error points at the right call site.
 */
export function validateEmbedderDimensions(
  embedder: LocalLLM | undefined,
  dimensions: number,
  archetypeName: 'KnowledgeBase' | 'TimeSeriesMemory' | 'GraphReasoner' | 'AgentMemory',
): void {
  if (!embedder) return;
  if (embedder.embedDimensions === dimensions) return;
  throw new RuVectorError(
    'EMBEDDER_DIM_MISMATCH',
    `embedder.embedDimensions=${embedder.embedDimensions} does not match ${archetypeName}.dimensions=${dimensions}. ` +
    `Either set dimensions=${embedder.embedDimensions} (matches the embedder) or omit the embedder ` +
    'and supply pre-computed Float32Array embeddings.',
  );
}

/**
 * Resolve a pre-computed embedding OR derive one from text via the wired
 * embedder. Throws `MISSING_EMBEDDING` if neither path is available.
 *
 * `errorContext` is interpolated into the missing-embedding diagnostic so
 * the message names the affected item (e.g., `Document 'd1'`,
 * `Node 'alice'`, `Edge 'a->b'`).
 *
 * **Note on per-call dispatch**: returns a single Float32Array. Per the
 * M11.1 finding that the published `RuvLLM.embed(string[])` rejects array
 * inputs, callers loop this helper rather than batching — until upstream
 * fixes the array-input case (Issue #06 area), per-string dispatch is the
 * real underlying behavior anyway.
 */
export async function resolveEmbedding(
  embedding: Float32Array | undefined,
  text: string | undefined,
  embedder: LocalLLM | null,
  errorContext: string,
): Promise<Float32Array> {
  if (embedding) return embedding;
  if (embedder === null) {
    throw new RuVectorError(
      'MISSING_EMBEDDING',
      `${errorContext} has no embedding and no embedder is wired. Either supply ` +
      '`embedding: Float32Array`, or pass `embedder: <LocalLLM>` (with matching dimensions) at create-time.',
    );
  }
  if (text === undefined) {
    throw new RuVectorError(
      'MISSING_EMBEDDING',
      `${errorContext} has no embedding and no text to derive one from. ` +
      'Either supply `embedding: Float32Array` or `text: string`.',
    );
  }
  return await embedder.embed(text);
}

/**
 * Guard for call sites that take a `Float32Array | string` query and
 * dispatch on type. Returns the Float32Array; throws
 * `EMBEDDER_NOT_CONFIGURED` if the input is a string but no embedder
 * is wired. `methodName` is interpolated for diagnostic clarity.
 *
 * Common pattern at the call site:
 *
 *   const queryEmbedding = typeof query === 'string'
 *     ? await requireEmbedderForString(query, this._embedder, 'KnowledgeBase.retrieve')
 *     : query;
 */
export async function requireEmbedderForString(
  text: string,
  embedder: LocalLLM | null,
  methodName: string,
): Promise<Float32Array> {
  if (embedder === null) {
    throw new RuVectorError(
      'EMBEDDER_NOT_CONFIGURED',
      `${methodName}(string) requires an embedder at create-time. Pass \`embedder: <LocalLLM>\` ` +
      'or call with a pre-computed Float32Array.',
    );
  }
  return await embedder.embed(text);
}
