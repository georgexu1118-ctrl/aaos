export const runtime = "edge";

import { NextRequest } from "next/server";

// GET /api/chart?symbol=AAOI&range=ytd&interval=1d
// Fetches OHLCV time-series for the stock chart component.
// Uses Finnhub candles API when FINNHUB_API_KEY is set; falls back to Yahoo Finance v8.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "AAOI").toUpperCase();
  const range  = searchParams.get("range")    ?? "ytd";
  const interval = searchParams.get("interval") ?? "1d";

  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) return getFinnhubChart(symbol, range, finnhubKey);
  return getYahooChart(symbol, range, interval);
}

// ── Finnhub candles ──────────────────────────────────────────────────────────
function rangeToFinnhub(range: string): { from: number; to: number; resolution: string } {
  const now = Math.floor(Date.now() / 1000);
  const d = 86400;
  switch (range) {
    case "1d":  return { from: now - d,           to: now, resolution: "5"  };
    case "5d":  return { from: now - 5  * d,      to: now, resolution: "15" };
    case "1mo": return { from: now - 30 * d,      to: now, resolution: "D"  };
    case "3mo": return { from: now - 90 * d,      to: now, resolution: "D"  };
    case "6mo": return { from: now - 180 * d,     to: now, resolution: "D"  };
    case "ytd": {
      const jan1 = Math.floor(new Date(`${new Date().getFullYear()}-01-01T00:00:00Z`).getTime() / 1000);
      return { from: jan1, to: now, resolution: "D" };
    }
    case "1y":  return { from: now - 365 * d,     to: now, resolution: "D"  };
    case "5y":  return { from: now - 5 * 365 * d, to: now, resolution: "W"  };
    default:    return { from: now - 30 * d,      to: now, resolution: "D"  };
  }
}

async function getFinnhubChart(symbol: string, range: string, token: string): Promise<Response> {
  const { from, to, resolution } = rangeToFinnhub(range);
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${token}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return Response.json({ error: `finnhub ${res.status}` }, { status: 502 });
    const data = await res.json() as {
      c?: (number | null)[];
      h?: (number | null)[];
      l?: (number | null)[];
      o?: (number | null)[];
      t?: number[];
      s?: string;
    };
    if (data.s !== "ok" || !data.t?.length) return Response.json({ error: "no data" }, { status: 404 });
    const ts     = data.t;
    const closes = data.c ?? [];
    const highs  = data.h ?? [];
    const lows   = data.l ?? [];
    const opens  = data.o ?? [];
    const points = ts
      .map((t, i) => ({ t: t * 1000, o: opens[i], h: highs[i], l: lows[i], c: closes[i] }))
      .filter(p =>
        typeof p.c === "number" && p.c !== null &&
        typeof p.o === "number" && typeof p.h === "number" && typeof p.l === "number"
      ) as { t: number; o: number; h: number; l: number; c: number }[];
    const last      = points[points.length - 1]?.c;
    const prevClose = points.length > 1 ? points[points.length - 2]?.c : undefined;
    const change    = last != null && prevClose != null ? +(last - prevClose).toFixed(2) : 0;
    const changePct = last != null && prevClose ? +((last - prevClose) / prevClose * 100).toFixed(2) : 0;
    return Response.json({
      symbol, currency: "USD", last, prevClose, change, changePct, points, source: "finnhub",
    }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

// ── Yahoo Finance v8 fallback ────────────────────────────────────────────────
async function getYahooChart(symbol: string, range: string, interval: string): Promise<Response> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!res.ok) return Response.json({ error: `yahoo ${res.status}` }, { status: 502 });
    const data = await res.json() as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            currency?: string;
            symbol?: string;
            previousClose?: number;
          };
          timestamp?: number[];
          indicators?: { quote?: Array<{
            open?: (number | null)[];
            high?: (number | null)[];
            low?: (number | null)[];
            close?: (number | null)[];
          }> };
        }>;
        error?: unknown;
      };
    };
    const r = data?.chart?.result?.[0];
    if (!r) return Response.json({ error: "no data" }, { status: 404 });
    const ts = r.timestamp ?? [];
    const q  = r.indicators?.quote?.[0] ?? {};
    const opens  = q.open  ?? [];
    const highs  = q.high  ?? [];
    const lows   = q.low   ?? [];
    const closes = q.close ?? [];
    const points = ts
      .map((t, i) => ({ t: t * 1000, o: opens[i], h: highs[i], l: lows[i], c: closes[i] }))
      .filter(p =>
        typeof p.c === "number" && p.c !== null &&
        typeof p.o === "number" && typeof p.h === "number" && typeof p.l === "number"
      ) as { t: number; o: number; h: number; l: number; c: number }[];
    const meta      = r.meta ?? {};
    const last      = meta.regularMarketPrice ?? points[points.length - 1]?.c;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? points[0]?.c;
    const change    = last != null && prevClose != null ? last - prevClose : 0;
    const changePct = last != null && prevClose ? ((last - prevClose) / prevClose) * 100 : 0;
    return Response.json({
      symbol: meta.symbol ?? symbol,
      currency: meta.currency ?? "USD",
      last, prevClose, change, changePct, points, source: "yahoo finance",
    }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
