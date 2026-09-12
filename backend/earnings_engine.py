import yfinance as yf
import json
import os
import math
import datetime
import pandas as pd
import numpy as np

# Core high-impact AI, Tech & Market Leader Universe for dashboard pre-caching
TICKERS = [
    "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", 
    "AMD", "AVGO", "TSM", "PLTR", "ARM", "QCOM", "NFLX", "ORCL"
]

def clean_val(v, default=0.0):
    if v is None:
        return default
    try:
        if pd.isna(v):
            return default
        return float(v)
    except Exception:
        return default

def get_options_analytics(ticker_symbol, current_price):
    """
    Calculates Options Market Positioning:
    - ATM Implied Move (%)
    - Max Pain Strike
    - Put/Call Open Interest Ratio
    """
    try:
        ticker = yf.Ticker(ticker_symbol)
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
            bid, ask = opt.get('bid', 0), opt.get('ask', 0)
            if bid > 0 and ask > 0:
                return (bid + ask) / 2
            return opt.get('lastPrice', 0)
            
        call_val = get_price(atm_call)
        put_val = get_price(atm_put)
        implied_move_usd = call_val + put_val
        implied_move_pct = (implied_move_usd / current_price * 100) if current_price > 0 else 0

        return {
            "expiration": target_exp,
            "pcr_oi": pcr_oi,
            "max_pain_strike": round(max_pain_strike, 2),
            "atm_strike": round(float(atm_strike), 2),
            "implied_move_usd": round(float(implied_move_usd), 2),
            "implied_move_pct": round(float(implied_move_pct), 2)
        }
    except Exception as e:
        print(f"Error calculating options data for {ticker_symbol}: {e}")
        return None

