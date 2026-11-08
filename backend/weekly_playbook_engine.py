import json
import os
import sys
from datetime import datetime
import duckdb
import numpy as np
import pandas as pd

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
    def calculate_stage(c, s): return "Stage 2 - Advancing"
    def calculate_macd(c): return pd.Series(0), pd.Series(0)
    def calculate_rsi(c): return pd.Series(55.0)
    def calculate_momentum_fade(m, s, r): return "Bullish", "bullish"

try:
    from stock_personality_engine import (
        calculate_adr_metrics,
        classify_personality,
        detect_guardian_ma,
        detect_character_change,
    )
except ImportError:
    calculate_adr_metrics = None
    classify_personality = None
    detect_guardian_ma = None
    detect_character_change = None

BASE_DIR = "/Users/amitkumar/Desktop/SectorTrackerApp"
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
DATA_DIR = os.path.join(BASE_DIR, "backend", "data")

OUTPUT_FILE = os.path.join(PUBLIC_DIR, "weekly_playbook.json")
MARKET_HEALTH_FILE = os.path.join(PUBLIC_DIR, "market_health.json")
SECTOR_FLOW_FILE = os.path.join(PUBLIC_DIR, "sector_flow.json")
LAKEHOUSE_PATH = os.path.join(DATA_DIR, "daily_ohlcv.parquet")

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


def _load_json(path):
    try:
        if os.path.exists(path):
            with open(path, 'r') as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def load_multi_engine_hub():
    """Ingests all 11 quantitative engines for Weekly Playbook 3.0 cross-engine synthesis."""
    hub = {
        'swing': {},
        'squeeze': {},
        'elliott': {},
        'ignition': {},
        'intraday': {},
        'rs': {},
        'options': {},
        'earnings': {},
        'monitor': {},
        'meta': {},
    }

    # 1. 1-3W Swing Engine
    sw = _load_json(os.path.join(PUBLIC_DIR, "swing_trading_setups.json"))
    for s in sw.get('all_setups') or sw.get('top_picks') or []:
        if isinstance(s, dict):
            t = (s.get('ticker') or '').upper()
            if t:
                hub['swing'][t] = s
                if s.get('name'):
                    hub['meta'].setdefault(t, {'name': s.get('name'), 'sector': s.get('sector')})

    # 2. Apex Squeeze 3.0
    sq = _load_json(os.path.join(PUBLIC_DIR, "squeeze_results.json"))
    for s in (sq.get('all_squeezes') or []) + (sq.get('ttm_keltner_squeeze') or []):
        if isinstance(s, dict):
            t = (s.get('ticker') or '').upper()
            if t:
                hub['squeeze'].setdefault(t, s)

    # 3. Elliott Wave 3.0
    ew = _load_json(os.path.join(PUBLIC_DIR, "elliott_wave_results.json")) or _load_json(os.path.join(DATA_DIR, "elliott_wave_screener.json"))
    for s in ew.get('stocks') or []:
        if isinstance(s, dict):
            t = (s.get('ticker') or '').upper()
            if t:
                hub['elliott'][t] = s

    # 4. Pre-Breakout Ignition
    ig = _load_json(os.path.join(PUBLIC_DIR, "pre_breakout_ignition_results.json"))
    for s in (ig.get('results') or []) + (ig.get('all_ignitions') or []):
        if isinstance(s, dict):
            t = (s.get('ticker') or '').upper()
            if t:
                hub['ignition'].setdefault(t, s)

    # 5. Apex Intraday Radar 3.0
    ir = _load_json(os.path.join(PUBLIC_DIR, "intraday_results.json"))
    for s in (ir.get('results') or []) + (ir.get('stocks') or []):
        if isinstance(s, dict):
            t = (s.get('ticker') or '').upper()
            if t:
                hub['intraday'].setdefault(t, s)

    # 6. RS Scanner
    rs = _load_json(os.path.join(PUBLIC_DIR, "rs_scanner_results.json"))
    for k in ('all_stocks', 'top_rs_leaders', 'rs_new_highs_before_price', 'rs_blue_dots', 'results'):
        for s in rs.get(k) or []:
            if isinstance(s, dict):
                t = (s.get('ticker') or '').upper()
                if t and t not in hub['rs']:
                    hub['rs'][t] = s
                if t and s.get('name'):
                    hub['meta'].setdefault(t, {'name': s.get('name'), 'sector': s.get('sector')})

    # 7. CBOE Options Flow / ScreenerMonitor
    mo = _load_json(os.path.join(PUBLIC_DIR, "screener_monitor.json"))
    for s in (mo.get('radar_stocks') or []) + (mo.get('stocks') or []):
        if isinstance(s, dict):
            t = (s.get('ticker') or '').upper()
            if t:
                if s.get('is_flashing') or s in (mo.get('radar_stocks') or []):
                    hub['monitor'][t] = s
                if (s.get('call_put_ratio') or 0) >= 1.5 or s.get('options_sentiment') == 'BULLISH':
                    hub['options'][t] = s
                if s.get('name'):
                    hub['meta'].setdefault(t, {'name': s.get('name'), 'sector': s.get('sector')})

    # 8. AI Earnings / PEAD
    ea = _load_json(os.path.join(PUBLIC_DIR, "earnings_data.json"))
    for k in ('upcoming_earnings', 'recent_reporters', 'pead_leaders', 'stocks', 'earnings'):
        for s in (ea.get(k) if isinstance(ea, dict) else []) or []:
            if isinstance(s, dict):
                t = (s.get('ticker') or '').upper()
                if t:
                    hub['earnings'][t] = s

    # 10. Metadata
    meta = _load_json(os.path.join(DATA_DIR, "ticker_metadata.json"))
    if isinstance(meta, dict):
        for k, v in meta.items():
            if isinstance(v, dict):
                hub['meta'][k.upper()] = v

    return hub


