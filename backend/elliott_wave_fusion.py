"""
Elliott Wave Fusion & Live Validation Layer (Elliott Wave 3.0)
==============================================================
Sits on top of the core wave-detection engine (elliott_wave_engine.py) and adds:

  1. Live Structural Validation  - re-checks every wave count against TODAY's price
                                    (ACTIVE / THRUST_FIRED / TARGET_1_HIT / COMPLETED /
                                     EXHAUSTION_WATCH / INVALIDATED) + wave freshness.
  2. Trade Plan Repair            - normalised bias (LONG/SHORT/NEUTRAL), direction-sorted
                                    targets, ATR tactical stop vs structural invalidation,
                                    honest R/R and an explicit action tag.
  3. Momentum Confirmation        - live EWO 5/35 (% of price), slope, Wave-3 peak
                                    confirmation and Wave-5 bearish divergence.
  4. Fibonacci Confluence         - how many fib levels sit within 1.5% of price.
  5. 11-Engine Confluence         - 1-3W Swing, Apex Squeeze, Pre-Breakout Ignition,
                                    RS Leaders, Options Flow, Intraday Radar, Screener Monitor.
  6. 30D Sparkline + Gold RS line, 30D alpha vs SPY, RS rating.
  7. Wave Conviction Score (0-100), grade, playbook category and wave-cycle progress.
"""

import os
import json
import math
import datetime
import numpy as np
import pandas as pd
import duckdb

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
PUBLIC_DIR = os.path.join(BASE_DIR, '..', 'public')
PARQUET_FILE = os.path.join(DATA_DIR, 'daily_ohlcv.parquet')
PUBLIC_MIRROR = os.path.join(PUBLIC_DIR, 'elliott_wave_results.json')

INDEX_ETFS = {'SPY', 'QQQ', 'IWM', 'DIA', 'SMH', 'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XBI'}

PLAYBOOK_META = {
    'W3_IGNITION':   {'label': '⚡ Wave 3 Ignition',        'quality': 22},
    'W4_BUY_ZONE':   {'label': '🎯 Wave 4 Buy Zone',        'quality': 19},
    'ABC_REVERSAL':  {'label': '🔄 ABC Correction Complete', 'quality': 16},
    'DEVELOPING':    {'label': '🌱 Developing Impulse',      'quality': 11},
    'TRIANGLE_COIL': {'label': '📐 Triangle Coil / Thrust',  'quality': 11},
    'W3_CRESTING':   {'label': '⛰️ Wave 3 Cresting',         'quality': 7},
    'W5_EXHAUSTION': {'label': '⚠️ Wave 5 Exhaustion',       'quality': 3},
}

# Approximate position inside a full Elliott cycle (for the progress meter)
WAVE_PROGRESS = {
    'W3_IGNITION': 38, 'W4_BUY_ZONE': 72, 'ABC_REVERSAL': 100, 'DEVELOPING': 25,
    'TRIANGLE_COIL': 85, 'W3_CRESTING': 60, 'W5_EXHAUSTION': 95,
}


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def _clean(obj):
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    if isinstance(obj, (bool, np.bool_)):
        return bool(obj)
    if isinstance(obj, (int, np.integer)):
        return int(obj)
    if isinstance(obj, (float, np.floating)):
        f = float(obj)
        return None if (math.isnan(f) or math.isinf(f)) else f
    return obj


def _load(name):
    path = os.path.join(PUBLIC_DIR, name)
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _rows(data, keys):
    out = []
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in keys:
            v = data.get(k)
            if isinstance(v, list):
                out.extend(v)
    return [r for r in out if isinstance(r, dict) and r.get('ticker')]


def _f(v, default=0.0):
    try:
        f = float(v)
        return default if (math.isnan(f) or math.isinf(f)) else f
    except Exception:
        return default


