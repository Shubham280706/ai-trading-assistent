"""
Daily Indian Market Brief — main entry point.
Run directly for a one-shot execution, or via scheduler.py for daily automation.
"""
import asyncio
import logging
import sys
from datetime import date
from typing import Any

from rich.console import Console
from rich.table import Table

console = Console()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("market_brief.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)


def _build_readable_summary(brief: dict[str, Any]) -> str:
    lines = [f"📊 Daily Market Brief (India) — {brief['date']}\n"]
    for item in brief.get("top_5", []):
        emoji = {"Positive": "🟢", "Negative": "🔴", "Neutral": "⚪"}.get(item["sentiment"], "⚪")
        lines.append(f"  {emoji} {item['company']}: {item['summary']} ({item['sentiment']})")
    lines.append("\n── All High-Signal News ──")
    for item in brief.get("top_news", []):
        emoji = {"Positive": "🟢", "Negative": "🔴", "Neutral": "⚪"}.get(item["sentiment"], "⚪")
        lines.append(f"  {emoji} [{item['category']}] {item['company']}: {item['summary']}")
    return "\n".join(lines)


async def run_pipeline() -> dict[str, Any]:
    from scrapers import fetch_nse_data, fetch_bse_data, fetch_rss_news, fetch_google_news
    from processor import process_news
    from storage import save_brief
    from notifier import deliver

    today = date.today().isoformat()
    console.print(f"[bold cyan]▶ Starting daily market brief pipeline — {today}[/bold cyan]")

    # ── 1. Fetch data from all sources ────────────────────────────────────────
    console.print("[dim]Fetching NSE data…[/dim]")
    nse_items = fetch_nse_data()

    console.print("[dim]Fetching BSE data…[/dim]")
    bse_items = fetch_bse_data()

    console.print("[dim]Fetching RSS feeds…[/dim]")
    rss_items = fetch_rss_news()

    console.print("[dim]Fetching Google News…[/dim]")
    gn_items = fetch_google_news()

    raw_all = nse_items + bse_items + rss_items + gn_items
    console.print(f"[green]Total raw items collected: {len(raw_all)}[/green]")

    # ── 2. Process ────────────────────────────────────────────────────────────
    console.print("[dim]Processing & ranking…[/dim]")
    processed = process_news(raw_all)
    top5 = processed[:5]

    brief: dict[str, Any] = {
        "date": today,
        "total_raw": len(raw_all),
        "total_processed": len(processed),
        "top_5": [item.to_dict() for item in top5],
        "top_news": [item.to_dict() for item in processed],
        "readable_summary": _build_readable_summary({
            "date": today,
            "top_5": [item.to_dict() for item in top5],
            "top_news": [item.to_dict() for item in processed],
        }),
    }

    # ── 3. Display in terminal ────────────────────────────────────────────────
    table = Table(title=f"📊 Market Brief — {today}", show_lines=True)
    table.add_column("Company", style="bold white", max_width=22)
    table.add_column("Category", style="cyan", max_width=26)
    table.add_column("Sentiment", max_width=10)
    table.add_column("Summary", max_width=60)
    table.add_column("Source", style="dim", max_width=20)

    for item in processed:
        sentiment_style = {"Positive": "green", "Negative": "red", "Neutral": "white"}.get(
            item.sentiment, "white"
        )
        table.add_row(
            item.company[:22],
            item.category,
            f"[{sentiment_style}]{item.sentiment}[/{sentiment_style}]",
            item.summary[:60],
            item.source[:20],
        )

    console.print(table)

    # ── 4. Save ───────────────────────────────────────────────────────────────
    json_path = save_brief(brief)
    console.print(f"[green]✓ Brief saved to {json_path}[/green]")

    # ── 5. Deliver ────────────────────────────────────────────────────────────
    await deliver(brief)
    console.print("[bold green]✓ Pipeline complete.[/bold green]")
    return brief


def main() -> None:
    asyncio.run(run_pipeline())


if __name__ == "__main__":
    main()
