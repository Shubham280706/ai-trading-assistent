import type { NewsItem } from "@/lib/types";

const NEWS_CACHE_TTL_MS = 10 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  value: NewsItem[];
};

const newsCache = new Map<string, CacheEntry>();

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function stripCdata(value: string) {
  return value.replace("<![CDATA[", "").replace("]]>", "").trim();
}

function extractTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXml(stripCdata(match[1])) : "";
}

function estimateSentiment(title: string) {
  const positiveWords = ["surge", "gain", "beats", "growth", "buy", "bullish", "up"];
  const negativeWords = ["fall", "drops", "miss", "loss", "sell", "bearish", "down"];
  const normalized = title.toLowerCase();

  const positive = positiveWords.some((word) => normalized.includes(word));
  const negative = negativeWords.some((word) => normalized.includes(word));

  if (positive && !negative) {
    return 0.35;
  }

  if (negative && !positive) {
    return -0.35;
  }

  return 0;
}

function getCachedNews(symbol: string) {
  const cached = newsCache.get(symbol);
  if (!cached || cached.expiresAt < Date.now()) {
    newsCache.delete(symbol);
    return null;
  }

  return cached.value;
}

function setCachedNews(symbol: string, value: NewsItem[]) {
  newsCache.set(symbol, { value, expiresAt: Date.now() + NEWS_CACHE_TTL_MS });
}

function mockNews(symbol: string): NewsItem[] {
  return Array.from({ length: 5 }, (_, index) => ({
    title: `${symbol} market update ${index + 1}`,
    url: "https://news.google.com",
    source: "Google News",
    publishedAt: new Date(Date.now() - index * 3600000).toISOString(),
    sentimentScore: 0,
    summary: `Latest market coverage mentioning ${symbol}.`
  }));
}

export async function getStockNews(symbol: string): Promise<NewsItem[]> {
  const cached = getCachedNews(symbol);
  if (cached) {
    return cached;
  }

  const query = encodeURIComponent(symbol.replace(".NS", "").replace(".BO", ""));

  try {
    const response = await fetch(`https://news.google.com/rss/search?q=${query}+stock`, {
      next: { revalidate: 600 }
    });

    if (!response.ok) {
      return mockNews(symbol);
    }

    const xml = await response.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
      .slice(0, 5)
      .map((match) => {
        const block = match[1];
        const title = extractTag(block, "title");
        const url = extractTag(block, "link");
        const publishedAt = extractTag(block, "pubDate");
        const sourceMatch = title.match(/\s+-\s+([^|-]+)$/);
        const source = sourceMatch?.[1]?.trim() || "Google News";

        return {
          title,
          url,
          source,
          publishedAt: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
          sentimentScore: estimateSentiment(title),
          summary: title
        };
      })
      .filter((item) => item.title && item.url);

    const news = items.length > 0 ? items : mockNews(symbol);
    setCachedNews(symbol, news);
    return news;
  } catch {
    return mockNews(symbol);
  }
}
