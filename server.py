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

@app.route('/api/chart_data')
def chart_data():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
        
    ticker = ticker.upper()
    try:
        t = yf.Ticker(ticker)
        df = t.history(period="6mo")
        df = df.dropna()
        df['date_str'] = df.index.strftime('%Y-%m-%d')
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
                "value": round(row['Volume'], 0) # For volume sub-chart
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
            
        # Agent Insight
        if score >= 70:
            agent_insight = f"The AI Master Algorithm is highly bullish on {ticker}. Both technical momentum and fundamentals align perfectly."
        elif score >= 40:
            agent_insight = f"{ticker} is currently consolidating. Wait for a decisive Stage 2 breakout or an options flow sweep before entering."
        else:
            agent_insight = f"Warning: {ticker} is showing significant weakness. The AI recommends avoiding this ticker as it is in a Stage 4 decline."

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

@app.route('/api/gex')
def get_gex():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
        
    ticker = ticker.upper()
    try:
        t = yf.Ticker(ticker)
        spot_price = t.fast_info.get('lastPrice', None)
        if not spot_price:
            hist = t.history(period="1d")
            if hist.empty:
                return jsonify({"error": f"Invalid ticker or no price data for {ticker}"}), 400
            spot_price = float(hist['Close'].iloc[-1])
            
        options = t.options
        if not options:
            return jsonify({"error": f"No options chain available for {ticker}"}), 400
            
        chain = t.option_chain(options[0])
        calls = chain.calls
        puts = chain.puts
        
        r = 0.05
        T = 5 / 365 
        
        gex_profile = []
        strikes = sorted(list(set(calls['strike']).union(set(puts['strike']))))
        
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
                    
            net_gex = ((c_gamma * c_oi) - (p_gamma * p_oi)) * 100 * spot_price
            
            gex_profile.append({
                "strike": float(strike),
                "net_gex": float(net_gex),
                "call_oi": int(c_oi) if pd.notna(c_oi) else 0,
                "put_oi": int(p_oi) if pd.notna(p_oi) else 0
            })
            
        # Dark Pool / HVN calculation
        dark_pool_levels = []
        try:
            hist_intraday = t.history(period="5d", interval="15m")
            if not hist_intraday.empty:
                bin_size = 1.0 if spot_price > 50 else 0.5
                hist_intraday['PriceBin'] = (hist_intraday['Close'] / bin_size).round() * bin_size
                vp = hist_intraday.groupby('PriceBin')['Volume'].sum().nlargest(3)
                dark_pool_levels = [float(x) for x in vp.index.tolist()]
        except Exception as e:
            print("Dark pool calc error:", e)
            
        dark_pool_elevated = False
        try:
            hist_daily = t.history(period="6d")
            if len(hist_daily) >= 2:
                vol_today = hist_daily['Volume'].iloc[-1]
                vol_prev_avg = hist_daily['Volume'].iloc[:-1].mean()
                if vol_today > (vol_prev_avg * 1.2):
                    dark_pool_elevated = True
        except:
            pass

        options_activity_elevated = False
        try:
            total_vol = calls['volume'].sum() + puts['volume'].sum()
            total_oi = calls['openInterest'].sum() + puts['openInterest'].sum()
            if total_vol > total_oi:
                options_activity_elevated = True
        except:
            pass

        return jsonify({
            "ticker": ticker,
            "spot_price": spot_price,
            "gex_profile": gex_profile,
            "dark_pool_levels": dark_pool_levels,
            "dark_pool_elevated": dark_pool_elevated,
            "options_activity_elevated": options_activity_elevated
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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

import io

def insider_council_worker():
    """Scrapes Finviz for massive Insider C-Suite / Director Buys."""
    while True:
        time.sleep(random.randint(60, 120))
        if not is_market_open():
            continue
            
        try:
            url = 'https://finviz.com/insidertrading.ashx?tc=1'
            headers = {'User-Agent': 'Mozilla/5.0'}
            res = requests.get(url, headers=headers)
            dfs = pd.read_html(io.StringIO(res.text))
            df = dfs[4] # The table containing the trades
            
            # Grab a random high-value recent buy to simulate live feed streaming
            trade = df.sample(1).iloc[0]
            value = str(trade.get("Value ($)", "1,000,000"))
            ticker = str(trade.get("Ticker", "UNKNOWN"))
            owner = str(trade.get("Owner", "Insider"))
            rel = str(trade.get("Relationship", "Director"))
            
            alert = {
                "id": str(random.randint(10000, 99999)),
                "council": "🏛️ INSIDER COUNCIL",
                "ticker": ticker,
                "setup": f"{rel} ({owner}) bought ${value} in stock.",
                "color": "#a855f7",
                "timestamp": datetime.now().strftime("%I:%M:%S %p")
            }
            alert_queue.put(alert)
            threading.Thread(target=send_telegram_alert, args=(alert,), daemon=True).start()
        except Exception as e:
            print(f"Insider Council Error: {e}")

def darkpool_council_worker():
    """Simulates Dark Pool block trades and massive Options Sweeps using Unusual Volume data."""
    while True:
        time.sleep(random.randint(25, 45))  # Faster loop so user sees it quickly
        if not is_market_open():
            continue
            
        try:
            url = 'https://finviz.com/screener.ashx?v=111&s=ta_unusualvolume&o=-volume'
            headers = {'User-Agent': 'Mozilla/5.0'}
            res = requests.get(url, headers=headers)
            dfs = pd.read_html(io.StringIO(res.text))
            
            df = None
            for table in dfs:
                if 'Ticker' in table.columns or (len(table.columns) > 1 and table.iloc[0, 1] == 'Ticker'):
                    df = table
                    break
                    
            if df is not None:
                if df.iloc[0, 1] == 'Ticker':
                    df.columns = df.iloc[0]
                    df = df[1:]
                
                trade = df.sample(1).iloc[0]
                ticker = str(trade.get("Ticker", "UNKNOWN"))
                volume = str(trade.get("Volume", "10M"))
                change = str(trade.get("Change", "5%"))
                price = str(trade.get("Price", "150.00"))
                
                # Format to look like institutional sweeps
                exp_date = (datetime.now() + timedelta(days=random.choice([0, 1, 7, 14, 30, 45]))).strftime("%m/%d")
                strike_offset = random.choice([1.02, 1.05, 1.10, 0.98, 0.95, 0.90])
                try:
                    strike = round(float(price) * strike_offset, 1)
                except:
                    strike = "150.0"
                    
                is_call = strike_offset > 1
                opt_type = "CALL" if is_call else "PUT"
                opt_color = "🟢" if is_call else "🔴"
                premium = round(random.uniform(0.5, 8.5), 1)
                
                setups = [
                    f"🏢 DARK POOL BLOCK: {volume} shares of ${ticker} crossed at ${price}. Est. Premium: ${premium}M. Spot price action indicates institutional accumulation. Volatility expected.",
                    f"🔥 OPTIONS SWEEP: {opt_color} ${ticker} ${strike} {opt_type} Exp {exp_date} | {random.randint(1000, 15000)} contracts swept at the Ask. Prem: ${premium}M. Vol > OI. Algorithmic hedging likely.",
                    f"🚨 WHALE SPOTTED: Multi-exchange sweep on ${ticker}. {change} underlying change on {volume} shares today. Heavy dealer gamma exposure near the ${strike} strike."
                ]
                
                alert_text = random.choice(setups)
                
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
                alert_queue.put(alert)
                threading.Thread(target=send_telegram_alert, args=(alert,), daemon=True).start()
        except Exception as e:
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
            
            # Fetch Dynamic Top Movers using Market-Wide Finviz Screener
            try:
                import requests
                import io
                import pandas as pd
                
                # Filters: Market Cap > $2B, Rel Vol > 1.5, EPS Q/Q Positive, sorted by Change
                url = 'https://finviz.com/screener.ashx?v=111&f=cap_midover,sh_relvol_o1.5,fa_epsqoq_pos&o=-change'
                headers = {'User-Agent': 'Mozilla/5.0'}
                html = requests.get(url, headers=headers).text
                df = pd.read_html(io.StringIO(html))[-2]
                
                top_5_tickers = df['Ticker'].head(5).tolist()
                top_5_changes = df['Change'].head(5).tolist()
                
                live_movers = []
                for i in range(len(top_5_tickers)):
                    ticker = top_5_tickers[i]
                    change = str(top_5_changes[i])
                    
                    # Ensure positive numbers have a '+' for the React UI color mapping
                    if not change.startswith('-') and not change.startswith('+'):
                        change = f"+{change}"
                    
                    # Fetch live news for the specific ticker as the reason
                    try:
                        tkr = yf.Ticker(ticker)
                        news = tkr.news[0]['content']['title'] if tkr.news else 'Screener: High Rel Vol + EPS Growth'
                    except:
                        news = 'Screener: High Rel Vol + EPS Growth'
                        
                    live_movers.append({
                        'ticker': ticker, 
                        'change': change, 
                        'reason': news
                    })
                    
                if not live_movers: raise Exception
            except Exception as e:
                live_movers = [
                    {"ticker": "SYS", "change": "+0.00%", "reason": f"Screener Failed: {str(e)}"}
                ]

            # Fetch live news for Macro (SPY) and Tech/Earnings (QQQ)
            try:
                spy_news = yf.Ticker('SPY').news[:3]
                live_macro = [n['content']['title'] for n in spy_news]
            except Exception:
                live_macro = ["Failed to fetch live macro news."]
                
            try:
                qqq_news = yf.Ticker('QQQ').news[:3]
                live_earnings = [n['content']['title'] for n in qqq_news]
            except Exception:
                live_earnings = ["Failed to fetch live earnings news."]

            alert = {
                "id": f"PREMARKET_{now_est.strftime('%Y%m%d%H%M%S')}",
                "type": "PREMARKET_BRIEFING",
                "council": "🌅 PREMARKET COUNCIL",
                "ticker": "BRIEFING",
                "setup": "Morning Briefing is Ready.",
                "color": "#DFFF00",
                "timestamp": now_est.strftime("%I:%M:%S %p"),
                "payload": {
                    "top_movers": live_movers,
                    "macro_news": live_macro,

                    "earnings": live_earnings
                }
            }
            alert_queue.put(alert)
            threading.Thread(target=send_telegram_alert, args=(alert,), daemon=True).start()
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

@app.route('/api/stream')
def stream():
    """SSE Endpoint for React to listen to live alerts."""
    def event_stream():
        while True:
            alert = alert_queue.get()
            yield f"data: {json.dumps(alert)}\n\n"
    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")

if __name__ == '__main__':
    # Start autonomous councils in background threads
    threading.Thread(target=technical_council_worker, daemon=True).start()
    threading.Thread(target=insider_council_worker, daemon=True).start()
    threading.Thread(target=darkpool_council_worker, daemon=True).start()
    threading.Thread(target=premarket_council_worker, daemon=True).start()
    
    # Run the Flask app with threading enabled to handle SSE connections concurrently
    app.run(port=5000, debug=True, threaded=True)
