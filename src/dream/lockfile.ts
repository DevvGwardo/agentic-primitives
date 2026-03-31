/**
 * Lockfile utility for Dream — prevents concurrent dream runs.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

export interface Lockfile {
  acquire(): boolean;
  release(): void;
  isLocked(): boolean;
}

export function createLockfile(lockPath: string): Lockfile {
  return {
    acquire(): boolean {
      if (existsSync(lockPath)) {
        // Check if stale (older than 1 hour)
        try {
          const stat = readFileSync(lockPath, 'utf-8');
          const age = Date.now() - parseInt(stat.trim(), 10);
          if (age > 60 * 60 * 1000) {
            // Stale lock, clobber it
            unlinkSync(lockPath);
          } else {
            return false;
          }
        } catch {
          return false;
        }
      }
      writeFileSync(lockPath, Date.now().toString(), 'utf-8');
      return true;
    },

    release(): void {
      if (existsSync(lockPath)) {
        unlinkSync(lockPath);
      }
    },

    isLocked(): boolean {
      return existsSync(lockPath);
    },
  };
}
