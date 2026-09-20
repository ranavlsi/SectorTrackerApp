import os
import json
import time
import sqlite3
from datetime import datetime
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
DB_PATH = os.path.join(DATA_DIR, 'options_intelligence.db')
STATUS_PATH = os.path.join(DATA_DIR, 'options_dumper_status.json')

_CACHE = {"timestamp": 0, "data": None}

def get_options_screener_summary(force_refresh=False):
    """
    Analyzes the rolling 30-day options history in options_intelligence.db.
    Calculates multi-day OI trend, unusual volume relative to 20-day baseline,
    30-day IV Rank/Percentile, 30-day Skew Rank, and institutional flow archetypes.
    """
    global _CACHE
    import time
    if not force_refresh and _CACHE["data"] and (time.time() - _CACHE["timestamp"] < 25):
        return _CACHE["data"]

    if not os.path.exists(DB_PATH):
        return {"error": "Options database not initialized.", "records": []}
        
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # Check available dates
    cur.execute("SELECT DISTINCT date FROM options_daily_summary ORDER BY date ASC")
    all_dates = [r[0] for r in cur.fetchall()]
    if not all_dates:
        conn.close()
        return {"dates_count": 0, "records": []}
        
    latest_date = all_dates[-1]
    
    # Pull all rows across the 30-day window
    cur.execute("""
        SELECT date, ticker, spot_price, total_call_oi, total_put_oi, total_oi, pcr_oi,
               total_call_vol, total_put_vol, total_vol, pcr_vol, call_vol_pct,
               atm_iv_30d, skew_25d, net_gex, max_pain, unusual_contracts_json
        FROM options_daily_summary
        ORDER BY ticker, date ASC
    """)
    rows = cur.fetchall()
    conn.close()
    
    # Group by ticker
    by_ticker = {}
    for r in rows:
        sym = r[1]
        if sym not in by_ticker:
            by_ticker[sym] = []
        by_ticker[sym].append({
            "date": r[0],
            "ticker": r[1],
            "spot_price": r[2] or 0.0,
            "total_call_oi": r[3] or 0.0,
            "total_put_oi": r[4] or 0.0,
            "total_oi": r[5] or 0.0,
            "pcr_oi": r[6] or 1.0,
            "total_call_vol": r[7] or 0.0,
            "total_put_vol": r[8] or 0.0,
            "total_vol": r[9] or 0.0,
            "pcr_vol": r[10] or 1.0,
            "call_vol_pct": r[11] or 50.0,
            "atm_iv_30d": r[12] or 0.35,
            "skew_25d": r[13] or 0.0,
            "net_gex": r[14] or 0.0,
            "max_pain": r[15] or (r[2] or 0.0),
            "unusual_contracts": json.loads(r[16]) if r[16] else []
        })
        
    results = []
    
    for ticker, history in by_ticker.items():
        if not history:
            continue
            
        today_row = history[-1]
        # Only include if today's date matches latest available or active
        N = len(history)
        
        # Historical metrics
        curr_oi = today_row["total_oi"]
        curr_call_oi = today_row["total_call_oi"]
        curr_put_oi = today_row["total_put_oi"]
        curr_vol = today_row["total_vol"]
        curr_iv = today_row["atm_iv_30d"]
        curr_skew = today_row["skew_25d"]
        curr_pcr_vol = today_row["pcr_vol"]
        call_vol_pct = today_row["call_vol_pct"]
        spot_price = today_row["spot_price"]
        
        # 1. OI Trend (1D, 5D, 30D)
        oi_chg_1d = 0.0
        oi_chg_1d_pct = 0.0
        if N >= 2:
            prev_row = history[-2]
            oi_chg_1d = curr_oi - prev_row["total_oi"]
            oi_chg_1d_pct = round((oi_chg_1d / max(prev_row["total_oi"], 1.0)) * 100, 2)
            
        oi_chg_5d = 0.0
        oi_chg_5d_pct = 0.0
        call_oi_chg_5d = 0.0
        put_oi_chg_5d = 0.0
        if N >= 5:
            r_5d = history[-5]
            oi_chg_5d = curr_oi - r_5d["total_oi"]
            oi_chg_5d_pct = round((oi_chg_5d / max(r_5d["total_oi"], 1.0)) * 100, 2)
            call_oi_chg_5d = curr_call_oi - r_5d["total_call_oi"]
            put_oi_chg_5d = curr_put_oi - r_5d["total_put_oi"]
        else:
            oi_chg_5d = oi_chg_1d
            oi_chg_5d_pct = oi_chg_1d_pct
            call_oi_chg_5d = curr_call_oi - history[0]["total_call_oi"]
            put_oi_chg_5d = curr_put_oi - history[0]["total_put_oi"]
            
        net_call_acc_5d = round(call_oi_chg_5d - put_oi_chg_5d, 0)
        
        # 30D OI Sparkline points
        oi_sparkline = [round(h["total_oi"], 0) for h in history[-30:]]
        
        # 2. Unusual Volume vs 20-Day Baseline
        vol_history = [h["total_vol"] for h in history[:-1][-20:]] if N > 1 else [curr_vol]
        avg_vol_20d = float(np.mean(vol_history)) if vol_history else curr_vol
        vol_ratio = round(curr_vol / max(avg_vol_20d, 100.0), 2)
        
        # 3. 30-Day Volatility Trend & IV Rank
        iv_history = [h["atm_iv_30d"] for h in history[-30:]]
        iv_min = min(iv_history) if iv_history else curr_iv
        iv_max = max(iv_history) if iv_history else curr_iv
        
        if (iv_max - iv_min) > 0.005:
            iv_rank = round(((curr_iv - iv_min) / (iv_max - iv_min)) * 100, 1)
        else:
            iv_rank = 50.0
        iv_rank = max(0.0, min(100.0, iv_rank))
        
        # IV Percentile
        lower_count = sum(1 for v in iv_history if v < curr_iv)
        iv_percentile = round((lower_count / max(len(iv_history), 1)) * 100, 1)
        
        # 5-day IV Change
        iv_5d_ago = history[-5]["atm_iv_30d"] if N >= 5 else history[0]["atm_iv_30d"]
        iv_chg_5d = round(curr_iv - iv_5d_ago, 4)
        iv_sparkline = [round(h["atm_iv_30d"] * 100, 1) for h in history[-30:]]
        
        # 4. Skew Rank (25-Delta Put vs Call Skew)
        skew_history = [h["skew_25d"] for h in history[-30:]]
        skew_min = min(skew_history) if skew_history else curr_skew
        skew_max = max(skew_history) if skew_history else curr_skew
        
        if (skew_max - skew_min) > 0.2:
            skew_rank = round(((curr_skew - skew_min) / (skew_max - skew_min)) * 100, 1)
        else:
            skew_rank = 50.0
        skew_rank = max(0.0, min(100.0, skew_rank))
        
        # 5. Top Unusual Sweep / Contract Flag
        unusual_contracts = today_row.get("unusual_contracts", [])
        top_unusual_contract = unusual_contracts[0] if unusual_contracts else None
        has_whale_sweep = any(c.get("vol_oi_ratio", 0) >= 2.0 and c.get("volume", 0) >= 1000 for c in unusual_contracts)
        
        # 6. Institutional Archetype Classification
        signal = "NEUTRAL"
        signal_badge = "⚖️ Neutral Rebalancing"
        signal_desc = "Normal options flow and delta distribution."
        signal_color = "#94a3b8"
        priority = 5
        
        if has_whale_sweep:
            signal = "WHALE_SWEEPS"
            signal_badge = "🐋 Whale Sweeps"
            signal_desc = "Block institutional orders aggressively exceeding existing open interest."
            signal_color = "#f59e0b"
            priority = 1
        elif net_call_acc_5d > 0 and call_vol_pct >= 58 and vol_ratio >= 1.2 and oi_chg_5d_pct > 1.5:
            signal = "CALL_ACCUMULATION"
            signal_badge = "🚀 Call Accumulation"
            signal_desc = "Persistent multi-session call OI accumulation with elevated volume."
            signal_color = "#10b981"
            priority = 1
        elif put_oi_chg_5d > call_oi_chg_5d and skew_rank >= 70 and curr_pcr_vol >= 1.05:
            signal = "PUT_HEDGING"
            signal_badge = "🛡️ Institutional Put Hedge"
            signal_desc = "Spike in put open interest and elevated 25-delta downside crash protection skew."
            signal_color = "#ef4444"
            priority = 2
        elif iv_rank >= 75 and iv_chg_5d > 0.015 and vol_ratio >= 1.3:
            signal = "VOL_SQUEEZE"
            signal_badge = "💥 Vol Squeeze / Expansion"
            signal_desc = "Implied volatility exploding to 30-day highs alongside volume expansion."
            signal_color = "#a855f7"
            priority = 2
        elif iv_rank <= 25 and iv_chg_5d < -0.01:
            signal = "VOL_CRUSH"
            signal_badge = "📉 Vol Crush / Decay"
            signal_desc = "IV compressed near 30-day lows, optimal premium harvesting or cheap debit buying."
            signal_color = "#38bdf8"
            priority = 3
        elif call_vol_pct >= 65 and oi_chg_5d_pct > 0:
            signal = "BULLISH_BIAS"
            signal_badge = "📈 Bullish Call Dominance"
            signal_desc = "Call volume outstripping puts with positive net OI expansion."
            signal_color = "#06b6d4"
            priority = 3
        elif curr_pcr_vol >= 1.3:
            signal = "BEARISH_BIAS"
            signal_badge = "📉 Bearish Put Flow"
            signal_desc = "Put volume heavily favored over calls."
            signal_color = "#f43f5e"
            priority = 4

        results.append({
            "ticker": ticker,
            "spot_price": spot_price,
            "signal": signal,
            "signal_badge": signal_badge,
            "signal_desc": signal_desc,
            "signal_color": signal_color,
            "priority": priority,
            "total_oi": curr_oi,
            "oi_chg_1d": oi_chg_1d,
            "oi_chg_1d_pct": oi_chg_1d_pct,
            "oi_chg_5d": oi_chg_5d,
            "oi_chg_5d_pct": oi_chg_5d_pct,
            "call_oi_chg_5d": call_oi_chg_5d,
            "put_oi_chg_5d": put_oi_chg_5d,
            "net_call_acc_5d": net_call_acc_5d,
            "total_vol": curr_vol,
            "avg_vol_20d": round(avg_vol_20d, 0),
            "vol_ratio": vol_ratio,
            "call_vol_pct": call_vol_pct,
            "pcr_vol": curr_pcr_vol,
            "pcr_oi": today_row["pcr_oi"],
            "atm_iv_30d": round(curr_iv * 100, 1),
            "iv_rank": iv_rank,
            "iv_percentile": iv_percentile,
            "iv_chg_5d": round(iv_chg_5d * 100, 1),
            "skew_25d": curr_skew,
            "skew_rank": skew_rank,
            "net_gex": today_row["net_gex"],
            "max_pain": today_row["max_pain"],
            "top_unusual_contract": top_unusual_contract,
            "unusual_contracts_count": len(unusual_contracts),
            "oi_sparkline": oi_sparkline,
            "iv_sparkline": iv_sparkline,
            "history_depth": N
        })
        
    # Sort by priority asc, then vol_ratio desc
    results.sort(key=lambda x: (x["priority"], -x["vol_ratio"], -abs(x["oi_chg_5d_pct"])))
    
    # Calculate market-wide stats
    mkt_tot_vol = sum(r["total_vol"] for r in results)
    mkt_avg_iv_rank = round(np.mean([r["iv_rank"] for r in results]), 1) if results else 50.0
    mkt_avg_pcr = round(np.mean([r["pcr_vol"] for r in results]), 2) if results else 1.0
    
    payload = {
        "latest_date": latest_date,
        "available_dates_count": len(all_dates),
        "total_symbols": len(results),
        "market_stats": {
            "total_options_volume": mkt_tot_vol,
            "avg_iv_rank": mkt_avg_iv_rank,
            "avg_pcr_vol": mkt_avg_pcr,
            "rolling_days": len(all_dates)
        },
        "records": results
    }
    
    _CACHE["data"] = payload
    _CACHE["timestamp"] = time.time()

    # Pre-warm deep analytics cache for top 12 symbols in background thread
    try:
        import threading
        top_syms = [r["ticker"] for r in results[:12]]
        def _bg_prewarm(sym_list):
            for s in sym_list:
                try:
                    get_deep_options_analytics(s)
                except Exception:
                    pass
        threading.Thread(target=_bg_prewarm, args=(top_syms,), daemon=True).start()
    except Exception:
        pass

    return payload

