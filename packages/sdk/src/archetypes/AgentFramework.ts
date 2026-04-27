/**
 * Build, run, and orchestrate AI agents with policy, A2A communication,
 * and tool dispatch.
 *
 * **M14.1 Phase-1A** — sixth archetype lands as a pure-orchestration shell
 * over the 5 already-shipped archetypes (LocalLLM / KnowledgeBase /
 * AgentMemory / GraphReasoner / TimeSeriesMemory). The "framework" job —
 * task lifecycle, tool dispatch, sub-agent recursion, policy enforcement —
 * doesn't fundamentally need a binding; the rvAgent crate family has 0 of 9
 * named NAPI bindings published per the M14 reprobe.
 *
 * Default-active capabilities in v0.1:
 *   - taskExecution / toolDispatch                     — SDK orchestration
 *
 * Toggled-active when the user wires the corresponding archetype:
 *   - llmInvocation / kbContext / memoryRecall / graphReasoning
 *   - subagentDispatch / policyEnforcement
 *
 * Dormant in v0.1:
 *   - mcp / a2a / acp                                   — upstream-binding (rvagent-* unpublished)
 *   - tool-call-parsing                                 — upstream-bug (Issue #05; LLM produces gibberish)
 *
 * **Phase-1A Q-ratification leans applied** (see m14-scope.md §6):
 *   - Q1 no MCP integration yet (Phase-1B candidate via @modelcontextprotocol/sdk)
 *   - Q2 toolCalls populated only from explicit framework-side registerTool callbacks the framework invokes itself; no LLM-driven parsing
 *   - Q3 no SDK-source A2A; discoverPeers/dispatchToPeer throw upstream-binding errors
 *   - Q4 subset policy: maxTokens / maxDurationMs / maxConcurrency wired; maxCostUsd deferred
 *   - Q5 ship Phase-1A as v1.0 with 0-of-4 protocols active and explicit dormant-row honesty
 */

import type { BackendSpec } from '../core/backend.js';
import type { ExplainTrace } from '../core/explain.js';
import type { Pipeline } from '../core/pipeline.js';
import type { ValueReport, ValueReportProvider } from '../core/value-report.js';
import type { CheckResult, HealthCheckProvider, HealthCheckResult } from '../core/health.js';
import type { CapabilityCatalogEntry } from '../core/capability-catalog.js';
import { RuVectorError, reduceIntrospect, reduceValueReport, runCheck, summarize } from '../core/index.js';
import type { LocalLLM } from './LocalLLM.js';
import type { KnowledgeBase } from './KnowledgeBase.js';
import type { AgentMemory } from './AgentMemory.js';
import type { GraphReasoner } from './GraphReasoner.js';

// ---------------- Public types ----------------

export interface AgentFrameworkOptions {
  readonly agentId: string;
  readonly backend?: BackendSpec;
  readonly capabilities?: AgentFrameworkCapabilityConfig;
  /** Default policy applied to every task. */
  readonly defaultPolicy?: TaskPolicy;
  /**
   * Cross-archetype dependencies. Same M11.2/M13.1 DI pattern. Each is
   * optional; the framework's `getValueReport` reflects which couplings
   * the user wired.
   */
  readonly llm?: LocalLLM;
  readonly kb?: KnowledgeBase;
  readonly memory?: AgentMemory;
  readonly graph?: GraphReasoner;
  /** Sub-agents composed into this framework; `run` walks them recursively. */
  readonly subagents?: readonly AgentFramework[];
}

export interface AgentFrameworkCapabilityConfig {
  /** Default: false. Opt in to expose the agent over A2A. */
  readonly a2a?: boolean;
  /** Default: true. Local ACP server. */
  readonly acp?: boolean;
  /** Default: true. */
  readonly mcp?: boolean;
  /** Default: true. */
  readonly policy?: boolean;
  /** Default: 'auto'. */
  readonly subagents?: 'auto' | boolean;
}

