import json
import math
import os
import threading
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import yfinance as yf

try:
    from market_health_engine import _YF_LOCK
except Exception:
    _YF_LOCK = threading.Lock()

PUBLIC_50Y_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/public/market_cycle_50y.json'
CACHE_TTL_SEC = 3600

# 50-year bounds allow 1981 ~15.8% yields and 1987/2008/2020 vol regimes
_50Y_BOUNDS = {
    '^GSPC': (30.0, 50000.0),
    '^IXIC': (30.0, 100000.0),
    '^TNX': (0.2, 20.0),
    '^IRX': (0.0, 20.0),
    '^VIX': (7.0, 95.0),
    '^RUT': (50.0, 10000.0),
}


def _clip01(s):
    return np.clip(s, 0.0, 1.0)


def _safe_float(v, digits: int = 2) -> Optional[float]:
    try:
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return round(f, digits)
    except Exception:
        return None


def _sanitize_json(obj: Any) -> Any:
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, (np.floating, np.integer)):
        val = float(obj) if isinstance(obj, np.floating) else int(obj)
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return None
        return val
    if isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    if isinstance(obj, dict):
        return {k: _sanitize_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_json(x) for x in obj]
    return obj


def _fetch_max_close(sym: str) -> pd.Series:
    lo, hi = _50Y_BOUNDS.get(sym, (0.01, 1_000_000.0))
    try:
        with _YF_LOCK:
            hist = yf.Ticker(sym).history(period='max', interval='1d')
        if hist is not None and not hist.empty and 'Close' in hist.columns:
            s = pd.to_numeric(hist['Close'], errors='coerce').dropna()
            s.index = pd.to_datetime(s.index).tz_localize(None).normalize()
            s = s[~s.index.duplicated(keep='last')].sort_index()
            if len(s) >= 20:
                med = float(s.median())
                last = float(s.iloc[-1])
                if lo <= med <= hi and lo <= last <= hi:
                    return s
    except Exception as exc:
        print(f"[50Y Engine] Fetch error for {sym}: {exc}")
    return pd.Series(dtype=float)


def _label_episode(date_str: str, is_bottom: bool) -> str:
    yr = int(date_str[:4])
    mo = int(date_str[5:7])
    if is_bottom:
        if yr <= 1982:
            return 'Volcker Bear / Recession Low'
        if yr == 1987:
            return '1987 Black Monday Washout'
        if yr in (1990, 1991):
            return '1990 Gulf War / S&L Bottom'
        if yr in (1998, 1999):
            return '1998 LTCM / Russia Crisis'
        if yr == 2000:
            return '2000 Dot-Com Initial Shakeout'
        if yr == 2001:
            return '2001 Dot-Com & 9/11 Washout'
        if yr in (2002, 2003):
            return '2002–03 Dot-Com Capitulation'
        if yr in (2008, 2009):
            return '2008–09 GFC Credit Panic'
        if yr in (2011, 2012):
            return '2011 US Downgrade / Euro Crisis'
        if yr in (2015, 2016):
            return '2015–16 China / Oil Shock'
        if yr == 2018:
            return '2018 Q4 Fed QT Tantrum'
        if yr == 2020:
            return '2020 COVID Liquidity Shock'
        if yr in (2022, 2023):
            return '2022 Rate-Hike Bear Market'
        if yr == 2025:
            return '2025 April Tariff / Vol Shock'
        return f'{yr} Panic Washout'
    else:
        if yr in (1978, 1979, 1980, 1981):
            return f'{yr} Inflation / Rate Shock Peak'
        if yr in (1983, 1984):
            return '1983–84 Post-Reagan Consolidation'
        if yr == 1987:
            return '1987 Pre-Crash Euphoria Peak'
        if yr == 1989 or yr == 1990:
            return '1989–90 Pre-Recession Peak'
        if yr in (1996, 1999, 2000):
            return '2000 Dot-Com Bubble Top'
        if yr == 2007:
            return '2007 Pre-GFC Credit Top'
        if yr == 2013 or yr == 2018:
            return f'{yr} Late-Cycle Taper Shakeout'
        if yr == 2019:
            return '2019 Yield-Curve Inversion Wobble'
        if yr == 2020 and mo <= 4:
            return '2020 Pre-COVID Extended Peak'
        if yr in (2021, 2022):
            return '2021–22 Fed Tightening Cycle Peak'
        if yr == 2024:
            return '2024 AI Melt-Up Extension'
        if yr == 2025:
            return '2025 Q4 High-Beta Shakeout'
        return f'{yr} Late-Cycle Exhaustion'


