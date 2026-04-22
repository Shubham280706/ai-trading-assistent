import { NextRequest, NextResponse } from "next/server";

import { getStockFundamentals } from "@/services/market";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  const fundamentals = await getStockFundamentals(symbol);
  return NextResponse.json({ fundamentals });
}
