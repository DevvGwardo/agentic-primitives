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
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
// ─── Gate Store ───────────────────────────────────────────────────────────────
export class GateStore {
    gates = new Map();
    configDir;
    constructor(configDir) {
        this.configDir = configDir ?? join(process.env.HOME ?? '.', '.config', 'agentic-primitives');
    }
    /**
     * Register a gate with a spec. Call at startup for all known gates.
     */
    register(spec) {
        const initialValue = this.resolveInitialValue(spec);
        this.gates.set(spec.key, {
            spec,
            value: initialValue,
            source: this.determineSource(spec, initialValue),
            cachedAt: null,
        });
    }
    /**
     * Register multiple gates at once.
     */
    registerAll(specs) {
        for (const spec of specs)
            this.register(spec);
    }
    /**
     * Get a gate value. May return a stale cached value if staleMaxAgeMs hasn't passed.
     */
    get(key, opts = {}) {
        const entry = this.gates.get(key);
        if (!entry) {
            return { key, value: null, source: 'default', stale: true };
        }
        const now = Date.now();
        const cachedAt = entry.cachedAt ?? now;
        const age = now - cachedAt;
        const staleMaxAge = entry.spec.staleMaxAgeMs ?? Infinity;
        const stale = opts.forceRefresh ? true : age > staleMaxAge;
        // Refresh if stale and forceRefresh not explicitly false
        if (stale && !opts.forceRefresh && entry.source !== 'runtime') {
            const refreshed = this.resolveInitialValue(entry.spec);
            if (refreshed !== entry.value) {
                entry.value = refreshed;
                entry.source = this.determineSource(entry.spec, refreshed);
                entry.cachedAt = now;
            }
        }
        return {
            key,
            value: entry.value,
            source: entry.source,
            stale,
            cachedAt: entry.cachedAt ?? now,
        };
    }
    /**
     * Shortcut: get as boolean. Returns false for null/undefined/non-true values.
     */
    is(key, defaultValue = false) {
        const result = this.get(key);
        return result.value === true || result.value === 'true' || result.value === '1'
            ? true
            : defaultValue;
    }
    /**
     * Override a gate value at runtime. Persists for the session.
     */
    set(key, value) {
        const entry = this.gates.get(key);
        if (!entry)
            return;
        entry.value = value;
        entry.source = 'runtime';
        entry.cachedAt = Date.now();
    }
    /**
     * Reset a gate to its initial resolved value.
     */
    reset(key) {
        const entry = this.gates.get(key);
        if (!entry)
            return;
        const value = this.resolveInitialValue(entry.spec);
        entry.value = value;
        entry.source = this.determineSource(entry.spec, value);
        entry.cachedAt = null;
    }
    /**
     * Reset all gates to initial values.
     */
    resetAll() {
        for (const key of this.gates.keys())
            this.reset(key);
    }
    /** List all registered gate keys. */
    keys() {
        return [...this.gates.keys()];
    }
    /** List all gate results (for debugging / admin). */
    dump() {
        return this.keys().map((k) => this.get(k));
    }
    // ─── Private ────────────────────────────────────────────────────────────────
    resolveInitialValue(spec) {
        // 1. Env var override
        if (spec.envVar && process.env[spec.envVar] !== undefined) {
            return this.parseEnvValue(process.env[spec.envVar]);
        }
        // 2. Config file
        const configValue = this.loadFromConfig(spec.key);
        if (configValue !== undefined)
            return configValue;
        // 3. Default
        return spec.defaultValue;
    }
    determineSource(spec, value) {
        if (spec.envVar && process.env[spec.envVar] !== undefined)
            return 'env';
        if (this.loadFromConfig(spec.key) !== undefined)
            return 'config';
        return 'default';
    }
    parseEnvValue(raw) {
        if (raw === 'true' || raw === '1')
            return true;
        if (raw === 'false' || raw === '0')
            return false;
        const n = Number(raw);
        if (!isNaN(n))
            return n;
        return raw;
    }
    configCache = null;
    loadFromConfig(key) {
        const configPath = join(this.configDir, 'gates.json');
        if (!existsSync(configPath))
            return undefined;
        if (!this.configCache) {
            try {
                this.configCache = JSON.parse(readFileSync(configPath, 'utf-8'));
            }
            catch {
                return undefined;
            }
        }
        return this.configCache[key];
    }
}
// ─── Built-in Gates ──────────────────────────────────────────────────────────
export const BUILTIN_GATES = {
    // Dream
    dream: {
        key: 'dream.enabled',
        defaultValue: true,
        description: 'Enable the Dream memory consolidation system',
        envVar: 'DREAM_ENABLED',
        staleMaxAgeMs: 5 * 60 * 1000,
    },
    dream_auto: {
        key: 'dream.auto_trigger',
        defaultValue: true,
        description: 'Automatically trigger dreams based on gates (vs manual only)',
        envVar: 'DREAM_AUTO_TRIGGER',
        staleMaxAgeMs: 60 * 1000,
    },
    // Kairos
    kairos: {
        key: 'kairos.enabled',
        defaultValue: false,
        description: 'Enable Kairos proactive tick loop',
        envVar: 'KAIROS_ENABLED',
        staleMaxAgeMs: 60 * 1000,
    },
    kairos_brief: {
        key: 'kairos.brief_mode',
        defaultValue: true,
        description: 'Use brief (concise) output mode in Kairos ticks',
        envVar: 'KAIROS_BRIEF_MODE',
        staleMaxAgeMs: 60 * 1000,
    },
    // Coordinator
    coordinator: {
        key: 'coordinator.enabled',
        defaultValue: true,
        description: 'Enable multi-agent coordinator mode',
        envVar: 'COORDINATOR_ENABLED',
        staleMaxAgeMs: 5 * 60 * 1000,
    },
    coordinator_max_workers: {
        key: 'coordinator.max_workers',
        defaultValue: 4,
        description: 'Max parallel workers in coordinator mode',
        envVar: 'COORDINATOR_MAX_WORKERS',
        staleMaxAgeMs: 60 * 1000,
    },
    // Prompt Architecture
    prompt_modular: {
        key: 'prompt.modular_sections',
        defaultValue: false,
        description: 'Use modular prompt sections (vs monolithic)',
        envVar: 'PROMPT_MODULAR',
        staleMaxAgeMs: 60 * 1000,
    },
    // Safety
    dry_run: {
        key: 'safety.dry_run',
        defaultValue: false,
        description: 'Dry-run mode: never write files or take destructive actions',
        envVar: 'DRY_RUN',
        staleMaxAgeMs: Infinity,
    },
};
// ─── Quick builder ────────────────────────────────────────────────────────────
/**
 * Create a pre-configured gate store with built-in gates registered.
 */
export function createGateStore(configDir) {
    const store = new GateStore(configDir);
    store.registerAll(Object.values(BUILTIN_GATES));
    return store;
}
//# sourceMappingURL=index.js.map