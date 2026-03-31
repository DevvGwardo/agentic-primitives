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
  [key: string]: unknown; // provider-specific extras
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
export class AnthropicAdapter implements LLMClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(opts: {
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
  } = {}) {
    this.apiKey = opts.apiKey ?? (process.env.ANTHROPIC_API_KEY ?? '');
    this.baseUrl = opts.baseUrl ?? 'https://api.anthropic.com';
    this.defaultModel = opts.defaultModel ?? 'claude-3-5-haiku-20241022';
  }

  async complete(opts: LLMCompletionOptions): Promise<LLMResponse> {
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

    const json = await res.json() as {
      content: Array<{ type: string; text?: string }>;
      model: string;
      usage: { input_tokens: number; output_tokens: number };
      stop_reason: string;
    };

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
export class OpenAIAdapter implements LLMClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(opts: {
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
  } = {}) {
    this.apiKey = opts.apiKey ?? (process.env.OPENAI_API_KEY ?? '');
    this.baseUrl = opts.baseUrl ?? 'https://api.openai.com/v1';
    this.defaultModel = opts.defaultModel ?? 'gpt-4o-mini';
  }

  async complete(opts: LLMCompletionOptions): Promise<LLMResponse> {
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

    const json = await res.json() as {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      model: string;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

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
