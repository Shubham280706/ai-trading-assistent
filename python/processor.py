"""
Processes raw news items: deduplication, categorization, sentiment, company extraction, ranking.
"""
import logging
import re
from dataclasses import dataclass, field, asdict
from datetime import date
from typing import Any

from rapidfuzz import fuzz

logger = logging.getLogger(__name__)

# ── Category keyword mapping ──────────────────────────────────────────────────
_CATEGORY_PATTERNS: list[tuple[str, list[str]]] = [
    ("Quarterly / Annual Results", [
        "q1", "q2", "q3", "q4", "quarterly", "annual result", "earnings",
        "profit", "revenue", "net income", "ebitda", "pat", "quarterly result",
        "financial result", "q4 result", "q3 result",
    ]),
    ("Dividends", ["dividend", "divid", "final dividend", "interim dividend", "special dividend"]),
    ("Bonus / Stock Splits", ["bonus share", "stock split", "share split", "sub-division", "rights issue"]),
    ("Mergers & Acquisitions", [
        "merger", "acquisition", "acqui", "amalgamation", "takeover",
        "demerger", "stake sale", "buyout", "joint venture", "jv",
    ]),
    ("Large Orders / Contracts", [
        "order win", "order worth", "contract win", "secured order", "awarded contract",
        "bag order", "wins order", "wins contract", "large order", "major order",
        "crore order", "billion contract",
    ]),
    ("Promoter Activity", [
        "promoter buy", "promoter sell", "promoter stake", "insider buy",
        "insider sell", "promoter increase", "promoter decrease",
    ]),
    ("Bulk / Block Deals", ["bulk deal", "block deal", "bulk trade", "block trade"]),
    ("Regulatory / Fraud", [
        "sebi", "fraud", "scam", "investigate", "penalty", "notice",
        "regulatory action", "enforcement", "criminal", "fir", "arrested",
        "money laundering", "rbi action", "nclt", "nclat",
    ]),
    ("IPO / Listing", ["ipo", "listing", "public offering", "draft red herring", "drhp", "allotment"]),
    ("Policy / Government", [
        "government policy", "budget", "gst", "import duty", "export ban",
        "government contract", "pli scheme", "ministry", "policy change",
    ]),
]

# ── High-impact keyword scoring ───────────────────────────────────────────────
_HIGH_IMPACT_KEYWORDS: list[tuple[str, int]] = [
    ("fraud", 30), ("sebi", 25), ("investigation", 25), ("penalty", 20),
    ("profit jump", 20), ("profit surge", 20), ("loss", 15), ("order worth", 20),
    ("acquisition", 18), ("merger", 18), ("dividend", 12), ("buyback", 12),
    ("ipo", 15), ("block deal", 10), ("bulk deal", 10), ("promoter", 8),
    ("quarterly result", 15), ("q4", 10), ("earnings beat", 20), ("miss estimate", 18),
    ("bankruptcy", 25), ("default", 22), ("upgrade", 12), ("downgrade", 12),
    ("record high", 10), ("record low", 10), ("bonus share", 10), ("stock split", 10),
    ("arrest", 28), ("criminal", 28), ("suspended", 20), ("delistment", 22),
    ("rights issue", 12), ("stake sale", 15), ("jv", 8), ("joint venture", 10),
]

# ── Sentiment words ───────────────────────────────────────────────────────────
_POSITIVE = [
    "profit", "surge", "jump", "growth", "gain", "beat", "exceed", "record",
    "strong", "bullish", "buy", "upgrade", "win", "award", "dividend",
    "bonus", "expand", "rise", "up", "positive", "approve", "launched",
]
_NEGATIVE = [
    "loss", "fall", "drop", "decline", "miss", "fraud", "sebi", "penalty",
    "investigation", "arrest", "sell", "downgrade", "default", "bankrupt",
    "cancel", "suspended", "negative", "fine", "reject", "concern", "risk",
    "resign", "delist", "crash", "plunge", "weak",
]

