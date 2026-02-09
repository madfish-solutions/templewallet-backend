import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import logger from '../../utils/logger';

import { callLLM, isLLMConfigured, getActiveProvider, LLMMessage } from './llm-providers';
import {
  PageAnalysisRequest,
  PageAnalysisResponse,
  LLMAnalysisResult,
  TradingSuggestion,
  TradingAction,
  TradingPlatform
} from './types';

export const pageAnalysisRouter = Router();

// Suggestion expiry time (1 hour)
const SUGGESTION_EXPIRY_MS = 60 * 60 * 1000;

/**
 * System prompt for the LLM
 */
const SYSTEM_PROMPT = `You are a crypto trading signal analyzer. Your job is to analyze text snippets from webpages and determine:

1. Whether there's actionable trading information
2. The overall sentiment (bullish/bearish/neutral)
3. Which specific crypto assets are mentioned and their individual sentiment
4. Whether to suggest any trading actions

IMPORTANT RULES:
- Only suggest trading actions when there's CLEAR bullish or bearish sentiment
- Be conservative - when in doubt, suggest "watch" not "long" or "short"
- Confidence should reflect how clear and actionable the information is
- Focus on major assets: BTC, ETH, SOL, and other top 20 cryptocurrencies

Respond with a JSON object in this exact format:
{
  "hasTradingSignal": boolean,
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": number (0-1),
  "summary": "Brief 1-2 sentence summary of the content",
  "assets": [
    {
      "symbol": "BTC",
      "name": "Bitcoin",
      "sentiment": "bullish" | "bearish" | "neutral",
      "action": "long" | "short" | "watch" | "none",
      "reasoning": "Why this action is suggested"
    }
  ]
}

Only include assets that are actually mentioned in the snippets.
If no crypto trading content is found, return hasTradingSignal: false with empty assets array.`;

function buildUserPrompt(request: PageAnalysisRequest): string {
  const snippetsText = request.snippets.map((s, i) => `[${i + 1}] "${s.text}"`).join('\n');

  return `Analyze the following snippets from ${request.hostname}:

DETECTED KEYWORDS: ${request.keywords.join(', ')}

SNIPPETS:
${snippetsText}

Provide your analysis as JSON.`;
}

function buildSuggestions(result: LLMAnalysisResult, hostname: string): TradingSuggestion[] {
  const suggestions: TradingSuggestion[] = [];

  for (const asset of result.assets) {
    if (asset.action === 'none') continue;

    let action: TradingAction;
    let platform: TradingPlatform;
    let side: 'buy' | 'sell' | undefined;
    let title: string;
    let ctaText: string;

    switch (asset.action) {
      case 'long':
        action = 'open_long';
        platform = 'hyperliquid';
        side = 'buy';
        title = `Open ${asset.symbol} Long`;
        ctaText = 'Trade on Hyperliquid';
        break;
      case 'short':
        action = 'open_short';
        platform = 'hyperliquid';
        side = 'sell';
        title = `Open ${asset.symbol} Short`;
        ctaText = 'Trade on Hyperliquid';
        break;
      case 'watch':
        action = 'add_to_watchlist';
        platform = 'temple_swap';
        title = `Watch ${asset.symbol}`;
        ctaText = 'Add to Watchlist';
        break;
      default:
        continue;
    }

    const priority = result.confidence > 0.8 ? 'high' : result.confidence > 0.4 ? 'medium' : 'low';

    suggestions.push({
      id: uuidv4(),
      action,
      asset: {
        symbol: asset.symbol,
        name: asset.name
      },
      platform,
      ui: {
        title,
        subtitle: `Based on ${hostname}`,
        ctaText,
        priority
      },
      params: {
        market: `${asset.symbol}-PERP`,
        side,
        suggestedLeverage: asset.action === 'long' || asset.action === 'short' ? 3 : undefined
      },
      reasoning: asset.reasoning,
      expiresAt: Date.now() + SUGGESTION_EXPIRY_MS
    });
  }

  return suggestions;
}

function parseLLMResponse(content: string): LLMAnalysisResult {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      hasTradingSignal: Boolean(parsed.hasTradingSignal),
      sentiment: ['bullish', 'bearish', 'neutral'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral',
      confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      summary: String(Boolean(parsed.summary) || 'Unable to analyze content'),
      assets: Array.isArray(parsed.assets) ? parsed.assets : []
    };
  } catch (error) {
    logger.error('Failed to parse LLM response:', error);

    return {
      hasTradingSignal: false,
      sentiment: 'neutral',
      confidence: 0,
      summary: 'Failed to analyze content',
      assets: []
    };
  }
}

/**
 * POST /api/page-analysis
 * Analyze page content for trading signals
 */
pageAnalysisRouter.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const body = req.body as PageAnalysisRequest;

    if (!body.snippets?.length) {
      return res.status(400).json({ error: 'No snippets provided' });
    }

    if (!body.url || !body.hostname) {
      return res.status(400).json({ error: 'URL and hostname are required' });
    }

    if (!isLLMConfigured()) {
      return res.status(503).json({ error: 'LLM service not configured' });
    }

    const messages: LLMMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(body) }
    ];

    const llmResponse = await callLLM(messages);
    const analysisResult = parseLLMResponse(llmResponse.content);
    const suggestions = buildSuggestions(analysisResult, body.hostname);

    const response: PageAnalysisResponse = {
      hasTradingSignal: analysisResult.hasTradingSignal,
      analysis: {
        sentiment: analysisResult.sentiment,
        confidence: analysisResult.confidence,
        summary: analysisResult.summary
      },
      suggestions
    };

    if (process.env.NODE_ENV === 'development') {
      response.debug = {
        provider: llmResponse.provider,
        model: llmResponse.model,
        tokensUsed: llmResponse.usage?.totalTokens || 0,
        responseTimeMs: Date.now() - startTime
      };
    }

    res.json(response);
  } catch (error: any) {
    logger.error('Page analysis failed:', error);
    res.status(500).json({ error: error.message || 'Analysis failed' });
  }
});

/**
 * GET /api/page-analysis/health
 * check if the service is configured and healthy
 */
pageAnalysisRouter.get('/health', (_req: Request, res: Response) => {
  const isConfigured = isLLMConfigured();
  const provider = getActiveProvider();

  res.json({
    status: isConfigured ? 'ok' : 'unconfigured',
    provider,
    message: isConfigured ? `Using ${provider}` : 'LLM API key not configured'
  });
});
