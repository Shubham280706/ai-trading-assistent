"""
Persists daily market briefs as JSON files and in a SQLite database.
The Next.js API reads the JSON files directly.
"""
import json
import logging
import sqlite3
from datetime import date
from pathlib import Path
from typing import Any

from config import DATA_DIR

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


def save_brief(brief: dict[str, Any]) -> Path:
    today = brief.get("date", date.today().isoformat())
    json_path = DATA_DIR / f"market_brief_{today}.json"

    # Write JSON (read by Next.js API)
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(brief, fh, indent=2, ensure_ascii=False)
    logger.info("Brief saved to %s", json_path)

    # Also persist in SQLite for historical access
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

    return json_path


def load_brief(for_date: str | None = None) -> dict[str, Any] | None:
    target = for_date or date.today().isoformat()
    json_path = DATA_DIR / f"market_brief_{target}.json"
    if json_path.exists():
        with open(json_path, encoding="utf-8") as fh:
            return json.load(fh)
    # Fallback: check SQLite
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
    """Return all stored brief dates, newest first."""
    dates: list[str] = []
    try:
        conn = _init_db()
        rows = conn.execute("SELECT date FROM briefs ORDER BY date DESC").fetchall()
        conn.close()
        dates = [r[0] for r in rows]
    except Exception:
        pass
    # Also scan JSON files as fallback
    for p in sorted(DATA_DIR.glob("market_brief_*.json"), reverse=True):
        d = p.stem.replace("market_brief_", "")
        if d not in dates:
            dates.append(d)
    return dates