# ── Known Indian stock tickers ────────────────────────────────────────────────
_KNOWN_TICKERS: dict[str, str] = {
    "tcs": "TCS.NS", "reliance": "RELIANCE.NS", "ril": "RELIANCE.NS",
    "infosys": "INFY.NS", "infy": "INFY.NS", "wipro": "WIPRO.NS",
    "hdfc bank": "HDFCBANK.NS", "hdfcbank": "HDFCBANK.NS",
    "icici bank": "ICICIBANK.NS", "sbi": "SBIN.NS", "state bank": "SBIN.NS",
    "bajaj finance": "BAJFINANCE.NS", "kotak": "KOTAKBANK.NS",
    "axis bank": "AXISBANK.NS", "maruti": "MARUTI.NS", "larsen": "LT.NS",
    "l&t": "LT.NS", "hcl": "HCLTECH.NS", "tech mahindra": "TECHM.NS",
    "titan": "TITAN.NS", "nestle": "NESTLEIND.NS", "adani": "ADANIENT.NS",
    "tata motors": "TATAMOTORS.NS", "tata steel": "TATASTEEL.NS",
    "tata power": "TATAPOWER.NS", "tata consultancy": "TCS.NS",
    "sun pharma": "SUNPHARMA.NS", "cipla": "CIPLA.NS", "dr reddy": "DRREDDY.NS",
    "divis": "DIVISLAB.NS", "bharti airtel": "BHARTIARTL.NS", "airtel": "BHARTIARTL.NS",
    "ultratech": "ULTRACEMCO.NS", "asian paints": "ASIANPAINT.NS",
    "hindustan unilever": "HINDUNILVR.NS", "hul": "HINDUNILVR.NS",
    "indusind": "INDUSINDBK.NS", "power grid": "POWERGRID.NS",
    "ntpc": "NTPC.NS", "ongc": "ONGC.NS", "coal india": "COALINDIA.NS",
    "bajaj auto": "BAJAJ-AUTO.NS", "hero motocorp": "HEROMOTOCO.NS",
    "m&m": "M&M.NS", "mahindra": "M&M.NS", "jio": "RELIANCE.NS",
    "zomato": "ZOMATO.NS", "paytm": "PAYTM.NS", "nykaa": "NYKAA.NS",
}


@dataclass
class NewsItem:
    company: str
    ticker: str
    category: str
    sentiment: str
    sentiment_score: float
    summary: str
    title: str
    source: str
    url: str
    date: str
    importance_score: int
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _categorize(text: str, hint: str = "") -> str:
    combined = (hint + " " + text).lower()
    for category, keywords in _CATEGORY_PATTERNS:
        if any(kw in combined for kw in keywords):
            return category
    return "Market News"


def _sentiment(text: str) -> tuple[str, float]:
    t = text.lower()
    pos = sum(1 for w in _POSITIVE if w in t)
    neg = sum(1 for w in _NEGATIVE if w in t)
    if pos > neg:
        score = min(1.0, (pos - neg) * 0.2 + 0.2)
        return "Positive", round(score, 2)
    if neg > pos:
        score = max(-1.0, -(neg - pos) * 0.2 - 0.2)
        return "Negative", round(score, 2)
    return "Neutral", 0.0


def _importance_score(text: str, category: str) -> int:
    score = 0
    t = text.lower()
    for keyword, weight in _HIGH_IMPACT_KEYWORDS:
        if keyword in t:
            score += weight
    # bonus for high-priority categories
    priority_bonus = {
        "Quarterly / Annual Results": 15,
        "Mergers & Acquisitions": 20,
        "Regulatory / Fraud": 25,
        "Large Orders / Contracts": 12,
        "IPO / Listing": 15,
        "Dividends": 8,
    }
    score += priority_bonus.get(category, 0)
    return score


def _extract_company_and_ticker(raw: dict[str, Any]) -> tuple[str, str]:
    company = raw.get("company", "").strip()
    ticker = raw.get("ticker", "").strip()
    if company and ticker:
        return company, ticker

    title = raw.get("title", "") + " " + raw.get("summary", "")
    t_lower = title.lower()
    for name, sym in _KNOWN_TICKERS.items():
        if name in t_lower:
            if not company:
                company = name.title()
            if not ticker:
                ticker = sym
            break

    # Try extracting ticker-like patterns (ALL CAPS 2-10 chars)
    if not ticker:
        match = re.search(r"\b([A-Z]{2,10})\b", title)
        if match:
            ticker = f"{match.group(1)}.NS"

    return company or "Multiple Companies", ticker


def _deduplicate(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: list[str] = []
    unique: list[dict[str, Any]] = []
    for item in items:
        title = item.get("title", "")
        is_dup = any(fuzz.token_sort_ratio(title, s) > 82 for s in seen)
        if not is_dup:
            seen.append(title)
            unique.append(item)
    return unique


def process_news(raw_items: list[dict[str, Any]]) -> list[NewsItem]:
    today = date.today().isoformat()
    deduped = _deduplicate(raw_items)
    logger.info("After deduplication: %d / %d items", len(deduped), len(raw_items))

    results: list[NewsItem] = []
    for raw in deduped:
        text = raw.get("title", "") + " " + raw.get("summary", "")
        category = _categorize(text, raw.get("category_hint", ""))
        sentiment_label, sentiment_score = _sentiment(text)
        score = _importance_score(text, category)
        company, ticker = _extract_company_and_ticker(raw)

        results.append(NewsItem(
            company=company,
            ticker=ticker,
            category=category,
            sentiment=sentiment_label,
            sentiment_score=sentiment_score,
            summary=raw.get("summary", raw.get("title", ""))[:200],
            title=raw.get("title", ""),
            source=raw.get("source", ""),
            url=raw.get("url", ""),
            date=raw.get("raw_date", today),
            importance_score=score,
        ))

    # Sort by importance descending
    results.sort(key=lambda x: x.importance_score, reverse=True)

    # Keep top 50 high-signal items
    filtered = [r for r in results if r.importance_score > 0][:50]
    if not filtered:
        filtered = results[:20]

    return filtered
