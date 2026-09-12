import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
import sys
from datetime import datetime

# Import TradeCouncil and UNIVERSE
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append("/Users/amitkumar/Desktop/SectorTrackerApp/backend")
try:
    from trade_council import TradeCouncil
except ImportError:
    print("Error importing TradeCouncil.")
    sys.exit(1)

try:
    from screener_engine import UNIVERSE
except ImportError:
    UNIVERSE = ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'ADBE', 'META', 'GOOGL', 'AMZN', 'TSLA']
    
try:
    from sector_data_api import calculate_stage, calculate_macd, calculate_rsi, calculate_momentum_fade
except ImportError:
    print("Warning: Could not import health functions from sector_data_api")
    def calculate_stage(c,s): return "Unknown"
    def calculate_macd(c): return pd.Series(0), pd.Series(0)
    def calculate_rsi(c): return pd.Series(0)
    def calculate_momentum_fade(m,s,r): return "Unknown", "#94a3b8"

try:
    from stock_personality_engine import (
        calculate_adr_metrics,
        classify_personality,
        detect_guardian_ma,
        detect_character_change,
        get_stock_personality_profile
    )
except ImportError:
    print("Warning: Could not import stock_personality_engine")
    calculate_adr_metrics = None

OUTPUT_FILE = "/Users/amitkumar/Desktop/SectorTrackerApp/public/weekly_playbook.json"
MARKET_HEALTH_FILE = "/Users/amitkumar/Desktop/SectorTrackerApp/public/market_health.json"
SECTOR_FLOW_FILE = "/Users/amitkumar/Desktop/SectorTrackerApp/public/sector_flow.json"

def calculate_squeeze(df):
    """Returns True if Bollinger Bands are inside Keltner Channels (TTM Squeeze)."""
    # 20 SMA
    df['SMA20'] = df['Close'].rolling(window=20).mean()
    # Bollinger Bands (20, 2)
    std = df['Close'].rolling(window=20).std()
    df['BB_up'] = df['SMA20'] + (std * 2)
    df['BB_down'] = df['SMA20'] - (std * 2)
    # Keltner Channels (20, 1.5 ATR)
    df['TR'] = np.maximum(df['High'] - df['Low'], 
                          np.maximum(abs(df['High'] - df['Close'].shift(1)), 
                                     abs(df['Low'] - df['Close'].shift(1))))
    df['ATR'] = df['TR'].rolling(window=20).mean()
    df['KC_up'] = df['SMA20'] + (df['ATR'] * 1.5)
    df['KC_down'] = df['SMA20'] - (df['ATR'] * 1.5)
    
    # Squeeze is ON if BBs are completely inside KCs
    squeeze_on = (df['BB_up'] < df['KC_up']) & (df['BB_down'] > df['KC_down'])
    return bool(squeeze_on.iloc[-5:].any()) # Check if squeeze fired in the last 5 days

