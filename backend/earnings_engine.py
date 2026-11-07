import yfinance as yf
import json
import os
import math
import datetime
import pandas as pd
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed

# Expanded 28-Ticker Institutional AI, Tech & Market Leader Universe for pre-caching
TICKERS = [
    "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA",
    "AMD", "AVGO", "TSM", "PLTR", "ARM", "QCOM", "NFLX", "ORCL",
    "HOOD", "CRWD", "PANW", "ANET", "APP", "DELL", "LLY",
    "GE", "CAT", "JPM", "GS", "COIN", "COST"
]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, '..', 'public')
PARQUET_PATH = os.path.join(BASE_DIR, 'data', 'daily_ohlcv.parquet')


def clean_val(v, default=0.0):
    if v is None:
        return default
    try:
        if pd.isna(v):
            return default
        val = float(v)
        if math.isnan(val) or math.isinf(val):
            return default
        return val
    except Exception:
        return default


def _load_json_safe(filename):
    path = os.path.join(PUBLIC_DIR, filename)
    if not os.path.exists(path):
        return {}
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except Exception:
        return {}


import threading
_YF_LOCK = threading.Lock()


def load_shared_context(extra_tickers=None):
    """
    Loads local DuckDB/Parquet OHLCV history and all cross-engine scanner JSON outputs
    so AI Earnings Intelligence 3.0 fuses every scanner in the platform.
    """
    ctx = {
        "ohlcv_by_ticker": {},
        "spy_close": None,
        "rs_map": {},
        "opt_map": {},
        "seas_map": {},
        "swing_map": {},
        "vdu_set": set(),
        "squeeze_set": set(),
        "retest_set": set(),
        "pp_set": set(),
        "emerging_set": set(),
        "stage2_set": set(),
    }

    target_syms = list(set(TICKERS + ['SPY'] + ([t.upper() for t in extra_tickers] if extra_tickers else [])))

    # 1. Load daily_ohlcv.parquet with predicate pushdown on 'Ticker'
    if os.path.exists(PARQUET_PATH):
        try:
            df_all = pd.read_parquet(PARQUET_PATH, filters=[('Ticker', 'in', target_syms)])
            if not df_all.empty and 'Ticker' in df_all.columns:
                df_all['Date'] = pd.to_datetime(df_all['Date']).dt.tz_localize(None)
                df_all = df_all.sort_values(['Ticker', 'Date'])
                for sym, grp in df_all.groupby('Ticker'):
                    g = grp.set_index('Date')
                    ctx["ohlcv_by_ticker"][sym.upper()] = g
                if 'SPY' in ctx["ohlcv_by_ticker"]:
                    ctx["spy_close"] = ctx["ohlcv_by_ticker"]['SPY']['Close']
        except Exception as e:
            print(f"Warning loading parquet in earnings_engine: {e}")

    # 2. Load RS Line & MarketSurge Scanner
    rs_data = _load_json_safe('rs_scanner_results.json')
    for item in rs_data.get('all_stocks', []) or rs_data.get('stocks', []) or []:
        t = item.get('ticker')
        if t:
            ctx["rs_map"][t.upper()] = item

    # 3. Load CBOE Options Screener
    opt_data = _load_json_safe('options_screener.json')
    for item in opt_data.get('data', []) if isinstance(opt_data, dict) else (opt_data if isinstance(opt_data, list) else []):
        t = item.get('ticker')
        if t:
            ctx["opt_map"][t.upper()] = item

    # 4. Load Seasonality Screener
    seas_data = _load_json_safe('seasonality_results.json')
    for item in seas_data.get('stocks', []) if isinstance(seas_data, dict) else (seas_data if isinstance(seas_data, list) else []):
        t = item.get('ticker')
        if t:
            ctx["seas_map"][t.upper()] = item

    # 5. Load 1-3W Swing Trading System
    swing_data = _load_json_safe('swing_trading_setups.json')
    for item in swing_data.get('setups', []) or swing_data.get('all_setups', []) or swing_data.get('top_focus_setups', []) or []:
        t = item.get('ticker')
        if t:
            ctx["swing_map"][t.upper()] = item

    # 6. Load Confluence Sets across Specialized Scanners
    vdu_data = _load_json_safe('volume_dryup_scanner.json')
    for item in vdu_data.get('setups', []) or vdu_data.get('stocks', []) or []:
        if item.get('ticker'):
            ctx["vdu_set"].add(item['ticker'].upper())

    sqz_data = _load_json_safe('compression_squeeze_scanner.json')
    for item in sqz_data.get('setups', []) or sqz_data.get('stocks', []) or []:
        if item.get('ticker'):
            ctx["squeeze_set"].add(item['ticker'].upper())

    ret_data = _load_json_safe('first_ma_retest_scanner.json')
    for item in ret_data.get('setups', []) or ret_data.get('stocks', []) or []:
        if item.get('ticker'):
            ctx["retest_set"].add(item['ticker'].upper())

    pp_data = _load_json_safe('pocket_pivots.json')
    for item in (pp_data.get('stocks', []) if isinstance(pp_data, dict) else (pp_data if isinstance(pp_data, list) else [])):
        if isinstance(item, dict) and item.get('ticker'):
            ctx["pp_set"].add(item['ticker'].upper())

    em_data = _load_json_safe('emerging_leaders.json')
    for item in (em_data.get('leaders', []) or em_data.get('stocks', []) if isinstance(em_data, dict) else (em_data if isinstance(em_data, list) else [])):
        if isinstance(item, dict) and item.get('ticker'):
            ctx["emerging_set"].add(item['ticker'].upper())

    st2_data = _load_json_safe('minervini_stage2.json')
    for item in (st2_data.get('stocks', []) if isinstance(st2_data, dict) else (st2_data if isinstance(st2_data, list) else [])):
        if isinstance(item, dict) and item.get('ticker'):
            ctx["stage2_set"].add(item['ticker'].upper())

    return ctx


def get_options_analytics(ticker_symbol, current_price, yf_ticker=None):
    """
    Calculates Options Market Positioning:
    - ATM Implied Move (%) & ($)
    - Max Pain Strike
    - Put/Call Open Interest Ratio
    - ATM Implied Volatility (%)
    """
    try:
        ticker = yf_ticker or yf.Ticker(ticker_symbol)
        expirations = ticker.options
        if not expirations:
            return None

        target_exp = expirations[0]
        chain = ticker.option_chain(target_exp)
        calls = chain.calls.dropna(subset=['openInterest'])
        puts = chain.puts.dropna(subset=['openInterest'])

        if calls.empty or puts.empty:
            return None

        total_call_oi = float(calls['openInterest'].sum())
        total_put_oi = float(puts['openInterest'].sum())
        pcr_oi = round(total_put_oi / total_call_oi, 2) if total_call_oi > 0 else 1.0

        total_call_vol = float(calls['volume'].dropna().sum()) if 'volume' in calls else 0.0
        total_put_vol = float(puts['volume'].dropna().sum()) if 'volume' in puts else 0.0
        tot_opt_vol = total_call_vol + total_put_vol
        call_vol_pct = round((total_call_vol / tot_opt_vol) * 100, 1) if tot_opt_vol > 0 else 50.0

        # Max Pain calculation
        all_strikes = sorted(set(calls['strike']).union(set(puts['strike'])))
        max_pain_strike = current_price
        min_pain_value = float('inf')

        for spot in all_strikes:
            call_loss = calls.apply(lambda row: max(0, spot - row['strike']) * row['openInterest'], axis=1).sum()
            put_loss = puts.apply(lambda row: max(0, row['strike'] - spot) * row['openInterest'], axis=1).sum()
            total_loss = float(call_loss + put_loss)
            if total_loss < min_pain_value:
                min_pain_value = total_loss
                max_pain_strike = float(spot)

        # ATM Implied Move
        atm_strike = min(calls['strike'], key=lambda x: abs(x - current_price))
        atm_call_rows = calls[calls['strike'] == atm_strike]
        atm_put_rows = puts[puts['strike'] == atm_strike]

        if atm_call_rows.empty or atm_put_rows.empty:
            return None

        atm_call = atm_call_rows.iloc[0]
        atm_put = atm_put_rows.iloc[0]

        def get_price(opt):
            bid, ask = clean_val(opt.get('bid', 0)), clean_val(opt.get('ask', 0))
            if bid > 0 and ask > 0:
                return (bid + ask) / 2.0
            return clean_val(opt.get('lastPrice', 0))

        call_val = get_price(atm_call)
        put_val = get_price(atm_put)
        implied_move_usd = call_val + put_val
        implied_move_pct = (implied_move_usd / current_price * 100.0) if current_price > 0 else 0.0

        call_iv = clean_val(atm_call.get('impliedVolatility', 0)) * 100.0
        put_iv = clean_val(atm_put.get('impliedVolatility', 0)) * 100.0
        atm_iv = round((call_iv + put_iv) / 2.0, 1) if (call_iv > 0 and put_iv > 0) else round(max(call_iv, put_iv), 1)

        return {
            "expiration": target_exp,
            "pcr_oi": pcr_oi,
            "call_vol_pct": call_vol_pct,
            "max_pain_strike": round(max_pain_strike, 2),
            "atm_strike": round(float(atm_strike), 2),
            "atm_iv": atm_iv,
            "implied_move_usd": round(float(implied_move_usd), 2),
            "implied_move_pct": round(float(implied_move_pct), 2)
        }
    except Exception as e:
        print(f"Error calculating options data for {ticker_symbol}: {e}")
        return None


