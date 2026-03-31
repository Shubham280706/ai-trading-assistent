import { NextRequest, NextResponse } from "next/server";

import { searchStocks } from "@/services/market";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const results = query ? await searchStocks(query) : [];
  return NextResponse.json({ results });
}
