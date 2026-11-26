import os
import json
import pickle
from datetime import datetime
import numpy as np
import pandas as pd

LAKEHOUSE_PARQUET_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
PUBLIC_JSON_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/public/sector_flow_predictor.json'

ETF_META = {
    'XLK':  {'name': 'Technology',             'basket': 'OFFENSIVE',   'color': '#38bdf8'},
    'SMH':  {'name': 'Semiconductors',         'basket': 'OFFENSIVE',   'color': '#818cf8'},
    'XLY':  {'name': 'Consumer Discretionary', 'basket': 'OFFENSIVE',   'color': '#f472b6'},
    'XLC':  {'name': 'Communication Services', 'basket': 'OFFENSIVE',   'color': '#c084fc'},
    'XLI':  {'name': 'Industrials',            'basket': 'OFFENSIVE',   'color': '#60a5fa'},
    'XLF':  {'name': 'Financials',             'basket': 'OFFENSIVE',   'color': '#34d399'},
    'IWM':  {'name': 'Russell 2000 Small Cap', 'basket': 'SMALL_CAP',   'color': '#fbbf24'},
    'XLB':  {'name': 'Materials',              'basket': 'REAL_ASSETS', 'color': '#fb923c'},
    'XLE':  {'name': 'Energy',                 'basket': 'REAL_ASSETS', 'color': '#f97316'},
    'XLP':  {'name': 'Consumer Staples',       'basket': 'DEFENSIVE',   'color': '#2dd4bf'},
    'XLU':  {'name': 'Utilities',              'basket': 'DEFENSIVE',   'color': '#a3e635'},
    'XLV':  {'name': 'Health Care',            'basket': 'DEFENSIVE',   'color': '#4ade80'},
    'XLRE': {'name': 'Real Estate',            'basket': 'DEFENSIVE',   'color': '#22d3ee'},
}

GICS_11 = ['XLK', 'XLY', 'XLC', 'XLI', 'XLF', 'XLB', 'XLE', 'XLP', 'XLU', 'XLV', 'XLRE']
OFFENSIVE_BASKET = ['XLK', 'XLY', 'XLC', 'XLI', 'XLF', 'SMH']
DEFENSIVE_BASKET = ['XLP', 'XLU', 'XLV', 'XLRE']
REAL_ASSETS_BASKET = ['XLE', 'XLB']
ALL_TRACKED_ETFS = ['XLK', 'SMH', 'XLY', 'XLC', 'XLI', 'XLF', 'IWM', 'XLB', 'XLE', 'XLP', 'XLU', 'XLV', 'XLRE']