def get_eps_and_revenue_revisions(yf_ticker):
    """
    Extracts real 7-day, 30-day, and quarterly estimate revisions from yfinance tables.
    """
    revisions_data = {
        "up_7d": 0,
        "down_7d": 0,
        "up_30d": 0,
        "down_30d": 0,
        "total_analysts": 0,
        "current_q_eps_est": None,
        "prev_30d_eps_est": None,
        "eps_revision_pct_30d": 0.0,
        "bar_lowered": False,
        "next_q_growth_est": 0.0,
        "revenue_growth_est": 0.0,
        "net_revision_ratio": 0.0
    }

    try:
        revisions = getattr(yf_ticker, 'eps_revisions', None)
        if revisions is not None and not revisions.empty and '0q' in revisions.index:
            row_0q = revisions.loc['0q']
            revisions_data["up_7d"] = int(clean_val(row_0q.get('upLast7days', 0)))
            revisions_data["down_7d"] = int(clean_val(row_0q.get('downLast7Days', 0)))
            revisions_data["up_30d"] = int(clean_val(row_0q.get('upLast30days', 0)))
            revisions_data["down_30d"] = int(clean_val(row_0q.get('downLast30days', 0)))

            tot_30d = revisions_data["up_30d"] + revisions_data["down_30d"]
            if tot_30d > 0:
                revisions_data["net_revision_ratio"] = round((revisions_data["up_30d"] - revisions_data["down_30d"]) / tot_30d, 2)
    except Exception as e:
        print(f"Error fetching eps_revisions: {e}")

    try:
        trend = getattr(yf_ticker, 'eps_trend', None)
        if trend is not None and not trend.empty and '0q' in trend.index:
            curr = clean_val(trend.loc['0q'].get('current'))
            d30 = clean_val(trend.loc['0q'].get('30daysAgo'))
            revisions_data["current_q_eps_est"] = round(curr, 2) if curr != 0 else None
            revisions_data["prev_30d_eps_est"] = round(d30, 2) if d30 != 0 else None
            if d30 > 0 and curr > 0:
                rev_pct = ((curr - d30) / d30) * 100
                revisions_data["eps_revision_pct_30d"] = round(rev_pct, 2)
                revisions_data["bar_lowered"] = curr < d30
    except Exception as e:
        print(f"Error fetching eps_trend: {e}")

    try:
        ee = getattr(yf_ticker, 'earnings_estimate', None)
        if ee is not None and not ee.empty and '0q' in ee.index:
            revisions_data["total_analysts"] = int(clean_val(ee.loc['0q'].get('numberOfAnalysts', 0)))
            revisions_data["next_q_growth_est"] = round(clean_val(ee.loc['0q'].get('growth', 0)) * 100, 1)
    except Exception as e:
        print(f"Error fetching earnings_estimate: {e}")

    try:
        re = getattr(yf_ticker, 'revenue_estimate', None)
        if re is not None and not re.empty and '0q' in re.index:
            revisions_data["revenue_growth_est"] = round(clean_val(re.loc['0q'].get('growth', 0)) * 100, 1)
    except Exception as e:
        print(f"Error fetching revenue_estimate: {e}")

    return revisions_data


def get_historical_earnings_reactions(yf_ticker, hist_df=None):
    """
    Extracts the last 8 quarters of real post-earnings price reactions.
    """
    reactions = []
    try:
        ed = yf_ticker.earnings_dates
        if ed is None or ed.empty:
            return reactions

        hist = hist_df
        if hist is None or hist.empty or len(hist) < 250:
            hist = yf_ticker.history(period='2y')
        if hist is None or hist.empty or len(hist) < 30:
            return reactions

        hist = hist.copy()
        hist.index = pd.to_datetime(hist.index).tz_localize(None)
        trading_days = list(hist.index.normalize())

        for ed_dt, row in ed.iterrows():
            reported_eps = row.get('Reported EPS')
            if pd.isna(reported_eps):
                continue
            eps_est = row.get('EPS Estimate')
            surprise_pct = row.get('Surprise(%)')

            dt = pd.to_datetime(ed_dt)
            is_amc = dt.hour >= 16 or dt.hour == 0
            norm_date = dt.tz_localize(None).normalize()

            future_days = [d for d in trading_days if d >= norm_date]
            if not future_days:
                continue
            exact_day = future_days[0]

            if is_amc:
                t_minus_1_candidates = [d for d in trading_days if d <= norm_date]
                if not t_minus_1_candidates:
                    continue
                t_minus_1_date = t_minus_1_candidates[-1]
                t0_candidates = [d for d in trading_days if d > t_minus_1_date]
                if not t0_candidates:
                    continue
                t0_date = t0_candidates[0]
            else:
                t0_date = exact_day
                t_minus_1_candidates = [d for d in trading_days if d < t0_date]
                if not t_minus_1_candidates:
                    continue
                t_minus_1_date = t_minus_1_candidates[-1]

            try:
                idx_t0 = trading_days.index(t0_date)
                idx_tm1 = trading_days.index(t_minus_1_date)
                idx_t5 = min(idx_t0 + 5, len(trading_days) - 1)
                idx_t20 = min(idx_t0 + 20, len(trading_days) - 1)

                base_p = float(hist['Close'].iloc[idx_tm1])
                open_p = float(hist['Open'].iloc[idx_t0])
                close_p = float(hist['Close'].iloc[idx_t0])
                t5_close = float(hist['Close'].iloc[idx_t5])
                t20_close = float(hist['Close'].iloc[idx_t20])

                vol_t0 = float(hist['Volume'].iloc[idx_t0])
                vol_avg20 = float(hist['Volume'].iloc[max(0, idx_tm1 - 20):idx_tm1].mean())
                vol_surge = (vol_t0 / vol_avg20) if vol_avg20 > 0 else 1.0

                gap_pct = ((open_p - base_p) / base_p) * 100.0
                day_gain_pct = ((close_p - base_p) / base_p) * 100.0
                intraday_pct = ((close_p - open_p) / open_p) * 100.0
                drift_5d_pct = ((t5_close - close_p) / close_p) * 100.0
                drift_20d_pct = ((t20_close - close_p) / close_p) * 100.0

                if gap_pct > 1.5 and day_gain_pct >= gap_pct:
                    reaction_type = "GAP_AND_GO"
                elif gap_pct > 1.5 and intraday_pct < -1.5:
                    reaction_type = "GAP_AND_FADE"
                elif gap_pct < -1.5 and intraday_pct > 1.5:
                    reaction_type = "GAP_DOWN_REVERSAL"
                elif gap_pct < -1.5:
                    reaction_type = "GAP_AND_DUMP"
                else:
                    reaction_type = "MUTED_REACTION"

                reactions.append({
                    'date': norm_date.strftime('%Y-%m-%d'),
                    'timing': 'AMC' if is_amc else 'BMO',
                    'eps_est': round(clean_val(eps_est), 2) if pd.notna(eps_est) else None,
                    'eps_act': round(clean_val(reported_eps), 2) if pd.notna(reported_eps) else None,
                    'surprise_pct': round(clean_val(surprise_pct), 2) if pd.notna(surprise_pct) else 0.0,
                    'gap_pct': round(clean_val(gap_pct), 2),
                    'day_gain_pct': round(clean_val(day_gain_pct), 2),
                    'intraday_pct': round(clean_val(intraday_pct), 2),
                    'drift_5d_pct': round(clean_val(drift_5d_pct), 2),
                    'drift_20d_pct': round(clean_val(drift_20d_pct), 2),
                    'vol_surge': round(clean_val(vol_surge), 1),
                    'reaction_type': reaction_type
                })
            except Exception:
                continue

        reactions.sort(key=lambda x: x['date'], reverse=True)
        return reactions[:8]
    except Exception as e:
        print(f"Error extracting earnings reactions: {e}")
        return []


