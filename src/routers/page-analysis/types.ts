export interface PageAnalysisRequest {
  url: string;
  hostname: string;
  snippets: SnippetForAnalysis[];
  keywords: string[];
  categories: string[];
  timestamp: number;
}

export interface SnippetForAnalysis {
  text: string;
  keywords: string[];
}

export interface PageAnalysisResponse {
  /** Whether tradeable crypto content was detected */
  hasTradingSignal: boolean;
  /** Overall page analysis */
  analysis: PageAnalysis;
  /** Suggested trading actions */
  suggestions: TradingSuggestion[];
  debug?: {
    provider: string;
    model: string;
    tokensUsed: number;
    responseTimeMs: number;
  };
}

export interface PageAnalysis {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  /** Confidence score (0-1) */
  confidence: number;
  summary: string;
}

export interface TradingSuggestion {
  id: string;
  action: TradingAction;
  asset: TradingAsset;
  /** Platform to execute on */
  platform: TradingPlatform;
  /** UI display configuration */
  ui: SuggestionUI;
  /** Parameters for the trading action */
  params: TradingParams;
  /** Explanation of why this is suggested */
  reasoning: string;
  /** When this suggestion expires (timestamp) */
  expiresAt: number;
}

export type TradingAction = 'open_long' | 'open_short' | 'swap' | 'add_to_watchlist';

export type TradingPlatform = 'hyperliquid' | 'temple_swap';

export interface TradingAsset {
  /** Token symbol (e.g., "BTC", "ETH") */
  symbol: string;
  /** Full name (e.g., "Bitcoin") */
  name: string;
}

export interface SuggestionUI {
  /** Main title (e.g., "Open BTC Long") */
  title: string;
  subtitle: string;
  ctaText: string;
  priority: 'high' | 'medium' | 'low';
}

export interface TradingParams {
  /** Market identifier (e.g., "BTC-PERP") */
  market?: string;
  side?: 'buy' | 'sell';
  suggestedLeverage?: number;
}

export interface LLMAnalysisResult {
  hasTradingSignal: boolean;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  summary: string;
  assets: Array<{
    symbol: string;
    name: string;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    action: 'long' | 'short' | 'watch' | 'none';
    reasoning: string;
  }>;
}
