import yfinance as yf
import pandas as pd
import numpy as np

def calculate_dna(ticker, years=10):
    try:
        t = yf.Ticker(ticker)
        # Fetch 10 years of data
        df = t.history(period=f"{years}y")
        if df.empty or len(df) < 250:
            return {"error": "Not enough historical data."}

        close = df['Close']
        high = df['High']
        low = df['Low']
        open_s = df['Open']
        vol = df['Volume']

        # --- Calculate MAs ---
        ma10 = close.ewm(span=10, adjust=False).mean()
        ma21 = close.ewm(span=21, adjust=False).mean()
        ma50 = close.rolling(window=50).mean()
        ma200 = close.rolling(window=200).mean()

        # 1. Moving Average Respect Matrix
        def get_ma_respect(ma_series):
            touches = (low < ma_series * 1.015) & (close > ma_series * 0.985)
            fwd_ret = close.shift(-5) / close - 1
            touch_returns = fwd_ret[touches]
            if len(touch_returns) == 0: return 0, 0
            bounces = len(touch_returns[touch_returns > 0.03])
            slices = len(touch_returns[touch_returns < -0.03])
            if (bounces + slices) == 0: return 0, 0
            win_rate = bounces / (bounces + slices)
            return win_rate, bounces

        respect_10, _ = get_ma_respect(ma10)
        respect_21, _ = get_ma_respect(ma21)
        respect_50, _ = get_ma_respect(ma50)
        respect_200, _ = get_ma_respect(ma200)

        ma_stats = {
            "10-EMA": round(respect_10 * 100, 1),
            "21-EMA": round(respect_21 * 100, 1),
            "50-SMA": round(respect_50 * 100, 1),
            "200-SMA": round(respect_200 * 100, 1)
        }
        best_ma = max(ma_stats, key=ma_stats.get)

        # 2. Maximum Extension
        ext_50 = ((high / ma50) - 1).dropna()
        ext_200 = ((high / ma200) - 1).dropna()
        max_ext_50 = ext_50.max() if not ext_50.empty else 0
        max_ext_200 = ext_200.max() if not ext_200.empty else 0

        # 3. Biggest Streaks
        is_green = close > open_s
        streak_groups = (~is_green).cumsum()
        max_green_streak = is_green.groupby(streak_groups).sum().max()

        above_10 = close > ma10
        run_groups = (~above_10).cumsum()
        def run_return(idx):
            if len(idx) < 2: return 0
            return (close.loc[idx.index[-1]] / close.loc[idx.index[0]]) - 1

        run_returns = df.groupby(run_groups).apply(run_return)
        max_run_pct = run_returns.max() if not run_returns.empty else 0

        # 4. Whale Activity (Trend Continuation Check)
        vol_20 = vol.rolling(20).mean()
        vol_surge = vol > (vol_20 * 4) # 400% average volume
        surge_dates = df[vol_surge].index
        
        whale_str = "No massive 400%+ volume surges found."
        if len(surge_dates) > 0:
            best_surge = surge_dates[-1]
            idx_loc = df.index.get_loc(best_surge)
            if idx_loc < len(df) - 60:
                # Check if trend continued 60 days later
                price_at_surge = close.iloc[idx_loc]
                price_60_days_later = close.iloc[idx_loc + 60]
                if price_60_days_later > price_at_surge:
                    whale_str = f"Confirmed Whale Entry on {best_surge.strftime('%Y-%m-%d')}! Trend continued successfully."
                else:
                    whale_str = f"Whale Fakeout on {best_surge.strftime('%Y-%m-%d')}. Price collapsed within 60 days."
            else:
                whale_str = f"Recent volume climax on {best_surge.strftime('%Y-%m-%d')} (Waiting 60 days to confirm trend)."

        # 5. Technical Adherence Score
        ma200_roc = ma200.pct_change()
        noise = ma200_roc.std()
        score = max(0, min(100, 100 - (noise * 20000))) if not pd.isna(noise) else 50

        # --- PHASE 2 UPGRADES ---

        # 6. Historical Consolidation Duration
        # Normalized ATR
        tr = np.maximum((high - low), np.maximum(abs(high - close.shift()), abs(low - close.shift())))
        atr14 = tr.rolling(14).mean()
        natr = (atr14 / close) * 100
        natr_50 = natr.rolling(50).mean()
        
        # Consolidation is when NATR is below 50-day average AND it hasn't just broken out to new highs
        is_breakout = (close > high.shift(1).rolling(20).max())
        is_consolidating = (natr < natr_50) & (~is_breakout)
        consolidation_groups = (~is_consolidating).cumsum()
        
        consolidation_phases = is_consolidating.groupby(consolidation_groups).sum()
        consolidation_phases = consolidation_phases[consolidation_phases > 3] # Filter noise < 3 days
        
        median_consolidation = int(consolidation_phases.median()) if not consolidation_phases.empty else 14
        
        # Are we currently consolidating?
        current_consolidation_days = 0
        if is_consolidating.iloc[-1]:
            # Count backwards
            for i in range(len(is_consolidating)-1, -1, -1):
                if is_consolidating.iloc[i]:
                    current_consolidation_days += 1
                else:
                    break

        timing_str = f"Usually rests for {median_consolidation} days. Currently expanding (Not consolidating)."
        if current_consolidation_days > 0:
            timing_str = f"Currently on Day {current_consolidation_days} of consolidation. Historical Median: {median_consolidation} days."

        # 7. Structural Pattern Recognition
        # Analyze last 90 days
        if len(df) > 90:
            recent_90 = df.iloc[-90:]
            max_90_high = recent_90['High'].max()
            max_90_idx = recent_90['High'].idxmax()
            days_since_peak = (recent_90.index[-1] - max_90_idx).days
            
            curr_price = close.iloc[-1]
            drawdown_from_peak = (max_90_high - curr_price) / max_90_high
            
            pattern_str = "No clear pattern (Messy/Choppy)"
            
            # Cup and Handle
            if 30 <= days_since_peak <= 80 and drawdown_from_peak < 0.08 and current_consolidation_days > 3:
                pattern_str = "Cup & Handle Building ☕"
            # Bull Flag
            elif 5 <= days_since_peak <= 20 and drawdown_from_peak < 0.15 and natr.iloc[-1] < natr.iloc[-days_since_peak]:
                pattern_str = "Bull Flag Consolidating 🚩"
            # Saucer
            elif days_since_peak > 80 and drawdown_from_peak < 0.20:
                pattern_str = "Saucer / Rounded Bottom 🥣"
        else:
            pattern_str = "Insufficient data for pattern recognition."
            
        return {
            "ticker": ticker,
            "best_ma": best_ma,
            "ma_respect": ma_stats,
            "max_ext_50": round(max_ext_50 * 100, 1),
            "max_ext_200": round(max_ext_200 * 100, 1),
            "max_green_streak": int(max_green_streak),
            "max_run_above_10ema": round(max_run_pct * 100, 1),
            "whale_insight": whale_str,
            "technical_score": round(score, 1),
            "current_pattern": pattern_str,
            "consolidation_timing": timing_str
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    print(calculate_dna("NVDA"))
