"""
Persists daily market briefs as JSON files and auto-pushes to GitHub
so the Vercel deployment can serve them from the repository filesystem.
"""
import json
import logging
import subprocess
import sqlite3
from datetime import date
from pathlib import Path
from typing import Any

from config import DATA_DIR

logger = logging.getLogger(__name__)

_DB_PATH = DATA_DIR / "market_briefs.db"
# Resolve the repo root (two levels above python/)
_REPO_ROOT = Path(__file__).resolve().parent.parent


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


def _git_push(json_path: Path, brief_date: str) -> None:
    """Commit the brief JSON and push so Vercel auto-redeploys."""
    rel = json_path.relative_to(_REPO_ROOT)
    try:
        subprocess.run(["git", "add", str(rel)], cwd=_REPO_ROOT, check=True)
        result = subprocess.run(
            ["git", "diff", "--cached", "--quiet"],
            cwd=_REPO_ROOT,
        )
        if result.returncode == 0:
            logger.info("Git: nothing new to commit for %s", brief_date)
            return
        subprocess.run(
            ["git", "commit", "-m", f"data: market brief {brief_date} [skip ci]"],
            cwd=_REPO_ROOT,
            check=True,
        )
        subprocess.run(["git", "push", "origin", "main"], cwd=_REPO_ROOT, check=True)
        logger.info("Git: pushed market_brief_%s.json → Vercel will redeploy", brief_date)
    except subprocess.CalledProcessError as exc:
        logger.warning("Git push failed (brief still saved locally): %s", exc)


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

    # 3. Push to GitHub → triggers Vercel redeploy
    _git_push(json_path, today)

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
