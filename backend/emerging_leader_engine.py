import yfinance as yf
import pandas as pd
import numpy as np
import json
import os

def calculate_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).ewm(alpha=1/period, adjust=False).mean()
    loss = (-delta.where(delta < 0, 0)).ewm(alpha=1/period, adjust=False).mean()
    rs = gain / loss.replace(0, 1e-10)
    return 100 - (100 / (1 + rs))

def evaluate_emerging_leader_setup(ticker, df=None, spy_series=None):
    """
    Master Emerging Market Leader Engine (4-Pillar Swarm Synthesis):
    Combines Microstructure VCP Geometry, RS Line Leading Divergence,
    Institutional Order Flow (Pocket Pivots & VDU), and Fundamental Inflection Signals.
    
    Returns a score (0 to 100) and actionable classification.
    """
    try:
        if df is None or len(df) < 80:
            return None
            
        close = df['Close']
        high = df['High']
        low = df['Low']
        open_s = df['Open']
        vol = df['Volume']
        
        curr_c = float(close.iloc[-1])
        curr_h = float(high.iloc[-1])
        curr_l = float(low.iloc[-1])
        curr_v = float(vol.iloc[-1])
        
        # Exclude penny stocks
        if curr_c < 5.0:
            return None
            
        # Market Cap Gate for Emerging Leaders ($2B <= Market Cap <= $20B)
        mcap_b = 0.0
        try:
            info = yf.Ticker(ticker).fast_info
            mcap = getattr(info, 'market_cap', 0)
            if mcap and mcap > 0:
                mcap_b = mcap / 1e9
                if mcap_b < 2.0 or mcap_b > 20.0:
                    return None
        except Exception:
            pass
            
        # Moving Averages
        ema10 = close.ewm(span=10, adjust=False).mean()
        ema21 = close.ewm(span=21, adjust=False).mean()
        sma50 = close.rolling(50).mean()
        sma150 = close.rolling(150).mean() if len(df) >= 150 else sma50 * 0.95
        sma200 = close.rolling(200).mean() if len(df) >= 200 else sma150 * 0.95
        vol50 = vol.rolling(50).mean()
        
        c_10 = float(ema10.iloc[-1])
        c_21 = float(ema21.iloc[-1])
        c_50 = float(sma50.iloc[-1])
        c_150 = float(sma150.iloc[-1])
        c_200 = float(sma200.iloc[-1])
        c_v50 = float(vol50.iloc[-1]) if float(vol50.iloc[-1]) > 0 else 1.0
        
        # -------------------------------------------------------------
        # PILLAR 1: Stage 2A Trend Template & Base Geometry (30 Pts)
        # -------------------------------------------------------------
        # Must be in Stage 2 Uptrend: Price > 150 SMA > 200 SMA
        high_52w = float(high.iloc[-252:].max()) if len(high) >= 252 else float(high.max())
        low_52w = float(low.iloc[-252:].min()) if len(low) >= 252 else float(low.min())
        
        is_stage2 = (curr_c >= c_150) and (c_150 >= c_200 * 0.98) and (curr_c >= low_52w * 1.25)
        if not is_stage2:
            return None
            
        # MA Bundle "Pinch" (Spread between 10, 21, 50 <= 5.0%)
        ma_min = min(c_10, c_21, c_50)
        ma_max = max(c_10, c_21, c_50)
        pinch_spread_pct = ((ma_max - ma_min) / curr_c) * 100
        is_pinched = pinch_spread_pct <= 5.0
        
        # Base Tightness (BT: 10-day price range <= 7%)
        recent_10_h = float(high.iloc[-10:].max())
        recent_10_l = float(low.iloc[-10:].min())
        base_tightness_pct = ((recent_10_h - recent_10_l) / recent_10_h) * 100
        is_tight = base_tightness_pct <= 7.0
        
        # Reject Stage 3 Distribution (Down Vol > Up Vol * 1.25 over last 20 days)
        recent_20_c = close.iloc[-20:].to_numpy()
        recent_20_o = open_s.iloc[-20:].to_numpy()
        recent_20_v = vol.iloc[-20:].to_numpy()
        up_mask = recent_20_c > recent_20_o
        down_mask = recent_20_c < recent_20_o
        
        up_vol_avg = float(recent_20_v[up_mask].mean()) if np.any(up_mask) else 1.0
        down_vol_avg = float(recent_20_v[down_mask].mean()) if np.any(down_mask) else 1.0
        
        is_stage3_distribution = down_vol_avg > (up_vol_avg * 1.25)
        if is_stage3_distribution:
            return None  # Filter out failing distribution tops
            
        p1_score = 0
        if is_stage2: p1_score += 10
        if is_pinched: p1_score += 10
        if is_tight: p1_score += 10
        
        # -------------------------------------------------------------
        # PILLAR 2: Relative Strength Line Leading Divergence (25 Pts)
        # -------------------------------------------------------------
        if spy_series is not None and not spy_series.empty:
            aligned_spy = spy_series.reindex(close.index).ffill()
            rs_line = close / aligned_spy
        else:
            rs_line = close / sma50
            
        rs_60d_max = float(rs_line.iloc[-60:].max()) if len(rs_line) >= 60 else float(rs_line.max())
        price_60d_max = float(high.iloc[-60:].max()) if len(high) >= 60 else high_52w
        
        curr_rs = float(rs_line.iloc[-1])
        is_rs_60d_high = curr_rs >= (rs_60d_max * 0.995)
        is_price_consolidating = curr_h <= (price_60d_max * 0.98) # Price at least 2% below base ceiling
        
        is_rs_leading_divergence = is_rs_60d_high and is_price_consolidating
        
        p2_score = 0
        if is_rs_leading_divergence:
            p2_score = 25
        elif is_rs_60d_high:
            p2_score = 15
        elif curr_rs >= (rs_60d_max * 0.96):
            p2_score = 10
            
        # -------------------------------------------------------------
        # PILLAR 3: Institutional Order Flow & VDU Squeeze (25 Pts)
        # -------------------------------------------------------------
        # Up/Down Volume Ratio over 50 days
        up_vol_50 = float(vol[close > close.shift(1)].iloc[-50:].sum()) if len(df) >= 50 else 1.0
        down_vol_50 = float(vol[close < close.shift(1)].iloc[-50:].sum()) if len(df) >= 50 else 1.0
        ud_vol_ratio = round(up_vol_50 / max(1.0, down_vol_50), 2)
        
        # Volume Dry-Up (VDU: Daily Vol <= 60% of Vol50)
        curr_vol_ratio = curr_v / c_v50
        is_vdu = curr_vol_ratio <= 0.60
        vdu_3d_count = int((vol.iloc[-5:] <= c_v50 * 0.65).sum())
        
        # Pocket Pivot in prior 10 days
        has_pocket_pivot = False
        for i in range(-10, 0):
            if close.iloc[i] > close.iloc[i-1]:
                c_vol = vol.iloc[i]
                prev_10_c = close.iloc[i-10:i]
                prev_10_v = vol.iloc[i-10:i]
                down_vols = [prev_10_v.iloc[k] for k in range(1, len(prev_10_c)) if prev_10_c.iloc[k] < prev_10_c.iloc[k-1]]
                max_down_v = max(down_vols) if down_vols else 0
                if c_vol > max_down_v and max_down_v > 0:
                    c_val = close.iloc[i]
                    near_ma = (
                        abs(c_val - float(ema10.iloc[i])) / c_val < 0.025 or
                        abs(c_val - float(ema21.iloc[i])) / c_val < 0.025 or
                        abs(c_val - float(sma50.iloc[i])) / c_val < 0.025
                    )
                    if near_ma:
                        has_pocket_pivot = True
                        break
                        
        p3_score = 0
        if ud_vol_ratio >= 1.5: p3_score += 10
        elif ud_vol_ratio >= 1.2: p3_score += 5
        
        if is_vdu or vdu_3d_count >= 2: p3_score += 10
        if has_pocket_pivot: p3_score += 5
        
        # -------------------------------------------------------------
        # PILLAR 4: Momentum & Breakout Ignition Proximity (20 Pts)
        # -------------------------------------------------------------
        entry_pivot = round(float(high.iloc[-15:-1].max()) if len(high) >= 15 else float(high.iloc[-2]), 2)
        dist_pivot_pct = ((entry_pivot - curr_c) / entry_pivot) * 100
        
        is_breakout_ignition = (curr_c >= entry_pivot * 0.998 or curr_h >= entry_pivot) and (curr_vol_ratio >= 1.20)
        
        p4_score = 0
        if is_breakout_ignition:
            p4_score = 20
        elif abs(dist_pivot_pct) <= 3.5:
            p4_score = 15
        elif abs(dist_pivot_pct) <= 6.0:
            p4_score = 10
            
        total_score = round(p1_score + p2_score + p3_score + p4_score, 1)
        
        # Classification Tier
        if total_score >= 80:
            tier = "EMERGING_LEADER_IGNITION"
            tier_label = "🌱 Emerging Leader Ignition"
            tier_color = "#10b981"
        elif total_score >= 65:
            tier = "HIGH_CONVICTION_COILING"
            tier_label = "⚡ High Conviction Coiling"
            tier_color = "#3b82f6"
        else:
            tier = "WATCHLIST_DEVELOPING"
            tier_label = "🟡 Developing Watchlist"
            tier_color = "#f59e0b"
            
        badges = []
        if is_rs_leading_divergence: badges.append("🔥 RS Leading High")
        if is_pinched: badges.append(f"📐 MA Pinch ({pinch_spread_pct:.1f}%)")
        if is_vdu: badges.append(f"💧 Vol Dry-Up (-{int((1.0 - curr_vol_ratio)*100)}%)")
        if has_pocket_pivot: badges.append("⚡ Pocket Pivot")
        if ud_vol_ratio >= 1.5: badges.append(f"📊 U/D Vol {ud_vol_ratio}x")
        
        stop_loss = round(ma_min * 0.98, 2)
        risk_pct = round(((curr_c - stop_loss) / curr_c) * 100, 1) if curr_c > stop_loss else 2.5
        
        return {
            "ticker": ticker.upper(),
            "score": total_score,
            "tier": tier,
            "tier_label": tier_label,
            "tier_color": tier_color,
            "price": round(curr_c, 2),
            "entry_pivot": entry_pivot,
            "stop_loss": stop_loss,
            "risk_pct": risk_pct,
            "pinch_spread_pct": round(pinch_spread_pct, 1),
            "base_tightness_pct": round(base_tightness_pct, 1),
            "ud_vol_ratio": ud_vol_ratio,
            "vol_ratio": round(curr_vol_ratio, 2),
            "is_rs_leading": is_rs_leading_divergence,
            "has_pocket_pivot": has_pocket_pivot,
            "is_vdu": is_vdu,
            "badges": badges,
            "summary_metric": f"{tier_label} ({total_score}/100) · Market Cap: ${mcap_b:.1f}B · " + " · ".join(badges[:3])
        }
    except Exception as e:
        return None