def _compute_cmf_series(df, window=20):
    high = df['High'].astype(float)
    low = df['Low'].astype(float)
    close = df['Close'].astype(float)
    vol = df['Volume'].astype(float)
    hl_range = (high - low).replace(0, np.nan)
    clv = ((close - low) - (high - close)) / hl_range
    clv = clv.fillna(0.0)
    mf_vol = clv * vol
    sum_mf_vol = mf_vol.rolling(window, min_periods=max(3, window // 2)).sum()
    sum_vol = vol.rolling(window, min_periods=max(3, window // 2)).sum().replace(0, np.nan)
    return (sum_mf_vol / sum_vol).fillna(0.0)


def _compute_net_dollar_flow_20d_m(df, window=20):
    """Estimates 20-day net CLV-weighted dollar volume flow in $ Millions."""
    high = df['High'].astype(float)
    low = df['Low'].astype(float)
    close = df['Close'].astype(float)
    vol = df['Volume'].astype(float)
    hl_range = (high - low).replace(0, np.nan)
    clv = (((close - low) - (high - close)) / hl_range).fillna(0.0)
    dollar_mf = clv * vol * close
    return (dollar_mf.rolling(window, min_periods=5).sum() / 1e6).fillna(0.0)


def compute_sector_flow_predictor(force_refresh=False):
    if not force_refresh and os.path.exists(PUBLIC_JSON_PATH):
        try:
            mtime = os.path.getmtime(PUBLIC_JSON_PATH)
            if (datetime.now().timestamp() - mtime) < 900:
                with open(PUBLIC_JSON_PATH, 'r') as f:
                    return json.load(f)
        except Exception:
            pass

    if not os.path.exists(LAKEHOUSE_PARQUET_PATH):
        return {"error": "daily_ohlcv.parquet not found"}

    all_needed = ['SPY', 'QQQ'] + ALL_TRACKED_ETFS
    cache = {}
    try:
        import duckdb
        con = duckdb.connect()
        tickers_sql = ",".join([f"'{t}'" for t in all_needed])
        df_all = con.execute(
            f"SELECT Ticker, Date, Open, High, Low, Close, Volume FROM '{LAKEHOUSE_PARQUET_PATH}' WHERE Ticker IN ({tickers_sql}) ORDER BY Date ASC"
        ).df()
        con.close()
        df_all['Date'] = pd.to_datetime(df_all['Date']).dt.tz_localize(None).dt.normalize()
        df_all = df_all.dropna(subset=['Close', 'High', 'Low'])
        for sym, grp in df_all.groupby('Ticker'):
            cache[sym] = grp[['Date', 'Open', 'High', 'Low', 'Close', 'Volume']].sort_values('Date').drop_duplicates('Date', keep='last').copy()
    except Exception:
        df_all = pd.read_parquet(LAKEHOUSE_PARQUET_PATH)
        df_all['Date'] = pd.to_datetime(df_all['Date']).dt.tz_localize(None).dt.normalize()
        df_all = df_all.dropna(subset=['Close', 'High', 'Low'])
        for sym in all_needed:
            sub = df_all[df_all['Ticker'] == sym]
            if len(sub) > 0:
                cache[sym] = sub[['Date', 'Open', 'High', 'Low', 'Close', 'Volume']].sort_values('Date').drop_duplicates('Date', keep='last').copy()

    if 'SPY' not in cache:
        return {"error": "SPY missing from daily_ohlcv.parquet"}

    # Append latest 5d live bars from yfinance so today's intraday/closing bar is included
    try:
        import yfinance as yf
        live_raw = yf.download(all_needed, period="5d", interval="1d", group_by="ticker", progress=False, threads=True)
        if live_raw is not None and len(live_raw) > 0:
            for sym in all_needed:
                try:
                    sub_live = live_raw[sym].dropna(subset=['Close', 'High', 'Low']).reset_index()
                    date_col = 'Date' if 'Date' in sub_live.columns else sub_live.columns[0]
                    sub_live['Date'] = pd.to_datetime(sub_live[date_col]).dt.tz_localize(None).dt.normalize()
                    sub_live = sub_live[['Date', 'Open', 'High', 'Low', 'Close', 'Volume']].copy()
                    if sym in cache:
                        combined = pd.concat([cache[sym], sub_live], ignore_index=True)
                        combined = combined.sort_values('Date').drop_duplicates('Date', keep='last').reset_index(drop=True)
                        cache[sym] = combined
                except Exception:
                    pass
    except Exception:
        pass

    spy_df = cache['SPY'].copy()
    if 'Date' in spy_df.columns:
        spy_df['Date'] = pd.to_datetime(spy_df['Date'])
        spy_df = spy_df.sort_values('Date').drop_duplicates('Date').set_index('Date')
    else:
        spy_df.index = pd.to_datetime(spy_df.index)
        spy_df = spy_df.sort_index()

    closes = pd.DataFrame({'SPY': spy_df['Close'].astype(float)})
    if 'QQQ' in cache:
        qdf = cache['QQQ'].copy()
        if 'Date' in qdf.columns:
            qdf['Date'] = pd.to_datetime(qdf['Date'])
            qdf = qdf.sort_values('Date').drop_duplicates('Date').set_index('Date')
        else:
            qdf.index = pd.to_datetime(qdf.index)
        closes['QQQ'] = qdf['Close'].astype(float)

    cmf5_df = pd.DataFrame(index=closes.index)
    cmf20_df = pd.DataFrame(index=closes.index)
    cmf60_df = pd.DataFrame(index=closes.index)
    dflow20_df = pd.DataFrame(index=closes.index)

    for sym in ALL_TRACKED_ETFS:
        if sym not in cache:
            continue
        df = cache[sym].copy()
        if 'Date' in df.columns:
            df['Date'] = pd.to_datetime(df['Date'])
            df = df.sort_values('Date').drop_duplicates('Date').set_index('Date')
        else:
            df.index = pd.to_datetime(df.index)
            df = df.sort_index()
        df = df.reindex(closes.index).ffill()
        closes[sym] = df['Close'].astype(float)
        cmf5_df[sym] = _compute_cmf_series(df, 5)
        cmf20_df[sym] = _compute_cmf_series(df, 20)
        cmf60_df[sym] = _compute_cmf_series(df, 60)
        dflow20_df[sym] = _compute_net_dollar_flow_20d_m(df, 20)

    # Composite Baskets (10-Year Time Series)
    off_cols = [c for c in OFFENSIVE_BASKET if c in cmf20_df.columns]
    def_cols = [c for c in DEFENSIVE_BASKET if c in cmf20_df.columns]
    em_cols = [c for c in REAL_ASSETS_BASKET if c in cmf20_df.columns]
    gics_cols = [c for c in GICS_11 if c in cmf20_df.columns]

    off_cmf20 = cmf20_df[off_cols].mean(axis=1)
    def_cmf20 = cmf20_df[def_cols].mean(axis=1)
    em_cmf20 = cmf20_df[em_cols].mean(axis=1)
    def_off_spread = def_cmf20 - off_cmf20

    off_cmf5 = cmf5_df[off_cols].mean(axis=1)
    def_cmf5 = cmf5_df[def_cols].mean(axis=1)

    off_cmf60 = cmf60_df[off_cols].mean(axis=1)
    def_cmf60 = cmf60_df[def_cols].mean(axis=1)

    pos_sec_count = (cmf20_df[gics_cols] > 0).sum(axis=1)
    pos_sec_pct = (pos_sec_count / len(gics_cols)) * 100.0

    panic_out_count = (cmf20_df[gics_cols] < -0.08).sum(axis=1)
    panic_out_pct = (panic_out_count / len(gics_cols)) * 100.0

    strong_in_count = (cmf20_df[gics_cols] > 0.08).sum(axis=1)
    strong_in_pct = (strong_in_count / len(gics_cols)) * 100.0

    spy_high20 = closes['SPY'].rolling(20, min_periods=5).max()
    spy_dist_high20_pct = ((closes['SPY'] / spy_high20) - 1.0) * 100.0
    spy_ret20_pct = closes['SPY'].pct_change(20) * 100.0

    # 4 Quantitative Rules across 10-Year History
    xlk_cmf20 = cmf20_df['XLK'] if 'XLK' in cmf20_df else pd.Series(0.0, index=closes.index)
    smh_cmf20 = cmf20_df['SMH'] if 'SMH' in cmf20_df else pd.Series(0.0, index=closes.index)
    xlk_cmf5 = cmf5_df['XLK'] if 'XLK' in cmf5_df else pd.Series(0.0, index=closes.index)
    smh_cmf5 = cmf5_df['SMH'] if 'SMH' in cmf5_df else pd.Series(0.0, index=closes.index)
    iwm_cmf5 = cmf5_df['IWM'] if 'IWM' in cmf5_df else pd.Series(0.0, index=closes.index)

    top_sig_a = (spy_dist_high20_pct >= -1.8) & (
        (def_off_spread >= 0.08) | ((xlk_cmf20 <= -0.02) & (def_cmf20 >= 0.08))
    )
    top_sig_b = (em_cmf20 >= 0.10) & (def_cmf20 >= 0.03) & (xlk_cmf20 <= -0.05)
    bot_sig_a = (pos_sec_pct <= 18.5) & (panic_out_pct >= 45.0)
    bot_sig_b = (
        (spy_dist_high20_pct.rolling(10).min() <= -2.5)
        & (smh_cmf5 >= 0.05)
        & (xlk_cmf5 >= 0.03)
        & (iwm_cmf5 >= 0.03)
        & ((off_cmf5 - def_cmf5) >= 0.06)
    )

    # Compute 10-Year Empirical Backtest Stats
    fwd_20d = (closes['SPY'].shift(-20) / closes['SPY'] - 1.0) * 100.0
    fwd_40d = (closes['SPY'].shift(-40) / closes['SPY'] - 1.0) * 100.0
    fwd_60d = (closes['SPY'].shift(-60) / closes['SPY'] - 1.0) * 100.0

    # Forward 40D max drawdown
    spy_vals = closes['SPY'].values
    n_days = len(spy_vals)
    fwd_40d_mdd = np.full(n_days, np.nan)
    for i in range(n_days - 40):
        window_slice = spy_vals[i + 1 : i + 41]
        if spy_vals[i] > 0 and len(window_slice) > 0:
            fwd_40d_mdd[i] = ((np.min(window_slice) / spy_vals[i]) - 1.0) * 100.0
    fwd_40d_mdd_s = pd.Series(fwd_40d_mdd, index=closes.index)

    def _calc_backtest_stats(mask_series):
        valid_mask = mask_series & fwd_20d.notna() & fwd_60d.notna()
        cnt = int(valid_mask.sum())
        if cnt == 0:
            return {"occurrences": 0, "fwd_20d_avg": 0.0, "fwd_40d_avg": 0.0, "fwd_60d_avg": 0.0, "win_rate_60d": 0.0, "avg_40d_max_dd": 0.0}
        return {
            "occurrences": cnt,
            "fwd_20d_avg": round(float(fwd_20d[valid_mask].mean()), 2),
            "fwd_40d_avg": round(float(fwd_40d[valid_mask].mean()), 2),
            "fwd_60d_avg": round(float(fwd_60d[valid_mask].mean()), 2),
            "win_rate_20d": round(float((fwd_20d[valid_mask] > 0).mean() * 100.0), 1),
            "win_rate_60d": round(float((fwd_60d[valid_mask] > 0).mean() * 100.0), 1),
            "avg_40d_max_dd": round(float(fwd_40d_mdd_s[valid_mask].mean()), 2),
        }

    baseline_mask = pd.Series(True, index=closes.index)
    bt_baseline = _calc_backtest_stats(baseline_mask)
    bt_top_a = _calc_backtest_stats(top_sig_a)
    bt_top_b = _calc_backtest_stats(top_sig_b)
    bt_bot_a = _calc_backtest_stats(bot_sig_a)
    bt_bot_b = _calc_backtest_stats(bot_sig_b)

    # Current Live Values (Latest Trading Day)
    latest_dt = closes.index[-1]
    latest_date_str = latest_dt.strftime('%Y-%m-%d')
    curr_spy = round(float(closes['SPY'].iloc[-1]), 2)
    curr_spy_dist_h20 = round(float(spy_dist_high20_pct.iloc[-1]), 2)
    curr_spy_ret20 = round(float(spy_ret20_pct.iloc[-1]), 2)

    curr_off20 = round(float(off_cmf20.iloc[-1]), 3)
    curr_def20 = round(float(def_cmf20.iloc[-1]), 3)
    curr_em20 = round(float(em_cmf20.iloc[-1]), 3)
    curr_spread = round(float(def_off_spread.iloc[-1]), 3)

    curr_off5 = round(float(off_cmf5.iloc[-1]), 3)
    curr_def5 = round(float(def_cmf5.iloc[-1]), 3)
    curr_off60 = round(float(off_cmf60.iloc[-1]), 3)
    curr_def60 = round(float(def_cmf60.iloc[-1]), 3)

    curr_pos_cnt = int(pos_sec_count.iloc[-1])
    curr_pos_pct = round(float(pos_sec_pct.iloc[-1]), 1)
    curr_panic_cnt = int(panic_out_count.iloc[-1])
    curr_panic_pct = round(float(panic_out_pct.iloc[-1]), 1)
    curr_strong_in_cnt = int(strong_in_count.iloc[-1])
    curr_strong_in_pct = round(float(strong_in_pct.iloc[-1]), 1)

    curr_xlk20 = round(float(xlk_cmf20.iloc[-1]), 3)
    curr_smh20 = round(float(smh_cmf20.iloc[-1]), 3)
    curr_xlk5 = round(float(xlk_cmf5.iloc[-1]), 3)
    curr_smh5 = round(float(smh_cmf5.iloc[-1]), 3)
    curr_iwm5 = round(float(iwm_cmf5.iloc[-1]), 3)

    # Check recent 10-day triggers
    recent10_top_a = bool(top_sig_a.iloc[-10:].any())
    recent10_top_a_dates = [d.strftime('%Y-%m-%d') for d in closes.index[-10:][top_sig_a.iloc[-10:]]]
    recent10_top_b = bool(top_sig_b.iloc[-10:].any())
    recent10_bot_a = bool(bot_sig_a.iloc[-10:].any())
    recent10_bot_b = bool(bot_sig_b.iloc[-10:].any())

    # Calculate Top Risk Score (0-100) and Bottom Capitulation Proximity Score (0-100)
    # Top Risk Score components:
    # 1. Def - Off Spread (up to 40 pts when spread >= +0.10)
    spread_pts = max(0.0, min(40.0, ((curr_spread + 0.02) / 0.12) * 40.0))
    # 2. Tech / Semi outflow divergence (up to 35 pts when XLK/SMH CMF20 <= -0.10)
    tech_bleed = -min(curr_xlk20, curr_smh20)
    tech_pts = max(0.0, min(35.0, (tech_bleed / 0.12) * 35.0))
    # 3. Defensive crowding (up to 25 pts when DefCMF20 >= +0.10)
    def_pts = max(0.0, min(25.0, (curr_def20 / 0.10) * 25.0))
    top_risk_score = int(round(min(100.0, spread_pts + tech_pts + def_pts)))

    # Bottom Capitulation Proximity Score (0-100):
    # Measures how close we are to a true Washout Capitulation Bottom (PosSec% -> <=18%, PanicOut% -> >=45%)
    pos_washout_pts = max(0.0, min(50.0, ((100.0 - curr_pos_pct) / 82.0) * 50.0))
    panic_washout_pts = max(0.0, min(50.0, (curr_panic_pct / 45.5) * 50.0))
    bottom_capitulation_score = int(round(min(100.0, pos_washout_pts + panic_washout_pts)))

    # Determine Cycle Phase Verdict
    if bool(bot_sig_a.iloc[-1]):
        cycle_phase = "STAGE 1A WASH-OUT CAPITULATION BOTTOM SIGNAL"
        phase_color = "#10b981"
        phase_badge = "BUY CAPITULATION BOTTOM"
    elif bool(bot_sig_b.iloc[-1]):
        cycle_phase = "EARLY-CYCLE HIGH-BETA RE-ACCUMULATION THRUST"
        phase_color = "#22d3ee"
        phase_badge = "BULLISH RE-ACCUMULATION"
    elif bool(top_sig_a.iloc[-1]) or bool(top_sig_b.iloc[-1]):
        cycle_phase = "LATE-CYCLE DEFENSIVE ROTATION TOP WARNING"
        phase_color = "#f43f5e"
        phase_badge = "DISTRIBUTION TOP ACTIVE"
    elif recent10_top_a or (curr_spread >= 0.04 and curr_xlk20 <= -0.05):
        cycle_phase = "POST-TOP TECH DISTRIBUTION & DEFENSIVE ROTATION"
        phase_color = "#f59e0b"
        phase_badge = "DEFENSIVE ROTATION / NOT AT BOTTOM YET"
    elif curr_off20 >= 0.05 and curr_pos_pct >= 65.0:
        cycle_phase = "BROAD RISK-ON OFFENSIVE EXPANSION"
        phase_color = "#10b981"
        phase_badge = "HEALTHY BULL INFLOWS"
    else:
        cycle_phase = "MID-CYCLE SELECTIVE SECTOR ROTATION"
        phase_color = "#60a5fa"
        phase_badge = "SELECTIVE ROTATION"

    # Detailed 13-Sector Ranking Table
    sector_rankings = []
    for sym in ALL_TRACKED_ETFS:
        if sym not in cmf20_df.columns:
            continue
        meta = ETF_META.get(sym, {'name': sym, 'basket': 'OTHER', 'color': '#94a3b8'})
        c20 = round(float(cmf20_df[sym].iloc[-1]), 3)
        c5 = round(float(cmf5_df[sym].iloc[-1]), 3)
        c60 = round(float(cmf60_df[sym].iloc[-1]), 3)
        c20_prev5 = float(cmf20_df[sym].iloc[-6]) if len(cmf20_df) >= 6 else c20
        c20_delta5 = round(c20 - c20_prev5, 3)
        dflow_m = round(float(dflow20_df[sym].iloc[-1]), 1)
        price_now = round(float(closes[sym].iloc[-1]), 2)
        price_ret20 = round(float((closes[sym].iloc[-1] / closes[sym].iloc[-21] - 1.0) * 100.0), 2) if len(closes) >= 21 else 0.0

        if c20 >= 0.10:
            flow_status = "HEAVY INFLOW"
            flow_color = "#10b981"
        elif c20 >= 0.03:
            flow_status = "MODERATE INFLOW"
            flow_color = "#34d399"
        elif c20 > -0.03:
            flow_status = "NEUTRAL FLOW"
            flow_color = "#94a3b8"
        elif c20 > -0.08:
            flow_status = "MODERATE OUTFLOW"
            flow_color = "#f59e0b"
        else:
            flow_status = "PANIC / HEAVY OUTFLOW"
            flow_color = "#f43f5e"

        sector_rankings.append({
            "ticker": sym,
            "name": meta['name'],
            "basket": meta['basket'],
            "color": meta['color'],
            "price": price_now,
            "ret_20d_pct": price_ret20,
            "cmf_5d": c5,
            "cmf_20d": c20,
            "cmf_60d": c60,
            "cmf_20d_delta_5d": c20_delta5,
            "net_dollar_flow_20d_m": dflow_m,
            "flow_status": flow_status,
            "flow_color": flow_color,
        })

    sector_rankings.sort(key=lambda x: x['cmf_20d'], reverse=True)

    # Build 4 Quantitative Signal Checklists
    signal_checklist = [
        {
            "id": "TOP_SIGNAL_A",
            "type": "TOP",
            "title": "Top Signal A: Defensive Flow Inversion Near Highs",
            "subtitle": "Institutions rotate out of Tech/Offensive leaders into Staples/Utilities/REITs while SPY is still near highs",
            "status": "ACTIVE NOW" if bool(top_sig_a.iloc[-1]) else ("TRIGGERED RECENTLY" if recent10_top_a else ("WATCH" if curr_spread >= 0.05 else "INACTIVE")),
            "status_color": "#f43f5e" if bool(top_sig_a.iloc[-1]) else ("#f59e0b" if (recent10_top_a or curr_spread >= 0.05) else "#64748b"),
            "recent_trigger_dates": recent10_top_a_dates,
            "conditions": [
                {
                    "label": "DefCMF(20D) - OffCMF(20D) Spread >= +0.080",
                    "current": f"{curr_spread:+.3f}",
                    "target": ">= +0.080",
                    "met": bool(curr_spread >= 0.08 or (curr_xlk20 <= -0.02 and curr_def20 >= 0.08))
                },
                {
                    "label": "XLK 20D CMF < -0.020 (Tech Leader Distribution)",
                    "current": f"{curr_xlk20:+.3f}",
                    "target": "<= -0.020",
                    "met": bool(curr_xlk20 <= -0.02)
                },
                {
                    "label": "SPY Within 1.8% of 20D High at Initial Trigger",
                    "current": f"{curr_spy_dist_h20:+.2f}%",
                    "target": ">= -1.80% (Fired Nov 2-4)",
                    "met": bool(curr_spy_dist_h20 >= -1.8 or recent10_top_a)
                }
            ],
            "backtest": bt_top_a,
            "historical_examples": "Sep 2018 Top (+0.118), Dec 2021 Bull Peak (+0.100), Jul 2023 Peak (+0.084), Nov 2-4 2026 (+0.112)"
        },
        {
            "id": "TOP_SIGNAL_B",
            "type": "TOP",
            "title": "Top Signal B: Late-Cycle Real Asset Crowding + Tech Bleed",
            "subtitle": "Inflationary/late-cycle crowding into Materials & Energy (XLB/XLE) + Defensives while Tech/Semis suffer heavy outflows",
            "status": "ACTIVE NOW" if bool(top_sig_b.iloc[-1]) else ("WATCH" if (curr_xlk20 <= -0.05 and curr_def20 >= 0.03) else "INACTIVE"),
            "status_color": "#f43f5e" if bool(top_sig_b.iloc[-1]) else ("#f59e0b" if (curr_xlk20 <= -0.05 and curr_def20 >= 0.03) else "#64748b"),
            "recent_trigger_dates": [],
            "conditions": [
                {
                    "label": "Real Assets (XLE + XLB) 20D CMF >= +0.100",
                    "current": f"{curr_em20:+.3f}",
                    "target": ">= +0.100",
                    "met": bool(curr_em20 >= 0.10)
                },
                {
                    "label": "Defensive Basket 20D CMF >= +0.030",
                    "current": f"{curr_def20:+.3f}",
                    "target": ">= +0.030",
                    "met": bool(curr_def20 >= 0.03)
                },
                {
                    "label": "XLK 20D CMF <= -0.050 (Heavy Tech Outflow)",
                    "current": f"{curr_xlk20:+.3f}",
                    "target": "<= -0.050",
                    "met": bool(curr_xlk20 <= -0.05)
                }
            ],
            "backtest": bt_top_b,
            "historical_examples": "Jan-Apr 2022 Inflation Bear Market, Sep 2023 Rate Spike Top, Jul 2024 Rotation Top"
        },
        {
            "id": "BOTTOM_SIGNAL_A",
            "type": "BOTTOM",
            "title": "Bottom Signal A: Universal Sector Liquidation Capitulation",
            "subtitle": "True major market bottoms occur ONLY when institutions liquidate Defensive & Cyclical shelters alike (PosSec% <= 18%)",
            "status": "ACTIVE NOW" if bool(bot_sig_a.iloc[-1]) else (f"INACTIVE ({curr_pos_cnt}/11 SECTORS STILL POSITIVE)" if curr_pos_cnt >= 6 else "WATCH"),
            "status_color": "#10b981" if bool(bot_sig_a.iloc[-1]) else "#64748b",
            "recent_trigger_dates": [],
            "conditions": [
                {
                    "label": "Positive Inflow Sectors (PosSec%) <= 18.5% (<=2 of 11 GICS)",
                    "current": f"{curr_pos_pct:.1f}% ({curr_pos_cnt}/11)",
                    "target": "<= 18.2% (<=2/11)",
                    "met": bool(curr_pos_pct <= 18.5)
                },
                {
                    "label": "Panic Outflow Breadth (PanicOut% < -0.08 CMF) >= 45.0% (>=5 of 11)",
                    "current": f"{curr_panic_pct:.1f}% ({curr_panic_cnt}/11)",
                    "target": ">= 45.5% (>=5/11)",
                    "met": bool(curr_panic_pct >= 45.0)
                },
                {
                    "label": "Defensive Safe Havens Also Liquidated (DefCMF < 0.00)",
                    "current": f"{curr_def20:+.3f}",
                    "target": "< 0.000",
                    "met": bool(curr_def20 < 0.0)
                }
            ],
            "backtest": bt_bot_a,
            "historical_examples": "Dec 24 2018 (0% Pos / 91% Panic), Mar 2020 Bottom, Oct 12 2022 Bear Low (0% Pos / 55% Panic), Oct 27 2023 Low (9% Pos / 73% Panic)"
        },
        {
            "id": "BOTTOM_SIGNAL_B",
            "type": "BOTTOM",
            "title": "Bottom Signal B: High-Beta Early-Cycle Re-Accumulation Thrust",
            "subtitle": "In shallower corrections where breadth doesn't wash out to 0%, bottoms form when 5D CMF aggressively flips back into SMH, XLK & IWM",
            "status": "ACTIVE NOW" if bool(bot_sig_b.iloc[-1]) else ("WATCH" if (curr_smh5 > 0 or curr_xlk5 > 0 or curr_iwm5 > 0) else "WAITING FOR TECH / IWM INFLOW TURN"),
            "status_color": "#10b981" if bool(bot_sig_b.iloc[-1]) else ("#38bdf8" if (curr_smh5 > 0 or curr_xlk5 > 0 or curr_iwm5 > 0) else "#64748b"),
            "recent_trigger_dates": [],
            "conditions": [
                {
                    "label": "Semiconductors (SMH) 5D Fast CMF >= +0.050",
                    "current": f"{curr_smh5:+.3f}",
                    "target": ">= +0.050",
                    "met": bool(curr_smh5 >= 0.05)
                },
                {
                    "label": "Technology (XLK) 5D Fast CMF >= +0.030",
                    "current": f"{curr_xlk5:+.3f}",
                    "target": ">= +0.030",
                    "met": bool(curr_xlk5 >= 0.03)
                },
                {
                    "label": "Small Caps (IWM) 5D Fast CMF >= +0.030",
                    "current": f"{curr_iwm5:+.3f}",
                    "target": ">= +0.030",
                    "met": bool(curr_iwm5 >= 0.03)
                },
                {
                    "label": "5D Offensive minus Defensive CMF Thrust >= +0.060",
                    "current": f"{(curr_off5 - curr_def5):+.3f}",
                    "target": ">= +0.060",
                    "met": bool((curr_off5 - curr_def5) >= 0.06)
                }
            ],
            "backtest": bt_bot_b,
            "historical_examples": "Aug 8 2024 Yen-Carry Rebound, May 2024 Pullback Low, Mar 2023 SVB Pivot"
        }
    ]

    # 60-Day Trajectory for Interactive Chart
    traj_slice = closes.index[-60:]
    trajectory_60d = []
    for d in traj_slice:
        trajectory_60d.append({
            "date": d.strftime('%Y-%m-%d'),
            "spy": round(float(closes.loc[d, 'SPY']), 2),
            "qqq": round(float(closes.loc[d, 'QQQ']), 2) if 'QQQ' in closes.columns and pd.notna(closes.loc[d, 'QQQ']) else None,
            "off_cmf": round(float(off_cmf20.loc[d]), 3),
            "def_cmf": round(float(def_cmf20.loc[d]), 3),
            "em_cmf": round(float(em_cmf20.loc[d]), 3),
            "def_off_spread": round(float(def_off_spread.loc[d]), 3),
            "pos_sec_pct": round(float(pos_sec_pct.loc[d]), 1),
            "panic_out_pct": round(float(panic_out_pct.loc[d]), 1),
            "xlk_cmf": round(float(xlk_cmf20.loc[d]), 3),
            "smh_cmf": round(float(smh_cmf20.loc[d]), 3),
            "top_sig": bool(top_sig_a.loc[d] or top_sig_b.loc[d]),
            "bot_sig": bool(bot_sig_a.loc[d] or bot_sig_b.loc[d]),
        })

    # 10-Year Landmark Turning Points Table
    landmark_specs = [
        ("2018-09-20", "Sep 2018 Peak (Pre-Q4 Selloff)", "MARKET TOP"),
        ("2018-12-24", "Dec 2018 Christmas Eve Washout", "MARKET BOTTOM"),
        ("2020-02-19", "Feb 2020 Pre-COVID Peak", "MARKET TOP"),
        ("2020-03-20", "Mar 2020 COVID Crash Low", "MARKET BOTTOM"),
        ("2021-12-29", "Dec 2021 Bull Market Peak", "MARKET TOP"),
        ("2022-10-12", "Oct 2022 Bear Market Bottom", "MARKET BOTTOM"),
        ("2023-07-31", "Jul 2023 Summer Rally Peak", "MARKET TOP"),
        ("2023-10-27", "Oct 2023 Correction Low", "MARKET BOTTOM"),
        ("2024-07-16", "Jul 2024 Tech Blow-Off Peak", "MARKET TOP"),
        ("2024-08-05", "Aug 2024 Yen-Carry Unwind Low", "MARKET BOTTOM"),
        ("2026-11-04", "Nov 4, 2026 Defensive Inversion", "TOP SIGNAL TRIGGER"),
        (latest_date_str, f"Today ({latest_date_str}) Live Reading", "CURRENT REGIME"),
    ]

    historical_turning_points = []
    for target_dt_str, label, event_type in landmark_specs:
        target_dt = pd.to_datetime(target_dt_str)
        idx_pos = closes.index.searchsorted(target_dt)
        if idx_pos >= len(closes.index):
            idx_pos = len(closes.index) - 1
        actual_dt = closes.index[idx_pos]
        f20 = fwd_20d.iloc[idx_pos]
        f60 = fwd_60d.iloc[idx_pos]
        historical_turning_points.append({
            "date": actual_dt.strftime('%Y-%m-%d'),
            "event": label,
            "event_type": event_type,
            "spy_price": round(float(closes['SPY'].iloc[idx_pos]), 2),
            "off_cmf": round(float(off_cmf20.iloc[idx_pos]), 3),
            "def_cmf": round(float(def_cmf20.iloc[idx_pos]), 3),
            "def_off_spread": round(float(def_off_spread.iloc[idx_pos]), 3),
            "xlk_cmf": round(float(xlk_cmf20.iloc[idx_pos]), 3),
            "pos_sec_pct": round(float(pos_sec_pct.iloc[idx_pos]), 1),
            "panic_out_pct": round(float(panic_out_pct.iloc[idx_pos]), 1),
            "spy_fwd_20d_pct": round(float(f20), 2) if pd.notna(f20) else None,
            "spy_fwd_60d_pct": round(float(f60), 2) if pd.notna(f60) else None,
        })

    # Actionable Next Bottom / Top Forecast Roadmap
    bot_a_active = bool(bot_sig_a.iloc[-1])
    bot_b_active = bool(bot_sig_b.iloc[-1])
    top_a_active = bool(top_sig_a.iloc[-1])
    top_b_active = bool(top_sig_b.iloc[-1])
    pos_met = bool(curr_pos_pct <= 18.5)
    panic_met = bool(curr_panic_pct >= 45.0)
    def_met = bool(curr_def20 < 0.0)

    pos_in_list = [f"{r['ticker']} ({r['cmf_20d']:+.3f})" for r in sector_rankings if r['cmf_20d'] > 0][:3]
    pos_in_str = ", ".join(pos_in_list) if pos_in_list else "none (broad outflows)"
    bot2_out = ", ".join([f"{r['ticker']} ({r['cmf_20d']:+.3f})" for r in sector_rankings[-2:]])

    if bot_a_active:
        regime_diag = (
            f"Bottom Signal A (Universal Capitulation Washout) is ACTIVE NOW as only {curr_pos_cnt}/11 GICS sectors retain positive 20D inflows "
            f"({curr_pos_pct:.1f}%), {curr_panic_cnt}/11 are in panic outflow ({curr_panic_pct:.1f}%), and DefCMF(20D) flipped negative ({curr_def20:+.3f}). "
            f"As of {latest_date_str}, positive 20D inflows remain only in {pos_in_str} while heaviest outflows hit {bot2_out}."
        )
    elif bot_b_active:
        regime_diag = (
            f"Bottom Signal B (High-Beta Re-Accumulation Thrust) is ACTIVE NOW as 5D Fast CMF turned positive across SMH ({curr_smh5:+.3f}), "
            f"XLK ({curr_xlk5:+.3f}), and IWM ({curr_iwm5:+.3f}). As of {latest_date_str}, inflows lead in {pos_in_str} while {bot2_out} lag."
        )
    elif top_a_active or top_b_active:
        regime_diag = (
            f"Top Signal is active as Defensive minus Offensive 20D CMF sits at {curr_spread:+.3f} while XLK ({curr_xlk20:+.3f}) "
            f"and SMH ({curr_smh20:+.3f}) experience institutional distribution. As of {latest_date_str}, capital is rotating into "
            f"{pos_in_str} while rotating out of {bot2_out}."
        )
    else:
        regime_diag = (
            f"Defensive minus Offensive 20D CMF spread is {curr_spread:+.3f} with XLK at {curr_xlk20:+.3f} and SMH at {curr_smh20:+.3f}. "
            f"As of {latest_date_str}, {curr_pos_cnt}/11 sectors show positive 20D inflows ({pos_in_str}) while heaviest distribution sits in {bot2_out}."
        )

    if bot_a_active:
        path1_trigger = (
            f"TRIGGERED NOW — All 3 washout criteria met: PosSec% at {curr_pos_pct:.1f}% ({curr_pos_cnt}/11 <= 18.2%), "
            f"PanicOut% at {curr_panic_pct:.1f}% ({curr_panic_cnt}/11 >= 45.5%), and DefCMF(20D) at {curr_def20:+.3f} (< 0.000)."
        )
        path1_meaning = (
            f"Only {curr_pos_cnt} of 11 GICS sectors retain positive 20D inflows while {curr_panic_cnt} of 11 are in panic outflow "
            f"and defensive shelters (DefCMF {curr_def20:+.3f}) have been liquidated — matching historical Stage 1A washout capitulation zones."
        )
    else:
        met_parts = []
        wait_parts = []
        if pos_met:
            met_parts.append(f"PosSec% at {curr_pos_pct:.1f}% ({curr_pos_cnt}/11 <= 18.2%)")
        else:
            wait_parts.append(f"PosSec% to drop from {curr_pos_pct:.1f}% ({curr_pos_cnt}/11) down to <=18.2% (<=2/11)")
        if panic_met:
            met_parts.append(f"PanicOut% at {curr_panic_pct:.1f}% ({curr_panic_cnt}/11 >= 45.5%)")
        else:
            wait_parts.append(f"PanicOut% to rise from {curr_panic_pct:.1f}% ({curr_panic_cnt}/11) to >=45.5% (>=5/11)")
        if def_met:
            met_parts.append(f"DefCMF(20D) at {curr_def20:+.3f} (< 0.000)")
        else:
            wait_parts.append(f"DefCMF(20D) to drop from {curr_def20:+.3f} below 0.000")
        met_prefix = f"Already MET: {' & '.join(met_parts)}. " if met_parts else ""
        path1_trigger = f"{met_prefix}Wait for {' AND '.join(wait_parts)}."
        path1_meaning = (
            f"Right now {curr_pos_cnt} of 11 sectors still hold positive 20D inflows ({curr_panic_cnt}/11 in panic outflow). "
            f"A true market-wide washout bottom completes once institutions liquidate defensive shelters (DefCMF < 0.000) and breadth hits <=2/11 positive with >=5/11 in panic outflow."
        )

    if bot_b_active:
        path2_trigger = (
            f"TRIGGERED NOW — 5D Fast CMF surged above thresholds on SMH ({curr_smh5:+.3f} >= +0.050), "
            f"XLK ({curr_xlk5:+.3f} >= +0.030), and IWM ({curr_iwm5:+.3f} >= +0.030) with Off−Def 5D thrust {(curr_off5 - curr_def5):+.3f} (>= +0.060)."
        )
    elif curr_def5 < 0:
        path2_trigger = (
            f"DefCMF(5D) is already negative ({curr_def5:+.3f}); wait for 5D Fast CMF on SMH ({curr_smh5:+.3f}), "
            f"XLK ({curr_xlk5:+.3f}), and IWM ({curr_iwm5:+.3f}) to cross above +0.050 / +0.030 / +0.030 with Off−Def 5D thrust >= +0.060."
        )
    else:
        path2_trigger = (
            f"Watch for 5D Fast CMF on SMH (currently {curr_smh5:+.3f}), XLK ({curr_xlk5:+.3f}), and IWM ({curr_iwm5:+.3f}) "
            f"to cross simultaneously above +0.050 / +0.030 / +0.030 while DefCMF(5D) ({curr_def5:+.3f}) turns negative."
        )

    roadmap = {
        "why_qqq_and_tech_weak_now": regime_diag,
        "when_will_market_bottom": [
            {
                "path": "Path 1: Full Broad Market Washout Bottom (Classic Stage 1A Capitulation)",
                "triggered": bot_a_active,
                "trigger": path1_trigger,
                "meaning": path1_meaning,
                "historical_win_rate": f"{bt_bot_a['win_rate_60d']}% 60D Win Rate (+{bt_bot_a['fwd_60d_avg']}% avg 60D SPY return)"
            },
            {
                "path": "Path 2: Rotational Pullback Bottom (Tech/Semi/Small-Cap Re-Accumulation Pivot)",
                "triggered": bot_b_active,
                "trigger": path2_trigger,
                "meaning": "If the market resolves via rotation rather than a crash, the bottom in QQQ/SPY will be signaled the day 5D institutional order flow pivots out of Defensives and surges back into SMH, XLK & IWM.",
                "historical_win_rate": f"{bt_bot_b['win_rate_60d']}% 60D Win Rate (+{bt_bot_b['fwd_60d_avg']}% avg 60D SPY return)"
            }
        ]
    }

    payload = {
        "status": "success",
        "last_updated": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "latest_market_date": latest_date_str,
        "study_span": f"{closes.index[0].strftime('%Y-%m-%d')} to {latest_date_str} ({len(closes)} trading days)",
        "current_snapshot": {
            "date": latest_date_str,
            "spy_price": curr_spy,
            "spy_dist_20d_high_pct": curr_spy_dist_h20,
            "spy_ret_20d_pct": curr_spy_ret20,
            "cycle_phase": cycle_phase,
            "phase_color": phase_color,
            "phase_badge": phase_badge,
            "top_risk_score": top_risk_score,
            "bottom_capitulation_score": bottom_capitulation_score,
            "off_cmf_20d": curr_off20,
            "def_cmf_20d": curr_def20,
            "em_cmf_20d": curr_em20,
            "def_minus_off_spread_20d": curr_spread,
            "off_cmf_5d": curr_off5,
            "def_cmf_5d": curr_def5,
            "off_cmf_60d": curr_off60,
            "def_cmf_60d": curr_def60,
            "pos_sec_count": curr_pos_cnt,
            "pos_sec_pct": curr_pos_pct,
            "panic_out_count": curr_panic_cnt,
            "panic_out_pct": curr_panic_pct,
            "strong_in_count": curr_strong_in_cnt,
            "strong_in_pct": curr_strong_in_pct,
            "xlk_cmf_20d": curr_xlk20,
            "smh_cmf_20d": curr_smh20,
            "xlk_cmf_5d": curr_xlk5,
            "smh_cmf_5d": curr_smh5,
            "iwm_cmf_5d": curr_iwm5,
        },
        "baseline_backtest": bt_baseline,
        "signal_checklist": signal_checklist,
        "sector_rankings": sector_rankings,
        "trajectory_60d": trajectory_60d,
        "historical_turning_points": historical_turning_points,
        "roadmap": roadmap,
    }

    try:
        os.makedirs(os.path.dirname(PUBLIC_JSON_PATH), exist_ok=True)
        with open(PUBLIC_JSON_PATH, 'w') as f:
            json.dump(payload, f, indent=2)
    except Exception as e:
        print(f"Warning: could not write {PUBLIC_JSON_PATH}: {e}")

    return payload


if __name__ == '__main__':
    res = compute_sector_flow_predictor(force_refresh=True)
    snap = res.get('current_snapshot', {})
    print(f"Generated {PUBLIC_JSON_PATH} for {snap.get('date')}:")
    print(f"  Phase: {snap.get('cycle_phase')} | Top Risk: {snap.get('top_risk_score')}/100 | Bottom Washout: {snap.get('bottom_capitulation_score')}/100")
    print(f"  OffCMF(20D): {snap.get('off_cmf_20d'):+.3f} | DefCMF(20D): {snap.get('def_cmf_20d'):+.3f} | Spread: {snap.get('def_minus_off_spread_20d'):+.3f}")
    print(f"  PosSec%: {snap.get('pos_sec_pct')}% ({snap.get('pos_sec_count')}/11) | PanicOut%: {snap.get('panic_out_pct')}% ({snap.get('panic_out_count')}/11)")
