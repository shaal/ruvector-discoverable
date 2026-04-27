/**
 * Type-shape exercise. The build runs `tsc --noEmit` against this file to
 * verify the SDK's public surface compiles end-to-end. Nothing here is
 * executed; everything goes through `as any` for runtime placeholders that
 * never run, OR through a never-resolving promise to keep types honest.
 *
 * Goal: prove that a plausible call site type-checks with zero errors and
 * that no archetype's surface accidentally requires an unexposed type.
 */

import {
  KnowledgeBase, type Answer,
  AgentMemory, type RecallResult,
  GraphReasoner, type CypherResult,
  TimeSeriesMemory, type TemporalResult,
  LocalLLM, type GenerateResult, type StreamChunk,
  AgentFramework, type TaskResult,
  type QueryId,
  type ExplainTrace,
  type ValueReport,
  type Pipeline,
  type BackendSpec,
} from '../src/index.js';

// Forge a never-resolving promise so awaits compile but won't actually await.
function pending<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

// Cast helper for the QueryId branded type. In real use this comes from an Answer.
const fakeQueryId = 'q-123' as QueryId;

async function exerciseKnowledgeBase(backend: BackendSpec): Promise<void> {
  const kb: KnowledgeBase = await pending();
  void backend;

  await KnowledgeBase.create({
    source: './docs/**/*.md',
    backend,
    storage: './kb.rvf',
    embedder: { provider: 'auto' },
    capabilities: { hybrid: true, graphRag: true, sona: true, matryoshka: 'auto' },
  });

  const answer: Answer = await kb.ask('how does our auth flow work?', { k: 8 });
  const explain: ExplainTrace = answer.explain;
  void explain.path[0];
  void answer.citations[0]?.passage;
  void answer.queryId;

  await kb.ingest('./more-docs/');
  await kb.recordFeedback(answer.queryId, { score: 1, label: 'correct' });

  const report: ValueReport = await kb.getValueReport();
  for (const a of report.active) void a.invocations;
  for (const d of report.dormant) void d.enable;

  const pipe: Pipeline = kb.introspect();
  void pipe.archetype;
  void pipe.capabilities[0]?.active;
  await kb.close();
}

async function exerciseAgentMemory(): Promise<void> {
  const mem: AgentMemory = await pending();
  await AgentMemory.create({
    agentId: 'planner-1',
    capabilities: { sona: true, ewc: true, hyperbolic: 'auto' },
  });
  await mem.remember({ text: 'user prefers concise responses', importance: 0.7, tags: ['preferences'] });
  const recall: RecallResult = await mem.recall('what does the user prefer?', { k: 16, recency: 0.3 });
  void recall.records[0]?.score;
  await mem.recordFeedback(fakeQueryId, { score: -1, label: 'irrelevant' });
  await mem.forget('mem-42');
  await mem.close();
}

async function exerciseGraphReasoner(): Promise<void> {
  const g: GraphReasoner = await pending();
  await GraphReasoner.create({ dimensions: 16, distanceMetric: 'Cosine' });

  // M6 v0.1: nodes/edges/hyperedges require explicit embeddings. v0.2 will
  // accept an embedder config that derives them from a `text` field.
  const dummy = (): Float32Array => new Float32Array(16);
  await g.addNodes([
    { id: 'a', embedding: dummy(), labels: ['User'], properties: { name: 'Alice' } },
    { id: 'b', embedding: dummy(), labels: ['Doc'] },
  ]);
  await g.addEdges([{ from: 'a', to: 'b', description: 'OWNS', embedding: dummy() }]);
  await g.addHyperedges([{ nodes: ['a', 'b', 'c'], description: 'GROUP', embedding: dummy() }]);
  await g.addBatch({
    nodes: [{ id: 'c', embedding: dummy(), labels: ['Topic'] }],
    edges: [{ from: 'a', to: 'c', description: 'INTERESTED_IN', embedding: dummy() }],
  });

  const cy: CypherResult = await g.cypher('MATCH (u:User)-[:OWNS]->(d:Doc) RETURN u, d');
  void cy.nodes[0]?.id;
  void cy.edges[0]?.edgeType;
  void cy.stats?.totalNodes;

  const neighbors = await g.kHopNeighbors({ startNode: 'a', hops: 2 });
  void neighbors[0];

  const hits = await g.searchHyperedges({ embedding: dummy(), k: 5 });
  void hits[0]?.score;

  void (await g.stats()).avgDegree;

  const unsub = g.subscribe((_change: unknown) => {});
  unsub();

  // Health check — runs against an isolated probe, doesn't touch the graph.
  const health = await g.healthCheck();
  void health.summary;
  void health.statusCounts.ok;
  void health.checks[0]?.status;

  await g.close();
}

async function exerciseTimeSeries(): Promise<void> {
  const ts: TimeSeriesMemory = await pending();
  await TimeSeriesMemory.create({ streamId: 'sensor-7', bucketMs: 60_000 });
  await ts.append({ timestampMs: Date.now(), value: new Float32Array([1, 2, 3]) });
  await ts.appendBatch([
    { timestampMs: Date.now(), value: 'log line', tags: ['warn'] },
  ]);
  const out: TemporalResult = await ts.query(new Float32Array([1, 2, 3]), {
    window: { fromMs: 0, toMs: Date.now() },
    k: 5,
    changepoints: true,
  });
  void out.points[0]?.score;
  void out.changepoints[0]?.confidence;
  await ts.close();
}

async function exerciseLocalLLM(): Promise<void> {
  const llm: LocalLLM = await pending();
  await LocalLLM.create({ model: './models/llama-3-8b.gguf', device: 'auto' });

  const r: GenerateResult = await llm.generate('Hello, world.', {
    maxTokens: 256,
    temperature: 0.4,
    responseSchema: { type: 'object', properties: { answer: { type: 'string' } } },
  });
  void r.tokensOut;
  void r.structured;

  const stream: AsyncIterable<StreamChunk> = llm.stream('streaming demo');
  for await (const chunk of stream) void chunk.delta;

  const embeddings: readonly Float32Array[] = await llm.embed(['hi', 'world']);
  void embeddings[0];

  await llm.close();
}

async function exerciseAgentFramework(): Promise<void> {
  const fw: AgentFramework = await pending();
  await AgentFramework.create({
    agentId: 'orchestrator',
    capabilities: { mcp: true, a2a: false, policy: true },
    defaultPolicy: { maxTokens: 4096, maxCostUsd: 0.10, maxConcurrency: 4 },
  });
  fw.registerTool({
    name: 'search-docs',
    description: 'Search internal documentation',
    handler: async (_args: unknown) => ({ ok: true }),
  });
  const res: TaskResult = await fw.run({ prompt: 'plan a deploy', context: { repo: 'foo' } });
  void res.toolCalls[0]?.tool;

  const peers = await fw.discoverPeers();
  if (peers[0]) {
    const fanout: TaskResult = await fw.dispatchToPeer(peers[0], { prompt: 'help' });
    void fanout.durationMs;
  }
  await fw.close();
}

// Surface check entry point. Never executed; tsc just verifies it type-checks.
export async function _surfaceCheck(): Promise<void> {
  await exerciseKnowledgeBase('auto');
  await exerciseKnowledgeBase({ kind: 'http', endpoint: 'https://example.com' });
  await exerciseAgentMemory();
  await exerciseGraphReasoner();
  await exerciseTimeSeries();
  await exerciseLocalLLM();
  await exerciseAgentFramework();
}
