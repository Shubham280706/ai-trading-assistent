import { NextRequest, NextResponse } from "next/server";

import { getStockSnapshot } from "@/services/market";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  const stock = await getStockSnapshot(symbol);
  return NextResponse.json({ stock });
}
