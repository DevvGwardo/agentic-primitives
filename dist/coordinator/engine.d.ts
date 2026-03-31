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
import { type LLMClient } from '../llm.js';
export interface WorkerTask {
    id: string;
    instruction: string;
    workspace?: string;
}
export interface CoordinatorConfig {
    llm: LLMClient;
    scratchDir: string;
    maxWorkers?: number;
    model?: string;
    verbose?: boolean;
    workerRunner?: (task: WorkerTask, ctx: {
        scratchDir: string;
        system?: string;
    }) => Promise<string>;
}
export interface CoordinatorResult {
    phase: 'research' | 'synthesis' | 'implementation' | 'verification';
    status: 'ok' | 'error' | 'blocked';
    coordinatorOutput: string;
    workerOutputs?: Record<string, string>;
    error?: string;
}
export interface CoordinatorRunResult {
    phases: CoordinatorResult[];
    spec?: string;
    finalStatus: 'ready' | 'needs_work';
    scratchDir: string;
}
export declare class CoordinatorEngine {
    private config;
    private scratchDir;
    constructor(config: CoordinatorConfig);
    private log;
    private runPhase;
    private buildPhasePrompt;
    /**
     * Run the full four-phase orchestration.
     *
     * @param goal          The task to accomplish
     * @param workspace     Path to the codebase / files to work on
     * @param onPhase       Optional callback after each phase (coordinator output)
     */
    run(goal: string, workspace: string, onPhase?: (result: CoordinatorResult) => void): Promise<CoordinatorRunResult>;
    /**
     * Derive implementation tasks from the spec file.
     * In a real integration, the LLM would generate these as part of phase 2.
     * This is a simple heuristic for the default runner.
     */
    private deriveImplTasks;
    private deriveVerifyTasks;
}
