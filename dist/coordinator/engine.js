/**
 * CoordinatorEngine — Multi-Agent Orchestrator
 *
 * Structured four-phase orchestration:
 *   1. Research  — parallel workers investigate the problem space
 *   2. Synthesis — coordinator reads findings, crafts a spec
 *   3. Implement — parallel workers make targeted changes
 *   4. Verify    — workers validate changes match the spec
 *
 * Designed to be provider-agnostic: pass any LLMClient-compatible agent runner.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { COORDINATOR_SYSTEM_PROMPT, COORDINATOR_WORKER_PROMPT, COORDINATOR_PHASE_PROMPTS } from './prompts.js';
// ─── Default worker runner ────────────────────────────────────────────────────
async function defaultWorkerRunner(task, ctx) {
    // Read scratchDir files for context
    let contextFiles = '';
    try {
        const files = readdirSync(ctx.scratchDir);
        for (const f of files) {
            if (f.endsWith('.md') && f !== `worker-${task.id}.md`) {
                const content = readFileSync(join(ctx.scratchDir, f), 'utf-8');
                contextFiles += `\n\n## From ${f}\n\n${content.slice(0, 2000)}`;
            }
        }
    }
    catch { }
    const prompt = `${ctx.system ?? COORDINATOR_WORKER_PROMPT}

## Your Task (worker-${task.id})
${task.instruction}

${contextFiles ? `\n\n## Context from Other Workers\n${contextFiles}` : ''}

When done, write your findings to ${ctx.scratchDir}/worker-${task.id}.md`;
    // This default runner calls the LLM. In a real integration you'd call
    // Claude Code, Codex, or another agent process here.
    const response = await ctx.llm.complete({
        system: COORDINATOR_WORKER_PROMPT,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 4096,
    });
    return response.content;
}
// ─── Coordinator Engine ──────────────────────────────────────────────────────
export class CoordinatorEngine {
    config;
    scratchDir;
    constructor(config) {
        this.scratchDir = config.scratchDir;
        this.config = {
            llm: config.llm,
            scratchDir: config.scratchDir,
            maxWorkers: config.maxWorkers ?? 4,
            model: config.model ?? 'claude-3-5-haiku-20241022',
            verbose: config.verbose ?? false,
            workerRunner: config.workerRunner ?? (async (task, ctx) => {
                // When no workerRunner is provided, fall back to a simple completion.
                // In practice, you'd inject a real agent runner (Claude Code, Codex, etc.)
                // by providing workerRunner in the config.
                const llm = this.config.llm;
                const response = await llm.complete({
                    system: COORDINATOR_WORKER_PROMPT,
                    messages: [{ role: 'user', content: `${COORDINATOR_WORKER_PROMPT}\n\n## Your Task\n${task.instruction}` }],
                    maxTokens: 4096,
                });
                return response.content;
            }),
        };
        // Ensure scratch dir exists
        mkdirSync(this.scratchDir, { recursive: true });
    }
    log(msg) {
        if (this.config.verbose) {
            console.log(`[coordinator] ${msg}`);
        }
    }
    async runPhase(phase, goal, workspace, workerTasks) {
        this.log(`Phase: ${phase}`);
        const prompt = this.buildPhasePrompt(phase, goal, workspace);
        try {
            const response = await this.config.llm.complete({
                system: COORDINATOR_SYSTEM_PROMPT,
                messages: [{ role: 'user', content: prompt }],
                maxTokens: 4096,
                model: this.config.model,
            });
            const output = response.content;
            // Save coordinator output
            const phaseFile = join(this.scratchDir, `coordinator-${phase}.md`);
            writeFileSync(phaseFile, output, 'utf-8');
            this.log(`Saved ${phaseFile}`);
            // Run workers if tasks provided
            let workerOutputs;
            if (workerTasks && workerTasks.length > 0) {
                workerOutputs = {};
                // Launch workers in parallel
                const workerPromises = workerTasks.map(async (task) => {
                    this.log(`Worker ${task.id} starting`);
                    const result = await this.config.workerRunner(task, {
                        scratchDir: this.scratchDir,
                        system: COORDINATOR_WORKER_PROMPT,
                    });
                    this.log(`Worker ${task.id} done`);
                    // Write worker output to scratch
                    writeFileSync(join(this.scratchDir, `worker-${task.id}-${phase}.md`), result, 'utf-8');
                    workerOutputs[task.id] = result;
                    return result;
                });
                await Promise.all(workerPromises);
            }
            return { phase, status: 'ok', coordinatorOutput: output, workerOutputs };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.log(`Phase ${phase} error: ${msg}`);
            return { phase, status: 'error', coordinatorOutput: '', error: msg };
        }
    }
    buildPhasePrompt(phase, goal, workspace) {
        const sd = this.scratchDir;
        const workers = this.config.maxWorkers;
        switch (phase) {
            case 'research':
                return COORDINATOR_PHASE_PROMPTS.research(goal, workspace, workers, sd);
            case 'synthesis':
                return COORDINATOR_PHASE_PROMPTS.synthesis(goal, workspace, sd);
            case 'implementation':
                return COORDINATOR_PHASE_PROMPTS.implementation(goal, workspace, workers, sd);
            case 'verification':
                return COORDINATOR_PHASE_PROMPTS.verification(goal, workspace, workers, sd);
        }
    }
    /**
     * Run the full four-phase orchestration.
     *
     * @param goal          The task to accomplish
     * @param workspace     Path to the codebase / files to work on
     * @param onPhase       Optional callback after each phase (coordinator output)
     */
    async run(goal, workspace, onPhase) {
        this.log(`Starting: ${goal}`);
        const phases = [];
        // Phase 1: Research
        {
            const result = await this.runPhase('research', goal, workspace);
            phases.push(result);
            onPhase?.(result);
            if (result.status === 'error') {
                return { phases, finalStatus: 'needs_work', scratchDir: this.scratchDir };
            }
        }
        // Phase 2: Synthesis
        {
            const result = await this.runPhase('synthesis', goal, workspace);
            phases.push(result);
            onPhase?.(result);
            if (result.status === 'error') {
                return { phases, finalStatus: 'needs_work', scratchDir: this.scratchDir };
            }
            // Read spec for later phases
            try {
                const specPath = join(this.scratchDir, 'coordinator-spec.md');
                if (existsSync(specPath)) {
                    phases[phases.length - 1].spec =
                        readFileSync(specPath, 'utf-8');
                }
            }
            catch { }
        }
        // Phase 3: Implementation
        {
            // Build implementation tasks from spec
            const specFile = join(this.scratchDir, 'coordinator-spec.md');
            const spec = existsSync(specFile) ? readFileSync(specFile, 'utf-8') : '';
            const tasks = this.deriveImplTasks(spec);
            const result = await this.runPhase('implementation', goal, workspace, tasks);
            phases.push(result);
            onPhase?.(result);
            if (result.status === 'error') {
                return { phases, finalStatus: 'needs_work', scratchDir: this.scratchDir };
            }
        }
        // Phase 4: Verification
        {
            const tasks = this.deriveVerifyTasks(goal);
            const result = await this.runPhase('verification', goal, workspace, tasks);
            phases.push(result);
            onPhase?.(result);
            if (result.status === 'error') {
                return { phases, finalStatus: 'needs_work', scratchDir: this.scratchDir };
            }
        }
        // Determine final status
        const verifyPhase = phases[phases.length - 1];
        const finalStatus = verifyPhase.coordinatorOutput.toLowerCase().includes('final status: ready')
            ? 'ready'
            : 'needs_work';
        return { phases, finalStatus, scratchDir: this.scratchDir };
    }
    /**
     * Derive implementation tasks from the spec file.
     * In a real integration, the LLM would generate these as part of phase 2.
     * This is a simple heuristic for the default runner.
     */
    deriveImplTasks(spec) {
        if (!spec)
            return [];
        const count = this.config.maxWorkers;
        return Array.from({ length: count }, (_, i) => ({
            id: `impl-${i + 1}`,
            instruction: `Implement the changes described in the spec. Read ${this.scratchDir}/coordinator-spec.md and make the changes. Report what you did.`,
        }));
    }
    deriveVerifyTasks(_goal) {
        const count = Math.min(2, this.config.maxWorkers);
        return Array.from({ length: count }, (_, i) => ({
            id: `verify-${i + 1}`,
            instruction: `Verify the implementation against the spec at ${this.scratchDir}/coordinator-spec.md. Check that all changes are correct and complete.`,
        }));
    }
}
//# sourceMappingURL=engine.js.map