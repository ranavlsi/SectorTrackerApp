import json
import os
import sys
import time
import math
from datetime import datetime
from typing import Dict, Any, List
import pandas as pd
import numpy as np

try:
    import yfinance as yf
except ImportError:
    yf = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..'))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

SCREENER_DATA_PATH = os.path.join(PROJECT_ROOT, "public", "screener_results.json")
RS_DATA_PATH = os.path.join(PROJECT_ROOT, "public", "rs_scanner_results.json")
SQUEEZE_DATA_PATH = os.path.join(PROJECT_ROOT, "public", "squeeze_results.json")
EMERGING_LEADERS_PATH = os.path.join(PROJECT_ROOT, "public", "emerging_leaders.json")
IGNITION_DATA_PATH = os.path.join(PROJECT_ROOT, "public", "pre_breakout_ignition_results.json")
FIRST_PULLBACK_PATH = os.path.join(PROJECT_ROOT, "public", "first_ma_pullback_results.json")
CLEAN_UPTREND_PATH = os.path.join(PROJECT_ROOT, "public", "clean_uptrend_results.json")
BEST_ACTING_PATH = os.path.join(PROJECT_ROOT, "public", "best_acting_stocks.json")
REALSIMPLE_PATH = os.path.join(PROJECT_ROOT, "public", "realsimple_results.json")
SEASONALITY_PATH = os.path.join(PROJECT_ROOT, "public", "seasonality_results.json")
SECTOR_FLOW_PATH = os.path.join(PROJECT_ROOT, "public", "sector_flow.json")
HEALTH_DATA_PATH = os.path.join(PROJECT_ROOT, "public", "market_health.json")
PLAYBOOK_JSON_PATH = os.path.join(PROJECT_ROOT, "public", "ai_playbook.json")
PLAYBOOK_MD_PATH = os.path.join(PROJECT_ROOT, "public", "ai_playbook.md")

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _add_candidate_signal(
    candidates: Dict[str, Dict[str, Any]],
    ticker: str,
    label: str,
    metric_str: str,
    weight: int,
    raw_cat: str,
    extra_meta: Dict[str, Any] = None
):
    if not ticker or not isinstance(ticker, str):
        return
    t = ticker.upper().strip()
    if not t or len(t) > 6 or not t.replace("-", "").replace(".", "").isalnum():
        return
    if t not in candidates:
        candidates[t] = {
            "ticker": t,
            "screeners": [label],
            "metrics": [metric_str],
            "score": weight,
            "raw_categories": [raw_cat],
            "engine_meta": extra_meta or {}
        }
    else:
        if label not in candidates[t]["screeners"]:
            candidates[t]["screeners"].append(label)
            candidates[t]["metrics"].append(metric_str)
            candidates[t]["score"] += weight
            candidates[t]["raw_categories"].append(raw_cat)
        if extra_meta:
            candidates[t]["engine_meta"].update(extra_meta)


def load_options_lookup() -> Dict[str, Dict[str, Any]]:
    """Loads the 5,700+ symbol CBOE options flow & positioning summary lookup."""
    lookup = {}
    try:
        from options_screener_engine import get_options_screener_summary
        summary = get_options_screener_summary()
        for rec in summary.get("records", []):
            t = (rec.get("ticker") or "").upper().strip()
            if t:
                lookup[t] = rec
    except Exception as e:
        print(f"[AI Playbook] Warning loading options_screener_engine: {e}")
    return lookup


def load_rs_scanner_lookup() -> Dict[str, Dict[str, Any]]:
    """Loads full RS Line Scanner lookup from public/rs_scanner_results.json."""
    lookup = {}
    if not os.path.exists(RS_DATA_PATH):
        return lookup
    try:
        with open(RS_DATA_PATH, "r") as f:
            rs_data = json.load(f)
        for item in rs_data.get("results", []):
            t = (item.get("ticker") or "").upper().strip()
            if t:
                lookup[t] = item
    except Exception as e:
        print(f"[AI Playbook] Warning loading rs_scanner_results.json: {e}")
    return lookup


def load_seasonality_lookup() -> Dict[str, Dict[str, Any]]:
    """Loads 10-year cyclical seasonality lookup from public/seasonality_results.json."""
    lookup = {}
    if not os.path.exists(SEASONALITY_PATH):
        return lookup
    try:
        with open(SEASONALITY_PATH, "r") as f:
            s_data = json.load(f)
        for key in ("all_candidates", "top_picks", "seasonal_breakout_leaders", "upcoming_monthly_tailwinds"):
            for item in s_data.get(key, []) or []:
                if isinstance(item, dict):
                    t = (item.get("ticker") or "").upper().strip()
                    if t and t not in lookup:
                        lookup[t] = item
    except Exception as e:
        print(f"[AI Playbook] Warning loading seasonality_results.json: {e}")
    return lookup


def load_sector_rrg_lookup() -> Dict[str, Dict[str, Any]]:
    """Loads sector RRG quadrant and money flow state from sector_flow.json."""
    sector_map = {}
    if not os.path.exists(SECTOR_FLOW_PATH):
        return sector_map
    try:
        with open(SECTOR_FLOW_PATH, "r") as f:
            sf = json.load(f)
        rrg = sf.get("rrg", {})
        for sec_name, sec_data in rrg.items():
            if isinstance(sec_data, dict):
                sector_map[sec_name.lower()] = {
                    "sector_name": sec_name,
                    "quadrant": sec_data.get("quadrant", "Leading"),
                    "rs_ratio": round(float(sec_data.get("rs_ratio", 100.0)), 2),
                    "rs_momentum": round(float(sec_data.get("rs_momentum", 100.0)), 2),
                }
    except Exception as e:
        print(f"[AI Playbook] Warning loading sector_flow.json: {e}")
    return sector_map


