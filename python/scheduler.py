"""
APScheduler daemon — runs the market brief pipeline every day at 9:30 AM IST.
Start with: python scheduler.py
"""
import asyncio
import logging
import signal
import sys

import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from rich.console import Console

from config import SCHEDULE_HOUR, SCHEDULE_MINUTE, TIMEZONE

console = Console()
logger = logging.getLogger(__name__)


def _run_job() -> None:
    from main import run_pipeline
    asyncio.run(run_pipeline())


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler("scheduler.log", encoding="utf-8"),
        ],
    )

    tz = pytz.timezone(TIMEZONE)
    scheduler = BackgroundScheduler(timezone=tz)
    scheduler.add_job(
        _run_job,
        trigger=CronTrigger(
            hour=SCHEDULE_HOUR,
            minute=SCHEDULE_MINUTE,
            timezone=tz,
        ),
        id="market_brief",
        name="Daily Market Brief",
        misfire_grace_time=600,   # allow up to 10 min late start
        coalesce=True,
    )

    scheduler.start()
    console.print(
        f"[bold green]✓ Scheduler started[/bold green] — "
        f"running every day at [cyan]{SCHEDULE_HOUR:02d}:{SCHEDULE_MINUTE:02d} IST[/cyan]"
    )
    console.print("[dim]Press Ctrl+C to stop.[/dim]")

    def _shutdown(signum: int, frame: object) -> None:
        console.print("\n[yellow]Shutting down scheduler…[/yellow]")
        scheduler.shutdown(wait=False)
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    # Keep the main thread alive
    try:
        import time
        while True:
            time.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown(wait=False)


if __name__ == "__main__":
    main()