def compute_earnings_personality(reactions, options_data):
    """
    Computes statistical personality traits of the stock across earnings cycles.
    """
    if not reactions:
        return {
            "beat_rate_pct": 0,
            "gap_and_go_pct": 0,
            "gap_and_fade_pct": 0,
            "avg_abs_move_pct": 0,
            "avg_5d_drift_pct": 0,
            "avg_20d_drift_pct": 0,
            "volatility_verdict": "NORMAL"
        }

    n = len(reactions)
    beats = sum(1 for r in reactions if r['surprise_pct'] > 0)
    beat_rate_pct = round((beats / n) * 100, 1)

    positive_gaps = [r for r in reactions if r['gap_pct'] > 0.5]
    if positive_gaps:
        gap_goes = sum(1 for r in positive_gaps if r['intraday_pct'] >= -0.5 or r['drift_5d_pct'] > 0)
        gap_and_go_pct = round((gap_goes / len(positive_gaps)) * 100, 1)
        gap_and_fade_pct = round(100 - gap_and_go_pct, 1)
    else:
        gap_and_go_pct = 50.0
        gap_and_fade_pct = 50.0

    abs_moves = [abs(r['day_gain_pct']) for r in reactions]
    avg_abs_move = round(float(np.mean(abs_moves)), 2) if abs_moves else 0.0

    drifts_5d = [r['drift_5d_pct'] for r in reactions]
    avg_5d_drift = round(float(np.mean(drifts_5d)), 2) if drifts_5d else 0.0

    drifts_20d = [r.get('drift_20d_pct', 0.0) for r in reactions]
    avg_20d_drift = round(float(np.mean(drifts_20d)), 2) if drifts_20d else 0.0

    vol_verdict = "IN-LINE"
    if options_data and options_data.get('implied_move_pct'):
        implied = options_data['implied_move_pct']
        if implied > (avg_abs_move * 1.30) and implied > 3.0:
            vol_verdict = "OVERPRICED_IV"
        elif implied < (avg_abs_move * 0.80) and avg_abs_move > 3.0:
            vol_verdict = "UNDERPRICED_IV"

    return {
        "beat_rate_pct": beat_rate_pct,
        "gap_and_go_pct": gap_and_go_pct,
        "gap_and_fade_pct": gap_and_fade_pct,
        "avg_abs_move_pct": avg_abs_move,
        "avg_5d_drift_pct": avg_5d_drift,
        "avg_20d_drift_pct": avg_20d_drift,
        "volatility_verdict": vol_verdict
    }


def calculate_seasonality(yf_ticker, hist_df=None):
    """
    Computes 10-year monthly and quarterly cyclical seasonality.
    """
    try:
        hist = hist_df
        if hist is None or hist.empty or len(hist) < 750:
            hist = yf_ticker.history(period='10y')
        if hist is None or hist.empty or len(hist) < 200:
            return None

        hist = hist.copy()
        hist.index = pd.to_datetime(hist.index).tz_localize(None)

        monthly = hist['Close'].resample('ME').last().pct_change().dropna()
        if monthly.empty:
            return None

        df_m = pd.DataFrame({'return': monthly, 'month': monthly.index.month, 'year': monthly.index.year})
        month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        monthly_stats = []

        for m in range(1, 13):
            sub = df_m[df_m['month'] == m]
            if len(sub) > 0:
                win_rate = (sub['return'] > 0).mean() * 100
                avg_ret = sub['return'].mean() * 100
                med_ret = sub['return'].median() * 100
                monthly_stats.append({
                    'month': m,
                    'name': month_names[m - 1],
                    'win_rate': round(float(win_rate), 1),
                    'avg_return': round(float(avg_ret), 2),
                    'median_return': round(float(med_ret), 2),
                    'samples': len(sub)
                })

        quarterly = hist['Close'].resample('QE').last().pct_change().dropna()
        df_q = pd.DataFrame({'return': quarterly, 'quarter': quarterly.index.quarter})
        quarterly_stats = []
        for q in range(1, 5):
            sub_q = df_q[df_q['quarter'] == q]
            if len(sub_q) > 0:
                quarterly_stats.append({
                    'quarter': f'Q{q}',
                    'win_rate': round(float((sub_q['return'] > 0).mean() * 100), 1),
                    'avg_return': round(float(sub_q['return'].mean() * 100), 2),
                    'samples': len(sub_q)
                })

        sorted_by_avg = sorted(monthly_stats, key=lambda x: x['avg_return'], reverse=True)
        best_month = sorted_by_avg[0] if sorted_by_avg else None
        worst_month = sorted_by_avg[-1] if sorted_by_avg else None

        cur_m = pd.Timestamp.now().month
        cur_stat = next((x for x in monthly_stats if x['month'] == cur_m), None)
        next_m = (cur_m % 12) + 1
        next_stat = next((x for x in monthly_stats if x['month'] == next_m), None)

        return {
            'monthly_stats': monthly_stats,
            'quarterly_stats': quarterly_stats,
            'current_month': cur_stat,
            'next_month': next_stat,
            'best_month': best_month,
            'worst_month': worst_month,
            'years_analyzed': round(len(hist) / 252, 1)
        }
    except Exception as e:
        print(f"Seasonality calculation error: {e}")
        return None