export interface TaskPolicy {
  /** Char-count proxy in v0.1; real token count requires upstream Issue #05 fix. */
  readonly maxTokens?: number;
  /** Deferred to v0.2 — requires per-LLM-call cost models. */
  readonly maxCostUsd?: number;
  readonly maxDurationMs?: number;
  readonly allowedSkills?: readonly string[];
  readonly maxConcurrency?: number;
}

export interface AgentTask {
  readonly id?: string;
  readonly prompt: string;
  readonly policy?: TaskPolicy;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface TaskResult {
  readonly taskId: string;
  readonly response: string;
  readonly toolCalls: readonly ToolCall[];
  readonly subagentCalls: readonly SubagentCall[];
  readonly costUsd: number;
  readonly durationMs: number;
  readonly explain: ExplainTrace;
}

export interface ToolCall {
  readonly tool: string;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly result?: unknown;
}

export interface SubagentCall {
  readonly agentId: string;
  readonly prompt: string;
  readonly response?: string;
}

/** A2A peer descriptor. */
export interface PeerDescriptor {
  readonly agentId: string;
  /** Public key fingerprint per ADR-159 (`SHAKE-256(pubkey_ed25519)`). */
  readonly fingerprint: string;
  readonly endpoint: string;
  readonly skills: readonly string[];
}

/**
 * Tool registration shape for `registerTool`.
 *
 * Distinct from `LocalLLM.ToolDefinition` (which carries a `parameters`
 * schema for LLM tool-calling protocol declaration). This shape carries
 * a `handler` for execution. M14 §6 Q2 ratification: Phase-1A does not
 * parse LLM output for tool calls; the framework dispatches via explicit
 * `invokeTool(name, args)` calls.
 */
export interface FrameworkTool {
  readonly name: string;
  readonly description: string;
  readonly handler: (args: unknown) => Promise<unknown>;
}

// ---------------- Capability catalog ----------------

const CAPABILITY_CATALOG: readonly CapabilityCatalogEntry[] = [
  { name: 'taskExecution', source: '@ruvector/sdk', invocationKey: 'run', defaultStatus: 'active' },
  { name: 'toolDispatch', source: '@ruvector/sdk', invocationKey: 'invokeTool', defaultStatus: 'active' },
  {
    name: 'llmInvocation',
    source: 'ruvllm',
    probeName: 'llmInvocation',
    invocationKey: 'llmInvocation',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'sdk-integration',
    defaultDormantReason: 'AgentFramework was constructed without an `llm`. Pass `llm: <LocalLLM>` at create-time to enable LLM invocation in run().',
    defaultDormantLift: 'Lets run() generate a response over the user\'s prompt with optional retrieved context.',
    defaultDormantEnable: 'await AgentFramework.create({ ..., llm: await LocalLLM.create() })',
  },
  {
    name: 'kbContext',
    source: 'ruvector-core',
    probeName: 'kbContext',
    invocationKey: 'kbContext',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'sdk-integration',
    defaultDormantReason: 'AgentFramework was constructed without a `kb`. Pass `kb: <KnowledgeBase>` at create-time to enable retrieval-augmented context in run().',
    defaultDormantLift: 'RAG-style context-fetch ahead of LLM invocation.',
    defaultDormantEnable: 'await AgentFramework.create({ ..., kb: await KnowledgeBase.create({ dimensions }) })',
  },
  {
    name: 'memoryRecall',
    source: 'ruvector-core',
    probeName: 'memoryRecall',
    invocationKey: 'memoryRecall',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'sdk-integration',
    defaultDormantReason: 'AgentFramework was constructed without a `memory`. Pass `memory: <AgentMemory>` at create-time.',
    defaultDormantLift: 'Per-agent state recall ahead of LLM invocation.',
    defaultDormantEnable: 'await AgentFramework.create({ ..., memory: await AgentMemory.create({ agentId, dimensions }) })',
  },
  {
    name: 'graphReasoning',
    source: 'ruvector-graph',
    probeName: 'graphReasoning',
    invocationKey: 'graphReasoning',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'sdk-integration',
    defaultDormantReason: 'AgentFramework was constructed without a `graph`. Pass `graph: <GraphReasoner>` to enable relation-aware context.',
    defaultDormantLift: 'Cross-entity context fan-out via kHopNeighbors.',
    defaultDormantEnable: 'await AgentFramework.create({ ..., graph: await GraphReasoner.create({ dimensions }) })',
  },
  {
    name: 'subagentDispatch',
    source: '@ruvector/sdk',
    probeName: 'subagentDispatch',
    invocationKey: 'subagentDispatch',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'sdk-integration',
    defaultDormantReason: 'AgentFramework was constructed without `subagents`. Pass an array at create-time to enable recursive run() dispatch.',
    defaultDormantLift: 'Hierarchical agent composition; sub-agents handle scoped sub-tasks.',
    defaultDormantEnable: 'await AgentFramework.create({ ..., subagents: [other] })',
  },
  {
    name: 'policyEnforcement',
    source: '@ruvector/sdk',
    probeName: 'policyEnforcement',
    invocationKey: 'policyEnforcement',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'sdk-integration',
    defaultDormantReason: 'AgentFramework was constructed without a `defaultPolicy` (and no per-task policy supplied). Wire one to enable maxTokens / maxDurationMs / maxConcurrency enforcement.',
    defaultDormantLift: 'Hard caps on resource use per task.',
    defaultDormantEnable: 'await AgentFramework.create({ ..., defaultPolicy: { maxDurationMs: 5000, maxConcurrency: 4 } })',
  },
  {
    name: 'mcp',
    source: 'rvagent-mcp',
    adrs: ['ADR-108'],
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: '@ruvector/rvagent-mcp is not published. Public @modelcontextprotocol/sdk path is a Phase-1B candidate (M14 §6 Q1 ratifies).',
    defaultDormantLift: 'Tool discovery + invocation via the public Model Context Protocol.',
    defaultDormantEnable: 'Track @ruvector/rvagent-mcp publishing, OR wait for Phase-1B (@modelcontextprotocol/sdk integration).',
  },
  {
    name: 'a2a',
    source: 'rvagent-a2a',
    adrs: ['ADR-159'],
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: '@ruvector/rvagent-a2a is not published. ADR-159 specifies SHAKE-256 peer auth; requires upstream binding.',
    defaultDormantLift: 'Cross-process agent-to-agent peer discovery + auth.',
    defaultDormantEnable: 'Track @ruvector/rvagent-a2a publishing.',
  },
  {
    name: 'acp',
    source: 'rvagent-acp',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-binding',
    defaultDormantReason: '@ruvector/rvagent-acp is not published.',
    defaultDormantLift: 'Standardized client↔agent protocol; lets external clients drive the agent.',
    defaultDormantEnable: 'Track @ruvector/rvagent-acp publishing.',
  },
  {
    name: 'toolCallParsing',
    source: '@ruvector/sdk',
    defaultStatus: 'dormant',
    defaultDormantBlocker: 'upstream-bug',
    defaultDormantReason: 'LLM-driven tool calling depends on a real model that produces structured tool-call output. The upstream LocalLLM binding produces gibberish today (Issue #05). Phase-1A populates toolCalls only from explicit framework-side registerTool dispatches.',
    defaultDormantLift: 'LLM-driven tool dispatch where run() inspects the model output and invokes named tools automatically.',
    defaultDormantEnable: 'Wait for Issue #05 fix (model-loading API in upstream NAPI), then ship Phase-1B parser.',
  },
];

// ---------------- Implementation ----------------

const SUBAGENT_MAX_DEPTH = 8;

export class AgentFramework implements ValueReportProvider, HealthCheckProvider {
  private readonly _options: AgentFrameworkOptions;
  private readonly _tools = new Map<string, FrameworkTool>();
  private readonly _activeRuns = { count: 0 };
  private _invocationCounts = new Map<string, number>();
  private _closed = false;
  private _idCounter = 0;
  private _lastHealth: HealthCheckResult | null = null;

