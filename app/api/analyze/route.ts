import { NextRequest, NextResponse } from "next/server";

import { getAiPayload, getNewsDigest } from "@/services/ai";
import { getStockFundamentals, getStockSnapshot } from "@/services/market";
import { getStockNews } from "@/services/news";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  const [stock, news, fundamentals] = await Promise.all([
    getStockSnapshot(symbol),
    getStockNews(symbol),
    getStockFundamentals(symbol).catch(() => undefined),
  ]);
  const [aiPayload, newsDigest] = await Promise.all([getAiPayload(stock, news, fundamentals), getNewsDigest(symbol, news)]);

  const { recommendation, shortTermSignal, longTermSignal, explanation } = aiPayload;

  return NextResponse.json({
    recommendation,
    shortTermSignal,
    longTermSignal,
    explanation,
    newsDigest
  });
}