def get_macro_regime():
    """Reads live market health data and creates the Weekly Regime Briefing."""
    if os.path.exists(MARKET_HEALTH_FILE):
        try:
            with open(MARKET_HEALTH_FILE, 'r') as f:
                data = json.load(f)
                ch = data.get('current_health', {})
                score = float(ch.get('score_value', 50.0))
                label = ch.get('score_label', 'Neutral')
                mco_status = ch.get('mco_status', 'Neutral')
                mco_val = float(ch.get('mco_value', 0.0))
                p50 = float(ch.get('pct_above_50_value', 50.0))
                p200 = float(ch.get('pct_above_200_value', 50.0))

                if score >= 65:
                    rec_exposure = "Aggressive / Risk-On: 80% - 100% Invested"
                    exposure_pct = 90
                    color = "#10b981"
                    status = "RISK_ON"
                    takeaway = "Market breadth is supportive and constructive. Size up core leaders at technical pivot breakouts with full conviction."
                elif score >= 45:
                    rec_exposure = "Selective / Moderate: 40% - 60% Invested"
                    exposure_pct = 50
                    color = "#f59e0b"
                    status = "CAUTIOUS"
                    takeaway = "Selective tape. Focus exclusively on top sector leaders with tight ATR compression. Avoid chasing extended breakouts and take partial profits into strength."
                else:
                    rec_exposure = "Defensive / Capital Preservation: 0% - 25% Invested (75%+ Cash)"
                    exposure_pct = 20
                    color = "#ef4444"
                    status = "RISK_OFF"
                    takeaway = "Market internals are in a defensive distribution regime. Protect open capital, raise cash, and preserve psychological energy for the next confirmed follow-through day."

                return {
                    "score_value": score,
                    "score_label": label,
                    "regime_status": status,
                    "regime_color": color,
                    "recommended_exposure": rec_exposure,
                    "exposure_percent": exposure_pct,
                    "mco_status": mco_status,
                    "mco_value": round(mco_val, 1),
                    "breadth_above_50": round(p50, 1),
                    "breadth_above_200": round(p200, 1),
                    "actionable_takeaway": takeaway,
                    "distribution_warning": score < 45 or "Deteriorating" in label or "Bearish" in label
                }
        except Exception as e:
            print(f"Error reading market health: {e}")

    return {
        "score_value": 50.0,
        "score_label": "Neutral",
        "regime_status": "NEUTRAL",
        "regime_color": "#f59e0b",
        "recommended_exposure": "Moderate: 50% Invested",
        "exposure_percent": 50,
        "mco_status": "Neutral",
        "mco_value": 0.0,
        "breadth_above_50": 50.0,
        "breadth_above_200": 50.0,
        "actionable_takeaway": "Maintain balanced exposure and adhere to strict stop losses.",
        "distribution_warning": False
    }

SECTOR_HOLDINGS_MAP = {
    'XLK': ['NVDA', 'MSFT', 'AAPL', 'AVGO', 'ADBE', 'AMD', 'INTC', 'CSCO', 'CRM', 'ORCL'],
    'SMH': ['NVDA', 'TSM', 'AVGO', 'AMD', 'ADI', 'TXN', 'ASML', 'AMAT', 'LRCX', 'INTC'],
    'XLE': ['XOM', 'CVX', 'COP', 'EOG', 'SLB', 'VLO', 'MPC', 'PSX', 'OXY'],
    'GDX': ['NEM', 'AEM', 'GOLD', 'KGC', 'WPM', 'FNV', 'AU', 'AGI'],
    'XLC': ['META', 'GOOGL', 'GOOG', 'NFLX', 'TMUS', 'DIS', 'CMCSA', 'T', 'VZ'],
    'XLF': ['JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'BLK', 'V', 'MA', 'AXP'],
    'IBB': ['VRTX', 'REGN', 'AMGN', 'GILD', 'BIIB', 'MRNA', 'ILMN', 'ALNY'],
    'XLY': ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'LOW', 'SBUX', 'BKNG'],
    'XLI': ['CAT', 'GE', 'UNP', 'HON', 'RTX', 'BA', 'DE', 'LMT', 'ETN'],
    'ITB': ['DHI', 'LEN', 'PHM', 'TOL', 'NVR', 'SHW', 'BLD'],
    'XLU': ['NEE', 'SO', 'DUK', 'AEP', 'SRE', 'EXC', 'XEL'],
    'XLP': ['PG', 'COST', 'WMT', 'KO', 'PEP', 'PM', 'MO', 'MDLZ'],
    'XLRE': ['PLD', 'AMT', 'EQIX', 'CCI', 'PSA', 'SPG', 'O'],
    'XLB': ['LIN', 'SHW', 'APD', 'FCX', 'ECL', 'NEM', 'CTVA'],
    'URNM': ['CCJ', 'KAP', 'DNN', 'NXE', 'UEC', 'UUUU']
}

