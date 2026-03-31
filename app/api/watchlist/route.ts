import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ items: [] });
  }

  const items = await prisma.watchlist.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { symbol?: string; name?: string; exchange?: string };
  if (!body.symbol || !body.name) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const item = await prisma.watchlist.upsert({
    where: {
      userId_symbol: {
        userId: session.user.id,
        symbol: body.symbol
      }
    },
    create: {
      symbol: body.symbol,
      name: body.name,
      exchange: body.exchange ?? "NSE",
      userId: session.user.id
    },
    update: {
      name: body.name,
      exchange: body.exchange ?? "NSE"
    }
  });

  return NextResponse.json({ item });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  await prisma.watchlist.deleteMany({
    where: {
      userId: session.user.id,
      symbol
    }
  });

  return NextResponse.json({ success: true });
}
