import yfinance as yf
import pandas as pd
import numpy as np

def calculate_adr_metrics(df):
    """
    Calculates 10-day and 20-day Average Daily Range as a percentage (ADR%):
    ADR% = mean((High - Low) / Low) * 100
    Also computes 50-day baseline ADR% to detect abnormal volatility expansion.
    """
    if df is None or len(df) < 10:
        return {"adr_10d": 0.0, "adr_20d": 0.0, "adr_50d": 0.0}
    
    high = df['High']
    low = df['Low']
    
    # Standard Deepvue / TraderLion ADR% formulation: (High - Low) / Low
    daily_range_pct = ((high - low) / low) * 100.0
    
    adr_10d = float(daily_range_pct.iloc[-10:].mean()) if len(daily_range_pct) >= 10 else float(daily_range_pct.mean())
    adr_20d = float(daily_range_pct.iloc[-20:].mean()) if len(daily_range_pct) >= 20 else adr_10d
    adr_50d = float(daily_range_pct.iloc[-50:].mean()) if len(daily_range_pct) >= 50 else adr_20d
    
    return {
        "adr_10d": round(adr_10d, 2),
        "adr_20d": round(adr_20d, 2),
        "adr_50d": round(adr_50d, 2)
    }

def classify_personality(adr_10d, adr_20d):
    """
    Ross Haber's 3-Tier Classification:
    1. Super Tight and Orderly: ~1% to 3.5%
    2. In-Between: ~3.5% to 6.0%
    3. Wide and Loose: > 6.0% (approaching double digits)
    """
    effective_adr = (adr_10d * 0.6) + (adr_20d * 0.4)
    
    if effective_adr <= 3.5:
        return {
            "tier": "TIGHT_AND_ORDERLY",
            "tier_label": "Tight & Orderly",
            "tier_color": "#10b981", # Emerald
            "badge_color": "rgba(16, 185, 129, 0.15)",
            "sizing_recommendation": "Full Position (Core Book Leader)",
            "max_allocation_pct": 100,
            "playbook": "High-conviction core position. Narrow daily spreads, minimal emotional shakeout, institutional accumulation glide. Allows tight, logical stops without noise-induced stop-outs."
        }
    elif effective_adr <= 6.0:
        return {
            "tier": "IN_BETWEEN",
            "tier_label": "In-Between",
            "tier_color": "#f59e0b", # Amber
            "badge_color": "rgba(245, 158, 11, 0.15)",
            "sizing_recommendation": "Moderate Size (Selective / Group Leader)",
            "max_allocation_pct": 60,
            "playbook": "Trade selectively. Must be a liquid leader in a leading industry group. The ADR number gets it on the radar; the chart's visual respect for support decides the trade."
        }
    else:
        return {
            "tier": "WIDE_AND_LOOSE",
            "tier_label": "Wide & Loose",
            "tier_color": "#ef4444", # Red/Rose
            "badge_color": "rgba(239, 68, 68, 0.15)",
            "sizing_recommendation": "Small / Satellite (Performance Enhancer Only)",
            "max_allocation_pct": 30,
            "playbook": "Performance enhancer only. Whippy, double-digit daily swings with erratic spread. Trade 1/4 to 1/3 size, take fast partial profits, and only trade when the core book is already working."
        }

def detect_guardian_ma(df):
    """
    Evaluates historical interaction with 4 core institutional moving averages:
    - 10-day SMA: Momentum glide (e.g. CIBR)
    - 21-day SMA: Primary swing anchor (Ross Haber rule)
    - 23-day EMA: Institutional tech anchor (e.g. CRWD)
    - 50-day SMA: Medium-term base defense
    
    Calculates respect win rate (% of times price bounced > +3% within 5-10 days after testing the MA).
    """
    if df is None or len(df) < 55:
        return {
            "guardian_ma": "21-SMA",
            "respect_score": 75.0,
            "ma_matrix": {"10-SMA": 70.0, "21-SMA": 75.0, "23-EMA": 72.0, "50-SMA": 70.0}
        }
    
    close = df['Close']
    low = df['Low']
    
    mas = {
        "10-SMA": close.rolling(10).mean(),
        "21-SMA": close.rolling(21).mean(),
        "23-EMA": close.ewm(span=23, adjust=False).mean(),
        "50-SMA": close.rolling(50).mean()
    }
    
    respect_scores = {}
    
    for ma_name, ma_series in mas.items():
        sub_low = low.iloc[-200:]
        sub_close = close.iloc[-200:]
        sub_ma = ma_series.iloc[-200:]
        
        tested = (sub_low <= sub_ma * 1.015) & (sub_close >= sub_ma * 0.97)
        test_indices = sub_low[tested].index
        
        if len(test_indices) < 2:
            respect_scores[ma_name] = 50.0
            continue
            
        bounces = 0
        total_tests = 0
        
        for idx in test_indices:
            pos = df.index.get_loc(idx)
            if pos < len(df) - 5:
                entry_c = close.iloc[pos]
                fwd_high = df['High'].iloc[pos+1 : pos+6].max()
                
                if (fwd_high - entry_c) / entry_c >= 0.03:
                    bounces += 1
                total_tests += 1
                
        win_rate = (bounces / total_tests) * 100.0 if total_tests > 0 else 50.0
        respect_scores[ma_name] = round(win_rate, 1)
        
    best_ma = max(respect_scores, key=respect_scores.get)
    return {
        "guardian_ma": best_ma,
        "respect_score": respect_scores[best_ma],
        "ma_matrix": respect_scores
    }

