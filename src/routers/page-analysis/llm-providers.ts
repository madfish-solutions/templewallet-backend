import { getEnv } from '../../utils/env';
import logger from '../../utils/logger';

export type LLMProvider = 'groq' | 'gemini';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

// API Response types
interface GroqApiResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

const PROVIDER_CONFIGS: Record<LLMProvider, () => ProviderConfig> = {
  groq: () => ({
    apiKey: getEnv('GROQ_API_KEY'),
    model: getEnv('GROQ_MODEL') || 'llama-3.1-8b-instant',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions'
  }),
  gemini: () => ({
    apiKey: getEnv('GEMINI_API_KEY'),
    model: getEnv('GEMINI_MODEL') || 'gemini-2.5-flash-lite',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models'
  })
};

export function getActiveProvider(): LLMProvider {
  const provider = getEnv('LLM_PROVIDER') || 'groq';
  if (provider !== 'groq' && provider !== 'gemini') {
    logger.warn(`Invalid LLM_PROVIDER "${provider}", defaulting to groq`);

    return 'groq';
  }

  return provider;
}

async function callGroq(messages: LLMMessage[], config: ProviderConfig): Promise<LLMResponse> {
  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.3,
      max_tokens: 1024,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as GroqApiResponse;

  return {
    content: data.choices[0]?.message?.content || '',
    provider: 'groq',
    model: config.model,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        }
      : undefined
  };
}

async function callGemini(messages: LLMMessage[], config: ProviderConfig): Promise<LLMResponse> {
  const systemInstruction = messages.find(m => m.role === 'system')?.content != null || '';
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const url = `${config.baseUrl}/${config.model}:generateContent?key=${config.apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as GeminiApiResponse;

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usageMetadata = data.usageMetadata;

  return {
    content,
    provider: 'gemini',
    model: config.model,
    usage: usageMetadata
      ? {
          promptTokens: usageMetadata.promptTokenCount || 0,
          completionTokens: usageMetadata.candidatesTokenCount || 0,
          totalTokens: usageMetadata.totalTokenCount || 0
        }
      : undefined
  };
}

export async function callLLM(messages: LLMMessage[], provider?: LLMProvider): Promise<LLMResponse> {
  const activeProvider = provider || getActiveProvider();
  const config = PROVIDER_CONFIGS[activeProvider]();

  if (!config.apiKey) {
    throw new Error(`API key not configured for provider: ${activeProvider}`);
  }

  logger.info(`Calling LLM provider: ${activeProvider}, model: ${config.model}`);

  const startTime = Date.now();

  try {
    let response: LLMResponse;

    if (activeProvider === 'groq') {
      response = await callGroq(messages, config);
    } else {
      response = await callGemini(messages, config);
    }

    const duration = Date.now() - startTime;
    logger.info(`LLM response received in ${duration}ms, tokens: ${response.usage?.totalTokens || 'N/A'}`);

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`LLM call failed after ${duration}ms:`, error);
    throw error;
  }
}

export function isLLMConfigured(): boolean {
  const provider = getActiveProvider();
  const config = PROVIDER_CONFIGS[provider]();

  return Boolean(config.apiKey);
}
