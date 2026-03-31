/**
 * Shared LLM Client interface — framework-agnostic.
 * Implement this to adapt to any LLM provider (Anthropic, OpenAI, Ollama, etc.)
 */
/**
 * Minimal Anthropic adapter.
 * Usage:
 *   import { AnthropicAdapter } from './llm.js';
 *   const llm = new AnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY });
 */
export class AnthropicAdapter {
    apiKey;
    baseUrl;
    defaultModel;
    constructor(opts = {}) {
        this.apiKey = opts.apiKey ?? (process.env.ANTHROPIC_API_KEY ?? '');
        this.baseUrl = opts.baseUrl ?? 'https://api.anthropic.com';
        this.defaultModel = opts.defaultModel ?? 'claude-3-5-haiku-20241022';
    }
    async complete(opts) {
        const model = opts.model ?? this.defaultModel;
        const res = await fetch(`${this.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model,
                max_tokens: opts.maxTokens ?? 1024,
                temperature: opts.temperature ?? 0.7,
                system: opts.system,
                messages: opts.messages,
            }),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Anthropic API error ${res.status}: ${err}`);
        }
        const json = await res.json();
        const text = json.content.find((c) => c.type === 'text')?.text ?? '';
        return {
            content: text,
            model: json.model,
            usage: {
                inputTokens: json.usage.input_tokens,
                outputTokens: json.usage.output_tokens,
            },
            finishReason: json.stop_reason,
        };
    }
}
/**
 * Minimal OpenAI adapter.
 * Usage:
 *   import { OpenAIAdapter } from './llm.js';
 *   const llm = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY });
 */
export class OpenAIAdapter {
    apiKey;
    baseUrl;
    defaultModel;
    constructor(opts = {}) {
        this.apiKey = opts.apiKey ?? (process.env.OPENAI_API_KEY ?? '');
        this.baseUrl = opts.baseUrl ?? 'https://api.openai.com/v1';
        this.defaultModel = opts.defaultModel ?? 'gpt-4o-mini';
    }
    async complete(opts) {
        const model = opts.model ?? this.defaultModel;
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'authorization': `Bearer ${this.apiKey}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model,
                max_tokens: opts.maxTokens ?? 1024,
                temperature: opts.temperature ?? 0.7,
                system_message: opts.system,
                messages: opts.messages,
            }),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`OpenAI API error ${res.status}: ${err}`);
        }
        const json = await res.json();
        return {
            content: json.choices[0]?.message?.content ?? '',
            model: json.model,
            usage: {
                inputTokens: json.usage?.prompt_tokens,
                outputTokens: json.usage?.completion_tokens,
            },
            finishReason: json.choices[0]?.finish_reason,
        };
    }
}
//# sourceMappingURL=llm.js.map