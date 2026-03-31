/**
 * Kairos — Proactive Tick Loop
 *
 * Background loop that decides whether to act without waiting for user input.
 * Fires a "tick" at a configured interval. The agent decides whether to:
 *   - Act (Brief output — concise, non-blocking)
 *   - Stay quiet
 *
 * Blocking budget: if a proactive action would block the user for more than
 * maxBlockMs, it gets deferred instead.
 */
import { EventEmitter } from 'events';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
const DEFAULT_DECIDE_PROMPT = `You are a proactive assistant. Given the current context, decide whether to take a brief, non-blocking action right now, or stay quiet.

Respond with EXACTLY one of:

ACT: <brief one-sentence description of what you noticed and why you're acting>
<concise action or message, max 2-3 sentences>

QUIET: <one sentence reason why staying quiet is better right now>`;
export class Kairos extends EventEmitter {
    config;
    tickCount = 0;
    startTime = Date.now();
    deferred = [];
    intervalId = null;
    stopped = false;
    constructor(config) {
        super();
        this.config = {
            tickIntervalMs: config.tickIntervalMs ?? 60_000,
            maxBlockMs: config.maxBlockMs ?? 15_000,
            outputMode: config.outputMode ?? 'brief',
            deferralMaxAgeMs: config.deferralMaxAgeMs ?? 60 * 60 * 1000,
            llm: config.llm,
            decidePrompt: config.decidePrompt ?? DEFAULT_DECIDE_PROMPT,
            verbose: config.verbose ?? false,
        };
    }
    log(msg) {
        if (this.config.verbose) {
            console.log(`[kairos] ${msg}`);
        }
    }
    loadMemoryDigest() {
        const memPath = join(process.cwd(), 'memory', 'MEMORY.md');
        if (existsSync(memPath)) {
            const content = readFileSync(memPath, 'utf-8');
            const lines = content.split('\n');
            return lines.slice(-50).join('\n');
        }
        return '';
    }
    buildTickContext() {
        return {
            tickNumber: this.tickCount,
            elapsedMs: Date.now() - this.startTime,
            pendingDefers: this.deferred.length,
            memory: this.loadMemoryDigest(),
        };
    }
    pruneDeferred() {
        const now = Date.now();
        const before = this.deferred.length;
        this.deferred = this.deferred.filter((d) => d.deferUntil > now || now - d.createdAt >= this.config.deferralMaxAgeMs);
        if (before !== this.deferred.length) {
            this.log(`Pruned ${before - this.deferred.length} expired deferred actions`);
        }
    }
    buildDecidePrompt(ctx) {
        const deferCount = this.deferred.length;
        let prompt = this.config.decidePrompt;
        if (deferCount > 0) {
            prompt += `\n\nYou have ${deferCount} previously deferred action(s) waiting.`;
        }
        prompt += `\n\nCurrent time: ${new Date().toISOString()}`;
        prompt += `\nTick: #${ctx.tickNumber} (every ${this.config.tickIntervalMs / 1000}s)`;
        prompt += `\nOutput mode: ${this.config.outputMode}`;
        prompt += `\nMax blocking time before deferral: ${this.config.maxBlockMs / 1000}s`;
        if (ctx.memory) {
            prompt += `\n\n## Recent Memory\n\n${ctx.memory}`;
        }
        return prompt;
    }
    async decide(ctx) {
        const prompt = this.buildDecidePrompt(ctx);
        try {
            const response = await this.config.llm.complete({
                system: 'You are a thoughtful, non-intrusive proactive assistant. Prefer brevity. Prefer listening. Only speak when you have something genuinely useful to add.',
                messages: [{ role: 'user', content: prompt }],
                maxTokens: 512,
                temperature: 0.4,
            });
            const text = response.content.trim();
            if (text.startsWith('ACT:')) {
                const rest = text.slice(3).trim();
                const nlIndex = rest.indexOf('\n');
                const reason = nlIndex >= 0 ? rest.slice(0, nlIndex) : rest;
                const output = nlIndex >= 0 ? rest.slice(nlIndex + 1).trim() : rest;
                return { action: 'act', reason, output: output || reason };
            }
            else if (text.startsWith('QUIET:')) {
                const reason = text.slice(6).trim();
                return { action: 'quiet', reason };
            }
            else {
                this.log(`Ambiguous decide response: ${text.slice(0, 80)}`);
                return { action: 'quiet', reason: 'Ambiguous decide response' };
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.log(`Decide error: ${msg}`);
            return { action: 'quiet', reason: `LLM error: ${msg}` };
        }
    }
    async tick() {
        if (this.stopped)
            return;
        this.tickCount++;
        this.log(`Tick #${this.tickCount}`);
        this.pruneDeferred();
        const ctx = this.buildTickContext();
        this.emit('tick', ctx);
        // Check if any deferred actions are ready to fire
        const now = Date.now();
        const readyDeferred = this.deferred.find((d) => d.deferUntil <= now);
        if (readyDeferred) {
            this.deferred = this.deferred.filter((d) => d !== readyDeferred);
            this.log('Firing deferred action');
            this.emit('act', ctx, readyDeferred.output ?? '');
            return;
        }
        // Decide
        const decision = await this.decide(ctx);
        this.emit('decide', ctx, decision);
        if (decision.action === 'act') {
            // Rough estimate: >50 words is probably blocking
            const wordCount = (decision.output ?? '').split(/\s+/).filter(Boolean).length;
            const wouldBlock = wordCount > 50;
            if (wouldBlock && this.config.outputMode === 'brief') {
                const deferUntil = Date.now() + this.config.maxBlockMs;
                this.deferred.push({
                    action: 'act',
                    output: decision.output,
                    deferUntil,
                    createdAt: Date.now(),
                });
                this.log(`Action deferred until ${new Date(deferUntil).toISOString()}`);
                this.emit('defer', ctx, decision.reason);
            }
            else {
                this.emit('act', ctx, decision.output ?? decision.reason);
            }
        }
        else {
            this.emit('quiet', ctx, decision.reason);
        }
    }
    /** Start the tick loop. Call once at startup. */
    start() {
        if (this.intervalId !== null)
            return;
        this.stopped = false;
        this.log(`Starting, tick every ${this.config.tickIntervalMs}ms`);
        // Fire first tick immediately
        this.tick();
        this.intervalId = setInterval(() => {
            this.tick();
        }, this.config.tickIntervalMs);
    }
    /** Stop the tick loop. */
    stop() {
        this.stopped = true;
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.log('Stopped');
    }
    /** Manually trigger a tick outside the schedule. */
    async tickNow() {
        await this.tick();
    }
    /** Returns current tick count. */
    getTickCount() {
        return this.tickCount;
    }
}
//# sourceMappingURL=engine.js.map