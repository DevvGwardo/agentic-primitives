/**
 * Feature Gates — Runtime Flag System
 *
 * Supports:
 *   - Compile-time constants (from env or config)
 *   - Runtime overrides (programmatic)
 *   - Stale-OK reads (for non-critical gates)
 *   - Namespace isolation
 *
 * General pattern inspired by modern feature flag systems.
 * Rewritten from scratch as a general-purpose implementation.
 */
export type GateValue = boolean | string | number | null;
export interface GateSpec {
    key: string;
    defaultValue: GateValue;
    description?: string;
    staleMaxAgeMs?: number;
    envVar?: string;
}
export interface GateResult {
    key: string;
    value: GateValue;
    source: 'default' | 'env' | 'config' | 'runtime' | 'cache';
    stale: boolean;
    cachedAt?: number;
}
export declare class GateStore {
    private gates;
    private configDir;
    constructor(configDir?: string);
    /**
     * Register a gate with a spec. Call at startup for all known gates.
     */
    register(spec: GateSpec): void;
    /**
     * Register multiple gates at once.
     */
    registerAll(specs: GateSpec[]): void;
    /**
     * Get a gate value. May return a stale cached value if staleMaxAgeMs hasn't passed.
     */
    get(key: string, opts?: {
        forceRefresh?: boolean;
    }): GateResult;
    /**
     * Shortcut: get as boolean. Returns false for null/undefined/non-true values.
     */
    is(key: string, defaultValue?: boolean): boolean;
    /**
     * Override a gate value at runtime. Persists for the session.
     */
    set(key: string, value: GateValue): void;
    /**
     * Reset a gate to its initial resolved value.
     */
    reset(key: string): void;
    /**
     * Reset all gates to initial values.
     */
    resetAll(): void;
    /** List all registered gate keys. */
    keys(): string[];
    /** List all gate results (for debugging / admin). */
    dump(): GateResult[];
    private resolveInitialValue;
    private determineSource;
    private parseEnvValue;
    private configCache;
    private loadFromConfig;
}
export declare const BUILTIN_GATES: {
    readonly dream: {
        readonly key: "dream.enabled";
        readonly defaultValue: true;
        readonly description: "Enable the Dream memory consolidation system";
        readonly envVar: "DREAM_ENABLED";
        readonly staleMaxAgeMs: number;
    };
    readonly dream_auto: {
        readonly key: "dream.auto_trigger";
        readonly defaultValue: true;
        readonly description: "Automatically trigger dreams based on gates (vs manual only)";
        readonly envVar: "DREAM_AUTO_TRIGGER";
        readonly staleMaxAgeMs: number;
    };
    readonly kairos: {
        readonly key: "kairos.enabled";
        readonly defaultValue: false;
        readonly description: "Enable Kairos proactive tick loop";
        readonly envVar: "KAIROS_ENABLED";
        readonly staleMaxAgeMs: number;
    };
    readonly kairos_brief: {
        readonly key: "kairos.brief_mode";
        readonly defaultValue: true;
        readonly description: "Use brief (concise) output mode in Kairos ticks";
        readonly envVar: "KAIROS_BRIEF_MODE";
        readonly staleMaxAgeMs: number;
    };
    readonly coordinator: {
        readonly key: "coordinator.enabled";
        readonly defaultValue: true;
        readonly description: "Enable multi-agent coordinator mode";
        readonly envVar: "COORDINATOR_ENABLED";
        readonly staleMaxAgeMs: number;
    };
    readonly coordinator_max_workers: {
        readonly key: "coordinator.max_workers";
        readonly defaultValue: 4;
        readonly description: "Max parallel workers in coordinator mode";
        readonly envVar: "COORDINATOR_MAX_WORKERS";
        readonly staleMaxAgeMs: number;
    };
    readonly prompt_modular: {
        readonly key: "prompt.modular_sections";
        readonly defaultValue: false;
        readonly description: "Use modular prompt sections (vs monolithic)";
        readonly envVar: "PROMPT_MODULAR";
        readonly staleMaxAgeMs: number;
    };
    readonly dry_run: {
        readonly key: "safety.dry_run";
        readonly defaultValue: false;
        readonly description: "Dry-run mode: never write files or take destructive actions";
        readonly envVar: "DRY_RUN";
        readonly staleMaxAgeMs: number;
    };
};
/**
 * Create a pre-configured gate store with built-in gates registered.
 */
export declare function createGateStore(configDir?: string): GateStore;
