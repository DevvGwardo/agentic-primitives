# Agentic Primitives

**General-purpose agentic patterns for building smarter, more autonomous AI systems.**

Framework-agnostic. Works with any LLM provider (Anthropic, OpenAI, Ollama, etc.). Each primitive can run standalone or composed with the others.

These are general architectural patterns — written from scratch, no proprietary code.

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Quick Start](#quick-start)
3. [Primitives](#primitives)
   - [Dream — Memory Consolidation](#dream--memory-consolidation)
   - [Kairos — Proactive Tick Loop](#kairos--proactive-tick-loop)
   - [Coordinator — Multi-Agent Orchestrator](#coordinator--multi-agent-orchestrator)
   - [Feature Gates — Runtime Flag System](#feature-gates--runtime-flag-system)
   - [Prompt Architecture — Modular Prompt Composer](#prompt-architecture--modular-prompt-composer)
4. [LLM Adapter Layer](#llm-adapter-layer)
5. [Subagent Integration](#subagent-integration)
6. [Architecture Decisions](#architecture-decisions)

---

## Philosophy

Most agent systems start from scratch every session. They forget what they learned last week. They wait passively for a user to ask something. They run one agent and hope for the best.

Agentic Primitives is a collection of patterns that fix this:

| Problem | Primitive |
|---|---|
| Memory degrades across sessions | `dream` — periodic consolidation |
| Agent is purely reactive | `kairos` — proactive tick loop |
| One agent can't scale to large tasks | `coordinator` — multi-agent orchestration |
| No way to toggle features safely | `feature-gates` — runtime flags |
| System prompt is a wall of text | `prompt-architecture` — modular sections |

Each primitive is small, focused, and composable. Use one, use all of them — the choice is yours.

---

## Quick Start

```typescript
import {
  DreamEngine,
  Kairos,
  CoordinatorEngine,
  createGateStore,
  createPromptComposer,
  AnthropicAdapter,
} from 'agentic-primitives';

// Any LLM adapter
const llm = new AnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Dream ────────────────────────────────────────────────────────────────────
const dream = new DreamEngine({
  memoryDir: './memory',
  sessionThreshold: 5,
  timeThresholdHours: 24,
  llm,
});

// Call after sessions accumulate
await dream.maybeDream();

// ─── Kairos ───────────────────────────────────────────────────────────────────
const kairos = new Kairos({
  tickIntervalMs: 60_000,
  maxBlockMs: 15_000,
  llm,
});

kairos.on('act', (ctx, output) => {
  console.log(`[kairos:act] tick #${ctx.tickNumber}: ${output}`);
});

kairos.start(); // runs in background

// ─── Coordinator ──────────────────────────────────────────────────────────────
const coord = new CoordinatorEngine({
  llm,
  scratchDir: './scratch',
  maxWorkers: 4,
  verbose: true,
});

const result = await coord.run(
  'Refactor the authentication module to support OAuth',
  '/path/to/project',
);

// ─── Feature Gates ────────────────────────────────────────────────────────────
const gates = createGateStore();

gates.register({
  key: 'my_feature.enabled',
  defaultValue: false,
  envVar: 'MY_FEATURE_ENABLED',
  staleMaxAgeMs: 60_000,
});

if (gates.is('my_feature.enabled')) {
  // feature code here
}

// ─── Prompt Architecture ───────────────────────────────────────────────────────
const composer = createPromptComposer();

composer.update('context', `## User Context\n\nName: Torre\nTimezone: EDT\nProject: OpenClaw Evo`);

const fullPrompt = composer.compose();
// → [static:core_identity] + [static:capabilities] + [static:safety]
// → ─── DYNAMIC ───
// → [dynamic:context] + [dynamic:session] + user message
```

---

## Primitives

---

### `dream` — Memory Consolidation

**Problem it solves:** Your agent accumulates session logs every day, but the memory gets messy. Old facts contradict new ones. Key decisions get lost. Future sessions have to re-learn context that should have been persistent.

**Solution:** A forked background subagent that periodically reviews recent session logs and distills them into durable long-term memory. Think of it as an AI that dreams about what it learned — then wakes up with clearer, cleaner memories.

#### How it works

Dream runs as a forked subprocess with read-only workspace access. It has one job: improve memory. It cannot modify the workspace.

**Three-Gate Trigger** — Dream only fires when all three gates are open:

| Gate | Default | Purpose |
|---|---|---|
| **Time gate** | 24 hours | Prevents dreaming too frequently |
| **Session gate** | 5 sessions | Prevents dreaming before enough context accumulates |
| **Lock gate** | `.dream.lock` | Prevents concurrent dream runs |

All three must pass. This prevents both over-dreaming (wasting API calls) and under-dreaming (memory stays stale).

**Four Phases:**

1. **Orient** — List the memory directory, read `MEMORY.md`, skim topic files. Understand what already exists.
2. **Gather Signal** — Scan recent daily logs for new facts, decisions, open questions, resolved errors. Prioritize: today's logs → drifted memories → full transcript.
3. **Consolidate** — Write or update memory files. Convert relative dates to absolute. Resolve contradictions in favor of newer information.
4. **Prune** — Enforce size limits (200 lines, ~25KB for `MEMORY.md`). Archive files older than 90 days. Remove stale pointers.

**State tracking:**

```typescript
// Tracks across sessions — stored in memory/dream-state.json
interface DreamState {
  lastDreamMs: number | null;
  sessionCount: number;       // resets after each dream
  totalDreams: number;
  lastSessionDate: string;
}
```

**File Write Directives:**

The LLM outputs file changes using a simple directive format:

````
FILE: projects/openclaw.md
```markdown
# OpenClaw

## Overview
Active self-evolution system for OpenClaw.

## Active Components
- Hub API: localhost:5174
- Gateway: localhost:18789
```
````

Dream parses these and writes files. In `dryRun: true` mode, it logs what it would write without doing it.

**Integration with subagents:**

```typescript
// In your main agent session:
const dream = new DreamEngine({ memoryDir: './memory', llm });

// After each user session ends:
dream.bumpSession(); // increments session counter

// On a cron or periodic check:
const result = await dream.maybeDream();
if (result.ran) {
  console.log(`Dream complete: ${result.phasesRun.join(', ')}`);
  console.log(`Signals found: ${result.signalsFound}`);
  console.log(`Files modified: ${result.filesModified?.join(', ')}`);
}
```

**For Hermes:** Point `memoryDir` at `~/.openclaw/evo-memory/`. Dream would consolidate the daily logs from the 20 subagent sessions into clean `MEMORY.md` updates. The cron job at `56552da2-3c15-42f0-adf4-3e199f2494c8` could trigger it.

---

### `kairos` — Proactive Tick Loop

**Problem it solves:** Your agent sits idle until the user speaks. But sometimes the user needs a nudge — a reminder, a status check, an observation — without having to ask.

**Solution:** A background tick loop that fires at a configured interval (default: every 60 seconds). On each tick, the agent decides: should I act, or should I stay quiet?

#### How it works

**Tick loop:**

```
every tickIntervalMs:
  1. Prune expired deferred actions
  2. Check if any deferred actions are ready → fire them
  3. Run decide() through the LLM
  4. If ACT → emit 'act' event, else emit 'quiet' event
```

**Decide prompt format:**

The LLM receives context and responds with one of:

```
ACT: <one-sentence reason>
<concise action, max 2-3 sentences>

QUIET: <one-sentence reason why staying quiet is better>
```

**Blocking budget:**

If Kairos decides to act but the output would be long (rough heuristic: >50 words), and `outputMode === 'brief'`, the action gets **deferred** instead of fired immediately. It goes into a queue and fires on the next tick when the blocking budget resets.

This prevents Kairos from hijacking the user's terminal with a wall of text.

**Deferred action queue:**

```typescript
interface DeferredAction {
  action: 'act';
  output?: string;
  deferUntil: number;    // ms timestamp
  createdAt: number;
}
```

Deferred actions expire after `deferralMaxAgeMs` (default: 1 hour) and are pruned on each tick.

**Event API:**

```typescript
const kairos = new Kairos({ tickIntervalMs: 30_000, llm });

kairos.on('tick', (ctx) => {
  console.log(`Tick #${ctx.tickNumber}`);
});

kairos.on('act', (ctx, output) => {
  // Kairos decided to act — deliver the message
  sendMessageToUser(output);
});

kairos.on('quiet', (ctx, reason) => {
  // Kairos chose to stay silent — nothing to do
  console.log(`Quiet: ${reason}`);
});

kairos.on('defer', (ctx, reason) => {
  // Action was too blocking — deferred
  console.log(`Deferred: ${reason}`);
});

kairos.start(); // background
```

**Brief mode:**

Kairos is designed for non-intrusive, ambient awareness. Its default output mode is `brief` — short, factual, and respectful of the user's attention. Full verbose output is available via `outputMode: 'full'`.

**Tick context passed to decide:**

```typescript
interface KairosTickContext {
  tickNumber: number;       // increments each tick
  elapsedMs: number;        // ms since Kairos started
  pendingDefers: number;    // deferred actions in queue
  memory?: string;          // last 50 lines of MEMORY.md
}
```

**For Hermes:** Run Kairos alongside Hermes in a separate process. On `act`, deliver a brief message to the Discord channel. On `quiet`, do nothing. The blocking budget (15s default) prevents Kairos from running long operations that would interrupt the user's workflow.

---

### `coordinator` — Multi-Agent Orchestrator

**Problem it solves:** A single agent trying to handle a large, complex task — a full codebase refactor, a multi-component feature — ends up either missing things or taking forever.

**Solution:** A coordinator agent that orchestrates multiple parallel worker agents through a structured four-phase workflow: Research → Synthesis → Implementation → Verification.

#### How it works

**Four phases:**

```
┌─────────────────────────────────────────────────────────┐
│  Phase 1: RESEARCH (coordinator + parallel workers)     │
│                                                         │
│  Coordinator breaks the problem into N investigation    │
│  tasks. Workers run in parallel, each covering a        │
│  different area. Results go to the scratchpad.          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 2: SYNTHESIS (coordinator only)                  │
│                                                         │
│  Coordinator reads all worker findings from the         │
│  scratchpad. Writes a precise SPEC to scratchpad.       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 3: IMPLEMENTATION (coordinator + parallel workers│
│                                                         │
│  Coordinator assigns spec items to workers. Each        │
│  worker makes targeted changes to specific files.       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 4: VERIFICATION (coordinator + parallel workers)│
│                                                         │
│  Workers check each change against the spec. Coordinator │
│  writes a final verification report. Status: READY     │
│  or NEEDS_WORK.                                         │
└─────────────────────────────────────────────────────────┘
```

**Scratchpad directory:**

All agents communicate through a shared scratchpad directory (`./scratch/`). Workers write findings files:

```
scratch/
├── worker-research-1.md
├── worker-research-2.md
├── worker-research-3.md
├── coordinator-research.md      ← coordinator's synthesis of phase 1
├── coordinator-spec.md          ← the spec (phase 2 output)
├── worker-impl-1.md
├── worker-impl-2.md
├── coordinator-implementation.md
├── worker-verify-1.md
├── coordinator-verification.md  ← final status
```

**Parallelism:**

The key insight is that phases 1, 3, and 4 all run workers in parallel. The coordinator itself never does the hands-on work — it only assigns and synthesizes. This is explicit in the coordinator prompt: *"Do NOT say 'based on your findings' — read the actual findings and specify exactly what to do."*

**Worker runner:**

The `workerRunner` config option is the integration point for real agent systems:

```typescript
const coord = new CoordinatorEngine({
  llm,
  scratchDir: './scratch',
  maxWorkers: 4,

  // Plug in Claude Code as the worker runner:
  workerRunner: async (task, ctx) => {
    const result = await spawnClaudeCode({
      task: task.instruction,
      workspace: task.workspace,
      outputDir: ctx.scratchDir,
    });
    return result.summary;
  },
});
```

Without a custom `workerRunner`, the coordinator falls back to a simple LLM completion. This works for lightweight tasks but won't actually edit files or run commands — that's why the integration point exists.

**Result:**

```typescript
interface CoordinatorRunResult {
  phases: CoordinatorResult[];  // one per phase
  spec?: string;                // the written spec
  finalStatus: 'ready' | 'needs_work';
  scratchDir: string;
}

interface CoordinatorResult {
  phase: 'research' | 'synthesis' | 'implementation' | 'verification';
  status: 'ok' | 'error' | 'blocked';
  coordinatorOutput: string;
  workerOutputs?: Record<string, string>;  // worker-id → output
  error?: string;
}
```

**For Hermes:** The OpenClaw Evo project has 20 subagents building the system. Instead of running them ad-hoc, a Coordinator would give them structure: which agents are researching, which are implementing, what's the shared spec. Results flow back through the scratchpad and Hermes reads them at the end.

---

### `feature-gates` — Runtime Flag System

**Problem it solves:** You want to ship a feature but only to some users. Or you want to test a feature safely before rolling it out fully. Or you need to maintain an internal build with extra features alongside an external build.

**Solution:** A namespace-based flag system with four precedence levels and stale-OK semantics for non-critical gates.

#### How it works

**Value precedence (highest to lowest):**

```
1. Runtime override  (programmatic: store.set(key, value))
2. Env var           (process.env[spec.envVar])
3. Config file       (~/.config/agentic-primitives/gates.json)
4. Default value     (spec.defaultValue)
```

**Stale-OK semantics:**

Most feature gates don't need to be real-time. If the gate value is cached and the cache is younger than `staleMaxAgeMs`, the cached value is returned without any I/O. This prevents gate checks from adding latency to hot paths.

```typescript
const result = gates.get('kairos.brief_mode');
// result.stale === true if cache exceeded staleMaxAgeMs

// Shortcut for booleans:
if (gates.is('kairos.brief_mode')) { ... }
```

**Registering gates:**

```typescript
// One at a time
store.register({
  key: 'my_feature.enabled',
  defaultValue: false,
  envVar: 'MY_FEATURE_ENABLED',
  staleMaxAgeMs: 60_000,
});

// Or all at once
store.registerAll([
  { key: 'foo.enabled', defaultValue: true },
  { key: 'bar.rate_limit', defaultValue: 100 },
]);
```

**Built-in gates:**

| Key | Default | Env var |
|---|---|---|
| `dream.enabled` | `true` | `DREAM_ENABLED` |
| `dream.auto_trigger` | `true` | `DREAM_AUTO_TRIGGER` |
| `kairos.enabled` | `false` | `KAIROS_ENABLED` |
| `kairos.brief_mode` | `true` | `KAIROS_BRIEF_MODE` |
| `coordinator.enabled` | `true` | `COORDINATOR_ENABLED` |
| `coordinator.max_workers` | `4` | `COORDINATOR_MAX_WORKERS` |
| `prompt.modular_sections` | `false` | `PROMPT_MODULAR` |
| `safety.dry_run` | `false` | `DRY_RUN` |

**Quick setup:**

```typescript
import { createGateStore } from 'agentic-primitives';

const gates = createGateStore(); // pre-registers all built-in gates
```

**Config file:**

Values can be persisted to `~/.config/agentic-primitives/gates.json`:

```json
{
  "my_feature.enabled": true,
  "kairos.brief_mode": false
}
```

**For Hermes:** Gates are useful for the OpenClaw Evo cron job — toggle Dream on/off, adjust session thresholds, switch between dry-run and live mode. Also useful for gradual rollouts of new subagent behaviors.

---

### `prompt-architecture` — Modular Prompt Composer

**Problem it solves:** Your system prompt is a single giant string. Every LLM call sends the whole thing, even though most of it never changes. This wastes tokens and increases latency.

**Solution:** Split the system prompt into **static** sections (cacheable, sent once) and **dynamic** sections (session-specific, sent every call). A boundary marker tells you where the cacheable part ends.

#### How it works

**The boundary marker:**

```
─── DYNAMIC ───
```

Everything before this marker is static. Everything after is dynamic.

**Example composition:**

```typescript
composer.register({
  id: 'core_identity',
  label: 'Who you are',
  cacheable: true,    // ← goes before the boundary
  priority: 10,
  content: 'You are a helpful, precise AI assistant.',
});

composer.register({
  id: 'context',
  label: 'User context',
  cacheable: false,   // ← goes after the boundary
  priority: 40,
  content: '## User Context\n\nName: Torre',
});

const prompt = composer.compose();
// "[static:core_identity content]\n\n─── DYNAMIC ───\n\n[dynamic:context content]"
```

**Three rendering modes:**

```typescript
composer.compose();           // full prompt: static + boundary + dynamic + extras
composer.composeStatic();      // only the cacheable static portion
composer.composeDynamic();     // only the dynamic portion + optional extras
```

**Cache strategy:**

```
Session start:
  static_prompt = composer.composeStatic()
  → Send to LLM once, cache the response ID (provider-side or your own cache)

Each user message:
  dynamic_prompt = composer.composeDynamic(userMessage)
  → Send cached static prompt ID + dynamic prompt → fewer tokens
```

**Updating sections:**

```typescript
// At session start — update user-specific sections
composer.update('context', `## User Context\n\nName: ${user.name}\nProject: ${user.project}`);

// At each user message — update session state
composer.update('session', `## Session\n\nMessages so far: ${messageCount}`);
```

**Default sections:**

```typescript
[
  { id: 'core_identity',   priority: 10, cacheable: true  },  // "You are a helpful..."
  { id: 'capabilities',    priority: 20, cacheable: true  },  // "You have access to tools..."
  { id: 'safety',          priority: 30, cacheable: true  },  // "Do not perform destructive..."
  { id: 'context',         priority: 40, cacheable: false },  // user-specific
  { id: 'session',         priority: 50, cacheable: false },  // session-specific
]
```

**For Hermes:** Hermes's `SOUL.md` + `AGENTS.md` are currently monolithic. Splitting them into static/dynamic sections and composing at call time would reduce token overhead significantly, especially for the frequent cron sessions.

---

## LLM Adapter Layer

The entire library is provider-agnostic through a single interface:

```typescript
interface LLMClient {
  complete(opts: LLMCompletionOptions): Promise<LLMResponse>;
}
```

**Included adapters:**

```typescript
import { AnthropicAdapter, OpenAIAdapter } from 'agentic-primitives';

const anthropic = new AnthropicAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultModel: 'claude-3-5-haiku-20241022',
});

const openai = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  defaultModel: 'gpt-4o-mini',
});
```

**Custom adapter example:**

```typescript
import type { LLMClient, LLMCompletionOptions } from 'agentic-primitives';

class OllamaAdapter implements LLMClient {
  constructor(private baseUrl = 'http://localhost:11434') {}

  async complete(opts: LLMCompletionOptions): Promise<{ content: string }> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: opts.model ?? 'llama3',
        prompt: opts.messages.map(m => `${m.role}: ${m.content}`).join('\n'),
        system: opts.system,
        options: { temperature: opts.temperature },
      }),
    });
    const json = await res.json() as { response: string };
    return { content: json.response };
  }
}
```

---

## Subagent Integration

Each primitive is designed to be driven by a subagent. The recommended pattern:

### Dream as a subagent

```typescript
// Main session — decide when to trigger dream
const dream = new DreamEngine({ memoryDir, llm });
dream.bumpSession(); // call after each user session