# ----------------------------------------------------------------------------
# Cross-engine context & dynamic universe
# ----------------------------------------------------------------------------
def load_engine_context():
    ctx = {k: {} for k in ('swing', 'squeeze', 'ignition', 'rs', 'options', 'intraday', 'monitor', 'meta')}

    for r in _rows(_load('swing_trading_setups.json'), ['all_setups']):
        sym = str(r['ticker']).upper()
        ctx['swing'][sym] = r
        if r.get('name'):
            ctx['meta'].setdefault(sym, {'name': r.get('name'), 'sector': r.get('sector')})
    for r in _rows(_load('squeeze_results.json'), ['all_squeezes', 'ttm_keltner_squeeze']):
        ctx['squeeze'].setdefault(str(r['ticker']).upper(), r)
    for r in _rows(_load('pre_breakout_ignition_results.json'), ['results', 'all_ignitions']):
        ctx['ignition'].setdefault(str(r['ticker']).upper(), r)
    for r in _rows(_load('rs_scanner_results.json'), ['all_stocks', 'top_rs_leaders', 'rs_new_highs_before_price', 'rs_blue_dots', 'results']):
        sym = str(r['ticker']).upper()
        ctx['rs'].setdefault(sym, r)
        if r.get('name'):
            ctx['meta'].setdefault(sym, {'name': r.get('name'), 'sector': r.get('sector')})
    for r in _rows(_load('options_screener.json'), ['data', 'results', 'stocks']):
        ctx['options'].setdefault(str(r['ticker']).upper(), r)
    for r in _rows(_load('intraday_results.json'), ['results']):
        ctx['intraday'].setdefault(str(r['ticker']).upper(), r)
    mon = _load('screener_monitor.json')
    for r in _rows(mon, ['stocks']):
        ctx['monitor'].setdefault(str(r['ticker']).upper(), r)
    return ctx


def build_dynamic_universe(core_universe, max_extra=60):
    """Core liquid universe + the highest-conviction names surfaced by the other engines."""
    ctx = load_engine_context()
    ranked = []
    for sym, r in ctx['swing'].items():
        ranked.append((_f(r.get('Execution_Score'), 70), sym))
    for sym, r in ctx['squeeze'].items():
        ranked.append((_f(r.get('composite_score'), 60), sym))
    for sym, r in ctx['ignition'].items():
        ranked.append((_f(r.get('ignition_score'), 60), sym))
    for sym, r in ctx['rs'].items():
        if r.get('rs_new_high_before_price') or _f(r.get('rs_rating')) >= 90:
            ranked.append((_f(r.get('rs_rating'), 80), sym))
    ranked.sort(reverse=True)

    universe = list(dict.fromkeys(core_universe))
    seen = set(universe)
    extra = 0
    for _, sym in ranked:
        if extra >= max_extra:
            break
        if sym not in seen and sym.replace('-', '').replace('.', '').isalpha():
            universe.append(sym)
            seen.add(sym)
            extra += 1
    return universe