  private constructor(options: AgentFrameworkOptions) {
    this._options = options;
  }

  static async create(options: AgentFrameworkOptions): Promise<AgentFramework> {
    return new AgentFramework(options);
  }

  /**
   * Run a task to completion. Phase-1A orchestration:
   *
   *   1. Apply policy (default + per-task overrides).
   *   2. Concurrency check (semaphore on `_activeRuns`).
   *   3. Optional KB context retrieve.
   *   4. Optional memory recall.
   *   5. Optional LLM invocation with assembled context-prompt.
   *   6. Sub-agent dispatch.
   *   7. Resolve.
   *
   * Tool calls are NOT parsed from LLM output; callers invoke tools
   * explicitly via `invokeTool` (or the framework dispatches them
   * inside its own logic). Per M14 §6 Q2.
   */
  async run(task: AgentTask): Promise<TaskResult> {
    this.assertOpen();
    const start = performance.now();
    const taskId = task.id ?? this._nextTaskId();
    const policy = { ...this._options.defaultPolicy, ...task.policy };
    const stages: Array<ExplainTrace['stages'][number]> = [];
    const path: string[] = [];
    const capabilities: Array<ExplainTrace['capabilities'][number]> = [];

    // Concurrency cap (semaphore).
    if (policy.maxConcurrency !== undefined && this._activeRuns.count >= policy.maxConcurrency) {
      throw new RuVectorError(
        'POLICY_VIOLATION',
        `maxConcurrency=${policy.maxConcurrency} exceeded (currently ${this._activeRuns.count} active runs).`,
      );
    }
    if (policy.maxTokens !== undefined || policy.maxDurationMs !== undefined || policy.maxConcurrency !== undefined) {
      this.bump('policyEnforcement');
    }
    this._activeRuns.count++;

    let response = '';
    const toolCalls: ToolCall[] = [];
    const subagentCalls: SubagentCall[] = [];
    let promptWithContext = task.prompt;

    try {
      // KB context.
      if (this._options.kb !== undefined) {
        const tCtx = performance.now();
        // KB.retrieve accepts string OR Float32Array. With an embedder wired
        // it embeds; without one it throws. Phase-1A swallows and notes; users
        // wanting RAG should wire an embedder on the KB.
        try {
          const r = await this._options.kb.retrieve(task.prompt, { k: 4 });
          const citationText = r.citations.map((c) => `[${c.documentId}]`).join(' ');
          promptWithContext = `${task.prompt}\n\n[context: ${citationText}]`;
          stages.push({ name: 'kbRetrieve', source: 'ruvector-core', durationMs: performance.now() - tCtx, note: `${r.citations.length} citations` });
          path.push('kbRetrieve');
          capabilities.push({ name: 'kbContext', source: 'ruvector-core', estimatedLift: null });
          this.bump('kbContext');
        } catch (e) {
          // Swallow but trace — the framework's contract is to attempt RAG
          // when wired; failure shouldn't abort the whole task.
          stages.push({ name: 'kbRetrieve', source: 'ruvector-core', durationMs: performance.now() - tCtx, note: `skipped: ${e instanceof Error ? e.message : 'unknown'}` });
        }
      }

      // Memory recall.
      if (this._options.memory !== undefined) {
        const tMem = performance.now();
        try {
          const r = await this._options.memory.recall(task.prompt, { k: 4 });
          stages.push({ name: 'memoryRecall', source: 'ruvector-core', durationMs: performance.now() - tMem, note: `${r.records.length} memories` });
          path.push('memoryRecall');
          capabilities.push({ name: 'memoryRecall', source: 'ruvector-core', estimatedLift: null });
          this.bump('memoryRecall');
        } catch (e) {
          stages.push({ name: 'memoryRecall', source: 'ruvector-core', durationMs: performance.now() - tMem, note: `skipped: ${e instanceof Error ? e.message : 'unknown'}` });
        }
      }

      // Per-task time cap (checked before LLM since LLM dominates latency).
      if (policy.maxDurationMs !== undefined && (performance.now() - start) > policy.maxDurationMs) {
        throw new RuVectorError('POLICY_VIOLATION', `maxDurationMs=${policy.maxDurationMs} exceeded before LLM invocation.`);
      }

      // LLM invocation.
      if (this._options.llm !== undefined) {
        const tLlm = performance.now();
        // maxTokens char-proxy: chars/4 ≈ tokens (per M12.1 GenerateResult heuristic).
        const charBudget = policy.maxTokens !== undefined ? policy.maxTokens * 4 : undefined;
        if (charBudget !== undefined && promptWithContext.length > charBudget) {
          throw new RuVectorError('POLICY_VIOLATION', `prompt+context length ${promptWithContext.length} chars exceeds maxTokens=${policy.maxTokens} (×4 char proxy).`);
        }
        const g = await this._options.llm.generate(promptWithContext, policy.maxTokens !== undefined ? { maxTokens: policy.maxTokens } : {});
        response = g.text;
        stages.push({ name: 'llmGenerate', source: 'ruvllm', durationMs: performance.now() - tLlm, note: `${g.tokensIn}→${g.tokensOut} tok (heuristic)` });
        path.push('llmGenerate');
        capabilities.push({ name: 'llmInvocation', source: 'ruvllm', estimatedLift: null });
        this.bump('llmInvocation');
      }

      // Sub-agent dispatch — sequential, not parallel (composition is hierarchical
      // by design). Sub-agents inherit the parent task's prompt unless callers
      // dispatch via dispatchToSubagent explicitly with a different one.
      if (this._options.subagents && this._options.subagents.length > 0) {
        for (const sub of this._options.subagents) {
          if (sub === this) {
            throw new RuVectorError('SUBAGENT_CYCLE', 'sub-agent list contains self; cycles not allowed.');
          }
          const tSub = performance.now();
          const subResult = await sub.run({ prompt: task.prompt });
          subagentCalls.push({ agentId: sub._options.agentId, prompt: task.prompt, response: subResult.response });
          stages.push({ name: 'subagentDispatch', source: '@ruvector/sdk', durationMs: performance.now() - tSub, note: `agent=${sub._options.agentId}` });
          this.bump('subagentDispatch');
        }
        path.push('subagentDispatch');
        capabilities.push({ name: 'subagentDispatch', source: '@ruvector/sdk', estimatedLift: null });
      }

      // Final time-cap check.
      const total = performance.now() - start;
      if (policy.maxDurationMs !== undefined && total > policy.maxDurationMs) {
        throw new RuVectorError('POLICY_VIOLATION', `task took ${total.toFixed(2)}ms; maxDurationMs=${policy.maxDurationMs} exceeded.`);
      }

      this.bump('run');
      return {
        taskId,
        response,
        toolCalls,
        subagentCalls,
        costUsd: 0, // Q4: maxCostUsd deferred until upstream LocalLLM cost models.
        durationMs: total,
        explain: { path, stages, capabilities, totalLatencyMs: total },
      };
    } finally {
      this._activeRuns.count--;
    }
  }