// Cron job — run dream if gates are open
if (gates.is('dream.enabled')) {
  const result = await dream.maybeDream();
  if (result.ran) {
    await notifyUser(`Dream completed: ${result.phasesRun.join(', ')}`);
  }
}
```

### Kairos as a standalone process

```typescript
// Run Kairos in its own process (or as a cron subagent)
const kairos = new Kairos({ tickIntervalMs: 30_000, llm });

kairos.on('act', async (ctx, output) => {
  await deliverToUser(output); // Discord message, email, notification, etc.
});

kairos.start();

// Keep alive — add error handler
kairos.on('error', (err) => {
  console.error('[kairos:error]', err);
  kairos.stop();
});
```

### Coordinator with Claude Code workers

```typescript
// Integrate Claude Code as the worker runner
import { spawn } from 'child_process';

const coord = new CoordinatorEngine({
  llm: new AnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }),
  scratchDir: './scratch',
  maxWorkers: 3,

  workerRunner: async (task, ctx) => {
    return new Promise((resolve, reject) => {
      const proc = spawn('claude', [
        '--dangerously-skip-permissions',
        `-p "${task.instruction}"`,
      ], {
        cwd: task.workspace ?? process.cwd(),
        env: { ...process.env, ANTHROPIC_API_KEY },
      });

      let output = '';
      proc.stdout.on('data', (d) => { output += d.toString(); });
      proc.stderr.on('data', (d) => { console.error('[worker]', d.toString()); });
      proc.on('close', (code) => {
        if (code === 0) resolve(output);
        else reject(new Error(`Worker exited ${code}`));
      });
    });
  },
});

