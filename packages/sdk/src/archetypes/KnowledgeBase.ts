/**
 * RAG over documents and other unstructured corpora.
 *
 * Default-active capabilities (per M4 archetype-coverage.md):
 *   - hybrid search (sparse + dense + RRF)              — ruvector-core
 *   - Graph RAG (Leiden community detection)            — ruvector-graph
 *   - ColBERT multi-vector reranking                    — ruvector-core
 *   - Matryoshka adaptive-dimension funnel              — ruvector-core
 *   - SONA continual learning                           — sona
 *   - GNN-driven query rewriting                        — ruvector-gnn
 *   - DiskANN for billion-scale corpora                 — ruvector-diskann (when configured)
 *
 * The "advanced" path requires opt-in (see `kb.advanced` accessor).
 */

import type { BackendSpec, Backend } from '../core/backend.js';
import type { ExplainTrace } from '../core/explain.js';
import type { FeedbackProvider, FeedbackSignal, QueryId } from '../core/feedback.js';
import type { Pipeline } from '../core/pipeline.js';
import type { ValueReport, ValueReportProvider } from '../core/value-report.js';
import { NotImplementedError } from '../core/index.js';

export interface KnowledgeBaseOptions {
  /**
   * Source corpus. One of:
   *   - file glob string ('./docs\/**\/*.md')
   *   - URL or array of URLs
   *   - async iterable of {@link Document} (caller-controlled streaming)
   */
  readonly source: string | URL | readonly URL[] | AsyncIterable<Document>;

  readonly backend?: BackendSpec;

  /** Path or URL where the index lives. Defaults to `./<random>.rvf`. */
  readonly storage?: string;

  /** Embedder configuration. Auto-selected if omitted. */
  readonly embedder?: EmbedderConfig;

  /** Override the default capability set. Most users should leave this alone — */
  /** the whole point of the SDK is that defaults are the unique path. */
  readonly capabilities?: KnowledgeBaseCapabilityConfig;
}

export interface KnowledgeBaseCapabilityConfig {
  /** Default: true. */
  readonly hybrid?: boolean;
  /** Default: true. */
  readonly graphRag?: boolean;
  /** Default: true. */
  readonly colbertRerank?: boolean;
  /** Default: 'auto' (uses Matryoshka if dimensions allow). */
  readonly matryoshka?: 'auto' | boolean;
  /** Default: true. SONA learns from `recordFeedback` calls. */
  readonly sona?: boolean;
  /** Default: false. Enable for billion-scale corpora; requires extra config. */
  readonly diskann?: boolean;
}

export interface EmbedderConfig {
  readonly provider: 'auto' | 'openai' | 'cohere' | 'local-onnx' | 'custom';
  readonly model?: string;
  readonly apiKey?: string;
  readonly dimensions?: number;
}

export interface Document {
  readonly id?: string;
  readonly text: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AskOptions {
  /** Top-k passage retrieval. Default: 8. */
  readonly k?: number;
  /** Filter expression on metadata fields. */
  readonly filter?: Filter;
  /** Override how many tokens of context to send. */
  readonly maxContextTokens?: number;
  /** Override default reranker. */
  readonly reranker?: 'colbert' | 'cross-encoder' | 'none';
}

export interface Filter {
  readonly field: string;
  readonly op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'match';
  readonly value: unknown;
}

export interface Answer {
  readonly text: string;
  readonly citations: readonly Citation[];
  readonly queryId: QueryId;
  readonly explain: ExplainTrace;
}

export interface Citation {
  readonly documentId: string;
  readonly passage: string;
  readonly score: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IngestReport {
  readonly documentsIngested: number;
  readonly chunksWritten: number;
  readonly bytesWritten: number;
  readonly graphEdgesAdded: number;
  readonly durationMs: number;
}

export class KnowledgeBase implements ValueReportProvider, FeedbackProvider {
  // Constructor is private — use the static `create` factory.
  // (Async construction needs side effects: open storage, probe backend, etc.)
  // M5 freeze: we do NOT model `private constructor` here because TS still
  // emits the runtime check; the doc test would then fail to instantiate.
  // Implementation in M6 will hide construction details.

  /** Open or create a knowledge base. */
  static async create(_options: KnowledgeBaseOptions): Promise<KnowledgeBase> {
    throw new NotImplementedError('KnowledgeBase.create');
  }

  /** Ask a question. Returns an answer with citations and a full explain trace. */
  ask(_question: string, _options?: AskOptions): Promise<Answer> {
    throw new NotImplementedError('KnowledgeBase.ask');
  }

  /** Add documents to the index. The KB extracts a graph alongside the vectors. */
  ingest(_source: string | URL | readonly URL[] | AsyncIterable<Document>): Promise<IngestReport> {
    throw new NotImplementedError('KnowledgeBase.ingest');
  }

  recordFeedback(_queryId: QueryId, _signal: FeedbackSignal): Promise<void> {
    throw new NotImplementedError('KnowledgeBase.recordFeedback');
  }

  getValueReport(): Promise<ValueReport> {
    throw new NotImplementedError('KnowledgeBase.getValueReport');
  }

  /** Static introspection of the wired pipeline (no execution). */
  introspect(): Pipeline {
    throw new NotImplementedError('KnowledgeBase.introspect');
  }

  /** Resolved backend (read-only). Useful for capability assertions in tests. */
  get backend(): Backend {
    throw new NotImplementedError('KnowledgeBase.backend');
  }

  close(): Promise<void> {
    throw new NotImplementedError('KnowledgeBase.close');
  }
}