def calculate_squeeze(df):
    """Returns True if Bollinger Bands are inside Keltner Channels (TTM Squeeze)."""
    df['SMA20'] = df['Close'].rolling(window=20).mean()
    std = df['Close'].rolling(window=20).std()
    df['BB_up'] = df['SMA20'] + (std * 2)
    df['BB_down'] = df['SMA20'] - (std * 2)
    df['TR'] = np.maximum(
        df['High'] - df['Low'],
        np.maximum(
            abs(df['High'] - df['Close'].shift(1)),
            abs(df['Low'] - df['Close'].shift(1))
        )
    )
    df['ATR'] = df['TR'].rolling(window=20).mean()
    df['KC_up'] = df['SMA20'] + (df['ATR'] * 1.5)
    df['KC_down'] = df['SMA20'] - (df['ATR'] * 1.5)
    squeeze_on = (df['BB_up'] < df['KC_up']) & (df['BB_down'] > df['KC_down'])
    return bool(squeeze_on.iloc[-5:].any())


def build_30d_sparkline(df, spy_close_map):
    """Builds 30-day Price + EMA10/21 + normalized RS Line sparkline."""
    c = df['Close'].astype(float)
    e10 = c.ewm(span=10, adjust=False).mean()
    e21 = c.ewm(span=21, adjust=False).mean()
    tail_idx = df.index[-30:]
    closes = [round(float(x), 2) for x in c.loc[tail_idx]]
    ema10 = [round(float(x), 2) for x in e10.loc[tail_idx]]
    ema21 = [round(float(x), 2) for x in e21.loc[tail_idx]]

    rs_raw = []
    for dt, px in zip(tail_idx, closes):
        key = str(dt)[:10]
        sp = spy_close_map.get(key)
        rs_raw.append(px / sp if sp and sp > 0 else 1.0)
    lo, hi = min(rs_raw), max(rs_raw)
    rng = (hi - lo) if hi > lo else 1.0
    rs_norm = [round((v - lo) / rng * 100.0, 1) for v in rs_raw]

    return {
        "close": closes,
        "ema10": ema10,
        "ema21": ema21,
        "rs_norm": rs_norm,
    }


