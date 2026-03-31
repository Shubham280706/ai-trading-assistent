import { NextResponse } from "next/server";

import { getTrendingStocks } from "@/services/market";

export const dynamic = "force-dynamic";

export async function GET() {
  const stocks = await getTrendingStocks();
  return NextResponse.json({ stocks });
}
