"""
NSE India scraper — corporate actions, bulk deals, block deals, announcements.
NSE requires establishing a browser-like session first to get valid cookies.
"""
import logging
from datetime import date

import httpx

from config import BROWSER_HEADERS, NSE_JSON_HEADERS
from scrapers.base import RawNewsItem, make_client, safe_get

logger = logging.getLogger(__name__)

_NSE_BASE = "https://www.nseindia.com"


def _get_nse_session() -> httpx.Client:
    """Warm up an NSE session by hitting the homepage to get cookies."""
    client = make_client(headers=BROWSER_HEADERS, timeout=30.0)
    try:
        client.get(f"{_NSE_BASE}/", timeout=20)
        client.get(f"{_NSE_BASE}/market-data/live-equity-market", timeout=20)
    except Exception as exc:
        logger.warning("NSE session warm-up failed: %s", exc)
    client.headers.update(NSE_JSON_HEADERS)
    return client


def _fetch_corporate_actions(client: httpx.Client, today: str) -> list[RawNewsItem]:
    url = f"{_NSE_BASE}/api/corporates-corporateActions?index=equities"
    try:
        resp = safe_get(client, url)
        rows = resp.json()
        items: list[RawNewsItem] = []
        for row in rows[:50]:
            symbol = row.get("symbol", "")
            subject = row.get("subject", "")
            ex_date = row.get("exDate", "")
            record_date = row.get("recordDate", "")
            body = row.get("body", subject)
            if not symbol or not subject:
                continue
            items.append({
                "company": row.get("companyName", symbol),
                "ticker": f"{symbol}.NS",
                "title": f"{symbol}: {subject}",
                "summary": body[:200] if body else subject,
                "source": "NSE India",
                "url": f"https://www.nseindia.com/companies-listing/corporate-filings-actions",
                "raw_date": ex_date or record_date or today,
                "category_hint": _categorize_action(subject),
            })
        return items
    except Exception as exc:
        logger.warning("NSE corporate actions failed: %s", exc)
        return []


def _fetch_bulk_deals(client: httpx.Client, today: str) -> list[RawNewsItem]:
    url = f"{_NSE_BASE}/api/snapshot-capital-market-traded-securities?key=bulkDeals"
    try:
        resp = safe_get(client, url)
        data = resp.json()
        rows = data.get("data", data) if isinstance(data, dict) else data
        items: list[RawNewsItem] = []
        for row in rows[:30]:
            symbol = row.get("symbol", "")
            client_name = row.get("clientName", "Unknown")
            buy_sell = row.get("buySell", "")
            qty = row.get("tradeQuantity", 0)
            price = row.get("tradePrice", 0)
            if not symbol:
                continue
            action = "bought" if buy_sell.upper() == "BUY" else "sold"
            items.append({
                "company": row.get("companyName", symbol),
                "ticker": f"{symbol}.NS",
                "title": f"Bulk Deal: {client_name} {action} {qty:,} shares of {symbol} @ ₹{price}",
                "summary": f"{client_name} {action} {qty:,} shares at ₹{price} per share.",
                "source": "NSE Bulk Deals",
                "url": "https://www.nseindia.com/market-data/bulk-block-deals",
                "raw_date": today,
                "category_hint": "Bulk / Block Deals",
            })
        return items
    except Exception as exc:
        logger.warning("NSE bulk deals failed: %s", exc)
        return []


def _fetch_block_deals(client: httpx.Client, today: str) -> list[RawNewsItem]:
    url = f"{_NSE_BASE}/api/snapshot-capital-market-traded-securities?key=blockDeals"
    try:
        resp = safe_get(client, url)
        data = resp.json()
        rows = data.get("data", data) if isinstance(data, dict) else data
        items: list[RawNewsItem] = []
        for row in rows[:20]:
            symbol = row.get("symbol", "")
            client_name = row.get("clientName", "Unknown")
            buy_sell = row.get("buySell", "")
            qty = row.get("tradeQuantity", 0)
            price = row.get("tradePrice", 0)
            if not symbol:
                continue
            action = "bought" if buy_sell.upper() == "BUY" else "sold"
            items.append({
                "company": row.get("companyName", symbol),
                "ticker": f"{symbol}.NS",
                "title": f"Block Deal: {client_name} {action} {qty:,} shares of {symbol} @ ₹{price}",
                "summary": f"Block deal — {client_name} {action} {qty:,} shares at ₹{price}.",
                "source": "NSE Block Deals",
                "url": "https://www.nseindia.com/market-data/bulk-block-deals",
                "raw_date": today,
                "category_hint": "Bulk / Block Deals",
            })
        return items
    except Exception as exc:
        logger.warning("NSE block deals failed: %s", exc)
        return []


def _fetch_announcements(client: httpx.Client, today: str) -> list[RawNewsItem]:
    url = f"{_NSE_BASE}/api/corporate-announcements?index=equities&from_date=&to_date=&symbol=&issuer=&subject=&desc="
    try:
        resp = safe_get(client, url)
        rows = resp.json()
        items: list[RawNewsItem] = []
        for row in rows[:60]:
            symbol = row.get("symbol", "")
            subject = row.get("subject", "")
            desc = row.get("desc", subject)
            an_date = row.get("an_dt", today)
            if not symbol or not subject:
                continue
            items.append({
                "company": row.get("company", symbol),
                "ticker": f"{symbol}.NS",
                "title": f"{symbol}: {subject}",
                "summary": desc[:200] if desc else subject,
                "source": "NSE Announcements",
                "url": "https://www.nseindia.com/companies-listing/corporate-filings-announcements",
                "raw_date": an_date or today,
                "category_hint": _categorize_action(subject),
            })
        return items
    except Exception as exc:
        logger.warning("NSE announcements failed: %s", exc)
        return []


def _categorize_action(text: str) -> str:
    t = text.lower()
    if any(w in t for w in ["dividend", "divid"]):
        return "Dividends"
    if any(w in t for w in ["bonus", "split", "stock split", "sub-division"]):
        return "Bonus / Stock Splits"
    if any(w in t for w in ["merger", "acquisition", "amalgamation", "takeover", "demerger"]):
        return "Mergers & Acquisitions"
    if any(w in t for w in ["result", "q1", "q2", "q3", "q4", "quarterly", "annual", "earnings"]):
        return "Quarterly / Annual Results"
    if any(w in t for w in ["order", "contract", "win", "award"]):
        return "Large Orders / Contracts"
    if any(w in t for w in ["promoter", "insider"]):
        return "Promoter Activity"
    if any(w in t for w in ["sebi", "fraud", "investigate", "penalty", "notice", "legal", "regulator"]):
        return "Regulatory / Fraud"
    return "Corporate Announcement"


def fetch_nse_data() -> list[RawNewsItem]:
    today = date.today().isoformat()
    client = _get_nse_session()
    items: list[RawNewsItem] = []
    items.extend(_fetch_corporate_actions(client, today))
    items.extend(_fetch_announcements(client, today))
    items.extend(_fetch_bulk_deals(client, today))
    items.extend(_fetch_block_deals(client, today))
    logger.info("NSE: fetched %d raw items", len(items))
    return items