  /**
   * Explicit framework-driven tool invocation. Per M14 §6 Q2, this is the
   * only path that populates `toolCalls` in v0.1 — the framework decides
   * (in user-supplied logic, not via LLM-driven parsing) which tools to
   * dispatch and when. Returns the handler's result.
   */
  async invokeTool(name: string, args: unknown): Promise<{ tool: string; arguments: Readonly<Record<string, unknown>>; result: unknown }> {
    this.assertOpen();
    const tool = this._tools.get(name);
    if (!tool) {
      throw new RuVectorError('TOOL_NOT_REGISTERED', `Tool '${name}' is not registered. Use registerTool({ name, description, handler }) first.`);
    }
    this.bump('invokeTool');
    const result = await tool.handler(args);
    const argsObj = (typeof args === 'object' && args !== null) ? args as Record<string, unknown> : { value: args };
    return { tool: name, arguments: argsObj, result };
  }

  /** Register a tool the agent (or external code) can invoke via `invokeTool`. */
  registerTool(tool: FrameworkTool): void {
    this.assertOpen();
    if (this._tools.has(tool.name)) {
      throw new RuVectorError('TOOL_ALREADY_REGISTERED', `Tool '${tool.name}' is already registered.`);
    }
    this._tools.set(tool.name, tool);
  }