def detect_character_change(df, adr_10d, adr_50d):
    """
    Detects Ross Haber's character change signatures:
    1. Double close below the 21-day SMA after an uptrend (primary sell signal).
    2. Volatility blow-off: 10D ADR exceeds 50D ADR by > 50% after a prior run.
    """
    if df is None or len(df) < 25:
        return {
            "character_change_detected": False,
            "status": "NORMAL_GLIDE",
            "warning_level": "LOW",
            "signal": "Action orderly. Normal trend structure.",
            "consecutive_closes_below_21": 0
        }
        
    close = df['Close']
    sma_21 = close.rolling(21).mean()
    
    last_close = close.iloc[-1]
    prev_close = close.iloc[-2]
    last_sma = sma_21.iloc[-1]
    prev_sma = sma_21.iloc[-2]
    
    double_close_below = (last_close < last_sma) and (prev_close < prev_sma)
    single_close_below = (last_close < last_sma) and not double_close_below
    
    was_trending = (close.iloc[-20:-2] > sma_21.iloc[-20:-2]).sum() >= 10
    
    vol_blowout = False
    if adr_50d > 0 and (adr_10d / adr_50d) >= 1.50 and adr_10d >= 5.0:
        vol_blowout = True
        
    if double_close_below and was_trending:
        return {
            "character_change_detected": True,
            "status": "SELL_RULE_TRIGGERED",
            "warning_level": "HIGH",
            "signal": "🚨 Character Change: 2nd consecutive close below 21-day SMA. Trim full size or exit into strength.",
            "consecutive_closes_below_21": 2
        }
    elif vol_blowout:
        return {
            "character_change_detected": True,
            "status": "VOLATILITY_EXPANSION",
            "warning_level": "MEDIUM",
            "signal": "⚠️ Volatility Climax: 10D ADR expanded >50% above 50D baseline. Stock turning wide and loose.",
            "consecutive_closes_below_21": 1 if last_close < last_sma else 0
        }
    elif single_close_below and was_trending:
        return {
            "character_change_detected": False,
            "status": "TESTING_SUPPORT",
            "warning_level": "MEDIUM",
            "signal": "1st day below 21-day SMA. Watch for reclaim or risk 2-day sell rule trigger.",
            "consecutive_closes_below_21": 1
        }
    else:
        return {
            "character_change_detected": False,
            "status": "NORMAL_GLIDE",
            "warning_level": "LOW",
            "signal": "Action orderly. Holding above key moving averages.",
            "consecutive_closes_below_21": 0
        }

def get_stock_personality_profile(ticker, df=None):
    """
    Main entry point for generating the complete Ross Haber Stock Personality profile.
    """
    try:
        if df is None or len(df) < 25:
            t = yf.Ticker(ticker)
            df = t.history(period="1y")
            
        if df.empty or len(df) < 15:
            return {"error": f"Insufficient price data for {ticker}"}
            
        adr_metrics = calculate_adr_metrics(df)
        personality = classify_personality(adr_metrics["adr_10d"], adr_metrics["adr_20d"])
        guardian = detect_guardian_ma(df)
        character = detect_character_change(df, adr_metrics["adr_10d"], adr_metrics["adr_50d"])
        
        current_price = float(df['Close'].iloc[-1])
        
        return {
            "ticker": ticker.upper(),
            "current_price": round(current_price, 2),
            "adr_metrics": adr_metrics,
            "personality_tier": personality["tier"],
            "tier_label": personality["tier_label"],
            "tier_color": personality["tier_color"],
            "badge_color": personality["badge_color"],
            "sizing_recommendation": personality["sizing_recommendation"],
            "max_allocation_pct": personality["max_allocation_pct"],
            "playbook": personality["playbook"],
            "guardian_ma": guardian["guardian_ma"],
            "guardian_respect_score": guardian["respect_score"],
            "ma_matrix": guardian["ma_matrix"],
            "character_change": character
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import sys
    test_symbol = sys.argv[1] if len(sys.argv) > 1 else "AMD"
    profile = get_stock_personality_profile(test_symbol)
    import pprint
    pprint.pprint(profile)
