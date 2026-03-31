import { notFound } from "next/navigation";

import { StockDetailClient } from "@/components/stock/stock-detail-client";
import { getAiRecommendation, getNewsDigest } from "@/services/ai";
import { getStockSnapshot, resolveMarketSymbol } from "@/services/market";
import { getStockNews } from "@/services/news";

export default async function StockDetailPage({
  params
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;

  try {
    const decodedSymbol = decodeURIComponent(symbol);
    const resolvedSymbol = (await resolveMarketSymbol(decodedSymbol)) ?? decodedSymbol;
    const [stock, news] = await Promise.all([getStockSnapshot(resolvedSymbol), getStockNews(resolvedSymbol)]);
    const [recommendation, newsDigest] = await Promise.all([
      getAiRecommendation(stock, news),
      getNewsDigest(resolvedSymbol, news)
    ]);

    return (
      <StockDetailClient
        symbol={resolvedSymbol}
        stock={stock}
        news={news}
        recommendation={recommendation}
        newsDigest={newsDigest}
      />
    );
  } catch {
    notFound();
  }
}
