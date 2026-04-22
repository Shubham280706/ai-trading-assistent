import OpenAI from "openai";

import { deriveRuleBasedSignal } from "@/lib/indicators";
import type { AiRecommendation, FundamentalData, NewsItem, StockSnapshot } from "@/lib/types";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function getAiRecommendation(
  stock: StockSnapshot,
  news: NewsItem[],
  fundamentals?: FundamentalData
): Promise<AiRecommendation> {
  const fallback = deriveRuleBasedSignal(stock.price, stock.indicators);
  const sentimentAverage =
    news.reduce((sum, item) => sum + item.sentimentScore, 0) / Math.max(news.length, 1);

  if (!client) {
    return {
      shortTerm: fallback.shortTerm,
      longTerm: fallback.longTerm,
      confidence: 70,
      sentiment: sentimentAverage > 0.2 ? "Bullish" : sentimentAverage < -0.2 ? "Bearish" : "Neutral",
      reason: `${fallback.reason} News sentiment is ${sentimentAverage > 0.2 ? "constructive" : sentimentAverage < -0.2 ? "weak" : "mixed"}, so use the signal as a research input rather than certainty.`
    };
  }

  try {
    const completion = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You are a cautious Indian equities analyst. Return JSON only with shortTerm, longTerm, confidence, sentiment, and reason. Signals must be Buy, Sell, or Hold. Mention RSI, MA, MACD, and news sentiment in the reason. If fundamental data is provided, factor in P/E, ROE, ROCE, dividend, and debt levels for the long-term signal. Include a financial-risk-aware tone."
        },
        {
          role: "user",
          content: JSON.stringify({
            symbol: stock.symbol,
            price: stock.price,
            indicators: stock.indicators,
            changePercent: stock.changePercent,
            fundamentals: fundamentals ? {
              peRatio: fundamentals.peRatio,
              pbRatio: fundamentals.pbRatio,
              roe: fundamentals.roe,
              roce: fundamentals.roce,
              dividendYield: fundamentals.dividendYield,
              debtToEquity: fundamentals.debtToEquity,
              revenueGrowth: fundamentals.revenueGrowth,
              profitMargin: fundamentals.profitMargin,
              fundamentalScore: fundamentals.fundamentalScore,
              verdict: fundamentals.verdict,
            } : null,
            news: news.map((item) => ({
              title: item.title,
              sentimentScore: item.sentimentScore,
              summary: item.summary
            }))
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "stock_signal",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              shortTerm: { type: "string", enum: ["Buy", "Sell", "Hold"] },
              longTerm: { type: "string", enum: ["Buy", "Sell", "Hold"] },
              confidence: { type: "number" },
              sentiment: { type: "string", enum: ["Bullish", "Bearish", "Neutral"] },
              reason: { type: "string" }
            },
            required: ["shortTerm", "longTerm", "confidence", "sentiment", "reason"]
          }
        }
      }
    });

    const content = completion.output_text;
    return JSON.parse(content) as AiRecommendation;
  } catch {
    return {
      shortTerm: fallback.shortTerm,
      longTerm: fallback.longTerm,
      confidence: 68,
      sentiment: sentimentAverage > 0.2 ? "Bullish" : sentimentAverage < -0.2 ? "Bearish" : "Neutral",
      reason: fallback.reason
    };
  }
}

export async function getAiPayload(stock: StockSnapshot, news: NewsItem[], fundamentals?: FundamentalData) {
  const recommendation = await getAiRecommendation(stock, news, fundamentals);

  return {
    shortTermSignal: recommendation.shortTerm,
    longTermSignal: recommendation.longTerm,
    explanation: recommendation.reason,
    recommendation
  };
}

export async function getNewsDigest(symbol: string, news: NewsItem[]) {
  if (!client) {
    return `${symbol} coverage is mixed but generally focused on earnings quality, institutional activity, and sector momentum. Headlines suggest watching sentiment shifts alongside technical confirmation before taking action.`;
  }

  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Summarize the latest stock news in 2 concise sentences for a retail investor. Mention sentiment and the most important catalyst. Do not give financial advice."
        },
        {
          role: "user",
          content: JSON.stringify({
            symbol,
            news: news.map((item) => ({
              title: item.title,
              summary: item.summary,
              sentimentScore: item.sentimentScore
            }))
          })
        }
      ]
    });

    return response.output_text;
  } catch {
    return `${symbol} headlines point to a balanced near-term setup with attention on earnings outlook, sector demand, and market sentiment. News flow should be read together with RSI, moving averages, and MACD before acting.`;
  }
}