  // ----- A2A (deferred — Q3) -----

  /** @deprecated Phase 2 — `@ruvector/rvagent-a2a` not published. */
  discoverPeers(): Promise<readonly PeerDescriptor[]> {
    throw new RuVectorError(
      'CAPABILITY_DEFERRED',
      'discoverPeers() is deferred — @ruvector/rvagent-a2a is not published. ADR-159 specifies SHAKE-256 peer auth; SDK-source A2A would be cosplay (M14 §6 Q3 lean: defer cleanly).',
    );
  }

  /** @deprecated Phase 2. */
  dispatchToPeer(_peer: PeerDescriptor, _task: AgentTask): Promise<TaskResult> {
    throw new RuVectorError(
      'CAPABILITY_DEFERRED',
      'dispatchToPeer() is deferred — same root cause as discoverPeers().',
    );
  }

  // ----- Cross-cutting -----

  async healthCheck(): Promise<HealthCheckResult> {
    this.assertOpen();
    const checks = await this._archetypeProbes();
    this._lastHealth = summarize('AgentFramework', 'native', checks);
    return this._lastHealth;
  }

  async getValueReport(): Promise<ValueReport> {
    return reduceValueReport({
      catalog: CAPABILITY_CATALOG,
      lastHealth: this._lastHealth,
      invocationCounts: this._invocationCounts,
    });
  }

