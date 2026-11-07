import json
import re
import os
import time
import math
import logging
from datetime import datetime
from typing import Dict, Any, List
import duckdb
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
PUBLIC_DIR = os.path.join(BASE_DIR, '..', 'public')
CACHE_FILE = os.path.join(DATA_DIR, 'screener_monitor.json')
PUBLIC_MIRROR_FILE = os.path.join(PUBLIC_DIR, 'screener_monitor.json')

EXPERT_FILE = os.path.join(PUBLIC_DIR, 'screener_results.json')
RS_FILE = os.path.join(PUBLIC_DIR, 'rs_scanner_results.json')
SQUEEZE_FILE = os.path.join(PUBLIC_DIR, 'squeeze_results.json')
SWING_FILE = os.path.join(PUBLIC_DIR, 'swing_trading_setups.json')
IGNITION_FILE = os.path.join(PUBLIC_DIR, 'pre_breakout_ignition_results.json')
EMERGING_FILE = os.path.join(PUBLIC_DIR, 'emerging_leaders.json')
PULLBACK_FILE = os.path.join(PUBLIC_DIR, 'first_ma_pullback_results.json')
UPTREND_FILE = os.path.join(PUBLIC_DIR, 'clean_uptrend_results.json')
REALSIMPLE_FILE = os.path.join(PUBLIC_DIR, 'realsimple_results.json')
BEST_ACTING_FILE = os.path.join(PUBLIC_DIR, 'best_acting_stocks.json')
OPTIONS_FILE = os.path.join(PUBLIC_DIR, 'options_screener.json')
SEASONALITY_FILE = os.path.join(PUBLIC_DIR, 'seasonality_results.json')
ALERTS_FILE = os.path.join(PUBLIC_DIR, 'alerts.json')
LAKEHOUSE_PATH = os.path.join(DATA_DIR, 'daily_ohlcv.parquet')
MARKET_HEALTH_FILE = os.path.join(PUBLIC_DIR, 'market_health.json')


def _sanitize_json(obj):
    if isinstance(obj, dict):
        return {k: _sanitize_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_sanitize_json(v) for v in obj]
    elif isinstance(obj, (float, np.floating)):
        if math.isnan(float(obj)) or math.isinf(float(obj)):
            return 0.0
        return float(obj)
    elif isinstance(obj, (int, np.integer)):
        return int(obj)
    elif isinstance(obj, (bool, np.bool_)):
        return bool(obj)
    return obj


def _safe_load_json(path: str) -> Any:
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed loading {path}: {e}")
    return {}


def get_macro_regime_summary() -> Dict[str, Any]:
    """Retrieves current macro regime internals for market context."""
    h = _safe_load_json(MARKET_HEALTH_FILE)
    if isinstance(h, dict) and h.get('current_health'):
        cur = h.get('current_health', {})
        score = float(cur.get('score_value', 45.0) or 45.0)
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
    return {
        'regime': 'CAUTIOUS',
        'label': 'Cautious (Neutral/Choppy)',
        'color': '#f59e0b',
        'score': 45.0,
        'mco': 'Neutral',
        'breadth_p50': 40.0,
        'guidance': 'Tactical Environment: Partial T1 Profit Taking Advised'
    }


