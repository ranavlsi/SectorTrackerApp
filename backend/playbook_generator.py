import json
import os
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

try:
    from sector_data_api import calculate_stage, calculate_macd, calculate_rsi, calculate_momentum_fade
except ImportError:
    def calculate_stage(c, s):
        if len(c) < 200: return "Stage 2 (Advancing)"
        curr = c.iloc[-1]
        sma = s.iloc[-1] if hasattr(s, 'iloc') else (c.rolling(200).mean().iloc[-1] if len(c) >= 200 else curr)
        return "Stage 2 (Advancing)" if curr >= sma else "Stage 1 (Base Accumulation)"
    def calculate_macd(c): return pd.Series([0]), pd.Series([0])
    def calculate_rsi(c): return pd.Series([55.0])
    def calculate_momentum_fade(m, s, r): return "🔥 Momentum Building (Bullish)", "#00E676"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..'))
SCREENER_DATA_PATH = os.path.join(PROJECT_ROOT, "public", "screener_results.json")
RS_DATA_PATH = os.path.join(PROJECT_ROOT, "public", "rs_scanner_results.json")
SQUEEZE_DATA_PATH = os.path.join(PROJECT_ROOT, "public", "squeeze_results.json")
HEALTH_DATA_PATH = os.path.join(PROJECT_ROOT, "public", "market_health.json")
PLAYBOOK_JSON_PATH = os.path.join(PROJECT_ROOT, "public", "ai_playbook.json")
PLAYBOOK_MD_PATH = os.path.join(PROJECT_ROOT, "public", "ai_playbook.md")


def load_all_screener_candidates() -> Dict[str, Dict[str, Any]]:
    """Aggregates candidates across all screeners, computing multi-factor confluence."""
    candidates = {}

    # 1. 39 Expert Screeners
    if os.path.exists(SCREENER_DATA_PATH):
        try:
            with open(SCREENER_DATA_PATH, "r") as f:
                data = json.load(f)
            for category, items in data.items():
                cat_label = category.replace("_", " ").title()
                weight = 2 if any(k in category for k in ("breakout", "vcp", "zacks", "cup_handle", "base")) else 1
                for item in items:
                    t = item.get("ticker")
                    if not t or not isinstance(t, str):
                        continue
                    t = t.upper().strip()
                    metric = item.get("metric", "")
                    if t not in candidates:
                        candidates[t] = {
                            "ticker": t,
                            "screeners": [cat_label],
                            "metrics": [f"**{cat_label}**: {metric}"],
                            "score": weight,
                            "raw_categories": [category]
                        }
                    else:
                        if cat_label not in candidates[t]["screeners"]:
                            candidates[t]["screeners"].append(cat_label)
                            candidates[t]["metrics"].append(f"**{cat_label}**: {metric}")
                            candidates[t]["score"] += weight
                            candidates[t]["raw_categories"].append(category)
        except Exception as e:
            print(f"[AI Playbook] Error reading screener_results: {e}")

    # 2. RS Scanner
    if os.path.exists(RS_DATA_PATH):
        try:
            with open(RS_DATA_PATH, "r") as f:
                rs_data = json.load(f)
            for item in rs_data.get("results", [])[:60]:
                t = item.get("ticker", "").upper().strip()
                if t:
                    label = "Relative Strength Leader"
                    rs_val = item.get("rs_rating", 85)
                    metric_str = f"**RS Leader**: Score {rs_val} | Pattern: {item.get('pattern_status', 'RS Blue Dot')}"
                    if t not in candidates:
                        candidates[t] = {
                            "ticker": t,
                            "screeners": [label],
                            "metrics": [metric_str],
                            "score": 3,
                            "raw_categories": ["relative_strength"]
                        }
                    else:
                        if label not in candidates[t]["screeners"]:
                            candidates[t]["screeners"].append(label)
                            candidates[t]["metrics"].append(metric_str)
                            candidates[t]["score"] += 3
                            candidates[t]["raw_categories"].append("relative_strength")
        except Exception as e:
            print(f"[AI Playbook] Error reading rs_scanner: {e}")

    # 3. Squeeze Radar
    if os.path.exists(SQUEEZE_DATA_PATH):
        try:
            with open(SQUEEZE_DATA_PATH, "r") as f:
                sq_data = json.load(f)
            for sq_type, items in sq_data.items():
                label = sq_type.replace("_", " ").title()
                for item in items[:25]:
                    t = item.get("ticker", "").upper().strip()
                    if t:
                        metric_str = f"**{label}**: {item.get('setup', label)}"
                        if t not in candidates:
                            candidates[t] = {
                                "ticker": t,
                                "screeners": [label],
                                "metrics": [metric_str],
                                "score": 2,
                                "raw_categories": [sq_type]
                            }
                        else:
                            if label not in candidates[t]["screeners"]:
                                candidates[t]["screeners"].append(label)
                                candidates[t]["metrics"].append(metric_str)
                                candidates[t]["score"] += 2
                                candidates[t]["raw_categories"].append(sq_type)
        except Exception as e:
            print(f"[AI Playbook] Error reading squeeze_results: {e}")

    return candidates


