/**
 * `recommend` — interactive + non-interactive workload-to-config mapper.
 *
 * **M15.2 Phase-1B** — second CLI subcommand. Per ratified M15 §6:
 *   Q1 `node:readline` (no Inquirer dependency).
 *   Q2 generated config is a TS module exporting `createSdk()`.
 *   Q3 workloads table is data-only (`./workloads.ts`).
 *
 * Both interactive and non-interactive paths share the same internal
 * mapper: `selectWorkload(answers) → WorkloadRecommendation` and
 * `renderConfig(rec, answers) → string`. Interactive prompts via
 * `node:readline` (5 questions); non-interactive accepts the same
 * 5 fields as flags.
 */

import { createInterface } from 'node:readline/promises';
import { writeFileSync } from 'node:fs';
import { dirname, join as joinPath, relative as relPath, resolve as resolvePath } from 'node:path';
import { WORKLOADS, findWorkload, type Archetype, type WorkloadKey, type WorkloadRecommendation } from './workloads.js';

export type DataSizeBucket = '<1k' | '1k-100k' | '100k-1M' | '1M+';
export type LatencyBucket = '<10ms' | '<50ms' | '<200ms' | '>200ms';
export type UpdatePattern = 'mostly-read' | 'daily-batch' | 'streaming' | 'bursty';

export interface RecommendAnswers {
  readonly workload: WorkloadKey;
  readonly dataSize: DataSizeBucket;
  readonly latency: LatencyBucket;
  readonly updates: UpdatePattern;
  readonly generate: boolean;
}

export interface RecommendOptions {
  /** When set, runs non-interactively from these flags. */
  readonly fromFlags?: Partial<RecommendAnswers>;
  /** Output path. Default: `./ruvector.config.ts`. */
  readonly outPath?: string;
  /** Stream for prompts/output. Default: process.stdout. */
  readonly out?: NodeJS.WritableStream;
  /** Stream for reading interactive answers. Default: process.stdin. */
  readonly input?: NodeJS.ReadableStream;
  /**
   * v0.2: in-repo / pre-publish development. When set, the generated config
   * imports from this path (resolved relative to the output file's directory)
   * instead of the published `'@ruvector/sdk'` specifier. Pass a directory
   * containing the SDK package — the codegen appends `/dist/index.js`.
   */
  readonly localSdkPath?: string;
}

// ---------------- Public entry points ----------------

/**
 * Run the recommend flow end-to-end. Picks interactive vs non-interactive
 * based on whether `fromFlags` has all 5 answers.
 */
export async function runRecommend(options: RecommendOptions = {}): Promise<{ outPath: string; recommendation: WorkloadRecommendation; answers: RecommendAnswers }> {
  const out = options.out ?? process.stdout;
  const write = (s: string): void => { out.write(s + '\n'); };

  const answers = isComplete(options.fromFlags)
    ? options.fromFlags as RecommendAnswers
    : await runInteractive({ ...(options.input !== undefined && { input: options.input }), out });

  const rec = findWorkload(answers.workload);
  if (!rec) {
    throw new RecommendError('UNKNOWN_WORKLOAD', `Unknown workload key: ${answers.workload}. Run with --help to list.`);
  }

  write('');
  write(`→ Recommended: ${rec.archetypes.join(' + ')}`);
  if (rec.couplings.length > 0) {
    for (const c of rec.couplings) {
      write(`    coupled: ${c.from} ← { ${c.injects.join(', ')} }`);
    }
  }
  if (rec.skips.length > 0) {
    write(`→ Skip:`);
    for (const s of rec.skips) {
      write(`    ${s.archetype}.${s.capability}  ${s.reasonShort}`);
    }
  }

  const outPath = resolvePath(process.cwd(), options.outPath ?? './ruvector.config.ts');
  const importSpecifier = computeImportSpecifier(options.localSdkPath, outPath);
  const code = renderConfig(rec, answers, importSpecifier);
  writeFileSync(outPath, code, 'utf8');
  write(`→ Generated: ${outPath}`);
  if (options.localSdkPath) write(`    using local SDK: import from '${importSpecifier}'`);
  return { outPath, recommendation: rec, answers };
}

/**
 * Compute the import specifier the generated config should use. Returns
 * `'@ruvector/sdk'` for published-package consumers; for in-repo development,
 * resolves the local SDK path to the output file's location and points at
 * `dist/index.js`. ESM specifiers need a leading `./` when relative.
 */
