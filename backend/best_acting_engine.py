import os
import json
import time
import math
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

def calculate_adx(df: pd.DataFrame, period: int = 14):
    up = (df['High'] - df['High'].shift(1)).fillna(0).values
    down = (df['Low'].shift(1) - df['Low']).fillna(0).values
    
    plus_dm = np.where((up > down) & (up > 0), up, 0.0)
    minus_dm = np.where((down > up) & (down > 0), down, 0.0)
    
    tr1 = (df['High'] - df['Low']).values
    tr2 = (df['High'] - df['Close'].shift(1)).abs().fillna(0).values
    tr3 = (df['Low'] - df['Close'].shift(1)).abs().fillna(0).values
    tr = np.maximum(tr1, np.maximum(tr2, tr3))
    
    def wilder_smooth(arr, n):
        arr = np.nan_to_num(np.asarray(arr, dtype=float))
        res = np.zeros_like(arr, dtype=float)
        if len(arr) >= n:
            res[n-1] = np.sum(arr[:n])
            for i in range(n, len(arr)):
                res[i] = res[i-1] - (res[i-1]/n) + arr[i]
        return res

    tr_s = wilder_smooth(tr, period)
    tr_s_safe = np.where(tr_s == 0, np.nan, tr_s)
    
    plus_di = np.nan_to_num(100.0 * (wilder_smooth(plus_dm, period) / tr_s_safe))
    minus_di = np.nan_to_num(100.0 * (wilder_smooth(minus_dm, period) / tr_s_safe))
    
    di_sum = plus_di + minus_di
    di_sum_safe = np.where(di_sum == 0, np.nan, di_sum)
    dx = np.nan_to_num(100.0 * np.abs(plus_di - minus_di) / di_sum_safe)
    adx = wilder_smooth(dx, period) / period
    
    return float(plus_di[-1]), float(minus_di[-1]), float(adx[-1]), float(adx[-2])

def calculate_adx_fast(close, high, low):
    n = len(close)
    if n < 30: return 0.0, 0.0, 0.0, 0.0
    up = np.maximum(0, high[1:] - high[:-1])
    down = np.maximum(0, low[:-1] - low[1:])
    plus_dm = np.where((up > down) & (up > 0), up, 0.0)
    minus_dm = np.where((down > up) & (down > 0), down, 0.0)
    
    tr1 = high[1:] - low[1:]
    tr2 = np.abs(high[1:] - close[:-1])
    tr3 = np.abs(low[1:] - close[:-1])
    tr = np.maximum(tr1, np.maximum(tr2, tr3))
    
    tr_s = pd.Series(tr).ewm(alpha=1/14, adjust=False).mean().values
    plus_di = 100.0 * (pd.Series(plus_dm).ewm(alpha=1/14, adjust=False).mean().values / np.maximum(tr_s, 1e-5))
    minus_di = 100.0 * (pd.Series(minus_dm).ewm(alpha=1/14, adjust=False).mean().values / np.maximum(tr_s, 1e-5))
    
    di_sum = np.maximum(1e-5, plus_di + minus_di)
    dx = 100.0 * np.abs(plus_di - minus_di) / di_sum
    adx = pd.Series(dx).ewm(alpha=1/14, adjust=False).mean().values
    return float(plus_di[-1]), float(minus_di[-1]), float(adx[-1]), float(adx[-2])

