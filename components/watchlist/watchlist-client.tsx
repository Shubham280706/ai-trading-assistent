"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useToastStore } from "@/hooks/use-toast-store";

type WatchlistItem = {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
};

type HydratedItem = WatchlistItem & {
  price?: number;
  shortTerm?: string;
};

export function WatchlistClient() {
  const [items, setItems] = useState<HydratedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToastStore();

  const load = useCallback(async () => {
    const response = await fetch("/api/watchlist");
    const payload = (await response.json()) as { items: WatchlistItem[] };
    const enriched = await Promise.all(
      payload.items.map(async (item) => {
        try {
          const stockResponse = await fetch(`/api/stocks/${encodeURIComponent(item.symbol)}`);
          const stockPayload = (await stockResponse.json()) as { stock: { price: number } };
          const aiResponse = await fetch(`/api/analyze?symbol=${encodeURIComponent(item.symbol)}`);
          const aiPayload = (await aiResponse.json()) as { recommendation: { shortTerm: string } };
          return {
            ...item,
            price: stockPayload.stock.price,
            shortTerm: aiPayload.recommendation.shortTerm
          };
        } catch {
          return item;
        }
      })
    );
    setItems(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    const run = () => {
      void load();
    };

    run();
    const timer = setInterval(() => {
      run();
    }, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const removeItem = useCallback(
    async (symbol: string) => {
      const response = await fetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, {
        method: "DELETE"
      });
      if (response.ok) {
        setItems((current) => current.filter((item) => item.symbol !== symbol));
        push({ title: "Removed from watchlist", description: `${symbol} is no longer tracked.` });
      }
    },
    [push]
  );

  if (loading) {
    return <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-3xl border border-border bg-white/5" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-sm uppercase tracking-[0.25em] text-primary/80">Your watchlist</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Tracked stocks</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          Monitor your saved names, their latest prices, and fast AI action signals in one place.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <p className="text-white">No saved stocks yet. Add names from the dashboard or stock detail page.</p>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">{item.exchange}</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">{item.name}</h2>
                  <p className="text-sm text-secondary">{item.symbol}</p>
                </div>
                <button
                  onClick={() => void removeItem(item.symbol)}
                  className="rounded-2xl border border-border bg-white/5 p-2 text-muted transition hover:text-white"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3">
                  <p className="text-sm text-muted">Latest price</p>
                  <p className="mt-1 text-xl font-semibold text-white">
                    {item.price ? formatCurrency(item.price) : "Loading..."}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3">
                  <p className="text-sm text-muted">Quick signal</p>
                  <p className="mt-1 text-lg font-semibold text-primary">{item.shortTerm ?? "Loading..."}</p>
                </div>
              </div>
              <Link href={`/stock/${encodeURIComponent(item.symbol)}`} className="mt-5 block">
                <Button className="w-full" variant="secondary">
                  Open detail
                </Button>
              </Link>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
