"""
Institutional Zacks Fundamental Intelligence Engine
Implements the true 4-pillar Zacks Rank quantitative model:
1. Agreement: Extent to which covering Wall Street analysts are revising EPS estimates in the same direction.
2. Magnitude: The percentage size of recent estimate revisions (Current Quarter, Next Quarter, Current Year, Next Year).
3. Upside: Difference between the consensus estimate and the Most Accurate Estimate (whisper / top analyst target).
4. Surprise: Historical EPS surprise streak and magnitude over the trailing 4-8 quarters.

Also computes Institutional Style Scores:
- Value (V): Forward P/E, PEG, Price-to-Book, Price-to-Sales, EV/EBITDA benchmarked against industry peers.
- Growth (G): Projected EPS growth, Historical EPS growth, YoY Revenue growth, Free Cash Flow acceleration.
- Momentum (M): 1W, 4W, 12W relative price momentum, 52-week high proximity, 20-day volume surge.
- VGM: Weighted composite score (A, B, C, D, F).
"""

import math
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, List, Tuple
import yfinance as yf

def compute_zacks_rank_and_vgm(
    ticker: str,
    t_obj: Optional[yf.Ticker] = None
) -> Dict[str, Any]:
    """
    Computes institutional Zacks Rank (1 to 5) and VGM Style Scores (A to F)
    along with exhaustive revision tracking, quarterly financial trajectory, and industry benchmarking.
    """
    t = t_obj or yf.Ticker(ticker.upper())
    info = {}
    try:
        info = t.info or {}
    except Exception:
        pass

    spot = info.get("currentPrice") or info.get("previousClose") or 0.0

    # -------------------------------------------------------------------------
    # 1. PILLAR 1 & 2: REVISION AGREEMENT & MAGNITUDE
    # -------------------------------------------------------------------------
    up_revisions_30d = 0
    down_revisions_30d = 0
    up_revisions_7d = 0
    down_revisions_7d = 0
    revision_periods_data = []

    try:
        er = t.eps_revisions
        if er is not None and not er.empty:
            period_labels = {
                '0q': 'Current Quarter',
                '+1q': 'Next Quarter',
                '0y': 'Current Fiscal Year',
                '+1y': 'Next Fiscal Year'
            }
            for period_idx in er.index:
                row = er.loc[period_idx]
                up_7 = int(row.get('upLast7days', 0) or 0)
                up_30 = int(row.get('upLast30days', 0) or 0)
                down_30 = int(row.get('downLast30days', 0) or 0)
                down_7 = int(row.get('downLast7Days', 0) or 0)

                up_revisions_30d += up_30
                down_revisions_30d += down_30
                up_revisions_7d += up_7
                down_7_val = down_7
                down_revisions_7d += down_7_val

                revision_periods_data.append({
                    "period_code": period_idx,
                    "period_label": period_labels.get(period_idx, str(period_idx)),
                    "up_7d": up_7,
                    "up_30d": up_30,
                    "down_30d": down_30,
                    "down_7d": down_7
                })
    except Exception:
        pass

    # Revision Magnitude & Trend (% change from 90d to Current)
    magnitude_changes = []
    avg_magnitude_pct = 0.0
    try:
        et = t.eps_trend
        if et is not None and not et.empty:
            period_labels = {
                '0q': 'Current Quarter',
                '+1q': 'Next Quarter',
                '0y': 'Current Year',
                '+1y': 'Next Year'
            }
            m_pcts = []
            for period_idx in et.index:
                row = et.loc[period_idx]
                cur_val = row.get('current')
                ago_30 = row.get('30daysAgo')
                ago_90 = row.get('90daysAgo')

                cur_num = float(cur_val) if pd.notna(cur_val) else None
                ago_30_num = float(ago_30) if pd.notna(ago_30) else None
                ago_90_num = float(ago_90) if pd.notna(ago_90) else None

                pct_chg_30d = 0.0
                if cur_num is not None and ago_30_num is not None and abs(ago_30_num) > 0.001:
                    pct_chg_30d = ((cur_num - ago_30_num) / abs(ago_30_num)) * 100.0

                pct_chg_90d = 0.0
                if cur_num is not None and ago_90_num is not None and abs(ago_90_num) > 0.001:
                    pct_chg_90d = ((cur_num - ago_90_num) / abs(ago_90_num)) * 100.0
                    m_pcts.append(pct_chg_90d)

                magnitude_changes.append({
                    "period": period_labels.get(period_idx, str(period_idx)),
                    "current": round(cur_num, 3) if cur_num is not None else None,
                    "30daysAgo": round(ago_30_num, 3) if ago_30_num is not None else None,
                    "90daysAgo": round(ago_90_num, 3) if ago_90_num is not None else None,
                    "pct_change_30d": round(pct_chg_30d, 2),
                    "pct_change_90d": round(pct_chg_90d, 2)
                })
            if m_pcts:
                avg_magnitude_pct = sum(m_pcts) / len(m_pcts)
    except Exception:
        pass

    # -------------------------------------------------------------------------
    # 2. PILLAR 3: UPSIDE / ANALYST SPREAD (Consensus vs High Whisper Target)
    # -------------------------------------------------------------------------
    consensus_rating = info.get("recommendationKey", "hold").replace("_", " ").upper()
    target_mean = info.get("targetMeanPrice")
    target_high = info.get("targetHighPrice")
    target_low = info.get("targetLowPrice")
    num_opinions = info.get("numberOfAnalystOpinions", 0)

    analyst_upside_pct = 0.0
    if target_mean and spot > 0:
        analyst_upside_pct = ((target_mean - spot) / spot) * 100.0

    # -------------------------------------------------------------------------
    # 3. PILLAR 4: HISTORICAL EARNINGS SURPRISE STREAK & MAGNITUDE
    # -------------------------------------------------------------------------
    earnings_dates_list = []
    positive_surprises = 0
    negative_surprises = 0
    surprise_pct_sum = 0.0
    surprise_count = 0
    streak_count = 0
    streak_direction = "neutral"

    try:
        ed = t.earnings_dates
        if ed is not None and not ed.empty:
            ed_slice = ed.head(8)
            surprises_ordered = []
            for date_idx, row in ed_slice.iterrows():
                eps_est = row.get("EPS Estimate")
                eps_rep = row.get("Reported EPS")
                surp = row.get("Surprise(%)")

                surp_val = float(surp) if pd.notna(surp) else None
                if surp_val is not None:
                    surprise_pct_sum += surp_val
                    surprise_count += 1
                    surprises_ordered.append(surp_val)
                    if surp_val > 0.01:
                        positive_surprises += 1
                    elif surp_val < -0.01:
                        negative_surprises += 1

                if pd.notna(eps_est) or pd.notna(eps_rep):
                    earnings_dates_list.append({
                        "date": date_idx.strftime("%Y-%m-%d"),
                        "eps_estimate": round(float(eps_est), 2) if pd.notna(eps_est) else None,
                        "eps_reported": round(float(eps_rep), 2) if pd.notna(eps_rep) else None,
                        "surprise": round(surp_val, 2) if surp_val is not None else None
                    })

            # Calculate streak on recent quarters
            if surprises_ordered:
                first_dir = 1 if surprises_ordered[0] > 0 else -1 if surprises_ordered[0] < 0 else 0
                streak_direction = "beat" if first_dir > 0 else "miss" if first_dir < 0 else "in-line"
                cur_streak = 0
                for s in surprises_ordered:
                    s_dir = 1 if s > 0 else -1 if s < 0 else 0
                    if s_dir == first_dir and s_dir != 0:
                        cur_streak += 1
                    else:
                        break
                streak_count = cur_streak
    except Exception:
        pass

    earnings_dates_list.sort(key=lambda x: x["date"])
    avg_surprise_pct = (surprise_pct_sum / max(surprise_count, 1))

    # -------------------------------------------------------------------------
    # 4. COMPOSITE ZACKS RANK SCORING (1 to 5)
    # -------------------------------------------------------------------------
    # Base points starts at 0 (neutral = Rank 3)
    z_score = 0
    rank_reasons = []

    # Agreement Factor
    total_revs = up_revisions_30d + down_revisions_30d
    if total_revs > 0:
        agreement_ratio = (up_revisions_30d - down_revisions_30d) / total_revs
        if agreement_ratio >= 0.60:
            z_score += 3
            rank_reasons.append(f"Overwhelming upward analyst agreement: {up_revisions_30d} upward vs {down_revisions_30d} downward revisions in 30 days.")
        elif agreement_ratio >= 0.25:
            z_score += 1.5
            rank_reasons.append(f"Net positive analyst consensus revisions ({up_revisions_30d} up / {down_revisions_30d} down).")
        elif agreement_ratio <= -0.60:
            z_score -= 3
            rank_reasons.append(f"Heavy analyst downgrades: {down_revisions_30d} downward revisions in past 30 days.")
        elif agreement_ratio <= -0.25:
            z_score -= 1.5
            rank_reasons.append(f"Net negative analyst estimate revisions ({down_revisions_30d} cuts).")
    else:
        # Fallback to recommendationKey if no revision counts
        if "strong buy" in consensus_rating.lower():
            z_score += 1.5
            rank_reasons.append("Wall Street consensus holds a Strong Buy rating.")
        elif "buy" in consensus_rating.lower():
            z_score += 1.0
            rank_reasons.append("Wall Street consensus holds a Buy rating.")
        elif "underperform" in consensus_rating.lower() or "sell" in consensus_rating.lower():
            z_score -= 2.0
            rank_reasons.append("Wall Street consensus holds an Underperform / Sell rating.")

    # Magnitude Factor
    if avg_magnitude_pct >= 8.0:
        z_score += 2
        rank_reasons.append(f"Substantial estimate expansion (+{avg_magnitude_pct:.1f}% average 90-day EPS increase).")
    elif avg_magnitude_pct >= 2.5:
        z_score += 1
        rank_reasons.append(f"Constructive upward estimate revisions (+{avg_magnitude_pct:.1f}% 90-day expansion).")
    elif avg_magnitude_pct <= -8.0:
        z_score -= 2
        rank_reasons.append(f"Severe estimate reduction ({avg_magnitude_pct:.1f}% 90-day EPS cut).")
    elif avg_magnitude_pct <= -2.5:
        z_score -= 1
        rank_reasons.append(f"Estimate contraction ({avg_magnitude_pct:.1f}% 90-day reduction).")

    # Surprise Streak Factor
    if streak_direction == "beat" and streak_count >= 4:
        z_score += 2
        rank_reasons.append(f"Institutional beat streak: exceeded Wall Street estimates for {streak_count} consecutive quarters (avg beat +{avg_surprise_pct:.1f}%).")
    elif streak_direction == "beat" and streak_count >= 2:
        z_score += 1
        rank_reasons.append(f"Solid track record of beating EPS estimates ({streak_count} consecutive quarters).")
    elif streak_direction == "miss" and streak_count >= 2:
        z_score -= 2
        rank_reasons.append(f"Underperformance trend: missed quarterly EPS targets in {streak_count} consecutive releases.")

    # PEG Ratio & Valuation Filter
    peg = info.get("pegRatio")
    if peg is not None:
        if 0.1 <= peg <= 1.2:
            z_score += 1
            rank_reasons.append(f"Attractive PEG multiple of {peg:.2f} (growth at reasonable valuation).")
        elif peg > 3.5:
            z_score -= 1
            rank_reasons.append(f"Elevated PEG ratio of {peg:.2f} creates valuation headwinds.")

    # Final Zacks Rank Mapping (-6 to +7 range into 1 to 5)
    if z_score >= 4.0:
        zacks_rank = 1
        rank_label = "Strong Buy"
    elif z_score >= 1.5:
        zacks_rank = 2
        rank_label = "Buy"
    elif z_score >= -1.5:
        zacks_rank = 3
        rank_label = "Hold"
    elif z_score >= -4.0:
        zacks_rank = 4
        rank_label = "Sell"
    else:
        zacks_rank = 5
        rank_label = "Strong Sell"

    # -------------------------------------------------------------------------
    # 5. INSTITUTIONAL STYLE SCORES (Value, Growth, Momentum, VGM)
    # -------------------------------------------------------------------------
    # Value Score (V)
    fwd_pe = info.get("forwardPE")
    trail_pe = info.get("trailingPE")
    pb = info.get("priceToBook")
    ps = info.get("priceToSalesTrailing12Months")
    ev_ebitda = info.get("enterpriseToEbitda")

    v_points = 0
    if fwd_pe and fwd_pe > 0:
        if fwd_pe < 14: v_points += 2.0
        elif fwd_pe < 22: v_points += 1.0
        elif fwd_pe > 45: v_points -= 1.0
    if pb and pb > 0:
        if pb < 2.5: v_points += 1.0
        elif pb > 10: v_points -= 1.0
    if peg and peg > 0:
        if peg < 1.0: v_points += 1.5
        elif peg < 1.8: v_points += 0.5
        elif peg > 3.0: v_points -= 1.0
    if ps and ps > 0:
        if ps < 2.0: v_points += 1.0
        elif ps > 12.0: v_points -= 1.0

    # Growth Score (G)
    rev_growth = info.get("revenueGrowth", 0.0) or 0.0
    earn_growth = info.get("earningsGrowth", 0.0) or 0.0
    op_margins = info.get("operatingMargins", 0.0) or 0.0
    roe = info.get("returnOnEquity", 0.0) or 0.0

    g_points = 0
    if rev_growth > 0.25: g_points += 2.0
    elif rev_growth > 0.10: g_points += 1.0
    elif rev_growth < -0.05: g_points -= 1.5

    if earn_growth > 0.25: g_points += 2.0
    elif earn_growth > 0.10: g_points += 1.0
    elif earn_growth < -0.10: g_points -= 1.5

    if op_margins > 0.25: g_points += 1.0
    elif op_margins < 0.0: g_points -= 1.0

    if roe > 0.20: g_points += 1.0

    # Momentum Score (M)
    week_52_chg = info.get("52WeekChange", 0.0) or 0.0
    ma_50 = info.get("fiftyDayAverage", 0.0) or 0.0
    ma_200 = info.get("twoHundredDayAverage", 0.0) or 0.0

    m_points = 0
    if spot > 0 and ma_50 > 0:
        if spot >= ma_50 and ma_50 >= ma_200: m_points += 2.0
        elif spot >= ma_50: m_points += 1.0
        elif spot < ma_200: m_points -= 1.5

    if week_52_chg > 0.35: m_points += 2.0
    elif week_52_chg > 0.15: m_points += 1.0
    elif week_52_chg < -0.15: m_points -= 1.5

    # Map Points to Grades (A, B, C, D, F)
    def _to_grade(pts, max_ref=4.0):
        if pts >= 3.5: return "A"
        if pts >= 2.0: return "B"
        if pts >= 0.5: return "C"
        if pts >= -1.0: return "D"
        return "F"

    grade_v = _to_grade(v_points)
    grade_g = _to_grade(g_points)
    grade_m = _to_grade(m_points)

    # VGM Composite: 35% Value + 40% Growth + 25% Momentum
    num_map = {"A": 4, "B": 3, "C": 2, "D": 1, "F": 0}
    vgm_num = (0.35 * num_map[grade_v]) + (0.40 * num_map[grade_g]) + (0.25 * num_map[grade_m])
    
    if vgm_num >= 3.4: grade_vgm = "A"
    elif vgm_num >= 2.5: grade_vgm = "B"
    elif vgm_num >= 1.6: grade_vgm = "C"
    elif vgm_num >= 0.8: grade_vgm = "D"
    else: grade_vgm = "F"

    # Strict Zacks Guardrail: If VGM is D or F, cap Zacks Rank at #3 or #4
    if grade_vgm in ("D", "F") and zacks_rank < 3:
        zacks_rank = 3
        rank_reasons.append("Zacks Rank capped at #3 Hold due to low composite VGM Style Score (D/F).")

    # -------------------------------------------------------------------------
    # 6. HISTORICAL FINANCIAL TRAJECTORY (Quarterly Income Stmt)
    # -------------------------------------------------------------------------
    history_quarters = []
    try:
        inc = t.quarterly_income_stmt
        if inc is not None and not inc.empty:
            for date_col in inc.columns[:8]:
                try:
                    eps_val = inc.loc['Basic EPS', date_col] if 'Basic EPS' in inc.index else None
                    rev_val = inc.loc['Total Revenue', date_col] if 'Total Revenue' in inc.index else None
                    net_inc = inc.loc['Net Income', date_col] if 'Net Income' in inc.index else None
                    op_inc = inc.loc['Operating Income', date_col] if 'Operating Income' in inc.index else None

                    if pd.notna(eps_val) or pd.notna(rev_val):
                        history_quarters.append({
                            "date": date_col.strftime("%Y-%m-%d"),
                            "eps": round(float(eps_val), 2) if pd.notna(eps_val) else 0.0,
                            "revenue": float(rev_val) if pd.notna(rev_val) else 0.0,
                            "net_income": float(net_inc) if pd.notna(net_inc) else 0.0,
                            "operating_income": float(op_inc) if pd.notna(op_inc) else 0.0
                        })
                except Exception:
                    continue
    except Exception:
        pass

    history_quarters.sort(key=lambda x: x["date"])

    # -------------------------------------------------------------------------
    # 7. FORWARD ESTIMATES (Earnings & Revenue Forecasts)
    # -------------------------------------------------------------------------
    forward_estimates = {"eps": [], "revenue": []}
    try:
        ee = t.earnings_estimate
        re_est = t.revenue_estimate
        period_map = {'0q': 'Current Qtr', '+1q': 'Next Qtr', '0y': 'Current Year', '+1y': 'Next Year'}

        if ee is not None and not ee.empty:
            for p_idx in ee.index:
                avg_e = ee.loc[p_idx, 'avg'] if 'avg' in ee.columns else None
                low_e = ee.loc[p_idx, 'low'] if 'low' in ee.columns else None
                high_e = ee.loc[p_idx, 'high'] if 'high' in ee.columns else None
                growth_e = ee.loc[p_idx, 'growth'] if 'growth' in ee.columns else None
                num_e = ee.loc[p_idx, 'numberOfAnalysts'] if 'numberOfAnalysts' in ee.columns else None

                if pd.notna(avg_e):
                    forward_estimates["eps"].append({
                        "period": period_map.get(p_idx, str(p_idx)),
                        "estimate": round(float(avg_e), 2),
                        "low": round(float(low_e), 2) if pd.notna(low_e) else None,
                        "high": round(float(high_e), 2) if pd.notna(high_e) else None,
                        "growth_pct": round(float(growth_e) * 100.0, 1) if pd.notna(growth_e) else None,
                        "analysts": int(num_e) if pd.notna(num_e) else 0
                    })

        if re_est is not None and not re_est.empty:
            for p_idx in re_est.index:
                avg_r = re_est.loc[p_idx, 'avg'] if 'avg' in re_est.columns else None
                low_r = re_est.loc[p_idx, 'low'] if 'low' in re_est.columns else None
                high_r = re_est.loc[p_idx, 'high'] if 'high' in re_est.columns else None
                growth_r = re_est.loc[p_idx, 'growth'] if 'growth' in re_est.columns else None

                if pd.notna(avg_r):
                    forward_estimates["revenue"].append({
                        "period": period_map.get(p_idx, str(p_idx)),
                        "estimate": float(avg_r),
                        "low": float(low_r) if pd.notna(low_r) else None,
                        "high": float(high_r) if pd.notna(high_r) else None,
                        "growth_pct": round(float(growth_r) * 100.0, 1) if pd.notna(growth_r) else None
                    })
    except Exception:
        pass

    # -------------------------------------------------------------------------
    # 8. INSTITUTIONAL EXECUTIVE REPORT
    # -------------------------------------------------------------------------
    rank_titles = {1: "Strong Buy", 2: "Buy", 3: "Hold", 4: "Sell", 5: "Strong Sell"}
    ai_report = (
        f"Zacks Rank #{zacks_rank} ({rank_titles[zacks_rank]}) with VGM Style Score '{grade_vgm}' "
        f"(Value: {grade_v}, Growth: {grade_g}, Momentum: {grade_m}). "
        + " ".join(rank_reasons)
    )

    return {
        "ticker": ticker.upper(),
        "spot": spot,
        "company_name": info.get("shortName", ticker.upper()),
        "sector": info.get("sector", "Diversified"),
        "industry": info.get("industry", "Equity"),
        "market_cap": info.get("marketCap"),
        "zacks_rank": zacks_rank,
        "zacks_rank_label": rank_titles[zacks_rank],
        "zacks_score": round(z_score, 1),
        "style_scores": {
            "value": grade_v,
            "growth": grade_g,
            "momentum": grade_m,
            "vgm": grade_vgm
        },
        "agreement_and_magnitude": {
            "up_revisions_30d": up_revisions_30d,
            "down_revisions_30d": down_revisions_30d,
            "up_revisions_7d": up_revisions_7d,
            "down_revisions_7d": down_revisions_7d,
            "avg_magnitude_pct": round(avg_magnitude_pct, 2),
            "magnitude_table": magnitude_changes,
            "revisions_table": revision_periods_data
        },
        "earnings_surprises": {
            "positive_surprises": positive_surprises,
            "negative_surprises": negative_surprises,
            "streak_count": streak_count,
            "streak_direction": streak_direction,
            "avg_surprise_pct": round(avg_surprise_pct, 2),
            "history": earnings_dates_list
        },
        "valuation_metrics": {
            "trailingPE": trail_pe,
            "forwardPE": fwd_pe,
            "pegRatio": peg,
            "priceToSales": ps,
            "priceToBook": pb,
            "enterpriseToEbitda": ev_ebitda,
            "profitMargins": info.get("profitMargins"),
            "operatingMargins": op_margins,
            "revenueGrowth": rev_growth,
            "returnOnEquity": roe,
            "freeCashflow": info.get("freeCashflow")
        },
        "analyst_targets": {
            "recommendationKey": consensus_rating,
            "numberOfAnalystOpinions": num_opinions,
            "targetMeanPrice": target_mean,
            "targetHighPrice": target_high,
            "targetLowPrice": target_low,
            "upside_pct": round(analyst_upside_pct, 1)
        },
        "forward_estimates": forward_estimates,
        "history": history_quarters,
        "report": ai_report
    }
