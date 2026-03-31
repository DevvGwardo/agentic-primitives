/**
 * Dream State Tracker
 * Persists dream metadata (last run time, session count) to a JSON file.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
const DEFAULT_STATE = {
    lastDreamMs: null,
    lastDreamDate: null,
    sessionCount: 0,
    lastSessionDate: null,
    totalDreams: 0,
};
export class DreamStateTracker {
    statePath;
    constructor(stateDir) {
        // Ensure directory exists
        this.statePath = join(stateDir, 'dream-state.json');
    }
    read() {
        if (!existsSync(this.statePath)) {
            return { ...DEFAULT_STATE };
        }
        try {
            const raw = readFileSync(this.statePath, 'utf-8');
            return { ...DEFAULT_STATE, ...JSON.parse(raw) };
        }
        catch {
            return { ...DEFAULT_STATE };
        }
    }
    write(state) {
        const current = this.read();
        const next = { ...current, ...state };
        writeFileSync(this.statePath, JSON.stringify(next, null, 2), 'utf-8');
    }
    incrementSession() {
        const state = this.read();
        const today = new Date().toISOString().split('T')[0];
        const isNewDay = state.lastSessionDate !== today;
        this.write({
            sessionCount: isNewDay ? state.sessionCount + 1 : state.sessionCount,
            lastSessionDate: today,
        });
    }
    recordDream() {
        const state = this.read();
        const now = Date.now();
        const today = new Date().toISOString().split('T')[0];
        this.write({
            lastDreamMs: now,
            lastDreamDate: today,
            sessionCount: 0, // Reset after dreaming
            totalDreams: state.totalDreams + 1,
        });
    }
    get() {
        return this.read();
    }
}
//# sourceMappingURL=state.js.map