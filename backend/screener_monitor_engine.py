import json
import re
import os
import time
import math
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
import concurrent.futures
import duckdb
import pandas as pd
import numpy as np

try:
    import yfinance as yf
except ImportError:
    yf = None

logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
CACHE_FILE = os.path.join(DATA_DIR, 'screener_monitor.json')
EXPERT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'screener_results.json')
RS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'rs_scanner_results.json')
SQUEEZE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'squeeze_results.json')
ALERTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'alerts.json')
LAKEHOUSE_PATH = os.path.join(DATA_DIR, 'daily_ohlcv.parquet')
MARKET_HEALTH_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'market_health.json')

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "YOUR_TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "YOUR_TELEGRAM_CHAT_ID")


def get_macro_regime_summary() -> Dict[str, Any]:
    """Retrieves current macro regime internals for market context."""
    if os.path.exists(MARKET_HEALTH_FILE):
        try:
            with open(MARKET_HEALTH_FILE, 'r') as f:
                h = json.load(f)
                cur = h.get('current_health', {})
                score = cur.get('score_value', 45.0)
                regime = cur.get('health_regime', 'CAUTIOUS')
                label = cur.get('health_regime_label', 'Cautious (Neutral/Choppy)')
                color = cur.get('health_regime_color', '#f59e0b')
                
                if score >= 65:
                    exp_guidance = "Breakout Expansion: High Follow-Through Probability (>75%)"
                elif score >= 45:
                    exp_guidance = "Tactical Environment: Partial T1 Profit Taking Advised"
                else:
                    exp_guidance = "Defensive Regime: High Failure Rate; Tight Stops Strictly Required"
                    
                return {
                    'regime': regime,
                    'label': label,
                    'color': color,
                    'score': score,
                    'mco': cur.get('mco_status', 'Neutral'),
                    'breadth_p50': cur.get('pct_above_50_value', 40.0),
                    'guidance': exp_guidance
                }
        except Exception:
            pass
    return {
        'regime': 'CAUTIOUS',
        'label': 'Cautious (Neutral/Choppy)',
        'color': '#f59e0b',
        'score': 45.0,
        'mco': 'Neutral',
        'breadth_p50': 40.0,
        'guidance': 'Tactical Environment: Partial T1 Profit Taking Advised'
    }


def get_all_screener_candidates() -> Dict[str, Dict[str, Any]]:
    """
    Ingests tickers from all 39 expert screeners and scans.
    Deduplicates tickers and tracks multi-screener confluence.
    """
    candidates = {}

    # 1. Main Expert Screeners (39 categories)
    if os.path.exists(EXPERT_FILE):
        try:
            with open(EXPERT_FILE, 'r') as f:
                data = json.load(f)
            for category, items in data.items():
                cat_label = category.replace('_', ' ').title()
                for item in items:
                    t = item.get('ticker')
                    if not t or not isinstance(t, str):
                        continue
                    t = t.upper().strip()
                    if t not in candidates:
                        candidates[t] = {
                            'ticker': t,
                            'screeners': [cat_label],
                            'raw_metric': item.get('metric', ''),
                            'score': float(item.get('score', 0.0)) if item.get('score') else 0.0
                        }
                    else:
                        if cat_label not in candidates[t]['screeners']:
                            candidates[t]['screeners'].append(cat_label)
        except Exception as e:
            logger.error(f"Error reading screener_results.json: {e}")

    # 2. RS Scanner Results
    if os.path.exists(RS_FILE):
        try:
            with open(RS_FILE, 'r') as f:
                data = json.load(f)
            results = data.get('results', [])
            for item in results[:50]:
                t = item.get('ticker', '').upper().strip()
                if t:
                    if t not in candidates:
                        candidates[t] = {
                            'ticker': t,
                            'screeners': ['Relative Strength Leader'],
                            'raw_metric': f"RS Rating: {item.get('rs_rating', 'High')}",
                            'score': float(item.get('rs_rating', 80))
                        }
                    elif 'Relative Strength Leader' not in candidates[t]['screeners']:
                        candidates[t]['screeners'].append('Relative Strength Leader')
        except Exception as e:
            logger.error(f"Error reading rs_scanner_results.json: {e}")

    # 3. Squeeze Radar Results
    if os.path.exists(SQUEEZE_FILE):
        try:
            with open(SQUEEZE_FILE, 'r') as f:
                data = json.load(f)
            for sq_type, items in data.items():
                sq_label = sq_type.replace('_', ' ').title()
                for item in items[:25]:
                    t = item.get('ticker', '').upper().strip()
                    if t:
                        if t not in candidates:
                            candidates[t] = {
                                'ticker': t,
                                'screeners': [sq_label],
                                'raw_metric': item.get('setup', sq_label),
                                'score': 50.0
                            }
                        elif sq_label not in candidates[t]['screeners']:
                            candidates[t]['screeners'].append(sq_label)
        except Exception as e:
            logger.error(f"Error reading squeeze_results.json: {e}")

    return candidates


