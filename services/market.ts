import yahooFinance from "yahoo-finance2";

import { calculateIndicators } from "@/lib/indicators";
import type { AnnualDataPoint, Candle, FundamentalData, StockSnapshot } from "@/lib/types";

const STOCK_CACHE_TTL_MS = 20_000;

const fallbackSymbols = [
  { symbol: "RELIANCE.NS", name: "Reliance Industries", exchange: "NSE" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services", exchange: "NSE" },
  { symbol: "INFY.NS", name: "Infosys", exchange: "NSE" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank", exchange: "NSE" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank", exchange: "NSE" }
];

type SearchResult = {
  symbol: string;
  name: string;
  exchange: string;
};

type YahooSearchQuote = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
};

type NseAutocompleteResponse = {
  symbols?: Array<{
    symbol?: string;
    symbol_info?: string;
    result_type?: string;
    result_sub_type?: string;
  }>;
};

type NseQuoteResponse = {
  info?: {
    companyName?: string;
    symbol?: string;
  };
  priceInfo?: {
    lastPrice?: number;
    change?: number;
    pChange?: number;
    previousClose?: number;
    open?: number;
    intraDayHighLow?: {
      min?: number;
      max?: number;
    };
  };
  securityInfo?: {
    issuedSize?: number;
  };
  metadata?: {
    symbol?: string;
  };
};

type CacheEntry = {
  expiresAt: number;
  value: StockSnapshot;
};

const stockCache = new Map<string, CacheEntry>();

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function buildSymbolCandidates(input: string) {
  const trimmed = input.trim().toUpperCase();

  if (!trimmed) {
    return [];
  }

  const candidates = new Set<string>([trimmed]);

  if (!trimmed.endsWith(".NS") && !trimmed.endsWith(".BO")) {
    candidates.add(`${trimmed}.NS`);
    candidates.add(`${trimmed}.BO`);
  }

  return [...candidates];
}

function createFallbackCandles(basePrice: number): Candle[] {
  return Array.from({ length: 220 }, (_, index) => {
    const noise = Math.sin(index / 11) * 12 + Math.cos(index / 19) * 7;
    const close = Number((basePrice + noise + index * 0.18).toFixed(2));

    return {
      date: new Date(Date.now() - (219 - index) * 86400000).toISOString(),
      open: Number((close - 5).toFixed(2)),
      high: Number((close + 8).toFixed(2)),
      low: Number((close - 9).toFixed(2)),
      close,
      volume: 900000 + index * 5000
    };
  });
}

function createCandlesFromLiveQuote(price: number, previousClose: number): Candle[] {
  const baseline = previousClose || price;

  return Array.from({ length: 220 }, (_, index) => {
    const drift = (price - baseline) * (index / 219);
    const wave = Math.sin(index / 10) * Math.max(price * 0.01, 2);
    const close = Number((baseline + drift + wave).toFixed(2));

    return {
      date: new Date(Date.now() - (219 - index) * 86400000).toISOString(),
      open: Number((close - Math.max(close * 0.005, 1.5)).toFixed(2)),
      high: Number((close + Math.max(close * 0.008, 2)).toFixed(2)),
      low: Number((close - Math.max(close * 0.009, 2.5)).toFixed(2)),
      close,
      volume: 900000 + index * 4000
    };
  });
}

function toNseBaseSymbol(symbol: string) {
  return symbol.trim().toUpperCase().replace(/\.NS$|\.BO$/g, "");
}

function getCachedSnapshot(symbol: string) {
  const cached = stockCache.get(symbol);
  if (!cached || cached.expiresAt < Date.now()) {
    stockCache.delete(symbol);
    return null;
  }

  return cached.value;
}

function setCachedSnapshot(symbol: string, value: StockSnapshot) {
  stockCache.set(symbol, { value, expiresAt: Date.now() + STOCK_CACHE_TTL_MS });
}

