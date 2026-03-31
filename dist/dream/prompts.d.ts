/**
 * Dream System Prompts
 * Phase instructions for the memory consolidation subagent.
 */
export declare const DREAM_SYSTEM_PROMPT = "You are performing a dream \u2014 a reflective pass over your memory files.\nYour job is to synthesize what you've learned recently into durable, well-organized memories\nso that future sessions can orient quickly.\n\nYou have read-only access to the memory directory. You may NOT modify any files outside\nthe memory directory. You may NOT run commands or take actions in the workspace.\n\nBe concise. Be precise. Synthesize, don't summarize.";
export declare const DREAM_PHASE_PROMPTS: {
    orient: (memoryDir: string) => string;
    gatherSignal: (memoryDir: string) => string;
    consolidate: (memoryDir: string) => string;
    prune: (memoryDir: string) => string;
};
