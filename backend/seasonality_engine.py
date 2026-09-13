import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
import sys
import datetime
import warnings

warnings.filterwarnings('ignore')

# 80-100 High-Liquidity Momentum & Market Leader Universe
SEASONALITY_UNIVERSE = [
    'NVDA', 'AAPL', 'MSFT', 'AMZN', 'META', 'GOOGL', 'TSLA', 'AMD', 'AVGO', 'TSM',
    'PLTR', 'NFLX', 'ORCL', 'ARM', 'QCOM', 'ASML', 'CRM', 'UBER', 'DASH', 'SHOP',
    'LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'VRTX', 'REGN',
    'JPM', 'GS', 'MS', 'V', 'MA', 'BAC', 'COIN', 'HOOD',
    'GE', 'CAT', 'ETN', 'PWR', 'EMR', 'UNP', 'DE',
    'COST', 'WMT', 'HD', 'TJX', 'CMG', 'NKE', 'LULU', 'SBUX',
    'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'VLO',
    'CRWD', 'PANW', 'NET', 'DDOG', 'SNOW', 'MDB', 'NOW', 'INTU',
    'ISRG', 'SYK', 'BSX', 'MDT',
    'ALAB', 'ASTS', 'RDDT', 'CAVA', 'SMCI', 'CELH', 'APP'
]

def clean_val(v, default=0.0):
    if v is None: return default
    try:
        if pd.isna(v): return default
        return float(v)
    except Exception:
        return default

def get_options_flow(ticker_symbol, current_price):
    try:
        t = yf.Ticker(ticker_symbol)
        expirations = t.options
        if not expirations:
            return None
        chain = t.option_chain(expirations[0])
        calls = chain.calls.dropna(subset=['openInterest'])
        puts = chain.puts.dropna(subset=['openInterest'])
        
        call_vol = clean_val(calls['volume'].sum()) if 'volume' in calls else 0
        put_vol = clean_val(puts['volume'].sum()) if 'volume' in puts else 0
        call_oi = clean_val(calls['openInterest'].sum())
        put_oi = clean_val(puts['openInterest'].sum())
        
        pcr_vol = round(put_vol / call_vol, 2) if call_vol > 0 else 1.0
        pcr_oi = round(put_oi / call_oi, 2) if call_oi > 0 else 1.0
        
        avg_iv = 0.0
        if 'impliedVolatility' in calls.columns:
            avg_iv = round(clean_val(calls['impliedVolatility'].median()) * 100, 1)

        atm_strike = min(calls['strike'], key=lambda x: abs(x - current_price))
        atm_call = calls[calls['strike'] == atm_strike].iloc[0] if not calls[calls['strike'] == atm_strike].empty else None
        atm_put = puts[puts['strike'] == atm_strike].iloc[0] if not puts[puts['strike'] == atm_strike].empty else None

        implied_move_pct = 0.0
        if atm_call is not None and atm_put is not None:
            c_p = (atm_call['bid'] + atm_call['ask'])/2 if atm_call['bid'] > 0 else atm_call['lastPrice']
            p_p = (atm_put['bid'] + atm_put['ask'])/2 if atm_put['bid'] > 0 else atm_put['lastPrice']
            implied_move_pct = round(((c_p + p_p) / current_price) * 100, 1) if current_price > 0 else 0.0

        return {
            'pcr_vol': pcr_vol,
            'pcr_oi': pcr_oi,
            'call_vol': int(call_vol),
            'put_vol': int(put_vol),
            'avg_iv': avg_iv,
            'implied_move_pct': implied_move_pct,
            'bullish_flow': pcr_vol < 0.75 or pcr_oi < 0.75
        }
    except Exception:
        return None

