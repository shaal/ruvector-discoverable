# Archetype: AgentFramework

*Auto-generated from `tools/archetypes/assignments.mjs` and `catalog/catalog.json`.*

**Proposed in M4 v0.1** — evidence-driven addition. See PRD §6.9 for the archetype-evolution rule that allows this.

**Workload.** Build, run, and orchestrate AI agents with policy, A2A communication, and tool dispatch.

**Why this archetype.** rvAgent family is 10 nested crates totaling ~620 public items, with explicit ADRs (ADR-159 A2A protocol, ADR-104/105/107 framework structure, ADR-100 RVF integration). It is a distinct workload from AgentMemory: AgentMemory is the *substrate*, AgentFramework is the *orchestration layer* (protocols, policies, tools, sub-agents).

Headline: ✅ exposed at SDK top-level.

## Members (9)

| Conf | Crate | Items | Flags | ADRs |
|---|---|--:|---|---|
| 🟢 | `rvagent-core` | 118 |  | ADR-104, ADR-105, ADR-107, ADR-159 |
| 🟢 | `rvagent-a2a` | 115 | cfg=3 | ADR-159 |
| 🟢 | `rvagent-middleware` | 96 |  | ADR-159 |
| 🟢 | `rvagent-mcp` | 92 |  | ADR-104, ADR-105, ADR-108, ADR-112, +1 |
| 🟢 | `rvagent-backends` | 88 |  | ADR-107 |
| 🟢 | `rvagent-tools` | 63 | cfg=5 | ADR-104, ADR-105 |
| 🟢 | `rvagent-subagents` | 44 |  | ADR-159 |
| 🟢 | `rvagent-acp` | 25 |  | ADR-159 |
| 🟢 | `rvagent-cli` | 0 |  | ADR-159 |

### Rationale per crate

- **`rvagent-core`** — Core agent runtime. 118 items, ADR-104/105/107.
  - ADR evidence: ADR-104, ADR-105, ADR-107, ADR-159
- **`rvagent-a2a`** — Agent-to-agent protocol per ADR-159 (the bug-finding ADR from M3).
  - ADR evidence: ADR-159
- **`rvagent-middleware`** — Middleware stack.
  - ADR evidence: ADR-159
- **`rvagent-mcp`** — MCP integration (agent ↔ tool).
  - ADR evidence: ADR-104, ADR-105, ADR-108, ADR-112
- **`rvagent-backends`** — Backend integrations (LLM providers, tools).
  - ADR evidence: ADR-107
- **`rvagent-tools`** — Built-in tool library.
  - ADR evidence: ADR-104, ADR-105
- **`rvagent-subagents`** — Sub-agent dispatch.
  - ADR evidence: ADR-104
- **`rvagent-acp`** — Agent Communication Protocol (client ↔ agent).
  - ADR evidence: ADR-104
- **`rvagent-cli`** — Agent CLI.

### Archetype-level citation evidence
- ADRs: ADR-100, ADR-104, ADR-105, ADR-107, ADR-108, ADR-112, ADR-113, ADR-159
- Biggest crates: `rvagent-core`, `rvagent-a2a`, `rvagent-mcp`, `rvagent-middleware`, `rvagent-backends`
