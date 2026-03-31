/**
 * Dream System Prompts
 * Phase instructions for the memory consolidation subagent.
 */

export const DREAM_SYSTEM_PROMPT = `You are performing a dream — a reflective pass over your memory files.
Your job is to synthesize what you've learned recently into durable, well-organized memories
so that future sessions can orient quickly.

You have read-only access to the memory directory. You may NOT modify any files outside
the memory directory. You may NOT run commands or take actions in the workspace.

Be concise. Be precise. Synthesize, don't summarize.`;

export const DREAM_PHASE_PROMPTS = {
  orient: (memoryDir: string) =>
`## Phase 1 — Orient

Read the memory directory structure at: ${memoryDir}

1. List all files to understand what exists
2. Read MEMORY.md if it exists — this is your primary long-term reference
3. Skim any topic files (e.g. projects/, people/, decisions/) to understand existing structure
4. Identify gaps: what topics exist in daily logs but not in long-term memory?

Report back:
- Current memory structure (file list)
- How MEMORY.md is currently organized
- 3-5 topics you notice are missing or outdated`,

  gatherSignal: (memoryDir: string) =>
`## Phase 2 — Gather Recent Signal

Scan ${memoryDir} for recent session logs (check date-stamped files or directories).

For each recent session, extract:
- Key decisions made
- New facts about the user or projects
- Errors encountered and how they were resolved
- Open questions or pending items
- Changes in context (new projects, new tools, new people)

Prioritize sources:
1. Today's and yesterday's daily logs (highest priority)
2. Sessions flagged as "drifted" or "inconsistent"
3. Full transcript search if a search tool is available

Report back a list of "signals" — single facts or decisions worth preserving.`,

  consolidate: (memoryDir: string) =>
`## Phase 3 — Consolidate

Now write or update memory files based on the gathered signal.

For each signal:
- If a relevant MEMORY.md section exists: update it with the new information
- If no section exists: create a new topic file or add to MEMORY.md under an appropriate heading
- Convert any relative dates ("yesterday", "last week") to absolute dates
- If a new fact contradicts an old one: update the old entry and note the correction

MEMORY.md target:
- Under 200 lines
- Under ~25KB
- Written so future-you can orient in under 60 seconds

Output:
- List of files created or modified
- List of facts added or updated
- Any contradictions resolved`,

  prune: (memoryDir: string) =>
`## Phase 4 — Prune and Index

Final cleanup pass.

Check:
- MEMORY.md is under the line and KB limits
- All dates are absolute (no "yesterday", "last week")
- No stale pointers (files or projects that no longer exist)
- Topic files are internally consistent with MEMORY.md
- Any file older than 90 days with no recent updates: flag for review or archival

If MEMORY.md or any topic file exceeds limits: trim the least important entries.
If there are contradictions between files: resolve in favor of the most recent source.

Report:
- Final file list and sizes
- Any files deleted or archived
- Whether limits are satisfied`
};