def compute_30d_pre_earnings_and_vol(ticker_symbol, hist_df, spy_close, options_data, personality, opt_screener_row):
    """
    Computes 30-Day Pre-Earnings Price Trajectory, Institutional Footprint,
    30D Price + EMA10/21 + Gold RS Line Sparkline, and Volatility/IV Crush Telemetry.
    """
    pre_30d = {
        "return_5d_pct": 0.0,
        "return_10d_pct": 0.0,
        "return_30d_pct": 0.0,
        "alpha_30d_pct": 0.0,
        "up_days_30d": 15,
        "down_days_30d": 15,
        "ud_vol_ratio_30d": 1.0,
        "pocket_pivots_10d": 0,
        "vdu_days_10d": 0,
        "range_pos_30d_pct": 50.0,
        "dist_from_21ema_pct": 0.0,
        "dist_from_50sma_pct": 0.0,
        "runup_state": "CONSTRUCTIVE_BASE",
        "runup_badge": "⚖️ ORDERLY PRE-PRINT BASE",
        "runup_color": "#3b82f6",
        "runup_verdict": "Balanced 30D positioning into earnings; neither overextended nor broken.",
        "sparkline": {
            "close": [],
            "ema10": [],
            "ema21": [],
            "rs_norm": []
        }
    }

    vol_intel = {
        "hv_10d": 25.0,
        "hv_30d": 28.0,
        "hv_compression_ratio": 0.89,
        "atm_iv_30d": 35.0,
        "iv_rank": 50.0,
        "vrp_spread": 7.0,
        "implied_move_pct": options_data.get('implied_move_pct', 5.0) if options_data else 5.0,
        "implied_move_usd": options_data.get('implied_move_usd', 0.0) if options_data else 0.0,
        "avg_abs_move_pct": personality.get('avg_abs_move_pct', 4.5),
        "implied_vs_hist_ratio": 1.0,
        "expected_iv_crush_pct": -28.0,
        "upper_breakeven": 0.0,
        "lower_breakeven": 0.0,
        "call_vol_pct": options_data.get('call_vol_pct', 55.0) if options_data else 55.0,
        "opt_vol_ratio": 1.2,
        "whale_sweep": False,
        "skew_state": "NEUTRAL SKEW",
        "pre_earnings_options_play": "Wait for Post-Earnings ORB Confirmation",
        "post_earnings_pead_play": "Buy Day-1 15-min Opening Range Breakout (ORB) on >1.8x volume"
    }

    if hist_df is None or hist_df.empty or len(hist_df) < 35:
        return pre_30d, vol_intel

    df = hist_df.copy().sort_index()
    close = df['Close'].astype(float)
    high = df['High'].astype(float)
    low = df['Low'].astype(float)
    vol = df['Volume'].astype(float)

    cur_p = float(close.iloc[-1])
    p_5d = float(close.iloc[-6]) if len(close) >= 6 else cur_p
    p_10d = float(close.iloc[-11]) if len(close) >= 11 else cur_p
    p_30d = float(close.iloc[-31]) if len(close) >= 31 else float(close.iloc[0])

    ret_5d = ((cur_p - p_5d) / p_5d * 100.0) if p_5d > 0 else 0.0
    ret_10d = ((cur_p - p_10d) / p_10d * 100.0) if p_10d > 0 else 0.0
    ret_30d = ((cur_p - p_30d) / p_30d * 100.0) if p_30d > 0 else 0.0

    spy_ret_30d = 0.0
    if spy_close is not None and len(spy_close) >= 31:
        spy_cur = float(spy_close.iloc[-1])
        spy_30 = float(spy_close.iloc[-31])
        if spy_30 > 0:
            spy_ret_30d = ((spy_cur - spy_30) / spy_30) * 100.0

    alpha_30d = ret_30d - spy_ret_30d

    ema10 = close.ewm(span=10, adjust=False).mean()
    ema21 = close.ewm(span=21, adjust=False).mean()
    sma50 = close.rolling(50).mean()

    dist_21ema = ((cur_p - float(ema21.iloc[-1])) / float(ema21.iloc[-1]) * 100.0) if float(ema21.iloc[-1]) > 0 else 0.0
    dist_50sma = ((cur_p - float(sma50.iloc[-1])) / float(sma50.iloc[-1]) * 100.0) if pd.notna(sma50.iloc[-1]) and float(sma50.iloc[-1]) > 0 else 0.0

    # Last 30 trading days microstructure
    recent_30 = df.iloc[-30:]
    rets_daily = close.pct_change()
    rets_30 = rets_daily.iloc[-30:]
    vols_30 = vol.iloc[-30:]

    up_mask = rets_30 > 0
    down_mask = rets_30 < 0
    up_days = int(up_mask.sum())
    down_days = int(down_mask.sum())
    up_vol = float(vols_30[up_mask].sum())
    down_vol = float(vols_30[down_mask].sum())
    ud_ratio = round(up_vol / down_vol, 2) if down_vol > 0 else 1.5

    hi_30 = float(high.iloc[-30:].max())
    lo_30 = float(low.iloc[-30:].min())
    range_pos = round(((cur_p - lo_30) / (hi_30 - lo_30)) * 100.0, 1) if hi_30 > lo_30 else 50.0

    # Pocket pivots & VDU in last 10 days
    vol_ma20 = vol.rolling(20).mean()
    pp_count = 0
    vdu_count = 0
    for idx in range(max(15, len(df) - 10), len(df)):
        v_i = float(vol.iloc[idx])
        v_avg = float(vol_ma20.iloc[idx]) if pd.notna(vol_ma20.iloc[idx]) else v_i
        if v_avg > 0 and v_i <= 0.65 * v_avg:
            vdu_count += 1
        if float(rets_daily.iloc[idx]) > 0:
            prior_10_down_vols = [
                float(vol.iloc[k]) for k in range(idx - 10, idx)
                if float(rets_daily.iloc[k]) < 0
            ]
            max_down_v = max(prior_10_down_vols) if prior_10_down_vols else 0.0
            if max_down_v > 0 and v_i > max_down_v:
                pp_count += 1

    # Sparkline arrays (last 30 bars)
    spark_close = [round(float(x), 2) for x in close.iloc[-30:]]
    spark_ema10 = [round(float(x), 2) for x in ema10.iloc[-30:]]
    spark_ema21 = [round(float(x), 2) for x in ema21.iloc[-30:]]

    if spy_close is not None and len(spy_close) >= 30:
        aligned_spy = spy_close.reindex(close.iloc[-30:].index).ffill().bfill()
        if not aligned_spy.isna().all() and float(aligned_spy.iloc[0]) > 0:
            raw_rs = (close.iloc[-30:].values / aligned_spy.values)
            rs_min, rs_max = float(np.min(raw_rs)), float(np.max(raw_rs))
            c_min, c_max = min(spark_close), max(spark_close)
            if rs_max > rs_min and c_max > c_min:
                spark_rs = [round(c_min + (( float(r) - rs_min) / (rs_max - rs_min)) * (c_max - c_min), 2) for r in raw_rs]
            else:
                spark_rs = spark_close[:]
        else:
            spark_rs = spark_close[:]
    else:
        spark_rs = spark_close[:]

    # Pre-Earnings Run-Up Classification
    if ret_30d >= 14.0 or dist_21ema >= 8.5:
        runup_state = "EXTENDED_RUNUP_RISK"
        runup_badge = "⚠️ EXTENDED RUN-UP (HIGH BAR)"
        runup_color = "#f59e0b"
        runup_verdict = f"Stock surged {ret_30d:+.1f}% in 30D ({dist_21ema:+.1f}% above 21-EMA). High 'Sell-the-News' bar unless guidance blows out consensus."
    elif -5.0 <= ret_30d < 14.0 and ud_ratio >= 1.15 and abs(dist_21ema) <= 5.5:
        runup_state = "COILED_ACCUMULATION"
        runup_badge = "🔥 COILED PRE-PRINT BASE"
        runup_color = "#10b981"
        runup_verdict = f"Spring-loaded 30D base ({ret_30d:+.1f}%, {ud_ratio}x Up/Down Vol, {pp_count} Pocket Pivots). Ideal launchpad for Power Earnings Gap."
    elif ret_30d <= -8.0:
        runup_state = "SANDBAGGED_WASHOUT"
        runup_badge = "💎 WASHED OUT / LOW BAR"
        runup_color = "#38bdf8"
        runup_verdict = f"Pulled back {ret_30d:+.1f}% over 30D into print; expectations de-risked for potential relief gap."
    else:
        runup_state = "CONSTRUCTIVE_BASE"
        runup_badge = "⚖️ ORDERLY PRE-PRINT BASE"
        runup_color = "#3b82f6"
        runup_verdict = f"Orderly 30D trajectory ({ret_30d:+.1f}% move, {alpha_30d:+.1f}% alpha vs SPY)."

    pre_30d.update({
        "return_5d_pct": round(ret_5d, 2),
        "return_10d_pct": round(ret_10d, 2),
        "return_30d_pct": round(ret_30d, 2),
        "alpha_30d_pct": round(alpha_30d, 2),
        "up_days_30d": up_days,
        "down_days_30d": down_days,
        "ud_vol_ratio_30d": ud_ratio,
        "pocket_pivots_10d": pp_count,
        "vdu_days_10d": vdu_count,
        "range_pos_30d_pct": range_pos,
        "dist_from_21ema_pct": round(dist_21ema, 2),
        "dist_from_50sma_pct": round(dist_50sma, 2),
        "runup_state": runup_state,
        "runup_badge": runup_badge,
        "runup_color": runup_color,
        "runup_verdict": runup_verdict,
        "sparkline": {
            "close": spark_close,
            "ema10": spark_ema10,
            "ema21": spark_ema21,
            "rs_norm": spark_rs
        }
    })

    # Realized Historical Volatility (HV10 & HV30)
    log_rets = np.log(close / close.shift(1)).dropna()
    hv_10d = round(float(log_rets.iloc[-10:].std() * np.sqrt(252) * 100.0), 1) if len(log_rets) >= 10 else 25.0
    hv_30d = round(float(log_rets.iloc[-30:].std() * np.sqrt(252) * 100.0), 1) if len(log_rets) >= 30 else 28.0
    hv_comp = round(hv_10d / hv_30d, 2) if hv_30d > 0 else 1.0

    # Rolling 252d HV distribution to estimate IV rank if not in options screener
    hv_series = log_rets.rolling(20).std() * np.sqrt(252) * 100.0
    hv_clean = hv_series.dropna().iloc[-252:]
    hv_min = float(hv_clean.min()) if not hv_clean.empty else 15.0
    hv_max = float(hv_clean.max()) if not hv_clean.empty else 65.0

    atm_iv = clean_val(opt_screener_row.get('atm_iv') if opt_screener_row else 0)
    if atm_iv <= 0 and options_data:
        atm_iv = clean_val(options_data.get('atm_iv', 0))
    if atm_iv <= 0:
        atm_iv = round(hv_30d * 1.22, 1)

    iv_rank = clean_val(opt_screener_row.get('iv_rank') if opt_screener_row else 0)
    if iv_rank <= 0:
        iv_rank = round(min(99.0, max(5.0, ((atm_iv - hv_min) / max(10.0, (hv_max * 1.25 - hv_min))) * 100.0)), 1)

    vrp_spread = round(atm_iv - hv_30d, 1)

    imp_move_pct = clean_val(options_data.get('implied_move_pct', 0)) if options_data else 0.0
    imp_move_usd = clean_val(options_data.get('implied_move_usd', 0)) if options_data else 0.0
    if imp_move_pct <= 0:
        imp_move_pct = round(atm_iv / math.sqrt(252) * 1.25, 2)
        imp_move_usd = round(cur_p * (imp_move_pct / 100.0), 2)

    avg_hist_move = clean_val(personality.get('avg_abs_move_pct', 0))
    if avg_hist_move <= 0:
        avg_hist_move = round(imp_move_pct * 0.9, 2)

    imp_vs_hist = round(imp_move_pct / avg_hist_move, 2) if avg_hist_move > 0 else 1.0

    # Estimated Post-Earnings IV Crush %
    raw_crush = max(15.0, min(65.0, max(0.0, vrp_spread * 1.4) + max(0.0, (imp_vs_hist - 0.85) * 28.0)))
    expected_iv_crush_pct = round(-raw_crush, 1)

    upper_be = round(cur_p + imp_move_usd, 2)
    lower_be = round(max(0.01, cur_p - imp_move_usd), 2)

    call_vol_pct = clean_val(opt_screener_row.get('call_vol_pct') if opt_screener_row else 0)
    if call_vol_pct <= 0 and options_data:
        call_vol_pct = clean_val(options_data.get('call_vol_pct', 55.0))
    opt_vol_ratio = clean_val(opt_screener_row.get('vol_oi_ratio') or opt_screener_row.get('rel_opt_vol') if opt_screener_row else 1.25)
    if opt_vol_ratio <= 0:
        opt_vol_ratio = 1.25
    whale_sweep = bool(opt_screener_row.get('unusual_activity') or call_vol_pct >= 68.0 or opt_vol_ratio >= 1.8)
    skew_state = "BULLISH CALL SKEW" if call_vol_pct >= 58 else ("DEFENSIVE PUT SKEW" if call_vol_pct <= 45 else "BALANCED FLOW")

    # Pre-Earnings Options Strategy & Post-Earnings PEAD Play
    if imp_vs_hist >= 1.25 or vrp_spread >= 12.0:
        pre_opt_play = f"Bull Call Debit Spread or Iron Condor (±{imp_move_pct}% Implied vs ±{avg_hist_move}% Hist — Cap {expected_iv_crush_pct}% IV Crush)"
    elif imp_vs_hist <= 0.82:
        pre_opt_play = f"Long ATM Straddle / Gamma Call (±{imp_move_pct}% Implied underprices ±{avg_hist_move}% Historical Move)"
    elif runup_state == "COILED_ACCUMULATION" and call_vol_pct >= 55:
        pre_opt_play = f"Defined-Risk Bull Call Spread (${round(cur_p, 1)} / ${upper_be} strikes) into Print"
    else:
        pre_opt_play = f"Avoid Naked Pre-Print Premium; Deploy Post-Print PEAD Capital at Open"

    gap_go = personality.get('gap_and_go_pct', 50.0)
    if gap_go >= 65:
        post_pead_play = f"High Gap-and-Go ({gap_go}%): Buy Day-1 5-min / 15-min Opening Range Breakout (ORB) if Vol > 1.8x"
    elif gap_go <= 40:
        post_pead_play = f"High Fade Tendency ({100 - gap_go:.0f}%): Avoid chasing gap open; wait for Day-2/3 VWAP & 10-EMA retest"
    else:
        post_pead_play = f"Wait for first 30-min ORB hold above VWAP; trail stop at Day-1 Gap Day Low"

    vol_intel.update({
        "hv_10d": hv_10d,
        "hv_30d": hv_30d,
        "hv_compression_ratio": hv_comp,
        "atm_iv_30d": atm_iv,
        "iv_rank": iv_rank,
        "vrp_spread": vrp_spread,
        "implied_move_pct": round(imp_move_pct, 2),
        "implied_move_usd": round(imp_move_usd, 2),
        "avg_abs_move_pct": round(avg_hist_move, 2),
        "implied_vs_hist_ratio": imp_vs_hist,
        "expected_iv_crush_pct": expected_iv_crush_pct,
        "upper_breakeven": upper_be,
        "lower_breakeven": lower_be,
        "call_vol_pct": round(call_vol_pct, 1),
        "opt_vol_ratio": round(opt_vol_ratio, 2),
        "whale_sweep": whale_sweep,
        "skew_state": skew_state,
        "pre_earnings_options_play": pre_opt_play,
        "post_earnings_pead_play": post_pead_play
    })

    return pre_30d, vol_intel