def classify_playbook(raw_categories: List[str], screeners: List[str]) -> Dict[str, str]:
    """Classifies a candidate into one of 4 tactical AI playbooks."""
    all_tags = " ".join(raw_categories + screeners).lower()

    if any(k in all_tags for k in ("squeeze", "short_interest", "gamma")):
        return {
            "id": "squeeze_gamma",
            "name": "Short Squeeze & Gamma Runner 🔥",
            "badge": "SQUEEZE / GAMMA",
            "color": "purple",
            "strategy": "Long Call Outright or Bull Call Debit Vertical"
        }
    elif any(k in all_tags for k in ("pullback", "squat", "rejection", "support", "ma", "avwap", "vah")):
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


def compute_institutional_execution(ticker: str, hist: pd.DataFrame, playbook_info: Dict[str, str], current_price: float) -> Dict[str, Any]:
    """
    Applies strict risk engineering to calculate precision accumulation corridors,
    structural invalidation floors, pin targets, and options specifications.
    """
    close = hist['Close']
    high = hist['High']
    low = hist['Low']
    volume = hist['Volume']

    # ATR(14)
    tr = (high - low).tail(14).mean()
    atr = float(tr) if not math.isnan(tr) and tr > 0 else current_price * 0.03

    # Technical health metrics
    recent_high_20 = float(high.tail(20).max())
    recent_low_20 = float(low.tail(20).min())
    ema_10 = float(close.ewm(span=10).mean().iloc[-1])
    ema_21 = float(close.ewm(span=21).mean().iloc[-1])
    sma_50 = float(close.rolling(50).mean().iloc[-1]) if len(close) >= 50 else ema_21
    sma_200 = float(close.rolling(200).mean().iloc[-1]) if len(close) >= 200 else sma_50

    # RSI
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0).tail(14).mean()
    loss = -delta.where(delta < 0, 0.0).tail(14).mean()
    rs = gain / max(loss, 1e-6)
    rsi_val = round(100.0 - (100.0 / (1.0 + rs)), 1)

    # Stage
    stage = "Stage 2 (Advancing)" if current_price >= sma_50 and sma_50 >= sma_200 else (
        "Stage 1 (Base Accumulation)" if current_price >= ema_21 else "Consolidation / Stage 3"
    )

    # Momentum
    avg_vol_20 = float(volume.tail(20).mean())
    curr_vol = float(volume.iloc[-1])
    vol_surge = round(curr_vol / max(avg_vol_20, 1.0), 2)

    # -------------------------------------------------------------------------
    # Strict Institutional Risk Engineering (Tight Corridor, Micro Stop, Asymmetric Targets)
    # -------------------------------------------------------------------------
    playbook_id = playbook_info["id"]

    recent_3d_low = float(low.tail(3).min())
    recent_5d_low = float(low.tail(5).min())
    recent_3d_high = float(high.tail(3).max())
    recent_20d_high = recent_high_20

    # 1. Tight Entry Corridor (bounded within 0.8% - 1.2% of spot)
    ideal_entry = current_price
    entry_min = round(current_price * 0.992, 2)
    entry_max = round(current_price * 1.008, 2)
    if playbook_id == "alpha_breakout" and recent_20d_high > current_price and recent_20d_high <= current_price * 1.02:
        entry_max = round(recent_20d_high * 1.002, 2)

    if entry_min > entry_max:
        entry_min, entry_max = entry_max, entry_min

    # 2. Tight Structural Invalidation Floor (Stop Loss)
    # Anchor to micro-structure swing low minus micro-buffer (0.10 * ATR)
    if playbook_id == "alpha_breakout":
        structural_stop = recent_3d_low - (0.10 * atr)
    elif playbook_id == "ma_pullback":
        structural_stop = min(recent_3d_low, float(close.tail(2).min())) - (0.10 * atr)
    elif playbook_id == "squeeze_gamma":
        structural_stop = recent_3d_low - (0.15 * atr)
    else: # fundamental_acceleration
        structural_stop = recent_5d_low - (0.10 * atr)

    # Strictly cap risk envelope between 1.2% and 3.2% maximum risk
    max_risk_price = round(ideal_entry * 0.968, 2)  # 3.2% max risk floor
    min_risk_price = round(ideal_entry * 0.988, 2)  # 1.2% min risk buffer (avoid noise)
    stop_loss = round(max(min(structural_stop, min_risk_price), max_risk_price), 2)

    risk_dollars = max(ideal_entry - stop_loss, 0.01)
    stop_loss_pct = round(((stop_loss - ideal_entry) / ideal_entry) * 100, 1)

    # 3. Asymmetric Profit Targets (Strict Minimum 2.5R to 4.5R)
    t1_from_r = ideal_entry + (2.5 * risk_dollars)
    target_primary = round(t1_from_r, 2)
    if recent_20d_high > target_primary and recent_20d_high <= ideal_entry + (3.5 * risk_dollars):
        target_primary = round(recent_20d_high, 2)
    if target_primary < ideal_entry + (2.2 * risk_dollars):
        target_primary = round(ideal_entry + (2.5 * risk_dollars), 2)

    target_secondary = round(ideal_entry + (4.5 * risk_dollars), 2)
    if target_secondary < target_primary * 1.05:
        target_secondary = round(target_primary * 1.08, 2)

    rew_dollars = max(target_primary - ideal_entry, 0.01)
    rr_ratio = round(rew_dollars / risk_dollars, 1)
    target_primary_pct = round(((target_primary - ideal_entry) / ideal_entry) * 100, 1)
    target_secondary_pct = round(((target_secondary - ideal_entry) / ideal_entry) * 100, 1)

    # Options strike specifications
    long_k = round(entry_min, 1)
    short_k = round(target_secondary, 1)
    options_spec = f"Buy ${long_k:.1f} Call / Sell ${short_k:.1f} Call ({playbook_info['badge']} Vertical)"

    # Execution checklist
    checklist = [
        f"Verify price action inside ${entry_min:.2f} ── ${entry_max:.2f} accumulation corridor.",
        f"Ensure volume confirmation (current volume ratio {vol_surge}x ADV).",
        f"Place tight structural invalidation stop at ${stop_loss:.2f} ({stop_loss_pct}% max risk).",
        f"Scale out 50% at Target 1 (${target_primary:.2f}, +{target_primary_pct}%, 1:{rr_ratio} R:R) and ratchet stop to Breakeven.",
        f"Trail remaining 50% toward Target 2 (${target_secondary:.2f}, +{target_secondary_pct}%, 1:4.5 R:R) using 15m trailing stop."
    ]

    return {
        "entry_range": [entry_min, entry_max],
        "ideal_entry": ideal_entry,
        "stop_loss": stop_loss,
        "stop_loss_pct": stop_loss_pct,
        "target_primary": target_primary,
        "target_primary_pct": target_primary_pct,
        "target_secondary": target_secondary,
        "target_secondary_pct": target_secondary_pct,
        "risk_reward": f"1:{rr_ratio}",
        "options_spec": options_spec,
        "strategy_name": playbook_info["strategy"],
        "stage": stage,
        "rsi": rsi_val,
        "vol_surge": vol_surge,
        "ema_10": round(ema_10, 2),
        "ema_21": round(ema_21, 2),
        "sma_50": round(sma_50, 2),
        "sma_200": round(sma_200, 2),
        "execution_checklist": checklist
    }


