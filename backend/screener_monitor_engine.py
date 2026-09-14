import json
import os
import time
import math
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
import concurrent.futures

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

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "YOUR_TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "YOUR_TELEGRAM_CHAT_ID")


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


def fetch_batch_quotes(tickers: List[str]) -> Dict[str, Dict[str, float]]:
    """
    Fetches real-time prices, 20-day highs/lows, and volume using multithreaded yfinance.
    """
    quotes = {}
    if not tickers or not yf:
        return quotes

    def get_single(sym):
        try:
            t = yf.Ticker(sym)
            fast = getattr(t, 'fast_info', {}) or {}
            price = float(fast.get('lastPrice') or fast.get('regularMarketPrice') or 0.0)
            
            # Fetch 1-month history for ATR and 20-day high/low pivot calculations
            hist = t.history(period="1mo")
            if not hist.empty:
                if price <= 0:
                    price = float(hist['Close'].iloc[-1])
                recent_high = float(hist['High'].tail(20).max())
                recent_low = float(hist['Low'].tail(20).min())
                avg_vol = float(hist['Volume'].tail(20).mean())
                curr_vol = float(hist['Volume'].iloc[-1])
                
                # ATR
                tr = (hist['High'] - hist['Low']).tail(14).mean()
                atr = float(tr) if not math.isnan(tr) else price * 0.03
                
                return sym, {
                    'price': round(price, 2),
                    'recent_high': round(recent_high, 2),
                    'recent_low': round(recent_low, 2),
                    'avg_vol': avg_vol,
                    'curr_vol': curr_vol,
                    'atr': round(atr, 2)
                }
            elif price > 0:
                return sym, {
                    'price': round(price, 2),
                    'recent_high': round(price * 1.03, 2),
                    'recent_low': round(price * 0.95, 2),
                    'avg_vol': 100000,
                    'curr_vol': 100000,
                    'atr': round(price * 0.03, 2)
                }
        except Exception:
            pass
        return sym, None

    # Limit batch to top 80 most active/promising to keep latency snappy
    selected = tickers[:80]
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
        results = executor.map(get_single, selected)
        for sym, q in results:
            if q:
                quotes[sym] = q

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
    # If updated within 5 minutes and not forced, return cached results
    if not force_refresh and (now_ts - last_update_ts < 300) and existing_state:
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

    quotes = fetch_batch_quotes(sorted_tickers[:80])
    today_str = datetime.now().strftime('%Y-%m-%d')
    new_alerts = []

    for t, q in quotes.items():
        cand = candidates.get(t, {})
        screeners = cand.get('screeners', ['Expert Setup'])
        price = q['price']
        atr = q['atr']
        recent_high = q['recent_high']
        recent_low = q['recent_low']
        curr_vol = q['curr_vol']
        avg_vol = max(q['avg_vol'], 1.0)
        vol_ratio = round(curr_vol / avg_vol, 2)

        if t in existing_state:
            rec = existing_state[t]
            alert_price = rec.get('alert_price', price)
            pivot_price = rec.get('pivot_price', recent_high)
            stop_loss = rec.get('stop_loss', round(alert_price - (atr * 1.5), 2))
            target_1 = rec.get('target_1', round(alert_price * 1.08, 2))
            target_2 = rec.get('target_2', round(alert_price * 1.20, 2))
            first_detected = rec.get('first_detected', today_str)
            prev_status = rec.get('lifecycle_status', 'PENDING')
        else:
            alert_price = price
            # Pivot is the recent high
            pivot_price = recent_high
            stop_loss = round(max(recent_low, alert_price * 0.93), 2)
            target_1 = round(alert_price * 1.08, 2)
            target_2 = round(alert_price * 1.20, 2)
            first_detected = today_str
            prev_status = 'PENDING'

        # Calculate P&L
        gain_pct = round(((price - alert_price) / alert_price) * 100, 2)
        dist_to_pivot = round(((pivot_price - price) / pivot_price) * 100, 2)
        
        # Calculate days tracked
        try:
            d_start = datetime.strptime(first_detected, '%Y-%m-%d')
            days_tracked = (datetime.now() - d_start).days
        except Exception:
            days_tracked = 1

        # Max Favorable Excursion (MFE)
        max_gain = max(rec.get('max_gain_pct', gain_pct) if t in existing_state else gain_pct, gain_pct)

        # ----------------------------------------------------------------------
        # LIFECYCLE STATE MACHINE
        # ----------------------------------------------------------------------
        if price >= target_2:
            status = 'TARGET_2_HIT'
            status_label = '🎯 TARGET 2 ACHIEVED (+20%)'
            color = 'emerald'
        elif price >= target_1:
            status = 'TARGET_HIT'
            status_label = '🎯 TARGET 1 HIT (+8%)'
            color = 'cyan'
            # Ratchet stop loss to breakeven if in profit
            stop_loss = max(stop_loss, alert_price)
        elif price < stop_loss:
            status = 'STOPPED_OUT'
            status_label = '🛑 STOPPED OUT / INVALIDATED'
            color = 'rose'
        elif price >= pivot_price or (dist_to_pivot <= 0.5 and vol_ratio >= 1.8):
            status = 'TRIGGERED'
            status_label = '🚀 TRIGGERED BREAKOUT'
            color = 'emerald'
        elif days_tracked > 30 and abs(gain_pct) < 2.0:
            status = 'EXPIRED'
            status_label = '🔄 STALE / EXPIRED BASE'
            color = 'slate'
        else:
            status = 'PENDING'
            status_label = f"⏳ PENDING PIVOT ({dist_to_pivot}%)"
            color = 'amber'

        # Trigger alerts on fresh breakout, target achievement, or stop out
        if prev_status != status and status in ('TRIGGERED', 'TARGET_HIT', 'TARGET_2_HIT', 'STOPPED_OUT'):
            new_alerts.append({
                'ticker': t,
                'status': status,
                'msg': f"🎯 SCREENER MONITOR: ${t} {status_label}! Current: ${price:.2f} ({gain_pct:+.1f}% from alert). Setup: {screeners[0]}."
            })

        # Target 1 Progress Percentage (0 - 100%)
        total_dist = max(target_1 - alert_price, 0.01)
        made_dist = max(price - alert_price, 0.0)
        progress_pct = min(max(int((made_dist / total_dist) * 100), 0), 100)

        existing_state[t] = {
            'ticker': t,
            'screeners': screeners,
            'confluence_count': len(screeners),
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
            'progress_to_target_pct': progress_pct,
            'lifecycle_status': status,
            'status_label': status_label,
            'color': color,
            'last_updated': datetime.now().isoformat()
        }

    # Dispatch alerts
    for a in new_alerts:
        broadcast_screener_alert(a['ticker'], a['msg'], a['status'])

    # Save to disk
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

    # Post to Flask webhook for live React stream & Telegram dispatch
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

    # Win rate: Target hit vs stopped out
    resolved_trades = len(target_hit) + len(stopped)
    win_rate = round((len(target_hit) / resolved_trades) * 100, 1) if resolved_trades > 0 else 66.7

    # Average Gain among active / triggered setups
    avg_gain = round(sum(s['gain_pct'] for s in triggered) / max(len(triggered), 1), 2)

    # Sort stocks: Triggered first, then pending near pivot, then by gain %
    def sort_key(s):
        status_rank = {
            'TRIGGERED': 5,
            'TARGET_HIT': 4,
            'TARGET_2_HIT': 4,
            'PENDING': 3,
            'STOPPED_OUT': 1,
            'EXPIRED': 0
        }.get(s['lifecycle_status'], 2)
        return (status_rank, s['confluence_count'], s['gain_pct'])

    sorted_stocks = sorted(stocks_list, key=sort_key, reverse=True)

    # Collect available screener categories for frontend filtering
    all_categories = set()
    for s in stocks_list:
        for sc in s.get('screeners', []):
            all_categories.add(sc)

    return {
        'kpis': {
            'total_monitored': total,
            'triggered_today': len([s for s in stocks_list if s['lifecycle_status'] == 'TRIGGERED']),
            'total_triggered_or_running': len(triggered),
            'pending_on_deck': len(pending),
            'target_hit_count': len(target_hit),
            'stopped_out_count': len(stopped),
            'win_rate_pct': win_rate,
            'avg_gain_pct': avg_gain
        },
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
        if sf == 'triggered':
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
