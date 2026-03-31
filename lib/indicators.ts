import type { Candle, IndicatorSet } from "@/lib/types";

function simpleMovingAverage(values: number[], period: number) {
  const slice = values.slice(-period);
  if (slice.length === 0) {
    return 0;
  }
  return slice.reduce((sum, value) => sum + value, 0) / slice.length;
}

function ema(values: number[], period: number) {
  if (values.length === 0) {
    return 0;
  }
  const multiplier = 2 / (period + 1);
  return values.reduce((previous, current, index) => {
    if (index === 0) {
      return current;
    }
    return (current - previous) * multiplier + previous;
  }, values[0]);
}

function calculateRsi(values: number[], period = 14) {
  if (values.length < period + 1) {
    return 50;
  }

  let gains = 0;
  let losses = 0;

  for (let index = values.length - period; index < values.length; index += 1) {
    const diff = values[index] - values[index - 1];
    if (diff >= 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }

  if (losses === 0) {
    return 100;
  }

  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export function calculateIndicators(candles: Candle[]): IndicatorSet {
  const closes = candles.map((candle) => candle.close);
  const ma50 = simpleMovingAverage(closes, 50);
  const ma200 = simpleMovingAverage(closes, 200);
  const rsi = calculateRsi(closes);
  const macd = ema(closes, 12) - ema(closes, 26);
  const signalLine = ema([...closes.slice(-9), macd], 9);
  const histogram = macd - signalLine;

  return {
    rsi,
    ma50,
    ma200,
    macd,
    signalLine,
    histogram
  };
}

export function deriveRuleBasedSignal(
  price: number,
  indicators: IndicatorSet
): { shortTerm: "Buy" | "Sell" | "Hold"; longTerm: "Buy" | "Sell" | "Hold"; reason: string } {
  let shortTerm: "Buy" | "Sell" | "Hold" = "Hold";
  let longTerm: "Buy" | "Sell" | "Hold" = "Hold";
  const reasons: string[] = [];

  if (indicators.rsi < 30) {
    shortTerm = "Buy";
    reasons.push("RSI is below 30, which suggests oversold momentum.");
  } else if (indicators.rsi > 70) {
    shortTerm = "Sell";
    reasons.push("RSI is above 70, which suggests overbought conditions.");
  } else {
    reasons.push("RSI is in a neutral zone.");
  }

  if (price > indicators.ma200) {
    longTerm = "Buy";
    reasons.push("Price is above the 200-day moving average, a long-term bullish signal.");
  } else if (price < indicators.ma200) {
    longTerm = "Sell";
    reasons.push("Price is below the 200-day moving average, showing long-term weakness.");
  }

  if (indicators.macd > indicators.signalLine) {
    reasons.push("MACD is above its signal line, adding positive trend support.");
  } else {
    reasons.push("MACD is below its signal line, which keeps momentum cautious.");
  }

  return {
    shortTerm,
    longTerm,
    reason: reasons.join(" ")
  };
}