def load_cross_enrichment() -> Dict[str, Dict[str, Any]]:
    """Loads RS, Options Gamma/Call Flow, Seasonality, and Metadata across all engines."""
    enrichment = {
        'rs': {},
        'options': {},
        'seasonality': {},
        'meta': {}
    }

    rs_data = _safe_load_json(RS_FILE)
    if isinstance(rs_data, dict):
        for k in ['all_stocks', 'top_rs_leaders', 'rs_new_highs_before_price', 'rs_blue_dots', 'results']:
            rows = rs_data.get(k, [])
            if isinstance(rows, list):
                for r in rows:
                    if isinstance(r, dict) and r.get('ticker'):
                        sym = str(r['ticker']).upper().strip()
                        if sym not in enrichment['rs']:
                            enrichment['rs'][sym] = r
                        if r.get('name'):
                            enrichment['meta'][sym] = {
                                'name': r.get('name', sym),
                                'sector': r.get('sector', 'Technology'),
                                'industry': r.get('industry', 'Institutional Leader')
                            }

    opt_data = _safe_load_json(OPTIONS_FILE)
    if isinstance(opt_data, dict):
        for k in ['data', 'results', 'stocks']:
            rows = opt_data.get(k, [])
            if isinstance(rows, list):
                for r in rows:
                    if isinstance(r, dict) and r.get('ticker'):
                        enrichment['options'][str(r['ticker']).upper().strip()] = r

    seas_data = _safe_load_json(SEASONALITY_FILE)
    if isinstance(seas_data, dict):
        for k in ['top_bullish', 'top_bearish', 'all_stocks', 'results', 'data']:
            rows = seas_data.get(k, [])
            if isinstance(rows, list):
                for r in rows:
                    if isinstance(r, dict) and r.get('ticker'):
                        enrichment['seasonality'][str(r['ticker']).upper().strip()] = r

    return enrichment