def get_macro_regime():
    """Reads live market health data and creates the Weekly Regime Briefing + Position Sizing Matrix."""
    data = _load_json(MARKET_HEALTH_FILE)
    if data:
        try:
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
                sizing_rules = {
                    "core_position_pct": "12% - 15%",
                    "pilot_position_pct": "6% - 8%",
                    "max_open_risk_bps": "75 - 100 bps per trade",
                    "max_new_positions": "4 - 6 active swing positions",
                    "profit_taking_rule": "Hold for 20-25% swing Move; trail 21-EMA after +2R"
                }
            elif score >= 45:
                rec_exposure = "Selective / Moderate: 40% - 60% Invested"
                exposure_pct = 50
                color = "#f59e0b"
                status = "CAUTIOUS"
                takeaway = "Selective rotational tape. Focus exclusively on Grade A+ multi-engine leaders with tight ATR compression. Take 1/3 partial profits at +1.5R to +2R and raise stops to breakeven."
                sizing_rules = {
                    "core_position_pct": "8% - 10%",
                    "pilot_position_pct": "4% - 5%",
                    "max_open_risk_bps": "50 bps per trade",
                    "max_new_positions": "2 - 4 selective leaders",
                    "profit_taking_rule": "Trim 1/3 at +1.5R; trail remainder with 10-EMA"
                }
            else:
                rec_exposure = "Defensive / Capital Preservation: 0% - 25% Invested (75%+ Cash)"
                exposure_pct = 20
                color = "#ef4444"
                status = "RISK_OFF"
                takeaway = "Market internals are in a defensive distribution regime. Protect open capital, raise cash, and limit entries to pilot sizes on RS islands only."
                sizing_rules = {
                    "core_position_pct": "4% - 6% (Pilot Only)",
                    "pilot_position_pct": "2.5% - 3%",
                    "max_open_risk_bps": "25 - 35 bps per trade",
                    "max_new_positions": "1 - 2 tactical pilots max",
                    "profit_taking_rule": "Harvest quick 5-8% tactical swings into strength"
                }

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
                "distribution_warning": score < 45 or "Deteriorating" in label or "Bearish" in label,
                "sizing_rules": sizing_rules
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
        "distribution_warning": False,
        "sizing_rules": {
            "core_position_pct": "8% - 10%",
            "pilot_position_pct": "4% - 5%",
            "max_open_risk_bps": "50 bps per trade",
            "max_new_positions": "3 - 4 positions",
            "profit_taking_rule": "Trim 1/3 at +2R; trail 21-EMA"
        }
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
            if len(df) < 10:
                continue
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
    data = _load_json(SECTOR_FLOW_FILE)
    if data:
        try:
            w_items = data.get('rrg', {}).get('weekly', []) or []
            d_items = {s['ticker']: s for s in data.get('rrg', {}).get('daily', [])}
            i_items = {s['ticker']: s for s in data.get('rrg', {}).get('intraday', [])}

            if not w_items:
                w_items = data.get('rrg', {}).get('daily', []) or []

            sector_results = []
            for sec in w_items:
                t = sec.get('ticker')
                name = sec.get('name', t)

                w_trail = sec.get('trail', [])
                w_last = w_trail[-1] if w_trail else {'x': 100, 'y': 100}
                w_x = float(w_last.get('x', 100))
                w_y = float(w_last.get('y', 100))

                d_sec = d_items.get(t, {})
                d_trail = d_sec.get('trail', [])
                d_last = d_trail[-1] if d_trail else {'x': 100, 'y': 100}
                d_x = float(d_last.get('x', 100))
                d_y = float(d_last.get('y', 100))

                i_sec = i_items.get(t, {})
                i_trail = i_sec.get('trail', [])
                i_last = i_trail[-1] if i_trail else {'x': 100, 'y': 100}
                i_x = float(i_last.get('x', 100))
                i_y = float(i_last.get('y', 100))

                is_active_distribution = (w_y < 100 or w_x < 100) and (i_x < 100 and i_y < 100)
                is_true_leader = (w_x >= 100 and w_y >= 100) and not (i_x < 98 and i_y < 95)

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
                    'score': round(score, 2),
                    'quadrant': quadrant,
                    'quadrant_color': quadrant_color,
                    'is_true_leader': is_true_leader,
                    'is_active_distribution': is_active_distribution,
                    'top_stocks': top_stocks
                })

            sector_results.sort(key=lambda s: s['score'], reverse=True)

            true_leaders = [s for s in sector_results if s['quadrant'] == 'Leading'][:3]
            if len(true_leaders) < 3:
                fallback = [s for s in sector_results if not s['is_active_distribution'] and s not in true_leaders]
                true_leaders.extend(fallback[:3 - len(true_leaders)])

            weakening_sectors = [s for s in sector_results if s['quadrant'] == 'Weakening / Distributing'][:3]
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
                "lagging_sectors": lagging_payload,
                "all_sectors": sector_results
            }
        except Exception as e:
            print(f"Error reading sector flow: {e}")

    return {
        "leading_sectors": [],
        "weakening_sectors": [],
        "lagging_sectors": [],
        "all_sectors": []
    }


