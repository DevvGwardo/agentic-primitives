/**
 * Lockfile utility for Dream — prevents concurrent dream runs.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
export function createLockfile(lockPath) {
    return {
        acquire() {
            if (existsSync(lockPath)) {
                // Check if stale (older than 1 hour)
                try {
                    const stat = readFileSync(lockPath, 'utf-8');
                    const age = Date.now() - parseInt(stat.trim(), 10);
                    if (age > 60 * 60 * 1000) {
                        // Stale lock, clobber it
                        unlinkSync(lockPath);
                    }
                    else {
                        return false;
                    }
                }
                catch {
                    return false;
                }
            }
            writeFileSync(lockPath, Date.now().toString(), 'utf-8');
            return true;
        },
        release() {
            if (existsSync(lockPath)) {
                unlinkSync(lockPath);
            }
        },
        isLocked() {
            return existsSync(lockPath);
        },
    };
}
//# sourceMappingURL=lockfile.js.map