function computeImportSpecifier(localSdkPath: string | undefined, outPath: string): string {
  if (!localSdkPath) return '@ruvector/sdk';
  const absSdkEntry = joinPath(resolvePath(process.cwd(), localSdkPath), 'dist', 'index.js');
  const rel = relPath(dirname(outPath), absSdkEntry);
  // Normalize backslashes on Windows; ESM needs forward slashes.
  const normalized = rel.split(/[\\/]/).join('/');
  return normalized.startsWith('.') ? normalized : './' + normalized;
}

// ---------------- Interactive flow ----------------

interface InteractiveOptions {
  readonly out: NodeJS.WritableStream;
  readonly input?: NodeJS.ReadableStream;
}

async function runInteractive(opts: InteractiveOptions): Promise<RecommendAnswers> {
  const rl = createInterface({
    input: (opts.input ?? process.stdin) as NodeJS.ReadableStream as never,
    output: opts.out as never,
  });
  try {
    const workload = await askEnum(rl, 'What are you building?', WORKLOADS.map((w) => ({ key: w.key, label: w.headline })));
    const dataSize = await askEnum(rl, 'How much data?', [
      { key: '<1k', label: '<1k items' },
      { key: '1k-100k', label: '1k–100k items' },
      { key: '100k-1M', label: '100k–1M items' },
      { key: '1M+', label: '1M+ items (DiskANN territory; upstream-binding-blocked today)' },
    ]) as DataSizeBucket;
    const latency = await askEnum(rl, 'Latency target p95?', [
      { key: '<10ms', label: 'sub-10ms' },
      { key: '<50ms', label: '<50ms (default)' },
      { key: '<200ms', label: '<200ms' },
      { key: '>200ms', label: '>200ms (no real cap)' },
    ]) as LatencyBucket;
    const updates = await askEnum(rl, 'Update pattern?', [
      { key: 'mostly-read', label: 'mostly-read' },
      { key: 'daily-batch', label: 'daily batch ingest' },
      { key: 'streaming', label: 'streaming / continuous' },
      { key: 'bursty', label: 'bursty / unpredictable' },
    ]) as UpdatePattern;
    const generate = (await askEnum(rl, 'Need text generation?', [
      { key: 'yes', label: 'yes (gates LocalLLM Phase 2A wiring)' },
      { key: 'no', label: 'no (retrieval-only — recommended for v0.1)' },
    ])) === 'yes';
    return { workload: workload as WorkloadKey, dataSize, latency, updates, generate };
  } finally {
    rl.close();
  }
}

async function askEnum(
  rl: { question: (prompt: string) => Promise<string> },
  prompt: string,
  options: readonly { key: string; label: string }[],
): Promise<string> {
  const out = process.stdout;
  out.write(`\n? ${prompt}\n`);
  for (let i = 0; i < options.length; i++) {
    out.write(`    ${i + 1}. ${options[i]!.label}  [${options[i]!.key}]\n`);
  }
  while (true) {
    const raw = (await rl.question('  > ')).trim();
    // Accept either numeric index or key.
    if (/^\d+$/.test(raw)) {
      const i = Number.parseInt(raw, 10) - 1;
      if (i >= 0 && i < options.length) return options[i]!.key;
    }
    const matched = options.find((o) => o.key === raw);
    if (matched) return matched.key;
    out.write(`  invalid input. Pick a number 1-${options.length} or key from: ${options.map((o) => o.key).join(', ')}\n`);
  }
}

// ---------------- Codegen ----------------

/**
 * Short variable names used in the generated config. The construction lines
 * and the returned object key off these so the emitted file actually
 * type-checks and runs.
 */
const VAR_NAMES: Record<Archetype, string> = {
  LocalLLM: 'llm',
  GraphReasoner: 'graph',
  KnowledgeBase: 'kb',
  TimeSeriesMemory: 'timeSeriesMemory',
  AgentMemory: 'agentMemory',
  AgentFramework: 'agentFramework',
};

