# TradeWIthS

TradeWIthS is an Indian stock assistant built with Next.js App Router, Prisma, PostgreSQL, NextAuth, Zustand, Tailwind, Framer Motion, and OpenAI.

## Features

- Indian stock tracking for NSE/BSE symbols
- AI-generated short-term and long-term Buy/Sell/Hold signals
- RSI, MA(50), MA(200), and MACD indicator analysis
- Real-time style polling for market data
- Stock detail pages with interactive charts
- News cards with AI summaries
- Google authentication with user-specific watchlists
- Premium dark fintech UI with glassmorphism and motion
- Disclaimer banner: this is not financial advice

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Start PostgreSQL and update `DATABASE_URL` in `.env`.

4. Generate Prisma client and run migrations:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

5. Start the app:

```bash
npm run dev
```

6. Open `http://localhost:3000`.

## Notes

- When API keys are missing, the app falls back to mock-safe responses so the UI still works.
- For live Indian symbols, use formats like `RELIANCE.NS`, `TCS.NS`, `INFY.NS`, or `HDFCBANK.NS`.
- Google login requires valid OAuth credentials and `NEXTAUTH_URL`.

## Production checklist

- Replace all placeholder environment variables
- Point Prisma to a managed PostgreSQL database
- Add rate limiting and caching for market/news endpoints
- Secure OpenAI usage with quotas and request validation
- Replace mock market provider with Zerodha Kite Connect when credentials are available
# ai-trading-assistent