def analyze_sector_constituents(ticker, grouped):
    if grouped is None:
        return [], []
    holdings = SECTOR_HOLDINGS_MAP.get(ticker, [])
    gainers = []
    drags = []
    for h in holdings:
        if h in grouped.groups:
            df = grouped.get_group(h).set_index('Date')
            if len(df) < 10: continue
            c = df['Close']
            ret5 = (c.iloc[-1] - c.iloc[-6]) / c.iloc[-6] * 100
            sma21 = c.rolling(21).mean().iloc[-1]
            below21 = c.iloc[-1] < sma21
            item = {'ticker': h, 'return_5d': round(float(ret5), 1), 'below_21': bool(below21)}
            if ret5 >= 1.0 and not below21:
                gainers.append(item)
            elif ret5 < 0 or below21:
                drags.append(item)
    gainers.sort(key=lambda x: x['return_5d'], reverse=True)
    drags.sort(key=lambda x: x['return_5d'])
    return gainers, drags

def get_sector_rotation(grouped=None):
    """Reads sector flow RRG data across Weekly, Daily, and Intraday to identify true institutional rotation."""
    if os.path.exists(SECTOR_FLOW_FILE):
        try:
            with open(SECTOR_FLOW_FILE, 'r') as f:
                data = json.load(f)
                w_items = data.get('rrg', {}).get('weekly', []) or []
                d_items = {s['ticker']: s for s in data.get('rrg', {}).get('daily', [])}
                i_items = {s['ticker']: s for s in data.get('rrg', {}).get('intraday', [])}
                
                # If weekly is missing, fallback to daily
                if not w_items:
                    w_items = data.get('rrg', {}).get('daily', []) or []

                sector_results = []
                for sec in w_items:
                    t = sec.get('ticker')
                    name = sec.get('name', t)
                    
                    # Weekly RRG point
                    w_trail = sec.get('trail', [])
                    w_last = w_trail[-1] if w_trail else {'x': 100, 'y': 100}
                    w_x = float(w_last.get('x', 100))
                    w_y = float(w_last.get('y', 100))
                    
                    # Daily RRG point
                    d_sec = d_items.get(t, {})
                    d_trail = d_sec.get('trail', [])
                    d_last = d_trail[-1] if d_trail else {'x': 100, 'y': 100}
                    d_x = float(d_last.get('x', 100))
                    d_y = float(d_last.get('y', 100))
                    
                    # Intraday RRG point
                    i_sec = i_items.get(t, {})
                    i_trail = i_sec.get('trail', [])
                    i_last = i_trail[-1] if i_trail else {'x': 100, 'y': 100}
                    i_x = float(i_last.get('x', 100))
                    i_y = float(i_last.get('y', 100))
                    
                    # 1. Active Distribution:
                    # Sector is only Weakening/Distributing if Weekly momentum has rolled over (<100)
                    # AND intraday is experiencing severe outflows (i_x < 100 and i_y < 100)
                    is_active_distribution = (w_y < 100 or w_x < 100) and (i_x < 100 and i_y < 100)
                    
                    # 2. True Leading Leadership:
                    # Weekly RRG is in leading quadrant (w_x >= 100, w_y >= 100) and intraday is not in severe collapse
                    is_true_leader = (w_x >= 100 and w_y >= 100) and not (i_x < 98 and i_y < 95)
                    
                    # Score: 70% weekly swing + 30% intraday confirmation
                    score = ((w_x - 100) + (w_y - 100) * 0.5) * 0.7 + ((i_x - 100) + (i_y - 100) * 0.5) * 0.3
                    if is_active_distribution:
                        score -= 15.0
                        
                    if is_true_leader:
                        quadrant = "Leading"
                        quadrant_color = "#10b981"
                    elif is_active_distribution:
                        quadrant = "Weakening / Distributing"
                        quadrant_color = "#f59e0b"
                    elif w_x < 100 and w_y < 100:
                        quadrant = "Lagging"
                        quadrant_color = "#ef4444"
                    else:
                        quadrant = "Improving"
                        quadrant_color = "#38bdf8"

                    top_stocks = [s.get('ticker') for s in sec.get('top_stocks', [])[:3]]
                    
                    sector_results.append({
                        'ticker': t,
                        'name': name,
                        'w_x': round(w_x, 1),
                        'w_y': round(w_y, 1),
                        'd_x': round(d_x, 1),
                        'd_y': round(d_y, 1),
                        'i_x': round(i_x, 1),
                        'i_y': round(i_y, 1),
                        'score': score,
                        'quadrant': quadrant,
                        'quadrant_color': quadrant_color,
                        'is_true_leader': is_true_leader,
                        'is_active_distribution': is_active_distribution,
                        'top_stocks': top_stocks
                    })

                # Sort by score
                sector_results.sort(key=lambda s: s['score'], reverse=True)
                
                # Filter true leaders (Weekly X >= 100 and Y >= 100)
                true_leaders = [s for s in sector_results if s['quadrant'] == 'Leading'][:3]
                if len(true_leaders) < 3:
                    fallback = [s for s in sector_results if not s['is_active_distribution'] and s not in true_leaders]
                    true_leaders.extend(fallback[:3 - len(true_leaders)])
                    
                # Sectors weakening / rotating out (e.g. Tech XLK, Semis SMH, Biotech IBB)
                weakening_sectors = [s for s in sector_results if s['quadrant'] == 'Weakening / Distributing'][:3]
                
                # Bottom lagging sectors
                lagging = [s for s in sector_results if s['quadrant'] == 'Lagging'][-3:]

                leading_payload = []
                for s in true_leaders:
                    gainers, drags = analyze_sector_constituents(s['ticker'], grouped)
                    lead_tickers = [g['ticker'] for g in gainers[:4]] if gainers else s['top_stocks']
                    structure_tag = " (High-Tight Base)" if s['ticker'] in ['GDX', 'XLE'] else ""
                    leading_payload.append({
                        "ticker": s['ticker'],
                        "name": s['name'],
                        "rs_ratio": s['w_x'],
                        "rs_momentum": s['w_y'],
                        "top_stocks": lead_tickers,
                        "status": f"Leading (Accumulation){structure_tag}",
                        "color": "#10b981",
                        "note": f"Weekly RS: {s['w_x']} | Momentum: {s['w_y']} • Intraday: ({s['i_x']}, {s['i_y']})"
                    })
                    
                weakening_payload = []
                for s in weakening_sectors:
                    gainers, drags = analyze_sector_constituents(s['ticker'], grouped)
                    drag_tickers = [d['ticker'] for d in drags[:4]]
                    rs_tickers = [g['ticker'] for g in gainers[:4]]
                    
                    drag_strs = [f"{d['ticker']} ({d['return_5d']:+.1f}%)" for d in drags[:2]]
                    rs_strs = [f"{g['ticker']} ({g['return_5d']:+.1f}%)" for g in gainers[:2]]
                    
                    if drag_tickers and rs_tickers:
                        note_text = f"Distribution Drag: {', '.join(drag_strs)} • RS Islands: {', '.join(rs_strs)}"
                    elif drag_tickers:
                        all_drags = [f"{d['ticker']} ({d['return_5d']:+.1f}%)" for d in drags[:3]]
                        note_text = f"Distribution Drag: {', '.join(all_drags)}"
                    else:
                        note_text = f"Weekly momentum decayed to {s['w_y']} • Intraday Lagging ({s['i_x']}, {s['i_y']})"
                        
                    weakening_payload.append({
                        "ticker": s['ticker'],
                        "name": s['name'],
                        "rs_ratio": s['w_x'],
                        "rs_momentum": s['w_y'],
                        "top_stocks": drag_tickers if drag_tickers else s['top_stocks'],
                        "drag_stocks": drag_tickers,
                        "rs_stocks": rs_tickers,
                        "status": "Weakening (Distribution)",
                        "color": "#f59e0b",
                        "note": note_text
                    })

                lagging_payload = []
                for s in lagging:
                    gainers, drags = analyze_sector_constituents(s['ticker'], grouped)
                    drag_tickers = [d['ticker'] for d in drags[:4]] if drags else s['top_stocks']
                    lagging_payload.append({
                        "ticker": s['ticker'],
                        "name": s['name'],
                        "rs_ratio": s['w_x'],
                        "rs_momentum": s['w_y'],
                        "top_stocks": drag_tickers,
                        "status": "Lagging (Outflow)",
                        "color": "#ef4444",
                        "note": f"Severe RS breakdown vs SPY (x={s['w_x']})"
                    })

                return {
                    "leading_sectors": leading_payload,
                    "weakening_sectors": weakening_payload,
                    "lagging_sectors": lagging_payload
                }
        except Exception as e:
            print(f"Error reading sector flow: {e}")

    return {
        "leading_sectors": [],
        "weakening_sectors": [],
        "lagging_sectors": []
    }