def generate_weekly_playbook():
    print("Generating Weekly Playbook 3.0 (11-Engine Institutional Synthesis)...")
    hub = load_multi_engine_hub()

    # Combine UNIVERSE with top setups from 1-3W Swing, Squeeze, Elliott Wave, Ignition
    dynamic_tickers = set(UNIVERSE)
    for key in ('swing', 'squeeze', 'elliott', 'ignition', 'intraday', 'monitor'):
        dynamic_tickers.update(list(hub[key].keys())[:40])
    tickers = sorted(list(dynamic_tickers))

    if not os.path.exists(LAKEHOUSE_PATH):
        print("Lakehouse data not found.")
        return

    lake_df = duckdb.query(
        f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') WHERE Date >= current_date() - interval '1 year' ORDER BY Date"
    ).to_df()
    grouped = lake_df.groupby('Ticker')

    if 'SPY' not in grouped.groups:
        print("SPY data missing from Lakehouse.")
        return

    spy_df = grouped.get_group('SPY').set_index('Date').sort_index()
    spy_close = float(spy_df['Close'].iloc[-1])
    spy_5d_ret = float((spy_close - spy_df['Close'].iloc[-6]) / spy_df['Close'].iloc[-6] * 100)
    spy_30d_ret = float((spy_close - spy_df['Close'].iloc[-30]) / spy_df['Close'].iloc[-30] * 100) if len(spy_df) >= 30 else spy_5d_ret
    spy_50sma = float(spy_df['Close'].rolling(50).mean().iloc[-1])
    spy_close_map = {str(dt)[:10]: float(px) for dt, px in spy_df['Close'].tail(40).items()}

    # 1. Macro Regime Briefing
    regime_briefing = get_macro_regime()

    # 2. Sector Flow Rotation
    sector_rotation = get_sector_rotation(grouped)
    leading_sec_tickers = set(s['ticker'] for s in sector_rotation.get('leading_sectors', []))
    ticker_to_sector_etf = {}
    for etf, members in SECTOR_HOLDINGS_MAP.items():
        for m in members:
            ticker_to_sector_etf[m] = etf

    market_summary = {
        "text": (
            f"The S&P 500 closed the week at ${spy_close:.2f} ({spy_5d_ret:+.2f}% 5D / {spy_30d_ret:+.2f}% 30D). "
            f"Structurally, the index is {'bullish above its 50-day SMA' if spy_close > spy_50sma else 'defensive below its 50-day SMA'}. "
            f"Macro Health Score stands at {regime_briefing['score_value']}/100 ({regime_briefing['score_label']}). "
            f"Recommended Exposure: {regime_briefing['recommended_exposure']}."
        ),
        "bias": "Bullish" if spy_close > spy_50sma and regime_briefing['score_value'] >= 50 else ("Cautious" if spy_close > spy_50sma else "Bearish"),
        "spy_weekly_return": f"{spy_5d_ret:+.2f}%",
        "spy_30d_return": f"{spy_30d_ret:+.2f}%",
        "spy_close": round(spy_close, 2),
        "regime": regime_briefing['regime_status']
    }

    # 3. Analyze Universe
    results = []
    character_change_watch = []

    for ticker in tickers:
        try:
            if ticker in ('SPY', 'QQQ', 'IWM', 'DIA', 'VIX') or ticker not in grouped.groups:
                continue
            df = grouped.get_group(ticker).set_index('Date').sort_index().dropna()
            if len(df) < 60:
                continue

            close = float(df['Close'].iloc[-1])
            if close < 10.0:
                continue
            high_52w = float(df['High'].max())
            sma21 = float(df['Close'].rolling(21).mean().iloc[-1])
            sma50 = float(df['Close'].rolling(50).mean().iloc[-1])
            sma200 = float(df['Close'].rolling(200).mean().iloc[-1]) if len(df) >= 200 else sma50

            return_5d = float((close - df['Close'].iloc[-6]) / df['Close'].iloc[-6] * 100)
            return_30d = float((close - df['Close'].iloc[-30]) / df['Close'].iloc[-30] * 100) if len(df) >= 30 else return_5d
            alpha_30d = round(return_30d - spy_30d_ret, 2)
            dist_52w = float(((high_52w - close) / high_52w) * 100)
            uptrend = (close > sma50) and (sma50 >= sma200 * 0.98)

            # Volume ratio
            vol20 = float(df['Volume'].tail(20).mean())
            rvol = round(float(df['Volume'].iloc[-1]) / vol20, 2) if vol20 > 0 else 1.0

            is_squeezing = calculate_squeeze(df.copy()) or (ticker in hub['squeeze'])

            adr_metrics = calculate_adr_metrics(df) if calculate_adr_metrics else {"adr_10d": 3.0, "adr_20d": 3.0, "adr_50d": 3.0}
            char = detect_character_change(df, adr_metrics['adr_10d'], adr_metrics['adr_50d']) if detect_character_change else {}

            if char.get('character_change_detected') and ticker in UNIVERSE:
                guardian = detect_guardian_ma(df) if detect_guardian_ma else {"guardian_ma": "21-SMA"}
                character_change_watch.append({
                    "ticker": ticker,
                    "price": f"${close:.2f}",
                    "return_5d": f"{return_5d:+.2f}%",
                    "status": char.get('status', 'SELL_RULE_TRIGGERED'),
                    "warning_level": char.get('warning_level', 'HIGH'),
                    "signal": char.get('signal', 'Breakdown below 21-day SMA.'),
                    "guardian_ma": guardian.get('guardian_ma', '21-SMA'),
                    "adr_10d": adr_metrics['adr_10d'],
                    "action": "Trim / Tighten Stops / Avoid New Buys"
                })

            # Multi-engine confluence detection
            engines = []
            engine_notes = []
            if ticker in hub['swing']:
                sw_item = hub['swing'][ticker]
                engines.append("1-3W Swing")
                if sw_item.get('setup_type'):
                    engine_notes.append(f"Swing: {sw_item.get('setup_type')}")
            if ticker in hub['squeeze']:
                sq_item = hub['squeeze'][ticker]
                engines.append("Apex Squeeze")
                if sq_item.get('tier'):
                    engine_notes.append(f"Squeeze: {sq_item.get('tier')}")
            if ticker in hub['elliott']:
                ew_item = hub['elliott'][ticker]
                ew_fu = ew_item.get('fusion') or {}
                if ew_fu.get('action') == 'BUY_ZONE' or ew_fu.get('playbook') in ('W3_IGNITION', 'W4_BUY_ZONE', 'ABC_REVERSAL'):
                    engines.append("Elliott Wave")
                    engine_notes.append(f"Elliott: {ew_fu.get('playbook_label') or ew_item.get('pattern', {}).get('pattern_name')}")
            if ticker in hub['ignition']:
                engines.append("Ignition")
            if ticker in hub['intraday']:
                engines.append("Intraday Radar")
            if ticker in hub['monitor']:
                engines.append("Pre-Fire Radar")
            if ticker in hub['options']:
                engines.append("Options Flow")
            if ticker in hub['earnings']:
                engines.append("Earnings Catalyst")

            rs_info = hub['rs'].get(ticker, {})
            rs_rating = int(rs_info.get('rs_rating') or hub['swing'].get(ticker, {}).get('rs_rating') or 0)
            if not rs_rating:
                rs_rating = int(max(1, min(99, 70 + alpha_30d * 1.4)))
            is_blue_dot = bool(rs_info.get('rs_new_high_before_price')) or (dist_52w <= 3.5 and alpha_30d >= 8.0)
            if rs_rating >= 85 or is_blue_dot:
                engines.append("RS Leader")

            results.append({
                "ticker": ticker,
                "close": close,
                "sma21": sma21,
                "sma50": sma50,
                "return_5d": round(return_5d, 2),
                "return_30d": round(return_30d, 2),
                "alpha_30d": alpha_30d,
                "dist_52w": round(dist_52w, 2),
                "rvol": rvol,
                "uptrend": uptrend,
                "is_squeezing": is_squeezing,
                "adr_metrics": adr_metrics,
                "character_change": char,
                "engines": engines,
                "engine_notes": engine_notes,
                "rs_rating": rs_rating,
                "is_blue_dot": is_blue_dot,
                "df": df
            })
        except Exception:
            continue

    character_change_watch.sort(key=lambda x: (0 if x['warning_level'] == 'HIGH' else 1, x['ticker']))

    # Stocks That Ran (Top 5-day gainers in an uptrend)
    uptrend_stocks = [r for r in results if r['uptrend'] and r['close'] >= 12.0]
    stocks_that_ran = sorted(uptrend_stocks, key=lambda x: x['return_5d'], reverse=True)[:6]
    ran_payload = [{
        "ticker": s['ticker'],
        "return": f"{s['return_5d']:+.2f}%",
        "alpha_30d": f"{s['alpha_30d']:+.1f}%",
        "price": f"${s['close']:.2f}",
        "rs_rating": s['rs_rating'],
        "engines": s['engines'][:3],
        "reason": "Power momentum expansion; monitor for 10/21-EMA digest or high-tight flag coil."
    } for s in stocks_that_ran]

    # About to Fly (Tight Squeeze near 52w high)
    squeezing_stocks = [r for r in uptrend_stocks if r['is_squeezing'] and r['dist_52w'] <= 20.0]
    stocks_to_fly = sorted(squeezing_stocks, key=lambda x: (x['dist_52w'] - len(x['engines']) * 2.5))[:6]
    fly_payload = [{
        "ticker": s['ticker'],
        "price": f"${s['close']:.2f}",
        "dist_ath": f"{s['dist_52w']:.1f}%",
        "rs_rating": s['rs_rating'],
        "engines": s['engines'][:3],
        "reason": "Volatility compression (BB inside KC) near 52-week highs with multi-engine sponsorship."
    } for s in stocks_to_fly]

    # 4. Curate Institutional Focus List (Top 12 Multi-Engine Market Leaders)
    focus_candidates = [
        r for r in uptrend_stocks
        if not (r['character_change'].get('character_change_detected') and r['character_change'].get('warning_level') == 'HIGH')
        and r['dist_52w'] <= 22.0
    ]

    # Rank by Multi-Engine Confluence + RS Rating + Proximity to 52W High + Squeeze bonus
    def _candidate_rank(r):
        sec_etf = ticker_to_sector_etf.get(r['ticker'])
        sec_bonus = 8.0 if sec_etf in leading_sec_tickers else 0.0
        return (
            len(r['engines']) * 11.0
            + r['rs_rating'] * 0.45
            + min(20.0, max(-10.0, r['alpha_30d'])) * 0.6
            + (8.0 if r['is_squeezing'] else 0.0)
            + (6.0 if r['is_blue_dot'] else 0.0)
            + sec_bonus
            - r['dist_52w'] * 0.85
        )

    focus_candidates.sort(key=_candidate_rank, reverse=True)

    focus_list_payload = []
    selected_tickers = set()

    for s in focus_candidates:
        if len(focus_list_payload) >= 12:
            break
        if s['ticker'] in selected_tickers:
            continue

        try:
            plan = TradeCouncil.evaluate(s['ticker'], s['df'])
            adr = s['adr_metrics']
            personality = classify_personality(adr['adr_10d'], adr['adr_20d']) if classify_personality else {
                "tier": "TIGHT_AND_ORDERLY",
                "tier_label": "Tight & Orderly",
                "tier_color": "#10b981",
                "badge_color": "rgba(16, 185, 129, 0.15)",
                "sizing_recommendation": "Full Position"
            }
            guardian = detect_guardian_ma(s['df']) if detect_guardian_ma else {"guardian_ma": "21-SMA", "respect_score": 80.0}

            close_s = s['df']['Close']
            sma200_s = close_s.rolling(200).mean()
            macd, signal = calculate_macd(close_s)
            rsi = calculate_rsi(close_s)
            stage = calculate_stage(close_s, sma200_s)
            mom_text, mom_color = calculate_momentum_fade(macd, signal, rsi)

            health = {
                "stage": stage,
                "momentum_text": mom_text,
                "momentum_color": mom_color,
                "rsi": round(float(rsi.iloc[-1]), 1) if not rsi.empty else 55.0
            }

            try:
                entry_num = float(plan['entry_str'])
                stop_num = float(plan['stop_loss'])
                target_num = float(plan['profit_target'])
                if stop_num >= entry_num:
                    stop_num = round(entry_num * (1.0 - max(0.025, adr['adr_10d'] / 100.0 * 1.2)), 2)
                if target_num <= entry_num:
                    target_num = round(entry_num + (entry_num - stop_num) * 3.0, 2)
                risk_pct = max(0.5, round(((entry_num - stop_num) / entry_num) * 100, 1))
                reward_amt = target_num - entry_num
                risk_amt = max(0.01, entry_num - stop_num)
                rr_num = round(reward_amt / risk_amt, 1)
                rr_ratio = f"{rr_num}:1"
            except Exception:
                entry_num = s['close']
                stop_num = round(s['close'] * 0.96, 2)
                target_num = round(s['close'] * 1.12, 2)
                risk_pct = 4.0
                rr_num = 3.0
                rr_ratio = "3.0:1"

            # Enrich with Elliott Wave & Squeeze context if available
            ew_info = hub['elliott'].get(s['ticker'], {})
            ew_fu = ew_info.get('fusion') or {}
            ew_label = ew_fu.get('playbook_label') or ew_info.get('pattern', {}).get('active_wave')

            sq_info = hub['squeeze'].get(s['ticker'], {})
            sq_score = sq_info.get('squeeze_score') or sq_info.get('score')

            meta_info = hub['meta'].get(s['ticker'], {})
            sector_name = meta_info.get('sector') or ticker_to_sector_etf.get(s['ticker'], 'Institutional Leader')
            company_name = meta_info.get('name') or s['ticker']

            # Conviction Score (0-99)
            conviction_score = round(min(99.0, max(68.0,
                58.0
                + len(s['engines']) * 4.5
                + (s['rs_rating'] - 70) * 0.45
                + min(8.0, max(0.0, s['alpha_30d'] * 0.35))
                + (4.5 if s['is_squeezing'] else 0.0)
                + (3.5 if s['is_blue_dot'] else 0.0)
                + (3.0 if personality.get('tier') == 'TIGHT_AND_ORDERLY' else 0.0)
            )), 1)
            grade = "A+" if conviction_score >= 86 else ("A" if conviction_score >= 78 else "B+")

            # Dynamic reasoning
            setup_type = plan['setup_type']
            if "VCP" in setup_type:
                reasoning = (
                    f"Minervini VCP contraction confirmed within {s['dist_52w']:.1f}% of 52W high. "
                    f"{personality['tier_label']} character (10D ADR: {adr['adr_10d']}%) anchored by {guardian['guardian_ma']} ({guardian['respect_score']}% respect)."
                )
            elif "Flag" in setup_type or "Breakout" in setup_type:
                reasoning = (
                    f"Stage 2 leader coiling tightly within {s['dist_52w']:.1f}% of 52W highs ({s['alpha_30d']:+.1f}% 30D alpha vs SPY). "
                    f"Supported by {guardian['guardian_ma']} ({guardian['respect_score']}% respect) with {len(s['engines'])}-engine confluence."
                )
            elif "Pullback" in setup_type:
                reasoning = (
                    f"Controlled institutional pullback to {guardian['guardian_ma']} support ({guardian['respect_score']}% win rate) "
                    f"with capped {risk_pct}% downside risk and {rr_ratio} reward-to-risk."
                )
            else:
                reasoning = (
                    f"Constructive consolidation shelf near 52W highs ({s['dist_52w']:.1f}% from ATH). "
                    f"Holding {guardian['guardian_ma']} with RS Rating {s['rs_rating']} and {len(s['engines'])} active quant engines."
                )

            sparkline = build_30d_sparkline(s['df'], spy_close_map)

            focus_item = {
                "ticker": s['ticker'],
                "name": company_name,
                "sector": sector_name,
                "close": round(s['close'], 2),
                "return_5d": s['return_5d'],
                "return_30d": s['return_30d'],
                "alpha_30d": s['alpha_30d'],
                "dist_52w": s['dist_52w'],
                "rvol": s['rvol'],
                "rs_rating": s['rs_rating'],
                "is_blue_dot": s['is_blue_dot'],
                "is_squeezing": s['is_squeezing'],
                "conviction_score": conviction_score,
                "grade": grade,
                "confluence_engines": s['engines'],
                "engine_count": len(s['engines']),
                "elliott_wave": ew_label,
                "squeeze_score": sq_score,
                "entry_price": f"${entry_num:.2f}",
                "stop_loss": f"${stop_num:.2f}",
                "profit_target": f"${target_num:.2f}",
                "entry_num": round(entry_num, 2),
                "stop_num": round(stop_num, 2),
                "target_num": round(target_num, 2),
                "risk_pct": f"{risk_pct}%",
                "reward_risk": rr_ratio,
                "rr_num": rr_num,
                "setup_type": setup_type,
                "reasoning": reasoning,
                "health": health,
                "sparkline": sparkline,
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

    focus_list_payload.sort(key=lambda x: x['conviction_score'], reverse=True)
    top_3_payload = focus_list_payload[:3]
    trade_of_the_week = focus_list_payload[0] if focus_list_payload else None

    # Executive Summary KPIs
    summary_kpis = {
        "focus_leaders_count": len(focus_list_payload),
        "a_plus_count": sum(1 for x in focus_list_payload if x.get('grade') == 'A+'),
        "multi_engine_count": sum(1 for x in focus_list_payload if x.get('engine_count', 0) >= 3),
        "squeeze_coils_count": len(squeezing_stocks),
        "rs_blue_dots_count": sum(1 for x in focus_list_payload if x.get('is_blue_dot')),
        "character_warnings_count": len(character_change_watch),
        "avg_rr": round(float(np.mean([x.get('rr_num', 3.0) for x in focus_list_payload])), 1) if focus_list_payload else 3.0
    }

    date_str = datetime.now().strftime("%B %d, %Y")

    final_json = {
        "date": date_str,
        "engine_version": "Weekly Playbook 3.0 (11-Engine Institutional Synthesis)",
        "summary_kpis": summary_kpis,
        "trade_of_the_week": trade_of_the_week,
        "market_summary": market_summary,
        "regime_briefing": regime_briefing,
        "sector_rotation": sector_rotation,
        "focus_list": focus_list_payload,
        "top_3_picks": top_3_payload,
        "character_change_watch": character_change_watch[:8],
        "stocks_that_ran": ran_payload,
        "about_to_fly": fly_payload
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(final_json, f, indent=2)

    print(
        f"Successfully generated Weekly Playbook 3.0 at {OUTPUT_FILE} with "
        f"{len(focus_list_payload)} focus leaders (Spotlight: {trade_of_the_week['ticker'] if trade_of_the_week else 'None'})."
    )
    return final_json


if __name__ == "__main__":
    generate_weekly_playbook()
