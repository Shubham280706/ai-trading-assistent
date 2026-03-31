"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriceChart } from "@/components/stock/price-chart";
import { formatCurrency, formatIndianCompactCurrency, formatPercent } from "@/lib/utils";
import { useToastStore } from "@/hooks/use-toast-store";
import type { AiRecommendation, NewsItem, StockSnapshot } from "@/lib/types";

export function StockDetailClient({
  symbol,
  stock,
  news,
  recommendation,
  newsDigest
}: {
  symbol: string;
  stock: StockSnapshot;
  news: NewsItem[];
  recommendation: AiRecommendation;
  newsDigest: string;
}) {
  const { push } = useToastStore();
  const [liveStock, setLiveStock] = useState(stock);
  const [liveNews, setLiveNews] = useState(news);
  const [liveRecommendation, setLiveRecommendation] = useState(recommendation);
  const [liveDigest, setLiveDigest] = useState(newsDigest);

  useEffect(() => {
    const load = async () => {
      try {
        const [stockResponse, newsResponse, analysisResponse] = await Promise.all([
          fetch(`/api/stocks/${encodeURIComponent(symbol)}`),
          fetch(`/api/news?symbol=${encodeURIComponent(symbol)}`),
          fetch(`/api/analyze?symbol=${encodeURIComponent(symbol)}`)
        ]);

        if (stockResponse.ok) {
          const stockPayload = (await stockResponse.json()) as { stock: StockSnapshot };
          setLiveStock(stockPayload.stock);
        }

        if (newsResponse.ok) {
          const newsPayload = (await newsResponse.json()) as { news: NewsItem[] };
          setLiveNews(newsPayload.news);
        }

        if (analysisResponse.ok) {
          const analysisPayload = (await analysisResponse.json()) as {
            recommendation: AiRecommendation;
            newsDigest: string;
          };
          setLiveRecommendation(analysisPayload.recommendation);
          setLiveDigest(analysisPayload.newsDigest);
        }
      } catch {
        return;
      }
    };

    void load();

    const timer = setInterval(() => {
      void load();
    }, 20000);

    return () => clearInterval(timer);
  }, [symbol]);

  const addToWatchlist = useCallback(async () => {
    const response = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: liveStock.symbol, name: liveStock.shortName })
    });
    push({
      title: response.ok ? "Stock saved" : "Sign in required",
      description: response.ok
        ? `${liveStock.shortName} was added to your watchlist.`
        : "Please sign in with Google to save watchlist items."
    });
  }, [liveStock.shortName, liveStock.symbol, push]);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-primary/80">{liveStock.exchange}</p>
              <h1 className="mt-2 text-4xl font-semibold text-white">{liveStock.shortName}</h1>
              <p className="mt-1 text-base text-secondary">{liveStock.symbol}</p>
            </div>
            <Button onClick={() => void addToWatchlist()}>
              <Star className="mr-2 h-4 w-4" />
              Add to watchlist
            </Button>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
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
              label="Previous close"
              value={liveStock.previousClose ? formatCurrency(liveStock.previousClose) : "N/A"}
            />
          </div>
          <div className="mt-8">
            <PriceChart candles={liveStock.candles} />
          </div>
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.25em] text-accent/80">AI recommendation</p>
          <div className="mt-4 grid gap-3">
            <SignalPill label="Short-term" value={liveRecommendation.shortTerm} />
            <SignalPill label="Long-term" value={liveRecommendation.longTerm} />
            <SignalPill label="Sentiment" value={liveRecommendation.sentiment} neutralLabel />
          </div>
          <div className="mt-5 rounded-2xl border border-border bg-white/[0.03] p-4">
            <p className="text-sm text-muted">Confidence</p>
            <p className="mt-1 text-2xl font-semibold text-white">{liveRecommendation.confidence}%</p>
          </div>
          <p className="mt-5 text-sm leading-7 text-muted">{liveRecommendation.reason}</p>
          <p className="mt-5 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-rose-100">
            This is not financial advice. Use AI output as a research aid, not a replacement for judgment.
          </p>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <p className="text-sm uppercase tracking-[0.25em] text-secondary/80">Technical indicators</p>
          <div className="mt-5 grid gap-3">
            <IndicatorRow label="RSI" value={liveStock.indicators.rsi.toFixed(2)} />
            <IndicatorRow label="MA 50" value={formatCurrency(liveStock.indicators.ma50)} />
            <IndicatorRow label="MA 200" value={formatCurrency(liveStock.indicators.ma200)} />
            <IndicatorRow label="MACD" value={liveStock.indicators.macd.toFixed(2)} />
          </div>
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.25em] text-primary/80">Latest news</p>
          <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/10 p-4">
            <p className="text-sm leading-7 text-teal-50">{liveDigest}</p>
          </div>
          <div className="mt-5 grid gap-4">
            {liveNews.map((item, index) => (
              <motion.a
                whileHover={{ y: -2 }}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                key={`${item.url}-${index}`}
                className="rounded-3xl border border-border bg-white/[0.03] p-4 transition hover:border-primary/30"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-secondary">{item.source}</p>
                  <p className="text-xs text-muted">
                    {new Date(item.publishedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <h3 className="mt-2 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted">{item.summary}</p>
                <p className="mt-3 text-sm text-primary">Sentiment score: {item.sentimentScore.toFixed(2)}</p>
              </motion.a>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <div className="rounded-2xl border border-border bg-white/[0.03] p-4">
      <p className="text-sm text-muted">{label}</p>
      <p
        className={`mt-2 break-words text-xl font-semibold ${
          tone === "positive" ? "text-primary" : tone === "negative" ? "text-danger" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function IndicatorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-white/[0.03] px-4 py-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function SignalPill({
  label,
  value,
  neutralLabel = false
}: {
  label: string;
  value: string;
  neutralLabel?: boolean;
}) {
  const color = neutralLabel
    ? "bg-secondary/15 text-secondary"
    : value === "Buy"
      ? "bg-primary/15 text-primary"
      : value === "Sell"
        ? "bg-danger/15 text-danger"
        : "bg-white/10 text-white";

  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-white/[0.03] px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className={`rounded-full px-3 py-1 text-sm font-medium ${color}`}>{value}</span>
    </div>
  );
}
