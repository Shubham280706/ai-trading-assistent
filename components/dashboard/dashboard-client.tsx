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
        body: JSON.stringify({ symbol, name })
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
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="relative overflow-hidden">
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="relative">
            <p className="text-sm uppercase tracking-[0.3em] text-primary/80">Market cockpit</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
              AI-guided Indian equities dashboard for confident daily decisions.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              Track NSE and BSE names, combine technicals with news sentiment, and review buy, sell,
              or hold signals in one premium workspace.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex flex-1 items-center gap-3 rounded-2xl border border-border bg-white/5 px-4 py-3">
                <Search className="h-4 w-4 text-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Search RELIANCE.NS, TCS, INFY..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-muted"
                />
              </div>
              <Button onClick={() => void onSearch()}>Search</Button>
            </div>
          </motion.div>
        </Card>
        <Card className="flex flex-col justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-secondary/80">Risk reminder</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">This is not financial advice</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Signals are generated from indicators and AI interpretation. Always validate with your own
              research and risk management.
            </p>
          </div>
          <div className="mt-6 grid gap-3">
            <Insight label="Signals refresh" value="Every 15 sec" />
            <Insight label="Indicators" value="RSI, MA50, MA200, MACD" />
            <Insight label="News intelligence" value="Top 5 headlines + AI summary" />
          </div>
        </Card>
      </section>

      {results.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Search results</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {results.map((stock) => (
              <Card key={stock.symbol} className="space-y-4">
                <div>
                  <p className="text-sm text-muted">{stock.exchange}</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{stock.name}</h3>
                  <p className="text-sm text-secondary">{stock.symbol}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/stock/${encodeURIComponent(stock.symbol)}`} className="flex-1">
                    <Button className="w-full" variant="secondary">
                      View
                    </Button>
                  </Link>
                  <Button onClick={() => void addToWatchlist(stock.symbol, stock.name)}>
                    <Star className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {searchAttempted && results.length === 0 ? (
        <Card>
          <p className="text-sm uppercase tracking-[0.25em] text-muted">Search results</p>
          <h2 className="mt-2 text-xl font-semibold text-white">No matching NSE or BSE stock found</h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            Try a full symbol like <span className="text-white">RELIANCE.NS</span> or a company name like
            <span className="text-white"> Infosys</span>.
          </p>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-primary/80">Trending stocks</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Market overview</h2>
            </div>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {(data?.stocks ?? Array.from({ length: 4 })).map((stock, index) =>
              stock ? (
                <Link href={`/stock/${encodeURIComponent(stock.symbol)}`} key={stock.symbol}>
                  <motion.div whileHover={{ y: -4 }} className="rounded-3xl border border-border bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted">{stock.exchange}</p>
                        <h3 className="mt-1 text-lg font-semibold text-white">{stock.shortName}</h3>
                        <p className="text-sm text-secondary">{stock.symbol}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted" />
                    </div>
                    <div className="mt-6 flex items-end justify-between">
                      <p className="text-2xl font-semibold text-white">{formatCurrency(stock.price)}</p>
                      <p className={stock.changePercent >= 0 ? "text-primary" : "text-danger"}>
                        {formatPercent(stock.changePercent)}
                      </p>
                    </div>
                  </motion.div>
                </Link>
              ) : (
                <div key={index} className="h-36 animate-pulse rounded-3xl border border-border bg-white/5" />
              )
            )}
          </div>
          {loading ? <p className="mt-4 text-sm text-muted">Loading live market tiles...</p> : null}
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.25em] text-accent/80">Watchlist preview</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Fast access</h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            Save your highest conviction names and monitor AI signals from the watchlist page.
          </p>
          <Link href="/watchlist" className="mt-6 block">
            <Button className="w-full">Open watchlist</Button>
          </Link>
        </Card>
      </section>
    </div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-white/[0.03] px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}