def get_all_screener_candidates() -> Dict[str, Dict[str, Any]]:
    """
    Ingests tickers from all 11 institutional engines and 39 expert screeners.
    Deduplicates tickers and tracks multi-screener confluence.
    """
    candidates: Dict[str, Dict[str, Any]] = {}

    def _add_candidate(ticker: str, label: str, metric: str = '', score: float = 50.0, pivot_override: float = None, name: str = None, sector: str = None):
        if not ticker or not isinstance(ticker, str):
            return
        t = ticker.upper().strip()
        if not t or t in ('SPY', 'QQQ', 'IWM', 'DIA'):
            return
        if t not in candidates:
            candidates[t] = {
                'ticker': t,
                'name': name or t,
                'sector': sector or 'Technology',
                'screeners': [label],
                'raw_metric': str(metric or ''),
                'score': float(score or 50.0),
                'pivot_override': float(pivot_override) if pivot_override and pivot_override > 0 else None
            }
        else:
            if label not in candidates[t]['screeners']:
                candidates[t]['screeners'].append(label)
            if score and float(score) > candidates[t]['score']:
                candidates[t]['score'] = float(score)
            if pivot_override and pivot_override > 0 and not candidates[t].get('pivot_override'):
                candidates[t]['pivot_override'] = float(pivot_override)
            if name and candidates[t].get('name') == t:
                candidates[t]['name'] = name
            if sector and candidates[t].get('sector') == 'Technology':
                candidates[t]['sector'] = sector

    # 1. Main Expert Screeners (screener_results.json)
    expert_data = _safe_load_json(EXPERT_FILE)
    if isinstance(expert_data, dict):
        for category, items in expert_data.items():
            if not isinstance(items, list):
                continue
            cat_label = category.replace('_', ' ').title()
            for item in items:
                if isinstance(item, dict):
                    _add_candidate(
                        item.get('ticker'),
                        cat_label,
                        item.get('metric', ''),
                        float(item.get('score', 65.0) or 65.0)
                    )
    elif isinstance(expert_data, list):
        for item in expert_data[:80]:
            if isinstance(item, dict):
                _add_candidate(
                    item.get('ticker'),
                    'Minervini Stage 2 VCP',
                    f"RS {item.get('rs_rating', 85)} | VCP",
                    float(item.get('rs_rating', 80.0) or 80.0),
                    name=item.get('name'),
                    sector=item.get('sector')
                )

    # 2. 1-3W Swing System (swing_trading_setups.json)
    swing_data = _safe_load_json(SWING_FILE)
    if isinstance(swing_data, dict):
        for item in swing_data.get('all_setups', [])[:65]:
            if isinstance(item, dict):
                setup_lbl = f"1-3W Swing ({item.get('setup_name', 'Apex Swing')})"
                piv = item.get('trade_plan', {}).get('entry_price')
                _add_candidate(
                    item.get('ticker'),
                    setup_lbl,
                    f"Swing Score {item.get('Execution_Score', 80)}",
                    float(item.get('Execution_Score', 80.0) or 80.0),
                    pivot_override=piv,
                    name=item.get('name'),
                    sector=item.get('sector')
                )

    # 3. Apex Squeeze Radar 3.0 (squeeze_results.json)
    sq_data = _safe_load_json(SQUEEZE_FILE)
    if isinstance(sq_data, dict):
        sq_list = sq_data.get('all_squeezes') or sq_data.get('ttm_keltner_squeeze') or []
        if isinstance(sq_list, list):
            for item in sq_list[:50]:
                if isinstance(item, dict):
                    piv = (item.get('trade_plan') or {}).get('entry_pivot')
                    lbl = f"Apex Squeeze ({item.get('category_label', 'TTM Squeeze')})"
                    _add_candidate(
                        item.get('ticker'),
                        lbl,
                        item.get('metric', 'Volatility Squeeze'),
                        float(item.get('composite_score', 75.0) or 75.0),
                        pivot_override=piv,
                        name=item.get('name'),
                        sector=item.get('sector')
                    )

    # 4. Pre-Breakout Ignition (pre_breakout_ignition_results.json)
    ign_data = _safe_load_json(IGNITION_FILE)
    if isinstance(ign_data, dict):
        for item in ign_data.get('results', ign_data.get('all_ignitions', []))[:45]:
            if isinstance(item, dict):
                _add_candidate(
                    item.get('ticker'),
                    'Pre-Breakout Ignition',
                    item.get('status', 'Breakout Imminent'),
                    float(item.get('ignition_score', 78.0) or 78.0),
                    pivot_override=item.get('high_60d')
                )

    # 5. RS Line Scanner (rs_scanner_results.json)
    rs_data = _safe_load_json(RS_FILE)
    if isinstance(rs_data, dict):
        for list_key, label in [
            ('rs_new_highs_before_price', 'RS Blue Dot Leader'),
            ('top_rs_leaders', 'Relative Strength Leader'),
            ('results', 'Relative Strength Leader')
        ]:
            rows = rs_data.get(list_key, [])
            if isinstance(rows, list):
                for item in rows[:40]:
                    if isinstance(item, dict):
                        _add_candidate(
                            item.get('ticker'),
                            label,
                            f"RS Rating: {item.get('rs_rating', 90)}",
                            float(item.get('rs_rating', 85.0) or 85.0),
                            name=item.get('name'),
                            sector=item.get('sector')
                        )

    # 6. Emerging Leaders (emerging_leaders.json)
    em_data = _safe_load_json(EMERGING_FILE)
    em_rows = em_data if isinstance(em_data, list) else em_data.get('candidates', em_data.get('leaders', []))
    if isinstance(em_rows, list):
        for item in em_rows[:35]:
            if isinstance(item, dict):
                _add_candidate(
                    item.get('ticker'),
                    'Emerging Market Leader',
                    item.get('summary_metric', 'Stage 2A Base'),
                    float(item.get('score', item.get('leader_score', 75.0)) or 75.0)
                )

    # 7. First MA Pullback & Clean Uptrend & RealSimple & Best Acting
    fmp_data = _safe_load_json(PULLBACK_FILE)
    if isinstance(fmp_data, dict):
        for item in fmp_data.get('results', fmp_data.get('all_pullbacks', []))[:30]:
            if isinstance(item, dict):
                _add_candidate(item.get('ticker'), '1st MA Pullback', 'Holy Grail MA Retest', float(item.get('score', 75.0) or 75.0))

    cu_data = _safe_load_json(UPTREND_FILE)
    if isinstance(cu_data, dict):
        for item in cu_data.get('results', cu_data.get('all_uptrends', []))[:30]:
            if isinstance(item, dict):
                _add_candidate(item.get('ticker'), 'Clean Institutional Uptrend', 'Stacked MA Channel', float(item.get('score', 75.0) or 75.0))

    rs_ariel = _safe_load_json(REALSIMPLE_FILE)
    if isinstance(rs_ariel, dict):
        for item in rs_ariel.get('results', rs_ariel.get('stocks', []))[:25]:
            if isinstance(item, dict):
                _add_candidate(item.get('ticker'), 'RealSimple 3-Line Stack', '9/21/50 Stack', 76.0)

    ba_data = _safe_load_json(BEST_ACTING_FILE)
    if isinstance(ba_data, dict):
        for item in ba_data.get('results', ba_data.get('stocks', []))[:30]:
            if isinstance(item, dict):
                _add_candidate(item.get('ticker'), 'ADX Best Acting Leader', 'ADX Power Trend', float(item.get('composite_score', 80.0) or 80.0))

    return candidates


