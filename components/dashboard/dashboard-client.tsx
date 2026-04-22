"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyboardEvent, useCallback, useState } from "react";
import { ArrowRight, Search, Sparkles, Star } from "lucide-react";

import { Card } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { usePolling } from "@/hooks/use-polling";
import { useToastStore } from "@/hooks/use-toast-store";
import type { StockSnapshot } from "@/lib/types";
import { Button } from "@/components/ui/button";

async function fetchTrending() {
  const response = await fetch("/api/stocks/trending");
  return (await response.json()) as { stocks: StockSnapshot[] };
}

export function DashboardClient() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ symbol: string; name: string; exchange: string }>>([]);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const { push } = useToastStore();
  const { data, loading } = usePolling(fetchTrending, 15000);

  const onSearch = useCallback(async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setSearchAttempted(false);
      return;
    }
    const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(trimmedQuery)}`);
    const payload = (await response.json()) as {
      results: Array<{ symbol: string; name: string; exchange: string }>;
    };
    setResults(payload.results);
    setSearchAttempted(true);
    if (payload.results.length > 0) {
      router.push(`/stock/${encodeURIComponent(payload.results[0].symbol)}`);
      return;
    }
    router.push(`/stock/${encodeURIComponent(trimmedQuery.toUpperCase())}`);
  }, [query, router]);

  const onSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void onSearch();
      }
    },
    [onSearch]
  );

  const addToWatchlist = useCallback(
    async (symbol: string, name: string) => {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, name }),
      });
      if (response.ok) {
        push({ title: "Added to watchlist", description: `${name} is now being tracked.` });
      } else {
        push({ title: "Sign in required", description: "Google login is needed to save your watchlist." });
      }
    },
    [push]
  );

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* ── Hero + risk card ── */}
      <section className="grid gap-4 sm:gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="relative overflow-hidden">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/20 blur-3xl sm:h-56 sm:w-56" />
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="relative">
            <p className="text-xs uppercase tracking-[0.3em] text-primary/80 sm:text-sm">Market cockpit</p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight text-white sm:mt-3 sm:text-4xl lg:text-5xl">
              AI-guided Indian equities dashboard.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted sm:mt-4 sm:text-base sm:leading-7">
              Track NSE and BSE names, combine technicals with news sentiment, and review buy, sell,
              or hold signals in one premium workspace.
            </p>
            {/* Search */}
            <div className="mt-5 flex flex-col gap-2 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <div className="flex flex-1 items-center gap-3 rounded-2xl border border-border bg-white/5 px-4 py-3">
                <Search className="h-4 w-4 shrink-0 text-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Search RELIANCE.NS, TCS, INFY…"
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-muted"
                />
              </div>
              <Button onClick={() => void onSearch()} className="w-full sm:w-auto">
                Search
              </Button>
            </div>
          </motion.div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-secondary/80 sm:text-sm">Risk reminder</p>
            <h2 className="mt-2 text-xl font-semibold text-white sm:mt-3 sm:text-2xl">
              Not financial advice
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted sm:mt-3 sm:leading-7">
              Signals are generated from indicators and AI interpretation. Always validate with your own
              research and risk management.
            </p>
          </div>
          <div className="mt-4 grid gap-2 sm:mt-6 sm:gap-3">
            <Insight label="Signals refresh" value="Every 15 sec" />
            <Insight label="Indicators" value="P/E, Book Value, Dividend, ROE, ROCE" />
            <Insight label="News intelligence" value="Top 5 + AI summary" />
          </div>
        </Card>
      </section>

      {/* ── Search results ── */}
      {results.length > 0 && (
        <section className="space-y-3 sm:space-y-4">
          <h2 className="text-lg font-semibold text-white sm:text-xl">Search results</h2>
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {results.map((stock) => (
              <Card key={stock.symbol} className="space-y-4">
                <div>
                  <p className="text-xs text-muted sm:text-sm">{stock.exchange}</p>
                  <h3 className="mt-1 text-base font-semibold text-white sm:mt-2 sm:text-lg">{stock.name}</h3>
                  <p className="text-sm text-secondary">{stock.symbol}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/stock/${encodeURIComponent(stock.symbol)}`} className="flex-1">
                    <Button className="w-full" variant="secondary">View</Button>
                  </Link>
                  <Button onClick={() => void addToWatchlist(stock.symbol, stock.name)}>
                    <Star className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {searchAttempted && results.length === 0 && (
        <Card>
          <p className="text-xs uppercase tracking-[0.25em] text-muted sm:text-sm">Search results</p>
          <h2 className="mt-2 text-lg font-semibold text-white sm:text-xl">No matching stock found</h2>
          <p className="mt-2 text-sm leading-6 text-muted sm:mt-3 sm:leading-7">
            Try a full symbol like <span className="text-white">RELIANCE.NS</span> or a company name like{" "}
            <span className="text-white">Infosys</span>.
          </p>
        </Card>
      )}

      {/* ── Market overview ── */}
      <section className="grid gap-4 sm:gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-primary/80 sm:text-sm">Trending stocks</p>
              <h2 className="mt-1 text-xl font-semibold text-white sm:mt-2 sm:text-2xl">Market overview</h2>
            </div>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4">
            {(data?.stocks ?? Array.from({ length: 4 })).map((stock, index) =>
              stock ? (
                <Link href={`/stock/${encodeURIComponent(stock.symbol)}`} key={stock.symbol}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="rounded-2xl border border-border bg-white/[0.03] p-3 sm:rounded-3xl sm:p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted">{stock.exchange}</p>
                        <h3 className="mt-0.5 truncate text-sm font-semibold text-white sm:mt-1 sm:text-lg">
                          {stock.shortName}
                        </h3>
                        <p className="truncate text-xs text-secondary">{stock.symbol}</p>
                      </div>
                      <ArrowRight className="ml-1 h-3.5 w-3.5 shrink-0 text-muted sm:h-4 sm:w-4" />
                    </div>
                    <div className="mt-3 flex items-end justify-between sm:mt-6">
                      <p className="text-base font-semibold text-white sm:text-2xl">
                        {formatCurrency(stock.price)}
                      </p>
                      <p className={`text-sm font-medium ${stock.changePercent >= 0 ? "text-primary" : "text-danger"}`}>
                        {formatPercent(stock.changePercent)}
                      </p>
                    </div>
                  </motion.div>
                </Link>
              ) : (
                <div key={index} className="h-28 animate-pulse rounded-2xl border border-border bg-white/5 sm:h-36 sm:rounded-3xl" />
              )
            )}
          </div>
          {loading && <p className="mt-3 text-xs text-muted sm:mt-4 sm:text-sm">Loading live market tiles…</p>}
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-[0.25em] text-accent/80 sm:text-sm">Watchlist preview</p>
          <h2 className="mt-1 text-xl font-semibold text-white sm:mt-2 sm:text-2xl">Fast access</h2>
          <p className="mt-2 text-sm leading-6 text-muted sm:mt-3 sm:leading-7">
            Save your highest conviction names and monitor AI signals from the watchlist page.
          </p>
          <Link href="/watchlist" className="mt-5 block sm:mt-6">
            <Button className="w-full">Open watchlist</Button>
          </Link>
        </Card>
      </section>
    </div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-white/[0.03] px-3 py-2.5 sm:px-4 sm:py-3">
      <span className="text-xs text-muted sm:text-sm">{label}</span>
      <span className="text-xs font-medium text-white sm:text-sm">{value}</span>
    </div>
  );
}
