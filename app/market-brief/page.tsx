import { MarketBriefClient } from "@/components/market-brief/market-brief-client";
import { generateMarketBrief } from "@/services/market-brief";

export const dynamic = "force-dynamic";

export default async function MarketBriefPage() {
  let brief = null;
  try {
    brief = await generateMarketBrief();
  } catch { /* client will show empty state */ }

  return <MarketBriefClient initialBrief={brief} availableDates={brief ? [brief.date] : []} />;
}