# ----------------------------------------------------------------------------
# Market telemetry (one vectorised DuckDB query)
# ----------------------------------------------------------------------------
def load_market_telemetry(tickers):
    out = {}
    if not tickers or not os.path.exists(PARQUET_FILE):
        return out
    syms = sorted(set([t.upper() for t in tickers] + ['SPY']))
    sym_sql = "', '".join(s.replace("'", "") for s in syms)
    try:
        con = duckdb.connect()
        df = con.execute(
            f"SELECT Ticker, Date, High, Low, Close, Volume FROM '{PARQUET_FILE}' "
            f"WHERE Ticker IN ('{sym_sql}') AND Date >= CURRENT_DATE - INTERVAL 200 DAY "
            f"ORDER BY Ticker, Date"
        ).df()
        con.close()
    except Exception as e:
        print(f"[Elliott Fusion] telemetry query failed: {e}")
        return out
    if df.empty:
        return out

    spy = df[df['Ticker'] == 'SPY']['Close'].astype(float).values
    for sym, g in df.groupby('Ticker'):
        if len(g) < 40:
            continue
        c = g['Close'].astype(float).reset_index(drop=True)
        h = g['High'].astype(float).reset_index(drop=True)
        l = g['Low'].astype(float).reset_index(drop=True)
        dates = pd.to_datetime(g['Date']).dt.strftime('%Y-%m-%d').tolist()

        tr = pd.concat([h - l, (h - c.shift(1)).abs(), (l - c.shift(1)).abs()], axis=1).max(axis=1)
        atr = _f(tr.tail(14).mean(), _f(c.iloc[-1]) * 0.025)

        ewo = (c.rolling(5).mean() - c.rolling(35).mean()) / c * 100.0
        ewo = ewo.fillna(0.0)
        ewo_now = _f(ewo.iloc[-1])
        ewo_slope = _f(ewo.iloc[-1] - ewo.iloc[-6]) if len(ewo) >= 6 else 0.0
        ewo_max60 = _f(ewo.tail(60).max())
        ewo_min60 = _f(ewo.tail(60).min())
        px_hi60 = _f(h.tail(60).max())
        px_lo60 = _f(l.tail(60).min())

        delta = c.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rsi = _f((100 - 100 / (1 + gain / loss.replace(0, np.nan))).iloc[-1], 50.0)

        e10 = c.ewm(span=10, adjust=False).mean()
        e21 = c.ewm(span=21, adjust=False).mean()
        n = min(30, len(c))
        c30 = c.tail(n).round(2).tolist()
        rs30 = c30[:]
        alpha = 0.0
        ret30 = (c30[-1] / c30[0] - 1) * 100 if c30[0] > 0 else 0.0
        if len(spy) >= n and spy[-n] > 0:
            s30 = spy[-n:]
            alpha = ret30 - (s30[-1] / s30[0] - 1) * 100
            raw = np.array(c30) / np.maximum(0.01, s30)
            if raw.max() > raw.min() and max(c30) > min(c30):
                rs30 = [round(min(c30) + (v - raw.min()) / (raw.max() - raw.min()) * (max(c30) - min(c30)), 2) for v in raw]

        out[sym] = {
            'dates': dates,
            'close': _f(c.iloc[-1]),
            'atr': atr,
            'ewo_now': round(ewo_now, 2),
            'ewo_slope': round(ewo_slope, 2),
            'ewo_max60': ewo_max60,
            'ewo_min60': ewo_min60,
            'px_hi60': px_hi60,
            'px_lo60': px_lo60,
            'rsi': round(rsi, 1),
            'return_30d_pct': round(ret30, 2),
            'alpha_30d_pct': round(alpha, 2),
            'sparkline': {
                'close': c30,
                'ema10': e10.tail(n).round(2).tolist(),
                'ema21': e21.tail(n).round(2).tolist(),
                'rs_norm': rs30,
            },
        }
    return out


# ----------------------------------------------------------------------------
# Per-stock fusion
# ----------------------------------------------------------------------------
def _classify_playbook(pat):
    key = (pat.get('pattern_key') or '').lower()
    sub = (pat.get('sub_category') or '') + ' ' + (pat.get('active_wave') or '')
    if key == 'impulse_w3_ignition':
        return 'W3_IGNITION'
    if key == 'impulse_w4':
        return 'W4_BUY_ZONE'
    if key == 'impulse_w3_cresting':
        return 'W3_CRESTING'
    if key in ('impulse_5', 'diagonal'):
        return 'W5_EXHAUSTION'
    if key == 'triangle':
        return 'TRIANGLE_COIL'
    if key in ('abc_zigzag', 'zigzag', 'flat'):
        return 'ABC_REVERSAL'
    if key == 'developing_cycle':
        return 'DEVELOPING'
    return 'W5_EXHAUSTION' if 'Wave (5)' in sub else 'DEVELOPING'


def _bias(pat, playbook):
    d = (pat.get('direction') or '').upper()
    if playbook == 'W5_EXHAUSTION':
        return 'NEUTRAL'
    if 'BEAR' in d:
        return 'SHORT'
    if 'BULL' in d:
        return 'LONG'
    return 'NEUTRAL'


