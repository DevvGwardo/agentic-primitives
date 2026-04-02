# Agentic Primitives

<p align="center">
  <a href="https://www.npmjs.com/package/agentic-primitives"><img src="https://img.shields.io/npm/v/agentic-primitives" alt="npm version" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.3-blue.svg" alt="TypeScript" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node.js >=18" /></a>
</p>

<p align="center"><strong>Composable architectural patterns for building autonomous AI agents.</strong></p>

<p align="center">Five focused primitives: memory consolidation, proactive tick loops, multi-agent coordination, runtime feature gates, and modular prompt composition. Framework-agnostic. Works with any LLM provider. Use one or use all.</p>

<p align="center">

```bash
npm install agentic-primitives
```

</p>

---

## Primitives

| Primitive | What it does |
|---|---|
| `dream` | Periodic memory consolidation — distills session logs into durable long-term facts |
| `kairos` | Proactive tick loop — fires on an interval, decides whether to act or stay quiet |
| `coordinator` | Multi-agent orchestrator — parallel workers through a four-phase Research → Spec → Implement → Verify workflow |
| `feature-gates` | Runtime flag system — namespace-based gates with env var, config, and programmatic precedence |
| `prompt-architecture` | Modular prompt composer — static/dynamic sections with boundary marker for cache strategy |

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

const llm = new AnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Dream — consolidate memory after sessions accumulate ───
const dream = new DreamEngine({
  memoryDir: './memory',
  sessionThreshold: 5,
  timeThresholdHours: 24,
  llm,
});
await dream.maybeDream();

// ─── Kairos — proactive nudges at interval ───
const kairos = new Kairos({ tickIntervalMs: 60_000, maxBlockMs: 15_000, llm });
kairos.on('act', (ctx, output) => sendToUser(output));
kairos.start();

// ─── Coordinator — parallel workers with a shared spec ───
const coord = new CoordinatorEngine({ llm, scratchDir: './scratch', maxWorkers: 4 });
const result = await coord.run('Refactor the auth module to support OAuth', '/path/to/project');

// ─── Feature Gates ───
const gates = createGateStore();
if (gates.is('my_feature.enabled')) { /* ... */ }

// ─── Prompt Architecture — static/dynamic composition ───
const composer = createPromptComposer();
composer.update('context', `## User Context\n\nName: Torre\nProject: OpenClaw Evo`);
const prompt = composer.compose(); // static + "─── DYNAMIC ───" + dynamic
```

---

## Integrations

### Hermes

[Hermes](https://github.com/DevvGwardo/claude-code) is a multi-platform AI assistant built on Claude Code. Agentic primitives slot in as cron-driven subagents.

**Dream — memory consolidation via cron:**

```typescript
// ~/.hermes/cron/dream_service.js
import { DreamEngine, AnthropicAdapter } from 'agentic-primitives';
import { readFileSync } from 'fs';

const env = JSON.parse(readFileSync('/path/to/.env', 'utf8'));
const llm = new AnthropicAdapter({ apiKey: env.ANTHROPIC_API_KEY });

const dream = new DreamEngine({
  memoryDir: process.env.HERMES_HOME + '/evo-memory',
  sessionThreshold: 5,
  timeThresholdHours: 24,
  llm,
});

const result = await dream.maybeDream();
console.log(JSON.stringify(result));
```

Schedule it:

```
/cron add "Dream consolidation" --every 4h --skill dream_service
```

**Kairos — ambient awareness alongside Hermes:**

```typescript
// Run Kairos as a separate background process alongside Hermes
const kairos = new Kairos({ tickIntervalMs: 30_000, llm });
kairos.on('act', async (ctx, output) => {
  // Deliver proactive nudge to the user's Discord channel
  await sendDiscordMessage(process.env.HOME_DISCORD_CHANNEL_ID, output);
});
kairos.start();
```

**Feature Gates — control evolution behaviors:**

```typescript
const gates = createGateStore(); // pre-registers built-in gates

if (gates.is('dream.enabled')) {
  // allow dream to trigger
}
if (gates.is('coordinator.enabled')) {
  // allow coordinator workers to run
}
```

---

### OpenClaw Evo

[OpenClaw Evo](https://github.com/DevvGwardo/openclaw-evo) is a self-evolution system for Hermes. It manages 20 subagents that build and improve the codebase over time. Agentic primitives are the substrate for that automation.

**Dream — consolidate Evo's 20 subagent sessions:**

```typescript
import { DreamEngine, AnthropicAdapter } from 'agentic-primitives';
import path from 'path';

const dream = new DreamEngine({
  memoryDir: '~/.openclaw/evo-memory',  // Evo's shared memory directory
  sessionThreshold: 5,
  timeThresholdHours: 24,
  llm,
});

// Called after Evo subagent sessions accumulate
const result = await dream.maybeDream();
if (result.ran) {
  console.log(`Dream phases: ${result.phasesRun.join(', ')}`);
  console.log(`Signals found: ${result.signalsFound}`);
  console.log(`Files modified: ${result.filesModified?.join(', ')}`);
}
```

**Coordinator — structure Evo's parallel subagent work:**

```typescript
const coord = new CoordinatorEngine({
  llm,
  scratchDir: '~/.openclaw/evo-scratch',  // shared scratchpad
  maxWorkers: 4,
});

