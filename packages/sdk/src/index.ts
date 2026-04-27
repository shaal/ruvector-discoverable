/**
 * @ruvector/sdk — task-first archetypes over upstream ruvector.
 *
 * **M5 (this commit)** is a surface freeze. Every archetype's methods throw
 * {@link NotImplementedError} so the type shape compiles and tooling can plan
 * against it, but nothing executes. M6 wires the first archetype to a real
 * backend.
 *
 * Headline surface (six archetypes):
 *   - {@link KnowledgeBase}     — RAG over docs
 *   - {@link AgentMemory}       — long-term agent state
 *   - {@link GraphReasoner}     — multi-hop graph queries
 *   - {@link TimeSeriesMemory}  — sequential / streaming retrieval
 *   - {@link LocalLLM}          — local model runtime
 *   - {@link AgentFramework}    — agent orchestration / A2A
 *
 * Three seed archetypes from the original PRD draft (CodebaseIndex,
 * GenomicAnalyzer, RecommendationEngine) are intentionally omitted — M4 found
 * insufficient upstream support to lock their types in v0.1.
 *
 * For escape hatches (generic vector DB, FPGA, kernel, postgres, quantum),
 * import from `@ruvector/sdk/advanced` explicitly.
 */

// Archetypes (named exports)
export { KnowledgeBase } from './archetypes/KnowledgeBase.js';
export type {
  KnowledgeBaseOptions,
  KnowledgeBaseCapabilityConfig,
  EmbedderConfig,
  Document,
  AskOptions,
  Filter,
  Answer,
  Citation,
  IngestReport,
} from './archetypes/KnowledgeBase.js';

export { AgentMemory } from './archetypes/AgentMemory.js';
export type {
  AgentMemoryOptions,
  AgentMemoryCapabilityConfig,
  MemoryRecord,
  RecallOptions,
  RecallResult,
  RecalledMemory,
} from './archetypes/AgentMemory.js';

export { GraphReasoner } from './archetypes/GraphReasoner.js';
export type {
  GraphReasonerOptions,
  GraphReasonerCapabilityConfig,
  Node,
  Edge,
  Hyperedge,
  NodeResult,
  EdgeResult,
  CypherResult,
  GraphStats,
  HyperedgeSearchOptions,
  HyperedgeSearchResult,
  KHopOptions,
  GraphChangeListener,
} from './archetypes/GraphReasoner.js';

export { TimeSeriesMemory } from './archetypes/TimeSeriesMemory.js';
export type {
  TimeSeriesMemoryOptions,
  TimeSeriesCapabilityConfig,
  TimeSeriesPoint,
  QueryWindow,
  TemporalQueryOptions,
  TemporalResult,
  RecalledPoint,
  Changepoint,
} from './archetypes/TimeSeriesMemory.js';

export { LocalLLM } from './archetypes/LocalLLM.js';
export type {
  LocalLLMOptions,
  LocalLLMCapabilityConfig,
  GenerateOptions,
  ToolDefinition,
  GenerateResult,
  StreamChunk,
} from './archetypes/LocalLLM.js';

export { AgentFramework } from './archetypes/AgentFramework.js';
export type {
  AgentFrameworkOptions,
  AgentFrameworkCapabilityConfig,
  TaskPolicy,
  AgentTask,
  TaskResult,
  ToolCall,
  SubagentCall,
  PeerDescriptor,
} from './archetypes/AgentFramework.js';

// Cross-cutting types
export type {
  // Backend
  BackendKind,
  BackendOptions,
  BackendSpec,
  Backend,
  NativeBackendOptions,
  WasmBackendOptions,
  HttpBackendOptions,
  AutoBackendOptions,
  // Explain
  ExplainTrace,
  ExplainStage,
  CapabilityContribution,
  // Feedback
  FeedbackSignal,
  FeedbackProvider,
  QueryId,
  // Health
  CheckStatus,
  CheckResult,
  HealthCheckResult,
  HealthCheckProvider,
  // Pipeline
  Pipeline,
  PipelineStage,
  PipelineCapability,
  // Value report
  ValueReport,
  ValueReportProvider,
  ActiveCapability,
  DormantCapability,
} from './core/index.js';

export { RuVectorError, NotImplementedError } from './core/index.js';
