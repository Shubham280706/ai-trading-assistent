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

export type AnnualDataPoint = {
  year: number;
  revenue: number | null;
  netIncome: number | null;
};

export type FundamentalData = {
  // Valuation
  peRatio: number | null;
  pbRatio: number | null;
  bookValue: number | null;
  evToEbitda: number | null;
  // Dividends
  dividendYield: number | null;
  dividendRate: number | null;
  payoutRatio: number | null;
  // Returns
  roe: number | null;
  roa: number | null;
  roce: number | null;
  // Growth & Margins
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  profitMargin: number | null;
  operatingMargin: number | null;
  // Financial health
  debtToEquity: number | null;
  currentRatio: number | null;
  // Historical annual data (up to 4 years)
  annualHistory: AnnualDataPoint[];
  // Fundamental quality
  fundamentalScore: number;
  verdict: "Strong Buy" | "Good" | "Fairly Valued" | "Weak" | "Avoid";
  verdictReason: string;
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