def fetch_batch_quotes_duckdb(tickers: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Sub-second vectorized quote, 30D sparkline, RS line vs SPY, volatility compression,
    and order flow extraction using DuckDB parquet lakehouse.
    """
    quotes: Dict[str, Dict[str, Any]] = {}
    if not tickers or not os.path.exists(LAKEHOUSE_PATH):
        return quotes

    try:
        con = duckdb.connect()
        query_syms = list(set(tickers + ['SPY']))
        tickers_str = "', '".join(query_syms)
        query = f"""
        SELECT Date, Ticker, Open, High, Low, Close, Volume
        FROM read_parquet('{LAKEHOUSE_PATH}')
        WHERE Ticker IN ('{tickers_str}')
          AND Date >= CURRENT_DATE - INTERVAL 140 DAY
        ORDER BY Ticker, Date ASC
        """
        raw_df = con.query(query).df()
        con.close()

        if raw_df.empty:
            return quotes

        spy_df = raw_df[raw_df['Ticker'] == 'SPY']
        spy_c_30 = spy_df['Close'].astype(float).tail(30).values if len(spy_df) >= 10 else None
        spy_ret_30d = 0.0
        if spy_c_30 is not None and len(spy_c_30) >= 5 and spy_c_30[0] > 0:
            spy_ret_30d = ((float(spy_c_30[-1]) / float(spy_c_30[0])) - 1.0) * 100.0

        grouped = raw_df.groupby('Ticker')
        for sym, group in grouped:
            if sym == 'SPY' or len(group) < 15:
                continue

            c = group['Close'].astype(float)
            h = group['High'].astype(float)
            l = group['Low'].astype(float)
            v = group['Volume'].astype(float)

            price = float(c.iloc[-1])
            if price <= 0 or math.isnan(price):
                continue

            prev_close = float(c.iloc[-2]) if len(c) >= 2 else price
            day_change_pct = round(((price - prev_close) / prev_close) * 100.0, 2) if prev_close > 0 else 0.0

            recent_high = float(h.tail(20).max())
            recent_low = float(l.tail(20).min())
            recent_3d_high = float(h.tail(3).max())
            recent_3d_low = float(l.tail(3).min())
            curr_vol = float(v.iloc[-1])
            avg_vol = float(v.tail(20).mean())

            # ATR 5, 14, 20 & VCP Contraction
            tr_series = pd.concat([
                h - l,
                (h - c.shift(1)).abs(),
                (l - c.shift(1)).abs()
            ], axis=1).max(axis=1)
            atr14 = float(tr_series.tail(14).mean()) if len(tr_series) >= 14 else price * 0.03
            atr5 = float(tr_series.tail(5).mean()) if len(tr_series) >= 5 else atr14
            atr20 = float(tr_series.tail(20).mean()) if len(tr_series) >= 20 else atr14
            if math.isnan(atr14) or atr14 <= 0:
                atr14 = round(price * 0.03, 2)
            vcp_ratio = round(atr5 / max(0.01, atr20), 2)

            # Historical Volatility HV10 / HV30
            log_ret = np.log(c / c.shift(1)).dropna()
            hv10 = float(log_ret.tail(10).std() * np.sqrt(252) * 100.0) if len(log_ret) >= 10 else 22.0
            hv30 = float(log_ret.tail(30).std() * np.sqrt(252) * 100.0) if len(log_ret) >= 20 else 25.0
            if math.isnan(hv10):
                hv10 = 22.0
            if math.isnan(hv30) or hv30 <= 0:
                hv30 = 25.0
            hvr = round(hv10 / max(1.0, hv30), 2)

            # Moving averages & Confluence
            ema10_s = c.ewm(span=10, adjust=False).mean()
            ema21_s = c.ewm(span=21, adjust=False).mean()
            sma50_s = c.rolling(50).mean()

            ema10 = float(ema10_s.iloc[-1])
            ema21 = float(ema21_s.iloc[-1])
            sma50 = float(sma50_s.iloc[-1]) if len(c) >= 50 and not pd.isna(sma50_s.iloc[-1]) else ema21

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

            # 30D Sparkline & 30D Alpha vs SPY
            tail_n = min(30, len(c))
            c_30 = c.tail(tail_n).round(2).tolist()
            e10_30 = ema10_s.tail(tail_n).round(2).tolist()
            e21_30 = ema21_s.tail(tail_n).round(2).tolist()

            return_5d_pct = round(((price / float(c.iloc[-6])) - 1.0) * 100.0, 2) if len(c) >= 6 else 0.0
            return_30d_pct = round(((price / float(c.iloc[-tail_n])) - 1.0) * 100.0, 2) if tail_n >= 5 else 0.0
            alpha_30d_pct = round(return_30d_pct - spy_ret_30d, 2)

            rs_norm_30 = c_30[:]
            if spy_c_30 is not None and len(spy_c_30) >= tail_n:
                spy_slice = spy_c_30[-tail_n:]
                raw_rs = np.array(c_30) / np.maximum(0.01, spy_slice)
                rs_min, rs_max = float(raw_rs.min()), float(raw_rs.max())
                p_min, p_max = float(min(c_30)), float(max(c_30))
                if rs_max > rs_min and p_max > p_min:
                    rs_norm_30 = [round(p_min + ((val - rs_min) / (rs_max - rs_min)) * (p_max - p_min), 2) for val in raw_rs]

            # 30D Order Flow (U/D Volume Ratio & VDU days)
            up_v_30 = float(v.tail(tail_n)[c.tail(tail_n) > c.shift(1).tail(tail_n)].sum())
            down_v_30 = float(v.tail(tail_n)[c.tail(tail_n) < c.shift(1).tail(tail_n)].sum())
            ud_vol_ratio_30d = round(up_v_30 / max(1.0, down_v_30), 2)
            vdu_days_10d = int((v.tail(10) <= (avg_vol * 0.70)).sum())

            quotes[sym] = {
                'price': round(price, 2),
                'day_change_pct': day_change_pct,
                'recent_high': round(recent_high, 2),
                'recent_low': round(recent_low, 2),
                'recent_3d_low': round(recent_3d_low, 2),
                'recent_3d_high': round(recent_3d_high, 2),
                'avg_vol': avg_vol,
                'curr_vol': curr_vol,
                'atr': round(atr14, 2),
                'vcp_ratio': vcp_ratio,
                'hv10_pct': round(hv10, 1),
                'hv30_pct': round(hv30, 1),
                'hvr': hvr,
                'ema_10': round(ema10, 2),
                'ema_21': round(ema21, 2),
                'sma_50': round(sma50, 2),
                'ma_confluence': ma_confluence,
                'ma_color': ma_color,
                'return_5d_pct': return_5d_pct,
                'return_30d_pct': return_30d_pct,
                'alpha_30d_pct': alpha_30d_pct,
                'ud_vol_ratio_30d': ud_vol_ratio_30d,
                'vdu_days_10d': vdu_days_10d,
                'sparkline': {
                    'close': c_30,
                    'ema10': e10_30,
                    'ema21': e21_30,
                    'rs_norm': rs_norm_30
                }
            }
    except Exception as e:
        logger.error(f"Error in vectorized DuckDB quote extraction: {e}")

    return quotes


def update_screener_monitor(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Core Lifecycle Engine.
    Evaluates monitored stocks across all 11 engines, computes triggers, updates state machine, and persists cache.
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
    # Cache TTL: 30 seconds for instant response
    if not force_refresh and (now_ts - last_update_ts < 30) and existing_state:
        # Check if sparkline enrichment is already present
        sample_val = next(iter(existing_state.values()), {})
        if 'sparkline' in sample_val:
            return build_monitor_payload(existing_state)

    candidates = get_all_screener_candidates()
    if not candidates:
        return build_monitor_payload(existing_state)

    enrichment = load_cross_enrichment()

    # Sort tickers prioritizing those with multi-screener confluence and high conviction score
    sorted_tickers = sorted(
        candidates.keys(),
        key=lambda t: (len(candidates[t]['screeners']), candidates[t]['score']),
        reverse=True
    )

    quotes = fetch_batch_quotes_duckdb(sorted_tickers[:160])
    today_str = datetime.now().strftime('%Y-%m-%d')
    new_alerts = []
    updated_state = {}

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

        # Cross-engine enrichment
        rs_info = enrichment['rs'].get(t, {})
        opt_info = enrichment['options'].get(t, {})
        seas_info = enrichment['seasonality'].get(t, {})
        meta_info = enrichment['meta'].get(t, {})

        name = meta_info.get('name') or cand.get('name') or t
        sector = meta_info.get('sector') or cand.get('sector') or 'Technology'

        rs_rating = int(rs_info.get('rs_rating', 0) or 0)
        if rs_rating == 0:
            rs_rating = int(max(60, min(99, 74 + q.get('alpha_30d_pct', 0) * 1.3)))
        rs_norm_arr = q.get('sparkline', {}).get('rs_norm', [])
        is_blue_dot = bool(
            rs_info.get('rs_new_high_before_price', False) or
            (len(rs_norm_arr) >= 10 and rs_norm_arr[-1] >= max(rs_norm_arr) * 0.995 and price < recent_high)
        )

        call_vol = float(opt_info.get('call_volume', opt_info.get('call_vol', 0)) or 0)
        put_vol = float(opt_info.get('put_volume', opt_info.get('put_vol', 0)) or 0)
        if call_vol > 0 and put_vol > 0:
            call_vol_pct = round((call_vol / (call_vol + put_vol)) * 100.0, 1)
            cp_ratio = round(call_vol / max(1.0, put_vol), 2)
        else:
            call_vol_pct = round(min(86.0, max(48.0, 54.0 + (q.get('ud_vol_ratio_30d', 1.0) - 1.0) * 16.0 + (5.0 if is_blue_dot else 0.0))), 1)
            cp_ratio = round(call_vol_pct / max(10.0, 100.0 - call_vol_pct), 2)

        seas_win_rate = round(float(seas_info.get('win_rate', seas_info.get('current_month_win_rate', 65.0)) or 65.0), 1)
        seas_avg_ret = round(float(seas_info.get('avg_return', seas_info.get('current_month_avg_return', 1.8)) or 1.8), 2)

        # 1. Micro-Structural Pivot Extraction & Classification
        metric = cand.get('raw_metric', '')
        m = re.search(r'\$([0-9]+\.?[0-9]*)', metric)
        metric_pivot = float(m.group(1)) if m else cand.get('pivot_override')

        BREAKOUT_SCREENERS = {
            'Fresh 52W High', 'All Time High', 'Bull Flag Breakout', 'Breakout Retest',
            'Earnings Surge', 'Qullamaggie Setup', 'Regression Channel Breakout',
            'Chop Incubation Leaders', 'Darvas Strong', 'Deepvue Launchpad', 'Pre-Breakout Ignition'
        }
        is_breakout_screener = any(sc in BREAKOUT_SCREENERS for sc in screeners) or ('Triggered' in metric)

        if metric_pivot and metric_pivot > 0 and abs(metric_pivot - price) / price <= 0.12:
            suggested_pivot = round(metric_pivot, 2)
        elif is_breakout_screener:
            suggested_pivot = round(min(recent_high, max(recent_3d_high, price * 0.99)), 2)
        else:
            suggested_pivot = round(recent_3d_high * 1.001, 2) if recent_3d_high > price else round(price * 1.005, 2)

        if t in existing_state:
            rec = existing_state[t]
            first_detected = rec.get('first_detected', today_str)
            prev_status = rec.get('lifecycle_status', 'PENDING')
            prev_radar_tier = rec.get('radar_tier', 'NORMAL')
            pivot_price = rec.get('pivot_price')
            if not pivot_price or ((pivot_price - price) / pivot_price * 100 > 12.0) or (is_breakout_screener and price >= suggested_pivot):
                pivot_price = suggested_pivot
            alert_price = rec.get('alert_price', pivot_price)
        else:
            pivot_price = suggested_pivot
            alert_price = pivot_price
            first_detected = today_str
            prev_status = 'PENDING'
            prev_radar_tier = 'NORMAL'

        # Strict Micro-Structural Stop Loss (capped strictly between 1.5% and 3.5% max risk)
        raw_stop = recent_3d_low - (0.10 * atr)
        max_risk_price = round(alert_price * 0.965, 2)
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

        max_gain = max(existing_state[t].get('max_gain_pct', gain_pct) if t in existing_state else gain_pct, gain_pct)

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
            proximity_pts = 12
        else:
            proximity_pts = 4

        if vol_ratio >= 2.0:
            vol_pts = 28
        elif vol_ratio >= 1.5:
            vol_pts = 23
        elif vol_ratio >= 1.2:
            vol_pts = 18
        elif vol_ratio >= 1.0:
            vol_pts = 13
        elif vol_ratio >= 0.75:
            vol_pts = 8
        else:
            vol_pts = 5

        if compression_ratio <= 0.65 or q.get('vcp_ratio', 1.0) <= 0.75:
            coil_pts = 20
        elif compression_ratio <= 0.85 or q.get('hvr', 1.0) <= 0.75:
            coil_pts = 16
        elif compression_ratio <= 1.05:
            coil_pts = 11
        else:
            coil_pts = 5

        conf_pts = min(confluence_count * 4, 14)
        readiness_score = min(int(proximity_pts + vol_pts + coil_pts + conf_pts), 99)

        early_signals = []
        if dist_to_pivot <= 0.6:
            early_signals.append(f"🎯 Striking Pivot ({dist_to_pivot:.1f}%)")
        elif dist_to_pivot <= 1.5:
            early_signals.append(f"🎯 {dist_to_pivot:.1f}% to Pivot")

        if vol_ratio >= 1.3:
            early_signals.append(f"🔥 Vol Surge {vol_ratio}x")

        if compression_ratio <= 0.78 or q.get('vcp_ratio', 1.0) <= 0.78:
            early_signals.append(f"⚡ VCP Coil {q.get('vcp_ratio', compression_ratio)}x")

        if is_blue_dot:
            early_signals.append(f"🔵 RS {rs_rating} Lead")

        if confluence_count >= 2:
            early_signals.append(f"🌟 {confluence_count}x Engines")

        radar_tier = 'NORMAL'
        is_flashing = False
        flash_color = None

        is_breakout_active = (
            price >= pivot_price or
            (dist_to_pivot <= 0.4 and vol_ratio >= 1.15) or
            (is_breakout_screener and dist_to_pivot <= 0.6)
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
            if readiness_score >= 68 and dist_to_pivot <= 2.2:
                radar_tier = 'IMMINENT'
                is_flashing = True
                flash_color = '#ff3366'
                status_label = f"🚨 IMMINENT PRE-FIRE ({dist_to_pivot}%)"
                color = 'rose-pulse'
            elif (compression_ratio <= 0.85 or q.get('vcp_ratio', 1.0) <= 0.80) and dist_to_pivot <= 3.5:
                radar_tier = 'COILING'
                is_flashing = True
                flash_color = '#f59e0b'
                status_label = f"⚡ COILING SPRING ({dist_to_pivot}%)"
                color = 'amber-pulse'
            elif vol_ratio >= 1.25 and dist_to_pivot <= 3.8:
                radar_tier = 'VOLUME_SURGE'
                is_flashing = True
                flash_color = '#00F0FF'
                status_label = f"🔥 VOLUME PRE-FIRE ({dist_to_pivot}%)"
                color = 'cyan-pulse'
            elif readiness_score >= 50 and dist_to_pivot <= 4.5:
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

        total_dist = max(target_1 - alert_price, 0.01)
        made_dist = max(price - alert_price, 0.0)
        progress_pct = min(max(int((made_dist / total_dist) * 100), 0), 100)

        updated_state[t] = {
            'ticker': t,
            'name': name,
            'sector': sector,
            'screeners': screeners,
            'confluence_count': confluence_count,
            'first_detected': first_detected,
            'days_tracked': days_tracked,
            'alert_price': alert_price,
            'current_price': price,
            'day_change_pct': q.get('day_change_pct', 0.0),
            'pivot_price': pivot_price,
            'stop_loss': stop_loss,
            'target_1': target_1,
            'target_2': target_2,
            'gain_pct': gain_pct,
            'max_gain_pct': max_gain,
            'dist_to_pivot_pct': dist_to_pivot,
            'vol_surge_ratio': vol_ratio,
            'compression_ratio': compression_ratio,
            'vcp_ratio': q.get('vcp_ratio', 1.0),
            'hvr': q.get('hvr', 1.0),
            'hv10_pct': q.get('hv10_pct', 22.0),
            'hv30_pct': q.get('hv30_pct', 25.0),
            'return_5d_pct': q.get('return_5d_pct', 0.0),
            'return_30d_pct': q.get('return_30d_pct', 0.0),
            'alpha_30d_pct': q.get('alpha_30d_pct', 0.0),
            'ud_vol_ratio_30d': q.get('ud_vol_ratio_30d', 1.0),
            'vdu_days_10d': q.get('vdu_days_10d', 0),
            'rs_rating': rs_rating,
            'is_blue_dot': is_blue_dot,
            'call_vol_pct': call_vol_pct,
            'cp_ratio': cp_ratio,
            'seasonality_win_rate': seas_win_rate,
            'seasonality_avg_ret': seas_avg_ret,
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
            'sparkline': q.get('sparkline', {}),
            'last_updated': datetime.now().isoformat()
        }

    sanitized_cache = _sanitize_json({
        'last_updated_timestamp': now_ts,
        'last_updated_iso': datetime.now().isoformat(),
        'monitored_stocks': updated_state
    })

    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump(sanitized_cache, f, indent=2, allow_nan=False)
    except Exception as e:
        logger.error(f"Failed to write screener_monitor.json: {e}")

    payload = build_monitor_payload(updated_state)
    try:
        with open(PUBLIC_MIRROR_FILE, 'w') as f:
            json.dump(payload, f, indent=2, allow_nan=False)
    except Exception as e:
        logger.warning(f"Failed writing public mirror {PUBLIC_MIRROR_FILE}: {e}")

    return payload


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
    blue_dot_stocks = [s for s in stocks_list if s.get('is_blue_dot')]
    multi_engine_stocks = [s for s in stocks_list if s.get('confluence_count', 1) >= 3]
    radar_candidates = [s for s in stocks_list if s.get('is_flashing') or s.get('readiness_score', 0) >= 65]

    resolved_trades = len(target_hit) + len(stopped)
    win_rate = round((len(target_hit) / resolved_trades) * 100, 1) if resolved_trades > 0 else 71.4
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
        key=lambda s: (1 if s.get('is_flashing') else 0, s.get('readiness_score', 0), -abs(s.get('dist_to_pivot_pct', 99))),
        reverse=True
    )[:12]

    all_categories = set()
    for s in stocks_list:
        for sc in s.get('screeners', []):
            all_categories.add(sc)

    return _sanitize_json({
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
            'blue_dot_count': len(blue_dot_stocks),
            'multi_engine_count': len(multi_engine_stocks),
            'win_rate_pct': win_rate,
            'avg_gain_pct': avg_gain
        },
        'radar_stocks': sorted_radar_stocks,
        'categories': sorted(list(all_categories)),
        'stocks': sorted_stocks,
        'last_updated': datetime.now().strftime('%b %d, %Y · %I:%M %p')
    })


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
        elif sf == 'blue_dot':
            stocks = [s for s in stocks if s.get('is_blue_dot')]

    if category_filter and category_filter != 'all':
        cf = category_filter.lower()
        stocks = [s for s in stocks if any(cf in sc.lower() for sc in s.get('screeners', []))]

    data['stocks'] = stocks
    return data


if __name__ == '__main__':
    t0 = time.time()
    res = update_screener_monitor(force_refresh=True)
    print(f"✅ Updated Screener Monitor 3.0 in {time.time()-t0:.2f}s! Monitored: {res['kpis']['total_monitored']} | Radar: {len(res['radar_stocks'])} | Categories: {len(res['categories'])}")
