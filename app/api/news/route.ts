import { NextRequest, NextResponse } from "next/server";

import { getStockNews } from "@/services/news";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  const news = await getStockNews(symbol);
  return NextResponse.json({ news });
}