def fuse_stock(stock, tele, ctx):
    pat = stock.get('pattern') or {}
    sym = str(stock.get('ticker', '')).upper()
    price = _f(stock.get('price'))
    t = tele.get(sym, {})
    atr = _f(t.get('atr'), price * 0.025) or price * 0.025

    playbook = _classify_playbook(pat)
    bias = _bias(pat, playbook)
    wps = pat.get('wave_points') or []

    # ---------------- Freshness ----------------
    last_wave_date = wps[-1].get('date') if wps else None
    bars_since_last_wave = None
    if last_wave_date and t.get('dates'):
        bars_since_last_wave = sum(1 for d in t['dates'] if d > last_wave_date)
    if bars_since_last_wave is None:
        freshness = 'UNKNOWN'
    elif bars_since_last_wave <= 10:
        freshness = 'FRESH'
    elif bars_since_last_wave <= 35:
        freshness = 'MATURING'
    else:
        freshness = 'STALE'

    # ---------------- Structural invalidation ----------------
    structural_stop = _f(pat.get('stop_loss'))
    raw_targets = [x for x in (_f(pat.get('target_1')), _f(pat.get('target_2'))) if x > 0]

    live_state = 'ACTIVE'
    state_note = 'Wave count intact — price is respecting the structure.'

    if playbook == 'TRIANGLE_COIL' and len(wps) >= 5:
        lo = min(_f(w.get('price')) for w in wps if w.get('label') in ('B', 'D')) if any(w.get('label') in ('B', 'D') for w in wps) else 0
        hi = max(_f(w.get('price')) for w in wps)
        if lo and price < lo:
            live_state = 'THRUST_FIRED'
            bias = 'SHORT'
            state_note = f'Price has broken below the triangle floor (${lo:.2f}) — the post-triangle thrust is already underway.'
        elif price > hi:
            live_state = 'INVALIDATED'
            state_note = f'Price is above the triangle ceiling (${hi:.2f}) — the bearish triangle count is void.'
    elif playbook == 'W5_EXHAUSTION':
        live_state = 'EXHAUSTION_WATCH'
        state_note = 'Terminal Wave 5 in progress — protect gains / trail stops; not a fresh entry.'

    if structural_stop > 0 and live_state not in ('INVALIDATED',):
        if bias == 'LONG' and price <= structural_stop:
            live_state = 'INVALIDATED'
            state_note = f'Price closed through the wave invalidation level (${structural_stop:.2f}).'
        elif bias == 'SHORT' and live_state != 'THRUST_FIRED' and price >= structural_stop:
            live_state = 'INVALIDATED'
            state_note = f'Price closed above the bearish invalidation level (${structural_stop:.2f}).'

    # ---------------- Targets (direction-sorted) ----------------
    if bias == 'LONG':
        targets = sorted([x for x in raw_targets if x > price])
    elif bias == 'SHORT':
        targets = sorted([x for x in raw_targets if x < price], reverse=True)
    else:
        targets = sorted(raw_targets, key=lambda x: abs(x - price))
    passed_targets = [x for x in raw_targets if (bias == 'LONG' and x <= price) or (bias == 'SHORT' and x >= price)]
    if live_state == 'ACTIVE' and passed_targets:
        live_state = 'COMPLETED' if not targets else 'TARGET_1_HIT'
        state_note = 'Price has already reached the projected wave target(s) — manage the winner, do not chase.'

    target_1 = targets[0] if targets else None
    target_2 = targets[1] if len(targets) > 1 else None

    # ---------------- Tactical stop & honest R/R ----------------
    if bias == 'LONG':
        tactical_stop = max(structural_stop if structural_stop > 0 else 0, price - 2.0 * atr)
        if tactical_stop >= price:
            tactical_stop = price - 1.5 * atr
    elif bias == 'SHORT':
        tactical_stop = min(structural_stop if structural_stop > price else price + 2.0 * atr, price + 2.0 * atr)
    else:
        tactical_stop = price - 2.0 * atr
    risk = abs(price - tactical_stop) or atr
    rr_t1 = round(abs(target_1 - price) / risk, 2) if target_1 else 0.0
    rr_t2 = round(abs(target_2 - price) / risk, 2) if target_2 else rr_t1
    structural_risk_pct = round(abs(price - structural_stop) / price * 100, 2) if structural_stop > 0 and price > 0 else None

    # ---------------- Momentum (EWO) ----------------
    ewo_now = _f(t.get('ewo_now'))
    ewo_slope = _f(t.get('ewo_slope'))
    momentum_aligned = (bias == 'LONG' and (ewo_now > 0 or ewo_slope > 0)) or (bias == 'SHORT' and (ewo_now < 0 or ewo_slope < 0))
    w3_confirmed = playbook in ('W3_IGNITION', 'W3_CRESTING') and ewo_now >= 0.85 * _f(t.get('ewo_max60'), 1e9) and ewo_now > 0
    near_high = price >= 0.98 * _f(t.get('px_hi60'), 1e12)
    w5_divergence = near_high and ewo_now < 0.7 * _f(t.get('ewo_max60')) and _f(t.get('ewo_max60')) > 0
    if w3_confirmed:
        momentum_note = 'EWO at 60-day peak — textbook Wave 3 momentum signature.'
    elif w5_divergence:
        momentum_note = 'Bearish EWO divergence at price highs — classic Wave 5 exhaustion tell.'
    elif momentum_aligned:
        momentum_note = 'EWO confirms the wave bias.'
    else:
        momentum_note = 'EWO not yet confirming — wait for the oscillator to turn.'

    # ---------------- Fibonacci confluence ----------------
    fib_levels = (pat.get('fibonacci') or {}).get('fib_levels') or {}
    fib_near = [{'name': k, 'price': round(_f(v), 2)} for k, v in fib_levels.items()
                if _f(v) > 0 and abs(_f(v) - price) / price <= 0.015]

    # ---------------- Engine confluence ----------------
    engines = []
    if sym in ctx['swing']:
        engines.append('1-3W Swing')
    if sym in ctx['squeeze']:
        engines.append('Apex Squeeze')
    if sym in ctx['ignition']:
        engines.append('Pre-Breakout Ignition')
    rs_info = ctx['rs'].get(sym, {})
    rs_rating = int(_f(rs_info.get('rs_rating'), 0)) or int(_f(ctx['swing'].get(sym, {}).get('rs_rating'), 0))
    if not rs_rating:
        rs_rating = int(max(1, min(99, 70 + _f(t.get('alpha_30d_pct')) * 1.4)))
    is_blue_dot = bool(rs_info.get('rs_new_high_before_price'))
    if rs_rating >= 85 or is_blue_dot:
        engines.append('RS Leader')
    if sym in ctx['options']:
        engines.append('Options Flow')
    if sym in ctx['intraday']:
        engines.append('Intraday Radar')
    if sym in ctx['monitor'] and ctx['monitor'][sym].get('is_flashing'):
        engines.append('Pre-Fire Radar')

    # ---------------- Action tag ----------------
    if live_state == 'INVALIDATED':
        action, action_label = 'AVOID', '⛔ Invalidated — Re-count Required'
    elif live_state in ('COMPLETED', 'TARGET_1_HIT'):
        action, action_label = 'TAKE_PROFITS', '💰 Target Reached — Trail Stops'
    elif live_state == 'EXHAUSTION_WATCH':
        action, action_label = 'TAKE_PROFITS', '⚠️ Wave 5 — Tighten / Take Profits'
    elif live_state == 'THRUST_FIRED':
        action, action_label = 'WATCH', '📉 Thrust Underway — Watch for Retest'
    elif bias == 'LONG' and rr_t1 >= 1.5 and freshness != 'STALE' and playbook != 'W3_CRESTING':
        action, action_label = 'BUY_ZONE', '🟢 Actionable Long — In Entry Zone'
    elif bias == 'SHORT' and rr_t1 >= 1.5 and freshness != 'STALE':
        action, action_label = 'SHORT_ZONE', '🔴 Actionable Short — In Entry Zone'
    elif playbook == 'W3_CRESTING':
        action, action_label = 'WATCH', '⏳ Wait for Wave 4 Pullback'
    else:
        action, action_label = 'WATCH', '👀 Watchlist — R/R or Timing Not Ready'

    # ---------------- Wave Conviction Score ----------------
    cardinal = str(pat.get('cardinal_score') or '0/3')
    try:
        c_pass, c_tot = [int(x) for x in cardinal.split('/')]
    except Exception:
        c_pass, c_tot = 0, 3
    score = (
        _f(pat.get('confidence'), 60) * 0.28
        + (c_pass / max(1, c_tot)) * 14
        + PLAYBOOK_META[playbook]['quality']
        + (9 if momentum_aligned else 0) + (4 if w3_confirmed else 0)
        + min(10, rr_t1 * 3.0)
        + {'FRESH': 6, 'MATURING': 3}.get(freshness, 0)
        + (4 if rs_rating >= 80 else 0)
        + min(10, 3 * len(engines))
        + min(4, 2 * len(fib_near))
    )
    if freshness == 'STALE':
        score -= 8
    caps = {'INVALIDATED': 25, 'COMPLETED': 40, 'TARGET_1_HIT': 48, 'EXHAUSTION_WATCH': 45, 'THRUST_FIRED': 55}
    score = min(score, caps.get(live_state, 99.0))
    score = round(max(0.0, min(99.0, score)), 1)
    grade = 'A+' if score >= 80 else 'A' if score >= 70 else 'B' if score >= 58 else 'C'

    meta = ctx['meta'].get(sym, {})
    return {
        'name': meta.get('name') or sym,
        'sector': meta.get('sector') or ('Index / ETF' if sym in INDEX_ETFS else '—'),
        'playbook': playbook,
        'playbook_label': PLAYBOOK_META[playbook]['label'],
        'bias': bias,
        'live_state': live_state,
        'state_note': state_note,
        'action': action,
        'action_label': action_label,
        'conviction_score': score,
        'grade': grade,
        'cycle_progress_pct': WAVE_PROGRESS.get(playbook, 50),
        'freshness': freshness,
        'bars_since_last_wave': bars_since_last_wave,
        'last_wave_date': last_wave_date,
        'trade_plan': {
            'entry': round(price, 2),
            'tactical_stop': round(tactical_stop, 2),
            'structural_invalidation': round(structural_stop, 2) if structural_stop else None,
            'structural_risk_pct': structural_risk_pct,
            'risk_pct': round(risk / price * 100, 2) if price else None,
            'target_1': round(target_1, 2) if target_1 else None,
            'target_2': round(target_2, 2) if target_2 else None,
            'rr_t1': rr_t1,
            'rr_t2': rr_t2,
            'atr': round(atr, 2),
        },
        'momentum': {
            'ewo_pct': ewo_now,
            'ewo_slope': ewo_slope,
            'rsi': t.get('rsi'),
            'aligned': momentum_aligned,
            'w3_peak_confirmed': w3_confirmed,
            'w5_divergence': w5_divergence,
            'note': momentum_note,
        },
        'fib_confluence': fib_near,
        'rs_rating': rs_rating,
        'is_blue_dot': is_blue_dot,
        'return_30d_pct': t.get('return_30d_pct'),
        'alpha_30d_pct': t.get('alpha_30d_pct'),
        'confluence_engines': engines,
        'sparkline': t.get('sparkline'),
    }


