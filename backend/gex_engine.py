import os
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

def calculate_vanna(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """
    Second-order Greek: Vanna (dDelta / dSigma).
    Analytical formula: Vanna = -phi(d1) * d2 / sigma
    Measures dealer delta repositioning per 1% change in Implied Volatility.
    """
    if T <= 0.0001 or sigma <= 0.0001 or S <= 0 or K <= 0:
        return 0.0
    try:
        d1 = (math.log(S / K) + (r + 0.5 * (sigma ** 2)) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)
        phi_d1 = math.exp(-0.5 * (d1 ** 2)) / math.sqrt(2.0 * math.pi)
        vanna = -phi_d1 * d2 / sigma
        return vanna
    except Exception:
        return 0.0

def calculate_charm(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """
    Second-order Greek: Charm (dDelta / dTime).
    Measures dealer delta decay over time (OpEx pinning flow).
    """
    if T <= 0.0001 or sigma <= 0.0001 or S <= 0 or K <= 0:
        return 0.0
    try:
        d1 = (math.log(S / K) + (r + 0.5 * (sigma ** 2)) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)
        phi_d1 = math.exp(-0.5 * (d1 ** 2)) / math.sqrt(2.0 * math.pi)
        charm = -phi_d1 * (2.0 * r * T - d2 * sigma * math.sqrt(T)) / (2.0 * T * sigma * math.sqrt(T))
        return charm
    except Exception:
        return 0.0

def calculate_delta(S: float, K: float, T: float, r: float, sigma: float, option_type: str = "call") -> float:
    """Standard Black-Scholes analytical Delta calculation."""
    if T <= 0.0001 or sigma <= 0.0001 or S <= 0 or K <= 0:
        return 1.0 if (option_type == "call" and S > K) else (-1.0 if (option_type == "put" and S < K) else 0.0)
    try:
        d1 = (math.log(S / K) + (r + 0.5 * (sigma ** 2)) * T) / (sigma * math.sqrt(T))
        cdf = 0.5 * (1.0 + math.erf(d1 / math.sqrt(2.0)))
        return cdf if option_type == "call" else cdf - 1.0
    except Exception:
        return 0.0

def compute_spotgamma_trace(
    spot_price: float,
    all_contracts: List[Dict[str, Any]],
    r: float = 0.045,
    num_points: int = 41,
    range_pct: float = 0.08,
    gex_profile: List[Dict[str, Any]] = None,
    call_wall: float = None,
    put_wall: float = None,
    zero_gamma: float = None
) -> Dict[str, Any]:
    """
    SpotGamma TRACE Engine:
    1. Real Strike Gamma Distribution: Actual Call GEX vs Put GEX, Net GEX, and Absolute Gamma by strike.
    2. Continuous SDE Simulation Curve: Total dealer Net Gamma Exposure (GEX), Delta (DEX), Charm (CEX)
       simulated across S +/- range_pct.
    3. Key Levels: Call Wall, Put Wall, Zero Gamma Flip, Key Gamma Strike (Abs Pin), and Convexity Slope.
    """
    if spot_price <= 0 or not all_contracts:
        return {}

    min_p = spot_price * (1.0 - range_pct)
    max_p = spot_price * (1.0 + range_pct)
    sim_prices = np.linspace(min_p, max_p, num_points)

    curve = []
    for p in sim_prices:
        p_val = float(p)
        tot_call_gex = 0.0
        tot_put_gex = 0.0
        tot_call_dex = 0.0
        tot_put_dex = 0.0
        tot_call_cex = 0.0
        tot_put_cex = 0.0

        for c in all_contracts:
            k = c["strike"]
            T = c["T"]
            iv = c["iv"]
            wt = c["weight"]
            is_call = (c["type"] == "call")

            gamma = calculate_gamma(p_val, k, T, r, iv)
            delta = calculate_delta(p_val, k, T, r, iv, "call" if is_call else "put")
            charm = calculate_charm(p_val, k, T, r, iv)

            if is_call:
                gex = gamma * wt * 100.0 * (p_val ** 2) * 0.01
                tot_call_gex += gex
                tot_call_dex += delta * wt * 100.0 * p_val
                tot_call_cex += charm * wt * 100.0 * p_val * (1.0 / 365.25)
            else:
                gex = -gamma * wt * 100.0 * (p_val ** 2) * 0.01
                tot_put_gex += gex
                tot_put_dex += delta * wt * 100.0 * p_val
                tot_put_cex += -charm * wt * 100.0 * p_val * (1.0 / 365.25)

        tot_net_gex = tot_call_gex + tot_put_gex
        tot_net_dex = tot_call_dex + tot_put_dex
        tot_net_cex = tot_call_cex + tot_put_cex
        regime = "POSITIVE GAMMA (Dampening)" if tot_net_gex >= 0 else "NEGATIVE GAMMA (Accelerating)"

        curve.append({
            "price": round(p_val, 2),
            "pct_from_spot": round(((p_val - spot_price) / spot_price) * 100, 2),
            "net_gex": round(tot_net_gex, 2),
            "call_gex": round(tot_call_gex, 2),
            "put_gex": round(tot_put_gex, 2),
            "net_dex": round(tot_net_dex, 2),
            "call_dex": round(tot_call_dex, 2),
            "put_dex": round(tot_put_dex, 2),
            "net_cex": round(tot_net_cex, 2),
            "call_cex": round(tot_call_cex, 2),
            "put_cex": round(tot_put_cex, 2),
            "regime": regime
        })

    # Zero Crossing Detection for Gamma, Delta, and Charm
    def find_zero_crossing(data_key: str, fallback: float) -> float:
        for i in range(len(curve) - 1):
            pt1 = curve[i]
            pt2 = curve[i + 1]
            v1 = pt1[data_key]
            v2 = pt2[data_key]
            if (v1 < 0 and v2 > 0) or (v1 > 0 and v2 < 0) or v1 == 0:
                dy = v2 - v1
                if dy != 0:
                    frac = (0 - v1) / dy
                    return round(pt1["price"] + frac * (pt2["price"] - pt1["price"]), 2)
        return round(fallback, 2)

    trace_zero_gamma = find_zero_crossing("net_gex", zero_gamma if zero_gamma else spot_price)
    trace_zero_delta = find_zero_crossing("net_dex", spot_price)
    trace_zero_charm = find_zero_crossing("net_cex", spot_price)

    peak_pt = max(curve, key=lambda x: x["net_gex"])
    trough_pt = min(curve, key=lambda x: x["net_gex"])

    closest_idx = min(range(len(curve)), key=lambda i: abs(curve[i]["price"] - spot_price))
    if 0 < closest_idx < len(curve) - 1:
        dp = curve[closest_idx + 1]["price"] - curve[closest_idx - 1]["price"]
        dg = curve[closest_idx + 1]["net_gex"] - curve[closest_idx - 1]["net_gex"]
        dd = curve[closest_idx + 1]["net_dex"] - curve[closest_idx - 1]["net_dex"]
        dc = curve[closest_idx + 1]["net_cex"] - curve[closest_idx - 1]["net_cex"]
        slope_gex = round(dg / dp, 2) if dp != 0 else 0.0
        slope_dex = round(dd / dp, 2) if dp != 0 else 0.0
        slope_cex = round(dc / dp, 2) if dp != 0 else 0.0
    else:
        slope_gex = 0.0
        slope_dex = 0.0
        slope_cex = 0.0

    # Build Real Strike Distribution across Gamma, Delta, and Charm
    strike_distribution = []
    key_gamma_strike = spot_price
    key_gamma_val = 0.0
    key_delta_strike = spot_price
    key_delta_val = 0.0
    key_charm_strike = spot_price
    key_charm_val = 0.0

    max_abs_g = 0.0
    max_abs_d = 0.0
    max_abs_c = 0.0

    if gex_profile:
        curve_prices = np.array([c["price"] for c in curve])
        curve_net_gex = np.array([c["net_gex"] for c in curve])
        curve_net_dex = np.array([c["net_dex"] for c in curve])
        curve_net_cex = np.array([c["net_cex"] for c in curve])

        near_profile = [p for p in gex_profile if abs(p["strike"] - spot_price) / spot_price <= 0.10]
        if not near_profile:
            near_profile = gex_profile[:30]

        for p in near_profile:
            st = p["strike"]
            c_gex = p.get("call_gex", 0.0)
            p_gex = p.get("put_gex", 0.0)
            n_gex = p.get("net_gex", c_gex + p_gex)
            abs_g = abs(c_gex) + abs(p_gex)

            c_dex = p.get("call_dex", 0.0)
            p_dex = p.get("put_dex", 0.0)
            n_dex = p.get("net_dex", c_dex + p_dex)
            abs_d = abs(c_dex) + abs(p_dex)

            c_cex = p.get("call_cex", 0.0)
            p_cex = p.get("put_cex", 0.0)
            n_cex = p.get("net_cex", c_cex + p_cex)
            abs_c = abs(c_cex) + abs(p_cex)

            if abs_g > max_abs_g:
                max_abs_g = abs_g
                key_gamma_strike = st
                key_gamma_val = abs_g

            if abs_d > max_abs_d:
                max_abs_d = abs_d
                key_delta_strike = st
                key_delta_val = abs_d

            if abs_c > max_abs_c:
                max_abs_c = abs_c
                key_charm_strike = st
                key_charm_val = abs_c

            # Theoretical TRACE model curves evaluated at this exact strike
            trace_model_gex = float(np.interp(st, curve_prices, curve_net_gex))
            trace_model_dex = float(np.interp(st, curve_prices, curve_net_dex))
            trace_model_cex = float(np.interp(st, curve_prices, curve_net_cex))

            dist_from_spot = round(((st - spot_price) / spot_price) * 100, 2)

            strike_distribution.append({
                "strike": st,
                "price": st,
                "pct_from_spot": dist_from_spot,
                # Gamma
                "call_gex": round(c_gex, 2),
                "put_gex": round(p_gex, 2),
                "net_gex": round(n_gex, 2),
                "abs_gex": round(abs_g, 2),
                "trace_model_gex": round(trace_model_gex, 2),
                # Delta
                "call_dex": round(c_dex, 2),
                "put_dex": round(p_dex, 2),
                "net_dex": round(n_dex, 2),
                "abs_dex": round(abs_d, 2),
                "trace_model_dex": round(trace_model_dex, 2),
                # Charm
                "call_cex": round(c_cex, 2),
                "put_cex": round(p_cex, 2),
                "net_cex": round(n_cex, 2),
                "abs_cex": round(abs_c, 2),
                "trace_model_cex": round(trace_model_cex, 2),
                # Reference flags
                "is_call_wall": st == call_wall,
                "is_put_wall": st == put_wall,
                "is_spot": abs(st - spot_price) / spot_price < 0.005,
                "is_zero_gamma": abs(st - trace_zero_gamma) / spot_price < 0.005,
                "is_zero_delta": abs(st - trace_zero_delta) / spot_price < 0.005,
                "is_zero_charm": abs(st - trace_zero_charm) / spot_price < 0.005
            })

    current_spot_gex = curve[closest_idx]["net_gex"]
    current_spot_dex = curve[closest_idx]["net_dex"]
    current_spot_cex = curve[closest_idx]["net_cex"]
    regime_title = "POSITIVE GAMMA (Dampening)" if current_spot_gex >= 0 else "NEGATIVE GAMMA (Accelerating)"
    vol_trigger_dist = round(((spot_price - trace_zero_gamma) / spot_price) * 100, 2)
    delta_trigger_dist = round(((spot_price - trace_zero_delta) / spot_price) * 100, 2)
    charm_trigger_dist = round(((spot_price - trace_zero_charm) / spot_price) * 100, 2)

    return {
        "curve": curve,
        "strike_distribution": strike_distribution,
        "trace_zero_gamma": trace_zero_gamma,
        "trace_zero_delta": trace_zero_delta,
        "trace_zero_charm": trace_zero_charm,
        "vol_trigger_dist_pct": vol_trigger_dist,
        "delta_trigger_dist_pct": delta_trigger_dist,
        "charm_trigger_dist_pct": charm_trigger_dist,
        "key_gamma_strike": key_gamma_strike,
        "key_gamma_val": round(key_gamma_val, 2),
        "key_delta_strike": key_delta_strike,
        "key_delta_val": round(key_delta_val, 2),
        "key_charm_strike": key_charm_strike,
        "key_charm_val": round(key_charm_val, 2),
        "peak_gamma_price": peak_pt["price"],
        "peak_gamma_val": peak_pt["net_gex"],
        "trough_gamma_price": trough_pt["price"],
        "trough_gamma_val": trough_pt["net_gex"],
        "gamma_convexity_slope": slope_gex,
        "delta_slope": slope_dex,
        "charm_slope": slope_cex,
        "current_spot_gex": current_spot_gex,
        "current_spot_dex": current_spot_dex,
        "current_spot_cex": current_spot_cex,
        "current_regime": regime_title,
        "num_simulated_points": len(curve),
        "num_strikes": len(strike_distribution)
    }

def compute_greek_projections(
    spot: float,
    key_levels: Dict[str, Any],
    totals: Dict[str, Any],
    expected_move: Dict[str, Any],
    risk_scores: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Institutional Greek Price Projection Model:
    Deploys a Gamma-Attenuated Ornstein-Uhlenbeck Jump-Diffusion & Vanna Drift SDE:
      dS_t = [ theta * (S_pin - S_t) * I_{GEX>0} + mu_{mom} * I_{GEX<0} + lambda_{vanna} * VEX * (-dSigma/dt) ] * dt
             + sigma_{eff}(GEX) * S_t * dW_t

    Calculates:
      - 5-Day & 20-Day Statistical Horizons (Median, +/- 1-sigma 68% conf, +/- 2-sigma 95% conf)
      - Scenario distributions: Base Pin Case, Bull Squeeze, Bear Cascade with quantitative probabilities
      - 20-Day day-by-day trajectory series for visual confidence cone plotting
    """
    cw = float(key_levels.get("call_wall") or spot * 1.05)
    pw = float(key_levels.get("put_wall") or spot * 0.95)
    zg = float(key_levels.get("zero_gamma") or spot)
    mp = float(key_levels.get("max_pain") or spot)

    net_gex = float(totals.get("total_net_gex") or 0.0)
    net_vex = float(totals.get("total_net_vex") or 0.0)
    atm_iv = float(expected_move.get("atm_iv_pct", 22.0)) / 100.0
    if atm_iv <= 0.05:
        atm_iv = 0.22

    # Volatility Attenuation Factor: Positive gamma compresses realized vol; negative gamma expands it
    gamma_scale = net_gex / (abs(net_gex) + 1.0e9) if (abs(net_gex) + 1.0e9) > 0 else 0.0
    if net_gex >= 0:
        vol_attenuation = max(0.65, 1.0 - 0.30 * gamma_scale)
    else:
        vol_attenuation = min(1.45, 1.0 + 0.35 * abs(gamma_scale))
    
    daily_sigma_eff = (atm_iv / math.sqrt(252.0)) * vol_attenuation

    # Drift components:
    # 1. Mean-reverting anchor (Ornstein-Uhlenbeck) toward Max Pain and Zero Gamma
    pin_target = mp if abs(spot - mp) < abs(spot - zg) else zg
    ou_speed = 0.08 * (1.0 + abs(gamma_scale)) if net_gex >= 0 else 0.02
    
    # 2. Vanna Drift: When IV contracts post-event or into OpEx (-dSigma/dt), positive Vanna forces dealers to buy shares
    # Standard 1-month IV decay assumption is ~0.15% per day
    vanna_drift_daily = (net_vex / 5.0e9) * 0.0006  # proportional upward delta lift

    # 3. Dynamic scenario probabilities using all 3 structural risk pillars: Squeeze, Pin, and Downside Cascade
    squeeze_prob = min(85, max(8, int(risk_scores.get("squeeze_score", 30))))
    pin_prob = min(85, max(10, int(risk_scores.get("pin_score", 40))))
    cascade_prob = min(85, max(8, int(risk_scores.get("cascade_score", 30))))

    # Normalize scenario probabilities across the 3 regimes
    tot_p = max(1.0, float(squeeze_prob + pin_prob + cascade_prob))
    p_pin = round((pin_prob / tot_p) * 100.0, 1)
    p_squeeze = round((squeeze_prob / tot_p) * 100.0, 1)
    p_cascade = round(max(0.0, 100.0 - p_pin - p_squeeze), 1)

    # Generate day-by-day 20-day trajectory series
    trajectory = []
    current_expected = spot

    for day in range(1, 21):
        dt = 1.0
        # OU mean reversion pull
        if net_gex >= 0:
            drift_ou = ou_speed * (pin_target - current_expected)
        else:
            drift_ou = 0.02 * (spot - current_expected) # weaker pull in negative gamma
        
        daily_drift = drift_ou + (current_expected * vanna_drift_daily)
        current_expected = current_expected + daily_drift

        # Cumulative standard deviation expansion
        cum_sd_1 = spot * daily_sigma_eff * math.sqrt(day)
        cum_sd_2 = cum_sd_1 * 2.0

        # Elastic bounding: Call Wall dampens upward overshoot; Put Wall buffers downside
        up_1 = current_expected + cum_sd_1
        down_1 = current_expected - cum_sd_1
        up_2 = current_expected + cum_sd_2
        down_2 = current_expected - cum_sd_2

        trajectory.append({
            "day": day,
            "label": f"T+{day}d",
            "base_target": round(current_expected, 2),
            "upper_1sigma": round(up_1, 2),
            "lower_1sigma": round(down_1, 2),
            "upper_2sigma": round(up_2, 2),
            "lower_2sigma": round(down_2, 2),
            "call_wall": cw,
            "put_wall": pw,
            "pin_anchor": pin_target
        })

    t5 = trajectory[4]
    t20 = trajectory[19]

    # Calculate 5-Day targets
    proj_5d = {
        "horizon_days": 5,
        "base_target": t5["base_target"],
        "base_return_pct": round(((t5["base_target"] - spot) / spot) * 100, 2),
        "upper_1sigma": t5["upper_1sigma"],
        "lower_1sigma": t5["lower_1sigma"],
        "upper_2sigma": t5["upper_2sigma"],
        "lower_2sigma": t5["lower_2sigma"],
        "bull_squeeze_target": round(max(cw * 1.01, t5["upper_1sigma"]), 2),
        "bear_cascade_target": round(min(pw * 0.99, t5["lower_1sigma"]), 2),
        "pin_magnet_target": round(pin_target, 2),
        "effective_daily_vol_pct": round(daily_sigma_eff * 100, 2),
        "vol_compression_status": "Compressed Volatility (Long Gamma Cushion)" if net_gex >= 0 else "Expanded Volatility (Short Gamma Turbulence)"
    }

    # Calculate 20-Day targets
    proj_20d = {
        "horizon_days": 20,
        "base_target": t20["base_target"],
        "base_return_pct": round(((t20["base_target"] - spot) / spot) * 100, 2),
        "upper_1sigma": t20["upper_1sigma"],
        "lower_1sigma": t20["lower_1sigma"],
        "upper_2sigma": t20["upper_2sigma"],
        "lower_2sigma": t20["lower_2sigma"],
        "bull_squeeze_target": round(max(cw * 1.03, t20["upper_2sigma"]), 2),
        "bear_cascade_target": round(min(pw * 0.96, t20["lower_2sigma"]), 2),
        "pin_magnet_target": round(pin_target, 2)
    }

    scenarios = [
        {
            "id": "pin_base",
            "name": "Dealer Pin & Mean Reversion (Base Case)",
            "probability": f"{p_pin}%",
            "target_5d": f"${proj_5d['base_target']}",
            "target_20d": f"${proj_20d['base_target']}",
            "color": "cyan",
            "narrative": f"Dealers enforce pinning toward ${pin_target}. Price oscillations dampen between ${pw} and ${cw}."
        },
        {
            "id": "bull_squeeze",
            "name": "Gamma Squeeze Expansion (Bull Case)",
            "probability": f"{p_squeeze}%",
            "target_5d": f"${proj_5d['bull_squeeze_target']}",
            "target_20d": f"${proj_20d['bull_squeeze_target']}",
            "color": "emerald",
            "narrative": f"Breakout above Call Wall (${cw}) forces dealer short-gamma covering and upside acceleration."
        },
        {
            "id": "bear_cascade",
            "name": "Downside Gamma Cascade (Bear Case)",
            "probability": f"{p_cascade}%",
            "target_5d": f"${proj_5d['bear_cascade_target']}",
            "target_20d": f"${proj_20d['bear_cascade_target']}",
            "color": "rose",
            "narrative": f"Breach below Put Wall (${pw}) prompts dealer delta liquidations, widening downward variance."
        }
    ]

    return {
        "model_name": "Gamma-Attenuated Ornstein-Uhlenbeck Jump-Diffusion & Vanna Drift",
        "pin_equilibrium_anchor": pin_target,
        "effective_realized_vol_pct": round(daily_sigma_eff * math.sqrt(252) * 100, 1),
        "proj_5d": proj_5d,
        "proj_20d": proj_20d,
        "scenarios": scenarios,
        "trajectory_series": trajectory
    }

def evaluate_gex_regime(ticker: str, spot_price: float, call_wall: float, put_wall: float, zero_gamma: float, total_net_gex: float) -> Dict[str, Any]:
    """
    Evaluates the institutional market maker gamma regime across 4 distinct quadrants:
    1. GAMMA SQUEEZE CORRIDOR (spot_price > call_wall)
    2. VOLATILITY ACCELERATION CRASH ZONE (spot_price < put_wall)
    3. NEGATIVE GAMMA EXPANSION REGIME (total_net_gex < 0 OR spot_price < zero_gamma)
    4. POSITIVE GAMMA VOLATILITY SHIELD (total_net_gex >= 0 AND spot_price >= zero_gamma)
    """
    is_net_long = total_net_gex >= 0
    spot_above_call_wall = spot_price > call_wall
    spot_below_put_wall = spot_price < put_wall
    spot_below_zero_gamma = spot_price < zero_gamma

    if spot_above_call_wall:
        return {
            "title": "GAMMA SQUEEZE CORRIDOR 🚀",
            "posture": "EXTREME SHORT SQUEEZE · DEALERS SHORT GAMMA",
            "badge": "SQUEEZE REGIME",
            "color": "#38bdf8",
            "summary": (
                f"{ticker} has penetrated above the Call Wall (${call_wall:.2f}). "
                f"Dealers are short gamma above this ceiling and must aggressively buy underlying shares into strength, "
                f"amplifying parabolic upside momentum."
            )
        }
    elif spot_below_put_wall:
        return {
            "title": "VOLATILITY ACCELERATION CRASH ZONE ⚠️",
            "posture": "NEGATIVE GAMMA REGIME · HIGH DOWNSIDE VOL",
            "badge": "CASCADE REGIME",
            "color": "#f43f5e",
            "summary": (
                f"{ticker} has broken below the Put Wall (${put_wall:.2f}). "
                f"Dealers are forced to sell shares as price declines, "
                f"creating a self-reinforcing downward acceleration trap until significant dip buying emerges."
            )
        }
    elif (not is_net_long) or spot_below_zero_gamma:
        net_str = f"-${abs(round(total_net_gex / 1e6, 1))}M"
        if not is_net_long:
            summary = (
                f"{ticker} aggregate dealer gamma is deeply negative ({net_str}). "
                f"Market makers trade WITH the prevailing trend, accelerating directional selloffs and price swings. "
                f"Expect violent intraday ranges and rapid directional expansion."
            )
        else:
            summary = (
                f"{ticker} (${spot_price:.2f}) trades below the Zero Gamma Flip Point (${zero_gamma:.2f}). "
                f"Market makers trade WITH the prevailing trend. "
                f"Expect violent intraday ranges and rapid directional moves until Zero Gamma is reclaimed."
            )
        return {
            "title": "NEGATIVE GAMMA EXPANSION REGIME 🌪️",
            "posture": "SHORT GAMMA ACCELERATOR · WIDENING SWINGS",
            "badge": "HIGH VOLATILITY",
            "color": "#fbbf24",
            "summary": summary
        }
    else:
        net_str = f"+${round(total_net_gex / 1e6, 1)}M"
        return {
            "title": "POSITIVE GAMMA VOLATILITY SHIELD 🛡️",
            "posture": "LONG GAMMA REGIME · MEAN-REVERSION MAGNET",
            "badge": "STABILIZING REGIME",
            "color": "#00E676",
            "summary": (
                f"{ticker} trades in deep Positive Gamma ({net_str}) above Zero Gamma (${zero_gamma:.2f}). "
                f"Market makers actively counter price moves ('buy the dips, sell the rips'), "
                f"pinning the ticker into an orderly mean-reversion trading range between ${put_wall:.2f} and ${call_wall:.2f}."
            )
        }

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
        
        # Fetch underlying volume and 20-day Average Daily Traded Volume (ADTV)
        adtv = 0.0
        latest_stock_vol = 0.0
        try:
            hist_vol = t.history(period="30d")
            if not hist_vol.empty and 'Volume' in hist_vol.columns:
                adtv = float(hist_vol['Volume'].tail(20).mean())
                latest_stock_vol = float(hist_vol['Volume'].iloc[-1])
                if spot_price <= 0 and 'Close' in hist_vol.columns:
                    spot_price = float(hist_vol['Close'].iloc[-1])
        except Exception:
            pass

        if spot_price <= 0:
            spot_price = 100.0
        if adtv <= 0:
            adtv = float(fast_info.get('threeMonthAverageVolume') or fast_info.get('tenDayAverageVolume') or 10000000.0)
        if latest_stock_vol <= 0:
            latest_stock_vol = float(fast_info.get('lastVolume') or adtv)

        total_call_delta_flow_shares = 0.0
        total_put_delta_flow_shares = 0.0
        total_net_directional_delta_shares = 0.0
        total_options_notional = 0.0

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
            target_expiries = options[:min(10, len(options))]

        aggregated_strikes: Dict[float, Dict[str, Any]] = {}
        all_calls_list = []
        all_puts_list = []
        all_contracts_list = []
        term_structure_dict: Dict[str, Dict[str, Any]] = {}
        matrix_strikes: Dict[float, Dict[str, float]] = {}
        delta_matrix_dict: Dict[float, Dict[str, float]] = {}
        charm_matrix_dict: Dict[float, Dict[str, float]] = {}
        vanna_matrix_dict: Dict[float, Dict[str, float]] = {}
        atm_iv_samples: List[float] = []

        for exp_date_str in target_expiries:
            try:
                exp_date = datetime.datetime.strptime(exp_date_str, "%Y-%m-%d").date()
                days_to_exp = max(0.5, (exp_date - today).days)
                T = days_to_exp / 365.25

                term_structure_dict[exp_date_str] = {
                    "expiry": exp_date_str,
                    "dte": int(days_to_exp),
                    "call_gex": 0.0,
                    "put_gex": 0.0,
                    "net_gex": 0.0,
                    "call_oi": 0,
                    "put_oi": 0
                }

                chain = t.option_chain(exp_date_str)
                calls = chain.calls
                puts = chain.puts

                if calls is not None and not calls.empty:
                    for _, row in calls.iterrows():
                        strike = float(row['strike'])
                        oi = int(row['openInterest']) if pd.notna(row.get('openInterest')) else 0
                        vol = int(row['volume']) if pd.notna(row.get('volume')) else 0
                        raw_iv = float(row['impliedVolatility']) if pd.notna(row.get('impliedVolatility')) else 0.25
                        iv = raw_iv if raw_iv > 0.02 else 0.25

                        if abs(strike - spot_price) / spot_price < 0.03:
                            atm_iv_samples.append(iv)

                        if strike < spot_price * 0.70 or strike > spot_price * 1.30:
                            continue

                        gamma = calculate_gamma(spot_price, strike, T, r, iv)
                        delta = calculate_delta(spot_price, strike, T, r, iv, "call")
                        vanna = calculate_vanna(spot_price, strike, T, r, iv)
                        charm = calculate_charm(spot_price, strike, T, r, iv)

                        # Effective weight: use OI if populated; fallback seamlessly to Volume if OI is 0
                        eff_weight = oi if oi > 0 else (vol if vol > 0 else 0)

                        eff_vol = vol if vol > 0 else (int(oi * 0.10) if oi > 0 else 0)
                        if eff_vol > 0:
                            call_delta_flow = abs(delta) * eff_vol * 100.0
                            total_call_delta_flow_shares += call_delta_flow
                            total_net_directional_delta_shares += (delta * eff_vol * 100.0)
                            total_options_notional += (strike * eff_vol * 100.0)

                        call_dollar_gex = gamma * eff_weight * 100.0 * (spot_price ** 2) * 0.01
                        call_dollar_dex = delta * eff_weight * 100.0 * spot_price
                        call_dollar_vex = vanna * eff_weight * 100.0 * spot_price * 0.01
                        call_dollar_cex = charm * eff_weight * 100.0 * spot_price * (1.0 / 365.25)

                        term_structure_dict[exp_date_str]["call_gex"] += call_dollar_gex
                        term_structure_dict[exp_date_str]["call_oi"] += (oi if oi > 0 else vol)

                        if strike not in aggregated_strikes:
                            aggregated_strikes[strike] = {
                                "strike": strike,
                                "call_oi": 0, "put_oi": 0,
                                "call_vol": 0, "put_vol": 0,
                                "call_gex": 0.0, "put_gex": 0.0,
                                "net_gex": 0.0,
                                "call_dex": 0.0, "put_dex": 0.0,
                                "net_dex": 0.0,
                                "call_vex": 0.0, "put_vex": 0.0, "net_vex": 0.0,
                                "call_cex": 0.0, "put_cex": 0.0, "net_cex": 0.0
                            }
                        aggregated_strikes[strike]["call_oi"] += oi
                        aggregated_strikes[strike]["call_vol"] += vol
                        aggregated_strikes[strike]["call_gex"] += call_dollar_gex
                        aggregated_strikes[strike]["call_dex"] = aggregated_strikes[strike].get("call_dex", 0.0) + call_dollar_dex
                        aggregated_strikes[strike]["call_vex"] += call_dollar_vex
                        aggregated_strikes[strike]["call_cex"] += call_dollar_cex

                        if strike not in matrix_strikes:
                            matrix_strikes[strike] = {}
                            delta_matrix_dict[strike] = {}
                            charm_matrix_dict[strike] = {}
                            vanna_matrix_dict[strike] = {}
                        matrix_strikes[strike][exp_date_str] = matrix_strikes[strike].get(exp_date_str, 0.0) + (call_dollar_gex / 1e6)
                        delta_matrix_dict[strike][exp_date_str] = delta_matrix_dict[strike].get(exp_date_str, 0.0) + (call_dollar_dex / 1e6)
                        charm_matrix_dict[strike][exp_date_str] = charm_matrix_dict[strike].get(exp_date_str, 0.0) + (call_dollar_cex / 1e6)
                        vanna_matrix_dict[strike][exp_date_str] = vanna_matrix_dict[strike].get(exp_date_str, 0.0) + (call_dollar_vex / 1e6)

                        all_calls_list.append({"strike": strike, "oi": oi, "vol": vol, "weight": eff_weight})
                        if eff_weight > 0:
                            all_contracts_list.append({"strike": strike, "T": T, "iv": iv, "type": "call", "weight": eff_weight})

                if puts is not None and not puts.empty:
                    for _, row in puts.iterrows():
                        strike = float(row['strike'])
                        oi = int(row['openInterest']) if pd.notna(row.get('openInterest')) else 0
                        vol = int(row['volume']) if pd.notna(row.get('volume')) else 0
                        raw_iv = float(row['impliedVolatility']) if pd.notna(row.get('impliedVolatility')) else 0.25
                        iv = raw_iv if raw_iv > 0.02 else 0.25

                        if abs(strike - spot_price) / spot_price < 0.03:
                            atm_iv_samples.append(iv)

                        if strike < spot_price * 0.70 or strike > spot_price * 1.30:
                            continue

                        gamma = calculate_gamma(spot_price, strike, T, r, iv)
                        delta = calculate_delta(spot_price, strike, T, r, iv, "put")
                        vanna = calculate_vanna(spot_price, strike, T, r, iv)
                        charm = calculate_charm(spot_price, strike, T, r, iv)
                        # Effective weight: use OI if populated; fallback seamlessly to Volume if OI is 0
                        eff_weight = oi if oi > 0 else (vol if vol > 0 else 0)

                        eff_vol = vol if vol > 0 else (int(oi * 0.10) if oi > 0 else 0)
                        if eff_vol > 0:
                            put_delta_flow = abs(delta) * eff_vol * 100.0
                            total_put_delta_flow_shares += put_delta_flow
                            total_net_directional_delta_shares += (delta * eff_vol * 100.0)  # delta is negative
                            total_options_notional += (strike * eff_vol * 100.0)

                        put_dollar_gex = -gamma * eff_weight * 100.0 * (spot_price ** 2) * 0.01
                        put_dollar_dex = delta * eff_weight * 100.0 * spot_price
                        put_dollar_vex = -vanna * eff_weight * 100.0 * spot_price * 0.01
                        put_dollar_cex = -charm * eff_weight * 100.0 * spot_price * (1.0 / 365.25)

                        term_structure_dict[exp_date_str]["put_gex"] += put_dollar_gex
                        term_structure_dict[exp_date_str]["put_oi"] += (oi if oi > 0 else vol)

                        if strike not in aggregated_strikes:
                            aggregated_strikes[strike] = {
                                "strike": strike,
                                "call_oi": 0, "put_oi": 0,
                                "call_vol": 0, "put_vol": 0,
                                "call_gex": 0.0, "put_gex": 0.0,
                                "net_gex": 0.0,
                                "call_dex": 0.0, "put_dex": 0.0,
                                "net_dex": 0.0,
                                "call_vex": 0.0, "put_vex": 0.0, "net_vex": 0.0,
                                "call_cex": 0.0, "put_cex": 0.0, "net_cex": 0.0
                            }
                        aggregated_strikes[strike]["put_oi"] += oi
                        aggregated_strikes[strike]["put_vol"] += vol
                        aggregated_strikes[strike]["put_gex"] += put_dollar_gex
                        aggregated_strikes[strike]["put_dex"] = aggregated_strikes[strike].get("put_dex", 0.0) + put_dollar_dex
                        aggregated_strikes[strike]["put_vex"] += put_dollar_vex
                        aggregated_strikes[strike]["put_cex"] += put_dollar_cex

                        if strike not in matrix_strikes:
                            matrix_strikes[strike] = {}
                            delta_matrix_dict[strike] = {}
                            charm_matrix_dict[strike] = {}
                            vanna_matrix_dict[strike] = {}
                        matrix_strikes[strike][exp_date_str] = matrix_strikes[strike].get(exp_date_str, 0.0) + (put_dollar_gex / 1e6)
                        delta_matrix_dict[strike][exp_date_str] = delta_matrix_dict[strike].get(exp_date_str, 0.0) + (put_dollar_dex / 1e6)
                        charm_matrix_dict[strike][exp_date_str] = charm_matrix_dict[strike].get(exp_date_str, 0.0) + (put_dollar_cex / 1e6)
                        vanna_matrix_dict[strike][exp_date_str] = vanna_matrix_dict[strike].get(exp_date_str, 0.0) + (put_dollar_vex / 1e6)

                        all_puts_list.append({"strike": strike, "oi": oi, "vol": vol, "weight": eff_weight})
                        if eff_weight > 0:
                            all_contracts_list.append({"strike": strike, "T": T, "iv": iv, "type": "put", "weight": eff_weight})

                term_structure_dict[exp_date_str]["net_gex"] = (
                    term_structure_dict[exp_date_str]["call_gex"] + term_structure_dict[exp_date_str]["put_gex"]
                )

            except Exception as exp_err:
                print(f"Error parsing expiry {exp_date_str}: {exp_err}")
                continue

        if not aggregated_strikes:
            return {"error": "No strikes resolved for GEX calculation"}

        # Calculate implied volatility and expected move cones
        avg_atm_iv = float(np.median(atm_iv_samples)) if atm_iv_samples else 0.22
        if avg_atm_iv <= 0.01:
            avg_atm_iv = 0.22

        # 1-day, 5-day, and 30-day expected moves (+/- 1 sigma)
        em_1d = round(spot_price * avg_atm_iv * math.sqrt(1.0 / 365.25), 2)
        em_5d = round(spot_price * avg_atm_iv * math.sqrt(5.0 / 365.25), 2)
        em_30d = round(spot_price * avg_atm_iv * math.sqrt(30.0 / 365.25), 2)

        expected_move = {
            "atm_iv_pct": round(avg_atm_iv * 100.0, 1),
            "move_1d": em_1d,
            "move_1d_pct": round((em_1d / spot_price) * 100.0, 2),
            "range_1d": [round(spot_price - em_1d, 2), round(spot_price + em_1d, 2)],
            "move_5d": em_5d,
            "move_5d_pct": round((em_5d / spot_price) * 100.0, 2),
            "range_5d": [round(spot_price - em_5d, 2), round(spot_price + em_5d, 2)],
            "move_30d": em_30d,
            "range_30d": [round(spot_price - em_30d, 2), round(spot_price + em_30d, 2)]
        }

        sorted_strikes = sorted(aggregated_strikes.keys())
        gex_profile: List[Dict[str, Any]] = []
        cumulative_gex = 0.0

        for k in sorted_strikes:
            item = aggregated_strikes[k]
            net_g = item["call_gex"] + item["put_gex"]
            net_d = item.get("call_dex", 0.0) + item.get("put_dex", 0.0)
            net_v = item["call_vex"] + item["put_vex"]
            net_c = item["call_cex"] + item["put_cex"]

            item["net_gex"] = net_g
            item["net_dex"] = net_d
            item["net_vex"] = net_v
            item["net_cex"] = net_c
            cumulative_gex += net_g
            item["cumulative_gex"] = cumulative_gex
            
            gex_profile.append({
                "strike": float(k),
                "net_gex": round(net_g, 2),
                "call_gex": round(item["call_gex"], 2),
                "put_gex": round(item["put_gex"], 2),
                "net_dex": round(net_d, 2),
                "call_dex": round(item.get("call_dex", 0.0), 2),
                "put_dex": round(item.get("put_dex", 0.0), 2),
                "net_vex": round(net_v, 2),
                "call_vex": round(item["call_vex"], 2),
                "put_vex": round(item["put_vex"], 2),
                "net_cex": round(net_c, 2),
                "call_cex": round(item.get("call_cex", 0.0), 2),
                "put_cex": round(item.get("put_cex", 0.0), 2),
                "call_oi": item["call_oi"],
                "put_oi": item["put_oi"],
                "call_vol": item["call_vol"],
                "put_vol": item["put_vol"],
                "cumulative_gex": round(cumulative_gex, 2)
            })

        total_call_gex = sum(p["call_gex"] for p in gex_profile)
        total_put_gex = sum(p["put_gex"] for p in gex_profile)
        total_net_gex = total_call_gex + total_put_gex
        total_call_dex = sum(p.get("call_dex", 0.0) for p in gex_profile)
        total_put_dex = sum(p.get("put_dex", 0.0) for p in gex_profile)
        total_net_dex = total_call_dex + total_put_dex
        total_net_vex = sum(p["net_vex"] for p in gex_profile)
        total_call_cex = sum(p.get("call_cex", 0.0) for p in gex_profile)
        total_put_cex = sum(p.get("put_cex", 0.0) for p in gex_profile)
        total_net_cex = total_call_cex + total_put_cex
        total_call_oi = sum(p["call_oi"] for p in gex_profile)
        total_put_oi = sum(p["put_oi"] for p in gex_profile)
        total_call_vol = sum(p["call_vol"] for p in gex_profile)
        total_put_vol = sum(p["put_vol"] for p in gex_profile)

        # Pre-Market / Weekend OCC Clearing Detection:
        # If Yahoo Finance reports 0 openInterest due to overnight OCC settlement clearing,
        # synthesize latest active volume as the Open Interest proxy so OI analysis is never empty.
        is_oi_clearing = (total_call_oi == 0 and total_call_vol > 0) or (total_put_oi == 0 and total_put_vol > 0)
        if is_oi_clearing:
            for p in gex_profile:
                if p["call_oi"] == 0 and p["call_vol"] > 0:
                    p["call_oi"] = p["call_vol"]
                    p["is_oi_proxy"] = True
                if p["put_oi"] == 0 and p["put_vol"] > 0:
                    p["put_oi"] = p["put_vol"]
                    p["is_oi_proxy"] = True
            total_call_oi = sum(p["call_oi"] for p in gex_profile)
            total_put_oi = sum(p["put_oi"] for p in gex_profile)

        put_call_oi_ratio = round(total_put_oi / total_call_oi, 2) if total_call_oi > 0 else 1.0
        put_call_vol_ratio = round(total_put_vol / total_call_vol, 2) if total_call_vol > 0 else 1.0

        # Key levels
        # 1. Call Wall:
        # The primary upside resistance / dealer call gamma concentration.
        # We find the strike with the maximum Call GEX across the options chain (falling back to call OI/vol).
        calls_candidates = [p for p in gex_profile if p["call_gex"] > 0 or p["call_oi"] > 0 or p["call_vol"] > 0]
        if calls_candidates:
            call_wall_point = max(calls_candidates, key=lambda x: (x["call_gex"], x["call_oi"], x["call_vol"]))
        else:
            call_wall_point = min(gex_profile, key=lambda x: abs(x["strike"] - spot_price * 1.05))
        call_wall = call_wall_point["strike"]

        # 2. Put Wall:
        # The primary downside support / dealer put gamma concentration floor.
        # We find the strike with the largest Put GEX magnitude (most negative put_gex) across the chain (falling back to put OI/vol).
        puts_candidates = [p for p in gex_profile if p["put_gex"] < 0 or p["put_oi"] > 0 or p["put_vol"] > 0]
        if puts_candidates:
            # Prioritize primary put support strictly below Call Wall
            puts_below_cw = [p for p in puts_candidates if p["strike"] < call_wall]
            if puts_below_cw:
                put_wall_point = max(puts_below_cw, key=lambda x: (abs(x["put_gex"]), x["put_oi"], x["put_vol"]))
            else:
                put_wall_point = max(puts_candidates, key=lambda x: (abs(x["put_gex"]), x["put_oi"], x["put_vol"]))
        else:
            put_wall_point = min(gex_profile, key=lambda x: abs(x["strike"] - spot_price * 0.95))
        put_wall = put_wall_point["strike"]

        # 3. Absolute Gamma Strike:
        abs_gamma_point = max(gex_profile, key=lambda x: (abs(x["call_gex"]) + abs(x["put_gex"]), x["call_vol"] + x["put_vol"], x["call_oi"] + x["put_oi"]))
        abs_gamma_strike = abs_gamma_point["strike"]

        # 3b. Key Charm Pin Strike (Maximum delta-decay gravitational pull)
        charm_pin_point = max(gex_profile, key=lambda x: abs(x.get("net_cex", 0.0)))
        charm_pin_strike = charm_pin_point["strike"]

        # 3c. Absolute Delta Strike (Largest net delta positioning)
        abs_delta_point = max(gex_profile, key=lambda x: abs(x.get("net_dex", 0.0)))
        abs_delta_strike = abs_delta_point["strike"]

        # 4. Zero Gamma crossover (Gamma Flip Point)
        # Scan for all zero crossings where net_gex flips sign between adjacent strikes
        zero_crossings = []
        for i in range(len(gex_profile) - 1):
            p1 = gex_profile[i]
            p2 = gex_profile[i + 1]
            g1 = p1["net_gex"]
            g2 = p2["net_gex"]
            if (g1 < 0 and g2 > 0) or (g1 > 0 and g2 < 0) or (g1 == 0 and g2 != 0):
                dy = g2 - g1
                if dy != 0:
                    weight = (0 - g1) / dy
                    weight = max(0.0, min(1.0, weight))
                    cross_strike = round(p1["strike"] + weight * (p2["strike"] - p1["strike"]), 2)
                    zero_crossings.append(cross_strike)

        if zero_crossings:
            zero_gamma = min(zero_crossings, key=lambda k: abs(k - spot_price))
        else:
            if total_net_gex < 0:
                zero_gamma = round(spot_price * 1.02, 2)
            else:
                zero_gamma = round(spot_price * 0.98, 2)

        # 5. Max Pain
        max_pain_strike = spot_price
        min_total_payout = float('inf')
        for test_k in sorted_strikes:
            payout = 0.0
            for c in all_calls_list:
                wt = c.get("weight", c.get("oi", 0))
                if test_k > c["strike"]:
                    payout += (test_k - c["strike"]) * wt * 100
            for p in all_puts_list:
                wt = p.get("weight", p.get("oi", 0))
                if test_k < p["strike"]:
                    payout += (p["strike"] - test_k) * wt * 100
            if payout < min_total_payout:
                min_total_payout = payout
                max_pain_strike = test_k
        if min_total_payout == float('inf') or all(c.get("weight", 0) == 0 for c in all_calls_list):
            max_pain_strike = min(sorted_strikes, key=lambda k: abs(k - spot_price))

        # ---------------------------------------------------------------------
        # Quantitative Risk Gauges: Squeeze Vulnerability, Pin Risk, and Downside Cascade Risk
        # ---------------------------------------------------------------------
        corridor_width = (call_wall - put_wall) / spot_price if spot_price > 0 else 0.10
        is_narrow_corridor = corridor_width <= 0.04

        # 1. Squeeze Score (0-100):
        # Measures dealer short-gamma covering risk upon Call Wall breakout.
        # High ONLY when spot is breaking AT/ABOVE Call Wall, or pressing it with extreme call velocity above Zero Gamma.
        dist_to_call_wall = (call_wall - spot_price) / spot_price
        if dist_to_call_wall <= 0:
            # Active Call Wall Breakout: Dealers short gamma, covering accelerates
            squeeze_score = min(98, int(82 + abs(dist_to_call_wall) * 200))
        elif dist_to_call_wall < 0.015:
            squeeze_score = int(60 + (0.015 - dist_to_call_wall) * 1000)
        elif dist_to_call_wall < 0.04:
            squeeze_score = int(35 + (0.04 - dist_to_call_wall) * 600)
        else:
            squeeze_score = max(10, int(25 - dist_to_call_wall * 150))

        if put_call_oi_ratio < 0.6:
            squeeze_score = min(99, squeeze_score + 8)

        # Regulating Squeeze Score by Gamma Flip Point (Zero Gamma):
        # When trapped below Zero Gamma or in negative net GEX, an upside gamma squeeze is strongly inhibited
        if spot_price < zero_gamma or total_net_gex < 0:
            squeeze_score = max(8, squeeze_score - 40)
        elif is_narrow_corridor and dist_to_call_wall > 0:
            # Inside a narrow corridor prior to breakout: cap pre-breakout squeeze score so it doesn't falsely signal active squeeze
            squeeze_score = min(50, squeeze_score)

        # 2. Pin Risk Score (0-100):
        # High when spot is near Max Pain / Equilibrium and within the Put Wall / Call Wall corridor in positive gamma
        dist_to_max_pain = abs(spot_price - max_pain_strike) / spot_price
        if dist_to_max_pain < 0.01:
            pin_score = int(88 - dist_to_max_pain * 500)
        elif dist_to_max_pain < 0.03:
            pin_score = int(68 - (dist_to_max_pain - 0.01) * 1000)
        else:
            pin_score = max(15, int(42 - dist_to_max_pain * 300))

        if total_net_gex > 0 and spot_price >= zero_gamma:
            pin_score = min(99, pin_score + 10)
            if is_narrow_corridor:
                pin_score = min(99, pin_score + 15)  # Coiled inside narrow collar: high pin equilibrium
        elif spot_price < zero_gamma or total_net_gex < 0:
            pin_score = max(10, pin_score - 20)  # Free float / turbulent in negative gamma

        # 3. Cascade Risk Score (0-100):
        # Measures liquidation risk upon Put Wall breach or Negative Gamma expansion.
        # High ONLY when spot is breaking AT/BELOW Put Wall, or trading below Zero Gamma in short dealer gamma.
        dist_to_put_wall = (spot_price - put_wall) / spot_price
        if dist_to_put_wall <= 0:
            # Active Put Wall Breach: Dealers forced into pro-cyclical shorting
            cascade_score = min(98, int(82 + abs(dist_to_put_wall) * 200))
        elif dist_to_put_wall < 0.015:
            # Pressing Put Wall
            cascade_score = int(55 + (0.015 - dist_to_put_wall) * 1000)
        elif dist_to_put_wall < 0.04:
            cascade_score = int(30 + (0.04 - dist_to_put_wall) * 600)
        else:
            cascade_score = max(10, int(20 - dist_to_put_wall * 150))

        # In positive gamma above Zero Gamma, Put Wall is a BUY CUSHION, not a cascade
        if spot_price >= zero_gamma and total_net_gex >= 0:
            if dist_to_put_wall > 0:
                cascade_score = max(10, int(cascade_score * 0.55))  # Volatility dampened by dealer dip buying
        elif spot_price < zero_gamma or total_net_gex < 0:
            cascade_score = min(98, cascade_score + 35)

        if put_call_oi_ratio > 1.3:
            cascade_score = min(99, cascade_score + 8)

        if is_narrow_corridor and dist_to_put_wall > 0 and spot_price >= zero_gamma:
            cascade_score = min(45, cascade_score)

        risk_scores = {
            "squeeze_score": squeeze_score,
            "squeeze_rating": "EXTREME SQUEEZE RISK" if squeeze_score >= 80 else ("ELEVATED" if squeeze_score >= 60 else "LOW RISK"),
            "squeeze_color": "#38bdf8" if squeeze_score >= 80 else ("#fbbf24" if squeeze_score >= 60 else "#94a3b8"),
            "pin_score": pin_score,
            "pin_rating": "HIGH PIN PROBABILITY" if pin_score >= 75 else ("MODERATE PINNING" if pin_score >= 50 else "FREE FLOAT"),
            "pin_color": "#00E676" if pin_score >= 75 else ("#38bdf8" if pin_score >= 50 else "#94a3b8"),
            "cascade_score": cascade_score,
            "cascade_rating": "HIGH CASCADE RISK" if cascade_score >= 75 else ("MODERATE CASCADE" if cascade_score >= 50 else "LOW RISK"),
            "cascade_color": "#f43f5e" if cascade_score >= 75 else ("#fbbf24" if cascade_score >= 50 else "#94a3b8")
        }

        # Term Structure array
        term_structure = []
        for exp_key, val in term_structure_dict.items():
            term_structure.append({
                "expiry": exp_key,
                "dte": val["dte"],
                "net_gex": round(val["net_gex"], 2),
                "call_gex": round(val["call_gex"], 2),
                "put_gex": round(val["put_gex"], 2),
                "call_oi": val["call_oi"],
                "put_oi": val["put_oi"]
            })

        # Strike x Expiration Multi-Lens Matrices (top 18 strikes nearest spot)
        near_strikes = [s for s in sorted_strikes if abs(s - spot_price) / spot_price <= 0.09]
        if not near_strikes:
            near_strikes = sorted_strikes[:18]
        
        matrix_data = []
        delta_matrix = []
        charm_matrix = []
        vanna_matrix = []
        for st in near_strikes:
            gex_row = {"strike": st}
            dex_row = {"strike": st}
            cex_row = {"strike": st}
            vex_row = {"strike": st}
            for exp_key in target_expiries:
                gex_row[exp_key] = round(matrix_strikes.get(st, {}).get(exp_key, 0.0), 2)
                dex_row[exp_key] = round(delta_matrix_dict.get(st, {}).get(exp_key, 0.0), 2)
                cex_row[exp_key] = round(charm_matrix_dict.get(st, {}).get(exp_key, 0.0), 2)
                vex_row[exp_key] = round(vanna_matrix_dict.get(st, {}).get(exp_key, 0.0), 2)
            matrix_data.append(gex_row)
            delta_matrix.append(dex_row)
            charm_matrix.append(cex_row)
            vanna_matrix.append(vex_row)

        # Multi-expiry Delta & Charm Hedge Pressure Map (Price vs Time)
        # Y-axis: strikes, X-axis: expirations
        delta_grid = []
        charm_grid = []
        combined_grid = []
        all_pressure_points = []

        for st in near_strikes:
            d_row = []
            c_row = []
            comb_row = []
            for exp_key in target_expiries:
                d_val = round(delta_matrix_dict.get(st, {}).get(exp_key, 0.0), 2)
                c_val = round(charm_matrix_dict.get(st, {}).get(exp_key, 0.0), 2)
                # Combined directional pressure: Delta Pressure + 3-day scaled Charm drift
                comb_val = round(d_val + (c_val * 3.0), 2)
                d_row.append(d_val)
                c_row.append(c_val)
                comb_row.append(comb_val)

                if abs(comb_val) > 0.5:
                    all_pressure_points.append({
                        "strike": st,
                        "expiry": exp_key,
                        "delta_pressure_m": d_val,
                        "charm_decay_m": c_val,
                        "combined_pressure_m": comb_val,
                        "action": "BUY ZONE (Support)" if comb_val > 0 else "SELL ZONE (Resistance)"
                    })

            delta_grid.append(d_row)
            charm_grid.append(c_row)
            combined_grid.append(comb_row)

        # Extract top 3 institutional Buy Zones (Green) and Sell Zones (Red)
        sorted_by_comb = sorted(all_pressure_points, key=lambda x: x["combined_pressure_m"])
        top_sell_zones = sorted_by_comb[:3]  # most negative (dealers short delta / overhead resistance)
        top_buy_zones = sorted_by_comb[-3:][::-1]  # most positive (dealers long delta / dip support floor)

        tot_buy_m = sum(x["combined_pressure_m"] for x in all_pressure_points if x["combined_pressure_m"] > 0)
        tot_sell_m = sum(abs(x["combined_pressure_m"]) for x in all_pressure_points if x["combined_pressure_m"] < 0)

        hedge_pressure_map = {
            "expirations": target_expiries,
            "strikes": near_strikes,
            "spot_price": spot_price,
            "call_wall": call_wall,
            "put_wall": put_wall,
            "zero_gamma": zero_gamma,
            "delta_grid": delta_grid,
            "charm_grid": charm_grid,
            "combined_grid": combined_grid,
            "top_buy_zones": top_buy_zones,
            "top_sell_zones": top_sell_zones,
            "total_buy_pressure_m": round(tot_buy_m, 1),
            "total_sell_pressure_m": round(tot_sell_m, 1)
        }

        # ---------------------------------------------------------------------
        # OPTIONS HEDGING IMPACT & "TAIL WAGS THE DOG" ANALYSIS
        # ---------------------------------------------------------------------
        # 1. Flow-Induced Delta Hedging Volume (shares traded to hedge daily options contract flow):
        total_flow_delta_shares = total_call_delta_flow_shares + total_put_delta_flow_shares

        # 2. Spot Movement Gamma Re-Hedging Volume:
        # Dynamic rebalancing shares required as spot moves across its expected 1-day range:
        gamma_shares_per_1pct = (abs(total_net_gex) / spot_price) if spot_price > 0 else 0.0
        move_1d_pct = expected_move.get("move_1d_pct", 1.2) if expected_move else 1.2
        daily_gamma_rehedging_shares = gamma_shares_per_1pct * (move_1d_pct / 1.0)

        # 3. Overnight Charm Delta-Decay Drift:
        daily_charm_rehedging_shares = (abs(total_net_cex) / spot_price) if spot_price > 0 else 0.0

        # Total estimated shares traded by market makers due to options per day:
        total_options_hedging_shares = total_flow_delta_shares + daily_gamma_rehedging_shares + daily_charm_rehedging_shares

        # Ratio vs Average Daily Traded Volume (20-day ADTV):
        hedging_volume_ratio_pct = round((total_options_hedging_shares / adtv) * 100.0, 1) if adtv > 0 else 0.0
        hedging_today_ratio_pct = round((total_options_hedging_shares / latest_stock_vol) * 100.0, 1) if latest_stock_vol > 0 else 0.0

        # Options Notional vs Stock Dollar Turnover:
        stock_dollar_adtv = adtv * spot_price
        options_notional_ratio = round(total_options_notional / stock_dollar_adtv, 2) if stock_dollar_adtv > 0 else 1.0

        # Institutional Regime & Microstructure Impact Classification:
        if hedging_volume_ratio_pct >= 35.0 or options_notional_ratio >= 1.25:
            impact_level = "HIGH"
            impact_title = "TAIL WAGS THE DOG · SEVERE OPTIONS DOMINANCE"
            impact_badge = "OPTIONS DOMINANT"
            impact_color = "#00F0FF"
            is_options_impacted = True
            verdict = "YES · SEVERELY IMPACTED"
            impact_summary = (
                f"Options market makers generate ~{hedging_volume_ratio_pct:.1f}% of daily share turnover "
                f"({int(total_options_hedging_shares):,} shares/day vs ADTV {int(adtv):,}). "
                f"Stock price action is heavily dictated by options dealer delta/gamma hedging, pin levels, and walls."
            )
            trading_implication = (
                "Strong gravitational pull to Call Wall, Put Wall, and Max Pain. High vulnerability to gamma squeezes; "
                "dips and rallies are amplified or pinned by dealer flows. Pure equity fundamentals take a back seat."
            )
        elif hedging_volume_ratio_pct >= 15.0 or options_notional_ratio >= 0.50:
            impact_level = "MODERATE"
            impact_title = "BALANCED MARKET · ACTIVE OPTIONS INFLUENCE"
            impact_badge = "MODERATE IMPACT"
            impact_color = "#00E676"
            is_options_impacted = True
            verdict = "YES · MODERATELY IMPACTED"
            impact_summary = (
                f"Options hedging accounts for ~{hedging_volume_ratio_pct:.1f}% of daily share volume "
                f"({int(total_options_hedging_shares):,} shares/day vs ADTV {int(adtv):,}). "
                f"Options dealers exert meaningful support/resistance, especially near OpEx and 0DTE cycles."
            )
            trading_implication = (
                "Respect key GEX walls and the Zero Gamma flip for swing entries, but watch for institutional block orders "
                "that can overpower dealer positioning on catalyst days."
            )
        else:
            impact_level = "LOW"
            impact_title = "CASH EQUITY DRIVEN · MINIMAL OPTIONS IMPACT"
            impact_badge = "EQUITY DOMINANT"
            impact_color = "#94a3b8"
            is_options_impacted = False
            verdict = "NO · CASH EQUITY DRIVEN"
            impact_summary = (
                f"Options hedging represents only ~{hedging_volume_ratio_pct:.1f}% of daily volume "
                f"({int(total_options_hedging_shares):,} shares/day vs ADTV {int(adtv):,}). "
                f"The stock's cash liquidity pool dwarfs options turnover; price is driven primarily by equity cash flows."
            )
            trading_implication = (
                "Options hedging has minimal control over price action. Dealer walls are porous. "
                "Rely primarily on Volume Profile, VWAP, price technicals, and fundamental order flow."
            )

        # Breakdown chart data for frontend comparison visualizations
        breakdown_chart_data = [
            {
                "category": "Stock ADTV (20D)",
                "shares": int(adtv),
                "shares_millions": round(adtv / 1e6, 2),
                "type": "stock_volume",
                "color": "#64748b"
            },
            {
                "category": "Total Options Hedging",
                "shares": int(total_options_hedging_shares),
                "shares_millions": round(total_options_hedging_shares / 1e6, 2),
                "type": "hedging_total",
                "color": impact_color
            },
            {
                "category": "Flow Delta Hedging",
                "shares": int(total_flow_delta_shares),
                "shares_millions": round(total_flow_delta_shares / 1e6, 2),
                "type": "component",
                "color": "#38bdf8"
            },
            {
                "category": "Gamma Movement Rebalance",
                "shares": int(daily_gamma_rehedging_shares),
                "shares_millions": round(daily_gamma_rehedging_shares / 1e6, 2),
                "type": "component",
                "color": "#c084fc"
            },
            {
                "category": "Charm Overnight Decay",
                "shares": int(daily_charm_rehedging_shares),
                "shares_millions": round(daily_charm_rehedging_shares / 1e6, 2),
                "type": "component",
                "color": "#fbbf24"
            }
        ]

        net_bias_str = (
            f"NET DEALER DIP BUYING (+{int(total_net_directional_delta_shares/1e3):,}K shs)"
            if total_net_directional_delta_shares > 0 else
            f"NET DEALER SHORT HEDGING ({int(total_net_directional_delta_shares/1e3):,}K shs)"
        )

        options_hedging_impact = {
            "is_options_impacted": is_options_impacted,
            "verdict": verdict,
            "impact_level": impact_level,
            "impact_title": impact_title,
            "impact_badge": impact_badge,
            "impact_color": impact_color,
            "impact_summary": impact_summary,
            "trading_implication": trading_implication,
            "hedging_volume_ratio_pct": hedging_volume_ratio_pct,
            "hedging_today_ratio_pct": hedging_today_ratio_pct,
            "total_options_hedging_shares": int(total_options_hedging_shares),
            "flow_delta_shares": int(total_flow_delta_shares),
            "call_delta_flow_shares": int(total_call_delta_flow_shares),
            "put_delta_flow_shares": int(total_put_delta_flow_shares),
            "gamma_rehedging_shares": int(daily_gamma_rehedging_shares),
            "charm_decay_shares": int(daily_charm_rehedging_shares),
            "net_directional_delta_shares": int(total_net_directional_delta_shares),
            "net_directional_bias": net_bias_str,
            "adtv_shares": int(adtv),
            "latest_stock_vol": int(latest_stock_vol),
            "options_notional_m": round(total_options_notional / 1e6, 1),
            "stock_dollar_adtv_m": round(stock_dollar_adtv / 1e6, 1),
            "options_notional_ratio": options_notional_ratio,
            "breakdown_chart_data": breakdown_chart_data
        }

        # Compute SpotGamma TRACE Simulated GEX Profile & Real Strike Distribution
        spotgamma_trace = compute_spotgamma_trace(
            spot_price=spot_price,
            all_contracts=all_contracts_list,
            r=r,
            num_points=41,
            range_pct=0.08,
            gex_profile=gex_profile,
            call_wall=call_wall,
            put_wall=put_wall,
            zero_gamma=zero_gamma
        )

        # Regime evaluation
        regime_eval = evaluate_gex_regime(
            ticker=ticker,
            spot_price=spot_price,
            call_wall=call_wall,
            put_wall=put_wall,
            zero_gamma=zero_gamma,
            total_net_gex=total_net_gex
        )
        regime_title = regime_eval["title"]
        regime_posture = regime_eval["posture"]
        regime_color = regime_eval["color"]
        regime_badge = regime_eval["badge"]
        regime_summary = regime_eval["summary"]

        # ----------------------------------------------------------------------
        # INSTITUTIONAL QUANT AI DEALER EXECUTION ARCHITECTURE
        # ----------------------------------------------------------------------
        dist_to_cw = (call_wall - spot_price) / spot_price
        dist_to_pw = (spot_price - put_wall) / spot_price
        is_long_gamma = total_net_gex >= 0
        is_above_zg = spot_price >= zero_gamma

        if (dist_to_cw <= 0.015 or spot_price >= call_wall) and (is_above_zg or spot_price >= call_wall):
            playbook_id = "gamma_squeeze_expansion"
            setup_name = "Call Wall Gamma Squeeze Breakout 🚀"
            bias = "BULLISH BREAKOUT"
            bias_color = "emerald"
            entry_min = round(spot_price * 0.994, 2)
            entry_max = round(max(spot_price, call_wall * 1.004), 2)
            # Tight structural stop just below Call Wall breakout pivot (clamped between 1.2% and 2.5% risk)
            raw_stop = min(call_wall * 0.988, spot_price * 0.985)
            stop_loss = round(max(min(raw_stop, spot_price * 0.988), spot_price * 0.975), 2)
            risk_amt = max(spot_price - stop_loss, 0.01)
            target_primary = round(spot_price + (2.5 * risk_amt), 2)
            target_secondary = round(spot_price + (4.5 * risk_amt), 2)
            strategy_name = "Long Call Outright or Bull Call Debit Vertical"
            long_strike = round(call_wall, 1)
            short_strike = round(target_secondary, 1)
            options_spec = f"Buy ${long_strike:.1f} Call / Sell ${short_strike:.1f} Call (Call Wall Breakout Vertical)"
            trigger_condition = f"5-minute candle close above Call Wall (${call_wall}) with intraday volume > 1.8x average."
            invalidation_condition = f"15-minute close back below ${stop_loss} voids the dealer short-gamma acceleration."
            sizing_recommendation = "Tactical Momentum Sizing (1.5% - 2.0% Risk Allocation)"
            expected_holding = "1 to 3 Trading Days (Short-Gamma Acceleration Window)"
        elif dist_to_pw <= 0.02 and spot_price >= put_wall and is_long_gamma:
            playbook_id = "put_wall_bounce"
            setup_name = "Put Wall Volatility Cushion Bounce 🛡️"
            bias = "BULLISH REVERSAL"
            bias_color = "cyan"
            entry_min = round(put_wall * 0.998, 2)
            entry_max = round(max(spot_price, put_wall * 1.006), 2)
            # Tight stop strictly below Put Wall floor (clamped between 1.2% and 2.5% risk)
            raw_stop = put_wall * 0.988
            stop_loss = round(max(min(raw_stop, spot_price * 0.988), spot_price * 0.975), 2)
            risk_amt = max(spot_price - stop_loss, 0.01)
            target_primary = round(spot_price + (2.5 * risk_amt), 2)
            target_secondary = round(spot_price + (4.5 * risk_amt), 2)
            strategy_name = "Bull Put Credit Spread or ATM Long Call"
            long_strike = round(put_wall, 1)
            short_strike = round(put_wall * 0.96, 1)
            options_spec = f"Sell ${long_strike:.1f} Put / Buy ${short_strike:.1f} Put (Put Wall Cushion Credit Spread)"
            trigger_condition = f"Price touches Put Wall (${put_wall}) with wick rejection and positive dealer delta absorption."
            invalidation_condition = f"Fatal breach below Put Wall (${stop_loss}) triggers dealer downside cascade liquidations."
            sizing_recommendation = "Standard Institutional Allocation (2.0% - 2.5% Risk Allocation)"
            expected_holding = "3 to 8 Trading Days (Mean-Reversion toward OpEx Pin)"
        elif is_above_zg and is_long_gamma:
            playbook_id = "positive_gamma_pin"
            setup_name = "Positive Gamma Magnet Pinning 🧲"
            bias = "ACCUMULATE ON DIP"
            bias_color = "cyan"
            entry_min = round(spot_price * 0.992, 2)
            entry_max = round(spot_price * 1.004, 2)
            # Tight stop right below Zero Gamma / Spot (clamped between 1.2% and 2.5% risk)
            raw_stop = min(zero_gamma * 0.992, spot_price * 0.985)
            stop_loss = round(max(min(raw_stop, spot_price * 0.988), spot_price * 0.975), 2)
            risk_amt = max(spot_price - stop_loss, 0.01)
            target_primary = round(spot_price + (2.5 * risk_amt), 2)
            target_secondary = round(spot_price + (4.5 * risk_amt), 2)
            strategy_name = "Bull Call Debit Spread or Diagonal Calendar"
            long_strike = round(entry_min, 1)
            short_strike = round(call_wall, 1)
            options_spec = f"Buy ${long_strike:.1f} Call / Sell ${short_strike:.1f} Call (Pinning Corridor Vertical)"
            trigger_condition = f"Limit order execution on pullback into ${entry_min} - ${entry_max} zone above Zero Gamma."
            invalidation_condition = f"Daily close below Zero Gamma (${zero_gamma}) flips market maker posture to short gamma."
            sizing_recommendation = "Full Tactical Allocation (2.5% Portfolio Risk Budget)"
            expected_holding = "3 to 10 Trading Days (OpEx Magnet Phase)"
        else:
            playbook_id = "negative_gamma_cascade"
            setup_name = "Negative Gamma Volatility Cascade / Short ⚠️"
            bias = "BEARISH CASCADE / HEDGE"
            bias_color = "rose"
            entry_min = round(spot_price * 0.996, 2)
            entry_max = round(spot_price * 1.004, 2)
            # Tight stop strictly above Spot on short trade (clamped between 1.2% and 2.5% upside risk)
            raw_stop = zero_gamma * 1.008 if zero_gamma > spot_price else spot_price * 1.018
            stop_loss = round(min(max(raw_stop, spot_price * 1.012), spot_price * 1.025), 2)
            risk_amt = max(stop_loss - spot_price, 0.01)
            target_primary = round(spot_price - (2.5 * risk_amt), 2)
            target_secondary = round(spot_price - (4.5 * risk_amt), 2)
            strategy_name = "Bear Put Debit Spread or Long Put Outright"
            long_strike = round(spot_price, 1)
            short_strike = round(target_secondary, 1)
            options_spec = f"Buy ${long_strike:.1f} Put / Sell ${short_strike:.1f} Put (Volatility Expansion Vertical)"
            trigger_condition = f"Failure to reclaim Zero Gamma (${zero_gamma}) with accelerated put volume."
            invalidation_condition = f"Reclaim and hold above Zero Gamma (${zero_gamma}) forces dealer short covering."
            sizing_recommendation = "Defensive Scaled Sizing (1.0% Max Risk Budget due to high volatility)"
            expected_holding = "1 to 5 Trading Days (High Velocity Range Expansion)"

        if entry_min > entry_max:
            entry_min, entry_max = entry_max, entry_min

        risk_amt = max(abs(spot_price - stop_loss), 0.01)
        rew_amt_t1 = max(abs(target_primary - spot_price), 0.01)
        rew_amt_t2 = max(abs(target_secondary - spot_price), 0.01)
        rr_ratio_t1 = round(rew_amt_t1 / risk_amt, 1)
        rr_ratio_t2 = round(rew_amt_t2 / risk_amt, 1)

        stop_loss_pct = round(((stop_loss - spot_price) / spot_price) * 100, 1)
        target_primary_pct = round(((target_primary - spot_price) / spot_price) * 100, 1)
        target_secondary_pct = round(((target_secondary - spot_price) / spot_price) * 100, 1)

        execution_checklist = [
            {
                "phase": "Phase 1: Pre-Trade Greek Audit",
                "detail": f"Verify Spot (${spot_price:.2f}) posture relative to Zero Gamma (${zero_gamma}) and Call Wall (${call_wall}). Confirm regime: {regime_badge}."
            },
            {
                "phase": "Phase 2: Precision Entry",
                "detail": f"{trigger_condition} Enter within ${entry_min:.2f} ── ${entry_max:.2f} accumulation corridor."
            },
            {
                "phase": "Phase 3: Invalidation Sentinel",
                "detail": f"Place hard stop loss at ${stop_loss:.2f} ({stop_loss_pct}% risk). {invalidation_condition}"
            },
            {
                "phase": "Phase 4: Target 1 Scaling & Breakeven Ratchet",
                "detail": f"When Target 1 (${target_primary:.2f}) is tagged (+{target_primary_pct}%), close 50% of position and immediately ratchet stop loss to Breakeven (${entry_min:.2f})."
            },
            {
                "phase": "Phase 5: Runner Extension",
                "detail": f"Trail remaining 50% toward Target 2 (${target_secondary:.2f}) (+{target_secondary_pct}%) using 15m trailing stop."
            }
        ]

        trade_setup = {
            "setup_name": setup_name,
            "playbook_id": playbook_id,
            "bias": bias,
            "bias_color": bias_color,
            "ideal_entry": entry_min,
            "entry_range": [entry_min, entry_max],
            "stop_loss": stop_loss,
            "stop_loss_pct": stop_loss_pct,
            "target_primary": target_primary,
            "target_primary_pct": target_primary_pct,
            "target_secondary": target_secondary,
            "target_secondary_pct": target_secondary_pct,
            "risk_reward": f"1:{rr_ratio_t1}",
            "risk_reward_t2": f"1:{rr_ratio_t2}",
            "max_pain_pin": max_pain_strike,
            "strategy_name": strategy_name,
            "options_spec": options_spec,
            "trigger_condition": trigger_condition,
            "invalidation_condition": invalidation_condition,
            "sizing_recommendation": sizing_recommendation,
            "expected_holding": expected_holding,
            "execution_checklist": execution_checklist,
            "execution_tactic": (
                f"{strategy_name}: Accumulate inside ${entry_min} - ${entry_max}. "
                f"Stop at ${stop_loss} ({stop_loss_pct}%). Target 1 at ${target_primary} (+{target_primary_pct}%). "
                f"Target 2 at ${target_secondary} (+{target_secondary_pct}%)."
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
                "takeaway": f"The volatility regime boundary is ${zero_gamma}. Trading {'above' if spot_price >= zero_gamma else 'below'} this level {'buffers against sudden flash selloffs' if spot_price >= zero_gamma else 'accelerates directional intraday swings'}."
            },
            {
                "id": "vanna_exposure",
                "title": "Net Vanna Exposure (VEX)",
                "metric": f"{'+$' if total_net_vex >= 0 else '-$'}{abs(round(total_net_vex / 1e6, 1))}M/1% IV",
                "status": "Vanna Fuel Bullish" if total_net_vex >= 0 else "Vanna Drag Bearish",
                "color": "cyan" if total_net_vex >= 0 else "rose",
                "takeaway": f"Sensitivity to IV crush. When IV contracts, dealers {'buy' if total_net_vex >= 0 else 'sell'} shares to maintain delta neutrality."
            },
            {
                "id": "expected_move",
                "title": "1-Day Expected Move (±1σ)",
                "metric": f"±${em_1d} ({round((em_1d/spot_price)*100, 1)}%)",
                "status": f"${expected_move['range_1d'][0]} ── ${expected_move['range_1d'][1]}",
                "color": "purple",
                "takeaway": f"ATM IV {expected_move['atm_iv_pct']}%. Walls inside the expected move channel ({call_wall} / {put_wall}) act as magnetic pins."
            }
        ]

        # Compute institutional Greek-based 5D & 20D price projections
        greek_projection = compute_greek_projections(
            spot_price,
            {"call_wall": call_wall, "put_wall": put_wall, "zero_gamma": zero_gamma, "max_pain": max_pain_strike},
            {"total_net_gex": total_net_gex, "total_net_vex": total_net_vex},
            expected_move,
            risk_scores
        )

        return {
            "ticker": ticker.upper(),
            "spot_price": round(spot_price, 2),
            "key_levels": {
                "call_wall": call_wall,
                "put_wall": put_wall,
                "zero_gamma": zero_gamma,
                "max_pain": max_pain_strike,
                "absolute_gamma": abs_gamma_strike,
                "charm_pin_strike": charm_pin_strike,
                "absolute_delta_strike": abs_delta_strike
            },
            "totals": {
                "total_net_gex": round(total_net_gex, 2),
                "total_call_gex": round(total_call_gex, 2),
                "total_put_gex": round(total_put_gex, 2),
                "total_net_dex": round(total_net_dex, 2),
                "total_call_dex": round(total_call_dex, 2),
                "total_put_dex": round(total_put_dex, 2),
                "total_net_vex": round(total_net_vex, 2),
                "total_net_cex": round(total_net_cex, 2),
                "total_call_cex": round(total_call_cex, 2),
                "total_put_cex": round(total_put_cex, 2),
                "total_call_oi": total_call_oi,
                "total_put_oi": total_put_oi,
                "total_call_vol": total_call_vol,
                "total_put_vol": total_put_vol,
                "is_oi_clearing": is_oi_clearing,
                "put_call_oi_ratio": put_call_oi_ratio,
                "put_call_vol_ratio": put_call_vol_ratio
            },
            "spotgamma_trace": spotgamma_trace,
            "options_hedging_impact": options_hedging_impact,
            "hedge_pressure_map": hedge_pressure_map,
            "delta_matrix": delta_matrix,
            "charm_matrix": charm_matrix,
            "vanna_matrix": vanna_matrix,
            "regime": {
                "title": regime_title,
                "posture": regime_posture,
                "badge": regime_badge,
                "color": regime_color,
                "summary": regime_summary
            },
            "expected_move": expected_move,
            "risk_scores": risk_scores,
            "greek_projection": greek_projection,
            "pillars": pillars,
            "trade_setup": trade_setup,
            "gex_profile": gex_profile,
            "term_structure": term_structure,
            "matrix_data": matrix_data,
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

def sync_gex_results_regimes(file_path: str = '/Users/amitkumar/Desktop/SectorTrackerApp/public/gex_results.json') -> bool:
    """
    Synchronizes public/gex_results.json with the updated 4-quadrant regime evaluation
    and precision zero-gamma flip points so cached entries never show stale/identical regimes.
    """
    try:
        if not os.path.exists(file_path):
            return False
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        modified = False
        for ticker, val in data.items():
            if not isinstance(val, dict) or "gex_profile" not in val:
                continue
            spot = float(val.get("spot_price", 0))
            totals = val.get("totals", {})
            total_net_gex = float(totals.get("total_net_gex", 0))
            gex_profile = val.get("gex_profile", [])
            if not gex_profile or spot <= 0:
                continue

            # Recalculate Call Wall & Put Wall
            calls_candidates = [p for p in gex_profile if p.get("call_gex", 0) > 0 or p.get("call_oi", 0) > 0 or p.get("call_vol", 0) > 0]
            call_wall = max(calls_candidates, key=lambda x: (x.get("call_gex", 0), x.get("call_oi", 0), x.get("call_vol", 0)))["strike"] if calls_candidates else round(spot * 1.05, 2)

            puts_candidates = [p for p in gex_profile if p.get("put_gex", 0) < 0 or p.get("put_oi", 0) > 0 or p.get("put_vol", 0) > 0]
            put_wall = max(puts_candidates, key=lambda x: (abs(x.get("put_gex", 0)), x.get("put_oi", 0), x.get("put_vol", 0)))["strike"] if puts_candidates else round(spot * 0.95, 2)

            # Recalculate Zero Gamma (flip point closest to spot)
            zero_crossings = []
            for i in range(len(gex_profile) - 1):
                p1 = gex_profile[i]
                p2 = gex_profile[i + 1]
                g1 = p1.get("net_gex", 0)
                g2 = p2.get("net_gex", 0)
                if (g1 < 0 and g2 > 0) or (g1 > 0 and g2 < 0) or (g1 == 0 and g2 != 0):
                    dy = g2 - g1
                    if dy != 0:
                        weight = max(0.0, min(1.0, (0 - g1) / dy))
                        cross_strike = round(p1["strike"] + weight * (p2["strike"] - p1["strike"]), 2)
                        zero_crossings.append(cross_strike)

            if zero_crossings:
                zero_gamma = min(zero_crossings, key=lambda k: abs(k - spot))
            else:
                zero_gamma = round(spot * 1.02, 2) if total_net_gex < 0 else round(spot * 0.98, 2)

            if "key_levels" not in val:
                val["key_levels"] = {}
            val["key_levels"]["call_wall"] = call_wall
            val["key_levels"]["put_wall"] = put_wall
            val["key_levels"]["zero_gamma"] = zero_gamma

            # Evaluate regime
            regime = evaluate_gex_regime(ticker, spot, call_wall, put_wall, zero_gamma, total_net_gex)
            val["regime"] = regime

            # Update pillars
            for pillar in val.get("pillars", []):
                if pillar.get("id") == "gamma_regime":
                    pillar["metric"] = f"{'Long Gamma (+$' if total_net_gex >= 0 else 'Short Gamma (-$'}{abs(round(total_net_gex / 1e6, 1))}M/1%)"
                    pillar["status"] = "Stabilizing / Mean-Reverting" if total_net_gex >= 0 else "Expansive / High Volatility"
                    pillar["color"] = "emerald" if total_net_gex >= 0 else "rose"
                    pillar["takeaway"] = f"Dealers hold {'positive' if total_net_gex >= 0 else 'negative'} gamma exposure. Price volatility is {'damped' if total_net_gex >= 0 else 'accelerated'}."
                elif pillar.get("id") == "gamma_flip":
                    pillar["metric"] = f"${zero_gamma}"
                    pillar["status"] = f"{'+' if spot >= zero_gamma else ''}{round(((spot - zero_gamma)/zero_gamma)*100, 1)}% from Spot"
                    pillar["color"] = "cyan" if spot >= zero_gamma else "amber"
                    pillar["takeaway"] = f"The volatility regime boundary is ${zero_gamma}. Trading {'above' if spot >= zero_gamma else 'below'} this level {'buffers against sudden flash selloffs' if spot >= zero_gamma else 'accelerates directional intraday swings'}."

            modified = True

        if modified:
            with open(file_path, 'w') as f:
                json.dump(data, f)
            print(f"Successfully synced GEX regimes in {file_path}")
            return True
        return False
    except Exception as e:
        print(f"Error syncing GEX regimes: {e}")
        return False

# Automatically sync cached file on load
try:
    sync_gex_results_regimes()
except Exception:
    pass

if __name__ == "__main__":
    run_gex_engine()