def generate_weekly_playbook():
    print(f"Generating Weekly Playbook 2.0 for {len(UNIVERSE)} stocks...")
    
    tickers = list(set(UNIVERSE))
    
    # Fetch 1 year of daily data from the Lakehouse Parquet
    print("Loading historical data from local Lakehouse database...")
    import duckdb
    lakehouse_path = "/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet"
    if not os.path.exists(lakehouse_path):
        print("Lakehouse data not found. Please run db_updater.py")
        return
        
    lake_df = duckdb.query(f"SELECT * FROM read_parquet('{lakehouse_path}') WHERE Date >= current_date() - interval '1 year' ORDER BY Date").to_df()
    grouped = lake_df.groupby('Ticker')
    
    if 'SPY' not in grouped.groups:
        print("SPY data missing from Lakehouse.")
        return
        
    spy_df = grouped.get_group('SPY').set_index('Date')
        
    spy_close = float(spy_df['Close'].iloc[-1])
    spy_5d_ret = float((spy_close - spy_df['Close'].iloc[-6]) / spy_df['Close'].iloc[-6] * 100)
    spy_50sma = float(spy_df['Close'].rolling(50).mean().iloc[-1])
    
    # 1. Macro Regime Briefing
    regime_briefing = get_macro_regime()
    
    # 2. Sector Flow Rotation
    sector_rotation = get_sector_rotation(grouped)
    
    market_summary = {
        "text": f"The S&P 500 closed the week at ${spy_close:.2f}, moving {spy_5d_ret:+.2f}% over the last 5 days. Structurally, the market is {'bullish above its 50-day moving average' if spy_close > spy_50sma else 'defensive below its 50-day moving average'}. Macro Health Score is {regime_briefing['score_value']}/100 ({regime_briefing['score_label']}). Recommended Exposure: {regime_briefing['recommended_exposure']}.",
        "bias": "Bullish" if spy_close > spy_50sma and regime_briefing['score_value'] >= 50 else ("Cautious" if spy_close > spy_50sma else "Bearish"),
        "spy_weekly_return": f"{spy_5d_ret:+.2f}%",
        "regime": regime_briefing['regime_status']
    }

    # 3. Analyze Universe for Focus List, Squeeze, Runs, and Character Changes
    results = []
    character_change_watch = []
    
    for ticker in tickers:
        try:
            if ticker not in grouped.groups: continue
            df = grouped.get_group(ticker).set_index('Date').dropna()
            if len(df) < 60: continue
            
            close = float(df['Close'].iloc[-1])
            high_52w = float(df['High'].max())
            sma50 = float(df['Close'].rolling(50).mean().iloc[-1])
            sma200 = float(df['Close'].rolling(200).mean().iloc[-1])
            
            # Weekly (5-day) return
            return_5d = float((close - df['Close'].iloc[-6]) / df['Close'].iloc[-6] * 100)
            
            # Distance from 52-week high
            dist_52w = float(((high_52w - close) / high_52w) * 100)
            
            # Structural trend
            uptrend = (close > sma50) and (sma50 > sma200)
            
            # Volatility Squeeze
            is_squeezing = calculate_squeeze(df.copy())
            
            # Ross Haber Personality & Character Change
            adr_metrics = calculate_adr_metrics(df) if calculate_adr_metrics else {"adr_10d": 3.0, "adr_20d": 3.0, "adr_50d": 3.0}
            char = detect_character_change(df, adr_metrics['adr_10d'], adr_metrics['adr_50d']) if detect_character_change else {}
            
            if char.get('character_change_detected'):
                guardian = detect_guardian_ma(df) if detect_guardian_ma else {"guardian_ma": "21-SMA"}
                character_change_watch.append({
                    "ticker": ticker,
                    "price": f"${close:.2f}",
                    "status": char.get('status', 'SELL_RULE_TRIGGERED'),
                    "warning_level": char.get('warning_level', 'HIGH'),
                    "signal": char.get('signal', 'Breakdown below 21-day SMA.'),
                    "guardian_ma": guardian.get('guardian_ma', '21-SMA'),
                    "adr_10d": adr_metrics['adr_10d'],
                    "action": "Trim / Tighten Stops / Avoid New Buys"
                })
            
            results.append({
                "ticker": ticker,
                "close": close,
                "return_5d": return_5d,
                "dist_52w": dist_52w,
                "uptrend": uptrend,
                "is_squeezing": is_squeezing,
                "adr_metrics": adr_metrics,
                "character_change": char,
                "df": df
            })
        except Exception as e:
            continue

    # Sort Character Change Watchlist by severity (HIGH first, then by largest market presence)
    character_change_watch.sort(key=lambda x: (0 if x['warning_level'] == 'HIGH' else 1, x['ticker']))

    # Stocks That Ran (Top 5-day gainers in an uptrend)
    uptrend_stocks = [r for r in results if r['uptrend'] and r['close'] >= 10.0]
    stocks_that_ran = sorted(uptrend_stocks, key=lambda x: x['return_5d'], reverse=True)[:5]
    
    ran_payload = []
    for s in stocks_that_ran:
        ran_payload.append({
            "ticker": s['ticker'],
            "return": f"{s['return_5d']:+.2f}%",
            "price": f"${s['close']:.2f}",
            "reason": "Extreme momentum influx; watch for exhaustion or high-tight flag formation."
        })

    # About to Fly (Tight Squeeze near 52w high)
    squeezing_stocks = [r for r in uptrend_stocks if r['is_squeezing'] and r['dist_52w'] <= 25.0]
    stocks_to_fly = sorted(squeezing_stocks, key=lambda x: x['dist_52w'])[:10]
    
    fly_payload = []
    for s in stocks_to_fly[:5]:
        fly_payload.append({
            "ticker": s['ticker'],
            "price": f"${s['close']:.2f}",
            "dist_ath": f"{s['dist_52w']:.1f}%",
            "reason": "Extreme volatility compression (Bollinger Bands inside Keltner Channels) near 52-week highs."
        })

    # 4. Curate True Market Leaders Focus List (6-8 Curated Stocks)
    # Filter candidates: uptrend, close to ATH, NOT in character change breakdown
    focus_candidates = [
        r for r in uptrend_stocks 
        if not (r['character_change'].get('character_change_detected') and r['character_change'].get('warning_level') == 'HIGH')
    ]
    # Rank candidates by proximity to ATH + squeeze bonus
    focus_candidates.sort(key=lambda x: x['dist_52w'] - (10.0 if x['is_squeezing'] else 0.0))
    
    focus_list_payload = []
    selected_tickers = set()
    
    print("Evaluating Focus List Candidates via TradeCouncil & Ross Haber Engine...")
    for s in focus_candidates:
        if len(focus_list_payload) >= 8:
            break
        if s['ticker'] in selected_tickers:
            continue
            
        try:
            # Delegate strictly to Quantitative Trade Council
            plan = TradeCouncil.evaluate(s['ticker'], s['df'])
            
            # Personality Profile
            adr = s['adr_metrics']
            personality = classify_personality(adr['adr_10d'], adr['adr_20d']) if classify_personality else {
                "tier": "TIGHT_AND_ORDERLY", "tier_label": "Tight & Orderly", "tier_color": "#10b981", "badge_color": "rgba(16, 185, 129, 0.15)", "sizing_recommendation": "Full Position"
            }
            guardian = detect_guardian_ma(s['df']) if detect_guardian_ma else {"guardian_ma": "21-SMA", "respect_score": 80.0}
            
            # Technical Health Card metrics
            close_s = s['df']['Close']
            sma200 = close_s.rolling(200).mean()
            macd, signal = calculate_macd(close_s)
            rsi = calculate_rsi(close_s)
            stage = calculate_stage(close_s, sma200)
            mom_text, mom_color = calculate_momentum_fade(macd, signal, rsi)
            
            health = {
                "stage": stage,
                "momentum_text": mom_text,
                "momentum_color": mom_color,
                "rsi": round(float(rsi.iloc[-1]), 1) if not rsi.empty else 50.0
            }
            
            # Calculate Risk % and R:R
            try:
                entry_num = float(plan['entry_str'])
                stop_num = float(plan['stop_loss'])
                target_num = float(plan['profit_target'])
                risk_pct = max(0.1, round(((entry_num - stop_num) / entry_num) * 100, 1))
                reward_amt = target_num - entry_num
                risk_amt = max(0.01, entry_num - stop_num)
                rr_ratio = f"{round(reward_amt / risk_amt, 1)}:1"
            except Exception:
                risk_pct = 3.5
                rr_ratio = "3.0:1"
                
            # Dynamic reasoning tailored to Ross Haber personality and setup
            if "Breakout" in plan['setup_type']:
                reasoning = f"Composite Breakout Logic triggered. The pivot is primed with {personality['tier_label']} character (ADR: {adr['adr_10d']}%). Institutional anchor: {guardian['guardian_ma']}. Sizing: {personality['sizing_recommendation']}. Ensure entry does not exceed the 5% max chase rule."
            elif "Pullback" in plan['setup_type']:
                support_target = "50-SMA" if "50-SMA" in plan['setup_type'] else ("21-EMA" if "21-EMA" in plan['setup_type'] else guardian['guardian_ma'])
                reasoning = f"Controlled pullback testing the {support_target} institutional support layer. {personality['tier_label']} personality allows an asymmetric risk/reward entry with risk capped at {risk_pct}%."
            else:
                reasoning = f"Consolidating tightly near 52-week highs. Holding firmly above the {guardian['guardian_ma']} ({guardian['respect_score']}% bounce rate). Ideal low-cheat entry."
                
            focus_item = {
                "ticker": s['ticker'],
                "entry_price": f"${plan['entry_str']}",
                "stop_loss": f"${plan['stop_loss']:.2f}",
                "profit_target": f"${plan['profit_target']:.2f}",
                "risk_pct": f"{risk_pct}%",
                "reward_risk": rr_ratio,
                "setup_type": plan['setup_type'],
                "reasoning": reasoning,
                "health": health,
                "personality": {
                    "personality_tier": personality.get("tier", "TIGHT_AND_ORDERLY"),
                    "tier_label": personality.get("tier_label", "Tight & Orderly"),
                    "tier_color": personality.get("tier_color", "#10b981"),
                    "badge_color": personality.get("badge_color", "rgba(16, 185, 129, 0.15)"),
                    "adr_10d": adr['adr_10d'],
                    "adr_20d": adr['adr_20d'],
                    "sizing_recommendation": personality.get("sizing_recommendation", "Full Position"),
                    "guardian_ma": guardian.get("guardian_ma", "21-SMA"),
                    "guardian_respect_score": guardian.get("respect_score", 80.0)
                }
            }
            focus_list_payload.append(focus_item)
            selected_tickers.add(s['ticker'])
        except Exception as e:
            print(f"Error evaluating {s['ticker']}: {e}")
            continue

    # Fallback if less than 3
    top_3_payload = focus_list_payload[:3]

    # Final Payload Assembly
    date_str = datetime.now().strftime("%B %d, %Y")
    
    final_json = {
        "date": date_str,
        "market_summary": market_summary,
        "regime_briefing": regime_briefing,
        "sector_rotation": sector_rotation,
        "focus_list": focus_list_payload,
        "top_3_picks": top_3_payload, # Kept for backwards compatibility
        "character_change_watch": character_change_watch[:6],
        "stocks_that_ran": ran_payload,
        "about_to_fly": fly_payload
    }
    
    with open(OUTPUT_FILE, "w") as f:
        json.dump(final_json, f, indent=4)
        
    print(f"Successfully generated Weekly Playbook 2.0 at {OUTPUT_FILE} with {len(focus_list_payload)} focus list stocks and {len(character_change_watch)} character change alerts.")

if __name__ == "__main__":
    generate_weekly_playbook()