def get_ticker_30d_history(ticker):
    """Returns 30-day daily time series and unusual contracts for modal drilldown."""
    if not os.path.exists(DB_PATH):
        return {"error": "Database not found"}
        
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT date, spot_price, total_call_oi, total_put_oi, total_oi, pcr_oi,
               total_call_vol, total_put_vol, total_vol, pcr_vol, call_vol_pct,
               atm_iv_30d, skew_25d, net_gex, max_pain, unusual_contracts_json
        FROM options_daily_summary
        WHERE ticker = ?
        ORDER BY date ASC
    """, (ticker.upper().strip(),))
    rows = cur.fetchall()
    conn.close()
    
    if not rows:
        return {"ticker": ticker, "history": [], "unusual_contracts": []}
        
    history = []
    latest_unusual = []
    for r in rows:
        history.append({
            "date": r[0],
            "spot_price": r[1] or 0.0,
            "call_oi": r[2] or 0.0,
            "put_oi": r[3] or 0.0,
            "total_oi": r[4] or 0.0,
            "pcr_oi": r[5] or 1.0,
            "call_vol": r[6] or 0.0,
            "put_vol": r[7] or 0.0,
            "total_vol": r[8] or 0.0,
            "pcr_vol": r[9] or 1.0,
            "call_vol_pct": r[10] or 50.0,
            "atm_iv_30d": round((r[11] or 0.35) * 100, 1),
            "skew_25d": r[12] or 0.0,
            "net_gex": r[13] or 0.0,
            "max_pain": r[14] or (r[1] or 0.0)
        })
        if r[15]:
            try:
                latest_unusual = json.loads(r[15])
            except Exception:
                pass
                
    return {
        "ticker": ticker.upper().strip(),
        "history": history,
        "unusual_contracts": latest_unusual
    }

_DEEP_ANALYTICS_CACHE = {}
_DEEP_CACHE_TTL = 180  # 3 minutes

def get_deep_options_analytics(ticker):
    """
    Unified institutional options intelligence endpoint.
    Aggregates:
    1. 30-day historical time-series of Spot, OI, Volume, ATM IV, 25-Delta Skew, Net GEX, Max Pain.
    2. Live full-chain CBOE Greeks (Gamma, Delta, Vega, Theta/Charm).
    3. Color-coded Greek & flow trend indicators with direction arrows and percentage shifts.
    4. Strike-level Greeks curve (GEX & DEX per strike) and Term Structure.
    5. Institutional AI Options Recommendation with conviction score, optimal strategy, execution strikes, and plain-English microstructure rationale.
    """
    import math
    sym = ticker.upper().strip()
    now = time.time()
    if sym in _DEEP_ANALYTICS_CACHE:
        cached_entry, cached_time = _DEEP_ANALYTICS_CACHE[sym]
        if now - cached_time < _DEEP_CACHE_TTL:
            return cached_entry

    # 1. 30-day SQLite history
    base_history = get_ticker_30d_history(sym)
    history = base_history.get("history", [])
    unusual_contracts = base_history.get("unusual_contracts", [])
    
    # 2. Live GEX and CBOE Greeks
    gex_data = {}
    try:
        import sys
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)
        from gex_engine import get_gex_profile
        gex_data = get_gex_profile(sym)
    except Exception as e:
        print(f"Error fetching live GEX profile for {sym}: {e}")
        
    # Spot price
    spot_price = gex_data.get("spot_price") or (history[-1]["spot_price"] if history else 0.0)
    
    # Key levels & Risk scores
    key_levels = gex_data.get("key_levels", {})
    call_wall = key_levels.get("call_wall", round(spot_price * 1.05, 2))
    put_wall = key_levels.get("put_wall", round(spot_price * 0.95, 2))
    zero_gamma = key_levels.get("zero_gamma", round(spot_price, 2))
    max_pain = key_levels.get("max_pain", history[-1].get("max_pain", spot_price) if history else spot_price)
    charm_pin = key_levels.get("charm_pin_strike", max_pain)
    abs_gamma = key_levels.get("absolute_gamma", call_wall)
    abs_delta = key_levels.get("absolute_delta_strike", max_pain)
    
    risk_scores = gex_data.get("risk_scores", {})
    squeeze_score = risk_scores.get("squeeze_score", 30)
    pin_score = risk_scores.get("pin_score", 50)
    cascade_score = risk_scores.get("cascade_score", 30)
    
    totals = gex_data.get("totals", {})
    net_gex = totals.get("total_net_gex", (history[-1].get("net_gex", 0.0) * 1e6) if history else 0.0)
    net_dex = totals.get("total_net_dex", 0.0)
    net_vex = totals.get("total_net_vex", 0.0)
    net_cex = totals.get("total_net_cex", 0.0)
    call_gex = totals.get("total_call_gex", 0.0)
    put_gex = totals.get("total_put_gex", 0.0)
    call_oi_tot = totals.get("total_call_oi", history[-1].get("call_oi", 0) if history else 0)
    put_oi_tot = totals.get("total_put_oi", history[-1].get("put_oi", 0) if history else 0)
    call_vol_tot = totals.get("total_call_vol", history[-1].get("call_vol", 0) if history else 0)
    put_vol_tot = totals.get("total_put_vol", history[-1].get("put_vol", 0) if history else 0)
    pcr_oi = totals.get("put_call_oi_ratio", history[-1].get("pcr_oi", 1.0) if history else 1.0)
    pcr_vol = totals.get("put_call_vol_ratio", history[-1].get("pcr_vol", 1.0) if history else 1.0)
    
    # Expected move
    exp_move = gex_data.get("expected_move", {})
    atm_iv = exp_move.get("atm_iv_pct") or (history[-1]["atm_iv_30d"] if history else 35.0)
    move_1d = exp_move.get("move_1d", round(spot_price * (atm_iv / 100.0) / 16.0, 2))
    move_1d_pct = exp_move.get("move_1d_pct", round((atm_iv / 16.0), 1))
    move_5d = exp_move.get("move_5d", round(spot_price * (atm_iv / 100.0) * math.sqrt(5/252), 2))
    move_5d_pct = exp_move.get("move_5d_pct", round((atm_iv * math.sqrt(5/252)), 1))
    
    # 3. Multi-Session Trend Calculation (30-day baseline)
    N = len(history)
    iv_history = [h["atm_iv_30d"] for h in history] if history else [atm_iv]
    skew_history = [h["skew_25d"] for h in history] if history else [0.0]
    oi_history = [h["total_oi"] for h in history] if history else [call_oi_tot + put_oi_tot]
    vol_history = [h["total_vol"] for h in history] if history else [call_vol_tot + put_vol_tot]
    
    iv_min, iv_max = min(iv_history), max(iv_history)
    iv_rank = round(((atm_iv - iv_min) / max(iv_max - iv_min, 0.01)) * 100, 1) if (iv_max - iv_min) > 0.05 else 50.0
    iv_rank = max(0.0, min(100.0, iv_rank))
    
    skew_min, skew_max = min(skew_history), max(skew_history)
    curr_skew = skew_history[-1] if skew_history else 0.0
    skew_rank = round(((curr_skew - skew_min) / max(skew_max - skew_min, 0.1)) * 100, 1) if (skew_max - skew_min) > 0.2 else 50.0
    skew_rank = max(0.0, min(100.0, skew_rank))
    
    # 5-day delta trends
    ref_idx = -5 if N >= 5 else 0
    iv_5d_chg = round(atm_iv - (history[ref_idx]["atm_iv_30d"] if history else atm_iv), 1)
    call_oi_5d = round((history[-1]["call_oi"] if history else call_oi_tot) - (history[ref_idx]["call_oi"] if history else call_oi_tot), 0)
    put_oi_5d = round((history[-1]["put_oi"] if history else put_oi_tot) - (history[ref_idx]["put_oi"] if history else put_oi_tot), 0)
    net_call_accum_5d = call_oi_5d - put_oi_5d
    
    avg_vol_20d = float(np.mean([h["total_vol"] for h in history[:-1][-20:]])) if N > 1 else float(call_vol_tot + put_vol_tot)
    curr_total_vol = float(call_vol_tot + put_vol_tot)
    vol_ratio = round(curr_total_vol / max(avg_vol_20d, 100.0), 2)
    
    # 4. Color-Coded Trend Indicators
    # A. Implied Volatility Trend (Combines 5-day delta and 30-day IV Rank)
    if iv_5d_chg > 2.0 or (iv_5d_chg > 0.5 and iv_rank >= 80):
        iv_trend = {
            "direction": "UP",
            "arrow": "↑",
            "value": f"+{iv_5d_chg}%",
            "badge": "VOL EXPANSION",
            "color": "#a855f7",
            "status": "EXPANDING",
            "desc": f"Options implied volatility expanding rapidly ({iv_rank}% 30D rank); buyers bidding up option premiums."
        }
    elif iv_5d_chg < -2.0 or (iv_5d_chg < -0.5 and iv_rank <= 20):
        iv_trend = {
            "direction": "DOWN",
            "arrow": "↓",
            "value": f"{iv_5d_chg}%",
            "badge": "VOL CRUSH",
            "color": "#10b981",
            "status": "CRUSHING",
            "desc": f"Implied volatility compressing ({iv_rank}% 30D rank); favourable for credit sellers or low-cost debit entries."
        }
    else:
        iv_trend = {
            "direction": "FLAT",
            "arrow": "→",
            "value": f"{iv_5d_chg:+.1f}%",
            "badge": "VOL BALANCED",
            "color": "#38bdf8",
            "status": "STABLE",
            "desc": f"Volatility trading near its 30-day baseline equilibrium ({iv_rank}% 30D rank)."
        }
        
    # B. Open Interest Trend (Adaptive threshold: absolute count and % of total OI)
    total_oi_val = max(call_oi_tot + put_oi_tot, 1000)
    net_accum_pct = (abs(net_call_accum_5d) / total_oi_val) * 100
    is_meaningful_oi = (abs(net_call_accum_5d) >= 1500 and net_accum_pct >= 0.25) or (net_accum_pct >= 1.5)

    if net_call_accum_5d > 0 and is_meaningful_oi:
        oi_trend = {
            "direction": "BULLISH",
            "arrow": "↑",
            "value": f"+{int(net_call_accum_5d):,} Net Calls ({net_accum_pct:.1f}%)",
            "badge": "CALL ACCUMULATION",
            "color": "#10b981",
            "desc": "Institutional smart money persistently accumulating upside call inventory over 5 sessions."
        }
    elif net_call_accum_5d < 0 and is_meaningful_oi:
        oi_trend = {
            "direction": "BEARISH",
            "arrow": "↓",
            "value": f"{int(abs(net_call_accum_5d)):,} Net Puts ({net_accum_pct:.1f}%)",
            "badge": "PUT HEDGING",
            "color": "#f43f5e",
            "desc": "Spike in put open interest indicating heavy institutional tail-risk protection."
        }
    else:
        oi_trend = {
            "direction": "NEUTRAL",
            "arrow": "→",
            "value": f"Balanced ({int(net_call_accum_5d):+,} / {net_accum_pct:.2f}%)",
            "badge": "NEUTRAL REBALANCING",
            "color": "#94a3b8",
            "desc": "Even multi-session distribution between calls and puts."
        }

    # C. 25-Delta Skew Trend
    if curr_skew > 3.0:
        skew_trend = {
            "direction": "STEEPENING",
            "arrow": "↑",
            "value": f"+{curr_skew}% Puts Over Calls",
            "badge": "DOWNSIDE CRASH SKEW",
            "color": "#f43f5e",
            "desc": "Deep out-of-the-money puts command a steep volatility premium over calls."
        }
    elif curr_skew < -1.0:
        skew_trend = {
            "direction": "INVERTED",
            "arrow": "↓",
            "value": f"{curr_skew}% Calls Over Puts",
            "badge": "CALL SKEW ELEVATED",
            "color": "#38bdf8",
            "desc": "Call skew elevated/inverted; market aggressively bidding upside call options."
        }
    else:
        skew_trend = {
            "direction": "NORMAL",
            "arrow": "→",
            "value": f"{curr_skew:+.1f}% Normal Skew",
            "badge": "NORMAL SKEW",
            "color": "#94a3b8",
            "desc": "Standard equity skew curve with balanced crash risk premium."
        }

    # D. Gamma Exposure Regime Trend (Refined for true dealer microstructural postures)
    dist_to_put_wall_pct = abs(spot_price - put_wall) / spot_price if spot_price > 0 else 0.1
    if squeeze_score >= 70:
        gamma_trend = {
            "regime": "SQUEEZE_RISK",
            "badge": "GAMMA SQUEEZE ACTIVE 🚀",
            "color": "#00E676",
            "desc": f"Spot pressing Call Wall (${call_wall}). Dealers forced into pro-cyclical share buying on upticks."
        }
    elif cascade_score >= 70 and (spot_price < zero_gamma or net_gex < 0):
        gamma_trend = {
            "regime": "CASCADE_RISK",
            "badge": "CASCADE VULNERABILITY ⚠️",
            "color": "#f43f5e",
            "desc": f"Spot testing Put Wall (${put_wall}) in negative gamma. Dealers dump shares into declines to hedge delta."
        }
    elif dist_to_put_wall_pct <= 0.02 and net_gex >= 0 and spot_price >= zero_gamma:
        gamma_trend = {
            "regime": "LONG_GAMMA_SUPPORT",
            "badge": "PUT WALL CUSHION 🛡️",
            "color": "#10b981",
            "desc": f"Spot testing Put Wall (${put_wall}) in positive gamma. Dealers buy dips, providing structural price support."
        }
    elif pin_score >= 70:
        gamma_trend = {
            "regime": "PIN_EQUILIBRIUM",
            "badge": "HIGH PIN EQUILIBRIUM 🧲",
            "color": "#fbbf24",
            "desc": f"Spot magnetically coiled near Max Pain (${max_pain}). Heavy delta decay pinning toward expiration."
        }
    elif net_gex >= 0:
        gamma_trend = {
            "regime": "LONG_GAMMA",
            "badge": "LONG GAMMA CUSHION 🛡️",
            "color": "#38bdf8",
            "desc": "Market makers are long gamma. Volatility is dampened as dealers buy dips and sell rips."
        }
    else:
        gamma_trend = {
            "regime": "SHORT_GAMMA",
            "badge": "SHORT GAMMA ACCELERATOR 🌪️",
            "color": "#f59e0b",
            "desc": "Market makers are short gamma. Price swings are amplified directionally."
        }

    # E. Unusual Volume Pace Trend
    if vol_ratio >= 2.0:
        vol_trend = {
            "ratio": vol_ratio,
            "badge": f"⚡ {vol_ratio}x FRENZY FLOW",
            "color": "#f59e0b",
            "desc": "Exceptional institutional options volume exceeding 200% of the 20-day baseline."
        }
    elif vol_ratio >= 1.25:
        vol_trend = {
            "ratio": vol_ratio,
            "badge": f"🔥 {vol_ratio}x ELEVATED VOLUME",
            "color": "#38bdf8",
            "desc": "Options volume comfortably higher than normal 20-day moving average."
        }
    else:
        vol_trend = {
            "ratio": vol_ratio,
            "badge": f"⚖️ {vol_ratio}x BASELINE",
            "color": "#94a3b8",
            "desc": "Typical daily volume consistent with 20-day moving average."
        }

    # 5. Strike Distribution (within +/- 30% of spot price)
    full_strikes = gex_data.get("gex_profile", [])
    filtered_strikes = []
    if full_strikes and spot_price > 0:
        # Active institutional corridor (+/- 15% of spot)
        corridor = [p for p in full_strikes if 0.85 * spot_price <= p["strike"] <= 1.15 * spot_price]
        if len(corridor) < 18:
            corridor = [p for p in full_strikes if 0.75 * spot_price <= p["strike"] <= 1.25 * spot_price]
        if len(corridor) > 48:
            # Sort by distance from spot, take top 48 for instantaneous SVG rendering
            corridor.sort(key=lambda x: abs(x["strike"] - spot_price))
            corridor = corridor[:48]

        # Ensure key wall strikes are always included
        wall_strikes = {call_wall, put_wall, zero_gamma, max_pain}
        included_strikes = {p["strike"] for p in corridor}
        for p in full_strikes:
            if p["strike"] in wall_strikes and p["strike"] not in included_strikes:
                corridor.append(p)
                included_strikes.add(p["strike"])

        for p in corridor:
            st = p["strike"]
            filtered_strikes.append({
                "strike": st,
                "net_gex": round(p.get("net_gex", 0.0) / 1e6, 2),
                "call_gex": round(p.get("call_gex", 0.0) / 1e6, 2),
                "put_gex": round(p.get("put_gex", 0.0) / 1e6, 2),
                "net_dex": round(p.get("net_dex", 0.0) / 1e6, 2),
                "call_oi": p.get("call_oi", 0),
                "put_oi": p.get("put_oi", 0),
                "call_vol": p.get("call_vol", 0),
                "put_vol": p.get("put_vol", 0),
                "is_spot": False,
                "is_call_wall": False,
                "is_put_wall": False,
                "is_zero_gamma": False,
                "is_max_pain": False
            })
        filtered_strikes.sort(key=lambda x: x["strike"])

        if filtered_strikes:
            # Tag closest spot
            closest_spot = min(filtered_strikes, key=lambda x: abs(x["strike"] - spot_price))
            closest_spot["is_spot"] = True

            # Tag closest call wall
            closest_cw = min(filtered_strikes, key=lambda x: abs(x["strike"] - call_wall))
            closest_cw["is_call_wall"] = True

            # Tag closest put wall
            closest_pw = min(filtered_strikes, key=lambda x: abs(x["strike"] - put_wall))
            closest_pw["is_put_wall"] = True

            # Tag closest zero gamma
            closest_zg = min(filtered_strikes, key=lambda x: abs(x["strike"] - zero_gamma))
            closest_zg["is_zero_gamma"] = True

            # Tag closest max pain
            closest_mp = min(filtered_strikes, key=lambda x: abs(x["strike"] - max_pain))
            closest_mp["is_max_pain"] = True

    # 6. Term Structure & 3-Day Volatility Shift Evolution
    term_structure = gex_data.get("term_structure", [])
    if not term_structure and spot_price > 0:
        dtes = [7, 14, 21, 30, 45, 60, 90, 120, 180, 360]
        today_date = datetime.date.today()
        for d in dtes:
            exp_str = (today_date + datetime.timedelta(days=d)).strftime('%Y-%m-%d')
            slope_est = math.log(d / 30.0) * 2.2
            cycle_iv = max(15.0, round(atm_iv + slope_est, 1))
            cycle_gex = round((net_gex / 1e6) * math.exp(-d / 120.0), 2)
            tot_oi_est = int((call_oi_tot + put_oi_tot) * (0.3 * math.exp(-d / 90.0) + 0.05))
            c_oi_est = int(tot_oi_est / (1.0 + pcr_oi))
            p_oi_est = tot_oi_est - c_oi_est
            term_structure.append({
                "expiry": exp_str,
                "dte": d,
                "atm_iv": cycle_iv,
                "net_gex": cycle_gex * 1e6,
                "net_gex_millions": cycle_gex,
                "call_gex": max(0.0, cycle_gex * 1.5) * 1e6,
                "call_gex_millions": round(max(0.0, cycle_gex * 1.5), 2),
                "put_gex": min(0.0, -abs(cycle_gex) * 0.5) * 1e6,
                "put_gex_millions": round(min(0.0, -abs(cycle_gex) * 0.5), 2),
                "call_oi": c_oi_est,
                "put_oi": p_oi_est,
                "total_oi": tot_oi_est,
                "pcr_oi": pcr_oi
            })

    # Synthesize 3-Day Multi-Session Term Structure History
    recent_hist = history[-4:] if len(history) >= 4 else history
    term_structure_history = []
    
    if recent_hist and term_structure:
        for i, h in enumerate(reversed(recent_hist)):
            day_label = 'Today' if i == 0 else f'{i}D Ago'
            base_iv = h.get('atm_iv_30d', atm_iv)
            diff_from_today = base_iv - recent_hist[-1].get('atm_iv_30d', atm_iv)
            
            cycles_hist = []
            for c in term_structure:
                c_dte = c.get('dte', 30) + i
                scale = (30.0 / max(c_dte, 7)) ** 0.35
                shifted_iv = round(max(5.0, c.get('atm_iv', atm_iv) + diff_from_today * scale), 1)
                cycles_hist.append({
                    'expiry': c.get('expiry'),
                    'dte': c_dte,
                    'atm_iv': shifted_iv,
                    'net_gex_millions': round(c.get('net_gex_millions', 0.0) * (1.0 - i * 0.08), 2)
                })
            term_structure_history.append({
                'date': h.get('date'),
                'label': day_label,
                'days_ago': i,
                'spot_price': h.get('spot_price', spot_price),
                'base_iv': base_iv,
                'cycles': cycles_hist
            })

    # Compute 3-Day Volatility Shift & Regime
    front_today = term_structure[0]['atm_iv'] if term_structure else atm_iv
    back_today = term_structure[-1]['atm_iv'] if term_structure else atm_iv
    front_3d = term_structure_history[-1]['cycles'][0]['atm_iv'] if term_structure_history and term_structure_history[-1]['cycles'] else front_today
    back_3d = term_structure_history[-1]['cycles'][-1]['atm_iv'] if term_structure_history and term_structure_history[-1]['cycles'] else back_today

    front_delta = round(front_today - front_3d, 1)
    back_delta = round(back_today - back_3d, 1)
    slope_today = round(back_today - front_today, 1)
    slope_3d = round(back_3d - front_3d, 1)
    slope_delta = round(slope_today - slope_3d, 1)

    if front_today > back_today + 3.0:
        regime_badge = "INVERTED BACKWARDATION 🚨"
        regime_color = "#f43f5e"
        regime_desc = f"Front-month IV ({front_today}%) is sharply inverted above back-month ({back_today}%). Market aggressively bidding near-term tail risk protection."
    elif front_delta < -3.0 and back_delta < -1.5:
        regime_badge = "VOLATILITY CRUSH 📉"
        regime_color = "#38bdf8"
        regime_desc = f"IV collapsed by {front_delta}% across front expiries over the last 3 sessions. Post-catalyst implied volatility crush is underway."
    elif slope_delta > 1.5:
        regime_badge = "CONTANGO STEEPENING 📈"
        regime_color = "#10b981"
        regime_desc = f"Term structure steepened (+{slope_delta}% slope drift). Front-month IV softened relative to back-month, confirming tranquil market regime."
    elif slope_delta < -1.5:
        regime_badge = "FLATTENING REGIME ⚠️"
        regime_color = "#fbbf24"
        regime_desc = f"Term structure flattened by {abs(slope_delta)}% over 3 days. Elevated short-term hedging activity compressing forward contango."
    else:
        regime_badge = "STABLE CONTANGO ⚖️"
        regime_color = "#94a3b8"
        regime_desc = f"Term structure has remained balanced over the last 3 trading sessions with normal time decay posture."

    volatility_shift_summary = {
        "front_iv_shift_3d": front_delta,
        "back_iv_shift_3d": back_delta,
        "slope_today": slope_today,
        "slope_3d_ago": slope_3d,
        "slope_delta": slope_delta,
        "regime_badge": regime_badge,
        "regime_color": regime_color,
        "regime_desc": regime_desc
    }

    # 7. Institutional AI Options Recommendation
    trade_setup = gex_data.get("trade_setup")
    if trade_setup and trade_setup.get("strategy_name"):
        ai_recommendation = {
            "title": trade_setup.get("setup_name", "Quantitative Options Playbook"),
            "bias": trade_setup.get("bias", "TACTICAL OPPORTUNITY"),
            "conviction_score": min(96, max(68, int(80 + (squeeze_score if squeeze_score > 60 else (cascade_score if cascade_score > 60 else pin_score)) * 0.15))),
            "strategy": trade_setup.get("strategy_name"),
            "options_spec": trade_setup.get("options_spec"),
            "ideal_entry": trade_setup.get("ideal_entry"),
            "entry_range": f"${trade_setup.get('entry_range', [spot_price, spot_price])[0]} – ${trade_setup.get('entry_range', [spot_price, spot_price])[1]}",
            "stop_loss": trade_setup.get("stop_loss"),
            "target_primary": trade_setup.get("target_primary"),
            "risk_reward": trade_setup.get("risk_reward", "1:2.5"),
            "expected_holding": trade_setup.get("expected_holding", "5 to 15 Trading Days"),
            "trigger_condition": trade_setup.get("trigger_condition"),
            "invalidation_condition": trade_setup.get("invalidation_condition"),
            "microstructure_rationale": trade_setup.get("execution_tactic") or (
                f"Dealer positioning on {sym} shows key resistance at Call Wall (${call_wall}) and floor at Put Wall (${put_wall}). "
                f"Given {gamma_trend['badge']} and {oi_trend['badge']}, institutional order flow favors {trade_setup.get('strategy_name')}."
            ),
            "execution_checklist": trade_setup.get("execution_checklist", [])
        }
    else:
        # Algorithmic fallback recommendation
        if net_call_accum_5d > 0 and vol_ratio >= 1.2:
            rec_strat = "Bull Call Debit Spread (21-35 DTE)"
            rec_spec = f"Buy ${round(spot_price, 1)} Call / Sell ${round(call_wall, 1)} Call"
            rec_bias = "BULLISH BREAKOUT"
            rec_conv = 82
            rec_rationale = f"Persistent call accumulation (+{int(net_call_accum_5d):,} contracts) alongside {vol_ratio}x volume pace indicates institutional smart money positioning for an upside test toward Call Wall (${call_wall})."
        elif put_oi_5d > call_oi_5d and cascade_score > 55:
            rec_strat = "Bear Put Debit Spread (14-28 DTE)"
            rec_spec = f"Buy ${round(spot_price, 1)} Put / Sell ${round(put_wall, 1)} Put"
            rec_bias = "BEARISH CASCADE HEDGE"
            rec_conv = 78
            rec_rationale = f"Spike in put open interest and elevated downside skew indicate protective hedging. Invalidation is a reclaim above Zero Gamma (${zero_gamma})."
        elif pin_score >= 65:
            rec_strat = "Iron Condor / Short Put Spread (7-14 DTE)"
            rec_spec = f"Sell ${round(put_wall, 1)} Put / Sell ${round(call_wall, 1)} Call"
            rec_bias = "NEUTRAL PIN HARVEST"
            rec_conv = 85
            rec_rationale = f"Spot price is tightly bracketed between Put Wall (${put_wall}) and Call Wall (${call_wall}) with strong gravitational pull toward Max Pain (${max_pain}). Ideal for theta decay capture."
        else:
            rec_strat = "Long Call or Put Debit Spread (14-28 DTE)"
            rec_spec = f"Targeting Call Wall (${call_wall}) vs Put Wall (${put_wall})"
            rec_bias = "DIRECTIONAL SWING"
            rec_conv = 74
            rec_rationale = f"Options market is balanced with 30D IV Rank at {iv_rank}%. Defined-risk vertical spreads offer the most asymmetric risk/reward."
            
        ai_recommendation = {
            "title": f"{rec_bias} PLAYBOOK 🎯",
            "bias": rec_bias,
            "conviction_score": rec_conv,
            "strategy": rec_strat,
            "options_spec": rec_spec,
            "ideal_entry": spot_price,
            "entry_range": f"${round(spot_price * 0.99, 2)} – ${round(spot_price * 1.01, 2)}",
            "stop_loss": round(put_wall * 0.98 if 'Bull' in rec_strat else call_wall * 1.02, 2),
            "target_primary": round(call_wall if 'Bull' in rec_strat else put_wall, 2),
            "risk_reward": "1:2.4",
            "expected_holding": "5 to 20 Trading Days",
            "trigger_condition": f"Confirming volume expansion above {vol_ratio}x baseline.",
            "invalidation_condition": f"Violation of key Greek boundary (${put_wall if 'Bull' in rec_strat else call_wall}).",
            "microstructure_rationale": rec_rationale,
            "execution_checklist": [
                {"phase": "Phase 1: Pre-Trade Greek Audit", "detail": f"Confirm spot (${spot_price}) vs Call Wall (${call_wall}) and Put Wall (${put_wall})."},
                {"phase": "Phase 2: Execution", "detail": f"Enter {rec_strat} with defined risk."},
                {"phase": "Phase 3: Risk Management", "detail": f"Close if spot violates invalidation boundary."}
            ]
        }

    payload = {
        "ticker": sym,
        "spot_price": spot_price,
        "history": history,
        "greeks_matrix": {
            "gamma": {
                "net_gex_millions": round(net_gex / 1e6, 2),
                "call_gex_millions": round(call_gex / 1e6, 2),
                "put_gex_millions": round(put_gex / 1e6, 2),
                "call_wall": call_wall,
                "put_wall": put_wall,
                "zero_gamma": zero_gamma,
                "absolute_gamma": abs_gamma,
                "regime": gamma_trend["regime"]
            },
            "delta": {
                "net_dex_millions": round(net_dex / 1e6, 2),
                "absolute_delta_strike": abs_delta
            },
            "vega_volatility": {
                "atm_iv_pct": atm_iv,
                "iv_rank_30d": iv_rank,
                "iv_percentile_30d": iv_rank,
                "iv_5d_chg": iv_5d_chg,
                "skew_25d": curr_skew,
                "skew_rank_30d": skew_rank,
                "expected_move_1d": move_1d,
                "expected_move_1d_pct": move_1d_pct,
                "expected_move_5d": move_5d,
                "expected_move_5d_pct": move_5d_pct
            },
            "charm_theta": {
                "net_cex_millions": round(net_cex / 1e6, 2),
                "charm_pin_strike": charm_pin,
                "max_pain": max_pain
            },
            "order_flow": {
                "total_volume": curr_total_vol,
                "call_volume": call_vol_tot,
                "put_volume": put_vol_tot,
                "vol_ratio_20d": vol_ratio,
                "pcr_vol": pcr_vol,
                "total_oi": call_oi_tot + put_oi_tot,
                "call_oi": call_oi_tot,
                "put_oi": put_oi_tot,
                "pcr_oi": pcr_oi,
                "net_call_accum_5d": net_call_accum_5d
            },
            "risk_scores": {
                "squeeze_score": squeeze_score,
                "pin_score": pin_score,
                "cascade_score": cascade_score
            }
        },
        "trend_indicators": {
            "iv": iv_trend,
            "oi": oi_trend,
            "skew": skew_trend,
            "gamma": gamma_trend,
            "volume": vol_trend,
            "pin_risk": {
                "score": pin_score,
                "badge": "HIGH PIN RISK" if pin_score >= 70 else ("MODERATE PINNING" if pin_score >= 50 else "FREE FLOAT"),
                "color": "#00E676" if pin_score >= 70 else ("#38bdf8" if pin_score >= 50 else "#94a3b8")
            },
            "cascade_risk": {
                "score": cascade_score,
                "badge": "HIGH CASCADE RISK" if cascade_score >= 70 else ("MODERATE CASCADE" if cascade_score >= 50 else "LOW RISK"),
                "color": "#f43f5e" if cascade_score >= 70 else ("#fbbf24" if cascade_score >= 50 else "#94a3b8")
            },
            "squeeze_risk": {
                "score": squeeze_score,
                "badge": "EXTREME SQUEEZE RISK" if squeeze_score >= 75 else ("ELEVATED" if squeeze_score >= 55 else "LOW RISK"),
                "color": "#00E676" if squeeze_score >= 75 else ("#38bdf8" if squeeze_score >= 55 else "#94a3b8")
            }
        },
        "strike_distribution": filtered_strikes,
        "term_structure": term_structure,
        "term_structure_history": term_structure_history,
        "volatility_shift_summary": volatility_shift_summary,
        "unusual_contracts": unusual_contracts,
        "ai_recommendation": ai_recommendation
    }
    _DEEP_ANALYTICS_CACHE[sym] = (payload, now)
    return payload

if __name__ == '__main__':
    res = get_options_screener_summary()
    print(f"Summary computed for {res.get('total_symbols')} symbols across {res.get('available_dates_count')} dates.")
    if res.get('records'):
        top = res['records'][0]
        print(f"Top result: {top['ticker']} - Signal: {top['signal_badge']} - Vol Ratio: {top['vol_ratio']}x - IV Rank: {top['iv_rank']}%")
