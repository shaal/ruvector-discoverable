/**
 * Long-term memory for AI agents.
 *
 * Distinct from KnowledgeBase: writes more than reads, prizes hierarchical
 * recall (hyperbolic embeddings), and benefits most from SONA continual
 * learning + EWC++ to prevent forgetting prior policies.
 *
 * Default-active capabilities (per M4):
 *   - GNN-learned index that improves with use     — ruvector-gnn
 *   - SONA continual learning + EWC++              — sona
 *   - Graph-shaped memory                          — ruvector-graph
 *   - Mamba SSM for sequential recall              — ruvector-attention
 *   - Domain expansion / cross-task transfer        — ruvector-domain-expansion
 */

import type { BackendSpec } from '../core/backend.js';
import type { ExplainTrace } from '../core/explain.js';
import type { FeedbackProvider, FeedbackSignal, QueryId } from '../core/feedback.js';
import type { Pipeline } from '../core/pipeline.js';
import type { ValueReport, ValueReportProvider } from '../core/value-report.js';
import { NotImplementedError } from '../core/index.js';

export interface AgentMemoryOptions {
  /** Stable identity for this agent. Memories are partitioned per agent. */
  readonly agentId: string;
  readonly backend?: BackendSpec;
  readonly storage?: string;
  /** Override capability defaults. */
  readonly capabilities?: AgentMemoryCapabilityConfig;
}

export interface AgentMemoryCapabilityConfig {
  /** Default: true. */
  readonly gnnLearning?: boolean;
  /** Default: true. */
  readonly sona?: boolean;
  /** Default: true. */
  readonly ewc?: boolean;
  /** Default: 'auto'. Off for flat data, on for hierarchical (e.g. taxonomy memories). */
  readonly hyperbolic?: 'auto' | boolean;
  /** Default: true. */
  readonly mambaRecall?: boolean;
  /** Default: false. Cross-task transfer; opt in when you have multiple agents. */
  readonly domainExpansion?: boolean;
}

export interface MemoryRecord {
  readonly text: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** Optional importance hint, [0, 1]. */
  readonly importance?: number;
  /** Optional client timestamp; defaults to now. */
  readonly timestampMs?: number;
}

export interface RecallOptions {
  /** Top-k. Default: 16. */
  readonly k?: number;
  /** Recency bias, [0, 1]. Default: 0.2. */
  readonly recency?: number;
  /** Restrict by tags. */
  readonly tags?: readonly string[];
}

export interface RecallResult {
  readonly records: readonly RecalledMemory[];
  readonly queryId: QueryId;
  readonly explain: ExplainTrace;
}

export interface RecalledMemory {
  readonly id: string;
  readonly text: string;
  readonly score: number;
  readonly recalledAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export class AgentMemory implements ValueReportProvider, FeedbackProvider {
  static async create(_options: AgentMemoryOptions): Promise<AgentMemory> {
    throw new NotImplementedError('AgentMemory.create');
  }

  /** Record a new memory. */
  remember(_record: MemoryRecord): Promise<{ id: string }> {
    throw new NotImplementedError('AgentMemory.remember');
  }

  /** Recall relevant memories given a query context. */
  recall(_context: string, _options?: RecallOptions): Promise<RecallResult> {
    throw new NotImplementedError('AgentMemory.recall');
  }

  /** Forget a specific memory by id (also removes from GNN index). */
  forget(_id: string): Promise<boolean> {
    throw new NotImplementedError('AgentMemory.forget');
  }

  recordFeedback(_queryId: QueryId, _signal: FeedbackSignal): Promise<void> {
    throw new NotImplementedError('AgentMemory.recordFeedback');
  }

  getValueReport(): Promise<ValueReport> {
    throw new NotImplementedError('AgentMemory.getValueReport');
  }

  introspect(): Pipeline {
    throw new NotImplementedError('AgentMemory.introspect');
  }

  close(): Promise<void> {
    throw new NotImplementedError('AgentMemory.close');
  }
}
