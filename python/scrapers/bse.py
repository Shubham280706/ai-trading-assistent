"""
BSE India scraper — corporate filings and announcements.
"""
import logging
from datetime import date, timedelta

from config import BROWSER_HEADERS
from scrapers.base import RawNewsItem, make_client, safe_get

logger = logging.getLogger(__name__)

_BSE_API = "https://api.bseindia.com/BseIndiaAPI/api"


def _categorize(subject: str) -> str:
    t = subject.lower()
    if any(w in t for w in ["dividend"]):
        return "Dividends"
    if any(w in t for w in ["bonus", "split", "sub-division"]):
        return "Bonus / Stock Splits"
    if any(w in t for w in ["merger", "acquisition", "amalgamation", "takeover", "demerger"]):
        return "Mergers & Acquisitions"
    if any(w in t for w in ["result", "quarterly", "annual", "earnings", "financial"]):
        return "Quarterly / Annual Results"
    if any(w in t for w in ["order", "contract", "awarded"]):
        return "Large Orders / Contracts"
    if any(w in t for w in ["sebi", "fraud", "penalty", "investigation", "notice"]):
        return "Regulatory / Fraud"
    return "Corporate Announcement"


def _fetch_announcements(today: str, from_date: str) -> list[RawNewsItem]:
    url = (
        f"{_BSE_API}/AnnSubCategoryGetData/w"
        f"?strCat=-1&strPrevDate={from_date}&strScrip=&strSearch=P"
        f"&strToDate={today}&strType=C&subcategory=-1"
    )
    headers = {
        **BROWSER_HEADERS,
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.bseindia.com/",
        "Origin": "https://www.bseindia.com",
    }
    client = make_client(headers=headers)
    try:
        resp = safe_get(client, url)
        data = resp.json()
        rows = data.get("Table", [])
        items: list[RawNewsItem] = []
        for row in rows[:60]:
            scrip_cd = str(row.get("SCRIP_CD", "")).strip()
            long_name = row.get("LONG_NAME", scrip_cd)
            subject = row.get("CATEGORYNAME", "") or row.get("SUBCATNAME", "")
            headline = row.get("HEADLINE", subject)
            news_dt = row.get("NEWS_DT", today)
            if not scrip_cd:
                continue
            items.append({
                "company": long_name,
                "ticker": f"{scrip_cd}.BO",
                "title": f"{long_name}: {headline}",
                "summary": headline[:200],
                "source": "BSE India",
                "url": f"https://www.bseindia.com/corporates/ann.html?scripcd={scrip_cd}",
                "raw_date": news_dt or today,
                "category_hint": _categorize(subject + " " + headline),
            })
        return items
    except Exception as exc:
        logger.warning("BSE announcements failed: %s", exc)
        return []


def fetch_bse_data() -> list[RawNewsItem]:
    today = date.today().isoformat()
    from_date = (date.today() - timedelta(days=1)).isoformat()
    items = _fetch_announcements(today, from_date)
    logger.info("BSE: fetched %d raw items", len(items))
    return items