def generate_ai_playbook() -> Dict[str, Any]:
    """Core generator function: scans, scores, risk-engineers, and writes JSON and Markdown."""
    print("🚀 [AI Playbook 2.0] Starting Institutional Multi-Playbook Engine...")
    
    # 1. Load Market Health posture
    regime_label = "HEALTHY BULL MARKET"
    regime_color = "#00E676"
    regime_score = 75
    if os.path.exists(HEALTH_DATA_PATH):
        try:
            with open(HEALTH_DATA_PATH, "r") as f:
                health = json.load(f)
                regime_score = health.get("current_health", {}).get("score_value", 75)
                regime_label = health.get("current_health", {}).get("health_regime", "HEALTHY BULL MARKET")
                regime_color = "#00E676" if regime_score >= 60 else ("#f43f5e" if regime_score <= 40 else "#fbbf24")
        except Exception:
            pass

    # 2. Ingest screener candidates
    candidates = load_all_screener_candidates()
    if not candidates:
        print("[AI Playbook] No screener candidates found.")
        return {"error": "No screener candidates found"}

    sorted_tickers = sorted(candidates.keys(), key=lambda t: (candidates[t]["score"], len(candidates[t]["screeners"])), reverse=True)
    selected_tickers = sorted_tickers[:40]

    playbook_buckets = {
        "alpha_breakout": [],
        "ma_pullback": [],
        "squeeze_gamma": [],
        "fundamental_acceleration": []
    }

    all_setups = []

    for ticker in selected_tickers:
        cand = candidates[ticker]
        playbook_meta = classify_playbook(cand["raw_categories"], cand["screeners"])
        p_id = playbook_meta["id"]

        if len(playbook_buckets[p_id]) >= 4 and len(all_setups) >= 16:
            continue

        try:
            t_obj = yf.Ticker(ticker)
            hist = t_obj.history(period="1y")
            if hist.empty or len(hist) < 30:
                continue

            current_price = float(hist['Close'].iloc[-1])
            if current_price < 4.0:
                continue

            exec_data = compute_institutional_execution(ticker, hist, playbook_meta, current_price)

            base_score = min(98, int(60 + (cand["score"] * 5) + (exec_data["vol_surge"] * 5)))
            if exec_data["stage"].startswith("Stage 2"):
                base_score = min(99, base_score + 6)
            if 50 <= exec_data["rsi"] <= 68:
                base_score = min(99, base_score + 4)

            conviction_rating = f"{base_score}/100 A+ Institutional" if base_score >= 88 else (
                f"{base_score}/100 A High Conviction" if base_score >= 80 else f"{base_score}/100 B+ Tactical"
            )

            setup_dict = {
                "ticker": ticker,
                "current_price": round(current_price, 2),
                "playbook_id": p_id,
                "playbook_name": playbook_meta["name"],
                "playbook_badge": playbook_meta["badge"],
                "playbook_color": playbook_meta["color"],
                "conviction_score": base_score,
                "conviction_rating": conviction_rating,
                "confluence_count": len(cand["screeners"]),
                "screeners": cand["screeners"],
                "metrics": cand["metrics"][:4],
                "execution": exec_data
            }

            playbook_buckets[p_id].append(setup_dict)
            all_setups.append(setup_dict)

        except Exception as err:
            print(f"[AI Playbook] Error processing {ticker}: {err}")
            continue

    all_setups = sorted(all_setups, key=lambda s: s["conviction_score"], reverse=True)

    date_str = datetime.now().strftime("%A, %B %d, %Y")
    payload = {
        "generated_at": datetime.now().isoformat(),
        "date_str": date_str,
        "market_regime": {
            "label": regime_label,
            "score": regime_score,
            "color": regime_color,
            "guidance": "Full Risk Budget (1.5% - 2.5% per trade)" if regime_score >= 60 else (
                "Defensive Sizing (0.75% - 1.0% per trade)" if regime_score <= 40 else "Standard Tactical Allocation (1.0% - 1.5% per trade)"
            )
        },
        "total_setups": len(all_setups),
        "focus_list": all_setups[:5],
        "playbooks": {
            "alpha_breakout": {
                "name": "Alpha Breakouts & VCPs 🚀",
                "count": len(playbook_buckets["alpha_breakout"]),
                "description": "High Tight Flags, Volatility Contraction Patterns (VCP), and 52-Week ATH Pivots.",
                "setups": playbook_buckets["alpha_breakout"]
            },
            "ma_pullback": {
                "name": "Moving Average Pullbacks & Cushions 🛡️",
                "count": len(playbook_buckets["ma_pullback"]),
                "description": "Mean-reversion support bounces off the 10-EMA, 21-EMA, and Anchored VWAP cushions.",
                "setups": playbook_buckets["ma_pullback"]
            },
            "squeeze_gamma": {
                "name": "Short Squeeze & Gamma Runners 🔥",
                "count": len(playbook_buckets["squeeze_gamma"]),
                "description": "Elevated short interest and dealer short gamma acceleration setups.",
                "setups": playbook_buckets["squeeze_gamma"]
            },
            "fundamental_acceleration": {
                "name": "Fundamental Accelerators & PEAD 📈",
                "count": len(playbook_buckets["fundamental_acceleration"]),
                "description": "Zacks Rank #1, triple-digit revenue inflections, and post-earnings drift winners.",
                "setups": playbook_buckets["fundamental_acceleration"]
            }
        },
        "all_setups": all_setups
    }

    try:
        with open(PLAYBOOK_JSON_PATH, "w") as f:
            json.dump(payload, f, indent=2)
        print(f"✅ [AI Playbook] Saved structured JSON to {PLAYBOOK_JSON_PATH}")
    except Exception as e:
        print(f"❌ Failed to write JSON: {e}")

    md_content = f"# 🤖 Institutional Quantitative AI Playbook\n\n"
    md_content += f"**Generation Date:** {date_str}\n\n"
    md_content += f"**Market Posture:** `{regime_label}` (Health Score: {regime_score}/100) · {payload['market_regime']['guidance']}\n\n"
    md_content += "This Institutional Playbook clusters overnight algorithmic scanner results into 4 discrete tactical regimes with strict risk boundaries.\n\n"
    md_content += "---\n\n"

    for i, s in enumerate(all_setups[:8], 1):
        ex = s["execution"]
        md_content += f"## {i}. ${s['ticker']} · {s['playbook_name']}\n"
        md_content += f"**Current Price:** ${s['current_price']} | **Conviction:** {s['conviction_rating']} | **Confluence:** {s['confluence_count']} Screeners\n\n"
        md_content += f"**Algorithmic Confluence Drivers:**\n"
        for m in s["metrics"]:
            md_content += f"- {m}\n"
        md_content += "\n"
        md_content += f"### 🎯 Precision Execution Deck\n"
        md_content += f"- **Accumulation Corridor:** `${ex['entry_range'][0]}` ── `${ex['entry_range'][1]}`\n"
        md_content += f"- **Invalidation Sentinel (Stop Loss):** `${ex['stop_loss']}` ({ex['stop_loss_pct']}% Risk Floor)\n"
        md_content += f"- **Target 1 (Pin Target):** `${ex['target_primary']}` (+{ex['target_primary_pct']}%) → *Trim 50% & Ratchet Stop to Breakeven*\n"
        md_content += f"- **Target 2 (Runner Target):** `${ex['target_secondary']}` (+{ex['target_secondary_pct']}%) → *15m Trailing Stop*\n"
        md_content += f"- **Options Contract:** `{ex['options_spec']}`\n"
        md_content += f"- **Risk/Reward Expectancy:** `{ex['risk_reward']}`\n\n"
        md_content += f"### 📊 Technical Health & Structure\n"
        md_content += f"- **Structural Stage:** {ex['stage']}\n"
        md_content += f"- **RSI (14):** {ex['rsi']} | **Volume Surge:** {ex['vol_surge']}x ADV\n"
        md_content += f"- **Moving Averages:** 10-EMA (${ex['ema_10']}) | 21-EMA (${ex['ema_21']}) | 50-SMA (${ex['sma_50']})\n\n"
        md_content += "---\n\n"

    md_content += "> [!IMPORTANT]\n"
    md_content += "> Never violate your invalidation sentinel. These setups are quantitatively modeled with strictly defined asymmetry.\n"

    try:
        with open(PLAYBOOK_MD_PATH, "w") as f:
            f.write(md_content)
        print(f"✅ [AI Playbook] Saved Markdown to {PLAYBOOK_MD_PATH}")
    except Exception as e:
        print(f"❌ Failed to write Markdown: {e}")

    return payload


if __name__ == "__main__":
    generate_ai_playbook()