def run_best_acting_scanner():
    """Scans all liquid market leaders across 5 quantitative pillars using DuckDB Lakehouse."""
    results = []
    lakehouse_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'daily_ohlcv.parquet')
    
    if os.path.exists(lakehouse_path):
        try:
            import duckdb
            con = duckdb.connect()
            df_l = con.execute(f"SELECT Ticker, Date, Open, High, Low, Close, Volume FROM '{lakehouse_path}' WHERE Date >= CURRENT_DATE - INTERVAL 300 DAY ORDER BY Ticker, Date ASC").df()
            con.close()

            spy_g = df_l[df_l['Ticker'] == 'SPY']
            spy_60d = 0.0
            if len(spy_g) >= 60:
                spy_c = spy_g['Close'].values
                spy_60d = (spy_c[-1] - spy_c[-60]) / spy_c[-60]

            for ticker, g in df_l.groupby('Ticker'):
                if len(g) < 120: continue
                c = g['Close'].values
                h = g['High'].values
                l = g['Low'].values
                o = g['Open'].values
                v = g['Volume'].values

                curr_price = float(c[-1])
                if curr_price < 5.0: continue

                s_vol = pd.Series(v)
                vol_sma20 = s_vol.rolling(20).mean().values[-1]
                if vol_sma20 < 5000000: continue

                s_close = pd.Series(c)
                ema10 = s_close.ewm(span=10, adjust=False).mean().values[-1]
                ema21 = s_close.ewm(span=21, adjust=False).mean().values[-1]
                sma50 = s_close.rolling(50).mean().values[-1]
                sma200 = s_close.rolling(200).mean().values[-1]
                sma200_20d = s_close.rolling(200).mean().values[-20] if len(c) >= 220 else sma200

                p_di, m_di, curr_adx, prev_adx = calculate_adx_fast(c, h, l)

                score = 0
                badges = []

                # 1. ADX Pillar (25 pts)
                if curr_adx >= 25 and p_di > m_di:
                    score += 15
                    if curr_adx > prev_adx: score += 10
                elif curr_adx >= 20 and p_di > m_di:
                    score += 10

                # 2. RS Outperformance Pillar (25 pts)
                stock_60d = (c[-1] - c[-60]) / c[-60] if len(c) >= 60 else 0
                rs_outperformance = float((stock_60d - spy_60d) * 100)
                if rs_outperformance > 15.0: score += 25
                elif rs_outperformance > 5.0: score += 15

                # 3. EMA Stack Pillar (20 pts)
                is_aligned = (curr_price > ema10 > ema21 > sma50 > sma200)
                sma200_slope = (sma200 - sma200_20d) / max(sma200_20d, 1)
                if is_aligned and sma200_slope > 0: score += 20
                elif curr_price > sma50 > sma200: score += 10

                # 4. Volume Accumulation Pillar (15 pts)
                is_up = c > o
                is_down = c < o
                up_vol = np.sum(v[is_up][-20:]) if np.any(is_up[-20:]) else 0
                down_vol = np.sum(v[is_down][-20:]) if np.any(is_down[-20:]) else 1
                up_down_ratio = float(up_vol / max(down_vol, 1))
                if up_down_ratio >= 1.5: score += 15
                elif up_down_ratio >= 1.1: score += 8

                # 5. Base Proximity & Extension Pillar (20 pts)
                high_52w = float(np.max(h))
                pct_from_high = float((high_52w - curr_price) / high_52w * 100)
                if pct_from_high <= 5.0: score += 15
                elif pct_from_high <= 15.0: score += 10

                # Extension Penalty & Base Coiling Check (O'Neil & Minervini Rule)
                # Penalize stocks extended > 15% above 21-EMA or > 25% above 50-SMA
                dist_ema21_pct = float((curr_price - ema21) / ema21 * 100)
                dist_sma50_pct = float((curr_price - sma50) / sma50 * 100)
                
                is_extended = dist_ema21_pct > 15.0 or dist_sma50_pct > 25.0
                if is_extended:
                    score -= 30  # Demote extended stocks so they don't dominate top ranks
                else:
                    # Reward stocks resting within 0-6% of 10-EMA or 21-EMA (Actionable / Buyable)
                    if 0.0 <= dist_ema21_pct <= 6.0:
                        score += 15

                # Badges & Setup Classification
                if is_extended:
                    badges.append("⚠️ EXTENDED (+15%+ Over MA)")
                elif 0.0 <= dist_ema21_pct <= 6.0 and pct_from_high <= 12.0:
                    badges.append("🎯 ACTIONABLE ENTRY (On 21-EMA)")
                elif score >= 75:
                    badges.append("💎 MONSTER LEADER")

                if prev_adx < 20 and curr_adx >= 22 and p_di > m_di:
                    badges.append("🚀 STAGE 2 IGNITION")
                if curr_adx >= 25 and l[-1] <= ema21 * 1.01 and c[-1] >= ema21 * 0.99:
                    badges.append("🛡️ HOLY GRAIL PULLBACK")

                results.append({
                    "ticker": ticker,
                    "score": round(score, 1),
                    "price": round(curr_price, 2),
                    "adx": round(curr_adx, 1),
                    "plus_di": round(p_di, 1),
                    "minus_di": round(m_di, 1),
                    "rs_outperformance_pct": round(rs_outperformance, 1),
                    "pct_from_52w_high": round(pct_from_high, 1),
                    "dist_ema21_pct": round(dist_ema21_pct, 1),
                    "dist_sma50_pct": round(dist_sma50_pct, 1),
                    "is_extended": is_extended,
                    "up_down_vol_ratio": round(up_down_ratio, 2),
                    "badges": badges
                })
        except Exception as e:
            print(f"DuckDB scanning warning: {e}")

    results.sort(key=lambda x: (x['score'], x['rs_outperformance_pct']), reverse=True)
    out = {"updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "stocks": results[:50]}
    
    # Save to public directory
    public_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'best_acting_stocks.json')
    try:
        with open(public_path, 'w') as f:
            json.dump(out, f, indent=2)
    except Exception:
        pass

    return out

if __name__ == "__main__":
    res = run_best_acting_scanner()
    print(f"Scanned {len(res['stocks'])} stocks. Top Leader: {res['stocks'][0] if res['stocks'] else 'None'}")
