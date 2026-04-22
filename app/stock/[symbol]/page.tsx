import { notFound } from "next/navigation";

import { StockDetailClient } from "@/components/stock/stock-detail-client";
import { getAiRecommendation, getNewsDigest } from "@/services/ai";
import { getStockFundamentals, getStockSnapshot, resolveMarketSymbol } from "@/services/market";
import { getStockNews } from "@/services/news";

export default async function StockDetailPage({
  params
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;

  const decodedSymbol = decodeURIComponent(symbol);
  const resolvedSymbol = (await resolveMarketSymbol(decodedSymbol)) ?? decodedSymbol;
  const [stock, news, fundamentals] = await Promise.all([
    getStockSnapshot(resolvedSymbol).catch(() => null),
    getStockNews(resolvedSymbol).catch(() => null),
    getStockFundamentals(resolvedSymbol).catch(() => null),
  ]);

  if (!stock || !news) {
    notFound();
  }

  const [recommendation, newsDigest] = await Promise.all([
    getAiRecommendation(stock, news, fundamentals ?? undefined).catch(() => null),
    getNewsDigest(resolvedSymbol, news).catch(() => null)
  ]);

  if (!recommendation || !newsDigest) {
    notFound();
  }

  return (
    <StockDetailClient
      symbol={resolvedSymbol}
      stock={stock}
      news={news}
      recommendation={recommendation}
      newsDigest={newsDigest}
      fundamentals={fundamentals}
    />
  );
}
