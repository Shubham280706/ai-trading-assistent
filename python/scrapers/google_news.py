"""
Google News RSS scraper for targeted Indian market queries.
"""
import logging
from datetime import date
from email.utils import parsedate_to_datetime
from urllib.parse import quote

import feedparser

from scrapers.base import RawNewsItem

logger = logging.getLogger(__name__)

_QUERIES = [
    "NSE BSE India stock market",
    "India corporate earnings results quarterly",
    "SEBI order penalty India",
    "India stock dividend bonus split",
    "India merger acquisition deal",
    "India block deal bulk deal promoter",
    "India IPO listing NSE BSE",
]


def _parse_date(entry: feedparser.FeedParserDict) -> str:
    try:
        if entry.get("published"):
            return parsedate_to_datetime(entry["published"]).date().isoformat()
    except Exception:
        pass
    return date.today().isoformat()


def fetch_google_news() -> list[RawNewsItem]:
    today = date.today().isoformat()
    items: list[RawNewsItem] = []

    for query in _QUERIES:
        try:
            url = f"https://news.google.com/rss/search?q={quote(query)}&hl=en-IN&gl=IN&ceid=IN:en"
            feed = feedparser.parse(url)
            for entry in feed.entries[:10]:
                title = entry.get("title", "").strip()
                link = entry.get("link", "")
                pub_date = _parse_date(entry)
                source_match = title.rsplit(" - ", 1)
                source = source_match[-1] if len(source_match) > 1 else "Google News"
                clean_title = source_match[0] if len(source_match) > 1 else title

                items.append({
                    "company": "",
                    "ticker": "",
                    "title": clean_title,
                    "summary": clean_title,
                    "source": source,
                    "url": link,
                    "raw_date": pub_date,
                    "category_hint": "",
                })
        except Exception as exc:
            logger.warning("Google News query '%s' failed: %s", query, exc)

    logger.info("Google News: fetched %d raw items", len(items))
    return items
