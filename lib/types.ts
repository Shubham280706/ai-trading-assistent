export type Candle = {
  date: string;
  close: number;
  high: number;
  low: number;
  open: number;
  volume: number;
};

export type IndicatorSet = {
  rsi: number;
  ma50: number;
  ma200: number;
  macd: number;
  signalLine: number;
  histogram: number;
};

export type StockSnapshot = {
  symbol: string;
  shortName: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap?: number;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
  candles: Candle[];
  indicators: IndicatorSet;
};

export type NewsItem = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  sentimentScore: number;
  summary: string;
};

export type AiRecommendation = {
  shortTerm: "Buy" | "Sell" | "Hold";
  longTerm: "Buy" | "Sell" | "Hold";
  confidence: number;
  sentiment: "Bullish" | "Bearish" | "Neutral";
  reason: string;
};

export type MarketBriefItem = {
  company: string;
  ticker: string;
  category: string;
  sentiment: "Positive" | "Negative" | "Neutral";
  sentiment_score: number;
  summary: string;
  title: string;
  source: string;
  url: string;
  date: string;
  importance_score: number;
};

export type MarketBrief = {
  date: string;
  total_raw: number;
  total_processed: number;
  top_5: MarketBriefItem[];
  top_news: MarketBriefItem[];
  readable_summary: string;
};
