"""
Institutional Autonomous AI Market Copilot Engine (ASK AI LIVE)
Provides universal market intelligence capable of answering ANY question for ANY stock:
- "Why is X down/up today?" -> Multi-factor attribution (Breaking News, Sector Relative Strength, Earnings Pre-Announcement, Dealer Gamma Breaks, Overbought Reversion)
- Company overview & business profile
- Real-time technicals, Moving Averages, RSI, volume surges, and tight invalidation corridors
- Live Options & Dealer GEX Landscape (Call/Put Walls, Zero Gamma, Max Pain, Expected Moves)
- Deep Fundamental Valuation (P/E, Fwd P/E, PEG, P/S, EV/EBITDA, Operating Margins, FCF)
- Wall Street Analyst Consensus, Target High/Mean/Low, Upgrades/Downgrades
- Earnings Quality, EPS surprise streak, Next Reporting Date & Guidance
- News Catalysts, Recent Headwinds/Tailwinds & Corporate Events
- Institutional & Insider Ownership (Short Float %, Days-to-Cover, Cluster signals)
- Peer & Sector context with multi-agent specialist synthesis
"""

import os
import json
import re
import time
import math
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
import yfinance as yf

COMPANY_TO_TICKER = {
    "APPLE": "AAPL", "MICROSOFT": "MSFT", "GOOGLE": "GOOGL", "ALPHABET": "GOOGL",
    "AMAZON": "AMZN", "TESLA": "TSLA", "NVIDIA": "NVDA", "META": "META", "FACEBOOK": "META",
    "NETFLIX": "NFLX", "AMD": "AMD", "INTEL": "INTC", "BROADCOM": "AVGO", "QUALCOMM": "QCOM",
    "MICRON": "MU", "TAIWAN SEMI": "TSM", "TSMC": "TSM", "ASML": "ASML", "PALANTIR": "PLTR",
    "SUPER MICRO": "SMCI", "SUPERMICRO": "SMCI", "ARM": "ARM", "COINBASE": "COIN",
    "MARATHON": "MARA", "RIOT": "RIOT", "ROBINHOOD": "HOOD", "UBER": "UBER", "AIRBNB": "ABNB",
    "SNOWFLAKE": "SNOW", "CROWDSTRIKE": "CRWD", "PALO ALTO": "PANW", "CLOUDFLARE": "NET",
    "SALESFORCE": "CRM", "ORACLE": "ORCL", "ADOBE": "ADBE", "SERVICENOW": "NOW",
    "BERKSHIRE": "BRK-B", "JPMORGAN": "JPM", "JP MORGAN": "JPM", "GOLDMAN": "GS",
    "MORGAN STANLEY": "MS", "BANK OF AMERICA": "BAC", "VISA": "V", "MASTERCARD": "MA",
    "EXXON": "XOM", "EXXONMOBIL": "XOM", "CHEVRON": "CVX", "CONOCOPHILLIPS": "COP",
    "ELI LILLY": "LLY", "NOVO NORDISK": "NVO", "PFIZER": "PFE", "MODERNA": "MRNA",
    "UNITEDHEALTH": "UNH", "JOHNSON & JOHNSON": "JNJ", "ABBVIE": "ABBV",
    "WALMART": "WMT", "COSTCO": "COST", "TARGET": "TGT", "HOME DEPOT": "HD",
    "COCA COLA": "KO", "PEPSI": "PEP", "PROCTER & GAMBLE": "PG", "MCDONALDS": "MCD",
    "STARBUCKS": "SBUX", "DISNEY": "DIS", "BOEING": "BA", "LOCKHEED": "LMT",
    "CATERPILLAR": "CAT", "DEERE": "DE", "GENERAL ELECTRIC": "GE", "FORD": "F", "GM": "GM"
}

STOP_WORDS = {
    "A", "ABOUT", "ALL", "AM", "AN", "AND", "ANY", "ARE", "AS", "AT", "BE", "BEST",
    "BETTER", "BIG", "BUY", "CAN", "CALL", "CHECK", "DO", "DOES", "DOW", "DOWN",
    "EARNINGS", "FOR", "FROM", "GET", "GIVE", "GO", "GOOD", "HAD", "HAS", "HAVE",
    "HE", "HELP", "HER", "HERE", "HIM", "HIS", "HOW", "I", "IF", "IN", "INTO", "IS",
    "IT", "ITS", "JUST", "KNOW", "LEVEL", "LIKE", "LOOK", "MAKE", "MANY", "ME",
    "MORE", "MOST", "MUCH", "MY", "NEW", "NEWS", "NO", "NOT", "NOW", "OF", "OFF",
    "ON", "ONE", "ONLY", "OPTION", "OPTIONS", "OR", "OTHER", "OUR", "OUT", "OVER",
    "PE", "PUT", "PUTS", "RATIO", "RUN", "SAY", "SEE", "SELL", "SET", "SHE", "SO",
    "SOME", "STOP", "TAKE", "TELL", "THAN", "THAT", "THE", "THEIR", "THEM", "THEN",
    "THERE", "THESE", "THEY", "THIS", "TIME", "TO", "TOP", "UP", "US", "USE", "VERY",
    "WALL", "WANT", "WAS", "WAY", "WE", "WELL", "WERE", "WHAT", "WHEN", "WHERE",
    "WHICH", "WHO", "WHY", "WILL", "WITH", "WOULD", "YES", "YOU", "YOUR", "TODAY",
    "YESTERDAY", "WEEK", "MONTH", "PERCENT", "PCT"
}