def get_eps_and_revenue_revisions(yf_ticker):
    """
    Extracts real 7-day, 30-day, and quarterly estimate revisions from yfinance tables:
    - eps_revisions (upLast7days, upLast30days, downLast30days, downLast7Days)
    - eps_trend (current, 7daysAgo, 30daysAgo, 90daysAgo)
    - earnings_estimate & revenue_estimate
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
        "net_revision_ratio": 0.0 # -1.0 to +1.0
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

def get_historical_earnings_reactions(yf_ticker):
    """
    Extracts the last 8 quarters of real post-earnings price reactions:
    - Date & Timing (BMO / AMC)
    - Reported EPS vs EPS Estimate & Surprise %
    - Day-of Gap %
    - Day-of Session Gain % (T+0 Close vs T-1 Close)
    - Post-Earnings Drift (T+5 Close vs T+0 Close, T+20 Close vs T+0 Close)
    - Volume Surge factor on reaction day
    """
    reactions = []
    try:
        ed = yf_ticker.earnings_dates
        if ed is None or ed.empty:
            return reactions

        hist = yf_ticker.history(period='2y')
        if hist is None or hist.empty or len(hist) < 30:
            return reactions

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
                if not t_minus_1_candidates: continue
                t_minus_1_date = t_minus_1_candidates[-1]
                t0_candidates = [d for d in trading_days if d > t_minus_1_date]
                if not t0_candidates: continue
                t0_date = t0_candidates[0]
            else: # BMO
                t0_date = exact_day
                t_minus_1_candidates = [d for d in trading_days if d < t0_date]
                if not t_minus_1_candidates: continue
                t_minus_1_date = t_minus_1_candidates[-1]

            try:
                idx_t0 = trading_days.index(t0_date)
                idx_tm1 = trading_days.index(t_minus_1_date)
                idx_t1 = min(idx_t0 + 1, len(trading_days) - 1)
                idx_t5 = min(idx_t0 + 5, len(trading_days) - 1)
                idx_t20 = min(idx_t0 + 20, len(trading_days) - 1)

                base_p = hist['Close'].iloc[idx_tm1]
                open_p = hist['Open'].iloc[idx_t0]
                close_p = hist['Close'].iloc[idx_t0]
                high_p = hist['High'].iloc[idx_t0]
                low_p = hist['Low'].iloc[idx_t0]
                t5_close = hist['Close'].iloc[idx_t5]
                t20_close = hist['Close'].iloc[idx_t20]

                vol_t0 = hist['Volume'].iloc[idx_t0]
                vol_avg20 = hist['Volume'].iloc[max(0, idx_tm1-20):idx_tm1].mean()
                vol_surge = (vol_t0 / vol_avg20) if vol_avg20 > 0 else 1.0

                gap_pct = ((open_p - base_p) / base_p) * 100
                day_gain_pct = ((close_p - base_p) / base_p) * 100
                intraday_pct = ((close_p - open_p) / open_p) * 100
                drift_5d_pct = ((t5_close - close_p) / close_p) * 100
                drift_20d_pct = ((t20_close - close_p) / close_p) * 100

                # Classification of day reaction
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
            except Exception as e:
                continue

        # Sort descending by date
        reactions.sort(key=lambda x: x['date'], reverse=True)
        return reactions[:8]
    except Exception as e:
        print(f"Error extracting earnings reactions: {e}")
        return []

def compute_earnings_personality(reactions, options_data):
    """
    Computes statistical personality traits of the stock across earnings cycles:
    - Beat Rate (%)
    - Gap & Go Rate (%)
    - Gap & Fade Rate (%)
    - Average Realized Earnings Day Absolute Move (%)
    - Average 5-Day Post-Earnings Drift (%)
    - Implied vs Realized Move ratio (Volatility Mispricing)
    """
    if not reactions:
        return {
            "beat_rate_pct": 0,
            "gap_and_go_pct": 0,
            "gap_and_fade_pct": 0,
            "avg_abs_move_pct": 0,
            "avg_5d_drift_pct": 0,
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

    # Check options pricing vs realized move
    vol_verdict = "IN-LINE"
    if options_data and options_data.get('implied_move_pct'):
        implied = options_data['implied_move_pct']
        if implied > (avg_abs_move * 1.35) and implied > 3.0:
            vol_verdict = "OVERPRICED_IV" # Options expensive, IV crush expected
        elif implied < (avg_abs_move * 0.75) and avg_abs_move > 3.0:
            vol_verdict = "UNDERPRICED_IV" # Options cheap relative to historical explosive moves

    return {
        "beat_rate_pct": beat_rate_pct,
        "gap_and_go_pct": gap_and_go_pct,
        "gap_and_fade_pct": gap_and_fade_pct,
        "avg_abs_move_pct": avg_abs_move,
        "avg_5d_drift_pct": avg_5d_drift,
        "volatility_verdict": vol_verdict
    }

def synthesize_ai_earnings_intelligence(ticker, current_price, revisions, reactions, personality, options_data, info):
    """
    AI Multi-Factor Synthesizer:
    Calculates Post-Earnings Drift Potential (PEDP Score 0-100)
    Generates actionable institutional guidance, setup classification, and trade triggers.
    """
    latest_reaction = reactions[0] if reactions else None
    
    # 1. EPS Surprise Factor (0 to 30 pts)
    eps_surprise = latest_reaction['surprise_pct'] if latest_reaction else 0.0
    if eps_surprise >= 15:
        score_eps = 30
    elif eps_surprise >= 8:
        score_eps = 25
    elif eps_surprise >= 3:
        score_eps = 20
    elif eps_surprise > 0:
        score_eps = 14
    elif eps_surprise == 0:
        score_eps = 8
    else:
        score_eps = max(0, 5 + int(eps_surprise * 0.5))

    # 2. Analyst Estimate Revisions Momentum (0 to 30 pts)
    up_30 = revisions.get('up_30d', 0)
    down_30 = revisions.get('down_30d', 0)
    tot_30 = up_30 + down_30
    if tot_30 > 0:
        ratio = (up_30 - down_30) / tot_30
        score_revisions = int(15 + (ratio * 15)) # 0 to 30
    else:
        score_revisions = 15

    # 3. Volume Surge & Day-1 Follow Through (0 to 20 pts)
    vol_surge = latest_reaction.get('vol_surge', 1.0) if latest_reaction else 1.0
    day_gain = latest_reaction.get('day_gain_pct', 0.0) if latest_reaction else 0.0
    if vol_surge >= 2.5 and day_gain > 2.0:
        score_volume = 20
    elif vol_surge >= 1.8 and day_gain > 0.0:
        score_volume = 16
    elif vol_surge >= 1.2:
        score_volume = 11
    else:
        score_volume = 6

    # 4. Historical Drift Personality (0 to 20 pts)
    gap_go = personality.get('gap_and_go_pct', 50)
    score_personality = int((gap_go / 100) * 20)

    # Total PEDP Score (0 - 100)
    pedp_score = int(min(100, max(0, score_eps + score_revisions + score_volume + score_personality)))

    # Classification Setup Verdict
    if pedp_score >= 78:
        setup_tier = "A+"
        setup_name = "INSTITUTIONAL POWER EARNINGS GAP (PEG)"
        badge_color = "#10b981"
        action_verdict = "HIGH ACCUMULATION: Institutional re-rating underway. Buy opening pullbacks or flag consolidations."
    elif pedp_score >= 65:
        setup_tier = "A"
        setup_name = "POST-EARNINGS DRIFT EXPANSION"
        badge_color = "#3b82f6"
        action_verdict = "ORDERLY EXPANSION: Positive estimate revisions support sustained multi-week drift."
    elif pedp_score >= 50:
        setup_tier = "B"
        setup_name = "EARNINGS CONSOLIDATION / NEUTRAL"
        badge_color = "#eab308"
        action_verdict = "IN-LINE CONSOLIDATION: Market digests numbers; wait for high-volume breakout above reaction high."
    else:
        setup_tier = "C-"
        setup_name = "EARNINGS SQUAT / HIGH EVASION RISK"
        badge_color = "#ef4444"
        action_verdict = "SUPPLY OVERHANG: Weak revision momentum or post-earnings selling pressure. Avoid or trim into strength."

    # Key Catalysts & Guidance Synthesis
    catalysts = []
    
    # Revisions Catalyst
    if up_30 > 0 and up_30 >= (down_30 * 2):
        catalysts.append(f"Wall Street Consensus: Heavy upward revisions ({up_30} Upgrades vs {down_30} Downgrades in last 30d).")
    elif down_30 > up_30:
        catalysts.append(f"Estimate Erosion: Analysts lowering Q{revisions.get('current_q_eps_est')} bar ({down_30} down revisions).")
    else:
        catalysts.append(f"Stable Consensus: Balanced estimate trajectory across {revisions.get('total_analysts', 0)} covering analysts.")

    # Earnings Beat Catalyst
    if latest_reaction:
        lr_date = latest_reaction['date']
        surp = latest_reaction['surprise_pct']
        catalysts.append(f"Last Reported Quarter ({lr_date}): {surp:+.2f}% EPS Surprise with a {latest_reaction['vol_surge']}x volume expansion.")

    # Growth & Guidance Catalyst
    rev_growth = revisions.get('revenue_growth_est', 0.0)
    eps_growth = revisions.get('next_q_growth_est', 0.0)
    if rev_growth > 0 or eps_growth > 0:
        catalysts.append(f"Forward Estimates: Forward quarterly revenue projected at +{rev_growth}% YoY; EPS growth expected at +{eps_growth}% YoY.")

    # Volatility / Options Catalyst
    if options_data:
        imp = options_data['implied_move_pct']
        hist_mov = personality['avg_abs_move_pct']
        if personality['volatility_verdict'] == 'OVERPRICED_IV':
            catalysts.append(f"Options Implied Move (±{imp}%) exceeds historical average move (±{hist_mov}%). High risk of post-announcement IV crush.")
        elif personality['volatility_verdict'] == 'UNDERPRICED_IV':
            catalysts.append(f"Options market underpricing move (±{imp}% implied vs ±{hist_mov}% historical). Potential explosive gamma opportunity.")
        else:
            catalysts.append(f"Options Implied Move (±{imp}%) aligned with historical reaction amplitude (±{hist_mov}%).")

    return {
        "pedp_score": pedp_score,
        "setup_tier": setup_tier,
        "setup_name": setup_name,
        "badge_color": badge_color,
        "action_verdict": action_verdict,
        "catalysts": catalysts
    }

def analyze_single_ticker(symbol):
    """
    Main orchestration function for on-demand & cached ticker analysis.
    """
    ticker_symbol = symbol.upper()
    try:
        yf_ticker = yf.Ticker(ticker_symbol)
        
        # 1. Price & Calendar
        try:
            current_price = clean_val(yf_ticker.fast_info.last_price)
        except Exception:
            current_price = 0.0
            
        calendar = yf_ticker.calendar
        earnings_date_str = "Unknown"
        earnings_timing = "AMC"
        if calendar and 'Earnings Date' in calendar and len(calendar['Earnings Date']) > 0:
            ed_val = calendar['Earnings Date'][0]
            if hasattr(ed_val, 'strftime'):
                earnings_date_str = ed_val.strftime('%Y-%m-%d')
            else:
                earnings_date_str = str(ed_val)[:10]

        # 2. Options Data
        options_data = get_options_analytics(ticker_symbol, current_price)

        # 3. Consensus Revisions & Estimate Trajectory
        revisions = get_eps_and_revenue_revisions(yf_ticker)

        # 4. Historical Reactions (last 8 quarters)
        reactions = get_historical_earnings_reactions(yf_ticker)

        # 5. Earnings Personality (Gap & Go, Avg move, Volatility verdict)
        personality = compute_earnings_personality(reactions, options_data)

        # 6. Institutional Fundamentals & Short Float
        info = {}
        try:
            info = yf_ticker.info or {}
        except Exception:
            pass

        short_pct = round(clean_val(info.get('shortPercentOfFloat', 0)) * 100, 2)
        short_ratio = round(clean_val(info.get('shortRatio', 0)), 1)
        forward_pe = round(clean_val(info.get('forwardPE', 0)), 1)
        peg_ratio = round(clean_val(info.get('pegRatio', 0)), 2)

        # Recent Analyst Upgrades/Downgrades
        revisions_feed = []
        try:
            up_down = yf_ticker.upgrades_downgrades
            if up_down is not None and not up_down.empty:
                thirty_days_ago = pd.Timestamp.now(tz='UTC') - pd.Timedelta(days=45)
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

        # 7. AI Earnings Intelligence Synthesis
        ai_intel = synthesize_ai_earnings_intelligence(
            ticker_symbol, current_price, revisions, reactions, personality, options_data, info
        )

        return {
            "ticker": ticker_symbol,
            "company_name": info.get('shortName', ticker_symbol),
            "current_price": round(current_price, 2),
            "next_earnings_date": earnings_date_str,
            "earnings_timing": earnings_timing,
            "ai_intelligence": ai_intel,
            "options_data": options_data,
            "consensus_revisions": revisions,
            "personality": personality,
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
    Pre-computes and caches the upgraded AI Earnings dataset for the core universe.
    Writes output to public/earnings_data.json.
    """
    results = []
    print(f"Executing Institutional AI Earnings Engine V2 on {len(TICKERS)} tickers...")

    for sym in TICKERS:
        print(f"Analyzing {sym}...")
        res = analyze_single_ticker(sym)
        if not res.get("error"):
            results.append(res)

    output_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'earnings_data.json')
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=4)

    print(f"Successfully generated upgraded AI Earnings dataset: {len(results)} records -> {output_path}")

if __name__ == "__main__":
    fetch_earnings_data()

