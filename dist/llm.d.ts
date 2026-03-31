/**
 * Shared LLM Client interface — framework-agnostic.
 * Implement this to adapt to any LLM provider (Anthropic, OpenAI, Ollama, etc.)
 */
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface LLMCompletionOptions {
    system?: string;
    messages: LLMMessage[];
    maxTokens?: number;
    temperature?: number;
    model?: string;
    stop?: string[];
    [key: string]: unknown;
}
export interface LLMResponse {
    content: string;
    model?: string;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
    };
    finishReason?: string;
}
/**
 * The LLM client interface. Implement this to create an adapter.
 */
export interface LLMClient {
    complete(opts: LLMCompletionOptions): Promise<LLMResponse>;
}
/**
 * Minimal Anthropic adapter.
 * Usage:
 *   import { AnthropicAdapter } from './llm.js';
 *   const llm = new AnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY });
 */
export declare class AnthropicAdapter implements LLMClient {
    private apiKey;
    private baseUrl;
    private defaultModel;
    constructor(opts?: {
        apiKey?: string;
        baseUrl?: string;
        defaultModel?: string;
    });
    complete(opts: LLMCompletionOptions): Promise<LLMResponse>;
}
/**
 * Minimal OpenAI adapter.
 * Usage:
 *   import { OpenAIAdapter } from './llm.js';
 *   const llm = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY });
 */
export declare class OpenAIAdapter implements LLMClient {
    private apiKey;
    private baseUrl;
    private defaultModel;
    constructor(opts?: {
        apiKey?: string;
        baseUrl?: string;
        defaultModel?: string;
    });
    complete(opts: LLMCompletionOptions): Promise<LLMResponse>;
}