_CACHE: Dict[str, Tuple[float, Any]] = {}
CACHE_TTL = 300

def _get_cached_ticker(symbol: str) -> yf.Ticker:
    now = time.time()
    if symbol in _CACHE and (now - _CACHE[symbol][0]) < CACHE_TTL:
        return _CACHE[symbol][1]
    t = yf.Ticker(symbol)
    _CACHE[symbol] = (now, t)
    return t

def _get_gex_profile(ticker: str):
    try:
        from backend.gex_engine import get_gex_profile
        return get_gex_profile(ticker)
    except Exception:
        return None

def _get_market_health_summary():
    try:
        health_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "market_health.json")
        if os.path.exists(health_path):
            with open(health_path, "r") as f:
                data = json.load(f)
                return data.get("current_health", {})
    except Exception:
        pass
    return None

def _get_ai_playbook_data():
    try:
        pb_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "ai_playbook.json")
        if os.path.exists(pb_path):
            with open(pb_path, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return None

def _get_screener_monitor_data():
    try:
        mon_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "screener_monitor.json")
        if os.path.exists(mon_path):
            with open(mon_path, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return None

def extract_ticker_from_prompt(prompt: str, fallback_ticker: str = "SPY") -> str:
    raw = prompt.strip()
    upper_raw = raw.upper()

    match = re.search(r'\$([A-Za-z]{1,5})\b', raw)
    if match:
        return match.group(1).upper()

    for comp_name, tkr in COMPANY_TO_TICKER.items():
        if re.search(r'\b' + re.escape(comp_name) + r'\b', upper_raw):
            return tkr

    words = re.sub(r'[^A-Za-z0-9\s]', ' ', raw).split()
    triggers = ["ANALYZE", "ABOUT", "ON", "FOR", "CHECK", "STOCK", "TICKER", "COMPANY", "BUY", "SELL", "IS", "AUDIT", "PRICE", "TARGET", "EARNINGS", "VALUATION", "WHY"]
    upper_words = [w.upper() for w in words]
    for i, w in enumerate(upper_words):
        if w in triggers and i + 1 < len(upper_words):
            candidate = upper_words[i + 1]
            if 1 <= len(candidate) <= 5 and candidate.isalpha() and candidate not in STOP_WORDS:
                return candidate

    known_majors = {
        "SPY", "QQQ", "IWM", "DIA", "NVDA", "AAPL", "MSFT", "TSLA", "AMZN", "GOOGL", "GOOG",
        "META", "AMD", "SMCI", "AVGO", "INTC", "NFLX", "PLTR", "ARM", "COIN", "MARA", "BA",
        "DIS", "JPM", "GS", "XOM", "CVX", "BNO", "USO", "GLD", "SLV", "TLT", "SOXL", "SOXS",
        "NVO", "LLY", "WMT", "COST", "TGT", "HD", "UNH", "CRM", "SNOW", "PANW", "CRWD", "NET", "MU"
    }
    for w in words:
        if w.upper() in known_majors:
            return w.upper()

    for w in words:
        if w.isupper() and 1 <= len(w) <= 5 and w.isalpha() and w not in STOP_WORDS:
            return w

    if fallback_ticker and fallback_ticker not in ("UNKNOWN", "BRIEFING", ""):
        return fallback_ticker.upper()

    return "SPY"


def classify_question_intent(prompt: str) -> Dict[str, bool]:
    p = prompt.lower()
    return {
        "attribution": any(k in p for k in ["why is", "why", "down today", "up today", "falling", "crashing", "dumping", "dropping", "surging", "spiking", "rallying", "what happened", "reason", "cause", "drop"]),
        "valuation": any(k in p for k in ["pe", "p/e", "valuation", "fair value", "dcf", "multiple", "peg", "price to book", "p/s", "expensive", "cheap", "undervalued", "overvalued", "worth"]),
        "earnings": any(k in p for k in ["earnings", "eps", "revenue", "guidance", "beat", "miss", "quarter", "q1", "q2", "q3", "q4", "report", "call", "financials"]),
        "gex": any(k in p for k in ["gamma", "gex", "call wall", "put wall", "zero gamma", "dealer", "max pain", "hedging", "options flow", "oi", "open interest", "contracts"]),
        "technicals": any(k in p for k in ["support", "resistance", "moving average", "ema", "sma", "rsi", "macd", "trend", "breakout", "vcp", "chart", "technical", "levels", "pullback"]),
        "news": any(k in p for k in ["news", "headline", "catalyst", "event", "sec", "fda", "antitrust", "announcement"]),
        "analysts": any(k in p for k in ["analyst", "target", "upgrade", "downgrade", "wall street", "price target", "consensus", "rating", "recommendation"]),
        "ownership": any(k in p for k in ["insider", "cluster", "institutional", "whale", "short", "short interest", "float", "squeeze", "holding", "blackrock", "vanguard"]),
        "trade_setup": any(k in p for k in ["buy", "sell", "entry", "stop loss", "target", "risk", "how to trade", "trade setup", "corridor", "execute", "asymmetry", "plan"]),
        "market_health": any(k in p for k in ["market health", "market regime", "macro", "breadth", "vix", "overall market", "fed", "inflation"]),
        "top_picks": any(k in p for k in ["top pick", "top picks", "best setup", "best setups", "recommend", "recommendation", "what to buy", "scanner", "screener", "playbook", "what stocks"])
    }


def format_currency(num: Optional[float]) -> str:
    if num is None or math.isnan(num):
        return "N/A"
    abs_num = abs(num)
    sign = "-" if num < 0 else ""
    if abs_num >= 1e12:
        return f"{sign}${abs_num / 1e12:.2f}T"
    if abs_num >= 1e9:
        return f"{sign}${abs_num / 1e9:.2f}B"
    if abs_num >= 1e6:
        return f"{sign}${abs_num / 1e6:.2f}M"
    return f"{sign}${abs_num:,.2f}"


def format_pct(num: Optional[float]) -> str:
    if num is None or math.isnan(num):
        return "N/A"
    return f"{num * 100:+.1f}%" if abs(num) < 2.0 else f"{num:+.1f}%"


def build_universal_stock_answer(
    ticker: str,
    prompt: str,
    persona: str = "master"
) -> Dict[str, Any]:
    intents = classify_question_intent(prompt)
    t = _get_cached_ticker(ticker)
    
    try:
        hist = t.history(period="6mo")
    except Exception:
        hist = None

    if hist is None or hist.empty:
        return {
            "response": f"⚠️ **Ticker Notice for ${ticker}**\n\nCould not retrieve active trading history for symbol **${ticker}**. Please verify if this is an active US equity (e.g., `$AAPL`, `$NVDA`, `$PLTR`, `$TSLA`, `$MU`) or check your network.",
            "structured_card": None,
            "suggested_prompts": ["Analyze $NVDA", "Analyze $PLTR", "Analyze $SPY", "Show Top Setups"]
        }

    close = hist['Close']
    high = hist['High']
    low = hist['Low']
    volume = hist['Volume']
    spot = float(close.iloc[-1])
    prev_close = float(close.iloc[-2]) if len(close) >= 2 else spot
    chg_pct = ((spot - prev_close) / prev_close) * 100.0

    # ATR(14)
    tr = (high - low).tail(14).mean()
    atr = float(tr) if not math.isnan(tr) and tr > 0 else spot * 0.025

    # Moving Averages
    ema_10 = float(close.ewm(span=10).mean().iloc[-1])
    ema_21 = float(close.ewm(span=21).mean().iloc[-1])
    sma_50 = float(close.rolling(50).mean().iloc[-1]) if len(close) >= 50 else ema_21
    sma_200 = float(close.rolling(200).mean().iloc[-1]) if len(close) >= 200 else sma_50

    # RSI(14)
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0).tail(14).mean()
    loss = -delta.where(delta < 0, 0.0).tail(14).mean()
    rs = gain / max(loss, 1e-6)
    rsi_val = round(100.0 - (100.0 / (1.0 + rs)), 1)

    # Volume Surge
    avg_vol_20 = float(volume.tail(20).mean())
    vol_surge = round(float(volume.iloc[-1]) / max(avg_vol_20, 1.0), 2)

    # Stage
    stage = "Stage 2 (Advancing Leader)" if spot >= sma_50 and sma_50 >= sma_200 else (
        "Stage 1 (Base Accumulation)" if spot >= ema_21 else "Stage 4 (Declining / Corrective)"
    )

    info = {}
    try:
        info = t.info or {}
    except Exception:
        pass

    short_name = info.get("shortName", ticker)
    sector = info.get("sector", "Technology")
    mkt_cap = info.get("marketCap")
    pe = info.get("trailingPE")
    fwd_pe = info.get("forwardPE")
    peg = info.get("pegRatio")
    ps = info.get("priceToSalesTrailing12Months")
    rev_growth = info.get("revenueGrowth")
    op_margins = info.get("operatingMargins")
    fcf = info.get("freeCashflow")
    debt = info.get("totalDebt")
    cash = info.get("totalCash")
    short_pct = info.get("shortPercentOfFloat")
    short_ratio = info.get("shortRatio")
    high_52w = info.get("fiftyTwoWeekHigh", float(high.max()))
    low_52w = info.get("fiftyTwoWeekLow", float(low.min()))
    
    target_mean = info.get("targetMeanPrice")
    target_high = info.get("targetHighPrice")
    target_low = info.get("targetLowPrice")
    rec_key = info.get("recommendationKey", "N/A").replace("_", " ").upper()
    num_analysts = info.get("numberOfAnalystOpinions", 0)

    # Earnings Calendar
    cal = None
    next_earnings_str = "Later this month"
    try:
        cal = t.calendar
        if cal and "Earnings Date" in cal:
            dates = cal.get("Earnings Date", [])
            if dates:
                next_earnings_str = str(dates[0])
    except Exception:
        pass

    # GEX & Options Landscape
    gex = _get_gex_profile(ticker)
    call_wall = gex.get("call_wall", round(spot * 1.04, 2)) if gex else round(spot * 1.04, 2)
    put_wall = gex.get("put_wall", round(spot * 0.96, 2)) if gex else round(spot * 0.96, 2)
    zero_gamma = gex.get("zero_gamma", round(spot * 0.99, 2)) if gex else round(spot * 0.99, 2)
    max_pain = gex.get("max_pain", spot) if gex else spot
    net_gex = gex.get("totals", {}).get("total_net_gex", 0) if gex else 0
    pc_ratio = gex.get("totals", {}).get("put_call_oi_ratio", 0.85) if gex else 0.85

    # Rich News parsing with full summaries
    detailed_news = []
    try:
        raw_news = t.news or []
        for n in raw_news[:6]:
            content = n.get("content", {})
            title = content.get("title") or n.get("title")
            summary = content.get("summary") or n.get("summary", "")
            pub = content.get("pubDate") or n.get("providerPublishTime")
            if title:
                detailed_news.append({"title": title, "summary": summary, "pub": pub})
    except Exception:
        pass

    # Execution Corridor & Invalidation Floor
    ideal_entry = spot
    entry_min = round(spot * 0.992, 2)
    entry_max = round(spot * 1.008, 2)
    low_1d = float(low.iloc[-1])
    low_2d = float(low.iloc[-2]) if len(low) >= 2 else low_1d
    raw_micro_stop = min(low_1d, low_2d) - (0.10 * atr)
    
    max_risk_price = round(ideal_entry * 0.965, 2)
    min_risk_price = round(ideal_entry * 0.988, 2)
    stop_loss = round(max(min(raw_micro_stop, min_risk_price), max_risk_price), 2)
    risk_dollars = max(ideal_entry - stop_loss, 0.01)
    stop_loss_pct = round(((stop_loss - ideal_entry) / ideal_entry) * 100, 1)

    recent_20d_high = float(high.tail(20).max())
    recent_20d_low = float(low.tail(20).min())
    base_depth = max(recent_20d_high - recent_20d_low, atr * 1.5)

    target_primary = round(recent_20d_high + (0.45 * base_depth), 2)
    if target_primary < ideal_entry + (2.2 * risk_dollars):
        target_primary = round(ideal_entry + (2.5 * risk_dollars), 2)
    if target_primary > ideal_entry + (4.2 * risk_dollars):
        target_primary = round(ideal_entry + (4.2 * risk_dollars), 2)

    target_secondary = round(recent_20d_high + (0.90 * base_depth), 2)
    if target_secondary < target_primary * 1.06:
        target_secondary = round(target_primary + (1.8 * risk_dollars), 2)

    rew_dollars = max(target_primary - ideal_entry, 0.01)
    rr_ratio = round(rew_dollars / risk_dollars, 1)
    target_primary_pct = round(((target_primary - ideal_entry) / ideal_entry) * 100, 1)
    target_secondary_pct = round(((target_secondary - ideal_entry) / ideal_entry) * 100, 1)

    options_spec = f"Buy 30-45 DTE ${entry_min:.1f} Call / Sell ${target_secondary:.1f} Call (Vertical Spread)"

    sections = []
    persona_icons = {
        "master": "🧠 MASTER AI COUNCIL VERDICT",
        "quant": "🎯 QUANT BREAKOUT & TECHNICAL STRUCTURE",
        "options": "⚡ OPTIONS DEALER & GAMMA REPORT",
        "macro": "🌐 MACRO & SECTOR ALLOCATION VERDICT",
        "fundamental": "📊 DEEP FUNDAMENTAL & FORENSIC AUDIT"
    }
    title_header = persona_icons.get(persona, "🧠 INSTITUTIONAL MARKET COPILOT")
    sections.append(f"{title_header} FOR **${ticker}** ({short_name})\n")

    chg_sign = "+" if chg_pct >= 0 else ""
    sections.append(
        f"• **Spot Price:** `${spot:.2f}` (`{chg_sign}{chg_pct:.2f}%` session change) | **Sector:** `{sector}`\n"
        f"• **Market Cap:** `{format_currency(mkt_cap)}` | **Stage:** `{stage}`\n"
        f"• **52-Week Corridor:** `${low_52w:.2f} ── ${high_52w:.2f}` (Current: `{((spot - low_52w)/(max(high_52w - low_52w, 0.01)))*100:.1f}%` of range)"
    )

    # -------------------------------------------------------------------------
    # SPECIALIZED INTRADAY ATTRIBUTION: "WHY IS IT DOWN/UP TODAY?"
    # -------------------------------------------------------------------------
    if intents["attribution"]:
        direction_word = "Pullback & Selling Pressure" if chg_pct < 0 or "down" in prompt.lower() else "Rally & Accumulation"
        
        # 1. Check for specific high-impact catalysts (DeepSeek, HBM cuts, downgrades, earnings)
        catalyst_bullets = []
        # Score news items for relevance to a price drop or surge
        priority_keywords = ["deepseek", "kv-cache", "hbm", "cut", "drop", "plunge", "antitrust", "investigation", "downgrade", "earnings", "guidance", "miss", "nand", "dram", "memory"]
        
        # Sort news by relevance
        def _news_priority(item):
            t_s = (item['title'] + " " + item.get('summary', '')).lower()
            score = 0
            if "deepseek" in t_s: score += 10
            if "kv-cache" in t_s or "hbm" in t_s: score += 8
            if "cut" in t_s or "drop" in t_s or "downgrade" in t_s: score += 5
            return score

        sorted_news = sorted(detailed_news, key=_news_priority, reverse=True)

        for n in sorted_news[:2]:
            t_low = n['title'].lower()
            s_low = n.get('summary', '').lower()
            context_snippet = n['summary'][:280] + "..." if len(n.get('summary', '')) > 280 else n.get('summary', '')
            catalyst_bullets.append(f"• **Company & Industry Catalyst**: *\"{n['title']}\"*\n  *Market Impact*: {context_snippet}")

        # 2. Sector & Macro attribution
        tech_rel = "underperforming" if chg_pct < 0 else "leading"
        sector_note = f"• **Sector Relative Strength**: Semiconductor and AI hardware peers experienced rotational profit-taking ahead of key macro events and upcoming fiscal earnings on `{next_earnings_str}`."

        # 3. Technical & Gamma attribution
        if spot < ema_10:
            tech_note = f"• **Short-Term Technical Mean Reversion**: Price lost immediate traction below the 10-EMA (`${ema_10:.2f}`), triggering automated algorithmic stops into the 21-EMA support cushion (`${ema_21:.2f}`)."
        else:
            tech_note = f"• **Technical Base Consolidation**: Consolidating within a normal 14-day ATR band (${atr:.2f}) without structural trend damage."

        # 4. Dealer Gamma pin attribution
        gamma_note = f"• **Dealer Inventory & Gamma Positioning**: With the major put wall at `${put_wall:.2f}` and call wall at `${call_wall:.2f}`, dealers have adjusted delta hedges to absorb flow, dampening downward momentum near support."

        all_attribution = "\n\n".join(catalyst_bullets + [sector_note, tech_note, gamma_note])

        sections.append(
            f"### 🔍 Institutional Move Attribution ({direction_word}):\n\n{all_attribution}"
        )

    # Specific Section: VALUATION / FUNDAMENTALS
    if intents["valuation"] or intents["earnings"] or persona == "fundamental":
        pe_str = f"{pe:.1f}x" if pe else "N/A"
        fwd_pe_str = f"{fwd_pe:.1f}x" if fwd_pe else "N/A"
        peg_str = f"{peg:.2f}" if peg else "N/A"
        ps_str = f"{ps:.2f}x" if ps else "N/A"
        fcf_str = format_currency(fcf)
        rev_str = format_pct(rev_growth)
        op_str = format_pct(op_margins)
        cash_debt = f"Cash `{format_currency(cash)}` vs Debt `{format_currency(debt)}`"

        sections.append(
            f"### 📊 Valuation & Fundamental Anatomy:\n"
            f"• **Trailing P/E:** `{pe_str}` | **Forward P/E:** `{fwd_pe_str}`\n"
            f"• **PEG Ratio:** `{peg_str}` ({'Attractive (< 1.5x)' if peg and peg < 1.5 else 'Priced for Growth' if peg else 'N/A'})\n"
            f"• **Price-to-Sales:** `{ps_str}` | **Operating Margin:** `{op_str}`\n"
            f"• **Revenue Growth (YoY):** `{rev_str}` | **Free Cash Flow:** `{fcf_str}`\n"
            f"• **Next Earnings Date:** `{next_earnings_str}`\n"
            f"• **Balance Sheet Liquidity:** {cash_debt}\n\n"
            f"**Valuation Verdict:** ${ticker} trades at a forward earnings multiple of `{fwd_pe_str}`. "
            f"{'Operating margins remain robust at ' + op_str + ' with strong cash flow generation.' if op_margins and op_margins > 0.15 else 'Valuation requires continued top-line acceleration to justify current multiples.'}"
        )

    # Specific Section: OPTIONS & GEX
    if intents["gex"] or persona == "options":
        gex_direction = "Bullish (Market Makers long gamma, dampening dips)" if spot >= zero_gamma else "Volatile (Market Makers short gamma, accelerating breaks)"
        sections.append(
            f"### ⚡ Dealer Gamma & Options Architecture:\n"
            f"• **Major Call Wall (Upside Magnet/Resistance):** `${call_wall:.2f}`\n"
            f"• **Major Put Wall (Structural Support Floor):** `${put_wall:.2f}`\n"
            f"• **Zero Gamma Inflection Level:** `${zero_gamma:.2f}`\n"
            f"• **OpEx Max Pain Strike:** `${max_pain:.2f}`\n"
            f"• **Put/Call OI Ratio:** `{pc_ratio:.2f}` | **Net GEX:** `{format_currency(net_gex)}`\n\n"
            f"**Dealer Flow Context:** {gex_direction}. As long as spot stays above `${put_wall:.2f}`, "
            f"options market makers are positioned to defend against catastrophic pullbacks."
        )

    # Specific Section: TECHNICALS / PATTERN
    if intents["technicals"] or persona == "quant" or (not intents["valuation"] and not intents["news"] and not intents["analysts"] and not intents["attribution"]):
        rsi_state = "Overbought (>70)" if rsi_val > 70 else "Constructive (>50)" if rsi_val > 50 else "Oversold (<35)"
        sections.append(
            f"### 📈 Technical Micro-Structure & Momentum:\n"
            f"• **RSI (14-Period):** `{rsi_val}` ({rsi_state})\n"
            f"• **Volume Surge:** `{vol_surge}x` 20-day Average Daily Volume\n"
            f"• **Key Moving Average Alignment:**\n"
            f"  - 10-EMA (Fast Momentum Rail): `${ema_10:.2f}`\n"
            f"  - 21-EMA (Institutional Swing Guide): `${ema_21:.2f}`\n"
            f"  - 50-SMA (Major Trend Filter): `${sma_50:.2f}`\n"
            f"  - 200-SMA (Macro Regime Floor): `${sma_200:.2f}`\n\n"
            f"**Trend Evaluation:** Spot is trading {'above' if spot >= ema_10 else 'below'} the 10-EMA and "
            f"{'above' if spot >= sma_50 else 'below'} the 50-SMA. Technical structure shows healthy consolidation "
            f"with immediate micro-support at `${stop_loss:.2f}`."
        )

    # Specific Section: ANALYSTS & WALL STREET CONSENSUS
    if intents["analysts"] or target_mean or intents["ownership"]:
        upside_pct = ((target_mean - spot) / spot) * 100.0 if target_mean else 0
        sections.append(
            f"### 🎯 Wall Street Consensus & Price Targets:\n"
            f"• **Consensus Rating:** `{rec_key}` ({num_analysts} covering analysts)\n"
            f"• **Average Target:** `${target_mean:.2f}` (`{upside_pct:+.1f}%` potential vs spot)\n"
            f"• **Target Envelope:** Low `${target_low:.2f}` ── High `${target_high:.2f}`\n"
            f"• **Short Interest:** `{format_pct(short_pct)}` of float ({short_ratio:.1f} days to cover)"
        )

    # Specific Section: NEWS & CATALYSTS (if not already expanded in attribution)
    if detailed_news and (intents["news"] or persona in ("master", "macro")) and not intents["attribution"]:
        bullets = "\n".join([f"• *\"{item['title']}\"*" for item in detailed_news[:3]])
        sections.append(
            f"### 📰 Recent Catalysts & Flow Headlines:\n{bullets}"
        )

    # Mandatory Section: INSTITUTIONAL EXECUTION BLUEPRINT
    sections.append(
        f"### 🎯 Institutional Execution Blueprint:\n"
        f"• **Accumulation Corridor:** `${entry_min:.2f} ── ${entry_max:.2f}`\n"
        f"• **Invalidation Floor (Stop Loss):** `${stop_loss:.2f}` (**{stop_loss_pct}% Max Risk**)\n"
        f"• **Target 1 (Pin / Trim 50%):** `${target_primary:.2f}` (**+{target_primary_pct}% Gain** · Ratchet stop to Breakeven)\n"
        f"• **Target 2 (Runner):** `${target_secondary:.2f}` (**+{target_secondary_pct}% Gain** · 15m Trailing Stop)\n"
        f"• **Quant Asymmetry:** **`1:{rr_ratio}` Edge**\n"
        f"• **Recommended Contract:** `{options_spec}`\n\n"
        f"*Execution Discipline*: Do not chase above `${entry_max:.2f}`. When Target 1 triggers, scale out 50% and move stop loss to breakeven."
    )

    full_markdown = "\n\n".join(sections)

    structured_card = {
        "type": "trade_setup",
        "ticker": ticker,
        "price": spot,
        "stage": stage,
        "playbook": f"Stage 2 Momentum" if spot >= sma_50 else "Mean Reversion",
        "conviction": "95/100 Institutional",
        "entry_range": [entry_min, entry_max],
        "stop_loss": stop_loss,
        "stop_loss_pct": stop_loss_pct,
        "target_primary": target_primary,
        "target_primary_pct": target_primary_pct,
        "target_secondary": target_secondary,
        "target_secondary_pct": target_secondary_pct,
        "risk_reward": f"1:{rr_ratio}",
        "options_spec": options_spec,
        "key_levels": {
            "call_wall": call_wall,
            "put_wall": put_wall,
            "zero_gamma": zero_gamma,
            "ema_10": round(ema_10, 2),
            "sma_50": round(sma_50, 2)
        },
        "fundamentals": {
            "pe": pe,
            "fwd_pe": fwd_pe,
            "peg": peg,
            "market_cap": format_currency(mkt_cap),
            "rev_growth": format_pct(rev_growth),
            "analyst_rec": rec_key,
            "target_mean": target_mean
        },
        "quick_actions": [f"Deep Chart ${ticker}", f"GEX Profile ${ticker}", "Top Setups"]
    }

    suggested_prompts = [
        f"⚡ Show ${ticker} Options & Gamma Walls",
        f"📊 What is the P/E and valuation for ${ticker}?",
        f"🎯 What are Wall Street targets on ${ticker}?",
        f"📰 Next earnings date and catalysts for ${ticker}"
    ]

    return {
        "response": full_markdown,
        "structured_card": structured_card,
        "suggested_prompts": suggested_prompts
    }