# ----------------------------------------------------------------------------
# Payload enrichment
# ----------------------------------------------------------------------------
def enrich_elliott_payload(payload):
    stocks = payload.get('stocks') or []
    if not stocks:
        return payload
    ctx = load_engine_context()
    tele = load_market_telemetry([s.get('ticker') for s in stocks if s.get('ticker')])

    for s in stocks:
        try:
            s['fusion'] = fuse_stock(s, tele, ctx)
        except Exception as e:
            print(f"[Elliott Fusion] {s.get('ticker')}: {e}")

    fused = [s for s in stocks if s.get('fusion')]
    fused.sort(key=lambda s: s['fusion']['conviction_score'], reverse=True)
    payload['stocks'] = fused + [s for s in stocks if not s.get('fusion')]

    def cnt(fn):
        return sum(1 for s in fused if fn(s['fusion']))

    actionable = [s for s in fused if s['fusion']['action'] in ('BUY_ZONE', 'SHORT_ZONE')]
    payload['summary_kpis'] = {
        'total_counts': len(fused),
        'actionable': len(actionable),
        'a_plus': cnt(lambda f: f['grade'] == 'A+'),
        'w3_ignition': cnt(lambda f: f['playbook'] == 'W3_IGNITION'),
        'w4_buy_zone': cnt(lambda f: f['playbook'] == 'W4_BUY_ZONE'),
        'abc_reversal': cnt(lambda f: f['playbook'] == 'ABC_REVERSAL'),
        'w5_exhaustion': cnt(lambda f: f['playbook'] == 'W5_EXHAUSTION'),
        'w3_cresting': cnt(lambda f: f['playbook'] == 'W3_CRESTING'),
        'triangle': cnt(lambda f: f['playbook'] == 'TRIANGLE_COIL'),
        'developing': cnt(lambda f: f['playbook'] == 'DEVELOPING'),
        'invalidated': cnt(lambda f: f['live_state'] == 'INVALIDATED'),
        'targets_hit': cnt(lambda f: f['live_state'] in ('TARGET_1_HIT', 'COMPLETED')),
        'stale': cnt(lambda f: f['freshness'] == 'STALE'),
        'momentum_confirmed': cnt(lambda f: f['momentum']['aligned']),
        'multi_engine': cnt(lambda f: len(f['confluence_engines']) >= 2),
    }

    # Breadth based on where the universe sits in the cycle
    motive = cnt(lambda f: f['playbook'] in ('W3_IGNITION', 'W3_CRESTING', 'W4_BUY_ZONE', 'DEVELOPING'))
    late = cnt(lambda f: f['playbook'] == 'W5_EXHAUSTION')
    corrective = cnt(lambda f: f['playbook'] in ('ABC_REVERSAL', 'TRIANGLE_COIL'))
    n = max(1, len(fused))
    posture = payload.get('market_posture') or {}
    posture.update({
        'early_motive_pct': round(motive / n * 100, 1),
        'late_cycle_pct': round(late / n * 100, 1),
        'corrective_cycle_pct': round(corrective / n * 100, 1),
    })
    if late / n >= 0.35:
        posture['cycle_read'] = 'Late-cycle: a large share of leaders are in terminal Wave 5 — favour profit-taking and tight stops.'
    elif motive / n >= 0.45:
        posture['cycle_read'] = 'Early/mid-cycle: many stocks are in Wave 3/4 — conditions favour buying Wave 4 pullbacks.'
    else:
        posture['cycle_read'] = 'Rotational: corrective structures dominate — focus on completed ABC reversals with confirmation.'
    payload['market_posture'] = posture

    payload['spotlight'] = actionable[0] if actionable else (fused[0] if fused else None)
    payload['engine_version'] = 'Elliott Wave 3.0 (Fusion + Live Validation)'
    payload['enriched_at'] = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    payload = _clean(payload)
    try:
        with open(PUBLIC_MIRROR, 'w') as f:
            json.dump(payload, f, allow_nan=False)
    except Exception as e:
        print(f"[Elliott Fusion] public mirror write failed: {e}")
    return payload
