import yfinance as yf
import pandas as pd
import numpy as np
import json
import warnings
import sys
import os
from screener_engine import UNIVERSE

warnings.filterwarnings('ignore')

def run_squeeze_engine():
    print(f"Running Upgraded Short & Keltner Squeeze Engine on {len(UNIVERSE)} stocks...")
    
    results = {
        "ttm_keltner_squeeze": [],
        "squeeze_started": [],
        "gamma_squeeze_setup": [],
        "high_short_interest": []
    }
    
    # Download daily data for all to check for recent spikes & Keltner squeeze compression
    df = yf.download(UNIVERSE, period='60d', interval='1d', group_by='ticker', progress=False)
    
    for ticker in UNIVERSE:
        try:
            if ticker not in df: continue
            ticker_df = df[ticker].dropna()
            if ticker_df.empty or len(ticker_df) < 25: continue
            
            c = ticker_df['Close']
            h = ticker_df['High']
            l = ticker_df['Low']
            v = ticker_df['Volume']
            
            # 1. Bollinger Bands (20-period SMA, 2.0 Std Dev)
            sma20 = c.rolling(20).mean()
            std20 = c.rolling(20).std()
            bb_upper = sma20 + (2.0 * std20)
            bb_lower = sma20 - (2.0 * std20)
            bb_width = (bb_upper - bb_lower) / sma20 * 100
            
            # 2. Keltner Channels (20-period EMA, 1.5x ATR14)
            ema20 = c.ewm(span=20, adjust=False).mean()
            tr = np.maximum(h - l, np.maximum((h - c.shift(1)).abs(), (l - c.shift(1)).abs()))
            atr14 = tr.rolling(14).mean()
            kc_upper = ema20 + (1.5 * atr14)
            kc_lower = ema20 - (1.5 * atr14)
            kc_width = (kc_upper - kc_lower) / ema20 * 100
            
            # TTM Squeeze Condition: Bollinger Bands collapse INSIDE Keltner Channels (Volatility Coiling)
            bb_u_curr, bb_l_curr = float(bb_upper.iloc[-1]), float(bb_lower.iloc[-1])
            kc_u_curr, kc_l_curr = float(kc_upper.iloc[-1]), float(kc_lower.iloc[-1])
            
            is_ttm_squeeze = (bb_u_curr <= kc_u_curr) and (bb_l_curr >= kc_l_curr)
            compression_ratio = float((bb_u_curr - bb_l_curr) / (kc_u_curr - kc_l_curr)) if (kc_u_curr - kc_l_curr) > 0 else 1.0
            
            # Volume Dry-Up (VDU)
            curr_v = float(v.iloc[-1])
            avg_v20 = float(v.rolling(20).mean().iloc[-1])
            is_vdu = curr_v < (avg_v20 * 0.80) if avg_v20 > 0 else False
            
            t = yf.Ticker(ticker)
            info = t.info
            
            short_pct = info.get('shortPercentOfFloat', 0) or 0
            short_ratio = info.get('shortRatio', 0) or 0
            short_str = f"{short_pct * 100:.1f}%" if short_pct else "N/A"
            
            base_data = {
                "ticker": ticker,
                "price": round(float(c.iloc[-1]), 2),
                "short_float": short_str,
                "short_ratio": short_ratio,
                "bb_width_pct": round(float(bb_width.iloc[-1]), 1),
                "kc_width_pct": round(float(kc_width.iloc[-1]), 1),
                "compression_ratio": round(compression_ratio, 2),
                "is_vdu": is_vdu
            }

            # -----------------------------------------------------------------
            # CATEGORY 1: PENDING TTM KELTNER SQUEEZE (Pending Breakout Before Surge!)
            # -----------------------------------------------------------------
            if is_ttm_squeeze or compression_ratio < 0.95:
                res = base_data.copy()
                status_text = "⚡ TTM Keltner Squeeze Active" if is_ttm_squeeze else "🔥 Near Squeeze Coiling"
                vdu_text = " | VDU Dry-Up" if is_vdu else ""
                res["metric"] = f"{status_text} ({compression_ratio:.2f}x Ratio{vdu_text})"
                results["ttm_keltner_squeeze"].append(res)

            # Check Options Flow for Short/Gamma Squeeze filters
            if (short_pct and short_pct > 0.05) or (short_ratio and short_ratio > 3):
                options = t.options
                call_vol = 0
                put_vol = 0
                cp_ratio = 0
                avg_iv = 0
                
                if len(options) > 0:
                    try:
                        chain = t.option_chain(options[0])
                        call_vol = chain.calls['volume'].sum()
                        put_vol = chain.puts['volume'].sum()
                        if 'impliedVolatility' in chain.calls.columns:
                            avg_iv = chain.calls['impliedVolatility'].mean()
                        if put_vol > 0:
                            cp_ratio = call_vol / put_vol
                    except:
                        pass
                
                base_data["cp_ratio"] = round(cp_ratio, 2)
                
                # Squeeze Started Logic
                curr_c = float(c.iloc[-1])
                prev_c = float(c.iloc[-2])
                price_jump = (curr_c / prev_c) - 1
                vol_mult = curr_v / avg_v20 if avg_v20 > 0 else 0
                
                if price_jump > 0.04 and vol_mult > 1.5 and cp_ratio > 1.2:
                    res = base_data.copy()
                    res["metric"] = f"+{price_jump*100:.1f}% on {vol_mult:.1f}x Vol"
                    results["squeeze_started"].append(res)
                
                elif cp_ratio > 2.0:
                    res = base_data.copy()
                    res["metric"] = f"Heavy Calls ({cp_ratio:.1f}x Puts)"
                    results["gamma_squeeze_setup"].append(res)
                    
                else:
                    res = base_data.copy()
                    powder_keg_score = (short_ratio * 10) + (avg_iv * 100) + (put_vol / 1000)
                    if pd.isna(powder_keg_score): powder_keg_score = 0
                    
                    res["powder_keg_score"] = powder_keg_score
                    res["metric"] = f"Short: {short_str} | IV: {avg_iv*100:.0f}% | Puts: {int(put_vol)}"
                    results["high_short_interest"].append(res)
                    
        except Exception as e:
            pass
            
    # Sort and slice top 15 for each category
    results["ttm_keltner_squeeze"] = sorted(results["ttm_keltner_squeeze"], key=lambda x: x.get('compression_ratio', 1.0))[:15]
    results["high_short_interest"] = sorted(results["high_short_interest"], key=lambda x: x.get('powder_keg_score', 0), reverse=True)[:15]
    results["gamma_squeeze_setup"] = sorted(results["gamma_squeeze_setup"], key=lambda x: x.get('cp_ratio', 0) or 0, reverse=True)[:15]
    
    output_path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/squeeze_results.json'
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
        
    print(f"Successfully wrote upgraded Keltner & Short Squeeze results to {output_path}")

if __name__ == "__main__":
    run_squeeze_engine()