def run_seasonality_radar():
    print(f"Executing 10-Year Seasonality Radar Screener on {len(SEASONALITY_UNIVERSE)} universe tickers...")
    
    # Download 10y daily data for universe
    df = yf.download(SEASONALITY_UNIVERSE, period='10y', interval='1d', group_by='ticker', progress=False)
    
    cur_month = pd.Timestamp.now().month
    next_month = (cur_month % 12) + 1
    cur_quarter = (cur_month - 1) // 3 + 1
    next_quarter = (cur_quarter % 4) + 1
    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    candidates = []
    
    for sym in SEASONALITY_UNIVERSE:
        try:
            if sym not in df: continue
            sub = df[sym].dropna()
            if len(sub) < 300: continue
            
            close = sub['Close']
            high = sub['High']
            low = sub['Low']
            volume = sub['Volume']
            
            curr_p = float(close.iloc[-1])
            if curr_p <= 5.0: continue # Skip penny stocks
            
            # --- Technical Analysis ---
            sma20 = float(close.rolling(20).mean().iloc[-1])
            sma50 = float(close.rolling(50).mean().iloc[-1])
            sma200 = float(close.rolling(200).mean().iloc[-1]) if len(close) >= 200 else sma50
            
            high_52w = float(high.tail(252).max())
            dist_52w_pct = round(((curr_p - high_52w) / high_52w) * 100, 1)
            
            # 20d volume average
            vol_20d_avg = float(volume.tail(20).mean())
            dollar_vol = curr_p * vol_20d_avg
            if dollar_vol < 20_000_000: continue # Enforce $20M daily dollar liquidity
            
            # Stage 2 Alignment
            bullish_alignment = curr_p > sma20 and sma20 > sma50 and sma50 > sma200
            above_50 = curr_p > sma50
            above_20 = curr_p > sma20
            
            # ATR 14
            tr = pd.concat([
                high - low,
                (high - close.shift(1)).abs(),
                (low - close.shift(1)).abs()
            ], axis=1).max(axis=1)
            atr14 = float(tr.rolling(14).mean().iloc[-1])
            adr_pct = round((atr14 / curr_p) * 100, 2)
            
            # --- 10-Year Seasonality Analysis ---
            monthly = close.resample('ME').last().pct_change().dropna()
            if len(monthly) < 24: continue
            
            df_m = pd.DataFrame({'ret': monthly, 'month': monthly.index.month})
            
            # Current Month Stats
            cur_sub = df_m[df_m['month'] == cur_month]
            cur_win = round(float((cur_sub['ret'] > 0).mean() * 100), 1) if len(cur_sub) > 0 else 50.0
            cur_avg = round(float(cur_sub['ret'].mean() * 100), 2) if len(cur_sub) > 0 else 0.0
            
            # Next Month Stats (Crucial for Anticipatory Positioning)
            next_sub = df_m[df_m['month'] == next_month]
            next_win = round(float((next_sub['ret'] > 0).mean() * 100), 1) if len(next_sub) > 0 else 50.0
            next_avg = round(float(next_sub['ret'].mean() * 100), 2) if len(next_sub) > 0 else 0.0
            
            # 12-Month Mini Heatmap Array for visual UI
            monthly_12 = []
            for m in range(1, 13):
                m_sub = df_m[df_m['month'] == m]
                w = round(float((m_sub['ret'] > 0).mean() * 100), 0) if len(m_sub) > 0 else 50.0
                a = round(float(m_sub['ret'].mean() * 100), 1) if len(m_sub) > 0 else 0.0
                monthly_12.append({
                    'month': m,
                    'name': month_names[m-1],
                    'win_rate': int(w),
                    'avg_return': a
                })
                
            # Quarterly Seasonality
            quarterly = close.resample('QE').last().pct_change().dropna()
            df_q = pd.DataFrame({'ret': quarterly, 'quarter': quarterly.index.quarter})
            q_sub = df_q[df_q['quarter'] == next_quarter]
            q_next_win = round(float((q_sub['ret'] > 0).mean() * 100), 1) if len(q_sub) > 0 else 50.0
            q_next_avg = round(float(q_sub['ret'].mean() * 100), 2) if len(q_sub) > 0 else 0.0

            # --- Options Market Data ---
            options = get_options_flow(sym, curr_p)
            
            # --- Confluence Scoring (0 - 100) ---
            # 1. Seasonality Score (40 pts)
            # Higher weight on next month's anticipatory win rate and return
            s_score = 0
            if next_win >= 80: s_score += 20
            elif next_win >= 70: s_score += 15
            elif next_win >= 60: s_score += 10
            elif next_win < 40: s_score -= 5
            
            if next_avg >= 6.0: s_score += 15
            elif next_avg >= 3.5: s_score += 11
            elif next_avg >= 1.5: s_score += 7
            elif next_avg < 0: s_score -= 5
            
            if cur_win >= 60 and cur_avg > 0: s_score += 5
            
            # 2. Technical Trend Score (35 pts)
            t_score = 0
            if bullish_alignment: t_score += 18
            elif above_50 and above_20: t_score += 12
            elif above_50: t_score += 8
            
            # Proximity to 52-week high (Leader vs laggard)
            if -8.0 <= dist_52w_pct <= 0: t_score += 12 # Pristine near high
            elif -18.0 <= dist_52w_pct < -8.0: t_score += 9 # Constructive base
            elif dist_52w_pct < -30.0: t_score -= 5 # Broken laggard
            
            # ADR / Volume quality
            if adr_pct >= 2.0: t_score += 5
            
            # 3. Options Flow Score (25 pts)
            o_score = 12 # Default neutral
            if options:
                if options['bullish_flow']: o_score += 8
                if options['pcr_oi'] < 0.60: o_score += 5
                if options['avg_iv'] < 45.0: o_score += 2 # Clean, non-distressed IV
                if options['pcr_oi'] > 1.2: o_score -= 5 # Heavy put protection
                
            total_score = max(0, min(100, s_score + t_score + o_score))
            
            # Strategy & Action Verdict
            if total_score >= 82:
                setup_label = "A+ SEASONAL BREAKOUT CONFLUENCE"
                badge_color = "#10b981"
            elif total_score >= 70:
                setup_label = "STRONG SEASONAL TAILWIND"
                badge_color = "#3b82f6"
            elif total_score >= 58:
                setup_label = "CONSTRUCTIVE CYCLE WATCH"
                badge_color = "#fbbf24"
            else:
                setup_label = "CYCLICAL UNDERPERFORMER"
                badge_color = "#ef4444"

            candidates.append({
                'ticker': sym,
                'current_price': curr_p,
                'score': int(total_score),
                'setup_label': setup_label,
                'badge_color': badge_color,
                'technicals': {
                    'sma20': round(sma20, 2),
                    'sma50': round(sma50, 2),
                    'sma200': round(sma200, 2),
                    'above_20': above_20,
                    'above_50': above_50,
                    'bullish_alignment': bullish_alignment,
                    'dist_52w_pct': dist_52w_pct,
                    'adr_pct': adr_pct
                },
                'seasonality': {
                    'cur_month_name': month_names[cur_month-1],
                    'cur_month_win': cur_win,
                    'cur_month_avg': cur_avg,
                    'next_month_name': month_names[next_month-1],
                    'next_month_win': next_win,
                    'next_month_avg': next_avg,
                    'next_quarter_name': f"Q{next_quarter}",
                    'next_quarter_win': q_next_win,
                    'next_quarter_avg': q_next_avg,
                    'monthly_12': monthly_12
                },
                'options': options
            })
        except Exception as e:
            continue

    # Sort candidates by overall confluence score descending
    candidates.sort(key=lambda x: x['score'], reverse=True)
    
    # Categorize for the dedicated dashboard
    radar_results = {
        'last_updated': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'current_month': month_names[cur_month-1],
        'next_month': month_names[next_month-1],
        'all_candidates': candidates,
        'top_picks': candidates[:25],
        'seasonal_breakout_leaders': [c for c in candidates if c['score'] >= 65 and c['technicals']['above_50'] and c['technicals']['dist_52w_pct'] >= -22.0][:20],
        'upcoming_monthly_tailwinds': [c for c in candidates if c['seasonality']['next_month_win'] >= 65.0 and c['seasonality']['next_month_avg'] >= 2.0][:20],
        'options_backed_sweeps': [c for c in candidates if c['options'] and c['options']['bullish_flow'] and c['seasonality']['next_month_avg'] > 0][:20],
        'seasonal_traps_warning': [c for c in candidates if c['seasonality']['cur_month_win'] <= 45.0 or c['seasonality']['cur_month_avg'] <= -1.5 or c['seasonality']['next_month_win'] <= 40.0][:15]
    }
    
    output_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'seasonality_results.json')
    with open(output_path, 'w') as f:
        json.dump(radar_results, f, indent=4)
        
    print(f"Seasonality Radar scan complete. Output saved to {output_path}")
    return radar_results

if __name__ == '__main__':
    run_seasonality_radar()
