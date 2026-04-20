import type { MarketBrief, MarketBriefItem } from "@/lib/types";

const RSS_FEEDS = [
  { name: "Moneycontrol", url: "https://www.moneycontrol.com/rss/business.xml" },
  { name: "ET Markets", url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms" },
  { name: "LiveMint", url: "https://www.livemint.com/rss/markets" },
  { name: "Business Standard", url: "https://www.business-standard.com/rss/markets-106.rss" },
];

const GOOGLE_QUERIES = [
  "NSE BSE India stock market results",
  "India SEBI order penalty fraud",
  "India dividend bonus split IPO",
  "India merger acquisition deal block bulk deal",
];

const INDIA_KW = ["nse","bse","sensex","nifty","sebi","india","indian","rupee","crore","lakh",
  "tcs","infy","reliance","hdfc","icici","sbi","adani","tata","bajaj","dividend","ipo","rbi"];

const CATEGORY_MAP: [string, string[]][] = [
  ["Quarterly / Annual Results", ["result","q1","q2","q3","q4","quarterly","earnings","profit","revenue","pat"]],
  ["Dividends", ["dividend","divid"]],
  ["Bonus / Stock Splits", ["bonus share","stock split","sub-division","rights issue"]],
  ["Mergers & Acquisitions", ["merger","acquisition","amalgamation","takeover","demerger","buyout"]],
  ["Large Orders / Contracts", ["order win","order worth","contract win","awarded","bag order","wins order"]],
  ["Regulatory / Fraud", ["sebi","fraud","penalty","investigation","arrested","money laundering","nclt"]],
  ["Bulk / Block Deals", ["bulk deal","block deal"]],
  ["IPO / Listing", ["ipo","listing","public offering","drhp","allotment"]],
  ["Promoter Activity", ["promoter buy","promoter sell","promoter stake","insider buy"]],
];

const POS_W = ["profit","surge","jump","growth","gain","beat","record","dividend","bonus","win","award","expand","rise"];
const NEG_W = ["loss","fall","drop","fraud","sebi","penalty","arrest","default","bankrupt","cancel","suspend","crash","plunge"];
const IMPACT: [string,number][] = [
  ["fraud",30],["sebi",25],["penalty",20],["profit",15],["loss",15],["acquisition",18],
  ["merger",18],["dividend",12],["ipo",15],["block deal",10],["bulk deal",10],["result",10],
  ["order worth",20],["bankruptcy",25],["arrested",28],["suspended",20],
];

const TICKER_MAP: Record<string, string> = {
  tcs:"TCS.NS", reliance:"RELIANCE.NS", infosys:"INFY.NS", wipro:"WIPRO.NS",
  "hdfc bank":"HDFCBANK.NS", "icici bank":"ICICIBANK.NS", sbi:"SBIN.NS",
  "bajaj finance":"BAJFINANCE.NS", "adani":"ADANIENT.NS", "tata motors":"TATAMOTORS.NS",
  "sun pharma":"SUNPHARMA.NS", "bharti airtel":"BHARTIARTL.NS", zomato:"ZOMATO.NS",
};

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return (m?.[1] ?? m?.[2] ?? "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim();
}

function isIndiaRelevant(text: string): boolean {
  const t = text.toLowerCase();
  return INDIA_KW.some(k => t.includes(k));
}

function categorize(text: string): string {
  const t = text.toLowerCase();
  for (const [cat, kws] of CATEGORY_MAP) {
    if (kws.some(k => t.includes(k))) return cat;
  }
  return "Market News";
}

function sentiment(text: string): { label: "Positive"|"Negative"|"Neutral"; score: number } {
  const t = text.toLowerCase();
  const pos = POS_W.filter(w => t.includes(w)).length;
  const neg = NEG_W.filter(w => t.includes(w)).length;
  if (pos > neg) return { label: "Positive", score: Math.min(1, (pos-neg)*0.2+0.2) };
  if (neg > pos) return { label: "Negative", score: Math.max(-1, -(neg-pos)*0.2-0.2) };
  return { label: "Neutral", score: 0 };
}

function importance(text: string, cat: string): number {
  const t = text.toLowerCase();
  let score = IMPACT.reduce((s,[kw,w]) => t.includes(kw) ? s+w : s, 0);
  const bonus: Record<string,number> = { "Regulatory / Fraud":25,"Mergers & Acquisitions":20,"Quarterly / Annual Results":15,"IPO / Listing":15 };
  return score + (bonus[cat] ?? 0);
}

function extractTicker(text: string): { company: string; ticker: string } {
  const t = text.toLowerCase();
  for (const [name, sym] of Object.entries(TICKER_MAP)) {
    if (t.includes(name)) return { company: name.split(" ").map(w=>w[0].toUpperCase()+w.slice(1)).join(" "), ticker: sym };
  }
  return { company: "India Markets", ticker: "" };
}

async function fetchFeed(name: string, url: string): Promise<{ title: string; summary: string; url: string; source: string }[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 }, headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return [];
    const xml = await res.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,20).flatMap(m => {
      const block = m[1];
      const title = extractTag(block, "title");
      const link = extractTag(block, "link");
      const desc = extractTag(block, "description");
      if (!title || !isIndiaRelevant(title + " " + desc)) return [];
      return [{ title, summary: desc.replace(/<[^>]+>/g,"").slice(0,200), url: link, source: name }];
    });
  } catch { return []; }
}

