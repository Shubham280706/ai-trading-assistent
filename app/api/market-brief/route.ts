import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { MarketBrief } from "@/lib/types";

export const dynamic = "force-dynamic";

function getBriefPath(date: string): string {
  // Reads from python/data/ — Python service writes JSON files there
  const dataDir = path.join(process.cwd(), "python", "data");
  return path.join(dataDir, `market_brief_${date}.json`);
}

function getAvailableDates(): string[] {
  try {
    const dataDir = path.join(process.cwd(), "python", "data");
    if (!fs.existsSync(dataDir)) return [];
    return fs
      .readdirSync(dataDir)
      .filter((f) => f.startsWith("market_brief_") && f.endsWith(".json"))
      .map((f) => f.replace("market_brief_", "").replace(".json", ""))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get("date");
  const listOnly = request.nextUrl.searchParams.get("list") === "true";

  if (listOnly) {
    return NextResponse.json({ dates: getAvailableDates() });
  }

  const dates = getAvailableDates();
  const targetDate = dateParam ?? dates[0];

  if (!targetDate) {
    return NextResponse.json(
      {
        error: "No market brief available yet. Run the Python service to generate one.",
        hint: "cd python && python main.py",
      },
      { status: 404 }
    );
  }

  const filePath = getBriefPath(targetDate);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: `No brief found for ${targetDate}` },
      { status: 404 }
    );
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const brief = JSON.parse(raw) as MarketBrief;
    return NextResponse.json({ brief, availableDates: dates });
  } catch {
    return NextResponse.json({ error: "Failed to parse brief" }, { status: 500 });
  }
}