def compute_rs_confluence_and_pead_plan(ticker_symbol, current_price, hist_df, pre_30d, vol_intel, personality, shared_ctx):
    """
    Fuses RS Line & MarketSurge Buy Point intelligence, 11-Engine Confluence tags,
    and builds the concrete Post-Earnings PEAD / ORB Execution Plan.
    """
    sym = ticker_symbol.upper()
    rs_row = (shared_ctx or {}).get("rs_map", {}).get(sym, {})
    swing_row = (shared_ctx or {}).get("swing_map", {}).get(sym, {})

    rs_rating = int(clean_val(rs_row.get('rs_rating') or swing_row.get('rs_intel', {}).get('rs_rating'), 70))
    is_blue_dot = bool(rs_row.get('rs_new_high_before_price') or rs_row.get('is_blue_dot') or swing_row.get('rs_intel', {}).get('is_blue_dot', False))

    # Fallback RS calculation from OHLCV if not in rs_scanner_results.json
    if not rs_row and hist_df is not None and len(hist_df) >= 120:
        c = hist_df['Close'].astype(float)
        ret_6m = ((float(c.iloc[-1]) / float(c.iloc[-120])) - 1.0) * 100.0 if float(c.iloc[-120]) > 0 else 0.0
        rs_rating = int(min(99, max(15, 55 + ret_6m * 0.9)))
        hi_252 = float(c.iloc[-min(252, len(c)):].max())
        is_blue_dot = bool(float(c.iloc[-1]) >= hi_252 * 0.97 and pre_30d.get('alpha_30d_pct', 0) > 2.5)

    ms_pattern = (
        swing_row.get('rs_intel', {}).get('marketsurge_pattern')
        or rs_row.get('pattern_type')
        or ("Stage 2 VCP Base" if pre_30d.get('runup_state') == "COILED_ACCUMULATION" else "Consolidation Base")
    )
    ms_buy_point = clean_val(
        swing_row.get('rs_intel', {}).get('marketsurge_buy_point')
        or rs_row.get('buy_point')
        or (max(pre_30d.get('sparkline', {}).get('close', [current_price])) if pre_30d.get('sparkline', {}).get('close') else current_price * 1.02)
    )
    if ms_buy_point <= 0:
        ms_buy_point = round(current_price * 1.02, 2)
    dist_to_pivot_pct = round(((current_price - ms_buy_point) / ms_buy_point) * 100.0, 2) if ms_buy_point > 0 else 0.0

    # Multi-Engine Confluence Detection
    engines = []
    if is_blue_dot or rs_rating >= 85:
        engines.append("RS Line Leader")
    if sym in (shared_ctx or {}).get("swing_map", {}):
        engines.append("1-3W Swing Setup")
    if sym in (shared_ctx or {}).get("vdu_set", set()) or pre_30d.get('vdu_days_10d', 0) >= 2:
        engines.append("Volume Dry-Up (VDU)")
    if sym in (shared_ctx or {}).get("squeeze_set", set()) or vol_intel.get('hv_compression_ratio', 1.0) <= 0.80:
        engines.append("Volatility Squeeze")
    if sym in (shared_ctx or {}).get("retest_set", set()):
        engines.append("Stage 2 MA Retest")
    if sym in (shared_ctx or {}).get("pp_set", set()) or pre_30d.get('pocket_pivots_10d', 0) >= 1:
        engines.append("Pocket Pivot")
    if sym in (shared_ctx or {}).get("emerging_set", set()):
        engines.append("Emerging Leader")
    if sym in (shared_ctx or {}).get("stage2_set", set()):
        engines.append("Minervini Stage 2")
    if vol_intel.get('whale_sweep'):
        engines.append("CBOE Options Sweep")

    # Concrete PEAD / ORB Execution Ticket
    imp_usd = vol_intel.get('implied_move_usd', current_price * 0.05)
    entry_pivot = round(ms_buy_point if abs(dist_to_pivot_pct) <= 6.0 else current_price * 1.015, 2)
    gap_stop = round(entry_pivot * 0.955, 2)
    risk_pts = max(0.01, entry_pivot - gap_stop)
    avg_5d = max(3.5, abs(personality.get('avg_5d_drift_pct', 4.0)) + 2.5)
    avg_20d = max(8.0, abs(personality.get('avg_20d_drift_pct', 9.0)) + 6.0)
    target_1_5d = round(entry_pivot * (1.0 + (avg_5d / 100.0)), 2)
    target_2_20d = round(entry_pivot * (1.0 + (avg_20d / 100.0)), 2)
    rr_ratio = round((target_2_20d - entry_pivot) / risk_pts, 1)

    return {
        "rs_rating": rs_rating,
        "is_blue_dot": is_blue_dot,
        "rs_badge": "🔵 RS BLUE DOT LEADER" if is_blue_dot else (f"RS {rs_rating} OUTPERFORMER" if rs_rating >= 80 else f"RS {rs_rating}"),
        "marketsurge_pattern": ms_pattern,
        "marketsurge_buy_point": round(ms_buy_point, 2),
        "distance_to_pivot_pct": dist_to_pivot_pct,
        "converged_engines": engines,
        "confluence_count": len(engines),
        "pead_execution_plan": {
            "entry_pivot": entry_pivot,
            "orb_trigger_rule": "15-Min Opening Range High + VWAP Hold on >1.8x RVOL",
            "gap_stop_loss": gap_stop,
            "stop_pct": round(((entry_pivot - gap_stop) / entry_pivot) * 100.0, 2),
            "target_1_5d": target_1_5d,
            "target_2_20d": target_2_20d,
            "reward_risk": f"{rr_ratio}:1",
            "upper_cone": round(current_price + imp_usd, 2),
            "lower_cone": round(max(0.01, current_price - imp_usd), 2)
        }
    }


