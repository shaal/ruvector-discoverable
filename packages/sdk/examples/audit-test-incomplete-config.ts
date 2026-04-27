/**
 * Deliberately-incomplete config used by `examples/audit-demo.sh` to
 * verify audit's drift detection. Claims `_meta.workload = 'rag-over-docs'`
 * (which recommends LocalLLM + GraphReasoner + KnowledgeBase) but only
 * wires LocalLLM. Audit should report missing-archetype drift for both
 * GraphReasoner and KnowledgeBase.
 */

import { LocalLLM } from '../dist/index.js';

export async function createSdk(): Promise<{ llm: LocalLLM }> {
  const llm = await LocalLLM.create();
  return { llm };
}

export const _meta = {
  generatedBy: 'manual (audit drift-detection probe)',
  workload: 'rag-over-docs',
  generatedAt: '2026-04-27',
  rationale: 'Deliberately incomplete — claims rag-over-docs but only wires LocalLLM.',
};