export function renderConfig(rec: WorkloadRecommendation, answers: RecommendAnswers, importSpecifier: string = '@ruvector/sdk'): string {
  const dimsExpr = rec.archetypes.includes('LocalLLM') ? 'llm.embedDimensions' : '768';

  const importNames = rec.archetypes;
  const importLine = `import {\n  ${importNames.join(',\n  ')},\n} from '${importSpecifier}';\n`;

  const constructions = rec.archetypes.map((name) => buildArchetypeConstruction(name, rec, dimsExpr)).join('\n');
  const returnObject = rec.archetypes
    .map((name) => `    ${VAR_NAMES[name]}`)
    .join(',\n');

  const skipLines = rec.skips.length === 0
    ? ''
    : '//\n// Skipped capabilities (per `sdk recommend` analysis):\n' +
      rec.skips.map((s) => `//   - ${s.archetype}.${s.capability}  ${s.reasonShort}`).join('\n') + '\n';

  const generatedAt = new Date().toISOString();

  return `// Generated by \`@ruvector/sdk recommend\` (M15.2). Edit freely.
${skipLines}//
// Audit later with: \`npx @ruvector/sdk audit ./ruvector.config.ts\` (Phase-2).
// Diagnose with:    \`npx @ruvector/sdk doctor ./ruvector.config.ts\`

${importLine}
export async function createSdk() {
${constructions}
  return {
${returnObject},
  };
}

export const _meta = {
  generatedBy: '@ruvector/sdk recommend',
  workload: ${JSON.stringify(rec.key)},
  generatedAt: ${JSON.stringify(generatedAt)},
  answers: ${JSON.stringify(answers, null, 2).split('\n').join('\n  ')},
  rationale: ${JSON.stringify(rec.rationale)},
};
`;
}

function buildArchetypeConstruction(name: Archetype, rec: WorkloadRecommendation, dimsExpr: string): string {
  const coupling = rec.couplings.find((c) => c.from === name);
  const injects = coupling?.injects ?? [];

  switch (name) {
    case 'LocalLLM':
      return `  const llm = await LocalLLM.create();\n`;

    case 'GraphReasoner': {
      const fields = ['dimensions: ' + dimsExpr, "distanceMetric: 'Cosine'"];
      if (injects.includes('LocalLLM')) fields.push('embedder: llm');
      return `  const graph = await GraphReasoner.create({\n    ${fields.join(',\n    ')},\n  });\n`;
    }

    case 'KnowledgeBase': {
      const fields = ['dimensions: ' + dimsExpr, "distanceMetric: 'Cosine'", "// bindingPath: process.env.RUVECTOR_CORE_BINDING ?? '<path-to-ruvector.node>'"];
      if (injects.includes('LocalLLM')) fields.push('embedder: llm');
      if (injects.includes('GraphReasoner')) fields.push('graphReasoner: graph');
      return `  const kb = await KnowledgeBase.create({\n    ${fields.join(',\n    ')},\n  });\n`;
    }

    case 'TimeSeriesMemory': {
      const fields = ["streamId: 'default'", 'dimensions: ' + dimsExpr, "// bindingPath: process.env.RUVECTOR_CORE_BINDING"];
      if (injects.includes('LocalLLM')) fields.push('embedder: llm');
      return `  const timeSeriesMemory = await TimeSeriesMemory.create({\n    ${fields.join(',\n    ')},\n  });\n`;
    }

    case 'AgentMemory': {
      const fields = ["agentId: 'default-agent'", 'dimensions: ' + dimsExpr, "// bindingPath: process.env.RUVECTOR_CORE_BINDING"];
      if (injects.includes('LocalLLM')) fields.push('embedder: llm');
      if (injects.includes('GraphReasoner')) fields.push('graphReasoner: graph');
      fields.push('sona: true');
      return `  const agentMemory = await AgentMemory.create({\n    ${fields.join(',\n    ')},\n  });\n`;
    }

    case 'AgentFramework': {
      const fields = ["agentId: 'orchestrator'"];
      if (injects.includes('LocalLLM')) fields.push('llm');
      if (injects.includes('KnowledgeBase')) fields.push('kb');
      if (injects.includes('AgentMemory')) fields.push('memory: agentMemory');
      if (injects.includes('GraphReasoner')) fields.push('graph');
      fields.push('defaultPolicy: { maxDurationMs: 5000, maxConcurrency: 4 }');
      return `  const agentFramework = await AgentFramework.create({\n    ${fields.join(',\n    ')},\n  });\n`;
    }
  }
}

// ---------------- Helpers ----------------

function isComplete(p: Partial<RecommendAnswers> | undefined): p is RecommendAnswers {
  if (!p) return false;
  return p.workload !== undefined
    && p.dataSize !== undefined
    && p.latency !== undefined
    && p.updates !== undefined
    && p.generate !== undefined;
}

class RecommendError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'RecommendError';
  }
}

export { RecommendError };