def build_six_domain_matrix(revisions, personality, pre_30d, vol_intel, rs_conf, seasonality):
    """
    Builds the 6-Domain Earnings Decision Matrix with PASS / WARN / VETO gates.
    """
    gates = []

    # 1. Consensus Revisions
    up30, dn30 = revisions.get('up_30d', 0), revisions.get('down_30d', 0)
    rev_pct = revisions.get('eps_revision_pct_30d', 0.0)
    if up30 > dn30 or rev_pct > 0:
        g1_status, g1_color = "PASS", "#10b981"
    elif dn30 > up30 * 1.5 and rev_pct < -2.0:
        g1_status, g1_color = "VETO", "#ef4444"
    else:
        g1_status, g1_color = "WARN", "#f59e0b"
    gates.append({
        "gate": "1. Consensus Revisions",
        "status": g1_status,
        "color": g1_color,
        "metric": f"{up30} Up / {dn30} Down",
        "detail": f"30D EPS Trend: {rev_pct:+.2f}%"
    })

    # 2. Historical Beat & Gap-and-Go
    beat = personality.get('beat_rate_pct', 0)
    gap_go = personality.get('gap_and_go_pct', 50)
    if beat >= 75 and gap_go >= 55:
        g2_status, g2_color = "PASS", "#10b981"
    elif beat < 50 or gap_go < 35:
        g2_status, g2_color = "VETO", "#ef4444"
    else:
        g2_status, g2_color = "WARN", "#f59e0b"
    gates.append({
        "gate": "2. Beat & Gap-Go Track",
        "status": g2_status,
        "color": g2_color,
        "metric": f"{beat:.0f}% Beat | {gap_go:.0f}% Go",
        "detail": f"Avg 5D Drift: {personality.get('avg_5d_drift_pct', 0):+.2f}%"
    })

    # 3. 30D Pre-Print Positioning & RS
    r_state = pre_30d.get('runup_state', 'CONSTRUCTIVE_BASE')
    rs_rt = rs_conf.get('rs_rating', 70)
    if r_state in ("COILED_ACCUMULATION", "CONSTRUCTIVE_BASE") and rs_rt >= 75:
        g3_status, g3_color = "PASS", "#10b981"
    elif r_state == "EXTENDED_RUNUP_RISK":
        g3_status, g3_color = "WARN", "#f59e0b"
    else:
        g3_status, g3_color = "PASS" if rs_rt >= 80 else "WARN", "#10b981" if rs_rt >= 80 else "#f59e0b"
    gates.append({
        "gate": "3. 30D Run-Up & RS Line",
        "status": g3_status,
        "color": g3_color,
        "metric": f"30D {pre_30d.get('return_30d_pct', 0):+.1f}% | RS {rs_rt}",
        "detail": f"U/D Vol {pre_30d.get('ud_vol_ratio_30d', 1.0)}x • {pre_30d.get('pocket_pivots_10d', 0)} PP"
    })

    # 4. Implied vs Realized Move Edge
    iv_ratio = vol_intel.get('implied_vs_hist_ratio', 1.0)
    crush = vol_intel.get('expected_iv_crush_pct', -25.0)
    if iv_ratio <= 1.15:
        g4_status, g4_color = "PASS", "#10b981"
    elif iv_ratio >= 1.40:
        g4_status, g4_color = "VETO", "#ef4444"
    else:
        g4_status, g4_color = "WARN", "#f59e0b"
    gates.append({
        "gate": "4. IV vs Realized Edge",
        "status": g4_status,
        "color": g4_color,
        "metric": f"±{vol_intel.get('implied_move_pct', 0)}% vs ±{vol_intel.get('avg_abs_move_pct', 0)}%",
        "detail": f"Ratio {iv_ratio}x | Est Crush {crush}%"
    })

    # 5. CBOE Options Flow & Skew
    call_pct = vol_intel.get('call_vol_pct', 50.0)
    if call_pct >= 55.0:
        g5_status, g5_color = "PASS", "#10b981"
    elif call_pct <= 42.0:
        g5_status, g5_color = "VETO", "#ef4444"
    else:
        g5_status, g5_color = "WARN", "#f59e0b"
    gates.append({
        "gate": "5. CBOE Options Skew",
        "status": g5_status,
        "color": g5_color,
        "metric": f"{call_pct:.0f}% Call Flow",
        "detail": f"{vol_intel.get('skew_state', 'BALANCED')} ({vol_intel.get('opt_vol_ratio', 1.0)}x Vol)"
    })

    # 6. 10Y Cyclical Seasonality
    cur_m = (seasonality or {}).get('current_month') or {}
    win_m = cur_m.get('win_rate', 55.0)
    avg_m = cur_m.get('avg_return', 0.5)
    if win_m >= 60.0 and avg_m > 0:
        g6_status, g6_color = "PASS", "#10b981"
    elif win_m < 45.0 and avg_m < 0:
        g6_status, g6_color = "WARN", "#f59e0b"
    else:
        g6_status, g6_color = "PASS" if avg_m >= 0 else "WARN", "#10b981" if avg_m >= 0 else "#f59e0b"
    gates.append({
        "gate": "6. 10Y Seasonality",
        "status": g6_status,
        "color": g6_color,
        "metric": f"{cur_m.get('name', 'Cur')}: {win_m:.0f}% Win",
        "detail": f"Avg Return: {avg_m:+.2f}%"
    })

    pass_count = sum(1 for g in gates if g["status"] == "PASS")
    veto_count = sum(1 for g in gates if g["status"] == "VETO")

    return {
        "gates": gates,
        "pass_count": pass_count,
        "veto_count": veto_count,
        "summary_badge": f"{pass_count}/6 GATES PASSED" + (f" • {veto_count} VETO" if veto_count > 0 else " • CLEAR FOR PEAD")
    }


