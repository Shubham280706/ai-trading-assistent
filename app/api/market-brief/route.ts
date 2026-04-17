import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import type { MarketBrief } from "@/lib/types";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET — fetch brief for a date (defaults to latest)
export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get("date");
  const listOnly = request.nextUrl.searchParams.get("list") === "true";

  try {
    if (listOnly) {
      const rows = await prisma.marketBrief.findMany({
        select: { date: true },
        orderBy: { date: "desc" },
      });
      return NextResponse.json({ dates: rows.map((r) => r.date) });
    }

    const row = dateParam
      ? await prisma.marketBrief.findUnique({ where: { date: dateParam } })
      : await prisma.marketBrief.findFirst({ orderBy: { date: "desc" } });

    if (!row) {
      return NextResponse.json(
        {
          error: "No market brief available yet. Run the Python service to generate one.",
          hint: "cd python && python main.py",
        },
        { status: 404 }
      );
    }

    const allRows = await prisma.marketBrief.findMany({
      select: { date: true },
      orderBy: { date: "desc" },
    });

    const brief: MarketBrief = {
      date: row.date,
      total_raw: row.totalRaw,
      total_processed: row.totalProcessed,
      top_5: row.top5 as MarketBrief["top_5"],
      top_news: row.topNews as MarketBrief["top_news"],
      readable_summary: row.readableSummary,
    };

    return NextResponse.json({ brief, availableDates: allRows.map((r) => r.date) });
  } catch (err) {
    console.error("market-brief GET error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// POST — called by the Python service to push a brief
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.MARKET_BRIEF_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      date: string;
      total_raw: number;
      total_processed: number;
      top_5: unknown;
      top_news: unknown;
      readable_summary: string;
    };

    const record = await prisma.marketBrief.upsert({
      where: { date: body.date },
      update: {
        totalRaw: body.total_raw,
        totalProcessed: body.total_processed,
        top5: body.top_5 as object[],
        topNews: body.top_news as object[],
        readableSummary: body.readable_summary,
      },
      create: {
        date: body.date,
        totalRaw: body.total_raw,
        totalProcessed: body.total_processed,
        top5: body.top_5 as object[],
        topNews: body.top_news as object[],
        readableSummary: body.readable_summary,
      },
    });

    return NextResponse.json({ ok: true, id: record.id });
  } catch (err) {
    console.error("market-brief POST error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