def _cluster_indices(cond_arr: np.ndarray, min_gap: int = 90) -> List[int]:
    idxs = []
    last_i = -10_000
    for i, flag in enumerate(cond_arr):
        if bool(flag) and (i - last_i) >= min_gap:
            idxs.append(i)
            last_i = i
    return idxs


def _compute_cluster_stats(sub_df: pd.DataFrame) -> Dict[str, Any]:
    out = {'n': int(len(sub_df))}
    for h in ('1m', '3m', '6m', '12m'):
        col = f'fwd_{h}'
        s = sub_df[col].dropna() if col in sub_df else pd.Series(dtype=float)
        out[f'fwd_{h}_med'] = _safe_float(s.median(), 1) if len(s) else None
        out[f'fwd_{h}_mean'] = _safe_float(s.mean(), 1) if len(s) else None
        out[f'win_{h}'] = _safe_float((s > 0).mean() * 100.0, 1) if len(s) else None
    dd6 = sub_df['fwd_min_126d'].dropna() if 'fwd_min_126d' in sub_df else pd.Series(dtype=float)
    dd12 = sub_df['fwd_min_252d'].dropna() if 'fwd_min_252d' in sub_df else pd.Series(dtype=float)
    dd3 = sub_df['fwd_min_63d'].dropna() if 'fwd_min_63d' in sub_df else pd.Series(dtype=float)
    out['med_max_dd_3m'] = _safe_float(dd3.median(), 1) if len(dd3) else None
    out['med_max_dd_6m'] = _safe_float(dd6.median(), 1) if len(dd6) else None
    out['med_max_dd_12m'] = _safe_float(dd12.median(), 1) if len(dd12) else None
    out['pct_10dd_12m'] = _safe_float((dd12 <= -10.0).mean() * 100.0, 1) if len(dd12) else None
    return out


