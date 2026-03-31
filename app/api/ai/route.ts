import { NextRequest, NextResponse } from "next/server";

import { getAiPayload, getNewsDigest } from "@/services/ai";
import { getStockSnapshot } from "@/services/market";
import { getStockNews } from "@/services/news";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  const [stock, news] = await Promise.all([getStockSnapshot(symbol), getStockNews(symbol)]);
  const [aiPayload, newsDigest] = await Promise.all([getAiPayload(stock, news), getNewsDigest(symbol, news)]);

  return NextResponse.json({
    ...aiPayload,
    newsDigest
  });
}
