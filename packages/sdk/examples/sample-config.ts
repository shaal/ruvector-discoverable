/**
 * Sample `ruvector.config.ts` — what `sdk recommend` will eventually generate.
 *
 * M15.1 ships `doctor` first; `recommend` (Phase-1B) generates this shape
 * automatically from a workload questionnaire. For now this is a hand-written
 * reference so users can see what a real config looks like and so `sdk doctor`
 * has something to point at in the demo.
 *
 * Wires three of the six archetypes via the M11.2/M13.1 cross-archetype DI
 * pattern: KnowledgeBase + GraphReasoner + LocalLLM. The KB receives the
 * graph (Graph RAG) and the LLM (auto-embedder).
 *
 * Run with:
 *
 *   RUVECTOR_CORE_BINDING="$(pwd)/../../ruvector/npm/core/platforms/darwin-arm64/ruvector.node" \
 *     node packages/sdk/bin/sdk.js doctor packages/sdk/examples/sample-config.ts
 */

import { resolve } from 'node:path';
// In-repo demo: imports the built SDK from `dist/`. Real users (when
// `@ruvector/sdk` is published) write: `from '@ruvector/sdk'`.
import {
  KnowledgeBase,
  GraphReasoner,
  LocalLLM,
} from '../dist/index.js';

export async function createSdk(): Promise<{ llm: LocalLLM; graph: GraphReasoner; kb: KnowledgeBase }> {
  const llm = await LocalLLM.create();
  const dims = llm.embedDimensions; // 768

  const graph = await GraphReasoner.create({
    dimensions: dims,
    distanceMetric: 'Cosine',
    embedder: llm,
  });

  const bindingPath = process.env.RUVECTOR_CORE_BINDING
    ?? resolve(process.cwd(), '..', '..', 'ruvector', 'npm', 'core', 'platforms', 'darwin-arm64', 'ruvector.node');

  const kb = await KnowledgeBase.create({
    dimensions: dims,
    distanceMetric: 'Cosine',
    bindingPath,
    embedder: llm,
    graphReasoner: graph,
  });

  return { llm, graph, kb };
}

export const _meta = {
  generatedBy: 'manual reference (M15.1)',
  workload: 'rag-over-docs',
  generatedAt: '2026-04-27',
  rationale:
    'Three-archetype RAG stack: KnowledgeBase for vector recall over documents, ' +
    'GraphReasoner for memory-relations via Graph RAG, LocalLLM for embedding (M11.2 ' +
    'autoEmbed) and eventual generation (Phase 2A). Sample config — `sdk recommend` ' +
    'will generate this shape automatically from a workload questionnaire in M15.2.',
};