def run_emerging_leader_scanner(universe=None):
    """
    Runs the Master Emerging Market Leader Engine across the universe.
    Writes results to public/emerging_leaders.json.
    """
    if universe is None:
        from screener_engine import UNIVERSE
        universe = UNIVERSE
        
    print(f"Running Swarm Emerging Leader Engine on {len(universe)} tickers...")
    
    spy_df = yf.download('SPY', period='1y', interval='1d', progress=False)['Close']
    spy_series = spy_df.iloc[:,0] if hasattr(spy_df, 'columns') and isinstance(spy_df, pd.DataFrame) else spy_df
    
    df_all = yf.download(universe, period='1y', interval='1d', group_by='ticker', progress=False)
    
    candidates = []
    for ticker in universe:
        try:
            if ticker not in df_all: continue
            tdf = df_all[ticker].dropna()
            if len(tdf) < 80: continue
            
            res = evaluate_emerging_leader_setup(ticker, tdf, spy_series=spy_series)
            if res and res['score'] >= 25:
                candidates.append(res)
        except Exception:
            pass
            
    candidates.sort(key=lambda x: x['score'], reverse=True)
    
    output_path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/emerging_leaders.json'
    with open(output_path, 'w') as f:
        json.dump({
            "updated_at": pd.Timestamp.now().isoformat(),
            "count": len(candidates),
            "candidates": candidates
        }, f, indent=2)
        
    print(f"Successfully generated Emerging Leader results ({len(candidates)} candidates) at {output_path}")
    return candidates

if __name__ == "__main__":
    run_emerging_leader_scanner()
