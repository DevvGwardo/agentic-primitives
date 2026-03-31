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

export type PromptSectionId =
  | 'core_identity'
  | 'capabilities'
  | 'safety'
  | 'context'
  | 'session'
  | 'dynamic';

export interface PromptSection {
  id: PromptSectionId;
  label: string;
  content: string;
  cacheable: boolean;    // if false, placed after the boundary
  priority?: number;     // lower = rendered first (default: 50)
}

export interface PromptComposerConfig {
  boundaryMarker?: string;  // default: '─── DYNAMIC ───'
  cacheStatic?: boolean;    // if true, static sections are wrapped for provider caching hints
  verbose?: boolean;
}

const DEFAULT_BOUNDARY = '─── DYNAMIC ───';

export class PromptComposer {
  private sections = new Map<PromptSectionId, PromptSection>();
  private config: Required<PromptComposerConfig>;

  constructor(config: PromptComposerConfig = {}) {
    this.config = {
      boundaryMarker: config.boundaryMarker ?? DEFAULT_BOUNDARY,
      cacheStatic: config.cacheStatic ?? false,
      verbose: config.verbose ?? false,
    };
  }

  /**
   * Register a section. Overwrites existing section with same id.
   */
  register(section: PromptSection): void {
    this.sections.set(section.id, section);
  }

  /**
   * Register multiple sections at once.
   */
  registerAll(sections: PromptSection[]): void {
    for (const s of sections) this.register(s);
  }

  /**
   * Update just the content of a section (keeps existing metadata).
   */
  update(id: PromptSectionId, content: string): void {
    const existing = this.sections.get(id);
    if (existing) {
      this.sections.set(id, { ...existing, content });
    }
  }

  /**
   * Remove a section.
   */
  remove(id: PromptSectionId): void {
    this.sections.delete(id);
  }

  /**
   * Render the full composed prompt.
   * Static sections first, then boundary marker, then dynamic sections.
   */
  compose(dynamicContent?: string): string {
    const sorted = [...this.sections.values()].sort(
      (a, b) => (a.priority ?? 50) - (b.priority ?? 50),
    );

    const staticSections = sorted.filter((s) => s.cacheable);
    const dynamicSections = sorted.filter((s) => !s.cacheable);

    const parts: string[] = [];

    // Static sections
    for (const section of staticSections) {
      if (this.config.verbose) parts.push(`[static:${section.id}]`);
      parts.push(section.content);
    }

    // Boundary
    parts.push(this.config.boundaryMarker);

    // Dynamic sections
    for (const section of dynamicSections) {
      if (this.config.verbose) parts.push(`[dynamic:${section.id}]`);
      parts.push(section.content);
    }

    // Extra dynamic content (session-specific context, user message, etc.)
    if (dynamicContent) {
      parts.push(dynamicContent);
    }

    return parts.join('\n\n');
  }

  /**
   * Render only the static (cacheable) portion.
   * Useful for pre-computing and caching at the provider level.
   */
  composeStatic(): string {
    const sorted = [...this.sections.values()]
      .filter((s) => s.cacheable)
      .sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));

    return sorted.map((s) => s.content).join('\n\n');
  }

  /**
   * Render only the dynamic portion (everything after the boundary).
   */
  composeDynamic(sessionContent?: string): string {
    const sorted = [...this.sections.values()]
      .filter((s) => !s.cacheable)
      .sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));

    const parts = sorted.map((s) => s.content);
    if (sessionContent) parts.push(sessionContent);
    return parts.join('\n\n');
  }

  /**
   * Get all registered section ids.
   */
  sectionIds(): PromptSectionId[] {
    return [...this.sections.keys()];
  }

  /**
   * Dump section list for debugging.
   */
  dump(): Array<{ id: PromptSectionId; label: string; cacheable: boolean; priority: number }> {
    return [...this.sections.values()].map((s) => ({
      id: s.id,
      label: s.label,
      cacheable: s.cacheable,
      priority: s.priority ?? 50,
    }));
  }
}

// ─── Default Sections ─────────────────────────────────────────────────────────

export const DEFAULT_SECTIONS: PromptSection[] = [
  {
    id: 'core_identity',
    label: 'Core Identity',
    cacheable: true,
    priority: 10,
    content: `You are a helpful, precise AI assistant. You think carefully, answer concisely, and prefer showing over telling.`,
  },
  {
    id: 'capabilities',
    label: 'Capabilities',
    cacheable: true,
    priority: 20,
    content: `You have access to tools: Bash, FileRead, FileEdit, FileWrite, WebSearch, WebFetch, and more. Use them when they help.`,
  },
  {
    id: 'safety',
    label: 'Safety Guidelines',
    cacheable: true,
    priority: 30,
    content: `Do not perform destructive operations without explicit confirmation. When in doubt, ask. Respect privacy. Do not exfiltrate data.`,
  },
  {
    id: 'context',
    label: 'User Context',
    cacheable: false,
    priority: 40,
    content: `## User Context\n\nNo user context loaded.`,
  },
  {
    id: 'session',
    label: 'Session State',
    cacheable: false,
    priority: 50,
    content: `## Session\n\nNo active session.`,
  },
];

/**
 * Create a PromptComposer pre-loaded with default sections.
 */
export function createPromptComposer(config?: PromptComposerConfig): PromptComposer {
  const composer = new PromptComposer(config);
  composer.registerAll(DEFAULT_SECTIONS);
  return composer;
}
