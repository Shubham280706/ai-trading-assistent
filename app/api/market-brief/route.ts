import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { MarketBrief } from "@/lib/types";

export const dynamic = "force-dynamic";

function dataDir(): string {
  return path.join(process.cwd(), "python", "data");
}

function getAvailableDates(): string[] {
  try {
    const dir = dataDir();
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
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

  const filePath = path.join(dataDir(), `market_brief_${targetDate}.json`);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: `No brief found for ${targetDate}` }, { status: 404 });
  }

  try {
    const brief = JSON.parse(fs.readFileSync(filePath, "utf-8")) as MarketBrief;
    return NextResponse.json({ brief, availableDates: dates });
  } catch {
    return NextResponse.json({ error: "Failed to parse brief" }, { status: 500 });
  }
}
