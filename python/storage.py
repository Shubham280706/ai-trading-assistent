"""
Persists daily market briefs as JSON files, SQLite, and pushes to the Next.js API
so the Vercel deployment can serve them from the database.
"""
import json
import logging
import sqlite3
from datetime import date
from pathlib import Path
from typing import Any

import httpx

from config import DATA_DIR, NEXT_API_KEY, NEXT_API_URL

logger = logging.getLogger(__name__)

_DB_PATH = DATA_DIR / "market_briefs.db"


def _init_db() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS briefs (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            date      TEXT UNIQUE NOT NULL,
            payload   TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    return conn


def _push_to_api(brief: dict[str, Any]) -> None:
    """POST the brief to the Next.js API so Vercel reads from the DB."""
    if not NEXT_API_URL or not NEXT_API_KEY:
        logger.info("NEXT_API_URL/NEXT_API_KEY not set — skipping remote push.")
        return
    url = f"{NEXT_API_URL.rstrip('/')}/api/market-brief"
    try:
        resp = httpx.post(
            url,
            json=brief,
            headers={"x-api-key": NEXT_API_KEY},
            timeout=20,
        )
        resp.raise_for_status()
        logger.info("Brief pushed to API: %s → %s", url, resp.status_code)
    except Exception as exc:
        logger.warning("Failed to push brief to API (%s): %s", url, exc)


def save_brief(brief: dict[str, Any]) -> Path:
    today = brief.get("date", date.today().isoformat())
    json_path = DATA_DIR / f"market_brief_{today}.json"

    # 1. Write local JSON
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(brief, fh, indent=2, ensure_ascii=False)
    logger.info("Brief saved to %s", json_path)

    # 2. Persist in local SQLite
    try:
        conn = _init_db()
        conn.execute(
            "INSERT OR REPLACE INTO briefs (date, payload) VALUES (?, ?)",
            (today, json.dumps(brief, ensure_ascii=False)),
        )
        conn.commit()
        conn.close()
    except Exception as exc:
        logger.warning("SQLite save failed: %s", exc)

    # 3. Push to Next.js API (Vercel)
    _push_to_api(brief)

    return json_path


def load_brief(for_date: str | None = None) -> dict[str, Any] | None:
    target = for_date or date.today().isoformat()
    json_path = DATA_DIR / f"market_brief_{target}.json"
    if json_path.exists():
        with open(json_path, encoding="utf-8") as fh:
            return json.load(fh)
    try:
        conn = _init_db()
        row = conn.execute("SELECT payload FROM briefs WHERE date = ?", (target,)).fetchone()
        conn.close()
        if row:
            return json.loads(row[0])
    except Exception:
        pass
    return None


def list_brief_dates() -> list[str]:
    dates: list[str] = []
    try:
        conn = _init_db()
        rows = conn.execute("SELECT date FROM briefs ORDER BY date DESC").fetchall()
        conn.close()
        dates = [r[0] for r in rows]
    except Exception:
        pass
    for p in sorted(DATA_DIR.glob("market_brief_*.json"), reverse=True):
        d = p.stem.replace("market_brief_", "")
        if d not in dates:
            dates.append(d)
    return dates