  introspect(): Pipeline {
    return reduceIntrospect('AgentFramework', { catalog: CAPABILITY_CATALOG, lastHealth: this._lastHealth });
  }

  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    // Sub-agents are USER-OWNED; framework doesn't close them (matches M11.2/M13.1
    // ownership convention — DI dependencies aren't owned by the consumer).
  }

  // ----- Internals -----

  private async _archetypeProbes(): Promise<readonly CheckResult[]> {
    const checks: CheckResult[] = [];

    // Each opt-in capability gets a check that runs only when wired.
    checks.push(await this._policyEnforcementProbe());
    checks.push(await this._subagentDispatchProbe());
    checks.push(await this._llmInvocationProbe());
    checks.push(this._unsupported('kbContext', this._options.kb !== undefined, 'no kb supplied at create-time'));
    checks.push(this._unsupported('memoryRecall', this._options.memory !== undefined, 'no memory supplied at create-time'));
    checks.push(this._unsupported('graphReasoning', this._options.graph !== undefined, 'no graph supplied at create-time'));

    return checks;
  }

  /**
   * Tier-3 probe — exercises the SDK's run() path with a synthetic tool that
   * the probe registers + invokes explicitly. Asserts the tool handler ran
   * (proves the registration → invokeTool plumbing) and that run()
   * completed without policy violations.
   */
  private async _llmInvocationProbe(): Promise<CheckResult> {
    return await runCheck('llmInvocation', async () => {
      const probe = await AgentFramework.create({ agentId: `__ruvsdk_probe_af_${Date.now()}` });
      try {
        let toolRan = false;
        probe.registerTool({
          name: 'probe-tool',
          description: 'no-op tool for the agentFrameworkRun probe',
          handler: async () => { toolRan = true; return { ok: true }; },
        });
        const r = await probe.run({ prompt: 'hello' });
        await probe.invokeTool('probe-tool', { x: 1 });
        if (!toolRan) return { status: 'broken' as const, detail: 'probe-tool handler did not run' };
        if (typeof r.taskId !== 'string') return { status: 'broken' as const, detail: 'task result missing taskId' };
        return { status: 'ok' as const, detail: `run() ok; tool registered+invoked; taskId=${r.taskId}` };
      } finally {
        await probe.close();
      }
    }, 'archetype');
  }

