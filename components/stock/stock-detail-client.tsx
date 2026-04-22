"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriceChart } from "@/components/stock/price-chart";
import { formatCurrency, formatIndianCompactCurrency, formatPercent } from "@/lib/utils";
import { useToastStore } from "@/hooks/use-toast-store";
import type { AiRecommendation, FundamentalData, NewsItem, StockSnapshot } from "@/lib/types";

export function StockDetailClient({
  symbol, stock, news, recommendation, newsDigest, fundamentals,
}: {
  symbol: string;
  stock: StockSnapshot;
  news: NewsItem[];
  recommendation: AiRecommendation;
  newsDigest: string;
  fundamentals: FundamentalData | null;
}) {
  const { push } = useToastStore();
  const [liveStock, setLiveStock] = useState(stock);
  const [liveNews, setLiveNews] = useState(news);
  const [liveRecommendation, setLiveRecommendation] = useState(recommendation);
  const [liveDigest, setLiveDigest] = useState(newsDigest);
  const [liveFundamentals, setLiveFundamentals] = useState<FundamentalData | null>(fundamentals);

  useEffect(() => {
    const load = async () => {
      try {
        const [stockRes, newsRes, analysisRes] = await Promise.all([
          fetch(`/api/stocks/${encodeURIComponent(symbol)}`),
          fetch(`/api/news?symbol=${encodeURIComponent(symbol)}`),
          fetch(`/api/analyze?symbol=${encodeURIComponent(symbol)}`),
        ]);
        if (stockRes.ok) setLiveStock(((await stockRes.json()) as { stock: StockSnapshot }).stock);
        if (newsRes.ok) setLiveNews(((await newsRes.json()) as { news: NewsItem[] }).news);
        if (analysisRes.ok) {
          const p = (await analysisRes.json()) as { recommendation: AiRecommendation; newsDigest: string };
          setLiveRecommendation(p.recommendation);
          setLiveDigest(p.newsDigest);
        }
      } catch { return; }
    };
    const loadFundamentals = async () => {
      try {
        const res = await fetch(`/api/fundamentals?symbol=${encodeURIComponent(symbol)}`);
        if (res.ok) {
          const p = (await res.json()) as { fundamentals: FundamentalData };
          setLiveFundamentals(p.fundamentals);
        }
      } catch { return; }
    };
    void load();
    void loadFundamentals();
    const timer = setInterval(() => { void load(); }, 20000);
    return () => clearInterval(timer);
  }, [symbol]);

  const addToWatchlist = useCallback(async () => {
    const response = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: liveStock.symbol, name: liveStock.shortName }),
    });
    push({
      title: response.ok ? "Stock saved" : "Sign in required",
      description: response.ok
        ? `${liveStock.shortName} was added to your watchlist.`
        : "Please sign in with Google to save watchlist items.",
    });
  }, [liveStock.shortName, liveStock.symbol, push]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Price header + chart ── */}
      <section className="grid gap-4 sm:gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <Card className="overflow-hidden">
          {/* Stock title row */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.25em] text-primary/80 sm:text-sm">{liveStock.exchange}</p>
              <h1 className="mt-1 text-2xl font-semibold text-white sm:mt-2 sm:text-4xl">{liveStock.shortName}</h1>
              <p className="mt-0.5 text-sm text-secondary">{liveStock.symbol}</p>
            </div>
            <Button onClick={() => void addToWatchlist()} className="shrink-0">
              <Star className="mr-1.5 h-4 w-4 sm:mr-2" />
              <span className="hidden xs:inline">Add to </span>watchlist
            </Button>
          </div>

          {/* Metrics — 2 cols on mobile, 4 on md+ */}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-8 sm:gap-4 md:grid-cols-4">
            <Metric label="Price" value={formatCurrency(liveStock.price)} />
            <Metric
              label="Daily move"
              value={formatPercent(liveStock.changePercent)}
              tone={liveStock.changePercent >= 0 ? "positive" : "negative"}
            />
            <Metric
              label="Market cap"
              value={liveStock.marketCap ? formatIndianCompactCurrency(liveStock.marketCap) : "N/A"}
            />
            <Metric
              label="Prev. close"
              value={liveStock.previousClose ? formatCurrency(liveStock.previousClose) : "N/A"}
            />
          </div>

          <div className="mt-5 sm:mt-8">
            <PriceChart candles={liveStock.candles} />
          </div>
        </Card>

        {/* AI recommendation */}
        <Card>
          <p className="text-xs uppercase tracking-[0.25em] text-accent/80 sm:text-sm">AI recommendation</p>
          <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3">
            <SignalPill label="Short-term" value={liveRecommendation.shortTerm} />
            <SignalPill label="Long-term" value={liveRecommendation.longTerm} />
            <SignalPill label="Sentiment" value={liveRecommendation.sentiment} neutralLabel />
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-white/[0.03] p-3 sm:mt-5 sm:p-4">
            <p className="text-xs text-muted sm:text-sm">Confidence</p>
            <p className="mt-1 text-xl font-semibold text-white sm:text-2xl">{liveRecommendation.confidence}%</p>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted sm:mt-5 sm:leading-7">{liveRecommendation.reason}</p>
          <p className="mt-4 rounded-2xl border border-danger/20 bg-danger/10 px-3 py-2.5 text-xs text-rose-100 sm:mt-5 sm:px-4 sm:py-3 sm:text-sm">
            Not financial advice. Use AI output as a research aid only.
          </p>
        </Card>
      </section>

      {/* ── Indicators + News ── */}
      <section className="grid gap-4 sm:gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <p className="text-xs uppercase tracking-[0.25em] text-secondary/80 sm:text-sm">Technical indicators</p>
          <div className="mt-4 grid gap-2 sm:mt-5 sm:gap-3">
            <IndicatorRow label="RSI" value={liveStock.indicators.rsi.toFixed(2)} />
            <IndicatorRow label="MA 50" value={formatCurrency(liveStock.indicators.ma50)} />
            <IndicatorRow label="MA 200" value={formatCurrency(liveStock.indicators.ma200)} />
            <IndicatorRow label="MACD" value={liveStock.indicators.macd.toFixed(2)} />
          </div>
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-[0.25em] text-primary/80 sm:text-sm">Latest news</p>
          <div className="mt-3 rounded-2xl border border-primary/15 bg-primary/10 p-3 sm:mt-4 sm:p-4">
            <p className="text-sm leading-6 text-teal-50 sm:leading-7">{liveDigest}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-4">
            {liveNews.map((item, index) => (
              <motion.a
                whileHover={{ y: -2 }}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                key={`${item.url}-${index}`}
                className="rounded-2xl border border-border bg-white/[0.03] p-3 transition hover:border-primary/30 sm:rounded-3xl sm:p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-secondary sm:text-sm">{item.source}</p>
                  <p className="text-xs text-muted">
                    {new Date(item.publishedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <h3 className="mt-2 text-sm font-semibold leading-5 text-white sm:text-lg sm:leading-normal">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-muted sm:mt-2 sm:text-sm sm:leading-7">{item.summary}</p>
                <p className="mt-2 text-xs text-primary sm:mt-3 sm:text-sm">
                  Sentiment: {item.sentimentScore.toFixed(2)}
                </p>
              </motion.a>
            ))}
          </div>
        </Card>
      </section>

      {/* ── Fundamentals ── */}
      {liveFundamentals && <FundamentalsSection data={liveFundamentals} />}
    </div>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "positive" | "negative" }) {
  return (
    <div className="rounded-2xl border border-border bg-white/[0.03] p-3 sm:p-4">
      <p className="text-xs text-muted sm:text-sm">{label}</p>
      <p className={`mt-1 break-words text-base font-semibold sm:mt-2 sm:text-xl ${
        tone === "positive" ? "text-primary" : tone === "negative" ? "text-danger" : "text-white"
      }`}>
        {value}
      </p>
    </div>
  );
}

function IndicatorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-white/[0.03] px-3 py-2.5 sm:px-4 sm:py-3">
      <p className="text-xs text-muted sm:text-sm">{label}</p>
      <p className="text-xs font-medium text-white sm:text-sm">{value}</p>
    </div>
  );
}

function SignalPill({ label, value, neutralLabel = false }: { label: string; value: string; neutralLabel?: boolean }) {
  const color = neutralLabel
    ? "bg-secondary/15 text-secondary"
    : value === "Buy" ? "bg-primary/15 text-primary"
    : value === "Sell" ? "bg-danger/15 text-danger"
    : "bg-white/10 text-white";
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-white/[0.03] px-3 py-2.5 sm:px-4 sm:py-3">
      <span className="text-xs text-muted sm:text-sm">{label}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium sm:px-3 sm:py-1 sm:text-sm ${color}`}>{value}</span>
    </div>
  );
}

function fmtPct(v: number | null, decimals = 1) {
  if (v === null) return "N/A";
  return `${(v * 100).toFixed(decimals)}%`;
}

function fmtNum(v: number | null, decimals = 2) {
  if (v === null) return "N/A";
  return v.toFixed(decimals);
}

function fmtRevenue(v: number | null) {
  if (v === null) return "N/A";
  return formatIndianCompactCurrency(v);
}

function verdictColor(verdict: FundamentalData["verdict"]) {
  if (verdict === "Strong Buy") return "bg-primary/20 text-primary border-primary/30";
  if (verdict === "Good") return "bg-teal-500/15 text-teal-300 border-teal-500/30";
  if (verdict === "Fairly Valued") return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
  if (verdict === "Weak") return "bg-orange-500/15 text-orange-300 border-orange-500/30";
  return "bg-danger/15 text-danger border-danger/30";
}

function FundamentalRow({
  label, value, hint,
}: {
  label: string;
  value: string;
  hint?: "good" | "bad" | "neutral";
}) {
  const valueClass =
    hint === "good" ? "text-primary" : hint === "bad" ? "text-danger" : "text-white";
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-white/[0.03] px-3 py-2.5 sm:px-4 sm:py-3">
      <p className="text-xs text-muted sm:text-sm">{label}</p>
      <p className={`text-xs font-medium sm:text-sm ${valueClass}`}>{value}</p>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const clipped = Math.min(100, Math.max(0, score));
  const barColor =
    clipped >= 75 ? "bg-primary" :
    clipped >= 55 ? "bg-teal-400" :
    clipped >= 35 ? "bg-yellow-400" :
    clipped >= 20 ? "bg-orange-400" : "bg-danger";
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${clipped}%` }} />
    </div>
  );
}

