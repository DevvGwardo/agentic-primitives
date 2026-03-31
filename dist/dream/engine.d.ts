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
import { LLMClient } from '../llm.js';
export interface DreamConfig {
    memoryDir: string;
    sessionThreshold?: number;
    timeThresholdHours?: number;
    maxMemLines?: number;
    maxMemKb?: number;
    lockPath?: string;
    llm: LLMClient;
    dryRun?: boolean;
    verbose?: boolean;
}
export interface DreamResult {
    ran: boolean;
    reason?: string;
    phasesRun?: string[];
    signalsFound?: number;
    filesModified?: string[];
    error?: string;
}
export declare class DreamEngine {
    private config;
    private state;
    private lock;
    constructor(config: DreamConfig);
    /**
     * Check all three gates. Returns { pass: true } if all gates are open.
     */
    checkGates(): {
        pass: boolean;
        reason: string;
    };
    /**
     * Try to acquire the lock. Returns false if another dream is running.
     */
    private tryAcquireLock;
    /**
     * Read memory directory and return file structure + content summaries.
     */
    private readMemoryStructure;
    /**
     * Run a single dream phase through the LLM.
     */
    private runPhase;
    /**
     * Parse LLM output for file write directives.
     * Looks for patterns like: FILE: path/to/file.md
     *                         ```markdown
     *                         content here
     *                         ```
     */
    private parseFileWriteDirective;
    /**
     * Execute file writes from phase output (unless dryRun).
     */
    private executeWrites;
    private log;
    /**
     * Increment session count. Call this after every user-facing session.
     */
    bumpSession(): void;
    /**
     * Check gates and run the dream if all three pass.
     * Returns a DreamResult describing what happened.
     */
    maybeDream(): Promise<DreamResult>;
    /**
     * Force-run the dream regardless of gates. Use for testing or manual trigger.
     */
    runForced(): Promise<DreamResult>;
    private run;
}