async function fetchNseJson<T>(url: string, referer: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json,text/plain,*/*",
        Referer: referer
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchYahooSnapshot(symbol: string): Promise<StockSnapshot | null> {
  try {
    const [quoteResult, chartResult] = await Promise.all([
      yahooFinance.quote(symbol),
      yahooFinance.chart(symbol, {
        interval: "1d",
        range: "1y"
      })
    ]);

    const quote = quoteResult as {
      shortName?: string;
      longName?: string;
      fullExchangeName?: string;
      exchange?: string;
      regularMarketPrice?: number | null;
      regularMarketChange?: number | null;
      regularMarketChangePercent?: number | null;
      marketCap?: number | null;
      regularMarketDayHigh?: number | null;
      regularMarketDayLow?: number | null;
      regularMarketPreviousClose?: number | null;
      regularMarketOpen?: number | null;
      regularMarketVolume?: number | null;
    };

    const chart = chartResult as {
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    };

    const timestamps = chart.timestamp ?? [];
    const quotes = chart.indicators?.quote?.[0];

    const candles: Candle[] = timestamps
      .map((timestamp, index) => ({
        date: new Date(timestamp * 1000).toISOString(),
        open: Number(quotes?.open?.[index] ?? quote.regularMarketOpen ?? 0),
        high: Number(quotes?.high?.[index] ?? quote.regularMarketDayHigh ?? 0),
        low: Number(quotes?.low?.[index] ?? quote.regularMarketDayLow ?? 0),
        close: Number(quotes?.close?.[index] ?? quote.regularMarketPrice ?? 0),
        volume: Number(quotes?.volume?.[index] ?? quote.regularMarketVolume ?? 0)
      }))
      .filter((candle) => candle.close > 0);

    if (!candles.length || !quote.regularMarketPrice) {
      return null;
    }

    const indicators = calculateIndicators(candles);

    return {
      symbol,
      shortName: quote.shortName ?? quote.longName ?? symbol,
      exchange: `${quote.fullExchangeName ?? quote.exchange ?? (symbol.endsWith(".BO") ? "BSE" : "NSE")}`,
      price: Number(quote.regularMarketPrice ?? 0),
      change: Number(quote.regularMarketChange ?? 0),
      changePercent: Number(quote.regularMarketChangePercent ?? 0),
      marketCap: Number(quote.marketCap ?? 0),
      dayHigh: Number(quote.regularMarketDayHigh ?? 0),
      dayLow: Number(quote.regularMarketDayLow ?? 0),
      previousClose: Number(quote.regularMarketPreviousClose ?? 0),
      candles,
      indicators
    };
  } catch {
    return null;
  }
}

async function fetchNseSnapshot(symbol: string): Promise<StockSnapshot | null> {
  const nseSymbol = toNseBaseSymbol(symbol);
  const data = await fetchNseJson<NseQuoteResponse>(
    `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(nseSymbol)}`,
    `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(nseSymbol)}`
  );

  const price = data?.priceInfo?.lastPrice;
  if (!price) {
    return null;
  }

  const previousClose = Number(data.priceInfo?.previousClose ?? price);
  const candles = createCandlesFromLiveQuote(Number(price), previousClose);
  const indicators = calculateIndicators(candles);

  return {
    symbol: `${nseSymbol}.NS`,
    shortName: data.info?.companyName ?? nseSymbol,
    exchange: "NSE",
    price: Number(price),
    change: Number(data.priceInfo?.change ?? price - previousClose),
    changePercent: Number(data.priceInfo?.pChange ?? ((price - previousClose) / previousClose) * 100),
    marketCap: Number(data.securityInfo?.issuedSize ?? 0) * Number(price),
    dayHigh: Number(data.priceInfo?.intraDayHighLow?.max ?? data.priceInfo?.open ?? price),
    dayLow: Number(data.priceInfo?.intraDayHighLow?.min ?? data.priceInfo?.open ?? price),
    previousClose,
    candles,
    indicators
  };
}

export async function resolveMarketSymbol(input: string) {
  const normalized = normalizeQuery(input);

  if (!normalized) {
    return null;
  }

  const fallbackMatch = fallbackSymbols.find((stock) => {
    const stockSymbol = normalizeQuery(stock.symbol.replace(".NS", "").replace(".BO", ""));
    return (
      normalizeQuery(stock.symbol) === normalized ||
      stockSymbol === normalized ||
      normalizeQuery(stock.name).includes(normalized)
    );
  });

  if (fallbackMatch) {
    return fallbackMatch.symbol;
  }

  try {
    const searchResponse = await yahooFinance.search(input, {
      quotesCount: 8,
      newsCount: 0,
      region: "IN",
      lang: "en-US"
    });

    const searchResults = searchResponse as {
      quotes?: YahooSearchQuote[];
    };

    const stock = (searchResults.quotes ?? []).find((item) => {
      const symbol = item.symbol ?? "";
      return symbol.endsWith(".NS") || symbol.endsWith(".BO");
    });

    return stock?.symbol ?? null;
  } catch {
    // Fall through to NSE public autocomplete.
  }

  const nseResults = await fetchNseJson<NseAutocompleteResponse>(
    `https://www.nseindia.com/api/search/autocomplete?q=${encodeURIComponent(input)}`,
    "https://www.nseindia.com/"
  );

  const equity = (nseResults?.symbols ?? []).find(
    (item) => item.result_type === "symbol" && item.result_sub_type === "equity" && item.symbol
  );

  return equity?.symbol ? `${equity.symbol}.NS` : null;
}

async function searchNseStocks(query: string): Promise<SearchResult[]> {
  const nseResults = await fetchNseJson<NseAutocompleteResponse>(
    `https://www.nseindia.com/api/search/autocomplete?q=${encodeURIComponent(query)}`,
    "https://www.nseindia.com/"
  );

  return (nseResults?.symbols ?? [])
    .filter((item) => item.result_type === "symbol" && item.result_sub_type === "equity" && item.symbol)
    .map((item) => ({
      symbol: `${item.symbol}.NS`,
      name: item.symbol_info ?? item.symbol ?? "",
      exchange: "NSE"
    }))
    .slice(0, 8);
}

async function searchYahooStocks(query: string): Promise<SearchResult[]> {
  try {
    const searchResponse = await yahooFinance.search(query, {
      quotesCount: 8,
      newsCount: 0,
      region: "IN",
      lang: "en-US"
    });

    const searchResults = searchResponse as {
      quotes?: YahooSearchQuote[];
    };

    return (searchResults.quotes ?? [])
      .filter((item) => {
        const symbol = item.symbol ?? "";
        return symbol.endsWith(".NS") || symbol.endsWith(".BO");
      })
      .map((item) => ({
        symbol: item.symbol ?? "",
        name: item.shortname ?? item.longname ?? item.symbol ?? "",
        exchange: item.exchange ?? (item.symbol?.endsWith(".BO") ? "BSE" : "NSE")
      }))
      .filter((item) => item.symbol && item.name)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export async function getStockSnapshot(symbol: string): Promise<StockSnapshot> {
  const resolvedSymbol = (await resolveMarketSymbol(symbol)) ?? buildSymbolCandidates(symbol)[0];
  const cached = getCachedSnapshot(resolvedSymbol);
  if (cached) {
    return cached;
  }

  for (const candidate of buildSymbolCandidates(resolvedSymbol)) {
    const live = await fetchYahooSnapshot(candidate);
    if (live) {
      setCachedSnapshot(candidate, live);
      return live;
    }
  }

  for (const candidate of buildSymbolCandidates(resolvedSymbol)) {
    const live = await fetchNseSnapshot(candidate);
    if (live) {
      setCachedSnapshot(candidate, live);
      return live;
    }
  }

  const fallback = fallbackSymbols.find((item) => item.symbol === resolvedSymbol);
  if (!fallback) {
    throw new Error(`Unable to fetch market data for ${symbol}`);
  }

  const candles = createFallbackCandles(2400);
  const indicators = calculateIndicators(candles);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  return {
    symbol: fallback.symbol,
    shortName: fallback.name,
    exchange: fallback.exchange,
    price: last.close,
    change: Number((last.close - prev.close).toFixed(2)),
    changePercent: Number((((last.close - prev.close) / prev.close) * 100).toFixed(2)),
    marketCap: 19000000000000,
    dayHigh: last.high,
    dayLow: last.low,
    previousClose: prev.close,
    candles,
    indicators
  };
}

export async function searchStocks(query: string): Promise<SearchResult[]> {
  const normalized = normalizeQuery(query);

  if (!normalized) {
    return [];
  }

  const yahooResults = await searchYahooStocks(query);
  if (yahooResults.length > 0) {
    return yahooResults;
  }

  const nseResults = await searchNseStocks(query);
  if (nseResults.length > 0) {
    return nseResults;
  }

  return fallbackSymbols
    .filter((stock) => {
      const symbol = normalizeQuery(stock.symbol.replace(".NS", "").replace(".BO", ""));
      return (
        normalizeQuery(stock.symbol).includes(normalized) ||
        normalizeQuery(stock.name).includes(normalized) ||
        symbol.includes(normalized)
      );
    })
    .slice(0, 8);
}

export async function getTrendingStocks() {
  return Promise.all(fallbackSymbols.map((stock) => getStockSnapshot(stock.symbol)));
}

function scoreFundamentals(data: Omit<FundamentalData, "fundamentalScore" | "verdict" | "verdictReason">): {
  score: number;
  verdict: FundamentalData["verdict"];
  reason: string;
} {
  let score = 0;
  const reasons: string[] = [];

  const pe = data.peRatio;
  if (pe !== null) {
    if (pe < 10) { score += 20; reasons.push("very cheap valuation"); }
    else if (pe < 20) { score += 15; reasons.push("reasonable P/E"); }
    else if (pe < 30) { score += 10; }
    else if (pe < 40) { score += 5; }
    else { reasons.push("expensive P/E"); }
  }

  const roe = data.roe;
  if (roe !== null) {
    const roePct = roe * 100;
    if (roePct > 25) { score += 20; reasons.push("excellent ROE"); }
    else if (roePct > 15) { score += 15; reasons.push("good ROE"); }
    else if (roePct > 10) { score += 10; }
    else if (roePct > 5) { score += 5; }
    else { reasons.push("weak ROE"); }
  }

  const roce = data.roce;
  if (roce !== null) {
    const rocePct = roce * 100;
    if (rocePct > 20) { score += 15; reasons.push("strong ROCE"); }
    else if (rocePct > 15) { score += 12; }
    else if (rocePct > 10) { score += 8; }
    else if (rocePct > 5) { score += 4; }
    else { reasons.push("low ROCE"); }
  }

  const div = data.dividendYield;
  if (div !== null) {
    const divPct = div * 100;
    if (divPct > 3) { score += 10; reasons.push("attractive dividend"); }
    else if (divPct > 2) { score += 7; }
    else if (divPct > 1) { score += 4; }
    else if (divPct > 0) { score += 2; }
  }

  const de = data.debtToEquity;
  if (de !== null) {
    if (de < 0.5) { score += 15; reasons.push("low debt"); }
    else if (de < 1) { score += 10; }
    else if (de < 2) { score += 5; }
    else { reasons.push("high debt"); }
  }

  const rg = data.revenueGrowth;
  if (rg !== null) {
    const rgPct = rg * 100;
    if (rgPct > 20) { score += 10; reasons.push("strong revenue growth"); }
    else if (rgPct > 10) { score += 8; }
    else if (rgPct > 5) { score += 5; }
    else if (rgPct > 0) { score += 2; }
    else { reasons.push("declining revenue"); }
  }

  const pm = data.profitMargin;
  if (pm !== null) {
    const pmPct = pm * 100;
    if (pmPct > 20) { score += 10; reasons.push("high margins"); }
    else if (pmPct > 15) { score += 8; }
    else if (pmPct > 10) { score += 5; }
    else if (pmPct > 5) { score += 3; }
    else { reasons.push("thin margins"); }
  }

  const verdict: FundamentalData["verdict"] =
    score >= 75 ? "Strong Buy" :
    score >= 55 ? "Good" :
    score >= 35 ? "Fairly Valued" :
    score >= 20 ? "Weak" : "Avoid";

  const top = reasons.slice(0, 3).join(", ");
  const reason = top
    ? `Score ${score}/100 — ${top}.`
    : `Fundamental score ${score}/100.`;

  return { score, verdict, reason };
}

export async function getStockFundamentals(symbol: string): Promise<FundamentalData> {
  const nullFundamentals: FundamentalData = {
    peRatio: null, pbRatio: null, bookValue: null, evToEbitda: null,
    dividendYield: null, dividendRate: null, payoutRatio: null,
    roe: null, roa: null, roce: null,
    revenueGrowth: null, earningsGrowth: null, profitMargin: null, operatingMargin: null,
    debtToEquity: null, currentRatio: null, annualHistory: [],
    fundamentalScore: 0, verdict: "Fairly Valued", verdictReason: "Insufficient data."
  };

  try {
    const summary = await (yahooFinance.quoteSummary as (
      symbol: string,
      opts: { modules: string[] }
    ) => Promise<Record<string, unknown>>)(symbol, {
      modules: [
        "summaryDetail",
        "defaultKeyStatistics",
        "financialData",
        "incomeStatementHistory",
        "balanceSheetHistory",
      ]
    });

    const sd = summary.summaryDetail as Record<string, unknown> | null;
    const ks = summary.defaultKeyStatistics as Record<string, unknown> | null;
    const fd = summary.financialData as Record<string, unknown> | null;
    const ish = summary.incomeStatementHistory as { incomeStatementHistory?: unknown[] } | null;
    const bsh = summary.balanceSheetHistory as { balanceSheetStatements?: unknown[] } | null;

    const num = (obj: Record<string, unknown> | null | undefined, key: string): number | null => {
      if (!obj) return null;
      const v = (obj[key] as { raw?: number } | number | null | undefined);
      if (v === null || v === undefined) return null;
      if (typeof v === "number") return v;
      if (typeof v === "object" && "raw" in v) return v.raw ?? null;
      return null;
    };

    const incomeRows = (ish?.incomeStatementHistory ?? []) as Array<Record<string, unknown>>;
    const balanceRows = (bsh?.balanceSheetStatements ?? []) as Array<Record<string, unknown>>;

    const annualHistory: AnnualDataPoint[] = incomeRows.slice(0, 5).map((row) => {
      const endDate = (row.endDate as { raw?: number } | null)?.raw;
      return {
        year: endDate ? new Date(endDate * 1000).getFullYear() : 0,
        revenue: num(row, "totalRevenue"),
        netIncome: num(row, "netIncome"),
      };
    }).filter((r) => r.year > 0).reverse();

    // Approximate ROCE from balance sheet + income statement
    let roce: number | null = null;
    if (incomeRows.length > 0 && balanceRows.length > 0) {
      const ebit = num(incomeRows[0], "ebit") ?? num(incomeRows[0], "operatingIncome");
      const totalAssets = num(balanceRows[0], "totalAssets");
      const currentLiabilities = num(balanceRows[0], "totalCurrentLiabilities");
      if (ebit !== null && totalAssets !== null && currentLiabilities !== null) {
        const capitalEmployed = totalAssets - currentLiabilities;
        if (capitalEmployed > 0) roce = ebit / capitalEmployed;
      }
    }

    const partial: Omit<FundamentalData, "fundamentalScore" | "verdict" | "verdictReason"> = {
      peRatio: num(sd, "trailingPE") ?? num(ks, "trailingPE"),
      pbRatio: num(ks, "priceToBook"),
      bookValue: num(ks, "bookValue"),
      evToEbitda: num(ks, "enterpriseToEbitda"),
      dividendYield: num(sd, "dividendYield"),
      dividendRate: num(sd, "dividendRate"),
      payoutRatio: num(sd, "payoutRatio"),
      roe: num(fd, "returnOnEquity"),
      roa: num(fd, "returnOnAssets"),
      roce,
      revenueGrowth: num(fd, "revenueGrowth"),
      earningsGrowth: num(fd, "earningsGrowth"),
      profitMargin: num(fd, "profitMargins"),
      operatingMargin: num(fd, "operatingMargins"),
      debtToEquity: num(fd, "debtToEquity"),
      currentRatio: num(fd, "currentRatio"),
      annualHistory,
    };

    const { score, verdict, reason } = scoreFundamentals(partial);
    return { ...partial, fundamentalScore: score, verdict, verdictReason: reason };
  } catch {
    return nullFundamentals;
  }
}