// Evo runs 20 subagents — Coordinator gives them structure
const result = await coord.run(
  'Implement streaming support in the gateway API',
  '~/.openclaw/openclaw-evo',
);
```

**Feature Gates — toggle Evo evolution behaviors:**

```typescript
const gates = createGateStore();

gates.register({
  key: 'evo.dream_enabled',
  defaultValue: true,
  envVar: 'EVO_DREAM_ENABLED',
  staleMaxAgeMs: 60_000,
});

gates.register({
  key: 'evo.max_workers',
  defaultValue: 4,
  envVar: 'EVO_MAX_WORKERS',
  staleMaxAgeMs: 0, // always fresh
});
```

**Kairos — proactive status updates:**

```typescript
const kairos = new Kairos({
  tickIntervalMs: 60_000,
  maxBlockMs: 15_000,
  llm,
});

kairos.on('act', async (ctx, output) => {
  // Send evolution pulse status to Discord
  await sendDiscordMessage(process.env.HOME_DISCORD_CHANNEL_ID, `[Evo Pulse] ${output}`);
});
kairos.start();
```

---

### MiniMax

MiniMax does not have an official Node.js SDK. Integrate via the HTTP API directly.

**Custom LLM Adapter for MiniMax:**

```typescript
import type { LLMClient, LLMCompletionOptions } from 'agentic-primitives';

class MiniMaxAdapter implements LLMClient {
  constructor(
    private apiKey: string,
    private baseUrl = 'https://api.minimax.chat/v1',
    private model = 'MiniMax-M2.7',
  ) {}

  async complete(opts: LLMCompletionOptions): Promise<{ content: string }> {
    const res = await fetch(`${this.baseUrl}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: opts.messages,
        temperature: opts.temperature,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`MiniMax API error ${res.status}: ${err}`);
    }

    const json = await res.json() as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? '';
    return { content };
  }
}
```

**Use it with any primitive:**

```typescript
import { DreamEngine, Kairos } from 'agentic-primitives';

const llm = new MiniMaxAdapter(process.env.MINIMAX_API_KEY);

const dream = new DreamEngine({ memoryDir: './memory', sessionThreshold: 5, timeThresholdHours: 24, llm });
const kairos = new Kairos({ tickIntervalMs: 60_000, llm });
```

---

## LLM Adapter Layer

The `LLMClient` interface is the only external contract:

```typescript
interface LLMClient {
  complete(opts: LLMCompletionOptions): Promise<{ content: string }>;
}
```

Built-in adapters:

```typescript
import { AnthropicAdapter, OpenAIAdapter } from 'agentic-primitives';

const anthropic = new AnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY });
```

For Ollama, LM Studio, or other local providers — implement the interface as shown in the MiniMax example above.

---

## API Reference

### DreamEngine

```typescript
new DreamEngine({
  memoryDir: string;           // directory for memory files
  sessionThreshold?: number;   // sessions before dreaming (default: 5)
  timeThresholdHours?: number; // hours between dreams (default: 24)
  llm: LLMClient;
})

dream.bumpSession()             // call after each user session
dream.maybeDream()              // returns { ran: boolean; phasesRun: string[]; ... }
```

### Kairos

```typescript
new Kairos({
  tickIntervalMs?: number;     // interval between ticks (default: 60_000)
  maxBlockMs?: number;          // blocking budget (default: 15_000)
  outputMode?: 'brief' | 'full';
  llm: LLMClient;
})

kairos.start()
kairos.stop()
kairos.on('act' | 'quiet' | 'tick' | 'defer' | 'error', handler)
```

### CoordinatorEngine

```typescript
new CoordinatorEngine({
  llm: LLMClient;
  scratchDir: string;          // shared scratchpad directory
  maxWorkers?: number;         // parallel workers (default: 4)
  workerRunner?: WorkerRunner; // optional custom worker runner
})

coordinator.run(task: string, workspace?: string): Promise<CoordinatorRunResult>
```

### Feature Gates

```typescript
createGateStore()               // pre-registers all built-in gates
store.register(gateSpec)
store.is(key: string): boolean  // shortcut for boolean gates
store.get(key: string): { value: unknown; stale: boolean }
```

### Prompt Composer

```typescript
createPromptComposer()
composer.register(section)
composer.update(id, content)
composer.compose()           // full: static + boundary + dynamic
composer.composeStatic()     // cacheable portion only
composer.composeDynamic()    // dynamic + optional extras
```

---

## File Structure

```
agentic-primitives/
├── src/
│   ├── index.ts
│   ├── llm.ts                      # LLMClient + adapters
│   ├── dream/
│   │   ├── engine.ts              # DreamEngine
│   │   ├── state.ts               # DreamStateTracker
│   │   ├── lockfile.ts            # concurrent-run prevention
│   │   └── prompts.ts             # phase prompts
│   ├── kairos/
│   │   └── engine.ts              # tick loop, decide, defer queue
│   ├── coordinator/
│   │   ├── engine.ts              # four-phase orchestrator
│   │   └── prompts.ts             # coordinator + worker prompts
│   ├── feature-gates/
│   │   └── index.ts               # GateStore
│   └── prompt-architecture/
│       └── index.ts               # PromptComposer
├── package.json
└── tsconfig.json
```

---

## License

MIT
