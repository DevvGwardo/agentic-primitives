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
import { type LLMClient } from '../llm.js';
export type KairosOutputMode = 'brief' | 'full';
export type KairosAction = 'act' | 'quiet';
export interface KairosDecision {
    action: KairosAction;
    reason: string;
    output?: string;
    deferUntil?: number;
}
export interface KairosTickContext {
    tickNumber: number;
    elapsedMs: number;
    pendingDefers: number;
    memory?: string;
}
export interface KairosConfig {
    tickIntervalMs?: number;
    maxBlockMs?: number;
    outputMode?: KairosOutputMode;
    deferralMaxAgeMs?: number;
    llm: LLMClient;
    decidePrompt?: string;
    verbose?: boolean;
}
export type KairosEventMap = {
    tick: (ctx: KairosTickContext) => void;
    decide: (ctx: KairosTickContext, decision: KairosDecision) => void;
    act: (ctx: KairosTickContext, output: string) => void;
    quiet: (ctx: KairosTickContext, reason: string) => void;
    defer: (ctx: KairosTickContext, reason: string) => void;
    error: (err: Error) => void;
};
export declare class Kairos extends EventEmitter {
    private config;
    private tickCount;
    private startTime;
    private deferred;
    private intervalId;
    private stopped;
    constructor(config: KairosConfig);
    private log;
    private loadMemoryDigest;
    private buildTickContext;
    private pruneDeferred;
    private buildDecidePrompt;
    decide(ctx: KairosTickContext): Promise<KairosDecision>;
    tick(): Promise<void>;
    /** Start the tick loop. Call once at startup. */
    start(): void;
    /** Stop the tick loop. */
    stop(): void;
    /** Manually trigger a tick outside the schedule. */
    tickNow(): Promise<void>;
    /** Returns current tick count. */
    getTickCount(): number;
}
