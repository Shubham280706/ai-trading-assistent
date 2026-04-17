"""
RSS feed scrapers for Moneycontrol, Economic Times Markets, and LiveMint.
All three expose public RSS feeds — no scraping needed.
"""
import logging
from datetime import date
from email.utils import parsedate_to_datetime

import feedparser

from scrapers.base import RawNewsItem

logger = logging.getLogger(__name__)

_FEEDS: list[tuple[str, str]] = [
    ("Moneycontrol", "https://www.moneycontrol.com/rss/business.xml"),
    ("Moneycontrol Markets", "https://www.moneycontrol.com/rss/marketreports.xml"),
    ("Economic Times Markets", "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms"),
    ("Economic Times", "https://economictimes.indiatimes.com/rssfeedsdefault.cms"),
    ("LiveMint", "https://www.livemint.com/rss/markets"),
    ("LiveMint Money", "https://www.livemint.com/rss/money"),
    ("Business Standard", "https://www.business-standard.com/rss/markets-106.rss"),
    ("Financial Express", "https://www.financialexpress.com/market/feed/"),
]

_INDIA_KEYWORDS = [
    "nse", "bse", "sensex", "nifty", "sebi", "ril", "tcs", "infy", "wipro",
    "hdfc", "icici", "sbi", "adani", "tata", "bajaj", "kotak", "axis",
    "rupee", "india", "indian", "ipo", "fii", "dii", "rbi", "promoter",
    "crore", "lakh", "dividend", "buyback", "block deal", "bulk deal",
]


def _is_india_relevant(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in _INDIA_KEYWORDS)


def _parse_date(entry: feedparser.FeedParserDict) -> str:
    try:
        if entry.get("published"):
            return parsedate_to_datetime(entry["published"]).date().isoformat()
    except Exception:
        pass
    return date.today().isoformat()


def fetch_rss_news() -> list[RawNewsItem]:
    today = date.today().isoformat()
    items: list[RawNewsItem] = []

    for source_name, feed_url in _FEEDS:
        try:
            feed = feedparser.parse(feed_url)
            count = 0
            for entry in feed.entries[:30]:
                title = entry.get("title", "").strip()
                summary = entry.get("summary", entry.get("description", title)).strip()
                link = entry.get("link", "")
                pub_date = _parse_date(entry)

                combined = title + " " + summary
                if not _is_india_relevant(combined):
                    continue

                items.append({
                    "company": "",
                    "ticker": "",
                    "title": title,
                    "summary": summary[:300],
                    "source": source_name,
                    "url": link,
                    "raw_date": pub_date,
                    "category_hint": "",
                })
                count += 1

            logger.info("%s: %d relevant items", source_name, count)
        except Exception as exc:
            logger.warning("RSS feed %s failed: %s", source_name, exc)

    return items