def load_all_screener_candidates(
    options_lookup: Dict[str, Dict[str, Any]],
    rs_lookup: Dict[str, Dict[str, Any]],
    seasonality_lookup: Dict[str, Dict[str, Any]]
) -> Dict[str, Dict[str, Any]]:
    """Aggregates candidates across all 11 institutional engines, computing multi-factor confluence."""
    candidates: Dict[str, Dict[str, Any]] = {}

    # 1. 39 Expert Screeners
    if os.path.exists(SCREENER_DATA_PATH):
        try:
            with open(SCREENER_DATA_PATH, "r") as f:
                data = json.load(f)
            for category, items in data.items():
                if not isinstance(items, list):
                    continue
                cat_label = category.replace("_", " ").title()
                weight = 2 if any(k in category for k in ("breakout", "vcp", "zacks", "cup_handle", "base", "emerging")) else 1
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    t = item.get("ticker")
                    metric = item.get("metric", "")
                    _add_candidate_signal(
                        candidates, t, cat_label, f"**{cat_label}**: {metric}", weight, category
                    )
        except Exception as e:
            print(f"[AI Playbook] Error reading screener_results: {e}")

    # 2. RS Scanner Leaders
    if rs_lookup:
        top_rs = sorted(
            rs_lookup.values(),
            key=lambda r: (float(r.get("rs_rating") or 0), float(r.get("mansfield_rs") or 0)),
            reverse=True
        )[:85]
        for item in top_rs:
            t = item.get("ticker", "")
            rs_val = item.get("rs_rating", 85)
            pat = item.get("pattern_status") or item.get("rs_badge") or "RS New High"
            bdot = " · 🔵 Blue Dot RS Lead" if item.get("is_blue_dot") else ""
            _add_candidate_signal(
                candidates,
                t,
                "RS Line Leader",
                f"**RS Line Scanner**: RS Rating {rs_val} | {pat}{bdot}",
                3,
                "relative_strength",
                {"rs_rating": rs_val, "rs_pattern": pat, "is_blue_dot": item.get("is_blue_dot")}
            )

    # 3. Squeeze Radar
    if os.path.exists(SQUEEZE_DATA_PATH):
        try:
            with open(SQUEEZE_DATA_PATH, "r") as f:
                sq_data = json.load(f)
            for sq_type, items in sq_data.items():
                if not isinstance(items, list):
                    continue
                label = sq_type.replace("_", " ").title()
                for item in items[:30]:
                    t = item.get("ticker", "")
                    _add_candidate_signal(
                        candidates,
                        t,
                        label,
                        f"**{label}**: {item.get('setup', label)}",
                        2,
                        sq_type
                    )
        except Exception as e:
            print(f"[AI Playbook] Error reading squeeze_results: {e}")

    # 4. Stage 2A Emerging Leaders Scanner
    if os.path.exists(EMERGING_LEADERS_PATH):
        try:
            with open(EMERGING_LEADERS_PATH, "r") as f:
                el_data = json.load(f)
            for item in el_data.get("candidates", [])[:40]:
                t = item.get("ticker", "")
                sc = item.get("score", 80)
                tier_lbl = item.get("tier_label", "Stage 2A Leader")
                pinch = item.get("pinch_spread_pct", "")
                _add_candidate_signal(
                    candidates,
                    t,
                    "Emerging Leader",
                    f"**Emerging Leader ({tier_lbl})**: Score {sc}/100 | MA Pinch {pinch}%",
                    3,
                    "emerging_leader_vcp",
                    {"emerging_score": sc, "emerging_tier": tier_lbl, "emerging_pivot": item.get("entry_pivot")}
                )
        except Exception as e:
            print(f"[AI Playbook] Error reading emerging_leaders: {e}")

    # 5. Pre-Breakout Ignition Squeeze Engine
    if os.path.exists(IGNITION_DATA_PATH):
        try:
            with open(IGNITION_DATA_PATH, "r") as f:
                ig_data = json.load(f)
            for item in ig_data.get("results", [])[:35]:
                t = item.get("ticker", "")
                ig_sc = item.get("ignition_score", 78)
                vdu = item.get("vdu_ratio", 0.55)
                dist = item.get("dist_to_breakout_pct", 1.5)
                _add_candidate_signal(
                    candidates,
                    t,
                    "Pre-Breakout Ignition",
                    f"**Pre-Breakout Coil**: Ignition {ig_sc}/100 | VDU {vdu}x | {dist}% to Pivot",
                    3,
                    "pre_breakout_squeeze",
                    {"ignition_score": ig_sc, "vdu_ratio": vdu, "high_60d": item.get("high_60d")}
                )
        except Exception as e:
            print(f"[AI Playbook] Error reading pre_breakout_ignition: {e}")

    # 6. Holy Grail 1st MA Pullback Scanner
    if os.path.exists(FIRST_PULLBACK_PATH):
        try:
            with open(FIRST_PULLBACK_PATH, "r") as f:
                fp_data = json.load(f)
            for item in fp_data.get("results", [])[:25]:
                t = item.get("ticker", "")
                ma_t = item.get("ma_tested", "21-EMA")
                clv = item.get("close_location_value", 0.72)
                imp = item.get("impulse_gain_pct", 18.0)
                _add_candidate_signal(
                    candidates,
                    t,
                    "1st MA Pullback",
                    f"**Holy Grail 1st Pullback**: Testing {ma_t} (${item.get('ma_price')}) | Prior Impulse +{imp}% | CLV {clv}",
                    3,
                    "first_ma_pullback",
                    {"ma_tested": ma_t, "clv": clv}
                )
        except Exception as e:
            print(f"[AI Playbook] Error reading first_ma_pullback: {e}")

    # 7. Clean Institutional Uptrend Scanner
    if os.path.exists(CLEAN_UPTREND_PATH):
        try:
            with open(CLEAN_UPTREND_PATH, "r") as f:
                cu_data = json.load(f)
            for item in cu_data.get("stocks", [])[:20]:
                t = item.get("ticker", "")
                streak = item.get("streak_above_50", 30)
                _add_candidate_signal(
                    candidates,
                    t,
                    "Clean Institutional Uptrend",
                    f"**Clean Uptrend**: {streak}d Above 50-SMA | Algorithmic Stair-Step",
                    2,
                    "clean_uptrend",
                    {"uptrend_streak": streak}
                )
        except Exception as e:
            print(f"[AI Playbook] Error reading clean_uptrend: {e}")

    # 8. Best-Acting ADX Apex Leaders
    if os.path.exists(BEST_ACTING_PATH):
        try:
            with open(BEST_ACTING_PATH, "r") as f:
                ba_data = json.load(f)
            for item in ba_data.get("stocks", [])[:35]:
                t = item.get("ticker", "")
                sc = item.get("score", 85)
                adx_v = item.get("adx", 28)
                rs_out = item.get("rs_outperformance_pct", 10)
                _add_candidate_signal(
                    candidates,
                    t,
                    "ADX Apex Leader",
                    f"**ADX Best-Acting Leader**: Score {sc} | ADX {adx_v} | RS Outperformance +{rs_out}%",
                    2,
                    "best_acting_breakout",
                    {"adx": adx_v, "rs_outperformance_pct": rs_out}
                )
        except Exception as e:
            print(f"[AI Playbook] Error reading best_acting_stocks: {e}")

    # 9. RealSimple 3-Line Execution Setups
    if os.path.exists(REALSIMPLE_PATH):
        try:
            with open(REALSIMPLE_PATH, "r") as f:
                rs_simple = json.load(f)
            for item in rs_simple.get("stocks", [])[:20]:
                t = item.get("ticker", "")
                stype = item.get("setup_type", "3-Line Alignment")
                _add_candidate_signal(
                    candidates,
                    t,
                    "RealSimple 3-Line",
                    f"**RealSimple Framework**: {stype} | Score {item.get('score', 82)}",
                    2,
                    "realsimple_ma_pullback"
                )
        except Exception as e:
            print(f"[AI Playbook] Error reading realsimple_results: {e}")

    # 10. Enrich candidates with Seasonality Radar Tailwinds
    for t, s_rec in seasonality_lookup.items():
        seas = s_rec.get("seasonality") or {}
        cur_w = float(seas.get("cur_month_win") or 50.0)
        cur_avg = float(seas.get("cur_month_avg") or 0.0)
        nxt_w = float(seas.get("next_month_win") or 50.0)
        nxt_avg = float(seas.get("next_month_avg") or 0.0)
        sc = float(s_rec.get("score") or 70)
        if t in candidates or sc >= 85:
            if cur_w >= 70 or nxt_w >= 75 or cur_avg >= 2.5 or nxt_avg >= 3.0:
                cur_m = seas.get("cur_month_name") or "Cur"
                nxt_m = seas.get("next_month_name") or "Next"
                _add_candidate_signal(
                    candidates,
                    t,
                    "Seasonality Tailwind",
                    f"**Seasonality Radar**: {cur_m} ({cur_w:.0f}% Win, {cur_avg:+.1f}%) → {nxt_m} ({nxt_w:.0f}% Win, {nxt_avg:+.1f}%)",
                    2,
                    "seasonality_tailwind"
                )

    # 11. Enrich candidates with Options Whale / Tailwind signals from CBOE Options Screener
    for t, cand in list(candidates.items()):
        opt = options_lookup.get(t)
        if not opt:
            continue
        flow_sig = opt.get("flow_signal", "")
        active_sigs = opt.get("active_signals", []) or []
        call_pct = float(opt.get("call_vol_pct") or 50.0)
        vol_ratio = float(opt.get("vol_ratio") or 1.0)
        if flow_sig == "OPTIONS_TAILWIND" or "WHALE_SWEEPS" in active_sigs or (call_pct >= 68 and vol_ratio >= 1.4):
            badge_lbl = opt.get("flow_signal_badge") or "🚀 Options Tailwind"
            driver_lbl = opt.get("flow_driver_label") or f"{call_pct:.0f}% Call Dominance"
            _add_candidate_signal(
                candidates,
                t,
                "Options Whale Flow",
                f"**{badge_lbl}**: {driver_lbl} ({call_pct:.0f}% Calls, {vol_ratio:.1f}x Opt Vol)",
                3,
                "options_gamma_squeeze" if "GAMMA" in (opt.get("flow_driver") or "") else "options_tailwind"
            )

        # Also check if candidate has RS Scanner leadership even if outside top 85
        rs_rec = rs_lookup.get(t)
        if rs_rec and "RS Line Leader" not in cand["screeners"]:
            rs_val = float(rs_rec.get("rs_rating") or 0)
            if rs_val >= 85 or rs_rec.get("is_blue_dot"):
                pat = rs_rec.get("pattern_status") or rs_rec.get("rs_badge") or "Strong RS"
                _add_candidate_signal(
                    candidates,
                    t,
                    "RS Line Leader",
                    f"**RS Line Scanner**: RS Rating {int(rs_val)} | {pat}",
                    2,
                    "relative_strength",
                    {"rs_rating": int(rs_val), "rs_pattern": pat, "is_blue_dot": rs_rec.get("is_blue_dot")}
                )

    return candidates


def classify_playbook(raw_categories: List[str], screeners: List[str]) -> Dict[str, str]:
    """Classifies a candidate into one of 4 tactical AI playbooks."""
    all_tags = " ".join(raw_categories + screeners).lower()

    if any(k in all_tags for k in ("squeeze", "short_interest", "gamma", "pre_breakout_squeeze")):
        return {
            "id": "squeeze_gamma",
            "name": "Short Squeeze & Gamma Runner 🔥",
            "badge": "SQUEEZE / GAMMA",
            "color": "purple",
            "strategy": "Long Call Outright or Bull Call Debit Vertical"
        }
    elif any(k in all_tags for k in ("pullback", "squat", "rejection", "support", "ma", "avwap", "vah", "first_ma_pullback")):
        return {
            "id": "ma_pullback",
            "name": "Moving Average Cushion & Pullback 🛡️",
            "badge": "MA PULLBACK",
            "color": "cyan",
            "strategy": "Bull Put Credit Spread or ATM Long Call"
        }
    elif any(k in all_tags for k in ("zacks", "earning", "growth", "revenue", "pead")):
        return {
            "id": "fundamental_acceleration",
            "name": "Fundamental Momentum & Earnings Acceleration 📈",
            "badge": "FUNDAMENTAL ACCELERATION",
            "color": "amber",
            "strategy": "Bull Call Debit Spread or Diagonal Calendar"
        }
    else:
        return {
            "id": "alpha_breakout",
            "name": "Alpha Breakout & Volatility Contraction 🚀",
            "badge": "ALPHA BREAKOUT",
            "color": "emerald",
            "strategy": "Bull Call Vertical Spread or Equity Breakout"
        }


