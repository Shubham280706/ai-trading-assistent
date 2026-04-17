import { MarketBriefClient } from "@/components/market-brief/market-brief-client";
import type { MarketBrief } from "@/lib/types";
import fs from "fs";
import path from "path";

async function getLatestBrief(): Promise<{ brief: MarketBrief | null; availableDates: string[] }> {
  try {
    const dataDir = path.join(process.cwd(), "python", "data");
    if (!fs.existsSync(dataDir)) return { brief: null, availableDates: [] };

    const files = fs
      .readdirSync(dataDir)
      .filter((f) => f.startsWith("market_brief_") && f.endsWith(".json"))
      .sort()
      .reverse();

    const dates = files.map((f) => f.replace("market_brief_", "").replace(".json", ""));
    if (files.length === 0) return { brief: null, availableDates: [] };

    const raw = fs.readFileSync(path.join(dataDir, files[0]), "utf-8");
    return { brief: JSON.parse(raw) as MarketBrief, availableDates: dates };
  } catch {
    return { brief: null, availableDates: [] };
  }
}

export default async function MarketBriefPage() {
  const { brief, availableDates } = await getLatestBrief();
  return <MarketBriefClient initialBrief={brief} availableDates={availableDates} />;
}
