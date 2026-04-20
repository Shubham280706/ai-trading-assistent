import { NextResponse } from "next/server";
import { generateMarketBrief } from "@/services/market-brief";

// Revalidate every hour so Vercel caches the result but refreshes regularly
export const revalidate = 3600;

export async function GET() {
  try {
    const brief = await generateMarketBrief();
    return NextResponse.json({ brief, availableDates: [brief.date] });
  } catch (err) {
    console.error("market-brief error:", err);
    return NextResponse.json({ error: "Failed to generate brief" }, { status: 500 });
  }
}