def synthesize_ai_earnings_intelligence(
    ticker, current_price, revisions, reactions, personality, options_data, info,
    seasonality=None, pre_30d=None, vol_intel=None, rs_conf=None, six_domain=None
):
    """
    AI Multi-Factor Synthesizer 3.0:
    Calculates Post-Earnings Drift Potential (PEDP Score 0-100) fusing:
    - EPS Surprise & Revision Momentum
    - Historical Gap & Go Drift Personality
    - 30D Pre-Print Run-Up & RS Line Strength
    - Volatility Mispricing & CBOE Options Skew
    """
    latest_reaction = reactions[0] if reactions else None

    # 1. EPS Surprise Factor (0 to 22 pts)
    eps_surprise = latest_reaction['surprise_pct'] if latest_reaction else 0.0
    if eps_surprise >= 15:
        score_eps = 22
    elif eps_surprise >= 8:
        score_eps = 19
    elif eps_surprise >= 3:
        score_eps = 15
    elif eps_surprise > 0:
        score_eps = 11
    else:
        score_eps = max(0, 6 + int(eps_surprise * 0.4))

    # 2. Analyst Estimate Revisions Momentum (0 to 22 pts)
    up_30 = revisions.get('up_30d', 0)
    down_30 = revisions.get('down_30d', 0)
    tot_30 = up_30 + down_30
    if tot_30 > 0:
        ratio = (up_30 - down_30) / tot_30
        score_revisions = int(11 + (ratio * 11))
    else:
        score_revisions = 11

    # 3. Volume Surge & Historical Gap-and-Go Personality (0 to 22 pts)
    vol_surge = latest_reaction.get('vol_surge', 1.0) if latest_reaction else 1.0
    gap_go = personality.get('gap_and_go_pct', 50)
    score_personality = int((gap_go / 100.0) * 14) + (8 if vol_surge >= 2.0 else (5 if vol_surge >= 1.4 else 2))

    # 4. 30D Pre-Earnings Positioning & RS Line Confluence (0 to 20 pts)
    rs_rating = (rs_conf or {}).get('rs_rating', 70)
    is_blue = (rs_conf or {}).get('is_blue_dot', False)
    r_state = (pre_30d or {}).get('runup_state', 'CONSTRUCTIVE_BASE')
    score_rs_30d = int(min(12, max(2, (rs_rating - 40) * 0.2)))
    if is_blue:
        score_rs_30d += 4
    if r_state == "COILED_ACCUMULATION":
        score_rs_30d += 4
    elif r_state == "EXTENDED_RUNUP_RISK":
        score_rs_30d -= 3

    # 5. Options Skew & Volatility Edge (0 to 14 pts)
    call_pct = (vol_intel or {}).get('call_vol_pct', 52.0)
    iv_ratio = (vol_intel or {}).get('implied_vs_hist_ratio', 1.0)
    score_opt = 7
    if call_pct >= 58:
        score_opt += 4
    elif call_pct <= 44:
        score_opt -= 3
    if iv_ratio <= 0.90:
        score_opt += 3
    elif iv_ratio >= 1.35:
        score_opt -= 3

    pedp_score = int(min(99, max(12, score_eps + score_revisions + score_personality + score_rs_30d + score_opt)))

    if pedp_score >= 78:
        setup_tier = "A+"
        setup_name = "INSTITUTIONAL POWER EARNINGS GAP (PEG)"
        badge_color = "#10b981"
        action_verdict = (
            f"HIGH-CONVICTION PEAD LEADER: {six_domain['pass_count'] if six_domain else 5}/6 gates passed. "
            f"{vol_intel.get('post_earnings_pead_play', 'Execute Day-1 ORB above pivot.')}"
        )
    elif pedp_score >= 65:
        setup_tier = "A"
        setup_name = "POST-EARNINGS DRIFT EXPANSION"
        badge_color = "#3b82f6"
        action_verdict = (
            f"CONSTRUCTIVE PEAD DRIFT: RS {rs_rating} with positive institutional flow. "
            f"{vol_intel.get('pre_earnings_options_play', 'Use defined-risk spreads or buy post-print ORB.')}"
        )
    elif pedp_score >= 50:
        setup_tier = "B"
        setup_name = "EARNINGS CONSOLIDATION / TACTICAL"
        badge_color = "#eab308"
        action_verdict = (
            f"TACTICAL WAIT: {pre_30d.get('runup_verdict', 'Wait for post-earnings volume confirmation before committing full size.')}"
        )
    else:
        setup_tier = "C-"
        setup_name = "EARNINGS SQUAT / EVASION RISK"
        badge_color = "#ef4444"
        action_verdict = "SUPPLY OVERHANG / IV CRUSH RISK: Weak revision momentum or overpriced implied move. Avoid holding naked calls through print."

    catalysts = []

    if up_30 > 0 and up_30 >= (down_30 * 1.5):
        catalysts.append(f"Wall Street Consensus: Heavy upward revisions ({up_30} Upgrades vs {down_30} Downgrades in last 30d).")
    elif down_30 > up_30:
        catalysts.append(f"Estimate Caution: Analysts trimmed Qtr bar ({down_30} downward vs {up_30} upward revisions in 30d).")
    else:
        catalysts.append(f"Stable Consensus: Balanced estimate trajectory across {revisions.get('total_analysts', 0)} covering analysts.")

    if pre_30d:
        catalysts.append(
            f"30-Day Pre-Print Trajectory: {pre_30d['return_30d_pct']:+.1f}% ({pre_30d['alpha_30d_pct']:+.1f}% alpha vs SPY), "
            f"U/D Vol Ratio {pre_30d['ud_vol_ratio_30d']}x, {pre_30d['pocket_pivots_10d']} Pocket Pivots — {pre_30d['runup_badge']}."
        )

    if vol_intel:
        catalysts.append(
            f"Volatility & IV Crush Radar: Implied Move ±{vol_intel['implied_move_pct']}% (${vol_intel['implied_move_usd']}) vs "
            f"±{vol_intel['avg_abs_move_pct']}% Historical Avg (Ratio {vol_intel['implied_vs_hist_ratio']}x, Est. IV Crush {vol_intel['expected_iv_crush_pct']}%)."
        )

    if rs_conf:
        catalysts.append(
            f"MarketSurge & Confluence: RS Rating {rs_conf['rs_rating']} ({rs_conf['marketsurge_pattern']} Pivot ${rs_conf['marketsurge_buy_point']}) • "
            f"Confirmed across {rs_conf['confluence_count']} Quantitative Scanners."
        )

    if latest_reaction:
        lr_date = latest_reaction['date']
        surp = latest_reaction['surprise_pct']
        catalysts.append(f"Last Reported Quarter ({lr_date}): {surp:+.2f}% EPS Surprise with {latest_reaction['vol_surge']}x volume & {latest_reaction['drift_5d_pct']:+.2f}% 5D drift.")

    if seasonality and seasonality.get('current_month'):
        cur_m = seasonality['current_month']
        catalysts.append(
            f"10-Yr Seasonality ({cur_m['name']}): {cur_m['win_rate']}% historical win rate with {cur_m['avg_return']:+.2f}% average return."
        )

    return {
        "pedp_score": pedp_score,
        "setup_tier": setup_tier,
        "setup_name": setup_name,
        "badge_color": badge_color,
        "action_verdict": action_verdict,
        "catalysts": catalysts
    }