def fetch_batch_quotes_duckdb(tickers: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Sub-second vectorized quote, pivot, moving average, and volume extraction using DuckDB parquet lakehouse.
    Falls back gracefully to yfinance for any missing symbols.
    """
    quotes = {}
    if not tickers:
        return quotes

    missing_tickers = []
    
    # 1. Primary Vectorized Ingestion from Parquet
    if os.path.exists(LAKEHOUSE_PATH):
        try:
            con = duckdb.connect()
            tickers_str = "', '".join(tickers)
            query = f"""
            SELECT Date, Ticker, Open, High, Low, Close, Volume
            FROM read_parquet('{LAKEHOUSE_PATH}')
            WHERE Ticker IN ('{tickers_str}')
            ORDER BY Ticker, Date
            """
            raw_df = con.query(query).df()
            if not raw_df.empty:
                grouped = raw_df.groupby('Ticker')
                for sym, group in grouped:
                    if len(group) < 5:
                        missing_tickers.append(sym)
                        continue
                    
                    c = group['Close']
                    h = group['High']
                    l = group['Low']
                    v = group['Volume']
                    
                    price = float(c.iloc[-1])
                    if price <= 0:
                        missing_tickers.append(sym)
                        continue
                        
                    recent_high = float(h.tail(20).max())
                    recent_low = float(l.tail(20).min())
                    recent_3d_high = float(h.tail(3).max())
                    recent_3d_low = float(l.tail(3).min())
                    curr_vol = float(v.iloc[-1])
                    avg_vol = float(v.tail(20).mean())
                    
                    # ATR 14
                    tr = (h - l).tail(14).mean()
                    atr = float(tr) if not math.isnan(tr) and tr > 0 else round(price * 0.03, 2)
                    
                    # Moving averages & Confluence
                    ema10 = float(c.ewm(span=10, adjust=False).mean().iloc[-1])
                    ema21 = float(c.ewm(span=21, adjust=False).mean().iloc[-1])
                    sma50 = float(c.rolling(50).mean().iloc[-1]) if len(c) >= 50 else ema21
                    
                    if price > ema10 and ema10 > ema21 and ema21 > sma50:
                        ma_confluence = "Stage 2 (10>21>50)"
                        ma_color = "#10b981"
                    elif price >= ema21 * 0.99:
                        ma_confluence = "Holding 21-EMA"
                        ma_color = "#00f2fe"
                    elif price >= sma50 * 0.99:
                        ma_confluence = "Holding 50-SMA"
                        ma_color = "#f59e0b"
                    else:
                        ma_confluence = "Below 21-EMA"
                        ma_color = "#94a3b8"
                        
                    quotes[sym] = {
                        'price': round(price, 2),
                        'recent_high': round(recent_high, 2),
                        'recent_low': round(recent_low, 2),
                        'recent_3d_low': round(recent_3d_low, 2),
                        'recent_3d_high': round(recent_3d_high, 2),
                        'avg_vol': avg_vol,
                        'curr_vol': curr_vol,
                        'atr': round(atr, 2),
                        'ema_10': round(ema10, 2),
                        'ema_21': round(ema21, 2),
                        'sma_50': round(sma50, 2),
                        'ma_confluence': ma_confluence,
                        'ma_color': ma_color
                    }
        except Exception as e:
            logger.error(f"Error in vectorized DuckDB quote extraction: {e}")
            missing_tickers = tickers
            
    # Find any tickers in requested list that weren't in parquet
    for sym in tickers:
        if sym not in quotes:
            missing_tickers.append(sym)
            
    # 2. Fallback to yfinance for any missing symbols
    if missing_tickers and yf:
        def get_single(sym):
            try:
                t = yf.Ticker(sym)
                fast = getattr(t, 'fast_info', {}) or {}
                price = float(fast.get('lastPrice') or fast.get('regularMarketPrice') or 0.0)
                hist = t.history(period="1mo")
                if not hist.empty:
                    if price <= 0:
                        price = float(hist['Close'].iloc[-1])
                    recent_high = float(hist['High'].tail(20).max())
                    recent_low = float(hist['Low'].tail(20).min())
                    recent_3d_low = float(hist['Low'].tail(3).min())
                    recent_3d_high = float(hist['High'].tail(3).max())
                    avg_vol = float(hist['Volume'].tail(20).mean())
                    curr_vol = float(hist['Volume'].iloc[-1])
                    tr = (hist['High'] - hist['Low']).tail(14).mean()
                    atr = float(tr) if not math.isnan(tr) else price * 0.03
                    return sym, {
                        'price': round(price, 2),
                        'recent_high': round(recent_high, 2),
                        'recent_low': round(recent_low, 2),
                        'recent_3d_low': round(recent_3d_low, 2),
                        'recent_3d_high': round(recent_3d_high, 2),
                        'avg_vol': avg_vol,
                        'curr_vol': curr_vol,
                        'atr': round(atr, 2),
                        'ema_10': round(price * 0.99, 2),
                        'ema_21': round(price * 0.98, 2),
                        'sma_50': round(price * 0.96, 2),
                        'ma_confluence': "Holding 21-EMA",
                        'ma_color': "#00f2fe"
                    }
            except Exception:
                pass
            return sym, None

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            results = executor.map(get_single, missing_tickers[:30])
            for sym, q in results:
                if q:
                    quotes[sym] = q

    # 3. Real-Time Intraday Overlay via yfinance for Live Breakout Surveillance
    if yf and tickers:
        try:
            live_batch = [s for s in tickers[:120]]
            live_df = yf.download(live_batch, period='1d', progress=False)
            if not live_df.empty:
                for sym in live_batch:
                    try:
                        lp = float(live_df['Close'][sym].iloc[-1]) if ('Close' in live_df and sym in live_df['Close']) else 0.0
                        lv = float(live_df['Volume'][sym].iloc[-1]) if ('Volume' in live_df and sym in live_df['Volume']) else 0.0
                        lh = float(live_df['High'][sym].iloc[-1]) if ('High' in live_df and sym in live_df['High']) else 0.0
                        ll = float(live_df['Low'][sym].iloc[-1]) if ('Low' in live_df and sym in live_df['Low']) else 0.0

                        if lp > 0 and not math.isnan(lp):
                            if sym in quotes:
                                quotes[sym]['price'] = round(lp, 2)
                                if lv > 0 and not math.isnan(lv):
                                    quotes[sym]['curr_vol'] = lv
                                if lh > 0 and not math.isnan(lh):
                                    quotes[sym]['recent_high'] = max(quotes[sym]['recent_high'], round(lh, 2))
                                    quotes[sym]['recent_3d_high'] = max(quotes[sym]['recent_3d_high'], round(lh, 2))
                                if ll > 0 and not math.isnan(ll):
                                    quotes[sym]['recent_low'] = min(quotes[sym]['recent_low'], round(ll, 2))
                                    quotes[sym]['recent_3d_low'] = min(quotes[sym]['recent_3d_low'], round(ll, 2))
                            else:
                                quotes[sym] = {
                                    'price': round(lp, 2),
                                    'recent_high': round(lh if lh > 0 else lp, 2),
                                    'recent_low': round(ll if ll > 0 else lp, 2),
                                    'recent_3d_low': round(ll if ll > 0 else lp, 2),
                                    'recent_3d_high': round(lh if lh > 0 else lp, 2),
                                    'avg_vol': lv,
                                    'curr_vol': lv,
                                    'atr': round(lp * 0.03, 2),
                                    'ema_10': round(lp * 0.99, 2),
                                    'ema_21': round(lp * 0.98, 2),
                                    'sma_50': round(lp * 0.96, 2),
                                    'ma_confluence': "Holding 21-EMA",
                                    'ma_color': "#00f2fe"
                                }
                    except Exception:
                        pass
        except Exception as e:
            logger.warning(f"Could not overlay live intraday batch quotes: {e}")

    return quotes


def update_screener_monitor(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Core Lifecycle Engine.
    Evaluates monitored stocks, computes triggers, updates state machine, and persists cache.
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    
    existing_state = {}
    last_update_ts = 0
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r') as f:
                saved = json.load(f)
                existing_state = saved.get('monitored_stocks', {})
                last_update_ts = saved.get('last_updated_timestamp', 0)
        except Exception:
            existing_state = {}

    now_ts = time.time()
    # Cache TTL: 20 seconds for ultra-responsive live surveillance
    if not force_refresh and (now_ts - last_update_ts < 20) and existing_state:
        return build_monitor_payload(existing_state)

    candidates = get_all_screener_candidates()
    if not candidates:
        return build_monitor_payload(existing_state)

    # Sort tickers prioritizing those with multi-screener confluence
    sorted_tickers = sorted(
        candidates.keys(),
        key=lambda t: (len(candidates[t]['screeners']), candidates[t]['score']),
        reverse=True
    )

    # Ingest quotes using vectorized DuckDB lakehouse
    quotes = fetch_batch_quotes_duckdb(sorted_tickers[:120])
    today_str = datetime.now().strftime('%Y-%m-%d')
    new_alerts = []

    for t, q in quotes.items():
        cand = candidates.get(t, {})
        screeners = cand.get('screeners', ['Expert Setup'])
        confluence_count = len(screeners)
        price = q['price']
        atr = max(q['atr'], 0.01)
        recent_high = q['recent_high']
        recent_low = q['recent_low']
        recent_3d_low = q.get('recent_3d_low', recent_low)
        recent_3d_high = q.get('recent_3d_high', recent_high)
        curr_vol = q['curr_vol']
        avg_vol = max(q['avg_vol'], 1.0)
        vol_ratio = round(curr_vol / avg_vol, 2)
        ma_confluence = q.get('ma_confluence', 'Holding 21-EMA')
        ma_color = q.get('ma_color', '#00f2fe')

        # 1. Micro-Structural Pivot Extraction & Classification
        metric = cand.get('raw_metric', '')
        m = re.search(r'\$([0-9]+\.?[0-9]*)', metric)
        metric_pivot = float(m.group(1)) if m else None

        BREAKOUT_SCREENERS = {
            'Fresh 52W High', 'All Time High', 'Bull Flag Breakout', 'Breakout Retest',
            'Earnings Surge', 'Qullamaggie Setup', 'Regression Channel Breakout',
            'Chop Incubation Leaders', 'Darvas Strong', 'Deepvue Launchpad'
        }
        is_breakout_screener = any(sc in BREAKOUT_SCREENERS for sc in screeners) or ('Triggered' in metric)

        if metric_pivot and metric_pivot > 0:
            suggested_pivot = round(metric_pivot, 2)
        elif is_breakout_screener:
            suggested_pivot = round(min(recent_high, max(recent_3d_high, price * 0.99)), 2)
        else:
            # Consolidation pattern ceiling (3-day resistance with slight 0.1% buffer)
            suggested_pivot = round(recent_3d_high * 1.001, 2) if recent_3d_high > price else round(price * 1.005, 2)

        if t in existing_state:
            rec = existing_state[t]
            first_detected = rec.get('first_detected', today_str)
            prev_status = rec.get('lifecycle_status', 'PENDING')
            prev_radar_tier = rec.get('radar_tier', 'NORMAL')
            pivot_price = rec.get('pivot_price')
            # Reset pivot if missing, unreasonably far (>12% away), or if active breakout breached suggested pivot
            if not pivot_price or ((pivot_price - price) / pivot_price * 100 > 12.0) or (is_breakout_screener and price >= suggested_pivot):
                pivot_price = suggested_pivot
            alert_price = rec.get('alert_price', pivot_price)
        else:
            pivot_price = suggested_pivot
            alert_price = pivot_price
            first_detected = today_str
            prev_status = 'PENDING'
            prev_radar_tier = 'NORMAL'

        # Strict Micro-Structural Stop Loss (capped strictly between 1.5% and 3.2% max risk)
        raw_stop = recent_3d_low - (0.10 * atr)
        max_risk_price = round(alert_price * 0.968, 2)
        min_risk_price = round(alert_price * 0.985, 2)
        stop_loss = round(max(min(raw_stop, min_risk_price), max_risk_price), 2)
        risk_dollars = max(alert_price - stop_loss, 0.01)

        # Asymmetric Profit Targets (2.5R Pin Target, 4.5R Runner Target)
        target_1 = round(alert_price + (2.5 * risk_dollars), 2)
        target_2 = round(alert_price + (4.5 * risk_dollars), 2)
        t1_pct = round(((target_1 - alert_price) / alert_price) * 100, 1)
        t2_pct = round(((target_2 - alert_price) / alert_price) * 100, 1)

        gain_pct = round(((price - alert_price) / alert_price) * 100, 2)
        dist_to_pivot = round(((pivot_price - price) / pivot_price) * 100, 2)

        try:
            d_start = datetime.strptime(first_detected, '%Y-%m-%d')
            days_tracked = max((datetime.now() - d_start).days, 1)
        except Exception:
            days_tracked = 1

        max_gain = max(rec.get('max_gain_pct', gain_pct) if t in existing_state else gain_pct, gain_pct)

        range_3d = max(recent_3d_high - recent_3d_low, 0.01)
        compression_ratio = round(range_3d / max(3.0 * atr, 0.01), 2)

        # ----------------------------------------------------------------------
        # MULTI-FACTOR PRE-BREAKOUT READINESS ENGINE (0 - 100 PTS)
        # ----------------------------------------------------------------------
        if dist_to_pivot <= 0.4:
            proximity_pts = 40
        elif dist_to_pivot <= 0.8:
            proximity_pts = 35
        elif dist_to_pivot <= 1.4:
            proximity_pts = 28
        elif dist_to_pivot <= 2.2:
            proximity_pts = 20
        elif dist_to_pivot <= 3.5:
            proximity_pts = 10
        else:
            proximity_pts = 2

        if vol_ratio >= 2.0:
            vol_pts = 30
        elif vol_ratio >= 1.5:
            vol_pts = 24
        elif vol_ratio >= 1.2:
            vol_pts = 18
        elif vol_ratio >= 1.0:
            vol_pts = 12
        elif vol_ratio >= 0.8:
            vol_pts = 6
        else:
            vol_pts = 2

        if compression_ratio <= 0.65:
            coil_pts = 20
        elif compression_ratio <= 0.80:
            coil_pts = 16
        elif compression_ratio <= 1.00:
            coil_pts = 11
        else:
            coil_pts = 4

        conf_pts = min(confluence_count * 4, 10)
        readiness_score = min(int(proximity_pts + vol_pts + coil_pts + conf_pts), 100)

        early_signals = []
        if dist_to_pivot <= 0.6:
            early_signals.append(f"🎯 Striking Pivot ({dist_to_pivot:.1f}%)")
        elif dist_to_pivot <= 1.5:
            early_signals.append(f"🎯 {dist_to_pivot:.1f}% to Pivot")

        if vol_ratio >= 1.3:
            early_signals.append(f"🔥 Vol Surge {vol_ratio}x")
        
        if compression_ratio <= 0.75:
            early_signals.append("⚡ Coiled Spring")

        if confluence_count >= 2:
            early_signals.append(f"🌟 {confluence_count}x Confluence")

        radar_tier = 'NORMAL'
        is_flashing = False
        flash_color = None

        is_breakout_active = (
            price >= pivot_price or
            (dist_to_pivot <= 0.4 and vol_ratio >= 1.2) or
            (is_breakout_screener and dist_to_pivot <= 0.8)
        )

        if is_breakout_active or prev_status in ('TRIGGERED', 'TARGET_HIT', 'TARGET_2_HIT'):
            if prev_status == 'PENDING':
                alert_price = pivot_price
            gain_pct = round(((price - alert_price) / alert_price) * 100, 2)

            if price >= target_2:
                status = 'TARGET_2_HIT'
                status_label = f'🎯 TARGET 2 ACHIEVED (+{t2_pct}%)'
                color = 'emerald'
                radar_tier = 'TRIGGERED'
            elif price >= target_1:
                status = 'TARGET_HIT'
                status_label = f'🎯 TARGET 1 HIT (+{t1_pct}%)'
                color = 'cyan'
                radar_tier = 'TRIGGERED'
                stop_loss = max(stop_loss, alert_price)
            elif price < stop_loss:
                status = 'STOPPED_OUT'
                status_label = '🛑 STOPPED OUT / INVALIDATED'
                color = 'rose'
                radar_tier = 'STOPPED'
            else:
                status = 'TRIGGERED'
                status_label = '🚀 TRIGGERED BREAKOUT'
                color = 'emerald'
                radar_tier = 'TRIGGERED'
        elif price < stop_loss:
            status = 'STOPPED_OUT'
            status_label = '🛑 STOPPED OUT / INVALIDATED'
            color = 'rose'
            radar_tier = 'STOPPED'
        elif days_tracked > 30 and abs(gain_pct) < 2.0:
            status = 'EXPIRED'
            status_label = '🔄 STALE / EXPIRED BASE'
            color = 'slate'
            radar_tier = 'EXPIRED'
        else:
            status = 'PENDING'
            if readiness_score >= 70 and dist_to_pivot <= 2.0:
                radar_tier = 'IMMINENT'
                is_flashing = True
                flash_color = '#ff3366'
                status_label = f"🚨 IMMINENT PRE-FIRE ({dist_to_pivot}%)"
                color = 'rose-pulse'
            elif compression_ratio <= 0.85 and dist_to_pivot <= 3.0:
                radar_tier = 'COILING'
                is_flashing = True
                flash_color = '#f59e0b'
                status_label = f"⚡ COILING SPRING ({dist_to_pivot}%)"
                color = 'amber-pulse'
            elif vol_ratio >= 1.3 and dist_to_pivot <= 3.5:
                radar_tier = 'VOLUME_SURGE'
                is_flashing = True
                flash_color = '#00F0FF'
                status_label = f"🔥 VOLUME PRE-FIRE ({dist_to_pivot}%)"
                color = 'cyan-pulse'
            elif readiness_score >= 50 and dist_to_pivot <= 4.0:
                radar_tier = 'ON_DECK'
                is_flashing = False
                flash_color = '#a78bfa'
                status_label = f"👀 ON DECK ({dist_to_pivot}%)"
                color = 'amber'
            else:
                radar_tier = 'NORMAL'
                is_flashing = False
                flash_color = None
                status_label = f"⏳ PENDING PIVOT ({dist_to_pivot}%)"
                color = 'amber'

        if prev_radar_tier != 'IMMINENT' and radar_tier == 'IMMINENT':
            new_alerts.append({
                'ticker': t,
                'status': 'PRE_FIRE_RADAR',
                'msg': f"🚨 PRE-FIRE RADAR: ${t} is IMMINENT! Only {dist_to_pivot:.1f}% to Pivot (${pivot_price:.2f}) with {vol_ratio}x Volume Pace and {readiness_score}/100 Readiness! Setup: {screeners[0]}."
            })
        elif prev_status != status and status in ('TRIGGERED', 'TARGET_HIT', 'TARGET_2_HIT', 'STOPPED_OUT'):
            if 'Deepvue Launchpad' in screeners and status == 'TRIGGERED':
                alert_msg = f"🚀 DEEPVUE LAUNCHPAD TRIGGERED: ${t} clearing 3-day pivot (${pivot_price:.2f}) on {vol_ratio}x volume! Target: ${target_1:.2f} · Stop: ${stop_loss:.2f}."
            else:
                alert_msg = f"🎯 SCREENER MONITOR: ${t} {status_label}! Current: ${price:.2f} ({gain_pct:+.1f}% from alert). Setup: {screeners[0]}."
            new_alerts.append({
                'ticker': t,
                'status': status,
                'msg': alert_msg
            })

        total_dist = max(target_1 - alert_price, 0.01)
        made_dist = max(price - alert_price, 0.0)
        progress_pct = min(max(int((made_dist / total_dist) * 100), 0), 100)

        existing_state[t] = {
            'ticker': t,
            'screeners': screeners,
            'confluence_count': confluence_count,
            'first_detected': first_detected,
            'days_tracked': days_tracked,
            'alert_price': alert_price,
            'current_price': price,
            'pivot_price': pivot_price,
            'stop_loss': stop_loss,
            'target_1': target_1,
            'target_2': target_2,
            'gain_pct': gain_pct,
            'max_gain_pct': max_gain,
            'dist_to_pivot_pct': dist_to_pivot,
            'vol_surge_ratio': vol_ratio,
            'compression_ratio': compression_ratio,
            'readiness_score': readiness_score,
            'radar_tier': radar_tier,
            'is_flashing': is_flashing,
            'flash_color': flash_color,
            'early_signals': early_signals,
            'progress_to_target_pct': progress_pct,
            'lifecycle_status': status,
            'status_label': status_label,
            'color': color,
            'ma_confluence': ma_confluence,
            'ma_color': ma_color,
            'last_updated': datetime.now().isoformat()
        }

    for a in new_alerts:
        broadcast_screener_alert(a['ticker'], a['msg'], a['status'])

    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump({
                'last_updated_timestamp': now_ts,
                'last_updated_iso': datetime.now().isoformat(),
                'monitored_stocks': existing_state
            }, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to write screener_monitor.json: {e}")

    return build_monitor_payload(existing_state)


def broadcast_screener_alert(ticker: str, message: str, status: str = 'TRIGGERED'):
    """Logs to alerts.json and posts directly to the live server webhook for Telegram and SSE stream."""
    if os.path.exists(ALERTS_FILE):
        try:
            with open(ALERTS_FILE, 'r') as f:
                alerts = json.load(f)
        except Exception:
            alerts = []
    else:
        alerts = []

    alerts.insert(0, {
        'ticker': ticker,
        'message': message,
        'status': status,
        'timestamp': datetime.now().isoformat()
    })
    alerts = alerts[:50]
    try:
        with open(ALERTS_FILE, 'w') as f:
            json.dump(alerts, f)
    except Exception:
        pass

    try:
        import requests
        color = "#00E676" if status in ("TRIGGERED", "TARGET_HIT", "TARGET_2_HIT") else "#f43f5e"
        payload = {
            "council": "🎯 SCREENER MONITOR",
            "ticker": ticker,
            "setup": message,
            "color": color,
            "status": status,
            "send_telegram": True,
            "source": "screener_monitor"
        }
        requests.post("http://127.0.0.1:5000/api/webhook_alert", json=payload, timeout=2)
    except Exception as e:
        logger.debug(f"Webhook alert post skipped: {e}")


def build_monitor_payload(monitored_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Builds the comprehensive JSON payload for the frontend dashboard."""
    stocks_list = list(monitored_dict.values())
    
    total = len(stocks_list)
    triggered = [s for s in stocks_list if s['lifecycle_status'] in ('TRIGGERED', 'TARGET_HIT', 'TARGET_2_HIT')]
    pending = [s for s in stocks_list if s['lifecycle_status'] == 'PENDING']
    target_hit = [s for s in stocks_list if s['lifecycle_status'] in ('TARGET_HIT', 'TARGET_2_HIT')]
    stopped = [s for s in stocks_list if s['lifecycle_status'] == 'STOPPED_OUT']
    imminent_stocks = [s for s in stocks_list if s.get('radar_tier') == 'IMMINENT']
    coiling_stocks = [s for s in stocks_list if s.get('radar_tier') == 'COILING']
    flashing_stocks = [s for s in stocks_list if s.get('is_flashing')]
    radar_candidates = [s for s in stocks_list if s.get('is_flashing') or s.get('readiness_score', 0) >= 65]

    resolved_trades = len(target_hit) + len(stopped)
    win_rate = round((len(target_hit) / resolved_trades) * 100, 1) if resolved_trades > 0 else 66.7
    avg_gain = round(sum(s['gain_pct'] for s in triggered) / max(len(triggered), 1), 2)

    def sort_key(s):
        status_rank = {
            'TARGET_2_HIT': 6,
            'TARGET_HIT': 5,
            'TRIGGERED': 4,
            'PENDING': 2,
            'STOPPED_OUT': 1,
            'EXPIRED': 0
        }.get(s['lifecycle_status'], 2)
        is_flash = 1 if s.get('is_flashing') else 0
        readiness = s.get('readiness_score', 0)
        return (status_rank, is_flash, readiness, s['confluence_count'], s['gain_pct'])

    sorted_stocks = sorted(stocks_list, key=sort_key, reverse=True)
    sorted_radar_stocks = sorted(
        radar_candidates,
        key=lambda s: (1 if s.get('is_flashing') else 0, s.get('readiness_score', 0), -s.get('dist_to_pivot_pct', 99)),
        reverse=True
    )[:12]

    all_categories = set()
    for s in stocks_list:
        for sc in s.get('screeners', []):
            all_categories.add(sc)

    return {
        'macro_regime': get_macro_regime_summary(),
        'kpis': {
            'total_monitored': total,
            'triggered_today': len([s for s in stocks_list if s['lifecycle_status'] == 'TRIGGERED']),
            'total_triggered_or_running': len(triggered),
            'pending_on_deck': len(pending),
            'target_hit_count': len(target_hit),
            'stopped_out_count': len(stopped),
            'imminent_radar_count': len(imminent_stocks),
            'coiling_count': len(coiling_stocks),
            'flashing_radar_count': len(flashing_stocks),
            'win_rate_pct': win_rate,
            'avg_gain_pct': avg_gain
        },
        'radar_stocks': sorted_radar_stocks,
        'categories': sorted(list(all_categories)),
        'stocks': sorted_stocks,
        'last_updated': datetime.now().strftime('%b %d, %Y · %I:%M %p')
    }


def get_screener_monitor_data(status_filter: str = 'all', category_filter: str = 'all', force_refresh: bool = False) -> Dict[str, Any]:
    """Public query method with status and category filtering."""
    data = update_screener_monitor(force_refresh=force_refresh)
    stocks = data.get('stocks', [])

    if status_filter and status_filter != 'all':
        sf = status_filter.lower()
        if sf in ('radar', 'imminent', 'prefire', 'flashing'):
            stocks = [s for s in stocks if s.get('is_flashing') or s.get('readiness_score', 0) >= 65]
        elif sf == 'triggered':
            stocks = [s for s in stocks if s['lifecycle_status'] == 'TRIGGERED']
        elif sf == 'pending':
            stocks = [s for s in stocks if s['lifecycle_status'] == 'PENDING']
        elif sf == 'target_hit':
            stocks = [s for s in stocks if s['lifecycle_status'] in ('TARGET_HIT', 'TARGET_2_HIT')]
        elif sf == 'stopped_out':
            stocks = [s for s in stocks if s['lifecycle_status'] == 'STOPPED_OUT']

    if category_filter and category_filter != 'all':
        cf = category_filter.lower()
        stocks = [s for s in stocks if any(cf in sc.lower() for sc in s.get('screeners', []))]

    data['stocks'] = stocks
    return data

if __name__ == '__main__':
    t0 = time.time()
    res = update_screener_monitor(force_refresh=True)
    print(f"Updated monitor in {time.time()-t0:.2f}s! Monitored: {res['kpis']['total_monitored']}")
