import { NextRequest, NextResponse } from "next/server";

import { getStockSnapshot } from "@/services/market";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await context.params;
  const stock = await getStockSnapshot(decodeURIComponent(symbol));
  return NextResponse.json({ stock });
}
