import { MarketBriefClient } from "@/components/market-brief/market-brief-client";
import { generateMarketBrief } from "@/services/market-brief";

export const revalidate = 3600; // ISR: rebuild at most once per hour

export default async function MarketBriefPage() {
  let brief = null;
  try {
    brief = await generateMarketBrief();
  } catch { /* client will retry via API */ }

  return <MarketBriefClient initialBrief={brief} availableDates={brief ? [brief.date] : []} />;
}