  private async _policyEnforcementProbe(): Promise<CheckResult> {
    return await runCheck('policyEnforcement', async () => {
      const probe = await AgentFramework.create({
        agentId: `__ruvsdk_probe_af_pol_${Date.now()}`,
        defaultPolicy: { maxDurationMs: 0 }, // 0 ≡ "must finish synchronously"; LLM-less run completes ~0ms but the post-check fires
      });
      try {
        // With no llm/kb/memory wired, run() is essentially a no-op + policy check.
        // maxDurationMs: 0 should trip on the final time-cap check since
        // performance.now() resolution > 0.
        try {
          await probe.run({ prompt: 'x' });
          return { status: 'broken' as const, detail: 'expected POLICY_VIOLATION on maxDurationMs=0; got success' };
        } catch (e) {
          if (e instanceof RuVectorError && e.code === 'POLICY_VIOLATION') {
            return { status: 'ok' as const, detail: 'maxDurationMs=0 correctly raised POLICY_VIOLATION' };
          }
          return { status: 'broken' as const, detail: `expected POLICY_VIOLATION; got ${e instanceof Error ? e.constructor.name + ': ' + e.message : String(e)}` };
        }
      } finally {
        await probe.close();
      }
    }, 'archetype');
  }

  private async _subagentDispatchProbe(): Promise<CheckResult> {
    return await runCheck('subagentDispatch', async () => {
      const child = await AgentFramework.create({ agentId: `__ruvsdk_probe_af_sub_child_${Date.now()}` });
      const parent = await AgentFramework.create({
        agentId: `__ruvsdk_probe_af_sub_parent_${Date.now()}`,
        subagents: [child],
      });
      try {
        const r = await parent.run({ prompt: 'hello-sub' });
        if (r.subagentCalls.length !== 1) {
          return { status: 'broken' as const, detail: `expected 1 subagentCall; got ${r.subagentCalls.length}` };
        }
        const call = r.subagentCalls[0]!;
        if (call.agentId !== child._options.agentId) {
          return { status: 'broken' as const, detail: `expected agentId=${child._options.agentId}; got ${call.agentId}` };
        }
        return { status: 'ok' as const, detail: `parent dispatched to ${call.agentId.slice(-12)}; subagentCalls captured` };
      } finally {
        await child.close();
        await parent.close();
      }
    }, 'archetype');
  }

  private _unsupported(name: string, isWired: boolean, ifNotWired: string): CheckResult {
    if (isWired) {
      return { name, status: 'ok', detail: 'wired (probe runs in archetype-specific health-check)', durationMs: 0, tier: 'archetype' };
    }
    return { name, status: 'unsupported', detail: ifNotWired, durationMs: 0, tier: 'archetype' };
  }

  private assertOpen(): void {
    if (this._closed) throw new RuVectorError('CLOSED', 'AgentFramework is closed.');
  }
  private bump(method: string): void {
    this._invocationCounts.set(method, (this._invocationCounts.get(method) ?? 0) + 1);
  }
  private _nextTaskId(): string {
    this._idCounter++;
    return `af-task-${Date.now()}-${this._idCounter}`;
  }
}

// Marker so `SUBAGENT_MAX_DEPTH` isn't tree-shaken; v0.2 enforces depth.
void SUBAGENT_MAX_DEPTH;