def compute_seasonality_intel(
    ticker: str,
    s_rec: Dict[str, Any],
    hist_5y: pd.DataFrame
) -> Dict[str, Any]:
    """Computes or extracts 10-year monthly cyclical seasonality intelligence for the ticker."""
    now = datetime.now()
    cur_m_idx = now.month
    nxt_m_idx = 1 if cur_m_idx == 12 else cur_m_idx + 1
    cur_m_name = MONTH_NAMES[cur_m_idx - 1]
    nxt_m_name = MONTH_NAMES[nxt_m_idx - 1]

    monthly_12 = []
    cur_win, cur_avg = 60.0, 1.2
    nxt_win, nxt_avg = 65.0, 1.8

    if s_rec and isinstance(s_rec.get("seasonality"), dict):
        seas = s_rec["seasonality"]
        monthly_12 = seas.get("monthly_12") or []
        # Find exact current & next month from monthly_12 if present
        cur_item = next((m for m in monthly_12 if m.get("month") == cur_m_idx or m.get("name") == cur_m_name), None)
        nxt_item = next((m for m in monthly_12 if m.get("month") == nxt_m_idx or m.get("name") == nxt_m_name), None)
        if cur_item:
            cur_win = round(float(cur_item.get("win_rate", 60.0)), 1)
            cur_avg = round(float(cur_item.get("avg_return", 1.2)), 2)
        else:
            cur_win = round(float(seas.get("cur_month_win", 60.0)), 1)
            cur_avg = round(float(seas.get("cur_month_avg", 1.2)), 2)
        if nxt_item:
            nxt_win = round(float(nxt_item.get("win_rate", 65.0)), 1)
            nxt_avg = round(float(nxt_item.get("avg_return", 1.8)), 2)
        else:
            nxt_win = round(float(seas.get("next_month_win", 65.0)), 1)
            nxt_avg = round(float(seas.get("next_month_avg", 1.8)), 2)
    elif hist_5y is not None and not hist_5y.empty and len(hist_5y) >= 120:
        try:
            m_close = hist_5y["Close"].resample("ME").last()
            m_ret = m_close.pct_change().dropna() * 100.0
            for m_i in range(1, 13):
                sub = m_ret[m_ret.index.month == m_i]
                if len(sub) > 0:
                    w = round(float((sub > 0).sum() / len(sub) * 100.0), 0)
                    avg_r = round(float(sub.mean()), 2)
                else:
                    w, avg_r = 55.0, 0.8
                monthly_12.append({"month": m_i, "name": MONTH_NAMES[m_i - 1], "win_rate": int(w), "avg_return": avg_r})
                if m_i == cur_m_idx:
                    cur_win, cur_avg = w, avg_r
                if m_i == nxt_m_idx:
                    nxt_win, nxt_avg = w, avg_r
        except Exception:
            pass

    # Determine Seasonal Regime Badge & Score
    blended_win = cur_win * 0.55 + nxt_win * 0.45
    blended_ret = cur_avg * 0.55 + nxt_avg * 0.45
    if (cur_win >= 70 and cur_avg >= 1.5) or (nxt_win >= 75 and nxt_avg >= 2.0) or blended_ret >= 2.5:
        badge = f"🌊 Seasonal Tailwind ({cur_m_name} {cur_win:.0f}% Win · {cur_avg:+.1f}%)"
        status = "STRONG_TAILWIND"
        color = "#00E676"
        score = min(98, int(68 + blended_win * 0.25 + max(0, blended_ret * 2.5)))
    elif cur_win >= 55 or nxt_win >= 60 or blended_ret >= 0.5:
        badge = f"☀️ Favorable Seasonality ({cur_m_name} {cur_win:.0f}% Win · {cur_avg:+.1f}%)"
        status = "FAVORABLE"
        color = "#38bdf8"
        score = min(88, int(58 + blended_win * 0.25 + max(0, blended_ret * 2.0)))
    elif cur_avg < -1.0 and nxt_avg < 0:
        badge = f"⚠️ Seasonal Headwind ({cur_m_name} {cur_avg:+.1f}% Avg)"
        status = "HEADWIND"
        color = "#f59e0b"
        score = 52
    else:
        badge = f"⚖️ Neutral Seasonality ({cur_m_name} {cur_win:.0f}% Win)"
        status = "NEUTRAL"
        color = "#94a3b8"
        score = 68

    return {
        "status": status,
        "badge": badge,
        "color": color,
        "score": score,
        "cur_month_name": cur_m_name,
        "cur_month_win": cur_win,
        "cur_month_avg": cur_avg,
        "next_month_name": nxt_m_name,
        "next_month_win": nxt_win,
        "next_month_avg": nxt_avg,
        "monthly_12": monthly_12,
        "narrative": (
            f"{cur_m_name} historically delivers a {cur_win:.0f}% win rate ({cur_avg:+.1f}% avg return), "
            f"followed by {nxt_m_name} at {nxt_win:.0f}% win rate ({nxt_avg:+.1f}% avg return)."
        )
    }


def build_options_intel(
    ticker: str,
    current_price: float,
    entry_min: float,
    target_primary: float,
    target_secondary: float,
    playbook_info: Dict[str, str],
    opt_rec: Dict[str, Any],
    hv_30d: float = 28.0
) -> Dict[str, Any]:
    """Synthesizes real CBOE options flow, IV regime, VRP spread vs HV, GEX walls, and unusual sweep contracts."""
    long_k = round(entry_min * 2) / 2.0 if current_price < 50 else round(entry_min)
    short_k = round(target_primary * 2) / 2.0 if current_price < 50 else round(target_primary)
    if short_k <= long_k:
        short_k = round(target_secondary)

    if not opt_rec:
        atm_iv = round(max(18.0, hv_30d * 1.05), 1)
        vrp = round(atm_iv - hv_30d, 1)
        return {
            "has_live_options": False,
            "flow_status": "NEUTRAL",
            "flow_badge": "⚖️ Standard Flow",
            "flow_color": "#94a3b8",
            "flow_driver_label": "Balanced Dealer Positioning",
            "flow_implication": "No extreme options skew divergence detected; execute primarily off equity price & volume triggers.",
            "call_vol_pct": 55.0,
            "pcr_vol": 0.82,
            "pcr_oi": 0.90,
            "opt_vol_ratio": 1.0,
            "notional_flow_m": 0.0,
            "atm_iv_30d": atm_iv,
            "realized_hv_30d": round(hv_30d, 1),
            "vrp_spread": vrp,
            "iv_hv_ratio": round(atm_iv / max(hv_30d, 1.0), 2),
            "iv_rank": 35.0,
            "skew_25d": -2.0,
            "net_gex": 0.05,
            "max_pain": round(current_price * 0.98, 2),
            "oi_chg_5d_pct": 0.0,
            "iv_regime_label": "MODERATE IV REGIME",
            "iv_strategy_advice": f"Buy ${long_k:g} / ${short_k:g} Bull Call Vertical (30-45 DTE) to cap theta & vega risk.",
            "top_unusual_contract": None,
            "signal_tags": []
        }

    call_vol_pct = round(float(opt_rec.get("call_vol_pct") or 50.0), 1)
    pcr_vol = round(float(opt_rec.get("pcr_vol") or 0.85), 2)
    pcr_oi = round(float(opt_rec.get("pcr_oi") or 0.90), 2)
    opt_vol_ratio = round(float(opt_rec.get("vol_ratio") or 1.0), 2)
    notional_m = round(float(opt_rec.get("notional_flow") or 0.0) / 1e6, 2)
    atm_iv = round(float(opt_rec.get("atm_iv_30d") or max(18.0, hv_30d * 1.05)), 1)
    iv_rank = round(float(opt_rec.get("iv_rank") or 35.0), 1)
    skew_25d = round(float(opt_rec.get("skew_25d") or 0.0), 2)
    net_gex = round(float(opt_rec.get("net_gex") or 0.0), 3)
    max_pain = round(float(opt_rec.get("max_pain") or current_price), 2)
    oi_chg_5d_pct = round(float(opt_rec.get("oi_chg_5d_pct") or 0.0), 1)

    vrp_spread = round(atm_iv - hv_30d, 1)
    iv_hv_ratio = round(atm_iv / max(hv_30d, 1.0), 2)

    flow_sig = opt_rec.get("flow_signal") or ""
    if flow_sig == "OPTIONS_TAILWIND" or (call_vol_pct >= 62 and pcr_vol <= 0.70):
        flow_status = "CONFIRMED_BULLISH"
        flow_badge = opt_rec.get("flow_signal_badge") or "🚀 Options Flow Confirmed"
        flow_color = "#00E676"
    elif "DIVERGENCE" in flow_sig or "HEADWIND" in flow_sig or (call_vol_pct < 40 and pcr_vol > 1.35):
        flow_status = "BEARISH_DIVERGENCE"
        flow_badge = opt_rec.get("flow_signal_badge") or "⚠️ Put Hedging Divergence"
        flow_color = "#f59e0b"
    else:
        flow_status = "NEUTRAL_BALANCED"
        flow_badge = opt_rec.get("flow_signal_badge") or "⚖️ Balanced Options Flow"
        flow_color = "#38bdf8"

    if iv_rank <= 32 or iv_hv_ratio <= 0.92:
        iv_regime_label = f"CHEAP CONVEXITY ({iv_rank:.0f}% IVR · IV/HV {iv_hv_ratio}x)"
        iv_strategy_advice = (
            f"Implied Vol ({atm_iv}%) is cheap vs 30D Realized HV ({hv_30d:.1f}%, VRP {vrp_spread:+.1f}%). "
            f"Favor Long ${long_k:g} Call Outright (45-60 DTE, ~0.60Δ) or Long Call Diagonal."
        )
    elif iv_rank >= 60 or iv_hv_ratio >= 1.25:
        iv_regime_label = f"RICH VOL PREMIUM ({iv_rank:.0f}% IVR · IV/HV {iv_hv_ratio}x)"
        iv_strategy_advice = (
            f"Implied Vol ({atm_iv}%) commands a +{vrp_spread:.1f}% risk premium over 30D HV ({hv_30d:.1f}%). "
            f"Sell rich wing vol via ${long_k:g}/${short_k:g} Bull Call Spread or Bull Put Credit Spread."
        )
    else:
        iv_regime_label = f"FAIR VOL REGIME ({iv_rank:.0f}% IVR · IV/HV {iv_hv_ratio}x)"
        iv_strategy_advice = (
            f"Balanced vol pricing (30D IV {atm_iv}% vs 30D HV {hv_30d:.1f}%). "
            f"Execute ${long_k:g}/${short_k:g} Bull Call Vertical (30-45 DTE) for defined 1:3+ payoff."
        )

    unusual = opt_rec.get("top_unusual_contract")
    clean_unusual = None
    if isinstance(unusual, dict) and unusual.get("strike"):
        exp_raw = str(unusual.get("expiration") or "")[:10]
        clean_unusual = {
            "contract": unusual.get("contract", ""),
            "type": unusual.get("type", "CALL"),
            "strike": round(float(unusual.get("strike", 0)), 2),
            "expiration": exp_raw,
            "volume": int(unusual.get("volume") or 0),
            "open_interest": int(unusual.get("open_interest") or 0),
            "vol_oi_ratio": round(float(unusual.get("vol_oi_ratio") or 1.0), 2),
            "est_premium_k": round(float(unusual.get("est_premium") or 0.0) / 1000.0, 1)
        }

    return {
        "has_live_options": True,
        "flow_status": flow_status,
        "flow_badge": flow_badge,
        "flow_color": flow_color,
        "flow_driver_label": opt_rec.get("flow_driver_label") or "Institutional Options Positioning",
        "flow_implication": opt_rec.get("flow_implication") or opt_rec.get("flow_signal_desc") or "",
        "call_vol_pct": call_vol_pct,
        "pcr_vol": pcr_vol,
        "pcr_oi": pcr_oi,
        "opt_vol_ratio": opt_vol_ratio,
        "notional_flow_m": notional_m,
        "atm_iv_30d": atm_iv,
        "realized_hv_30d": round(hv_30d, 1),
        "vrp_spread": vrp_spread,
        "iv_hv_ratio": iv_hv_ratio,
        "iv_rank": iv_rank,
        "skew_25d": skew_25d,
        "net_gex": net_gex,
        "max_pain": max_pain,
        "oi_chg_5d_pct": oi_chg_5d_pct,
        "iv_regime_label": iv_regime_label,
        "iv_strategy_advice": iv_strategy_advice,
        "top_unusual_contract": clean_unusual,
        "signal_tags": (opt_rec.get("signal_tags") or [])[:4]
    }