def analyze_single_ticker(symbol, shared_context=None):
    """
    Main orchestration function for on-demand & cached ticker analysis.
    """
    ticker_symbol = symbol.upper()
    ctx = shared_context if shared_context is not None else load_shared_context(extra_tickers=[ticker_symbol])

    try:
        yf_ticker = yf.Ticker(ticker_symbol)
        hist_df = ctx.get("ohlcv_by_ticker", {}).get(ticker_symbol)
        if hist_df is None or hist_df.empty or len(hist_df) < 60:
            try:
                with _YF_LOCK:
                    hist_df = yf_ticker.history(period='2y')
                if hist_df is not None and not hist_df.empty:
                    hist_df.index = pd.to_datetime(hist_df.index).tz_localize(None)
            except Exception:
                hist_df = None

        spy_close = ctx.get("spy_close")

        # 1. Price & Calendar
        current_price = 0.0
        if hist_df is not None and not hist_df.empty:
            current_price = clean_val(hist_df['Close'].iloc[-1])
        if current_price <= 0:
            try:
                current_price = clean_val(yf_ticker.fast_info.last_price)
            except Exception:
                current_price = 0.0

        earnings_date_str = "Unknown"
        earnings_timing = "AMC"
        try:
            calendar = yf_ticker.calendar
            if calendar and 'Earnings Date' in calendar and len(calendar['Earnings Date']) > 0:
                ed_val = calendar['Earnings Date'][0]
                if hasattr(ed_val, 'strftime'):
                    earnings_date_str = ed_val.strftime('%Y-%m-%d')
                else:
                    earnings_date_str = str(ed_val)[:10]
        except Exception:
            pass

        # 2. Options Data
        options_data = get_options_analytics(ticker_symbol, current_price, yf_ticker=yf_ticker)

        # 3. Consensus Revisions & Estimate Trajectory
        revisions = get_eps_and_revenue_revisions(yf_ticker)

        # 4. Historical Reactions (last 8 quarters)
        reactions = get_historical_earnings_reactions(yf_ticker, hist_df=hist_df)

        # 5. Earnings Personality (Gap & Go, Avg move, Volatility verdict)
        personality = compute_earnings_personality(reactions, options_data)

        # 6. Seasonality Analytics (10-Year Monthly & Quarterly Cycles)
        seasonality = calculate_seasonality(yf_ticker, hist_df=hist_df)

        # 7. Institutional Fundamentals & Short Float
        info = {}
        try:
            info = yf_ticker.info or {}
        except Exception:
            pass

        short_pct = round(clean_val(info.get('shortPercentOfFloat', 0)) * 100, 2)
        short_ratio = round(clean_val(info.get('shortRatio', 0)), 1)
        forward_pe = round(clean_val(info.get('forwardPE', 0)), 1)
        peg_ratio = round(clean_val(info.get('pegRatio', 0)), 2)

        revisions_feed = []
        try:
            up_down = yf_ticker.upgrades_downgrades
            if up_down is not None and not up_down.empty:
                thirty_days_ago = pd.Timestamp.now(tz='UTC') - pd.Timedelta(days=60)
                if up_down.index.tz is None:
                    up_down.index = up_down.index.tz_localize('UTC')
                recent = up_down[up_down.index >= thirty_days_ago].head(8)
                for index, row in recent.iterrows():
                    revisions_feed.append({
                        "date": index.strftime('%Y-%m-%d'),
                        "firm": str(row.get('Firm', '')),
                        "to_grade": str(row.get('ToGrade', '')),
                        "from_grade": str(row.get('FromGrade', '')),
                        "price_target": clean_val(row.get('currentPriceTarget', 0)),
                        "action": str(row.get('Action', 'Maintain'))
                    })
        except Exception as e:
            print(f"Error reading upgrades/downgrades: {e}")

        # 8. 30D Pre-Earnings Run-Up, Sparkline & Volatility/IV Crush Intelligence
        opt_screener_row = ctx.get("opt_map", {}).get(ticker_symbol, {})
        pre_30d, vol_intel = compute_30d_pre_earnings_and_vol(
            ticker_symbol, hist_df, spy_close, options_data, personality, opt_screener_row
        )

        # 9. RS Line, MarketSurge Buy Point, Multi-Engine Confluence & PEAD Execution Plan
        rs_conf = compute_rs_confluence_and_pead_plan(
            ticker_symbol, current_price, hist_df, pre_30d, vol_intel, personality, ctx
        )

        # 10. 6-Domain Earnings Decision Matrix
        six_domain = build_six_domain_matrix(
            revisions, personality, pre_30d, vol_intel, rs_conf, seasonality
        )

        # 11. AI Earnings Intelligence 3.0 Synthesis
        ai_intel = synthesize_ai_earnings_intelligence(
            ticker_symbol, current_price, revisions, reactions, personality, options_data, info,
            seasonality=seasonality, pre_30d=pre_30d, vol_intel=vol_intel, rs_conf=rs_conf, six_domain=six_domain
        )

        return {
            "ticker": ticker_symbol,
            "company_name": info.get('shortName', ticker_symbol),
            "sector": info.get('sector', 'Technology'),
            "current_price": round(current_price, 2),
            "next_earnings_date": earnings_date_str,
            "earnings_timing": earnings_timing,
            "ai_intelligence": ai_intel,
            "pre_earnings_30d": pre_30d,
            "volatility_crush_intel": vol_intel,
            "rs_and_confluence": rs_conf,
            "six_domain_matrix": six_domain,
            "options_data": options_data,
            "consensus_revisions": revisions,
            "personality": personality,
            "seasonality": seasonality,
            "historical_reactions": reactions,
            "institutional": {
                "short_percent": short_pct,
                "short_ratio": short_ratio,
                "forward_pe": forward_pe,
                "peg_ratio": peg_ratio,
                "analyst_revisions": revisions_feed
            }
        }
    except Exception as e:
        print(f"Failed to analyze {ticker_symbol}: {e}")
        return {
            "ticker": ticker_symbol,
            "error": str(e)
        }


def fetch_earnings_data():
    """
    Pre-computes and caches the upgraded AI Earnings Intelligence 3.0 dataset
    concurrently across our 28-ticker institutional leader universe.
    """
    import time
    t0 = time.time()
    print(f"Executing Institutional AI Earnings Intelligence Engine 3.0 on {len(TICKERS)} tickers...")

    shared_ctx = load_shared_context()
    results_map = {}

    with ThreadPoolExecutor(max_workers=6) as executor:
        future_to_sym = {
            executor.submit(analyze_single_ticker, sym, shared_ctx): sym
            for sym in TICKERS
        }
        for future in as_completed(future_to_sym):
            sym = future_to_sym[future]
            try:
                res = future.result()
                if res and not res.get("error"):
                    results_map[sym] = res
                    print(f"  ✓ {sym}: PEDP {res['ai_intelligence']['pedp_score']} ({res['ai_intelligence']['setup_tier']}) | 30D {res['pre_earnings_30d']['return_30d_pct']:+.1f}% | RS {res['rs_and_confluence']['rs_rating']}")
            except Exception as e:
                print(f"  ✗ {sym} error: {e}")

    # Preserve TICKERS ordering or sort by PEDP score descending
    results = [results_map[s] for s in TICKERS if s in results_map]
    results.sort(key=lambda x: x.get('ai_intelligence', {}).get('pedp_score', 0), reverse=True)

    output_path = os.path.join(PUBLIC_DIR, 'earnings_data.json')
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)

    elapsed = round(time.time() - t0, 2)
    print(f"Successfully generated AI Earnings Intelligence 3.0 dataset: {len(results)} records in {elapsed}s -> {output_path}")


if __name__ == "__main__":
    fetch_earnings_data()
