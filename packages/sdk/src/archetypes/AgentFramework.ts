/**
 * Build, run, and orchestrate AI agents with policy, A2A communication,
 * and tool dispatch.
 *
 * Promoted from "proposed" to first-class during M4 v0.1: rvAgent family is
 * 9 nested crates totaling 641 public items, with ADRs 100/104/105/107/108/
 * 112/113/159 explicitly chartering it.
 *
 * Distinct from AgentMemory: AgentMemory is the *substrate* (recall + learn);
 * AgentFramework is the *orchestration* (protocols, policies, tools, sub-agents).
 *
 * Default-active capabilities (per M4):
 *   - A2A (agent-to-agent) protocol                — rvagent-a2a    (ADR-159)
 *   - ACP (client ↔ agent) protocol                — rvagent-acp
 *   - MCP (agent ↔ tool) integration               — rvagent-mcp    (ADR-108)
 *   - Policy / cost control                        — rvagent-middleware
 *   - Backend integrations (LLM providers, tools)  — rvagent-backends
 *   - Sub-agent dispatch                           — rvagent-subagents
 */

import type { BackendSpec } from '../core/backend.js';
import type { ExplainTrace } from '../core/explain.js';
import type { Pipeline } from '../core/pipeline.js';
import type { ValueReport, ValueReportProvider } from '../core/value-report.js';
import { NotImplementedError } from '../core/index.js';

export interface AgentFrameworkOptions {
  readonly agentId: string;
  readonly backend?: BackendSpec;
  readonly capabilities?: AgentFrameworkCapabilityConfig;
  /** Default policy applied to every task. */
  readonly defaultPolicy?: TaskPolicy;
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
  readonly maxTokens?: number;
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

export class AgentFramework implements ValueReportProvider {
  static async create(_options: AgentFrameworkOptions): Promise<AgentFramework> {
    throw new NotImplementedError('AgentFramework.create');
  }

  /** Run a task to completion. */
  run(_task: AgentTask): Promise<TaskResult> {
    throw new NotImplementedError('AgentFramework.run');
  }

  /** Register a tool the agent can invoke. */
  registerTool(_tool: { name: string; description: string; handler: (args: unknown) => Promise<unknown> }): void {
    throw new NotImplementedError('AgentFramework.registerTool');
  }

  /** Discover A2A peers (when capabilities.a2a is on). */
  discoverPeers(): Promise<readonly PeerDescriptor[]> {
    throw new NotImplementedError('AgentFramework.discoverPeers');
  }

  /** Dispatch a task to a known peer (A2A). */
  dispatchToPeer(_peer: PeerDescriptor, _task: AgentTask): Promise<TaskResult> {
    throw new NotImplementedError('AgentFramework.dispatchToPeer');
  }

  getValueReport(): Promise<ValueReport> {
    throw new NotImplementedError('AgentFramework.getValueReport');
  }

  introspect(): Pipeline {
    throw new NotImplementedError('AgentFramework.introspect');
  }

  close(): Promise<void> {
    throw new NotImplementedError('AgentFramework.close');
  }
}