def generate_market_cycle_50y_json(force_refresh: bool = False) -> Dict[str, Any]:
    if not force_refresh and os.path.exists(PUBLIC_50Y_PATH):
        try:
            age = datetime.now().timestamp() - os.path.getmtime(PUBLIC_50Y_PATH)
            if age < CACHE_TTL_SEC:
                with open(PUBLIC_50Y_PATH, 'r') as f:
                    content = f.read().replace(': NaN', ': null')
                    cached = json.loads(content)
                    if cached.get('version') == '3.0' and len(cached.get('series_50y_weekly', [])) > 1500:
                        return cached
        except Exception:
            pass

    spx = _fetch_max_close('^GSPC')
    if spx.empty or len(spx) < 1000:
        return {'error': 'Failed to fetch 50-year S&P 500 (^GSPC) history'}

    ixic = _fetch_max_close('^IXIC')
    tnx = _fetch_max_close('^TNX')
    irx = _fetch_max_close('^IRX')
    vix = _fetch_max_close('^VIX')
    rut = _fetch_max_close('^RUT')

    df = pd.DataFrame({'spx': spx}).loc['1974-01-01':]
    df['ixic'] = ixic.reindex(df.index).ffill()
    df['tnx'] = tnx.reindex(df.index).ffill()
    df['irx'] = irx.reindex(df.index).ffill()
    df['vix'] = vix.reindex(df.index).ffill()
    df['rut'] = rut.reindex(df.index).ffill()

    # Core 50-year indicators
    df['ret1'] = df['spx'].pct_change()
    df['sma50'] = df['spx'].rolling(50).mean()
    df['sma200'] = df['spx'].rolling(200).mean()
    df['ext200'] = (df['spx'] / df['sma200'] - 1.0) * 100.0
    df['hi252'] = df['spx'].rolling(252).max()
    df['dd252'] = (df['spx'] / df['hi252'] - 1.0) * 100.0
    df['dd_ath'] = (df['spx'] / df['spx'].cummax() - 1.0) * 100.0

    df['rv20'] = df['ret1'].rolling(20).std() * np.sqrt(252) * 100.0
    df['vol_50y'] = df['vix'].combine_first(df['rv20'] * 1.12)
    vol_mean = df['vol_50y'].rolling(252).mean()
    vol_std = df['vol_50y'].rolling(252).std().replace(0, np.nan)
    df['vol_z'] = (df['vol_50y'] - vol_mean) / vol_std
    df['vol_10d_max'] = df['vol_50y'].rolling(10).max()
    df['vol_20d_min'] = df['vol_50y'].rolling(20).min()
    df['vol_126d_min'] = df['vol_50y'].rolling(126).min()

    # Daily & Weekly Wilder RSI(14)
    delta = df['spx'].diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / 14, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / 14, adjust=False).mean().replace(0, np.nan)
    df['rsi14'] = 100.0 - (100.0 / (1.0 + gain / loss))

    wk = df['spx'].resample('W-FRI').last()
    wd = wk.diff()
    wg = wd.clip(lower=0).ewm(alpha=1 / 14, adjust=False).mean()
    wl = (-wd.clip(upper=0)).ewm(alpha=1 / 14, adjust=False).mean().replace(0, np.nan)
    w_rsi = 100.0 - (100.0 / (1.0 + wg / wl))
    df['w_rsi14'] = w_rsi.reindex(df.index, method='ffill')
    df['w_rsi_126max'] = df['w_rsi14'].rolling(126).max()

    # Monthly Coppock Curve: WMA_10(ROC_14m + ROC_11m)
    mo = df['spx'].resample('ME').last()
    roc_sum = (mo.pct_change(14) * 100.0) + (mo.pct_change(11) * 100.0)
    wts = np.arange(1, 11)
    coppock_m = roc_sum.rolling(10).apply(lambda x: np.dot(x, wts) / wts.sum(), raw=True)
    df['coppock'] = coppock_m.reindex(df.index, method='ffill')
    df['coppock_prev'] = coppock_m.shift(1).reindex(df.index, method='ffill')

    # Yield curve 10Y-3M & macro tightening
    df['yc'] = df['tnx'] - df['irx']
    df['yc_inv_24m'] = df['yc'].rolling(504, min_periods=60).min() < -0.10
    df['tnx_chg_1y'] = (df['tnx'] - df['tnx'].shift(252)) * 100.0
    df['ret_252d'] = df['spx'].pct_change(252) * 100.0
    df['ret_504d'] = df['spx'].pct_change(504) * 100.0
    df['rut_dd252'] = (df['rut'] / df['rut'].rolling(252).max() - 1.0) * 100.0
    df['rut_div'] = (df['dd252'] - df['rut_dd252']).fillna(0.0)
    df['ixic_spx_252d'] = (df['ixic'] / df['spx']).pct_change(252).fillna(0.0) * 100.0

    # Forward returns for historical empirical proof
    for h, n in (('1m', 21), ('3m', 63), ('6m', 126), ('12m', 252)):
        df[f'fwd_{h}'] = (df['spx'].shift(-n) / df['spx'] - 1.0) * 100.0
    df['fwd_min_63d'] = (df['spx'].rolling(63).min().shift(-63) / df['spx'] - 1.0) * 100.0
    df['fwd_min_126d'] = (df['spx'].rolling(126).min().shift(-126) / df['spx'] - 1.0) * 100.0
    df['fwd_min_252d'] = (df['spx'].rolling(252).min().shift(-252) / df['spx'] - 1.0) * 100.0

    # Exact trailing 50-year window
    end_dt = df.index.max()
    start_50y = (end_dt - pd.DateOffset(years=50)).strftime('%Y-%m-%d')
    df50 = df.loc[start_50y:].copy()

    # --- 50-YEAR COMPOSITE BOTTOM SCORE (0-100) ---
    b_rsi = _clip01((45.0 - df50['rsi14']) / 22.0)
    b_wrsi = _clip01((48.0 - df50['w_rsi14']) / 20.0)
    b_vol = _clip01((df50['vol_50y'] - 20.0) / 18.0)
    b_volz = _clip01((df50['vol_z'] - 1.0) / 2.8)
    b_ext = _clip01((-df50['ext200']) / 14.0)
    b_dd = _clip01((-df50['dd252'] - 5.0) / 20.0)
    df50['bottom_score'] = np.clip(
        (0.20 * b_rsi + 0.15 * b_wrsi + 0.20 * b_vol + 0.15 * b_volz + 0.15 * b_ext + 0.15 * b_dd) * 100.0,
        0.0, 100.0,
    ).fillna(0.0)

    # --- 50-YEAR COMPOSITE TOP RISK SCORE (0-100) ---
    t_near_hi = _clip01((9.0 + df50['dd252']) / 5.0)
    t_macro = np.maximum.reduce([
        df50['yc_inv_24m'].astype(float) * 0.90,
        _clip01((0.50 - df50['yc']) / 0.90),
        _clip01((df50['tnx_chg_1y'] - 45.0) / 120.0),
    ])
    t_exhaust = np.maximum.reduce([
        _clip01((df50['ext200'] - 4.0) / 11.0),
        _clip01((df50['ret_504d'] - 24.0) / 36.0),
        _clip01((df50['w_rsi14'] - 60.0) / 14.0),
    ])
    t_vol_comp = np.maximum(
        _clip01((16.5 - df50['vol_50y']) / 5.5),
        _clip01((df50['vol_50y'] - df50['vol_126d_min']) / 6.0) * _clip01((18.5 - df50['vol_126d_min']) / 6.5),
    )
    t_div = np.maximum.reduce([
        _clip01((df50['rut_div'] - 3.5) / 9.0),
        _clip01((df50['w_rsi_126max'] - df50['w_rsi14'] - 6.0) / 14.0),
        _clip01((df50['ixic_spx_252d'] - 10.0) / 25.0),
    ])
    df50['top_score'] = np.clip(
        t_near_hi * (0.32 * t_macro + 0.28 * t_exhaust + 0.22 * t_vol_comp + 0.18 * t_div) * 100.0,
        0.0, 100.0,
    ).fillna(0.0)

    # Two-stage triggers
    df50['bottom_stage1'] = df50['bottom_score'] >= 70.0
    df50['bottom_confirmed'] = (
        (df50['bottom_score'].rolling(15).max() >= 68.0)
        & (df50['vol_50y'] <= df50['vol_10d_max'] * 0.88)
        & (df50['spx'] > df50['spx'].rolling(5).min() * 1.012)
        & (df50['rsi14'] > df50['rsi14'].rolling(5).min() + 4.0)
    )
    df50['top_stage1'] = df50['top_score'] >= 68.0
    df50['top_confirmed'] = (
        (df50['top_score'].rolling(30).max() >= 68.0)
        & (df50['spx'] < df50['sma50'])
        & (df50['vol_50y'] > df50['vol_20d_min'] * 1.25)
    )

    # Current row & 50Y percentiles (computed prior to headline formatting)
    curr_row = df50.iloc[-1]
    pctl_cols = ['dd252', 'ext200', 'vol_50y', 'vol_z', 'rsi14', 'w_rsi14', 'coppock', 'yc', 'bottom_score', 'top_score']
    percentiles_50y = {}
    for c in pctl_cols:
        s_valid = df50[c].dropna()
        v_cur = curr_row[c]
        percentiles_50y[c] = _safe_float((s_valid <= v_cur).mean() * 100.0, 1) if (len(s_valid) and pd.notna(v_cur)) else 50.0

    b_now = float(curr_row['bottom_score'])
    t_now = float(curr_row['top_score'])
    b_15_max = float(df50['bottom_score'].rolling(15).max().iloc[-1])
    t_30_max = float(df50['top_score'].rolling(30).max().iloc[-1])

    if bool(curr_row['bottom_confirmed']):
        phase_code = 'CONFIRMED_BOTTOM'
        phase_label = 'CONFIRMED BOTTOM REVERSAL (STAGE 2)'
        phase_color = '#00E676'
        headline = 'Panic vol receding (-12%+) with RSI/price hooking up after Stage 1 capitulation.'
        action_summary = 'Deploy staged long risk into RS leaders; raise core equity exposure.'
    elif b_now >= 70.0 or b_15_max >= 70.0:
        phase_code = 'APPROACHING_BOTTOM'
        phase_label = 'APPROACHING BOTTOM · WASH-OUT ZONE (STAGE 1)'
        phase_color = '#fbbf24'
        headline = (
            f"50Y Bottom Score {b_now:.1f}/100 ({percentiles_50y.get('vol_50y', 50.0):.0f}th% Vol, "
            f"{percentiles_50y.get('rsi14', 50.0):.1f}th% Daily RSI). Washout zone active; awaiting Stage 2 Vol Crush hook."
        )
        action_summary = 'Stop panic selling & prepare buy watchlist; deploy once VIX drops <= -12% off peak & SPY reclaims 5D low +1.2%.'
    elif bool(curr_row['top_confirmed']):
        phase_code = 'CONFIRMED_TOP'
        phase_label = 'CONFIRMED TOP BREAKDOWN (STAGE 2)'
        phase_color = '#ff3366'
        headline = 'Late-cycle exhaustion broke below 50D SMA with expanding volatility (+25% off 20D low).'
        action_summary = 'Defense mode: raise cash, trim high-beta tech, hedge downside risk.'
    elif t_now >= 68.0 or t_30_max >= 68.0:
        phase_code = 'APPROACHING_TOP'
        phase_label = 'APPROACHING LATE-CYCLE TOP RISK (STAGE 1)'
        phase_color = '#fb923c'
        headline = 'Extended trend + macro/breadth warnings near highs; watch 50D SMA support.'
        action_summary = 'Tighten trailing stops and avoid chasing extended breakouts.'
    else:
        phase_code = 'MID_CYCLE'
        phase_label = 'MID-CYCLE NEUTRAL REGIME'
        phase_color = '#38bdf8'
        headline = 'Neither 50-year capitulation bottom nor secular euphoria top extremes triggered.'
        action_summary = 'Trade standard relative-strength swing setups matched to Market Health posture.'

    # Active pillar breakdowns (at last bar)
    bottom_pillars = [
        {'label': 'Daily RSI(14)', 'score': _safe_float(b_rsi.iloc[-1] * 100.0, 1), 'raw': f"{float(curr_row['rsi14']):.1f}"},
        {'label': 'Weekly RSI(14)', 'score': _safe_float(b_wrsi.iloc[-1] * 100.0, 1), 'raw': f"{float(curr_row['w_rsi14']):.1f}"},
        {'label': '50Y Vol Level', 'score': _safe_float(b_vol.iloc[-1] * 100.0, 1), 'raw': f"{float(curr_row['vol_50y']):.1f}"},
        {'label': 'Vol Z-Shock', 'score': _safe_float(b_volz.iloc[-1] * 100.0, 1), 'raw': f"{float(curr_row['vol_z']):+.2f}σ"},
        {'label': '200D Stretch', 'score': _safe_float(b_ext.iloc[-1] * 100.0, 1), 'raw': f"{float(curr_row['ext200']):+.1f}%"},
        {'label': '52W Drawdown', 'score': _safe_float(b_dd.iloc[-1] * 100.0, 1), 'raw': f"{float(curr_row['dd252']):+.1f}%"},
    ]
    top_pillars = [
        {'label': 'Curve / Rate Shock', 'score': _safe_float(float(np.asarray(t_macro)[-1]) * 100.0, 1), 'raw': f"{float(curr_row['yc']):+.2f}%"},
        {'label': '2Y / 200D Stretch', 'score': _safe_float(float(np.asarray(t_exhaust)[-1]) * 100.0, 1), 'raw': f"{float(curr_row['ext200']):+.1f}%"},
        {'label': 'Vol Complacency', 'score': _safe_float(float(np.asarray(t_vol_comp)[-1]) * 100.0, 1), 'raw': f"{float(curr_row['vol_50y']):.1f}"},
        {'label': 'Breadth Divergence', 'score': _safe_float(float(np.asarray(t_div)[-1]) * 100.0, 1), 'raw': f"{float(curr_row['rut_div']):+.1f}%"},
    ]

    # Stage 2 Bottom Confirmation Checklist (live threshold distance)
    spx_5d_min = float(df50['spx'].rolling(5).min().iloc[-1])
    rsi_5d_min = float(df50['rsi14'].rolling(5).min().iloc[-1])
    vol_10_pk = float(curr_row['vol_10d_max'])
    vol_now = float(curr_row['vol_50y'])
    vol_drop_pct = ((vol_now / vol_10_pk) - 1.0) * 100.0 if vol_10_pk > 0 else 0.0
    copp_up_flag = bool(curr_row['coppock'] > curr_row['coppock_prev']) if pd.notna(curr_row['coppock']) and pd.notna(curr_row['coppock_prev']) else False
    confirmation_checklist = [
        {
            'label': 'Stage 1 Washout Score (>=68 in 15D)',
            'met': bool(b_15_max >= 68.0),
            'current': f"{b_15_max:.1f}/100",
            'target': '>= 68.0',
        },
        {
            'label': 'Vol Exhaustion Hook (-12% off 10D Peak)',
            'met': bool(vol_now <= vol_10_pk * 0.88),
            'current': f"VIX {vol_now:.1f} ({vol_drop_pct:+.1f}% vs pk {vol_10_pk:.1f})",
            'target': f"<= {vol_10_pk * 0.88:.1f}",
        },
        {
            'label': 'S&P 500 Bounce (+1.2% above 5D Low)',
            'met': bool(float(curr_row['spx']) > spx_5d_min * 1.012),
            'current': f"{float(curr_row['spx']):.1f} (+{((float(curr_row['spx'])/spx_5d_min)-1)*100:.1f}%)",
            'target': f"> {spx_5d_min * 1.012:.1f}",
        },
        {
            'label': 'RSI Momentum Hook (+4 pts off 5D Low)',
            'met': bool(float(curr_row['rsi14']) > rsi_5d_min + 4.0),
            'current': f"RSI {float(curr_row['rsi14']):.1f} (min {rsi_5d_min:.1f})",
            'target': f"> {rsi_5d_min + 4.0:.1f}",
        },
        {
            'label': 'Coppock Secular Curve Slope',
            'met': bool(float(curr_row['coppock']) < 0 and copp_up_flag) if pd.notna(curr_row['coppock']) else False,
            'current': f"{float(curr_row['coppock']):+.1f} ({'Rising' if copp_up_flag else 'Falling'})" if pd.notna(curr_row['coppock']) else '—',
            'target': '< 0 & Rising',
        },
    ]

    # Clustered Empirical Stats & Event Points
    b1_idxs = _cluster_indices(df50['bottom_stage1'].values, min_gap=90)
    b2_idxs = _cluster_indices(df50['bottom_confirmed'].values, min_gap=90)
    t1_idxs = _cluster_indices(df50['top_stage1'].values, min_gap=120)
    t2_idxs = _cluster_indices(df50['top_confirmed'].values, min_gap=120)

    empirical_stats = {
        'bottom_stage1': _compute_cluster_stats(df50.iloc[b1_idxs]),
        'bottom_confirmed': _compute_cluster_stats(df50.iloc[b2_idxs]),
        'top_stage1': _compute_cluster_stats(df50.iloc[t1_idxs]),
        'top_confirmed': _compute_cluster_stats(df50.iloc[t2_idxs]),
        'baseline_all': _compute_cluster_stats(df50),
    }

    bottom_signals = []
    for i in b1_idxs:
        r = df50.iloc[i]
        dt_s = df50.index[i].strftime('%Y-%m-%d')
        bottom_signals.append({
            'date': dt_s,
            'spx': _safe_float(r['spx'], 1),
            'score': _safe_float(r['bottom_score'], 1),
            'stage': 'Confirmed' if bool(r['bottom_confirmed']) else 'Stage 1',
            'dd252': _safe_float(r['dd252'], 1),
            'vol_50y': _safe_float(r['vol_50y'], 1),
            'yc': _safe_float(r['yc'], 2),
            'fwd_3m': _safe_float(r['fwd_3m'], 1),
            'fwd_6m': _safe_float(r['fwd_6m'], 1),
            'fwd_12m': _safe_float(r['fwd_12m'], 1),
            'max_dd_6m': _safe_float(r['fwd_min_126d'], 1),
            'event': _label_episode(dt_s, True),
        })

    top_signals = []
    for i in t2_idxs:
        r = df50.iloc[i]
        dt_s = df50.index[i].strftime('%Y-%m-%d')
        t_pk = float(df50['top_score'].iloc[max(0, i - 30):i + 1].max())
        top_signals.append({
            'date': dt_s,
            'spx': _safe_float(r['spx'], 1),
            'score': _safe_float(t_pk, 1),
            'stage': 'Confirmed',
            'dd252': _safe_float(r['dd252'], 1),
            'vol_50y': _safe_float(r['vol_50y'], 1),
            'yc': _safe_float(r['yc'], 2),
            'fwd_3m': _safe_float(r['fwd_3m'], 1),
            'fwd_6m': _safe_float(r['fwd_6m'], 1),
            'fwd_12m': _safe_float(r['fwd_12m'], 1),
            'max_dd_6m': _safe_float(r['fwd_min_126d'], 1),
            'max_dd_12m': _safe_float(r['fwd_min_252d'], 1),
            'event': _label_episode(dt_s, False),
        })

    # Nearest 50-Year Historical Analogs via standardized Euclidean distance (at least 180d ago, spaced >= 120d)
    feat_cols = ['dd252', 'ext200', 'vol_50y', 'vol_z', 'rsi14', 'w_rsi14', 'yc']
    feat_df = df50[feat_cols].iloc[:-180].dropna()
    nearest_analogs = []
    if len(feat_df) > 250 and pd.notna(curr_row[feat_cols]).all():
        means = feat_df.mean()
        stds = feat_df.std().replace(0, 1.0)
        z_mat = (feat_df - means) / stds
        z_now = (curr_row[feat_cols].astype(float) - means) / stds
        dists = np.sqrt(((z_mat - z_now) ** 2).sum(axis=1)).sort_values()
        picked_dates = []
        for dt_a, dist_v in dists.items():
            if any(abs((dt_a - pd.Timestamp(p)).days) < 170 for p in picked_dates):
                continue
            picked_dates.append(dt_a)
            r_a = df50.loc[dt_a]
            dt_str = dt_a.strftime('%Y-%m-%d')
            sim_pct = round(max(5.0, min(99.5, 100.0 * math.exp(-0.18 * float(dist_v)))), 1)
            nearest_analogs.append({
                'date': dt_str,
                'event': _label_episode(dt_str, b_now >= t_now),
                'similarity_pct': sim_pct,
                'spx': _safe_float(r_a['spx'], 1),
                'dd252': _safe_float(r_a['dd252'], 1),
                'vol_50y': _safe_float(r_a['vol_50y'], 1),
                'rsi14': _safe_float(r_a['rsi14'], 1),
                'fwd_1m': _safe_float(r_a['fwd_1m'], 1),
                'fwd_3m': _safe_float(r_a['fwd_3m'], 1),
                'fwd_6m': _safe_float(r_a['fwd_6m'], 1),
                'fwd_12m': _safe_float(r_a['fwd_12m'], 1),
                'max_dd_63d': _safe_float(r_a['fwd_min_63d'], 1),
            })
            if len(nearest_analogs) >= 5:
                break

    # Weekly 50Y Series (Fridays + latest exact trading day so current point is never clipped)
    wk_df = df50[df50.index.weekday == 4].copy()
    if len(wk_df) == 0 or wk_df.index[-1] != df50.index[-1]:
        wk_df = pd.concat([wk_df, df50.iloc[[-1]]])
    wk_df = wk_df[~wk_df.index.duplicated(keep='last')].sort_index()

    series_50y_weekly = []
    for dt_w, rw in wk_df.iterrows():
        series_50y_weekly.append({
            'date': dt_w.strftime('%Y-%m-%d'),
            'spx': _safe_float(rw['spx'], 1),
            'bottom_score': _safe_float(rw['bottom_score'], 1),
            'top_score': _safe_float(rw['top_score'], 1),
            'vol_50y': _safe_float(rw['vol_50y'], 1),
            'yc': _safe_float(rw['yc'], 2),
            'ext200': _safe_float(rw['ext200'], 1),
            'coppock': _safe_float(rw['coppock'], 1),
        })

    # Recent 252 daily rows for Command tab integration
    rec_df = df50.iloc[-252:]
    recent_252d = []
    for dt_r, rr in rec_df.iterrows():
        recent_252d.append({
            'date': dt_r.strftime('%Y-%m-%d'),
            'spx': _safe_float(rr['spx'], 2),
            'bottom_score': _safe_float(rr['bottom_score'], 1),
            'top_score': _safe_float(rr['top_score'], 1),
            'bottom_stage1': bool(rr['bottom_stage1']),
            'bottom_confirmed': bool(rr['bottom_confirmed']),
            'top_stage1': bool(rr['top_stage1']),
            'top_confirmed': bool(rr['top_confirmed']),
        })

    now_et = datetime.now(timezone.utc) - timedelta(hours=5)
    payload = {
        'version': '3.0',
        'last_updated': now_et.strftime('%Y-%m-%d %H:%M:%S ET'),
        'trade_date': df50.index[-1].strftime('%Y-%m-%d'),
        'span_years': 50.0,
        'start_date': df50.index[0].strftime('%Y-%m-%d'),
        'end_date': df50.index[-1].strftime('%Y-%m-%d'),
        'trading_days': int(len(df50)),
        'current_verdict': {
            'phase_code': phase_code,
            'phase_label': phase_label,
            'phase_color': phase_color,
            'bottom_score': _safe_float(b_now, 1),
            'top_score': _safe_float(t_now, 1),
            'net_cycle_bias': _safe_float(b_now - t_now, 1),
            'headline': headline,
            'action_summary': action_summary,
            'spx': _safe_float(curr_row['spx'], 2),
            'dd252': _safe_float(curr_row['dd252'], 1),
            'ext200': _safe_float(curr_row['ext200'], 1),
            'vol_50y': _safe_float(curr_row['vol_50y'], 2),
            'vol_z': _safe_float(curr_row['vol_z'], 2),
            'rsi14': _safe_float(curr_row['rsi14'], 1),
            'w_rsi14': _safe_float(curr_row['w_rsi14'], 1),
            'coppock': _safe_float(curr_row['coppock'], 1),
            'yc': _safe_float(curr_row['yc'], 2),
            'percentiles_50y': percentiles_50y,
            'bottom_pillars': bottom_pillars,
            'top_pillars': top_pillars,
            'confirmation_checklist': confirmation_checklist,
        },
        'empirical_stats': empirical_stats,
        'nearest_analogs': nearest_analogs,
        'bottom_signals': bottom_signals,
        'top_signals': top_signals,
        'series_50y_weekly': series_50y_weekly,
        'recent_252d': recent_252d,
    }

    payload = _sanitize_json(payload)
    os.makedirs(os.path.dirname(PUBLIC_50Y_PATH), exist_ok=True)
    tmp_path = f"{PUBLIC_50Y_PATH}.tmp.{os.getpid()}"
    with open(tmp_path, 'w') as f:
        json.dump(payload, f, allow_nan=False)
    os.replace(tmp_path, PUBLIC_50Y_PATH)
    print(f"[50Y Engine] Generated {PUBLIC_50Y_PATH} ({len(df50)} daily rows, {len(series_50y_weekly)} weekly rows)")
    return payload


if __name__ == '__main__':
    res = generate_market_cycle_50y_json(force_refresh=True)
    print('Verdict:', res['current_verdict']['phase_code'], res['current_verdict']['bottom_score'], res['current_verdict']['top_score'])
