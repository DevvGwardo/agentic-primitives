/**
 * Dream State Tracker
 * Persists dream metadata (last run time, session count) to a JSON file.
 */
export interface DreamState {
    lastDreamMs: number | null;
    lastDreamDate: string | null;
    sessionCount: number;
    lastSessionDate: string | null;
    totalDreams: number;
}
export declare class DreamStateTracker {
    private statePath;
    constructor(stateDir: string);
    read(): DreamState;
    write(state: Partial<DreamState>): void;
    incrementSession(): void;
    recordDream(): void;
    get(): DreamState;
}