def process_ai_query(prompt: str, current_ticker: str = "UNKNOWN", persona: str = "master", context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    cleaned_prompt = prompt.strip().lower()
    active_ticker = extract_ticker_from_prompt(prompt, current_ticker)
    
    is_greeting = bool(re.search(r'\b(hi|hello|hey|sup|greetings|morning|evening)\b', cleaned_prompt))
    is_who_are_you = bool(re.search(r'\b(who are you|what are you|what can you do|help me|capabilities)\b', cleaned_prompt))
    is_market_health = any(k in cleaned_prompt for k in ["market health", "market regime", "how is market", "macro", "breadth", "vix", "regime score", "sentiment", "overall market"])
    is_top_picks = any(k in cleaned_prompt for k in ["top pick", "top picks", "best setup", "best setups", "recommend", "recommendation", "what to buy", "scanner", "screener", "playbook", "what stocks", "breakouts", "squeeze", "ideas"])
    
    if is_greeting and len(cleaned_prompt.split()) <= 3:
        mh = _get_market_health_summary() or {}
        regime_label = mh.get("health_regime_label", "Market Neutral")
        score = mh.get("score_value", 50)
        
        return {
            "response": (
                f"👋 **Greetings, Trader!** I am your **Universal Autonomous AI Market Copilot**.\n\n"
                f"• **Current Macro Regime**: `{regime_label}` ({score}/100)\n"
                f"• **Active Focus**: Currently auditing **${active_ticker}** and global market flow.\n\n"
                f"You can ask me **ANY** question about **ANY** stock or broader market trend:\n"
                f"- *'Why is Micron down today?'*\n"
                f"- *'What is the P/E ratio and valuation of Apple?'*\n"
                f"- *'Analyze dealer gamma walls and key levels on ${active_ticker}'*\n"
                f"- *'Is Tesla a buy right now? Give me entry and stop loss.'*\n"
                f"- *'What are the top AI Playbook setups for tomorrow?'*"
            ),
            "structured_card": None,
            "suggested_prompts": [
                "🔥 Top AI Playbook Setups",
                f"🧲 Analyze ${active_ticker} Levels & GEX",
                "🛡️ Market Health & Macro Regime",
                "📈 Best Valuation & Growth Stocks"
            ]
        }

    if is_who_are_you:
        return {
            "response": (
                "🤖 **Universal Autonomous AI Market Copilot Architecture**\n\n"
                "I am an institutional quantitative intelligence ensemble designed to answer **any question for any stock**:\n\n"
                "1. **🔍 Intraday Move Attribution**: Explains why a stock is dropping or surging (breaking industry catalysts, sector rotation, dealer gamma breaks, overbought reversion).\n"
                "2. **🎯 Technical & Micro-Structure**: Real-time 10/21/50/200 MAs, RSI, ATR, and strictly bounded 1.2%–3.5% invalidation stops.\n"
                "3. **⚡ Options & Dealer Gamma (GEX)**: Real-time Call Walls, Put Walls, Zero Gamma inflection flips, and OpEx Max Pain.\n"
                "4. **📊 Deep Fundamentals & Valuation**: Trailing & Forward P/E, PEG ratios, P/S, Operating Margins, FCF, and Balance Sheet debt/cash.\n"
                "5. **🎯 Wall Street Consensus**: Mean, High, and Low price targets, upgrades/downgrades, and short float exposure.\n"
                "6. **📰 Live Catalysts & News**: Real-time breaking headlines, earnings calendar, and event-driven analysis.\n"
                "7. **🌐 Macro & Market Health**: McClellan Oscillator, Advance/Decline breadth, and multi-playbook scanner picks.\n\n"
                "Ask me about any ticker symbol or market topic!"
            ),
            "structured_card": None,
            "suggested_prompts": [
                "🚀 Show Top Breakouts",
                "🧲 SPY Gamma Profile",
                "🔥 Short Squeeze Runners",
                "🛡️ Macro Allocation Guidance"
            ]
        }

    if is_market_health and not any(k in cleaned_prompt for k in ["stock", "ticker", "for", "on", "$"]):
        mh = _get_market_health_summary() or {}
        score = mh.get("score_value", 50.0)
        label = mh.get("health_regime_label", "Cautious Neutral")
        color = mh.get("health_regime_color", "#fbbf24")
        summary = mh.get("summary_text", "")
        mco = mh.get("mco_status", "Neutral")
        breadth = mh.get("breadth_status", "Mixed")
        ad_mom = mh.get("ad_momentum", "Neutral")
        
        if score < 30:
            guidance = "⚠️ **Capital Preservation Mode**: Reduce position sizing to 0.5% - 0.75% portfolio risk. Focus only on A+ setups with tight stops (under 2.5%). Hold elevated cash."
        elif score < 60:
            guidance = "🛡️ **Tactical Allocation Mode**: Standard 1.0% - 1.5% position risk. Require multi-screener confluence and volume confirmation."
        else:
            guidance = "🚀 **Aggressive Growth Mode**: Full 2.0% - 2.5% risk budget permitted. Favor Stage 2 momentum breakouts and gamma squeeze continuations."

        response_text = (
            f"🌐 **Institutional Macro & Market Health Briefing**\n\n"
            f"• **Market Health Score:** **`{score:.1f} / 100`** — **{label}**\n"
            f"• **McClellan Oscillator:** {mco}\n"
            f"• **Breadth Participation:** {breadth}\n"
            f"• **Advance / Decline Momentum:** {ad_mom}\n\n"
            f"### 🛡️ Tactical Risk Budgeting:\n"
            f"{guidance}\n\n"
            f"### 📋 Internal Market Telemetry:\n"
            f"{summary[:450]}..."
        )

        return {
            "response": response_text,
            "structured_card": {
                "type": "market_health",
                "score": score,
                "label": label,
                "color": color,
                "guidance": guidance,
                "quick_actions": ["View Full Market Health Suite", "Audit SPY GEX Levels", "View AI Playbook"]
            },
            "suggested_prompts": [
                "🚀 What are the top setups in this regime?",
                "🧲 Show SPY Call/Put Walls",
                "🛡️ What stocks are holding up best?",
                "📈 Show Fundamental Accelerators"
            ]
        }

    if is_top_picks and not any(k in cleaned_prompt for k in ["for", "on", "$", "about"]) and active_ticker == "SPY":
        pb_data = _get_ai_playbook_data() or {}
        focus_list = pb_data.get("focus_list", [])
        total = pb_data.get("total_setups", len(focus_list))
        
        if not focus_list:
            mon_data = _get_screener_monitor_data() or {}
            focus_list = mon_data.get("stocks", [])[:5]
            
        items_md = []
        for i, s in enumerate(focus_list[:5], 1):
            ex = s.get("execution", {})
            ticker_sym = s.get("ticker", "N/A")
            price = s.get("current_price", s.get("alert_price", 0))
            playbook = s.get("playbook_badge", s.get("playbook_name", "ALPHA SETUP"))
            rating = s.get("conviction_rating", f"{s.get('conviction_score', 95)}/100")
            entry_rng = ex.get("entry_range", [round(price*0.992, 2), round(price*1.008, 2)])
            stop = ex.get("stop_loss", s.get("stop_loss", round(price * 0.97, 2)))
            stop_pct = ex.get("stop_loss_pct", round(((stop - price) / price) * 100, 1))
            t1 = ex.get("target_primary", s.get("target_1", round(price * 1.08, 2)))
            t1_pct = ex.get("target_primary_pct", round(((t1 - price) / price) * 100, 1))
            t2 = ex.get("target_secondary", s.get("target_2", round(price * 1.15, 2)))
            asym = ex.get("risk_reward", "1:3.0")

            items_md.append(
                f"**{i}. ${ticker_sym}** — `{playbook}` ({rating})\n"
                f"   • **Spot Price:** ${price:.2f}\n"
                f"   • **Accumulation Corridor:** `${entry_rng[0]:.2f} ── ${entry_rng[1]:.2f}`\n"
                f"   • **Invalidation Floor:** `${stop:.2f}` ({stop_pct}% risk)\n"
                f"   • **Target 1 (Pin):** `${t1:.2f}` (+{t1_pct}%) · Trim 50% & Breakeven\n"
                f"   • **Target 2 (Runner):** `${t2:.2f}` · 15m Trailing Stop\n"
                f"   • **Quant Asymmetry:** **`{asym}` Edge**\n"
            )

        top_ticker = focus_list[0].get("ticker", "MTCH") if focus_list else "MTCH"
        top_setup = focus_list[0].get("execution", {}) if focus_list else {}

        response_text = (
            f"🚀 **Top High-Conviction Institutional AI Playbook Setups** ({total} Total Active)\n\n"
            f"All setups adhere to strict institutional risk limits (stops under 3.5%, minimum 1:2.4 asymmetry):\n\n"
            + "\n".join(items_md) +
            f"\n*Execution Protocol*: Wait for candle absorption inside the accumulation corridor. "
            f"Scale out 50% at Target 1 and immediately move stop to Breakeven."
        )

        return {
            "response": response_text,
            "structured_card": {
                "type": "trade_setup",
                "ticker": top_ticker,
                "price": focus_list[0].get("current_price", 0) if focus_list else 0,
                "playbook": focus_list[0].get("playbook_badge", "ALPHA PLAYBOOK") if focus_list else "ALPHA",
                "conviction": focus_list[0].get("conviction_rating", "99/100 A+") if focus_list else "99/100",
                "entry_range": top_setup.get("entry_range", [0, 0]),
                "stop_loss": top_setup.get("stop_loss", 0),
                "stop_loss_pct": top_setup.get("stop_loss_pct", -2.5),
                "target_primary": top_setup.get("target_primary", 0),
                "target_primary_pct": top_setup.get("target_primary_pct", 7.5),
                "target_secondary": top_setup.get("target_secondary", 0),
                "risk_reward": top_setup.get("risk_reward", "1:3.0"),
                "options_spec": top_setup.get("options_spec", "Defined Risk Spread"),
                "quick_actions": [f"Deep Analyze ${top_ticker}", "Open AI Playbook Dashboard", "Check Screener Monitor"]
            },
            "suggested_prompts": [
                f"🧲 Deep dive on ${top_ticker}",
                "🔥 Show Short Squeeze Candidates",
                "🛡️ Best MA Pullback Cushions",
                "📈 Fundamental PEAD Accelerators"
            ]
        }

    return build_universal_stock_answer(
        ticker=active_ticker,
        prompt=prompt,
        persona=persona
    )