async function fetchGoogleNews(query: string): Promise<{ title: string; summary: string; url: string; source: string }[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const xml = await res.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,8).map(m => {
      const block = m[1];
      const raw = extractTag(block, "title");
      const parts = raw.split(" - ");
      const source = parts.length > 1 ? parts[parts.length-1] : "Google News";
      const title = parts.length > 1 ? parts.slice(0,-1).join(" - ") : raw;
      return { title, summary: title, url: extractTag(block,"link"), source };
    }).filter(i => i.title && isIndiaRelevant(i.title));
  } catch { return []; }
}

function dedupe(items: { title: string }[]): typeof items {
  const seen: string[] = [];
  return items.filter(item => {
    const t = item.title.toLowerCase().slice(0,60);
    if (seen.some(s => s === t || (s.length>10 && t.includes(s.slice(0,30))))) return false;
    seen.push(t);
    return true;
  });
}

export async function generateMarketBrief(): Promise<MarketBrief> {
  const today = new Date().toISOString().slice(0,10);

  // Fetch all sources in parallel
  const [rssResults, gnResults] = await Promise.all([
    Promise.all(RSS_FEEDS.map(f => fetchFeed(f.name, f.url))),
    Promise.all(GOOGLE_QUERIES.map(q => fetchGoogleNews(q))),
  ]);

  const raw = dedupe([...rssResults.flat(), ...gnResults.flat()]);

  const processed: MarketBriefItem[] = raw.map(item => {
    const text = item.title + " " + item.summary;
    const cat = categorize(text);
    const { label, score } = sentiment(text);
    const { company, ticker } = extractTicker(text);
    return {
      company, ticker, category: cat,
      sentiment: label, sentiment_score: score,
      summary: item.summary || item.title,
      title: item.title, source: item.source, url: item.url,
      date: today,
      importance_score: importance(text, cat),
    };
  }).sort((a,b) => b.importance_score - a.importance_score).slice(0,50);

  return {
    date: today,
    total_raw: raw.length,
    total_processed: processed.length,
    top_5: processed.slice(0,5),
    top_news: processed,
    readable_summary: processed.slice(0,5).map(i =>
      `${i.sentiment === "Positive" ? "🟢" : i.sentiment === "Negative" ? "🔴" : "⚪"} ${i.company}: ${i.summary.slice(0,100)}`
    ).join("\n"),
  };
}
