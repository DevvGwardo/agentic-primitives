/**
 * DreamEngine — Memory Consolidation Subagent
 *
 * Background subagent that periodically reviews recent session logs and
 * distills them into durable long-term memory.
 *
 * Trigger: all three gates must pass:
 *   1. Time gate: >= timeThresholdHours since last dream
 *   2. Session gate: >= sessionThreshold sessions since last dream
 *   3. Lock gate: no other dream process is currently running
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createLockfile } from './lockfile.js';
import { DreamStateTracker } from './state.js';
import { DREAM_SYSTEM_PROMPT, DREAM_PHASE_PROMPTS } from './prompts.js';
export class DreamEngine {
    config;
    state;
    lock;
    constructor(config) {
        this.config = {
            memoryDir: config.memoryDir,
            sessionThreshold: config.sessionThreshold ?? 5,
            timeThresholdHours: config.timeThresholdHours ?? 24,
            maxMemLines: config.maxMemLines ?? 200,
            maxMemKb: config.maxMemKb ?? 25,
            lockPath: config.lockPath ?? join(config.memoryDir, '.dream.lock'),
            llm: config.llm,
            dryRun: config.dryRun ?? false,
            verbose: config.verbose ?? false,
        };
        this.state = new DreamStateTracker(config.memoryDir);
        this.lock = createLockfile(this.config.lockPath);
        // Ensure memory dir exists
        if (!existsSync(this.config.memoryDir)) {
            mkdirSync(this.config.memoryDir, { recursive: true });
        }
    }
    /**
     * Check all three gates. Returns { pass: true } if all gates are open.
     */
    checkGates() {
        const s = this.state.get();
        const now = Date.now();
        // Gate 1: Time
        const hoursSinceDream = s.lastDreamMs
            ? (now - s.lastDreamMs) / (1000 * 60 * 60)
            : Infinity;
        if (hoursSinceDream < this.config.timeThresholdHours) {
            return {
                pass: false,
                reason: `Time gate closed: ${hoursSinceDream.toFixed(1)}h since last dream (need ${this.config.timeThresholdHours}h)`,
            };
        }
        // Gate 2: Session count
        if (s.sessionCount < this.config.sessionThreshold) {
            return {
                pass: false,
                reason: `Session gate closed: ${s.sessionCount} sessions (need ${this.config.sessionThreshold})`,
            };
        }
        return { pass: true, reason: 'All gates open' };
    }
    /**
     * Try to acquire the lock. Returns false if another dream is running.
     */
    tryAcquireLock() {
        return this.lock.acquire();
    }
    /**
     * Read memory directory and return file structure + content summaries.
     */
    async readMemoryStructure() {
        const entries = readdirSync(this.config.memoryDir, { withFileTypes: true });
        const lines = ['## Memory Directory Structure\n'];
        for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            if (entry.name.startsWith('.'))
                continue; // skip hidden files like .dream.lock
            const fullPath = join(this.config.memoryDir, entry.name);
            if (entry.isDirectory()) {
                lines.push(`- ${entry.name}/`);
                try {
                    const sub = readdirSync(fullPath);
                    for (const f of sub.slice(0, 10)) {
                        lines.push(`  - ${f}`);
                    }
                    if (sub.length > 10)
                        lines.push(`  - ... (${sub.length - 10} more)`);
                }
                catch { }
            }
            else {
                const stat = readFileSync(fullPath, 'utf-8');
                const preview = stat.slice(0, 200).replace(/\n/g, ' ');
                lines.push(`- ${entry.name} (${stat.length}b): "${preview}..."`);
            }
        }
        return lines.join('\n');
    }
    /**
     * Run a single dream phase through the LLM.
     */
    async runPhase(phaseName, prompt, context) {
        const fullPrompt = `${DREAM_SYSTEM_PROMPT}\n\n${prompt}\n\n---\n## Context\n\n${context}`;
        this.log(`[dream:phase] ${phaseName}`);
        try {
            const response = await this.config.llm.complete({
                system: DREAM_SYSTEM_PROMPT,
                messages: [{ role: 'user', content: prompt + '\n\n---\n## Context\n\n' + context }],
                maxTokens: 2048,
            });
            const content = response.content;
            this.log(`[dream:phase:${phaseName}] done, ${content.length}b`);
            return { phase: phaseName, content, success: true };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.log(`[dream:phase:${phaseName}] ERROR: ${msg}`);
            return { phase: phaseName, content: '', success: false };
        }
    }
    /**
     * Parse LLM output for file write directives.
     * Looks for patterns like: FILE: path/to/file.md
     *                         ```markdown
     *                         content here
     *                         ```
     */
    parseFileWriteDirective(content) {
        const files = [];
        const filePattern = /FILE:\s*([^\n]+)\n```(?:\w+)?\n([\s\S]*?)```/g;
        let m;
        while ((m = filePattern.exec(content)) !== null) {
            files.push({ path: m[1].trim(), body: m[2] });
        }
        return files;
    }
    /**
     * Execute file writes from phase output (unless dryRun).
     */
    async executeWrites(files, dryRun) {
        const written = [];
        for (const { path, body } of files) {
            if (dryRun) {
                this.log(`[dream:write:dryrun] ${path} (${body.length}b)`);
            }
            else {
                const fullPath = join(this.config.memoryDir, path);
                // Ensure parent dir exists
                const dir = join(this.config.memoryDir, path).split('/').slice(0, -1).join('/');
                if (dir && !existsSync(dir)) {
                    mkdirSync(dir, { recursive: true });
                }
                writeFileSync(fullPath, body, 'utf-8');
                this.log(`[dream:write] ${path} (${body.length}b)`);
            }
            written.push(path);
        }
        return written;
    }
    log(msg) {
        if (this.config.verbose) {
            console.log(`[dream] ${msg}`);
        }
    }
    /**
     * Increment session count. Call this after every user-facing session.
     */
    bumpSession() {
        this.state.incrementSession();
    }
    /**
     * Check gates and run the dream if all three pass.
     * Returns a DreamResult describing what happened.
     */
    async maybeDream() {
        // Gate check
        const gates = this.checkGates();
        if (!gates.pass) {
            return { ran: false, reason: gates.reason };
        }
        // Lock check
        if (!this.tryAcquireLock()) {
            return { ran: false, reason: 'Lock gate closed: another dream is running' };
        }
        try {
            return await this.run();
        }
        finally {
            this.lock.release();
        }
    }
    /**
     * Force-run the dream regardless of gates. Use for testing or manual trigger.
     */
    async runForced() {
        if (!this.tryAcquireLock()) {
            return { ran: false, reason: 'Lock gate closed: another dream is running' };
        }
        try {
            return await this.run();
        }
        finally {
            this.lock.release();
        }
    }
    async run() {
        this.log('Dream starting');
        const phasesRun = [];
        const phaseContexts = [];
        const phaseContents = [];
        const memoryStructure = await this.readMemoryStructure();
        // Phase 1: Orient
        {
            const result = await this.runPhase('orient', DREAM_PHASE_PROMPTS.orient(this.config.memoryDir), memoryStructure);
            phasesRun.push(result.phase);
            phaseContexts.push(result.content);
            phaseContents.push(result);
            if (!result.success) {
                this.lock.release();
                return { ran: true, phasesRun, error: `Phase ${result.phase} failed` };
            }
        }
        // Phase 2: Gather Signal
        {
            const gatherContext = [
                memoryStructure,
                '\n\n## Orient Report\n' + phaseContexts[0],
            ].join('\n\n');
            const result = await this.runPhase('gather', DREAM_PHASE_PROMPTS.gatherSignal(this.config.memoryDir), gatherContext);
            phasesRun.push(result.phase);
            phaseContexts.push(result.content);
            phaseContents.push(result);
            if (!result.success) {
                this.lock.release();
                return { ran: true, phasesRun, error: `Phase ${result.phase} failed` };
            }
        }
        // Phase 3: Consolidate
        const consolidateContext = [
            memoryStructure,
            '\n\n## Orient Report\n' + phaseContexts[0],
            '\n\n## Signal Report\n' + phaseContexts[1],
        ].join('\n\n');
        const consolidateResult = await this.runPhase('consolidate', DREAM_PHASE_PROMPTS.consolidate(this.config.memoryDir), consolidateContext);
        phasesRun.push(consolidateResult.phase);
        phaseContexts.push(consolidateResult.content);
        phaseContents.push(consolidateResult);
        // Execute file writes from consolidate phase
        const consolidateWrites = this.parseFileWriteDirective(consolidateResult.content);
        await this.executeWrites(consolidateWrites, this.config.dryRun);
        // Count signals
        const signalsMatch = phaseContexts[1].match(/signal|fact|decision|item/gi);
        const signalsFound = signalsMatch ? signalsMatch.length : 0;
        // Phase 4: Prune
        const pruneContext = [
            memoryStructure,
            '\n\n## Orient Report\n' + phaseContexts[0],
            '\n\n## Signal Report\n' + phaseContexts[1],
            '\n\n## Consolidate Output\n' + phaseContexts[2],
        ].join('\n\n');
        const pruneResult = await this.runPhase('prune', DREAM_PHASE_PROMPTS.prune(this.config.memoryDir), pruneContext);
        phasesRun.push(pruneResult.phase);
        phaseContexts.push(pruneResult.content);
        // Execute file writes from prune phase
        const pruneWrites = this.parseFileWriteDirective(pruneResult.content);
        const pruneModified = await this.executeWrites(pruneWrites, this.config.dryRun);
        // All files modified
        const allModified = [
            ...consolidateWrites.map((f) => f.path),
            ...pruneModified,
        ];
        // Record dream
        this.state.recordDream();
        this.log('Dream complete');
        return {
            ran: true,
            reason: 'All phases completed',
            phasesRun,
            signalsFound,
            filesModified: allModified,
        };
    }
}
//# sourceMappingURL=engine.js.map