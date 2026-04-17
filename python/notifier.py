"""
Delivery module: Telegram bot and optional email.
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from config import (
    EMAIL_ENABLED, EMAIL_PASSWORD, EMAIL_RECIPIENT, EMAIL_SENDER,
    TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
)

logger = logging.getLogger(__name__)

_SENTIMENT_EMOJI = {"Positive": "🟢", "Negative": "🔴", "Neutral": "⚪"}
_MAX_TELEGRAM_MSG = 4000  # Telegram hard limit is 4096


def _format_telegram(brief: dict[str, Any]) -> list[str]:
    """Split the brief into Telegram-sized chunks."""
    brief_date = brief.get("date", "")
    top_news: list[dict[str, Any]] = brief.get("top_news", [])
    top5: list[dict[str, Any]] = brief.get("top_5", top_news[:5])

    header = (
        f"📊 *Daily Market Brief — India* ({brief_date})\n"
        f"{'━' * 30}\n\n"
        f"🏆 *TOP 5 MARKET-MOVING STORIES*\n"
    )

    top5_lines = []
    for i, item in enumerate(top5, 1):
        emoji = _SENTIMENT_EMOJI.get(item.get("sentiment", ""), "⚪")
        company = item.get("company", "")
        category = item.get("category", "")
        summary = item.get("summary", "")
        source = item.get("source", "")
        top5_lines.append(
            f"\n{i}. {emoji} *{company}* [{category}]\n"
            f"   {summary}\n"
            f"   _Source: {source}_"
        )

    divider = f"\n\n{'━' * 30}\n📋 *ALL HIGH-SIGNAL NEWS*\n"
    all_lines = []
    for item in top_news:
        emoji = _SENTIMENT_EMOJI.get(item.get("sentiment", ""), "⚪")
        company = item.get("company", "")
        category = item.get("category", "")
        summary = item.get("summary", "")[:120]
        all_lines.append(f"  {emoji} *{company}* ({category}): {summary}")

    full = header + "".join(top5_lines) + divider + "\n".join(all_lines)

    # Chunk into multiple messages if needed
    chunks: list[str] = []
    current = ""
    for line in full.split("\n"):
        if len(current) + len(line) + 1 > _MAX_TELEGRAM_MSG:
            chunks.append(current)
            current = line
        else:
            current += "\n" + line
    if current:
        chunks.append(current)

    return [c.strip() for c in chunks if c.strip()]


async def _send_telegram(brief: dict[str, Any]) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning("Telegram credentials not set — skipping Telegram delivery.")
        return

    try:
        from telegram import Bot
        bot = Bot(token=TELEGRAM_BOT_TOKEN)
        chunks = _format_telegram(brief)
        for chunk in chunks:
            await bot.send_message(
                chat_id=TELEGRAM_CHAT_ID,
                text=chunk,
                parse_mode="Markdown",
            )
        logger.info("Telegram: sent %d message(s)", len(chunks))
    except Exception as exc:
        logger.error("Telegram delivery failed: %s", exc)


def _send_email(brief: dict[str, Any]) -> None:
    if not EMAIL_ENABLED or not EMAIL_SENDER or not EMAIL_RECIPIENT:
        return

    brief_date = brief.get("date", "")
    top_news: list[dict[str, Any]] = brief.get("top_news", [])

    html_rows = ""
    for item in top_news:
        sentiment_color = {"Positive": "#22c55e", "Negative": "#ef4444", "Neutral": "#94a3b8"}.get(
            item.get("sentiment", ""), "#94a3b8"
        )
        html_rows += f"""
        <tr>
          <td style="padding:8px;border-bottom:1px solid #1e293b;">{item.get("company","")}</td>
          <td style="padding:8px;border-bottom:1px solid #1e293b;">{item.get("ticker","")}</td>
          <td style="padding:8px;border-bottom:1px solid #1e293b;">{item.get("category","")}</td>
          <td style="padding:8px;border-bottom:1px solid #1e293b;color:{sentiment_color};">{item.get("sentiment","")}</td>
          <td style="padding:8px;border-bottom:1px solid #1e293b;">{item.get("summary","")}</td>
          <td style="padding:8px;border-bottom:1px solid #1e293b;">{item.get("source","")}</td>
        </tr>
        """

    html_body = f"""
    <html><body style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:20px;">
      <h2 style="color:#14b8a6;">📊 Daily Market Brief — India ({brief_date})</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#1e293b;">
            <th style="padding:8px;text-align:left;">Company</th>
            <th style="padding:8px;text-align:left;">Ticker</th>
            <th style="padding:8px;text-align:left;">Category</th>
            <th style="padding:8px;text-align:left;">Sentiment</th>
            <th style="padding:8px;text-align:left;">Summary</th>
            <th style="padding:8px;text-align:left;">Source</th>
          </tr>
        </thead>
        <tbody>{html_rows}</tbody>
      </table>
    </body></html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"📊 Daily Market Brief India — {brief_date}"
    msg["From"] = EMAIL_SENDER
    msg["To"] = EMAIL_RECIPIENT
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(EMAIL_SENDER, EMAIL_PASSWORD)
            smtp.sendmail(EMAIL_SENDER, EMAIL_RECIPIENT, msg.as_string())
        logger.info("Email sent to %s", EMAIL_RECIPIENT)
    except Exception as exc:
        logger.error("Email delivery failed: %s", exc)


async def deliver(brief: dict[str, Any]) -> None:
    await _send_telegram(brief)
    _send_email(brief)
