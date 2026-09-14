import yfinance as yf
import pandas as pd
import numpy as np
import json
import math
import datetime
import warnings
from typing import Dict, List, Any, Optional

warnings.filterwarnings('ignore')

def calculate_gamma(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """Standard Black-Scholes analytical gamma calculation."""
    if T <= 0.0001 or sigma <= 0.0001 or S <= 0 or K <= 0:
        return 0.0
    try:
        d1 = (math.log(S / K) + (r + 0.5 * (sigma ** 2)) * T) / (sigma * math.sqrt(T))
        gamma = math.exp(-0.5 * (d1 ** 2)) / (S * sigma * math.sqrt(2.0 * math.pi * T))
        return gamma
    except Exception:
        return 0.0

def get_gex_profile(ticker: str, expiry_filter: str = "ALL") -> Dict[str, Any]:
    """
    Calculates institutional Gamma Exposure (GEX) profile across strikes and expirations.
    Returns:
      - spot_price
      - gex_profile: per-strike data (strike, net_gex, call_gex, put_gex, call_oi, put_oi, call_vol, put_vol)
      - key_levels: call_wall, put_wall, zero_gamma, max_pain, absolute_gamma
      - totals: total_net_gex, total_call_gex, total_put_gex, put_call_oi_ratio, put_call_vol_ratio
      - regime: title, posture, color, summary
      - trade_setup: institutional trade execution parameters (entry, stop, targets, R:R)
      - expirations: list of available expiration dates
    """
    try:
        t = yf.Ticker(ticker.upper())
        fast_info = getattr(t, 'fast_info', {}) or {}
        spot_price = float(fast_info.get('lastPrice') or fast_info.get('regularMarketPrice') or 0.0)
        
        if spot_price <= 0:
            hist = t.history(period="5d")
            if not hist.empty:
                spot_price = float(hist['Close'].iloc[-1])
            else:
                spot_price = 100.0

        options = t.options
        if not options:
            return {"error": f"No options chain available for {ticker}"}

        r = 0.045
        today = datetime.date.today()

        if expiry_filter.upper() == "FRONT":
            target_expiries = [options[0]]
        elif expiry_filter in options:
            target_expiries = [expiry_filter]
        else:
            target_expiries = options[:min(6, len(options))]

        aggregated_strikes: Dict[float, Dict[str, Any]] = {}
        all_calls_list = []
        all_puts_list = []

        for exp_date_str in target_expiries:
            try:
                exp_date = datetime.datetime.strptime(exp_date_str, "%Y-%m-%d").date()
                days_to_exp = max(0.5, (exp_date - today).days)
                T = days_to_exp / 365.25

                chain = t.option_chain(exp_date_str)
                calls = chain.calls
                puts = chain.puts

                if calls is not None and not calls.empty:
                    for _, row in calls.iterrows():
                        strike = float(row['strike'])
                        oi = int(row['openInterest']) if pd.notna(row.get('openInterest')) else 0
                        vol = int(row['volume']) if pd.notna(row.get('volume')) else 0
                        iv = float(row['impliedVolatility']) if pd.notna(row.get('impliedVolatility')) and row['impliedVolatility'] > 0 else 0.25

                        if strike < spot_price * 0.70 or strike > spot_price * 1.30:
                            continue

                        gamma = calculate_gamma(spot_price, strike, T, r, iv)
                        call_dollar_gex = gamma * oi * 100.0 * (spot_price ** 2) * 0.01

                        if strike not in aggregated_strikes:
                            aggregated_strikes[strike] = {
                                "strike": strike,
                                "call_oi": 0, "put_oi": 0,
                                "call_vol": 0, "put_vol": 0,
                                "call_gex": 0.0, "put_gex": 0.0,
                                "net_gex": 0.0
                            }
                        aggregated_strikes[strike]["call_oi"] += oi
                        aggregated_strikes[strike]["call_vol"] += vol
                        aggregated_strikes[strike]["call_gex"] += call_dollar_gex
                        all_calls_list.append({"strike": strike, "oi": oi})

                if puts is not None and not puts.empty:
                    for _, row in puts.iterrows():
                        strike = float(row['strike'])
                        oi = int(row['openInterest']) if pd.notna(row.get('openInterest')) else 0
                        vol = int(row['volume']) if pd.notna(row.get('volume')) else 0
                        iv = float(row['impliedVolatility']) if pd.notna(row.get('impliedVolatility')) and row['impliedVolatility'] > 0 else 0.25

                        if strike < spot_price * 0.70 or strike > spot_price * 1.30:
                            continue

                        gamma = calculate_gamma(spot_price, strike, T, r, iv)
                        put_dollar_gex = -gamma * oi * 100.0 * (spot_price ** 2) * 0.01

                        if strike not in aggregated_strikes:
                            aggregated_strikes[strike] = {
                                "strike": strike,
                                "call_oi": 0, "put_oi": 0,
                                "call_vol": 0, "put_vol": 0,
                                "call_gex": 0.0, "put_gex": 0.0,
                                "net_gex": 0.0
                            }
                        aggregated_strikes[strike]["put_oi"] += oi
                        aggregated_strikes[strike]["put_vol"] += vol
                        aggregated_strikes[strike]["put_gex"] += put_dollar_gex
                        all_puts_list.append({"strike": strike, "oi": oi})

            except Exception as exp_err:
                print(f"Error parsing expiry {exp_date_str}: {exp_err}")
                continue

        if not aggregated_strikes:
            return {"error": "No strikes resolved for GEX calculation"}

        sorted_strikes = sorted(aggregated_strikes.keys())
        gex_profile: List[Dict[str, Any]] = []
        cumulative_gex = 0.0

        for k in sorted_strikes:
            item = aggregated_strikes[k]
            net_g = item["call_gex"] + item["put_gex"]
            item["net_gex"] = net_g
            cumulative_gex += net_g
            item["cumulative_gex"] = cumulative_gex
            
            gex_profile.append({
                "strike": float(k),
                "net_gex": round(net_g, 2),
                "call_gex": round(item["call_gex"], 2),
                "put_gex": round(item["put_gex"], 2),
                "call_oi": item["call_oi"],
                "put_oi": item["put_oi"],
                "call_vol": item["call_vol"],
                "put_vol": item["put_vol"],
                "cumulative_gex": round(cumulative_gex, 2)
            })

        total_call_gex = sum(p["call_gex"] for p in gex_profile)
        total_put_gex = sum(p["put_gex"] for p in gex_profile)
        total_net_gex = total_call_gex + total_put_gex
        total_call_oi = sum(p["call_oi"] for p in gex_profile)
        total_put_oi = sum(p["put_oi"] for p in gex_profile)
        total_call_vol = sum(p["call_vol"] for p in gex_profile)
        total_put_vol = sum(p["put_vol"] for p in gex_profile)

        put_call_oi_ratio = round(total_put_oi / total_call_oi, 2) if total_call_oi > 0 else 1.0
        put_call_vol_ratio = round(total_put_vol / total_call_vol, 2) if total_call_vol > 0 else 1.0

        # Key levels
        call_wall_point = max(gex_profile, key=lambda x: x["net_gex"])
        call_wall = call_wall_point["strike"]

        put_wall_point = min(gex_profile, key=lambda x: x["net_gex"])
        put_wall = put_wall_point["strike"]

        abs_gamma_point = max(gex_profile, key=lambda x: abs(x["net_gex"]))
        abs_gamma_strike = abs_gamma_point["strike"]

        # Zero Gamma crossover
        zero_gamma = None
        for i in range(len(gex_profile) - 1):
            p1 = gex_profile[i]
            p2 = gex_profile[i + 1]
            if (p1["net_gex"] < 0 and p2["net_gex"] >= 0) or (p1["net_gex"] >= 0 and p2["net_gex"] < 0):
                dy = p2["net_gex"] - p1["net_gex"]
                if dy != 0:
                    weight = abs(p1["net_gex"]) / dy
                    zero_gamma = round(p1["strike"] + weight * (p2["strike"] - p1["strike"]), 2)
                    break
        
        if zero_gamma is None:
            zero_gamma = round(spot_price * 0.99, 2)

        # Max Pain
        max_pain_strike = spot_price
        min_total_payout = float('inf')
        for test_k in sorted_strikes:
            payout = 0.0
            for c in all_calls_list:
                if test_k > c["strike"]:
                    payout += (test_k - c["strike"]) * c["oi"] * 100
            for p in all_puts_list:
                if test_k < p["strike"]:
                    payout += (p["strike"] - test_k) * p["oi"] * 100
            if payout < min_total_payout:
                min_total_payout = payout
                max_pain_strike = test_k

        # Regime evaluation
        if spot_price > call_wall:
            regime_title = "GAMMA SQUEEZE CORRIDOR 🚀"
            regime_posture = "EXTREME SHORT SQUEEZE · DEALERS SHORT GAMMA"
            regime_color = "#38bdf8"
            regime_badge = "SQUEEZE REGIME"
            regime_summary = f"{ticker} has penetrated above the Call Wall (${call_wall}). Dealers are short gamma above this ceiling and must aggressively buy underlying shares into strength, amplifying parabolic upside momentum."
        elif spot_price < put_wall:
            regime_title = "VOLATILITY ACCELERATION CRASH ZONE ⚠️"
            regime_posture = "NEGATIVE GAMMA REGIME · HIGH DOWNSIDE VOL"
            regime_color = "#f43f5e"
            regime_badge = "CASCADE REGIME"
            regime_summary = f"{ticker} has broken below the Put Wall (${put_wall}). Dealers are forced to sell shares as price declines, creating a self-reinforcing downward acceleration trap until significant dip buying emerges."
        elif spot_price < zero_gamma:
            regime_title = "NEGATIVE GAMMA EXPANSION REGIME 🌪️"
            regime_posture = "SHORT GAMMA ACCELERATOR · WIDENING SWINGS"
            regime_color = "#fbbf24"
            regime_badge = "HIGH VOLATILITY"
            regime_summary = f"{ticker} trades below the Zero Gamma Flip Point (${zero_gamma}). Market makers trade WITH the prevailing trend. Expect violent intraday ranges and rapid directional moves."
        else:
            regime_title = "POSITIVE GAMMA VOLATILITY SHIELD 🛡️"
            regime_posture = "LONG GAMMA REGIME · MEAN-REVERSION MAGNET"
            regime_color = "#00E676"
            regime_badge = "STABILIZING REGIME"
            regime_summary = f"{ticker} trades in deep Positive Gamma above ${zero_gamma}. Market makers actively counter price moves ('buy the dips, sell the rips'), pinning the ticker into an orderly mean-reversion trading range between ${put_wall} and ${call_wall}."

        if spot_price > zero_gamma:
            setup_name = "Long Gamma Mean-Reversion Pin"
            ideal_entry = round(max(put_wall, spot_price * 0.985), 2)
            stop_loss = round(min(put_wall * 0.98, zero_gamma * 0.985), 2)
            target_primary = round(min(call_wall, spot_price * 1.03), 2)
            target_secondary = round(call_wall * 1.02, 2)
        else:
            setup_name = "Gamma Breakdown Momentum / Volatility Spike"
            ideal_entry = round(spot_price * 0.995, 2)
            stop_loss = round(zero_gamma * 1.01, 2)
            target_primary = round(put_wall, 2)
            target_secondary = round(put_wall * 0.97, 2)

        risk_amt = abs(ideal_entry - stop_loss)
        rew_amt = abs(target_primary - ideal_entry)
        rr_ratio = round(rew_amt / risk_amt, 2) if risk_amt > 0 else 3.20

        trade_setup = {
            "setup_name": setup_name,
            "ideal_entry": ideal_entry,
            "stop_loss": stop_loss,
            "target_primary": target_primary,
            "target_secondary": target_secondary,
            "risk_reward": f"{rr_ratio}:1",
            "max_pain_pin": max_pain_strike,
            "execution_tactic": (
                f"Accumulate near ${ideal_entry} with structural invalidation below ${stop_loss}. "
                f"Take primary profits at dealer pin target ${target_primary}."
            )
        }

        pillars = [
            {
                "id": "gamma_regime",
                "title": "Dealer Gamma Regime",
                "metric": f"{'Long Gamma (+$' if total_net_gex >= 0 else 'Short Gamma (-$'}{abs(round(total_net_gex / 1e6, 1))}M/1%)",
                "status": "Stabilizing / Mean-Reverting" if total_net_gex >= 0 else "Expansive / High Volatility",
                "color": "emerald" if total_net_gex >= 0 else "rose",
                "takeaway": f"Dealers hold {'positive' if total_net_gex >= 0 else 'negative'} gamma exposure. Price volatility is {'damped' if total_net_gex >= 0 else 'accelerated'}."
            },
            {
                "id": "gamma_flip",
                "title": "Zero Gamma Inflection",
                "metric": f"${zero_gamma}",
                "status": f"{'+' if spot_price >= zero_gamma else ''}{round(((spot_price - zero_gamma)/zero_gamma)*100, 1)}% from Spot",
                "color": "cyan" if spot_price >= zero_gamma else "amber",
                "takeaway": f"The volatility regime boundary is ${zero_gamma}. Trading above this level buffers against sudden flash selloffs."
            },
            {
                "id": "structural_walls",
                "title": "Call Wall & Put Wall Range",
                "metric": f"${put_wall} ── ${call_wall}",
                "status": f"${round(call_wall - put_wall, 1)} Channel",
                "color": "purple",
                "takeaway": f"Major dealer hedging anchors. Call Wall at ${call_wall} acts as heavy ceiling; Put Wall at ${put_wall} acts as key support floor."
            },
            {
                "id": "max_pain_pin",
                "title": "Max Pain & Dealer Magnet",
                "metric": f"${max_pain_strike}",
                "status": f"Spot ${spot_price:.2f}",
                "color": "amber",
                "takeaway": f"Strike where aggregate option buyers suffer maximum financial loss into OpEx. Price frequently gravitates toward this level."
            }
        ]

        return {
            "ticker": ticker.upper(),
            "spot_price": round(spot_price, 2),
            "key_levels": {
                "call_wall": call_wall,
                "put_wall": put_wall,
                "zero_gamma": zero_gamma,
                "max_pain": max_pain_strike,
                "absolute_gamma": abs_gamma_strike
            },
            "totals": {
                "total_net_gex": round(total_net_gex, 2),
                "total_call_gex": round(total_call_gex, 2),
                "total_put_gex": round(total_put_gex, 2),
                "total_call_oi": total_call_oi,
                "total_put_oi": total_put_oi,
                "put_call_oi_ratio": put_call_oi_ratio,
                "put_call_vol_ratio": put_call_vol_ratio
            },
            "regime": {
                "title": regime_title,
                "posture": regime_posture,
                "badge": regime_badge,
                "color": regime_color,
                "summary": regime_summary
            },
            "pillars": pillars,
            "trade_setup": trade_setup,
            "gex_profile": gex_profile,
            "expirations": options[:12]
        }

    except Exception as e:
        return {"error": str(e)}

def load_gex_alerts():
    tickers = ["SPY", "QQQ", "NVDA", "AAPL", "TSLA", "MSFT", "AMD"]
    alerts = []
    for ticker in tickers:
        try:
            profile = get_gex_profile(ticker, expiry_filter="FRONT")
            if "error" not in profile:
                spot = profile["spot_price"]
                cw = profile["key_levels"]["call_wall"]
                pw = profile["key_levels"]["put_wall"]
                zg = profile["key_levels"]["zero_gamma"]

                if spot >= cw:
                    alerts.append({
                        "ticker": ticker,
                        "type": "CALL_WALL_BREACH",
                        "severity": "HIGH",
                        "headline": f"{ticker} Penetrates Above Call Wall (${cw})",
                        "description": "Dealers short gamma; potential parabolic squeeze in progress."
                    })
                elif spot <= pw:
                    alerts.append({
                        "ticker": ticker,
                        "type": "PUT_WALL_BREACH",
                        "severity": "SEVERE",
                        "headline": f"{ticker} Falls Below Put Wall (${pw})",
                        "description": "Dealers forced to short into declines; downside volatility acceleration risk."
                    })
                elif abs(spot - zg) / zg < 0.008:
                    alerts.append({
                        "ticker": ticker,
                        "type": "GAMMA_FLIP_APPROACH",
                        "severity": "MEDIUM",
                        "headline": f"{ticker} Approaching Zero Gamma Flip (${zg})",
                        "description": "Volatility inflection point. Crossing below will trigger high-volatility regime."
                    })
        except Exception:
            continue
    return alerts

def run_gex_engine():
    tickers = ["SPY", "QQQ", "AAPL", "NVDA", "TSLA", "MSFT", "AMD"]
    results = {}
    print("Executing Institutional GEX Profiler Engine...")
    for ticker in tickers:
        res = get_gex_profile(ticker)
        if "error" not in res:
            results[ticker] = res
            print(f"✓ {ticker}: Call Wall ${res['key_levels']['call_wall']}, Put Wall ${res['key_levels']['put_wall']}, Zero Gamma ${res['key_levels']['zero_gamma']}")
            
    output_path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/gex_results.json'
    with open(output_path, 'w') as f:
        json.dump(results, f)
    print(f"Successfully wrote institutional GEX results to {output_path}")

if __name__ == "__main__":
    run_gex_engine()

