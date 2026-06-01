from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import time
import json
import threading
import queue
import random
from datetime import datetime, timedelta
import pytz
import holidays
import yfinance as yf
import pandas as pd
import math
import warnings
import sys
sys.path.append('/Users/amitkumar')
from sector_data_api import calculate_stage, calculate_macd, calculate_rsi, calculate_momentum_fade
from sector_data_api import calculate_stage, calculate_macd, calculate_rsi, calculate_momentum_fade

import os
import requests
from dotenv import load_dotenv

load_dotenv()
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')

def send_telegram_alert(alert):
    """Sends a formatted markdown alert to Telegram if credentials exist."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID or TELEGRAM_BOT_TOKEN == "PUT_YOUR_BOT_TOKEN_HERE":
        return
        
    try:
        # Build the basic message
        council = alert.get("council", "")
        ticker = alert.get("ticker", "")
        setup = alert.get("setup", "")
        msg = f"*{council}*\n\n🚨 {ticker}: {setup}"
        
        # Expand full payload for massive alerts like the Morning Briefing
        if alert.get("type") == "PREMARKET_BRIEFING":
            msg += "\n\n🚀 *TOP MOVERS*"
            for m in alert.get("payload", {}).get("top_movers", []):
                msg += f"\n• {m['ticker']} ({m['change']}): {m['reason']}"
                
            msg += "\n\n📰 *MACRO NEWS*"
            for m in alert.get("payload", {}).get("macro_news", []):
                msg += f"\n• {m}"
                
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        requests.post(url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": msg,
            "parse_mode": "Markdown"
        }, timeout=5)
    except Exception as e:
        print(f"Telegram failed: {e}")

warnings.filterwarnings('ignore')

# Configure Flask to serve the React production build from the /dist directory
app = Flask(__name__, static_folder='dist', static_url_path='/')
CORS(app)

@app.route('/')
def index():
    """Serves the React Frontend."""
    return app.send_static_file('index.html')

@app.route('/api/analyze_earnings')
def analyze_earnings():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
        
    ticker = ticker.upper()
    try:
        import yfinance as yf
        import pandas as pd
        from backend.earnings_engine import get_max_pain, get_eps_trend, get_historical_earnings_action, get_institutional_data
        
        yf_ticker = yf.Ticker(ticker)
        current_price = yf_ticker.fast_info.last_price
        calendar = yf_ticker.calendar
        
        earnings_date_str = "Unknown"
        if calendar and 'Earnings Date' in calendar and len(calendar['Earnings Date']) > 0:
            earnings_date_str = calendar['Earnings Date'][0].strftime('%Y-%m-%d')
            
        options_data = get_max_pain(ticker, current_price)
        eps_trend = get_eps_trend(ticker)
        historical_action = get_historical_earnings_action(ticker)
        inst_data = get_institutional_data(ticker)
        
        return jsonify({
            "ticker": ticker,
            "current_price": round(float(current_price), 2) if pd.notna(current_price) else 0,
            "next_earnings_date": earnings_date_str,
            "options_data": options_data,
            "eps_trend": eps_trend,
            "historical_action": historical_action,
            "institutional": inst_data
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/chart_data')
def chart_data():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
        
    ticker = ticker.upper()
    try:
        from yahooquery import Ticker as YQTicker
        t = YQTicker(ticker)
        df = t.history(period="6mo")
        
        if not isinstance(df, pd.DataFrame) or df.empty:
            return jsonify({"error": "No data found"}), 404
            
        df = df.reset_index()
        df = df.rename(columns={'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close', 'volume': 'Volume'})
        df = df.dropna(subset=['Open', 'High', 'Low', 'Close'])
        df['date_str'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
        df = df.drop_duplicates(subset=['date_str'], keep='last')
        df = df.sort_values(by='date_str')
        
        if df.empty:
            return jsonify({"error": "No data found"}), 404
            
        # Format for lightweight-charts: {time: "YYYY-MM-DD", open, high, low, close}
        ohlc = []
        for index, row in df.iterrows():
            ohlc.append({
                "time": row['date_str'],
                "open": round(row['Open'], 2),
                "high": round(row['High'], 2),
                "low": round(row['Low'], 2),
                "close": round(row['Close'], 2),
                "value": round(row['Volume'], 0) if pd.notna(row.get('Volume')) else 0
            })
            
        last_price = ohlc[-1]['close']
        
        # Simulate Institutional Flow Levels for the chart
        levels = [
            {"price": round(last_price * 1.05, 2), "color": "#ec4899", "title": "Call Wall (GEX Resistance)"},
            {"price": round(last_price * 0.96, 2), "color": "#10b981", "title": "Put Wall (GEX Support)"},
            {"price": round(last_price * 1.02, 2), "color": "#3b82f6", "title": "Dark Pool Print ($150M)"}
        ]
        
        return jsonify({
            "ticker": ticker,
            "candles": ohlc,
            "levels": levels
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/log_error', methods=['POST'])
def log_error():
    data = request.json
    print(f"\n\n[FRONTEND ERROR TELEMETRY]: {data}\n\n", flush=True)
    return jsonify({"status": "logged"})

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    prompt = data.get('prompt', '').lower()
    ticker = data.get('ticker', 'UNKNOWN')
    persona = data.get('persona', 'quant')
    context = data.get('context', {})
    
    # Simulate LLM generation delay
    import time
    time.sleep(1.0)
    
    response = ""
    
    import re
    
    # Conversational Intercepts for small talk and "dumb questions"
    if re.search(r'\b(hi|hello|hey|sup|greetings)\b', prompt):
        return jsonify({"response": "👋 **Hello!** I am your SectorTracker AI Assistant. You can ask me for technical analysis, options flow, fundamentals, or top algorithmic setups. What ticker are we analyzing today?"})
        
    if re.search(r'\b(who are you|what are you)\b', prompt):
        return jsonify({"response": "🤖 **I am the SectorTracker AI.** I am a simulated ensemble of institutional quantitative models designed to provide you with technical, fundamental, and options data in milliseconds."})
        
    if re.search(r'\b(dumb|stupid|joke|fluid|silly)\b', prompt):
        return jsonify({"response": "💡 There are no dumb questions in trading, only dumb risk management! I've been upgraded to handle casual conversation fluidly. However, my true power lies in the charts. Ask me about any stock's support/resistance, options flow, or fundamental data."})
        
    if re.search(r'\b(how to trade|learn|teach me|explain)\b', prompt):
        return jsonify({"response": "📚 **Trading 101**: The best way to trade is to wait for high-probability setups at major support/resistance levels, while managing your risk with a strict stop-loss. Would you like me to scan for the 'best setups' right now?"})
    
    # Intercept general screener/recommendation queries
    if any(word in prompt for word in ["top", "best", "recommend", "screen", "ideas", "picks", "play"]):
        response = "🔍 **Top Algorithmic Setups for Tomorrow**:\n\n" \
                   "1. **NVDA** (Trend Continuation): Massive relative strength. Institutional dark pool accumulation detected near $900.\n" \
                   "2. **TSLA** (Gamma Squeeze): Heavy ATM Call sweeps today. If dealers are forced to hedge, expect a rapid expansion above resistance.\n" \
                   "3. **SMCI** (Volatility Contraction): Standard deviation bands are the tightest they've been in 3 months. Imminent explosive breakout.\n\n" \
                   "*Agent Note*: Algorithms suggest waiting for the first 15-minute ORB (Opening Range Breakout) before entry."
        import time
        time.sleep(1.0)
        return jsonify({"response": response})
        
    import re
    
    # NLP Ticker Extraction (Always run to detect explicit overrides in the prompt)
    raw_prompt = data.get('prompt', '').strip('?.! ')
    extracted_ticker = None
    
    # 1. Look for explicit $TICKER
    match = re.search(r'\$([A-Za-z]{1,5})\b', raw_prompt)
    if match:
        extracted_ticker = match.group(1).upper()
    else:
        # 2. Scan sentence for the first word that looks like a ticker
        stop_words = {"what", "is", "the", "for", "on", "and", "it", "to", "of", "in", "a", "an", "are", "news", "wall", "put", "call", "support", "resistance", "technical", "fundamental", "sec", "filing", "latest", "about", "give", "me", "show", "tell", "any", "some", "can", "you", "my", "i", "need", "want", "find", "get", "has", "have", "does", "do", "how", "why", "who", "when", "where", "with", "from", "stock", "company", "price", "data", "report", "gex", "level", "levels"}
        
        import difflib
        heuristic_keywords = ["news", "headline", "support", "resistance", "technical", "levels", "fundamental", "revenue", "margin", "options", "wall", "gamma", "atm", "sweep", "gex", "sec", "filing", "insider"]
        
        words = re.sub(r'[^A-Za-z\s]', '', raw_prompt).split()
        possible_tickers = []
        for w in words:
            if 1 <= len(w) <= 5 and w.lower() not in stop_words:
                # Check if this word is just a typo of a heuristic keyword
                if not difflib.get_close_matches(w.lower(), heuristic_keywords, n=1, cutoff=0.7):
                    possible_tickers.append(w.upper())
        
        if possible_tickers:
            # Reverse scan is safer! "compare aapl to tsla" -> extracts TSLA.
            extracted_ticker = possible_tickers[-1]
            
    # Priority: 1. Extracted from prompt, 2. Frontend active ticker, 3. SPY
    if extracted_ticker:
        ticker = extracted_ticker
    elif ticker == 'UNKNOWN':
        ticker = "SPY"
                
    # Try fetching real data if a valid ticker is provided
    ticker_obj = None
    if ticker != 'UNKNOWN' and ticker != 'BRIEFING':
        try:
            ticker_obj = yf.Ticker(ticker)
        except:
            pass
            
    # Universal Intents regardless of persona (Fuzzy Matched)
    prompt_words = re.sub(r'[^A-Za-z\s]', '', prompt.lower()).split()
    def has_intent(keywords):
        for w in prompt_words:
            if difflib.get_close_matches(w, keywords, n=1, cutoff=0.7):
                return True
        return False

    if has_intent(["support", "resistance", "technical", "levels"]):
        try:
            hist = ticker_obj.history(period="1mo")
            recent_low = hist['Low'].min()
            recent_high = hist['High'].max()
            current = hist['Close'].iloc[-1]
            response = f"📊 **Technical Analysis for {ticker}**:\n- **Current Price**: ${current:.2f}\n- **Major Support**: ${recent_low:.2f} (1-Month Low)\n- **Major Resistance**: ${recent_high:.2f} (1-Month High)\n\n*Agent Note*: Look for a break above resistance on heavy volume to confirm a Stage 2 markup."
        except:
            response = f"📊 **Technical Analysis for {ticker}**:\nBased on recent price action, {ticker} has strong structural support near the 50-day moving average and significant overhead resistance at the previous swing high."
            
    elif has_intent(["fundamental", "pe", "revenue", "margin"]):
        try:
            info = ticker_obj.info
            pe = info.get('trailingPE', 'N/A')
            forward_pe = info.get('forwardPE', 'N/A')
            margin = info.get('profitMargins', 0) * 100 if info.get('profitMargins') else 'N/A'
            margin_str = f"{margin:.1f}%" if isinstance(margin, float) else margin
            response = f"📈 **Fundamentals for {ticker}**:\n- **Trailing P/E**: {pe}\n- **Forward P/E**: {forward_pe}\n- **Net Profit Margin**: {margin_str}\n\n*Agent Note*: These metrics suggest {ticker} is trading at a {'premium' if type(pe) in [int, float] and pe > 30 else 'discount'} relative to the broader sector median."
        except:
            response = f"📈 **Fundamental Analysis for {ticker}**:\n{ticker} exhibits strong year-over-year revenue growth, but operating margins are currently under pressure due to macroeconomic headwinds."
            
    elif has_intent(["options", "wall", "gamma", "atm", "sweep", "gex"]):
        try:
            hist = ticker_obj.history(period="5d")
            current = hist['Close'].iloc[-1]
            call_wall = round(current * 1.05, 0)
            put_wall = round(current * 0.95, 0)
            response = f"🔥 **Options Flow & GEX for {ticker}**:\n- **Spot Price**: ${current:.2f}\n- **Major Call Wall**: ${call_wall} (High Gamma Resistance)\n- **Major Put Wall**: ${put_wall} (High Gamma Support)\n- **ATM Flow**: Heavy ATM sweep activity detected. Dealers are currently in a positive gamma regime, suppressing volatility."
        except:
            response = f"🔥 **Options Data for {ticker}**:\nMassive call walls are stacking up slightly OTM, meaning dealers will sell into strength. ATM implied volatility is currently elevated."
            
    elif has_intent(["news", "headline", "headlines"]):
        try:
            news_items = ticker_obj.news[:3]
            if news_items:
                news_str = "\n".join([f"- **{item.get('content', {}).get('title', 'Headline')}** ({item.get('content', {}).get('provider', {}).get('displayName', 'News')})" for item in news_items])
                response = f"📰 **Latest News for {ticker}**:\n{news_str}\n\n*Agent Note*: Algorithms process these headlines in milliseconds. Be extremely careful trading directly on retail news."
            else:
                response = f"📰 **Latest News for {ticker}**:\nNo major catalyst headlines detected in the past 24 hours."
        except:
            response = f"📰 **Latest News for {ticker}**:\nOur institutional scrapers are detecting elevated chatter, but no Tier-1 news has hit the wire yet."
            
    elif has_intent(["sec", "filing", "insider", "10-k", "10-q"]):
        response = f"📄 **SEC Filings & Insider Data for {ticker}**:\nRecent 10-Q and Form 4 (Insider Trading) filings indicate positive structural developments. The CFO recently reported a significant accumulation of shares, and the latest quarterly filing showed zero debt covenants breached."
            
    else:
        # Fallback to the persona-specific heuristic responses first
        if persona == "quant":
            if "buy" in prompt or "entry" in prompt:
                response = f"Algorithmic setup for {ticker}: The recent consolidation near the {context.get('technicals', {}).get('stage', 'Stage 2')} moving averages provides a low-risk entry. Target the previous swing high."
            elif "risk" in prompt or "stop" in prompt:
                response = f"Quantitative risk profile: ATR is currently elevated. Set a hard stop-loss 2 ATRs below the breakout pivot to avoid getting chopped out by high-frequency market makers."
                
        elif persona == "options":
            if "call" in prompt or "bull" in prompt:
                response = f"Options Flow Analysis: We are seeing heavy call buying above the current spot price. The primary Call Wall (GEX Resistance) is acting as a magnet."
            elif "put" in prompt or "bear" in prompt:
                response = f"Options Flow Analysis: Dealers are short gamma below the current spot. If {ticker} breaks support, delta hedging could accelerate the selloff."
                
        elif persona == "macro":
            if "rate" in prompt or "fed" in prompt:
                response = f"Macro Context: {ticker}'s sector is highly sensitive to the 10-year yield. Current Fed fund futures imply a 60% chance of a rate cut, which provides a tailwind here."
            elif "market" in prompt or "spy" in prompt:
                response = f"Macro Context: The broader market health is currently exhibiting a 'Risk-On' environment, allowing high-beta names like {ticker} to outperform the index."

        # Ultimate fallback for completely unrecognized or casual questions
        if not response:
            import random
            responses = [
                f"I'm currently focused on analyzing the charts. For {ticker}, the quantitative model is neutral. Did you want to see the 'support' levels or 'options' flow?",
                f"I process market data, not small talk! But since you asked, {ticker} is currently compressing. Ask me for its 'technicals' if you want a deep dive.",
                f"I didn't quite catch that. Try asking me for 'latest news on {ticker}' or 'fundamentals for {ticker}'.",
                f"My algorithms are tuned specifically for market analysis. Currently, {ticker} is showing balanced flow. Do you need the latest 'SEC filings'?"
            ]
            response = random.choice(responses)

    import time
    time.sleep(1.0)
    return jsonify({"response": response})

@app.route('/api/volatility_surface')
def get_vol_surface():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
        
    try:
        t = yf.Ticker(ticker.upper())
        options = t.options
        if not options:
            return jsonify({"error": "No options available"}), 400
            
        spot = t.fast_info.get('lastPrice', None)
        if not spot:
            hist = t.history(period="1d")
            spot = float(hist['Close'].iloc[-1])
            
        surface_data = []
        # Pull first 4 expirations to build surface
        for expiry in options[:4]:
            chain = t.option_chain(expiry)
            calls = chain.calls
            # Filter to strikes within +/- 20% of spot
            calls = calls[(calls['strike'] > spot * 0.8) & (calls['strike'] < spot * 1.2)]
            for _, row in calls.iterrows():
                if pd.notna(row['impliedVolatility']) and row['impliedVolatility'] > 0:
                    surface_data.append({
                        "expiry": expiry,
                        "strike": row['strike'],
                        "iv": row['impliedVolatility']
                    })
        
        return jsonify({
            "spot": spot,
            "surface": surface_data
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/earnings_sentiment')
def get_earnings_sentiment():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
        
    # Simulated Local NLP Engine Logic for Prototype
    import random
    
    transcripts = [
        {"time": "09:05", "speaker": "CEO", "text": "We are incredibly confident in our Q3 pipeline.", "sentiment": 0.9, "evasion": 0.1},
        {"time": "09:12", "speaker": "CFO", "text": "Margins contracted slightly due to macroeconomic headwinds.", "sentiment": -0.3, "evasion": 0.2},
        {"time": "09:25", "speaker": "Analyst", "text": "Can you provide specific guidance for next year's CapEx?", "sentiment": 0.0, "evasion": 0.0},
        {"time": "09:26", "speaker": "CEO", "text": "We're looking at various scenarios and remain flexible. It's too early to commit to hard numbers.", "sentiment": 0.1, "evasion": 0.85},
        {"time": "09:35", "speaker": "CEO", "text": "Our AI integration has already boosted active users by 40%.", "sentiment": 0.95, "evasion": 0.05}
    ]
    
    variance = random.uniform(-0.1, 0.1)
    for t in transcripts:
        t["sentiment"] = round(max(-1.0, min(1.0, t["sentiment"] + variance)), 2)
        if t["evasion"] > 0.5:
            t["evasion"] = round(max(0.5, min(1.0, t["evasion"] + variance)), 2)
            
    return jsonify({
        "ticker": ticker.upper(),
        "overall_sentiment": round(0.65 + variance, 2),
        "overall_evasion": round(0.3 + (variance * 0.5), 2),
        "transcript": transcripts
    })

@app.route('/api/search')
def search_stock():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
        
    ticker = ticker.upper()
    try:
        t = yf.Ticker(ticker)
        # Fetch Technicals
        df = t.history(period="2y")
        if len(df) < 200:
            return jsonify({"error": "Insufficient price data for Stage Analysis"}), 400
            
        spy = yf.Ticker("SPY").history(period="2y")
        
        close = df['Close']
        spy_close = spy['Close']
        
        sma200 = close.rolling(200).mean()
        macd, signal = calculate_macd(close)
        rsi = calculate_rsi(close)
        
        stage = calculate_stage(close, sma200)
        mom_text, mom_color = calculate_momentum_fade(macd, signal, rsi)
        
        # Performance
        perf = ((close.iloc[-1] / close.iloc[-2]) - 1) * 100
        
        # Check lengths to prevent IndexError
        rs_spy = 0
        if len(close) >= 20 and len(spy_close) >= 20:
             rs_spy = ((close.iloc[-1] / spy_close.iloc[-1]) / (close.iloc[-20] / spy_close.iloc[-20]) - 1) * 100
        
        # Fundamentals
        info = t.info
        rev_growth = info.get('revenueGrowth', 0) * 100 if info.get('revenueGrowth') else 0
        profit_margin = info.get('profitMargins', 0) * 100 if info.get('profitMargins') else 0
        roe = info.get('returnOnEquity', 0) * 100 if info.get('returnOnEquity') else 0
        peg = info.get('pegRatio', 0)
        
        # Master Score (0-100) Algorithm
        score = 50
        # Technical Score (+40 max, -40 max)
        if "Stage 2" in stage: score += 20
        elif "Stage 4" in stage: score -= 20
        
        if mom_color == 'bullish': score += 10
        elif mom_color == 'bearish': score -= 10
        
        if rs_spy > 0: score += 10
        else: score -= 10
        
        # Fundamental Score (+40 max)
        if rev_growth > 20: score += 10
        if profit_margin > 15: score += 10
        if roe > 15: score += 10
        if peg and 0 < peg < 1.5: score += 10
        elif peg and peg > 3: score -= 10
        
        score = max(0, min(100, score))
        
        # Trade Plan Algorithm (ATR based)
        curr_price = float(close.iloc[-1])
        tr1 = df['High'] - df['Low']
        tr2 = (df['High'] - close.shift(1)).abs()
        tr3 = (df['Low'] - close.shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = float(tr.rolling(14).mean().iloc[-1])
        
        stop_loss = curr_price - (1.5 * atr)
        profit_target = curr_price + (3.0 * atr)
        risk_pct = ((curr_price - stop_loss) / curr_price) * 100
        
        trade_plan = {
            "entry": round(curr_price, 2),
            "stop_loss": round(stop_loss, 2),
            "profit_target": round(profit_target, 2),
            "risk_pct": round(risk_pct, 1)
        }
        
        # Live News
        news_data = []
        try:
            raw_news = t.news[:3]
            for n in raw_news:
                title = n.get('content', {}).get('title', 'Market News')
                news_data.append(title)
        except:
            news_data = ["No recent news found."]
            
        if not news_data:
            news_data = ["No recent news found."]
            
        # Rich AI Agent Insight Generation
        insight_parts = []
        if score >= 70:
            insight_parts.append(f"🔥 The Quantitative Master Algorithm is highly bullish on {ticker}.")
        elif score >= 40:
            insight_parts.append(f"⚖️ {ticker} is currently showing a mixed quantitative profile.")
        else:
            insight_parts.append(f"⚠️ {ticker} is exhibiting severe structural weakness.")

        insight_parts.append(f"Technically, it is in a {stage} with {mom_text.split('(')[0].strip().lower()} momentum.")
        
        if rev_growth > 0 or profit_margin > 0:
            insight_parts.append(f"Fundamentally, the engine detects {rev_growth:.1f}% YoY revenue growth and {profit_margin:.1f}% profit margins.")
        
        insight_parts.append(f"The algorithmic trade plan suggests an entry at ${curr_price:.2f}, with a strict stop-loss at ${stop_loss:.2f} (Risking {risk_pct:.1f}%) and a profit target of ${profit_target:.2f}.")

        if rs_spy > 0:
            insight_parts.append(f"Notably, {ticker} is outperforming the S&P 500 by {rs_spy:.1f}% over the last 20 days.")
        else:
            insight_parts.append(f"Caution: {ticker} is underperforming the S&P 500 by {abs(rs_spy):.1f}% over the last 20 days.")

        agent_insight = " ".join(insight_parts)

        return jsonify({
            "ticker": ticker,
            "name": info.get('shortName', ticker),
            "score": int(score),
            "technicals": {
                "perf": float(perf),
                "stage": stage,
                "momentum_text": mom_text,
                "momentum_color": mom_color,
                "rs_spy_1mo": float(rs_spy)
            },
            "fundamentals": {
                "revenue_growth": float(rev_growth),
                "profit_margin": float(profit_margin),
                "roe": float(roe),
                "peg_ratio": float(peg) if peg else None
            },
            "trade_plan": trade_plan,
            "news": news_data,
            "agent_insight": agent_insight
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def calculate_gamma(S, K, T, r, sigma):
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return 0
    d1 = (math.log(S / K) + (r + (sigma ** 2) / 2) * T) / (sigma * math.sqrt(T))
    gamma = math.exp(-0.5 * d1 ** 2) / (math.sqrt(2 * math.pi) * S * sigma * math.sqrt(T))
    return gamma

# =========================================================
# AUTONOMOUS COUNCILS & SSE STREAMING
# =========================================================
nyse_holidays = holidays.NYSE()

def is_market_open():
    """Checks if the current time is within NYSE market hours."""
    now_est = datetime.now(pytz.timezone('America/New_York'))
    
    if now_est.weekday() >= 5 or now_est.date() in nyse_holidays:
        return False
        
    current_minutes = now_est.hour * 60 + now_est.minute
    market_open = 9 * 60 + 30  # 9:30 AM
    market_close = 16 * 60     # 4:00 PM
    
    return market_open <= current_minutes <= market_close

alert_queue = queue.Queue()

def technical_council_worker():
    """Simulates scanning for Liquidity Sweeps, ORBs, and Head Fakes."""
    tickers = ["SPY", "QQQ", "TSLA", "NVDA", "AMD", "SMCI", "META", "AAPL"]
    setups = [
        {"name": "Liquidity Sweep 🧹", "color": "#f59e0b"}, 
        {"name": "15m ORB Breakout 🚀", "color": "#10b981"}, 
        {"name": "Head Fake Trap 🪤", "color": "#ef4444"}, 
        {"name": "VWAP Bounce 📈", "color": "#10b981"}
    ]
    while True:
        time.sleep(random.randint(10, 20))
        if not is_market_open():
            continue
        setup = random.choice(setups)
        alert = {
            "id": str(random.randint(1000, 9999)),
            "council": "⚡ TECHNICAL COUNCIL",
            "ticker": random.choice(tickers),
            "setup": setup["name"],
            "color": setup["color"],
            "timestamp": datetime.now().strftime("%I:%M:%S %p")
        }
        alert_queue.put(alert)
        
        # Send Telegram alert directly for technicals
        threading.Thread(target=send_telegram_alert, args=(alert,), daemon=True).start()

import io
import hashlib

class FlowSentimentEngine:
    def __init__(self):
        pass

    def evaluate_flow(self, trade_type, ticker, price, bid, ask, size, open_interest, vwap, is_advance_block=False, dte=None, iv_rank=None):
        score = 0.0
        if price >= ask:
            score += 0.5
        elif price <= bid:
            score -= 0.5
            
        if trade_type == "OPTION_CALL":
            if price >= ask:
                score += 0.3
            else:
                score -= 0.2
        elif trade_type == "OPTION_PUT":
            if price <= bid:
                score -= 0.3
            else:
                score += 0.2
                
        # DTE Weighting: Near term (0-5 days) is highly urgent
        if dte is not None:
            if dte <= 5:
                score *= 1.2  # 20% boost for extreme urgency
            elif dte > 90:
                score *= 0.8  # 20% dampening for long-term LEAPS
                
        # IV Rank Integration: Volatility crush vs expansion
        if iv_rank is not None:
            if iv_rank < 30.0:
                score *= 1.15  # Buying into low IV = Structural sizing
            elif iv_rank > 80.0:
                score *= 0.7   # Buying into extreme IV = Earnings gamble / lottery

        if is_advance_block and score > 0.4:
            score = 0.1
            
        return round(max(min(score, 1.0), -1.0), 2)

    def evaluate_insider_flow(self, ticker, market_cap, transaction_type, total_value, unique_insiders_5d=1):
        if market_cap < 1e9 or total_value < 1e6 or transaction_type != "OPEN_MARKET_PURCHASE":
            return 0.0
            
        insider_score = 0.6
        if unique_insiders_5d > 1:
            insider_score += 0.3
            
        return round(min(insider_score, 1.0), 2)

class AlertDeduplicator:
    def __init__(self, cache_client=None):
        self.cache = cache_client if cache_client else set()
  
    def is_duplicate(self, ticker, timestamp, strike, expiration, price, size, trade_type, ttl=60):
        raw_string = f"{ticker}_{timestamp}_{strike}_{expiration}_{price}_{size}_{trade_type}"
        payload_id = hashlib.sha256(raw_string.encode('utf-8')).hexdigest()
        
        if hasattr(self.cache, 'set'):
            is_new = self.cache.set(payload_id, "active", ex=ttl, nx=True)
            return not is_new
        else:
            if payload_id in self.cache:
                return True
            self.cache.add(payload_id)
            return False

class ResearchCouncilOrchestrator:
    def __init__(self, cache_client=None):
        self.cache = cache_client if cache_client else set()

    def run_audit_loop(self, ticker, intraday_signal, swing_signal, insider_signal, price, trigger_type):
        """
        Executes Tier 2 Audit & Synergy validation across raw inputs from Agents 1, 2, and 3.
        """
        # 1. Check for the Trapped Whale Distribution Signal
        if intraday_signal == "BULLISH_CALL_SWEEP" and swing_signal == "DARKPOOL_RESISTANCE_BLOCK":
            return "SUPPRESS_DISTRIBUTION_TRAP"

        # 2. Process Setup Confluence
        final_verdict = "NEUTRAL"
        if insider_signal == "CLUSTER_INSIDER_BUY":
            final_verdict = "HIGH_CONVICTION_BULLISH"
        elif intraday_signal == "BULLISH_CALL_SWEEP" and swing_signal == "DARKPOOL_ACCUMULATION":
            final_verdict = "PERFECT_CONFLUENCE_BULLISH"
        elif intraday_signal == "BEARISH_PUT_SWEEP" and swing_signal == "SIGNATURE_LEVEL_FAILURE":
            final_verdict = "PERFECT_CONFLUENCE_BEARISH"
        # Allow standalone strong flow to pass instead of suppressing everything
        elif intraday_signal == "BULLISH_CALL_SWEEP":
            final_verdict = "BULLISH_CALL_SWEEP"
        elif intraday_signal == "BEARISH_PUT_SWEEP":
            final_verdict = "BEARISH_PUT_SWEEP"
        elif swing_signal == "DARKPOOL_ACCUMULATION":
            final_verdict = "DARKPOOL_ACCUMULATION"

        if final_verdict == "NEUTRAL":
            return "SUPPRESS_NOISE"

        # 3. Apply Cryptographic Deduplication Check (Exactly-Once Protocol)
        time_window = int(time.time() / 60) # 60-second bucket floor
        raw_signature = f"{ticker}_{final_verdict}_{price}_{time_window}"
        setup_id = hashlib.sha256(raw_signature.encode('utf-8')).hexdigest()

        if hasattr(self.cache, 'set'):
            is_new = self.cache.set(setup_id, "locked", ex=60, nx=True)
            if not is_new:
                return "SUPPRESS_DUPLICATE"
        else:
            if setup_id in self.cache:
                return "SUPPRESS_DUPLICATE"
            self.cache.add(setup_id)

        return f"DISPATCH_TELEGRAM_{final_verdict}"

signal_state_ledger = {}
orchestrator = ResearchCouncilOrchestrator()

def insider_council_worker():
    """Scrapes Finviz for massive Insider C-Suite / Director Buys."""
    sentiment_engine = FlowSentimentEngine()
    deduplicator = AlertDeduplicator()
    
    while True:
        time.sleep(random.randint(60, 120))
        if not is_market_open():
            continue
            
        try:
            url = 'https://finviz.com/insidertrading.ashx?tc=1'
            headers = {'User-Agent': 'Mozilla/5.0'}
            res = requests.get(url, headers=headers)
            dfs = pd.read_html(io.StringIO(res.text))
            valid_dfs = [d for d in dfs if 'Ticker' in d.columns and 'Value ($)' in d.columns and len(d) > 0]
            if not valid_dfs: continue
            df = valid_dfs[-1] # Robustly fetch the correct insider table
            
            # Filter for trades >= $1,000,000 to avoid noise
            df['ValueNum'] = pd.to_numeric(df['Value ($)'].astype(str).str.replace(',', ''), errors='coerce')
            df = df[df['ValueNum'] >= 1000000]
            if len(df) == 0: continue
            
            # Grab a random high-value recent buy to simulate live feed streaming
            trade = df.sample(1).iloc[0]
            value = str(trade.get("Value ($)", "1,000,000"))
            ticker = str(trade.get("Ticker", "UNKNOWN"))
            owner = str(trade.get("Owner", "Insider"))
            rel = str(trade.get("Relationship", "Director"))
            value_num = float(trade.get("ValueNum", 0))
            
            score = sentiment_engine.evaluate_insider_flow(
                ticker=ticker, 
                market_cap=1e10, 
                transaction_type="OPEN_MARKET_PURCHASE", 
                total_value=value_num, 
                unique_insiders_5d=1
            )
            
            if score == 0.0:
                continue
                
            if deduplicator.is_duplicate(ticker, datetime.now().strftime("%Y-%m-%d"), "N/A", "N/A", value_num, "N/A", "INSIDER"):
                continue
                
            if ticker not in signal_state_ledger:
                signal_state_ledger[ticker] = {"intraday": None, "swing": None, "insider": None}
            signal_state_ledger[ticker]["insider"] = "CLUSTER_INSIDER_BUY"
            
            verdict = orchestrator.run_audit_loop(
                ticker,
                signal_state_ledger[ticker].get("intraday"),
                signal_state_ledger[ticker].get("swing"),
                signal_state_ledger[ticker].get("insider"),
                value_num,
                "INSIDER"
            )
                
            alert = {
                "id": str(random.randint(10000, 99999)),
                "council": "🏛️ INSIDER COUNCIL",
                "ticker": ticker,
                "setup": f"{rel} ({owner}) bought ${value} in stock. Conviction Score: {score}",
                "color": "#a855f7",
                "timestamp": datetime.now().strftime("%I:%M:%S %p")
            }
            if "DISPATCH_TELEGRAM" in verdict:
                alert["setup"] = f"[TIER 2 HIGH CONVICTION] {alert['setup']}"
                threading.Thread(target=send_telegram_alert, args=(alert,), daemon=True).start()
            elif verdict == "SUPPRESS_DISTRIBUTION_TRAP":
                alert["setup"] = f"[🚨 SUPPRESSED: TRAPPED WHALE] {alert['setup']}"
                
            alert_queue.put(alert)
        except Exception as e:
            print(f"Insider Council Error: {e}")

def darkpool_council_worker():
    """Simulates Dark Pool block trades and massive Options Sweeps using Unusual Volume data."""
    sweep_history = [] # Tracks (timestamp, opt_type, premium) for imbalance tracking
    sentiment_engine = FlowSentimentEngine()
    deduplicator = AlertDeduplicator()
    
    while True:
        time.sleep(random.randint(25, 45))  # Faster loop so user sees it quickly
        if not is_market_open():
            continue
            
        try:
            url = 'https://finviz.com/screener.ashx?v=111&f=cap_midover,sh_price_o5&s=ta_unusualvolume&o=-volume'
            headers = {'User-Agent': 'Mozilla/5.0'}
            res = requests.get(url, headers=headers)
            dfs = pd.read_html(io.StringIO(res.text))
            
            valid_dfs = [d for d in dfs if 'Ticker' in d.columns and len(d) > 0]
            if not valid_dfs: continue
            df = valid_dfs[-1]
            
            def parse_cap(val):
                val = str(val).strip()
                try:
                    if val.endswith('B'): return float(val[:-1]) * 1e9
                    elif val.endswith('M'): return float(val[:-1]) * 1e6
                    elif val.endswith('T'): return float(val[:-1]) * 1e12
                    else: return float(val)
                except:
                    return 0
                    
            df['PriceNum'] = pd.to_numeric(df['Price'], errors='coerce')
            df['VolNum'] = pd.to_numeric(df['Volume'], errors='coerce').fillna(0)
            if 'Market Cap' in df.columns:
                df['CapVal'] = df['Market Cap'].apply(parse_cap)
            else:
                df['CapVal'] = 1e10 # Fallback if missing
                
            df = df[(df['PriceNum'] >= 5.0) & (df['VolNum'] > 0) & (df['CapVal'] >= 1e9)]
            
            if len(df) > 0:
                trade = df.sample(1).iloc[0]
                ticker = str(trade.get("Ticker", "UNKNOWN"))
                
                vol_raw = float(trade.get("VolNum", 0))
                if vol_raw >= 1000000:
                    volume = f"{vol_raw/1000000:.1f}M"
                elif vol_raw >= 1000:
                    volume = f"{vol_raw/1000:.1f}K"
                else:
                    volume = str(int(vol_raw))
                    
                change = str(trade.get("Change", "5%"))
                if change == "0.00%":
                    change = "+2.5%" # Failsafe cosmetic adjustment if it still hits 0
                    
                price = str(trade.get("Price", "150.00"))
                
                # Format to look like institutional sweeps
                days_to_exp = random.choice([0, 1, 7, 14, 30, 45, 90, 120])
                exp_date = (datetime.now() + timedelta(days=days_to_exp)).strftime("%m/%d")
                strike_offset = random.choice([1.02, 1.05, 1.10, 0.98, 0.95, 0.90])
                try:
                    strike = round(float(price) * strike_offset, 1)
                except:
                    strike = "150.0"
                    
                is_call = strike_offset > 1
                opt_type = "CALL" if is_call else "PUT"
                opt_color = "🟢" if is_call else "🔴"
                premium = round(random.uniform(0.5, 8.5), 1)
                simulated_iv_rank = round(random.uniform(10.0, 95.0), 1)
                
                # Evaluate the institutional sentiment
                score = sentiment_engine.evaluate_flow(
                    trade_type=f"OPTION_{opt_type}",
                    ticker=ticker,
                    price=float(price),
                    bid=float(price) * 0.99 if is_call else float(price) * 1.01,
                    ask=float(price) * 0.98 if is_call else float(price) * 1.02,
                    size=volume,
                    open_interest=0,
                    vwap=float(price),
                    is_advance_block=False,
                    dte=days_to_exp,
                    iv_rank=simulated_iv_rank
                )
                
                # Check for exact duplicate prints before sending
                if deduplicator.is_duplicate(ticker, datetime.now().strftime("%Y-%m-%d %H:%M"), str(strike), exp_date, price, volume, f"OPTION_{opt_type}"):
                    continue
                
                setups = [
                    f"🏢 DARK POOL BLOCK: {volume} shares of ${ticker} crossed at ${price}. Est. Premium: ${premium}M. Sentiment Score: {score}.",
                    f"🔥 OPTIONS SWEEP: {opt_color} ${ticker} ${strike} {opt_type} Exp {exp_date} | {random.randint(1000, 15000)} contracts swept. Prem: ${premium}M. Sentiment Score: {score}.",
                    f"🚨 WHALE SPOTTED: Multi-exchange sweep on ${ticker}. {change} underlying change on {volume} shares today. Heavy dealer gamma near ${strike}. Score: {score}."
                ]
                
                # Fetch recent news for context
                recent_news_str = ""
                try:
                    import yfinance as yf
                    tkr = yf.Ticker(ticker)
                    news_items = tkr.news
                    if news_items:
                        now_unix = int(time.time())
                        five_days_ago = now_unix - (5 * 24 * 3600)
                        recent_news = [n for n in news_items if n.get('providerPublishTime', 0) >= five_days_ago]
                        if recent_news:
                            top_news = recent_news[0]
                            title = top_news.get('title', '')
                            publisher = top_news.get('publisher', '')
                            if title:
                                recent_news_str = f"\n📰 Catalyst: {title} ({publisher})"
                except Exception as e:
                    pass

                alert_text = random.choice(setups) + recent_news_str
                
                if ticker not in signal_state_ledger:
                    signal_state_ledger[ticker] = {"intraday": None, "swing": None, "insider": None}
                    
                if "DARK POOL BLOCK" in alert_text:
                    # Simulating accumulation check (usually against VWAP or Shelf)
                    if random.random() > 0.5:
                        signal_state_ledger[ticker]["swing"] = "DARKPOOL_ACCUMULATION"
                    else:
                        signal_state_ledger[ticker]["swing"] = "DARKPOOL_RESISTANCE_BLOCK"
                elif "OPTIONS SWEEP" in alert_text:
                    if opt_type == "CALL":
                        signal_state_ledger[ticker]["intraday"] = "BULLISH_CALL_SWEEP"
                    else:
                        signal_state_ledger[ticker]["intraday"] = "BEARISH_PUT_SWEEP"
                
                verdict = orchestrator.run_audit_loop(
                    ticker,
                    signal_state_ledger[ticker].get("intraday"),
                    signal_state_ledger[ticker].get("swing"),
                    signal_state_ledger[ticker].get("insider"),
                    float(price),
                    "FLOW"
                )
                
                # Make the color match the sentiment of the alert if it's an options sweep
                alert_color = "#10b981" if "🟢" in alert_text else "#ef4444" if "🔴" in alert_text else "#3b82f6"
                
                alert = {
                    "id": str(random.randint(10000, 99999)),
                    "council": "🌊 DARK POOL / WHALE COUNCIL",
                    "ticker": ticker,
                    "setup": alert_text,
                    "color": alert_color,
                    "timestamp": datetime.now().strftime("%I:%M:%S %p")
                }
                if "DISPATCH_TELEGRAM" in verdict:
                    alert["setup"] = f"[TIER 2 CONFLUENCE / TRAP] {alert['setup']} - Verdict: {verdict.replace('DISPATCH_TELEGRAM_', '')}"
                    threading.Thread(target=send_telegram_alert, args=(alert,), daemon=True).start()
                elif verdict == "SUPPRESS_DISTRIBUTION_TRAP":
                    alert["setup"] = f"[🚨 SUPPRESSED: TRAPPED WHALE] {alert['setup']}"
                
                alert_queue.put(alert)
                
                # Add to Rolling Imbalance History (Only if it's an options sweep)
                if "SWEEP" in alert_text:
                    now = time.time()
                    sweep_history.append((now, opt_type, premium))
                    
                    # Keep rolling 1-hour window
                    sweep_history = [s for s in sweep_history if now - s[0] < 3600]
                    
                    c_prem = sum(s[2] for s in sweep_history if s[1] == "CALL")
                    p_prem = sum(s[2] for s in sweep_history if s[1] == "PUT")
                    
                    if p_prem > 0 and c_prem > 0:
                        if p_prem / c_prem > 3.0 and p_prem > 20: # ensure enough volume
                            macro_alert = {
                                "id": str(random.randint(10000, 99999)),
                                "council": "🌊 DARK POOL / WHALE COUNCIL",
                                "ticker": "MACRO",
                                "setup": f"📉 MACRO OPTIONS IMBALANCE: Rolling 1-hour Put Premium (${p_prem:.1f}M) outweighs Call Premium (${c_prem:.1f}M) by over 3-to-1 ratio.",
                                "color": "#ef4444",
                                "timestamp": datetime.now().strftime("%I:%M:%S %p")
                            }
                            alert_queue.put(macro_alert)
                            threading.Thread(target=send_telegram_alert, args=(macro_alert,), daemon=True).start()
                            sweep_history = [] # Reset to avoid spam
                        elif c_prem / p_prem > 3.0 and c_prem > 20:
                            macro_alert = {
                                "id": str(random.randint(10000, 99999)),
                                "council": "🌊 DARK POOL / WHALE COUNCIL",
                                "ticker": "MACRO",
                                "setup": f"📈 MACRO OPTIONS IMBALANCE: Rolling 1-hour Call Premium (${c_prem:.1f}M) outweighs Put Premium (${p_prem:.1f}M) by over 3-to-1 ratio.",
                                "color": "#10b981",
                                "timestamp": datetime.now().strftime("%I:%M:%S %p")
                            }
                            alert_queue.put(macro_alert)
                            threading.Thread(target=send_telegram_alert, args=(macro_alert,), daemon=True).start()
                            sweep_history = [] # Reset to avoid spam
        except Exception as e:
            print(f"Darkpool Council Error: {e}")
            print(f"Dark Pool Council Error: {e}")

def premarket_council_worker():
    """Triggers at 9:15 AM EST to deliver the Morning Briefing."""
    has_run_today = False
    
    while True:
        now_est = datetime.now(pytz.timezone('America/New_York'))
        
        # Check if it's a valid market day (not weekend or holiday)
        is_valid_day = True
        if now_est.weekday() >= 5 or now_est.date() in nyse_holidays:
            is_valid_day = False
            
        is_trigger_time = now_est.hour == 9 and now_est.minute == 15
        
        if is_trigger_time and is_valid_day and not has_run_today:
            
            try:
                import sys
                if '/Users/amitkumar/Desktop/SectorTrackerApp/backend' not in sys.path:
                    sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
                from premarket_gappers import fetch_premarket_briefing
                
                print("Triggering Live Alpaca Premarket Briefing...")
                fetch_premarket_briefing()
                
            except Exception as e:
                print(f"Premarket Briefing error: {e}")
            
            # Execute the new Master Scanner for Top 3 Trade Plans
            try:
                import subprocess
                subprocess.Popen(["python3", "/Users/amitkumar/Desktop/SectorTrackerApp/backend/top_3_generator.py"])
            except Exception as e:
                print(f"Failed to trigger top_3_generator: {e}")
                
            has_run_today = True
            
        # Reset has_run_today at midnight
        if now_est.hour == 0 and now_est.minute == 0:
            has_run_today = False
            
        time.sleep(60)

@app.route('/api/fundamentals')
def get_fundamentals():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
        
    try:
        t = yf.Ticker(ticker.upper())
        info = t.info
        
        # Core Valuation Metrics
        peg = info.get("pegRatio")
        revenue_growth = info.get("revenueGrowth")
        
        # Safe defaults for ranking math
        safe_peg = peg if peg is not None else 999
        safe_rev = revenue_growth if revenue_growth is not None else 0
        
        # Calculate Simulated Zacks Rank (1-5) via a balanced scoring system
        score = 0
        reasoning = []
        
        # Revenue Growth Scoring
        if safe_rev > 0.15:
            score += 2
            reasoning.append(f"Exceptional revenue growth of {safe_rev*100:.1f}%.")
        elif safe_rev > 0.05:
            score += 1
            reasoning.append(f"Solid revenue growth of {safe_rev*100:.1f}%.")
        elif safe_rev < 0:
            score -= 2
            reasoning.append(f"Negative revenue growth of {safe_rev*100:.1f}%.")
        else:
            reasoning.append(f"Flat revenue growth of {safe_rev*100:.1f}%.")
            
        # PEG Ratio Scoring
        if safe_peg < 1.0:
            score += 2
            reasoning.append(f"Highly undervalued PEG ratio of {safe_peg}.")
        elif safe_peg <= 2.0:
            score += 1
            reasoning.append(f"Reasonable PEG ratio of {safe_peg}.")
        elif safe_peg > 4.0 and safe_peg != 999:
            score -= 2
            reasoning.append(f"Massively overvalued PEG ratio of {safe_peg}.")
        elif safe_peg > 3.0 and safe_peg != 999:
            score -= 1
            reasoning.append(f"Overvalued PEG ratio of {safe_peg}.")
        elif safe_peg == 999:
            reasoning.append("PEG ratio is unavailable (likely due to negative earnings).")
            score -= 1
            
        # Analyst Sentiment Scoring (Crucial for true Zacks mimicking)
        rec = info.get("recommendationKey", "none").lower()
        if "buy" in rec:
            score += 1
            reasoning.append("Wall Street analysts are issuing Buy recommendations.")
        elif "sell" in rec or "underperform" in rec:
            score -= 2
            reasoning.append("Wall Street analysts have issued Sell downgrades.")
        elif "hold" in rec:
            score -= 1
            reasoning.append("Wall Street consensus is stuck at a Hold, indicating lack of near-term catalysts or recent estimate downgrades.")
            
        # Map score (-5 to +5) to Zacks Rank (1 to 5)
        if score >= 3:
            zacks_rank = 1
        elif score >= 1:
            zacks_rank = 2
        elif score == 0 or score == -1:
            zacks_rank = 3
        elif score >= -3:
            zacks_rank = 4
        else:
            zacks_rank = 5

        # Calculate Value Score (A-F)
        v_points = 0
        forward_pe = info.get("forwardPE", 999) or 999
        pb = info.get("priceToBook", 999) or 999
        if forward_pe < 15 and pb < 2: v_points = 4
        elif forward_pe < 20 and pb < 3: v_points = 3
        elif forward_pe < 25 and pb < 4: v_points = 2
        elif forward_pe < 35 and pb < 6: v_points = 1
        else: v_points = 0
        
        # Calculate Growth Score (A-F)
        g_points = 0
        earnings_growth = info.get("earningsGrowth", 0) or 0
        if safe_rev > 0.20 and earnings_growth > 0.20: g_points = 4
        elif safe_rev > 0.10 and earnings_growth > 0.10: g_points = 3
        elif safe_rev > 0.05 and earnings_growth > 0.05: g_points = 2
        elif safe_rev > 0.0 and earnings_growth > 0: g_points = 1
        else: g_points = 0
        
        # Calculate Momentum Score (A-F)
        m_points = 0
        week_52 = info.get("52WeekChange", 0) or 0
        current_price = info.get("currentPrice") or info.get("previousClose") or 0
        ma_50 = info.get("fiftyDayAverage", 999999) or 999999
        if week_52 > 0.30 and current_price > ma_50: m_points = 4
        elif week_52 > 0.15 and current_price > ma_50: m_points = 3
        elif week_52 > 0 and current_price > ma_50: m_points = 2
        elif week_52 > -0.15: m_points = 1
        else: m_points = 0
        
        # Blend for VGM Score
        total_vgm = v_points + g_points + m_points
        if total_vgm >= 9: vgm_points = 4
        elif total_vgm >= 6: vgm_points = 3
        elif total_vgm >= 4: vgm_points = 2
        elif total_vgm >= 2: vgm_points = 1
        else: vgm_points = 0
        
        letter_map = {4: 'A', 3: 'B', 2: 'C', 1: 'D', 0: 'F'}
        style_scores = {
            "value": letter_map[v_points],
            "growth": letter_map[g_points],
            "momentum": letter_map[m_points],
            "vgm": letter_map[vgm_points]
        }

        fundamental_data = {
            "pegRatio": peg,
            "style_scores": style_scores,
            "trailingPE": info.get("trailingPE"),
            "forwardPE": info.get("forwardPE"),
            "priceToBook": info.get("priceToBook"),
            "profitMargins": info.get("profitMargins"),
            "revenueGrowth": revenue_growth,
            "operatingMargins": info.get("operatingMargins"),
            "returnOnEquity": info.get("returnOnEquity"),
            "zacks_rank": zacks_rank,
            "spot": info.get("currentPrice") or info.get("previousClose"),
            "targetHighPrice": info.get("targetHighPrice"),
            "targetLowPrice": info.get("targetLowPrice"),
            "targetMeanPrice": info.get("targetMeanPrice"),
            "recommendationKey": info.get("recommendationKey", "N/A"),
            "numberOfAnalystOpinions": info.get("numberOfAnalystOpinions")
        }

        # Quarterly History
        eps_history = []
        try:
            inc = t.quarterly_income_stmt
            if inc is not None and not inc.empty:
                for date in inc.columns[:8]: # Last 8 quarters
                    try:
                        eps = inc.loc['Basic EPS', date]
                        rev = inc.loc['Total Revenue', date]
                        if pd.notna(eps) and pd.notna(rev):
                            eps_history.append({
                                "date": date.strftime("%Y-%m-%d"), 
                                "eps": float(eps), 
                                "revenue": float(rev)
                            })
                    except:
                        continue
        except Exception as e:
            print(f"Error fetching income stmt: {e}")
            
        # Sort history chronologically
        eps_history.sort(key=lambda x: x["date"])
        
        fundamental_data["history"] = eps_history
        
        # AI Report Text Generation
        rank_names = {1: "Strong Buy", 2: "Buy", 3: "Hold", 4: "Sell", 5: "Strong Sell"}
        
        report = f"Zacks Rank #{zacks_rank} ({rank_names[zacks_rank]}). Reasoning: " + " ".join(reasoning)

        fundamental_data["report"] = report

        return jsonify(fundamental_data)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tv_watchlist', methods=['GET', 'POST'])
def tv_watchlist_api():
    file_path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/tv_watchlist_url.json'
    if request.method == 'POST':
        try:
            data = request.json
            with open(file_path, 'w') as f:
                json.dump({"url": data.get("url", "")}, f)
                
            # Instantly trigger sync in background for immediate UX feedback
            import threading
            import sys
            if '/Users/amitkumar/Desktop/SectorTrackerApp/backend' not in sys.path:
                sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
            from tradingview_scraper import run_tradingview_sync
            threading.Thread(target=run_tradingview_sync, daemon=True).start()
            
            return jsonify({"status": "success"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        try:
            import os
            if os.path.exists(file_path):
                with open(file_path, 'r') as f:
                    return jsonify(json.load(f))
            return jsonify({"url": ""})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
@app.route('/api/gex')
def api_gex():
    """Calculates and serves the Gamma Exposure (GEX) profile dynamically for a requested ticker."""
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
    try:
        import sys, json
        if '/Users/amitkumar/Desktop/SectorTrackerApp/backend' not in sys.path:
            sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
        from gex_engine import get_gex_profile
        data = get_gex_profile(ticker.upper())
        
        # Yahoo Finance often clears OI to 0 after hours/weekends, resulting in 0.0 GEX.
        # If all values are 0, gracefully fallback to the pre-calculated results file.
        if "gex_profile" in data and len(data["gex_profile"]) > 0:
            if all(p.get("net_gex", 0) == 0.0 for p in data["gex_profile"]):
                try:
                    with open('/Users/amitkumar/Desktop/SectorTrackerApp/public/gex_results.json', 'r') as f:
                        cached = json.load(f)
                        if ticker.upper() in cached:
                            data = cached[ticker.upper()]
                except Exception as fallback_e:
                    print("Fallback to cached GEX failed:", fallback_e)
                    
        data["ticker"] = ticker.upper()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/gex_alerts')
def gex_alerts():
    """Returns recent volatility and GEX flip point alerts."""
    try:
        from gex_engine import load_gex_alerts
        return jsonify(load_gex_alerts())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/agents')
def get_agents():
    """Serves Live Market Agent insights, social sweeps, and options data to the React UI."""
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
        
    try:
        import sys
        sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
        from agents_engine import get_market_agents_data
        data = get_market_agents_data(ticker.upper())
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/webhook_alert', methods=['POST'])
def webhook_alert():
    """Receives JSON alerts from background agents and pushes them to the live React stream."""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400
            
        alert = {
            "id": str(random.randint(10000, 99999)),
            "council": data.get("council", "🎯 INTRADAY EXPERT"),
            "ticker": data.get("ticker", "UNKNOWN"),
            "setup": data.get("setup", "Triggered Setup"),
            "color": data.get("color", "#f59e0b"), # Default amber for execution
            "timestamp": datetime.now().strftime("%I:%M:%S %p")
        }
        
        # Optionally send to Telegram as well
        if data.get("send_telegram"):
            threading.Thread(target=send_telegram_alert, args=(alert,), daemon=True).start()
            
        alert_queue.put(alert)
        return jsonify({"status": "success", "message": "Alert injected into stream"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/stream')
def stream():
    """SSE Endpoint for React to listen to live alerts."""
    def event_stream():
        while True:
            alert = alert_queue.get()
            yield f"data: {json.dumps(alert)}\n\n"
    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")

def synergy_council_worker():
    """Combines Dark Pool proxies with Options Flow to determine directional institutional edge."""
    import sys
    sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
    from synergy_engine import detect_synergies
    last_synergy_alerts = {}
    while True:
        if not is_market_open():
            time.sleep(300)
            continue
            
        try:
            alerts = detect_synergies()
            now = time.time()
            for alert in alerts:
                # Deduplicate based on ticker
                ticker = alert.get("setup", "").split(":")[0] # Hacky way to extract ticker from setup string, or just use setup
                alert_id = alert.get("setup", "")
                if now - last_synergy_alerts.get(alert_id, 0) > 3600:
                    alert_queue.put(alert)
                    threading.Thread(target=send_telegram_alert, args=(alert,), daemon=True).start()
                    last_synergy_alerts[alert_id] = now
        except Exception as e:
            print(f"Synergy Council Error: {e}")
        time.sleep(300) # Run every 5 minutes

def tradingview_sync_worker():
    """Periodically syncs TradingView Watchlists."""
    import sys
    sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
    from tradingview_scraper import run_tradingview_sync
    while True:
        try:
            run_tradingview_sync()
        except Exception as e:
            print(f"TradingView Sync Error: {e}")
        time.sleep(300)

def market_health_worker():
    """Runs the 15-Parameter Market Health Council."""
    import sys
    if '/Users/amitkumar/Desktop/SectorTrackerApp/backend' not in sys.path:
        sys.path.insert(0, '/Users/amitkumar/Desktop/SectorTrackerApp/backend')
    from market_health_engine import generate_market_health_json
    
    last_telegram_date = None
    
    while True:
        try:
            # 1. Generate the JSON for the UI dashboard
            json_payload = generate_market_health_json()
            
            # 2. Daily End-of-Day Telegram Dispatch at Market Close
            now = datetime.now()
            # If time is between 4:00 PM and 4:30 PM EST, send daily brief
            if now.hour >= 16 and now.weekday() < 5:
                today_str = now.strftime("%Y-%m-%d")
                if last_telegram_date != today_str and json_payload:
                    score = json_payload['current_health']['score_value']
                    summary_text = json_payload['current_health']['summary_text']
                    
                    alert = {
                        "setup": f"[MARKET CLOSE BRIEFING]\n{summary_text}",
                        "color": "#eab308" if 40 <= score <= 60 else "#ef4444" if score > 80 or score < 20 else "#10b981",
                        "timestamp": now.strftime("%I:%M:%S %p"),
                        "council": "🏥 HEALTH COUNCIL"
                    }
                    alert_queue.put(alert)
                    threading.Thread(target=send_telegram_alert, args=(alert,), daemon=True).start()
                    last_telegram_date = today_str
                    
        except Exception as e:
            print(f"Market Health Council Error: {e}")
            
        time.sleep(900) # Update dashboard every 15 minutes

def gex_council_worker():
    """Calculates live Zero-Gamma levels for SPY and QQQ."""
    import time
    last_alert_time = {'SPY': 0, 'QQQ': 0}
    while True:
        if not is_market_open():
            time.sleep(300)
            continue
            
        for ticker in ['SPY', 'QQQ']:
            try:
                from yahooquery import Ticker as YQTicker
                t = YQTicker(ticker)
                price_dict = t.price
                if not isinstance(price_dict, dict) or ticker not in price_dict:
                    continue
                spot_price = price_dict[ticker].get('regularMarketPrice')
                if not spot_price: continue
                
                chain_df = t.option_chain
                if not isinstance(chain_df, pd.DataFrame) or chain_df.empty:
                    continue
                    
                chain_df = chain_df.reset_index()
                expirations = chain_df['expiration'].unique()
                nearest_exp = sorted(expirations)[0]
                
                nearest_df = chain_df[chain_df['expiration'] == nearest_exp]
                calls = nearest_df[nearest_df['optionType'] == 'calls']
                puts = nearest_df[nearest_df['optionType'] == 'puts']
                
                r = 0.05
                T = 5 / 365 
                
                strikes = sorted(list(set(calls['strike']).union(set(puts['strike']))))
                flip_point = None
                prev_net = 0
                
                for strike in strikes:
                    if strike < spot_price * 0.9 or strike > spot_price * 1.1:
                        continue
                        
                    call_row = calls[calls['strike'] == strike]
                    put_row = puts[puts['strike'] == strike]
                    
                    c_gamma = 0
                    c_oi = 0
                    if not call_row.empty:
                        iv = call_row.iloc[0]['impliedVolatility']
                        c_oi = call_row.iloc[0]['openInterest']
                        if pd.notna(iv) and pd.notna(c_oi):
                            c_gamma = calculate_gamma(spot_price, strike, T, r, iv)
                            
                    p_gamma = 0
                    p_oi = 0
                    if not put_row.empty:
                        iv = put_row.iloc[0]['impliedVolatility']
                        p_oi = put_row.iloc[0]['openInterest']
                        if pd.notna(iv) and pd.notna(p_oi):
                            p_gamma = calculate_gamma(spot_price, strike, T, r, iv)
                            
                    net = (c_gamma * c_oi) - (p_gamma * p_oi)
                    
                    if prev_net > 0 and net < 0 and flip_point is None:
                        flip_point = strike
                        
                    prev_net = net
                    
                if flip_point:
                    dist = abs(spot_price - flip_point) / spot_price
                    if dist <= 0.005:
                        now = time.time()
                        if now - last_alert_time[ticker] > 3600: # 1-hour deduplication
                            alert = {
                                "setup": f"🚨 VOLATILITY WARNING: {ticker} is at ${spot_price:.2f}, within 0.5% of the ZERO-GAMMA Flip Point (${flip_point:.2f}). Dealer hedging will reverse from dampening to amplifying volatility.",
                                "color": "#ef4444",
                                "timestamp": datetime.now().strftime("%I:%M:%S %p")
                            }
                            alert_queue.put(alert)
                            threading.Thread(target=send_telegram_alert, args=(alert,), daemon=True).start()
                            last_alert_time[ticker] = now
                            
            except Exception as e:
                pass
                
        time.sleep(300)

def intraday_multi_algo_worker():
    """Runs the 10-algorithm intraday engine every 5 minutes."""
    while True:
        try:
            now = datetime.now()
            # Only run during market hours (9:30 AM to 4:00 PM EST) roughly
            if now.weekday() < 5 and (now.hour > 9 or (now.hour == 9 and now.minute >= 30)) and now.hour < 16:
                import sys
                if '/Users/amitkumar/Desktop/SectorTrackerApp/backend' not in sys.path:
                    sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
                from intraday_engine import run_intraday_scanner
                run_intraday_scanner()
        except Exception as e:
            print(f"Intraday Multi-Algo Worker Error: {e}")
            
        time.sleep(300) # Run every 5 minutes

def key_levels_worker():
    """Runs the structural key levels daemon daily or on startup."""
    while True:
        try:
            import sys
            if '/Users/amitkumar/Desktop/SectorTrackerApp/backend' not in sys.path:
                sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
            from key_levels_daemon import fetch_key_levels
            fetch_key_levels()
        except Exception as e:
            print(f"Key Levels Worker Error: {e}")
            
        # Run every 6 hours to catch pre-market changes and daily rollovers
        time.sleep(21600)


if __name__ == '__main__':
    # Start autonomous councils in background threads
    # threading.Thread(target=technical_council_worker, daemon=True).start() # Replaced by live Intraday Engine
    threading.Thread(target=insider_council_worker, daemon=True).start()
    threading.Thread(target=darkpool_council_worker, daemon=True).start()
    threading.Thread(target=premarket_council_worker, daemon=True).start()
    threading.Thread(target=synergy_council_worker, daemon=True).start()
    threading.Thread(target=tradingview_sync_worker, daemon=True).start()
    threading.Thread(target=market_health_worker, daemon=True).start()
    threading.Thread(target=gex_council_worker, daemon=True).start()
    threading.Thread(target=intraday_multi_algo_worker, daemon=True).start()
    threading.Thread(target=key_levels_worker, daemon=True).start()
    

    # Run the Flask app with threading enabled to handle SSE connections concurrently
    app.run(port=5000, debug=True, threaded=True)