function FundamentalsSection({ data }: { data: FundamentalData }) {
  const pe = data.peRatio;
  const peHint = pe === null ? "neutral" : pe < 20 ? "good" : pe > 35 ? "bad" : "neutral";

  const roe = data.roe;
  const roeHint = roe === null ? "neutral" : roe > 0.15 ? "good" : roe < 0.05 ? "bad" : "neutral";

  const roce = data.roce;
  const roceHint = roce === null ? "neutral" : roce > 0.15 ? "good" : roce < 0.05 ? "bad" : "neutral";

  const de = data.debtToEquity;
  const deHint = de === null ? "neutral" : de < 1 ? "good" : de > 2 ? "bad" : "neutral";

  const rg = data.revenueGrowth;
  const rgHint = rg === null ? "neutral" : rg > 0.1 ? "good" : rg < 0 ? "bad" : "neutral";

  const pm = data.profitMargin;
  const pmHint = pm === null ? "neutral" : pm > 0.15 ? "good" : pm < 0.05 ? "bad" : "neutral";

  return (
    <section className="grid gap-4 sm:gap-6 lg:grid-cols-3">
      {/* Valuation + Returns */}
      <Card>
        <p className="text-xs uppercase tracking-[0.25em] text-accent/80 sm:text-sm">Valuation</p>
        <div className="mt-4 grid gap-2 sm:mt-5 sm:gap-3">
          <FundamentalRow label="P/E Ratio" value={fmtNum(data.peRatio, 1)} hint={peHint} />
          <FundamentalRow label="P/B Ratio" value={fmtNum(data.pbRatio, 2)} />
          <FundamentalRow label="Book Value/Share" value={data.bookValue !== null ? `₹${data.bookValue.toFixed(2)}` : "N/A"} />
          <FundamentalRow label="EV/EBITDA" value={fmtNum(data.evToEbitda, 1)} />
          <FundamentalRow label="Dividend Yield" value={fmtPct(data.dividendYield)} hint={data.dividendYield !== null && data.dividendYield > 0.02 ? "good" : "neutral"} />
          <FundamentalRow label="Dividend/Share" value={data.dividendRate !== null ? `₹${data.dividendRate.toFixed(2)}` : "N/A"} />
          <FundamentalRow label="Payout Ratio" value={fmtPct(data.payoutRatio)} />
        </div>
      </Card>

      {/* Returns + Health */}
      <Card>
        <p className="text-xs uppercase tracking-[0.25em] text-secondary/80 sm:text-sm">Returns & Health</p>
        <div className="mt-4 grid gap-2 sm:mt-5 sm:gap-3">
          <FundamentalRow label="ROE" value={fmtPct(data.roe)} hint={roeHint} />
          <FundamentalRow label="ROA" value={fmtPct(data.roa)} />
          <FundamentalRow label="ROCE" value={fmtPct(data.roce)} hint={roceHint} />
          <FundamentalRow label="Profit Margin" value={fmtPct(data.profitMargin)} hint={pmHint} />
          <FundamentalRow label="Operating Margin" value={fmtPct(data.operatingMargin)} />
          <FundamentalRow label="Revenue Growth" value={fmtPct(data.revenueGrowth)} hint={rgHint} />
          <FundamentalRow label="Earnings Growth" value={fmtPct(data.earningsGrowth)} hint={data.earningsGrowth !== null && data.earningsGrowth > 0.1 ? "good" : data.earningsGrowth !== null && data.earningsGrowth < 0 ? "bad" : "neutral"} />
          <FundamentalRow label="Debt / Equity" value={fmtNum(data.debtToEquity, 2)} hint={deHint} />
          <FundamentalRow label="Current Ratio" value={fmtNum(data.currentRatio, 2)} hint={data.currentRatio !== null && data.currentRatio > 1.5 ? "good" : data.currentRatio !== null && data.currentRatio < 1 ? "bad" : "neutral"} />
        </div>
      </Card>

      {/* Score + Historical */}
      <Card>
        <p className="text-xs uppercase tracking-[0.25em] text-primary/80 sm:text-sm">Fundamental score</p>
        <div className="mt-3 flex items-center justify-between sm:mt-4">
          <p className="text-3xl font-bold text-white sm:text-4xl">{data.fundamentalScore}<span className="text-base font-normal text-muted">/100</span></p>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold sm:text-sm ${verdictColor(data.verdict)}`}>
            {data.verdict}
          </span>
        </div>
        <ScoreBar score={data.fundamentalScore} />
        <p className="mt-3 text-xs leading-5 text-muted sm:mt-4 sm:text-sm sm:leading-6">{data.verdictReason}</p>

        {data.annualHistory.length > 0 && (
          <>
            <p className="mt-5 text-xs uppercase tracking-[0.25em] text-muted sm:mt-6">Annual history</p>
            <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3">
              {data.annualHistory.map((row) => (
                <div key={row.year} className="rounded-2xl border border-border bg-white/[0.03] px-3 py-2.5 sm:px-4 sm:py-3">
                  <p className="text-xs font-semibold text-white sm:text-sm">FY {row.year}</p>
                  <div className="mt-1 flex gap-4">
                    <div>
                      <p className="text-[10px] text-muted sm:text-xs">Revenue</p>
                      <p className="text-xs font-medium text-white sm:text-sm">{fmtRevenue(row.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted sm:text-xs">Net Income</p>
                      <p className={`text-xs font-medium sm:text-sm ${row.netIncome !== null && row.netIncome > 0 ? "text-primary" : "text-danger"}`}>
                        {fmtRevenue(row.netIncome)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