def compute_institutional_execution(
    ticker: str,
    hist: pd.DataFrame,
    spy_hist: pd.DataFrame,
    playbook_info: Dict[str, str],
    current_price: float,
    cand: Dict[str, Any],
    opt_rec: Dict[str, Any],
    rs_rec: Dict[str, Any],
    seas_rec: Dict[str, Any],
    sector_rrg_map: Dict[str, Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Applies strict risk engineering and fuses:
    - 30-Day Price, RS Line vs SPY, and Volatility Movement Trajectory
    - Volatility Intelligence (HV10 vs HV30 compression, VRP = IV30 - HV30, Expected 30D Move, ATR shift)
    - RS Line Scanner Intelligence (RS Rating, 30D Alpha vs SPY, Blue Dot RS New High Ahead of Price)
    - 10-Year Cyclical Seasonality Intelligence (Current & Next Month Win Rate + Avg Return)
    - CBOE Options Flow & 3-Tranche Pyramid Execution Ticket
    """
    close = hist['Close']
    high = hist['High']
    low = hist['Low']
    volume = hist['Volume']

    # 1-Day, 5-Day, 10-Day, 30-Day Returns
    prev_close = float(close.iloc[-2]) if len(close) >= 2 else current_price
    change_1d_pct = round(((current_price - prev_close) / max(prev_close, 1e-6)) * 100, 2)

    p_5d = float(close.iloc[-6]) if len(close) >= 6 else float(close.iloc[0])
    p_10d = float(close.iloc[-11]) if len(close) >= 11 else float(close.iloc[0])
    p_30d = float(close.iloc[-30]) if len(close) >= 30 else float(close.iloc[0])

    ret_5d_pct = round(((current_price - p_5d) / max(p_5d, 1e-6)) * 100, 2)
    ret_10d_pct = round(((current_price - p_10d) / max(p_10d, 1e-6)) * 100, 2)
    ret_30d_pct = round(((current_price - p_30d) / max(p_30d, 1e-6)) * 100, 2)

    # SPY 30D Benchmark Return & 30D Alpha + 30D RS Line Series
    spy_ret_30d_pct = 0.0
    rs_line_30d_norm = []
    rs_30d_change_pct = ret_30d_pct
    rs_at_30d_high = False
    if spy_hist is not None and not spy_hist.empty and len(spy_hist) >= 30:
        spy_c = spy_hist['Close']
        spy_curr = float(spy_c.iloc[-1])
        spy_30 = float(spy_c.iloc[-30]) if len(spy_c) >= 30 else float(spy_c.iloc[0])
        spy_ret_30d_pct = round(((spy_curr - spy_30) / max(spy_30, 1e-6)) * 100, 2)

        tail_n = min(30, len(close), len(spy_c))
        stk_tail = close.tail(tail_n).values.astype(float)
        spy_tail = spy_c.tail(tail_n).values.astype(float)
        raw_rs = stk_tail / np.maximum(spy_tail, 1e-6)
        if len(raw_rs) >= 2 and raw_rs[0] > 0:
            rs_30d_change_pct = round(((raw_rs[-1] - raw_rs[0]) / raw_rs[0]) * 100, 2)
            rs_at_30d_high = bool(raw_rs[-1] >= np.max(raw_rs) * 0.997)
            # Scale RS line onto the stock's 30D price range for dual-overlay sparkline visualization
            rs_min, rs_max = float(np.min(raw_rs)), float(np.max(raw_rs))
            p_min, p_max = float(np.min(stk_tail)), float(np.max(stk_tail))
            if rs_max > rs_min and p_max > p_min:
                rs_line_30d_norm = [
                    round(p_min + ((val - rs_min) / (rs_max - rs_min)) * (p_max - p_min), 2)
                    for val in raw_rs
                ]

    alpha_30d_pct = round(ret_30d_pct - spy_ret_30d_pct, 2)

    # 30-Day High/Low Range Position, Up/Down Days & Max Drawdown
    high_30d = float(high.tail(30).max())
    low_30d = float(low.tail(30).min())
    range_pos_30d_pct = round(((current_price - low_30d) / max(high_30d - low_30d, 1e-6)) * 100, 1)

    diffs_30d = close.diff().tail(30).dropna()
    up_days_30d = int((diffs_30d > 0).sum())
    down_days_30d = int((diffs_30d <= 0).sum())

    close_30d = close.tail(30)
    roll_max_30d = close_30d.cummax()
    dd_30d = ((close_30d - roll_max_30d) / roll_max_30d.replace(0, np.nan)).min()
    max_dd_30d_pct = round(float(dd_30d * 100) if not pd.isna(dd_30d) else -2.0, 2)

    # -------------------------------------------------------------------------
    # Volatility Intelligence & 30-Day Volatility Shift (HV10 vs HV30, ATR Shift, BB Width)
    # -------------------------------------------------------------------------
    log_rets = np.log(close / close.shift(1)).dropna()
    hv_10d = round(float(log_rets.tail(10).std() * np.sqrt(252) * 100), 1) if len(log_rets) >= 10 else 25.0
    hv_30d = round(float(log_rets.tail(30).std() * np.sqrt(252) * 100), 1) if len(log_rets) >= 30 else hv_10d
    hv_60d = round(float(log_rets.tail(60).std() * np.sqrt(252) * 100), 1) if len(log_rets) >= 60 else hv_30d
    hv_compression_ratio = round(hv_10d / max(hv_30d, 1.0), 2)
    hv_30d_shift_pct = round(((hv_10d - hv_30d) / max(hv_30d, 1.0)) * 100, 1)

    # ATR(14) & 30-Day ATR Shift
    tr_series = (high - low)
    tr = tr_series.tail(14).mean()
    atr = float(tr) if not math.isnan(tr) and tr > 0 else current_price * 0.03
    atr_pct = round((atr / current_price) * 100, 2)
    atr_30d_ago = float(tr_series.iloc[-34:-20].mean()) if len(tr_series) >= 35 else atr
    atr_30d_shift_pct = round(((atr - atr_30d_ago) / max(atr_30d_ago, 1e-6)) * 100, 1)

    # Bollinger Band Width (20, 2)
    sma_20_s = close.rolling(20).mean()
    std_20_s = close.rolling(20).std()
    bbw_series = ((4.0 * std_20_s) / sma_20_s.replace(0, np.nan) * 100.0).dropna()
    bb_width_pct = round(float(bbw_series.iloc[-1]), 2) if len(bbw_series) > 0 else round(atr_pct * 3.2, 2)
    bbw_pct_rank = 50.0
    if len(bbw_series) >= 20:
        tail_bbw = bbw_series.tail(60)
        bbw_pct_rank = round(float((tail_bbw <= bb_width_pct).sum() / len(tail_bbw) * 100.0), 0)

    # Technical health metrics
    recent_high_20 = float(high.tail(20).max())
    recent_low_20 = float(low.tail(20).min())
    high_52w = float(high.tail(252).max()) if len(high) >= 50 else recent_high_20
    pct_from_52w_high = round(((current_price - high_52w) / max(high_52w, 1e-6)) * 100, 1)

    ema_10_series = close.ewm(span=10).mean()
    ema_21_series = close.ewm(span=21).mean()
    sma_50_series = close.rolling(50).mean()
    sma_200_series = close.rolling(200).mean()

    ema_10 = float(ema_10_series.iloc[-1])
    ema_21 = float(ema_21_series.iloc[-1])
    sma_50 = float(sma_50_series.iloc[-1]) if len(close) >= 50 else ema_21
    sma_200 = float(sma_200_series.iloc[-1]) if len(close) >= 200 else sma_50

    # 30-day sparkline & EMA + RS Line trajectories for inline chart
    tail_n = min(30, len(close))
    spark_dates = [str(d)[:10] for d in close.tail(tail_n).index]
    spark_close = [round(float(v), 2) for v in close.tail(tail_n).values]
    spark_ema10 = [round(float(v), 2) for v in ema_10_series.tail(tail_n).values]
    spark_ema21 = [round(float(v), 2) for v in ema_21_series.tail(tail_n).values]

    # RSI(14)
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0).tail(14).mean()
    loss = -delta.where(delta < 0, 0.0).tail(14).mean()
    rs = gain / max(loss, 1e-6)
    rsi_val = round(100.0 - (100.0 / (1.0 + rs)), 1)

    # Stage & MA Alignment
    ma_stack_bullish = (current_price >= ema_21 and ema_21 >= sma_50 and sma_50 >= sma_200)
    stage = "Stage 2 (Advancing)" if current_price >= sma_50 and sma_50 >= sma_200 else (
        "Stage 2A (Early Ignition)" if current_price >= ema_21 and current_price >= sma_50 else (
            "Stage 1 (Base Accumulation)" if current_price >= ema_21 else "Consolidation / Pullback"
        )
    )

    # Volume & Up/Down Volume Ratio (20d & 30d)
    avg_vol_20 = float(volume.tail(20).mean())
    curr_vol = float(volume.iloc[-1])
    vol_surge = round(curr_vol / max(avg_vol_20, 1.0), 2)

    recent_diffs = close.diff().tail(30)
    recent_vols = volume.tail(30)
    up_vol = float(recent_vols[recent_diffs > 0].sum())
    dn_vol = float(recent_vols[recent_diffs < 0].sum())
    ud_vol_ratio = round(up_vol / max(dn_vol, 1.0), 2)

    # -------------------------------------------------------------------------
    # Strict Institutional Risk Engineering & Stock-Specific Structural Targets
    # -------------------------------------------------------------------------
    playbook_id = playbook_info["id"]
    low_1d = float(low.iloc[-1])
    low_2d = float(low.iloc[-2]) if len(low) >= 2 else low_1d
    low_3d = float(low.tail(3).min())
    recent_20d_high = recent_high_20
    base_depth = max(recent_20d_high - recent_low_20, atr * 1.5)

    # 1. Tight Entry Corridor (bounded within 0.8% - 1.2% of spot)
    ideal_entry = round(current_price, 2)
    entry_min = round(current_price * 0.992, 2)
    entry_max = round(current_price * 1.008, 2)
    if playbook_id == "alpha_breakout" and recent_20d_high > current_price and recent_20d_high <= current_price * 1.02:
        entry_max = round(recent_20d_high * 1.002, 2)
    if entry_min > entry_max:
        entry_min, entry_max = entry_max, entry_min

    # Actionability Status
    if entry_min <= current_price <= entry_max:
        action_status = "IN_BUY_ZONE"
        action_label = "🎯 IN BUY ZONE"
        action_color = "#00E676"
    elif current_price < entry_min and current_price >= entry_min * 0.975:
        action_status = "COILING_BELOW_PIVOT"
        action_label = "⚡ COILING NEAR PIVOT"
        action_color = "#38bdf8"
    elif current_price > entry_max and current_price <= entry_max * 1.03:
        action_status = "BREAKOUT_ACTIVE"
        action_label = "🚀 ACTIVE BREAKOUT"
        action_color = "#a855f7"
    else:
        action_status = "WATCH_TRIGGER"
        action_label = "👀 STALKING ENTRY"
        action_color = "#fbbf24"

    # 2. Stock-Specific Structural Invalidation Floor (Stop Loss)
    if playbook_id == "alpha_breakout":
        raw_stop = min(low_1d, low_2d) - (0.10 * atr)
    elif playbook_id == "ma_pullback":
        raw_stop = min(ema_10, low_2d, low_1d) - (0.08 * atr)
    elif playbook_id == "squeeze_gamma":
        raw_stop = min(low_1d, low_2d) - (0.12 * atr)
    else:
        raw_stop = low_3d - (0.10 * atr)

    max_risk_price = round(ideal_entry * 0.965, 2)  # 3.5% max risk floor
    min_risk_price = round(ideal_entry * 0.988, 2)  # 1.2% min risk buffer
    stop_loss = round(max(min(raw_stop, min_risk_price), max_risk_price), 2)

    risk_dollars = max(ideal_entry - stop_loss, 0.01)
    stop_loss_pct = round(((stop_loss - ideal_entry) / ideal_entry) * 100, 1)

    # 3. Stock-Specific Structural Targets (Measured Moves & Confluence Levels)
    if playbook_id == "alpha_breakout":
        target_primary = round(recent_20d_high + max(0.50 * base_depth, 2.0 * atr), 2)
        target_secondary = round(recent_20d_high + max(1.00 * base_depth, 4.0 * atr), 2)
    elif playbook_id == "ma_pullback":
        target_primary = round(recent_20d_high + (0.35 * base_depth), 2)
        target_secondary = round(recent_20d_high + (0.85 * base_depth), 2)
    elif playbook_id == "squeeze_gamma":
        target_primary = round(recent_20d_high + max(0.65 * base_depth, 2.8 * atr), 2)
        target_secondary = round(recent_20d_high + max(1.30 * base_depth, 5.0 * atr), 2)
    else:
        target_primary = round(ideal_entry + max(recent_20d_high - ideal_entry + (1.5 * atr), 2.8 * atr), 2)
        target_secondary = round(ideal_entry + max(recent_20d_high - ideal_entry + (3.5 * atr), 5.0 * atr), 2)

    if target_primary < ideal_entry + (2.2 * risk_dollars):
        target_primary = round(ideal_entry + (2.4 * risk_dollars), 2)
    if target_primary > ideal_entry + (4.2 * risk_dollars):
        target_primary = round(ideal_entry + (4.2 * risk_dollars), 2)

    if target_secondary < target_primary * 1.06:
        target_secondary = round(target_primary + (1.8 * risk_dollars), 2)

    rew_dollars = max(target_primary - ideal_entry, 0.01)
    rr_ratio = round(rew_dollars / risk_dollars, 1)
    target_primary_pct = round(((target_primary - ideal_entry) / ideal_entry) * 100, 1)
    target_secondary_pct = round(((target_secondary - ideal_entry) / ideal_entry) * 100, 1)
    t2_rr = round(max(target_secondary - ideal_entry, 0.01) / risk_dollars, 1)

    # 3-Tranche Progressive Exposure Pyramid Plan
    tranche_1_price = entry_min
    tranche_2_price = ideal_entry
    tranche_3_price = round(min(entry_max * 1.004, ideal_entry + 0.35 * risk_dollars), 2)
    pyramid_plan = [
        {
            "tier": "Tranche 1 · Pilot (30%)",
            "weight_pct": 30,
            "trigger_price": tranche_1_price,
            "condition": f"Initiate 30% pilot position inside accumulation zone (${entry_min:.2f}–${ideal_entry:.2f})."
        },
        {
            "tier": "Tranche 2 · Confirmation (40%)",
            "weight_pct": 40,
            "trigger_price": tranche_2_price,
            "condition": f"Add 40% core size as price holds ${ideal_entry:.2f} with volume pace >= 1.1x ADV."
        },
        {
            "tier": "Tranche 3 · Full Size (30%)",
            "weight_pct": 30,
            "trigger_price": tranche_3_price,
            "condition": f"Complete final 30% on breakout expansion through ${tranche_3_price:.2f}; move stop to ${round(stop_loss + 0.25 * risk_dollars, 2):.2f}."
        }
    ]

    # Options intelligence & VRP (IV vs HV)
    options_intel = build_options_intel(
        ticker, current_price, entry_min, target_primary, target_secondary, playbook_info, opt_rec, hv_30d=hv_30d
    )

    # Volatility Intelligence Object (30D Vol Compression, VRP, Expected 30D Move)
    atm_iv = options_intel["atm_iv_30d"]
    vrp_spread = options_intel["vrp_spread"]
    iv_hv_ratio = options_intel["iv_hv_ratio"]
    exp_move_30d_pct = round(atm_iv * math.sqrt(30.0 / 365.0), 2)
    exp_move_30d_pts = round(current_price * (exp_move_30d_pct / 100.0), 2)

    if hv_compression_ratio <= 0.80 or bbw_pct_rank <= 25:
        vol_state = "COILING_SQUEEZE"
        vol_badge = f"🧬 Vol Coiling ({hv_30d_shift_pct:+.0f}% 10D/30D HV)"
        vol_color = "#a855f7"
    elif iv_hv_ratio <= 0.92:
        vol_state = "CHEAP_CONVEXITY"
        vol_badge = f"💎 Cheap Vega (IV/HV {iv_hv_ratio}x)"
        vol_color = "#00E676"
    elif iv_hv_ratio >= 1.25:
        vol_state = "RICH_PREMIUM"
        vol_badge = f"🔥 Rich IV Premium (VRP {vrp_spread:+.1f}%)"
        vol_color = "#f59e0b"
    else:
        vol_state = "ORDERLY_TREND_VOL"
        vol_badge = f"⚖️ Orderly Vol (IV/HV {iv_hv_ratio}x)"
        vol_color = "#00F0FF"

    volatility_intel = {
        "vol_state": vol_state,
        "vol_badge": vol_badge,
        "vol_color": vol_color,
        "atm_iv_30d": atm_iv,
        "realized_hv_10d": hv_10d,
        "realized_hv_30d": hv_30d,
        "realized_hv_60d": hv_60d,
        "vrp_spread": vrp_spread,
        "iv_hv_ratio": iv_hv_ratio,
        "hv_compression_ratio": hv_compression_ratio,
        "hv_30d_shift_pct": hv_30d_shift_pct,
        "atr_pct": atr_pct,
        "atr_30d_shift_pct": atr_30d_shift_pct,
        "bb_width_pct": bb_width_pct,
        "bb_width_percentile": bbw_pct_rank,
        "expected_move_30d_pct": exp_move_30d_pct,
        "expected_move_30d_pts": exp_move_30d_pts,
        "iv_rank": options_intel["iv_rank"],
        "skew_25d": options_intel["skew_25d"]
    }

    # RS Line Scanner Intelligence Object
    em = cand.get("engine_meta", {})
    rs_rating = int(
        (rs_rec.get("rs_rating") if rs_rec else None)
        or em.get("rs_rating")
        or (92 if alpha_30d_pct >= 10 else (85 if alpha_30d_pct >= 4 else 78))
    )
    is_blue_dot = bool((rs_rec and rs_rec.get("is_blue_dot")) or (rs_at_30d_high and pct_from_52w_high < -2.0))
    rs_badge = (
        (rs_rec.get("rs_badge") if rs_rec else None)
        or ("🔵 RS New High Before Price" if is_blue_dot else ("🔥 30D RS Breakout" if rs_at_30d_high else f"RS {rs_rating} Outperformer"))
    )
    mansfield_rs = round(float((rs_rec.get("mansfield_rs") if rs_rec else None) or (alpha_30d_pct * 0.85)), 2)
    trend_meter = (rs_rec.get("trend_meter_label") if rs_rec else None) or ("POWER UPTREND" if ma_stack_bullish else "ADVANCING")
    personality_label = (rs_rec.get("personality_label") if rs_rec else None) or ("Tight & Clean" if atr_pct <= 3.0 else "Momentum Leader")

    rs_intel = {
        "rs_rating": rs_rating,
        "rs_badge": rs_badge,
        "is_blue_dot": is_blue_dot,
        "rs_at_30d_high": rs_at_30d_high,
        "alpha_30d_pct": alpha_30d_pct,
        "rs_30d_change_pct": rs_30d_change_pct,
        "mansfield_rs": mansfield_rs,
        "trend_meter_label": trend_meter,
        "personality_label": personality_label
    }

    # Seasonality Intelligence Object
    seasonality_intel = compute_seasonality_intel(ticker, seas_rec, hist)

    # 30-Day Movement Summary Object ("How Things Moved in Last 30 Days")
    movement_30d = {
        "return_1d_pct": change_1d_pct,
        "return_5d_pct": ret_5d_pct,
        "return_10d_pct": ret_10d_pct,
        "return_30d_pct": ret_30d_pct,
        "spy_return_30d_pct": spy_ret_30d_pct,
        "alpha_30d_pct": alpha_30d_pct,
        "high_30d": round(high_30d, 2),
        "low_30d": round(low_30d, 2),
        "range_pos_30d_pct": range_pos_30d_pct,
        "up_days_30d": up_days_30d,
        "down_days_30d": down_days_30d,
        "max_drawdown_30d_pct": max_dd_30d_pct,
        "ud_vol_ratio_30d": ud_vol_ratio,
        "hv_30d_shift_pct": hv_30d_shift_pct,
        "atr_30d_shift_pct": atr_30d_shift_pct,
        "rs_30d_change_pct": rs_30d_change_pct,
        "narrative_30d": (
            f"Last 30D: Price {ret_30d_pct:+.1f}% ({alpha_30d_pct:+.1f}% Alpha vs SPY) across "
            f"{up_days_30d} Up / {down_days_30d} Down sessions (U/D Vol {ud_vol_ratio}x) · "
            f"Realized Vol {hv_30d_shift_pct:+.0f}% (10D HV {hv_10d}% vs 30D HV {hv_30d}%)."
        )
    }

    long_k = round(entry_min, 1)
    short_k = round(target_secondary, 1)
    options_spec = f"Buy ${long_k:.1f} Call / Sell ${short_k:.1f} Call ({playbook_info['badge']} Vertical)"

    # Sector & RRG Alignment
    sector_name = (opt_rec.get("sector") if opt_rec else None) or "Equities"
    sec_rrg = sector_rrg_map.get(sector_name.lower(), {
        "sector_name": sector_name,
        "quadrant": "Leading" if stage.startswith("Stage 2") else "Improving",
        "rs_ratio": 101.2,
        "rs_momentum": 100.8
    })

    # 6-Pillar Quantitative Conviction Breakdown (0-100 each)
    structure_score = min(99, int(
        (78 if stage.startswith("Stage 2") else 66)
        + (8 if ma_stack_bullish else 0)
        + (7 if pct_from_52w_high >= -8.0 else 3)
        + (5 if len(cand["screeners"]) >= 4 else 2)
    ))
    rs_sector_score = min(99, int(
        min(96, max(62, rs_rating)) * 0.72
        + (16 if sec_rrg["quadrant"] in ("Leading", "Improving") else 8)
        + (10 if alpha_30d_pct >= 5.0 or is_blue_dot else 4)
    ))
    volatility_score = min(99, int(
        (86 if vol_state in ("COILING_SQUEEZE", "CHEAP_CONVEXITY") else 76)
        + (8 if bbw_pct_rank <= 35 else 3)
        + (5 if abs(vrp_spread) >= 2.0 else 2)
    ))
    options_flow_score = min(99, int(
        (88 if options_intel["flow_status"] == "CONFIRMED_BULLISH" else (62 if options_intel["flow_status"] == "BEARISH_DIVERGENCE" else 74))
        + (8 if options_intel.get("top_unusual_contract") else 0)
        + (4 if options_intel["call_vol_pct"] >= 65 else 0)
    ))
    seasonality_score = min(99, int(seasonality_intel["score"]))
    asymmetry_score = min(99, int(
        min(52, rr_ratio * 15)
        + min(25, ud_vol_ratio * 14)
        + (22 if abs(stop_loss_pct) <= 2.8 else 14)
    ))

    pillars = {
        "structure": {"label": "Structure & Stage", "score": structure_score},
        "rs_sector": {"label": "RS Line & 30D Alpha", "score": rs_sector_score},
        "volatility": {"label": "Vol Regime & VRP", "score": volatility_score},
        "options_flow": {"label": "Options & Gamma", "score": options_flow_score},
        "seasonality": {"label": "Cyclical Seasonality", "score": seasonality_score},
        "asymmetry": {"label": "R:R & Vol Footprint", "score": asymmetry_score},
    }

    # Clubbed 5-Domain Decision Matrix (Why all engines agree)
    domain_checks = [
        {
            "domain": "30D Price & Stage",
            "aligned": bool(stage.startswith("Stage 2") or ret_30d_pct > 0),
            "summary": f"{stage} · 30D {ret_30d_pct:+.1f}% ({up_days_30d}W/{down_days_30d}L)"
        },
        {
            "domain": "RS Line Scanner",
            "aligned": bool(rs_rating >= 80 or alpha_30d_pct > 0),
            "summary": f"RS {rs_rating} · {alpha_30d_pct:+.1f}% 30D Alpha · {rs_badge}"
        },
        {
            "domain": "Volatility & VRP",
            "aligned": bool(hv_compression_ratio <= 1.05 or iv_hv_ratio <= 1.25),
            "summary": f"30D IV {atm_iv}% vs HV {hv_30d}% (10D/30D HV {hv_compression_ratio}x)"
        },
        {
            "domain": "Options Screener",
            "aligned": bool(options_intel["flow_status"] != "BEARISH_DIVERGENCE"),
            "summary": f"{options_intel['flow_badge']} ({options_intel['call_vol_pct']:.0f}% Calls)"
        },
        {
            "domain": "Seasonality Radar",
            "aligned": bool(seasonality_intel["status"] in ("STRONG_TAILWIND", "FAVORABLE", "NEUTRAL")),
            "summary": f"{seasonality_intel['cur_month_name']} {seasonality_intel['cur_month_win']:.0f}% Win ({seasonality_intel['cur_month_avg']:+.1f}%)"
        }
    ]
    aligned_domains_count = sum(1 for d in domain_checks if d["aligned"])

    # Synthesize crisp Institutional Clubbed Thesis Narrative
    top_screeners_str = ", ".join(cand["screeners"][:3])
    thesis_summary = (
        f"{ticker} clubs {aligned_domains_count}/5 institutional domains ({len(cand['screeners'])} engines: {top_screeners_str}): "
        f"30D Price moved {ret_30d_pct:+.1f}% ({alpha_30d_pct:+.1f}% Alpha vs SPY, RS Rating {rs_rating}), "
        f"10D/30D Realized Vol is {hv_compression_ratio}x ({hv_10d}% vs {hv_30d}% HV, 30D IV {atm_iv}%), "
        f"backed by {options_intel['flow_badge']} and {seasonality_intel['cur_month_name']} Seasonality ({seasonality_intel['cur_month_win']:.0f}% win rate). "
        f"Defined {stop_loss_pct}% stop (${stop_loss:.2f}) targets 1:{rr_ratio} R:R to T1 (${target_primary:.2f})."
    )

    checklist = [
        f"Phase 1 (Entry Zone): Execute Tranche 1 (30% pilot) inside ${entry_min:.2f} ── ${entry_max:.2f} accumulation corridor.",
        f"Phase 2 (30D RS & Vol Check): Confirm RS Line leadership (RS {rs_rating}, {alpha_30d_pct:+.1f}% 30D Alpha) and vol regime ({vol_badge}).",
        f"Phase 3 (Flow & Seasonality): Verify options flow ({options_intel['flow_badge']}) and {seasonality_intel['cur_month_name']} seasonal tailwind ({seasonality_intel['cur_month_win']:.0f}% win rate).",
        f"Phase 4 (Hard Invalidation): Set hard stop at ${stop_loss:.2f} ({stop_loss_pct}% risk = 1.0R). Never widen stop loss.",
        f"Phase 5 (Target Harvest & Trail): Trim 50% at T1 (${target_primary:.2f}, +{target_primary_pct}%, 1:{rr_ratio}R), move stop to breakeven, and trail runner to T2 (${target_secondary:.2f}, +{target_secondary_pct}%)."
    ]

    return {
        "entry_range": [entry_min, entry_max],
        "ideal_entry": ideal_entry,
        "stop_loss": stop_loss,
        "stop_loss_pct": stop_loss_pct,
        "risk_per_share": round(risk_dollars, 2),
        "target_primary": target_primary,
        "target_primary_pct": target_primary_pct,
        "target_secondary": target_secondary,
        "target_secondary_pct": target_secondary_pct,
        "risk_reward": f"1:{rr_ratio}",
        "risk_reward_num": rr_ratio,
        "risk_reward_t2": f"1:{t2_rr}",
        "risk_reward_t2_num": t2_rr,
        "action_status": action_status,
        "action_label": action_label,
        "action_color": action_color,
        "options_spec": options_spec,
        "options_intel": options_intel,
        "volatility_intel": volatility_intel,
        "rs_intel": rs_intel,
        "seasonality_intel": seasonality_intel,
        "movement_30d": movement_30d,
        "domain_checks": domain_checks,
        "aligned_domains_count": aligned_domains_count,
        "strategy_name": playbook_info["strategy"],
        "stage": stage,
        "ma_stack_bullish": ma_stack_bullish,
        "change_1d_pct": change_1d_pct,
        "pct_from_52w_high": pct_from_52w_high,
        "atr": round(atr, 2),
        "atr_pct": atr_pct,
        "rsi": rsi_val,
        "vol_surge": vol_surge,
        "ud_vol_ratio": ud_vol_ratio,
        "ema_10": round(ema_10, 2),
        "ema_21": round(ema_21, 2),
        "sma_50": round(sma_50, 2),
        "sma_200": round(sma_200, 2),
        "dist_ema10_pct": round(((current_price - ema_10) / max(ema_10, 1e-6)) * 100, 2),
        "dist_ema21_pct": round(((current_price - ema_21) / max(ema_21, 1e-6)) * 100, 2),
        "dist_sma50_pct": round(((current_price - sma_50) / max(sma_50, 1e-6)) * 100, 2),
        "sector": sec_rrg["sector_name"],
        "sector_quadrant": sec_rrg["quadrant"],
        "pillars": pillars,
        "pyramid_plan": pyramid_plan,
        "thesis_summary": thesis_summary,
        "sparkline": {
            "dates": spark_dates,
            "close": spark_close,
            "ema10": spark_ema10,
            "ema21": spark_ema21,
            "rs_norm": rs_line_30d_norm
        },
        "execution_checklist": checklist
    }


def generate_ai_playbook() -> Dict[str, Any]:
    """Core generator function: scans 11 engines, fuses 30D price/vol/RS + options + seasonality, and writes JSON & Markdown."""
    print("🚀 [AI Playbook 3.0] Starting 11-Engine Clubbed Synthesis (30D Movement + Volatility + RS Scanner + Seasonality + CBOE Options)...")

    # 1. Load Market Health posture
    regime_label = "HEALTHY BULL MARKET"
    regime_color = "#00E676"
    regime_score = 75
    rec_risk_pct = 1.25
    max_gross_exposure = "80% - 100%"
    if os.path.exists(HEALTH_DATA_PATH):
        try:
            with open(HEALTH_DATA_PATH, "r") as f:
                health = json.load(f)
                regime_score = float(health.get("current_health", {}).get("score_value", 75))
                regime_label = health.get("current_health", {}).get("health_regime", "HEALTHY BULL MARKET")
                if regime_score >= 60:
                    regime_color = "#00E676"
                    rec_risk_pct = 1.50
                    max_gross_exposure = "80% – 100% Gross Exposure"
                elif regime_score <= 40:
                    regime_color = "#f43f5e"
                    rec_risk_pct = 0.75
                    max_gross_exposure = "25% – 45% Defensive Exposure"
                else:
                    regime_color = "#fbbf24"
                    rec_risk_pct = 1.00
                    max_gross_exposure = "50% – 70% Tactical Exposure"
        except Exception:
            pass

    # 2. Load Options Screener, RS Scanner, Seasonality Radar & Sector RRG lookups
    options_lookup = load_options_lookup()
    rs_lookup = load_rs_scanner_lookup()
    seasonality_lookup = load_seasonality_lookup()
    sector_rrg_map = load_sector_rrg_lookup()

    # 3. Fetch SPY 1Y Benchmark History for exact 30D RS Line & Alpha calculation
    spy_hist = pd.DataFrame()
    try:
        spy_hist = yf.Ticker("SPY").history(period="1y")
    except Exception as e:
        print(f"[AI Playbook] Warning fetching SPY history: {e}")

    # 4. Ingest screener candidates across all 11 engines
    candidates = load_all_screener_candidates(options_lookup, rs_lookup, seasonality_lookup)
    if not candidates:
        print("[AI Playbook] No screener candidates found.")
        return {"error": "No screener candidates found"}

    sorted_tickers = sorted(
        candidates.keys(),
        key=lambda t: (candidates[t]["score"], len(candidates[t]["screeners"])),
        reverse=True
    )
    selected_tickers = sorted_tickers[:48]

    playbook_buckets: Dict[str, List[Dict[str, Any]]] = {
        "alpha_breakout": [],
        "ma_pullback": [],
        "squeeze_gamma": [],
        "fundamental_acceleration": []
    }

    all_setups: List[Dict[str, Any]] = []

    for ticker in selected_tickers:
        cand = candidates[ticker]
        playbook_meta = classify_playbook(cand["raw_categories"], cand["screeners"])
        p_id = playbook_meta["id"]

        if len(playbook_buckets[p_id]) >= 8 and len(all_setups) >= 28:
            continue

        try:
            t_obj = yf.Ticker(ticker)
            hist = t_obj.history(period="2y")
            if hist.empty or len(hist) < 35:
                continue

            current_price = float(hist['Close'].iloc[-1])
            if current_price < 5.0:
                continue

            opt_rec = options_lookup.get(ticker)
            rs_rec = rs_lookup.get(ticker)
            seas_rec = seasonality_lookup.get(ticker)

            exec_data = compute_institutional_execution(
                ticker, hist, spy_hist, playbook_meta, current_price, cand, opt_rec, rs_rec, seas_rec, sector_rrg_map
            )

            # Weighted composite conviction score from the 6 quantitative pillars + multi-screener confluence
            p_scores = exec_data["pillars"]
            pillar_avg = (
                p_scores["structure"]["score"] * 0.22 +
                p_scores["rs_sector"]["score"] * 0.20 +
                p_scores["volatility"]["score"] * 0.16 +
                p_scores["options_flow"]["score"] * 0.18 +
                p_scores["seasonality"]["score"] * 0.10 +
                p_scores["asymmetry"]["score"] * 0.14
            )
            confluence_bonus = min(13, len(cand["screeners"]) * 2)
            base_score = min(99, max(72, int(round(pillar_avg * 0.89 + confluence_bonus))))

            conviction_tier = "A+" if base_score >= 90 else ("A" if base_score >= 83 else "B+")
            conviction_rating = f"{base_score}/100 {conviction_tier} Institutional" if base_score >= 90 else (
                f"{base_score}/100 {conviction_tier} High Conviction" if base_score >= 83 else f"{base_score}/100 {conviction_tier} Tactical"
            )

            setup_dict = {
                "ticker": ticker,
                "current_price": round(current_price, 2),
                "playbook_id": p_id,
                "playbook_name": playbook_meta["name"],
                "playbook_badge": playbook_meta["badge"],
                "playbook_color": playbook_meta["color"],
                "conviction_score": base_score,
                "conviction_tier": conviction_tier,
                "conviction_rating": conviction_rating,
                "confluence_count": len(cand["screeners"]),
                "screeners": cand["screeners"],
                "metrics": cand["metrics"][:7],
                "execution": exec_data
            }

            playbook_buckets[p_id].append(setup_dict)
            all_setups.append(setup_dict)

        except Exception as err:
            print(f"[AI Playbook] Error processing {ticker}: {err}")
            continue

    all_setups = sorted(
        all_setups,
        key=lambda s: (
            s["conviction_score"],
            s["execution"].get("aligned_domains_count", 4),
            s["confluence_count"],
            s["execution"].get("risk_reward_num", 2.0)
        ),
        reverse=True
    )

    # Sort each bucket as well
    for k in playbook_buckets:
        playbook_buckets[k] = sorted(
            playbook_buckets[k],
            key=lambda s: (s["conviction_score"], s["confluence_count"]),
            reverse=True
        )

    # Portfolio & Desk Summary Telemetry
    in_buy_zone_count = sum(1 for s in all_setups if s["execution"].get("action_status") == "IN_BUY_ZONE")
    options_confirmed_count = sum(
        1 for s in all_setups if s["execution"].get("options_intel", {}).get("flow_status") == "CONFIRMED_BULLISH"
    )
    vol_squeeze_count = sum(
        1 for s in all_setups
        if s["execution"].get("volatility_intel", {}).get("vol_state") in ("COILING_SQUEEZE", "CHEAP_CONVEXITY")
    )
    seasonal_tailwind_count = sum(
        1 for s in all_setups
        if s["execution"].get("seasonality_intel", {}).get("status") in ("STRONG_TAILWIND", "FAVORABLE")
    )
    rs_leader_count = sum(
        1 for s in all_setups
        if s["execution"].get("rs_intel", {}).get("rs_rating", 0) >= 85
    )
    avg_rr = round(
        sum(s["execution"].get("risk_reward_num", 2.5) for s in all_setups) / max(len(all_setups), 1), 1
    )
    avg_stop_pct = round(
        sum(abs(s["execution"].get("stop_loss_pct", -2.5)) for s in all_setups) / max(len(all_setups), 1), 2
    )
    avg_30d_alpha = round(
        sum(s["execution"].get("movement_30d", {}).get("alpha_30d_pct", 0.0) for s in all_setups) / max(len(all_setups), 1), 1
    )

    date_str = datetime.now().strftime("%A, %B %d, %Y")
    payload = {
        "generated_at": datetime.now().isoformat(),
        "date_str": date_str,
        "engines_integrated": 11,
        "market_regime": {
            "label": regime_label,
            "score": regime_score,
            "color": regime_color,
            "recommended_risk_pct": rec_risk_pct,
            "max_gross_exposure": max_gross_exposure,
            "guidance": "Full Risk Budget (1.25% - 2.0% per trade · Pyramid winners)" if regime_score >= 60 else (
                "Defensive Sizing (0.50% - 0.75% per trade · Harvest T1 early)" if regime_score <= 40 else "Standard Tactical Allocation (1.0% per trade · Select A+ only)"
            )
        },
        "desk_summary": {
            "total_setups": len(all_setups),
            "in_buy_zone_count": in_buy_zone_count,
            "options_confirmed_count": options_confirmed_count,
            "vol_squeeze_count": vol_squeeze_count,
            "seasonal_tailwind_count": seasonal_tailwind_count,
            "rs_leader_count": rs_leader_count,
            "avg_30d_alpha_pct": avg_30d_alpha,
            "avg_asymmetry": f"1:{avg_rr}",
            "avg_stop_risk_pct": f"-{avg_stop_pct}%"
        },
        "total_setups": len(all_setups),
        "trade_of_the_day": all_setups[0] if all_setups else None,
        "focus_list": all_setups[:5],
        "playbooks": {
            "alpha_breakout": {
                "name": "Alpha Breakouts & VCPs 🚀",
                "count": len(playbook_buckets["alpha_breakout"]),
                "description": "Stage 2A Emerging Leaders, Volatility Contraction Patterns (VCP), and 52-Week High Pivots.",
                "setups": playbook_buckets["alpha_breakout"]
            },
            "ma_pullback": {
                "name": "Moving Average Pullbacks & Cushions 🛡️",
                "count": len(playbook_buckets["ma_pullback"]),
                "description": "Holy Grail 1st 21-EMA/50-SMA Retests, POC Rejections, and Low-Risk Institutional Cushions.",
                "setups": playbook_buckets["ma_pullback"]
            },
            "squeeze_gamma": {
                "name": "Short Squeeze & Gamma Runners 🔥",
                "count": len(playbook_buckets["squeeze_gamma"]),
                "description": "Pre-Breakout Ignition Coils, High Short Interest, and Dealer Call Gamma Accelerators.",
                "setups": playbook_buckets["squeeze_gamma"]
            },
            "fundamental_acceleration": {
                "name": "Fundamental Accelerators & PEAD 📈",
                "count": len(playbook_buckets["fundamental_acceleration"]),
                "description": "Zacks Rank #1, Triple-Digit Earnings Inflections, and Post-Earnings Drift Leaders.",
                "setups": playbook_buckets["fundamental_acceleration"]
            }
        },
        "all_setups": all_setups
    }

    try:
        with open(PLAYBOOK_JSON_PATH, "w") as f:
            json.dump(payload, f, indent=2)
        print(f"✅ [AI Playbook 3.0] Saved structured JSON ({len(all_setups)} setups) to {PLAYBOOK_JSON_PATH}")
    except Exception as e:
        print(f"❌ Failed to write JSON: {e}")

    md_content = f"# 🤖 Institutional Quantitative AI Playbook 3.0 (11-Engine Clubbed Intelligence)\n\n"
    md_content += f"**Generation Date:** {date_str}\n\n"
    md_content += f"**Market Posture:** `{regime_label}` (Health Score: {regime_score}/100) · {payload['market_regime']['guidance']}\n\n"
    md_content += "---\n\n"

    for i, s in enumerate(all_setups[:10], 1):
        ex = s["execution"]
        m30 = ex.get("movement_30d", {})
        vol_i = ex.get("volatility_intel", {})
        seas_i = ex.get("seasonality_intel", {})
        md_content += f"## {i}. ${s['ticker']} · {s['playbook_name']}\n"
        md_content += f"**Current Price:** ${s['current_price']} | **Conviction:** {s['conviction_rating']} | **Confluence:** {s['confluence_count']} Engines ({ex.get('aligned_domains_count', 5)}/5 Domains)\n\n"
        md_content += f"> {ex.get('thesis_summary', '')}\n\n"
        md_content += f"- **Last 30D Movement:** Price `{m30.get('return_30d_pct', 0):+.1f}%` (`{m30.get('alpha_30d_pct', 0):+.1f}%` Alpha vs SPY) · `{m30.get('up_days_30d', 15)}W/{m30.get('down_days_30d', 15)}L` · U/D Vol `{m30.get('ud_vol_ratio_30d', 1.2)}x`\n"
        md_content += f"- **Volatility Intelligence:** `{vol_i.get('vol_badge', '')}` · 30D IV `{vol_i.get('atm_iv_30d', 30)}%` vs 30D HV `{vol_i.get('realized_hv_30d', 25)}%` (10D HV `{vol_i.get('realized_hv_10d', 22)}%`)\n"
        md_content += f"- **Seasonality Intelligence:** `{seas_i.get('badge', '')}` → Next Month `{seas_i.get('next_month_name', '')}` (`{seas_i.get('next_month_win', 60):.0f}%` Win, `{seas_i.get('next_month_avg', 1.5):+.1f}%` Avg)\n\n"
        md_content += f"### 🎯 Precision Execution Deck\n"
        md_content += f"- **Accumulation Corridor:** `${ex['entry_range'][0]}` ── `${ex['entry_range'][1]}` ({ex.get('action_label')})\n"
        md_content += f"- **Invalidation Sentinel (Stop Loss):** `${ex['stop_loss']}` ({ex['stop_loss_pct']}% Risk Floor)\n"
        md_content += f"- **Target 1 (Pin Target):** `${ex['target_primary']}` (+{ex['target_primary_pct']}%) → *Trim 50% & Ratchet Stop to Breakeven*\n"
        md_content += f"- **Target 2 (Runner Target):** `${ex['target_secondary']}` (+{ex['target_secondary_pct']}%) → *15m / 10-EMA Trailing Stop*\n"
        md_content += f"- **Options Strategy:** `{ex['options_intel']['iv_strategy_advice']}`\n"
        md_content += f"- **Risk/Reward Expectancy:** `{ex['risk_reward']}` (T1) / `{ex['risk_reward_t2']}` (T2)\n\n"
        md_content += "---\n\n"

    try:
        with open(PLAYBOOK_MD_PATH, "w") as f:
            f.write(md_content)
        print(f"✅ [AI Playbook 3.0] Saved Markdown to {PLAYBOOK_MD_PATH}")
    except Exception as e:
        print(f"❌ Failed to write Markdown: {e}")

    return payload


if __name__ == "__main__":
    generate_ai_playbook()
