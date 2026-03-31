/**
 * Prompt Architecture — Modular Prompt Composer
 *
 * System prompt built from cacheable static sections and session-specific
 * dynamic sections. A boundary marker splits cacheable from volatile content.
 *
 * Benefits:
 *   - Static sections can be cached at the provider level across sessions
 *   - Only dynamic content changes per-call → fewer tokens sent
 *   - Explicit boundary makes cache behavior predictable
 *
 * The SYSTEM_PROMPT_DYNAMIC_BOUNDARY marker splits:
 *   Before boundary  → static, cacheable
 *   After boundary   → dynamic, never cached
 */
export type PromptSectionId = 'core_identity' | 'capabilities' | 'safety' | 'context' | 'session' | 'dynamic';
export interface PromptSection {
    id: PromptSectionId;
    label: string;
    content: string;
    cacheable: boolean;
    priority?: number;
}
export interface PromptComposerConfig {
    boundaryMarker?: string;
    cacheStatic?: boolean;
    verbose?: boolean;
}
export declare class PromptComposer {
    private sections;
    private config;
    constructor(config?: PromptComposerConfig);
    /**
     * Register a section. Overwrites existing section with same id.
     */
    register(section: PromptSection): void;
    /**
     * Register multiple sections at once.
     */
    registerAll(sections: PromptSection[]): void;
    /**
     * Update just the content of a section (keeps existing metadata).
     */
    update(id: PromptSectionId, content: string): void;
    /**
     * Remove a section.
     */
    remove(id: PromptSectionId): void;
    /**
     * Render the full composed prompt.
     * Static sections first, then boundary marker, then dynamic sections.
     */
    compose(dynamicContent?: string): string;
    /**
     * Render only the static (cacheable) portion.
     * Useful for pre-computing and caching at the provider level.
     */
    composeStatic(): string;
    /**
     * Render only the dynamic portion (everything after the boundary).
     */
    composeDynamic(sessionContent?: string): string;
    /**
     * Get all registered section ids.
     */
    sectionIds(): PromptSectionId[];
    /**
     * Dump section list for debugging.
     */
    dump(): Array<{
        id: PromptSectionId;
        label: string;
        cacheable: boolean;
        priority: number;
    }>;
}
export declare const DEFAULT_SECTIONS: PromptSection[];
/**
 * Create a PromptComposer pre-loaded with default sections.
 */
export declare function createPromptComposer(config?: PromptComposerConfig): PromptComposer;
