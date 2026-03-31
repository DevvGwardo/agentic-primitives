/**
 * Lockfile utility for Dream — prevents concurrent dream runs.
 */
export interface Lockfile {
    acquire(): boolean;
    release(): void;
    isLocked(): boolean;
}
export declare function createLockfile(lockPath: string): Lockfile;