const result = await coord.run('Analyze the auth module for security issues', '/repo');
```

---

## Architecture Decisions

### Why no framework?

Every agent framework (LangChain, LlamaIndex, CrewAI, etc.) makes opinions about how agents should work. These primitives make no such assumptions. They give you the patterns and let you integrate them wherever you want. If your framework of choice has an LLM adapter, it can use any of these primitives.

### Why TypeScript?

TypeScript provides the type safety needed for a library that will be integrated into other projects. The `LLMClient` interface is the only external contract — everything else is internal. The library works in plain JavaScript too, since TypeScript compiles to it.

### Why modular files?

Each primitive is self-contained. If you only want `feature-gates`, you only import `feature-gates`. No dependency graph to worry about.

### Why fork-based for Dream?

Dream runs as a conceptually separate agent process with read-only workspace access. This is intentional — the consolidation task should not be able to touch production code. In practice, this could be implemented as a separate container, a separate Node.js process, or a separate agent session via your framework's API.

### Why 3 gates for Dream?

Three gates prevents false positives from any single gate. Time-only gating would dream on first run. Session-only gating would dream on every session. Lock-only gating would not prevent frequent dreaming. All three together: you need enough context (sessions), enough elapsed time, and no concurrent run. This mirrors real memory consolidation biology — sleep (time) + waking experiences (sessions) + no interruption (lock).

### Why brief mode for Kairos?

An agent that speaks too much becomes noise. Kairos defaults to brief because proactive assistance should be additive, not dominant. The user should feel supported, not managed. Full verbose mode is available but not the default.

### Why coordinator, not just more agents?

Adding more agents without coordination leads to chaos — overlapping work, conflicting changes, no synthesis. The coordinator pattern adds structure without adding complexity to the main agent. The coordinator is the same agent class as the workers; the distinction is only in the prompt and role.

---

## File Structure

```
agentic-primitives/
├── README.md
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                    # Public barrel export
    ├── llm.ts                      # LLMClient interface + Anthropic/OpenAI adapters
    │
    ├── dream/
    │   ├── index.ts                # Public exports
    │   ├── engine.ts               # DreamEngine — main orchestrator
    │   ├── state.ts                # DreamStateTracker — persists across sessions
    │   ├── lockfile.ts             # createLockfile — prevents concurrent dreams
    │   └── prompts.ts              # Phase prompts (orient, gather, consolidate, prune)
    │
    ├── kairos/
    │   ├── index.ts                # Public exports
    │   └── engine.ts               # Kairos — tick loop, decide, defer queue, events
    │
    ├── coordinator/
    │   ├── index.ts                # Public exports
    │   ├── engine.ts               # CoordinatorEngine — four-phase orchestrator
    │   └── prompts.ts             # Coordinator + worker prompts per phase
    │
    ├── feature-gates/
    │   └── index.ts               # GateStore, BUILTIN_GATES, createGateStore
    │
    └── prompt-architecture/
        └── index.ts               # PromptComposer, DEFAULT_SECTIONS, createPromptComposer
```
