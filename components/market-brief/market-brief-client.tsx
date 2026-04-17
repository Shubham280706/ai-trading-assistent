"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Calendar, ExternalLink, Newspaper, Star } from "lucide-react";
import type { MarketBrief, MarketBriefItem } from "@/lib/types";
import { Card } from "@/components/ui/card";

const CATEGORY_COLORS: Record<string, string> = {
  "Quarterly / Annual Results": "text-blue-400 bg-blue-400/10 border-blue-400/20",
  "Dividends": "text-green-400 bg-green-400/10 border-green-400/20",
  "Bonus / Stock Splits": "text-teal-400 bg-teal-400/10 border-teal-400/20",
  "Mergers & Acquisitions": "text-purple-400 bg-purple-400/10 border-purple-400/20",
  "Large Orders / Contracts": "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  "Promoter Activity": "text-orange-400 bg-orange-400/10 border-orange-400/20",
  "Bulk / Block Deals": "text-pink-400 bg-pink-400/10 border-pink-400/20",
  "Regulatory / Fraud": "text-red-400 bg-red-400/10 border-red-400/20",
  "IPO / Listing": "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
  "Policy / Government": "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
};

function SentimentBadge({ sentiment }: { sentiment: string }) {
  if (sentiment === "Positive") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-400/30 bg-green-400/10 px-2 py-0.5 text-xs font-medium text-green-400">
        <TrendingUp className="h-3 w-3" /> Positive
      </span>
    );
  }
  if (sentiment === "Negative") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-xs font-medium text-red-400">
        <TrendingDown className="h-3 w-3" /> Negative
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-400">
      <Minus className="h-3 w-3" /> Neutral
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_COLORS[category] ?? "text-slate-400 bg-slate-400/10 border-slate-400/20";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {category}
    </span>
  );
}

function NewsCard({ item, rank }: { item: MarketBriefItem; rank?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 transition hover:bg-white/8"
    >
      {rank != null && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-sm font-bold text-primary">
          {rank}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start gap-2">
          <span className="font-semibold text-white">{item.company}</span>
          {item.ticker && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-muted">{item.ticker}</span>
          )}
          <SentimentBadge sentiment={item.sentiment} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <CategoryBadge category={item.category} />
        </div>
        <p className="text-sm leading-relaxed text-slate-300">{item.summary}</p>
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span>{item.source}</span>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition hover:text-primary"
            >
              Read more <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Newspaper className="h-8 w-8 text-primary/60" />
      </div>
      <div>
        <p className="text-lg font-semibold text-white">No market brief available yet</p>
        <p className="mt-1 text-sm text-muted">
          Run the Python service to generate today&apos;s brief.
        </p>
        <code className="mt-3 block rounded-xl border border-border bg-white/5 px-4 py-2 font-mono text-xs text-primary">
          cd python &amp;&amp; pip install -r requirements.txt &amp;&amp; python main.py
        </code>
      </div>
    </div>
  );
}

type Props = {
  initialBrief: MarketBrief | null;
  availableDates: string[];
};

const CATEGORIES = [
  "All",
  "Quarterly / Annual Results",
  "Dividends",
  "Bonus / Stock Splits",
  "Mergers & Acquisitions",
  "Large Orders / Contracts",
  "Regulatory / Fraud",
  "Bulk / Block Deals",
  "Promoter Activity",
  "IPO / Listing",
];

const SENTIMENTS = ["All", "Positive", "Negative", "Neutral"];

export function MarketBriefClient({ initialBrief, availableDates }: Props) {
  const [brief, setBrief] = useState<MarketBrief | null>(initialBrief);
  const [selectedDate, setSelectedDate] = useState<string>(availableDates[0] ?? "");
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeSentiment, setActiveSentiment] = useState("All");
  const [activeTab, setActiveTab] = useState<"top5" | "all">("top5");

  const loadDate = useCallback(async (d: string) => {
    if (!d || d === selectedDate) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/market-brief?date=${d}`);
      if (res.ok) {
        const payload = await res.json() as { brief: MarketBrief };
        setBrief(payload.brief);
        setSelectedDate(d);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const allNews = brief?.top_news ?? [];
  const filtered = allNews.filter((item) => {
    const catOk = activeCategory === "All" || item.category === activeCategory;
    const sentOk = activeSentiment === "All" || item.sentiment === activeSentiment;
    return catOk && sentOk;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-primary/80">Market Intelligence</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Daily Market Brief</h1>
          <p className="mt-1 text-sm text-muted">
            Automated daily digest of high-impact Indian stock market news
          </p>
        </div>

        {availableDates.length > 0 && (
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-white/5 px-3 py-2">
            <Calendar className="h-4 w-4 text-muted" />
            <select
              value={selectedDate}
              onChange={(e) => void loadDate(e.target.value)}
              className="bg-transparent text-sm text-white outline-none"
            >
              {availableDates.map((d) => (
                <option key={d} value={d} className="bg-slate-900">
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!brief ? (
        <EmptyState />
      ) : (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Sources Scraped", value: brief.total_raw, icon: "📡" },
              { label: "High-Signal Items", value: brief.total_processed, icon: "🎯" },
              {
                label: "Positive Signals",
                value: brief.top_news.filter((n) => n.sentiment === "Positive").length,
                icon: "🟢",
              },
              {
                label: "Negative Signals",
                value: brief.top_news.filter((n) => n.sentiment === "Negative").length,
                icon: "🔴",
              },
            ].map((stat) => (
              <Card key={stat.label} className="text-center">
                <p className="text-2xl">{stat.icon}</p>
                <p className="mt-1 text-xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-muted">{stat.label}</p>
              </Card>
            ))}
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 rounded-2xl border border-border bg-white/5 p-1 w-fit">
            {(["top5", "all"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab ? "bg-primary text-slate-950" : "text-muted hover:text-white"
                }`}
              >
                {tab === "top5" ? (
                  <span className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5" /> Top 5 Stories
                  </span>
                ) : (
                  "All News"
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "top5" ? (
              <motion.div key="top5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="space-y-3">
                  {brief.top_5.map((item, i) => (
                    <NewsCard key={i} item={item} rank={i + 1} />
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div key="all" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {/* Filters */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {SENTIMENTS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setActiveSentiment(s)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          activeSentiment === s
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-border text-muted hover:text-white"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setActiveCategory(c)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          activeCategory === c
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-border text-muted hover:text-white"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12 text-muted">Loading…</div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted">{filtered.length} items</p>
                    {filtered.map((item, i) => (
                      <NewsCard key={i} item={item} />
                    ))}
                    {filtered.length === 0 && (
                      <p className="py-8 text-center text-sm text-muted">No items match the selected filters.</p>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
