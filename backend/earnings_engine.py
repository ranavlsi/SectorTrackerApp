import yfinance as yf
from yahooquery import Ticker as YQTicker
import json
import os
import math
import datetime
import pandas as pd
import numpy as np

# The universe of high-impact AI & Tech stocks for the dashboard
TICKERS = [
    "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", 
    "AMD", "AVGO", "TSM", "ASML", "PLTR", "SMCI", "ARM", "QCOM"
]

def get_max_pain(ticker_symbol, current_price):
    try:
        ticker = yf.Ticker(ticker_symbol)
        expirations = ticker.options
        if not expirations: return None
        
        target_exp = expirations[0]
        chain = ticker.option_chain(target_exp)
        calls = chain.calls.dropna(subset=['openInterest'])
        puts = chain.puts.dropna(subset=['openInterest'])

        if calls.empty or puts.empty: return None

        total_call_oi = float(calls['openInterest'].sum())
        total_put_oi = float(puts['openInterest'].sum())
        pcr_oi = total_put_oi / total_call_oi if total_call_oi > 0 else 0

        # Max Pain calculation
        all_strikes = sorted(set(calls['strike']).union(set(puts['strike'])))
        max_pain_strike = 0
        min_pain_value = float('inf')
        
        for spot in all_strikes:
            call_loss = calls.apply(lambda row: max(0, spot - row['strike']) * row['openInterest'], axis=1).sum()
            put_loss = puts.apply(lambda row: max(0, row['strike'] - spot) * row['openInterest'], axis=1).sum()
            total_loss = float(call_loss + put_loss)
            if total_loss < min_pain_value:
                min_pain_value = total_loss
                max_pain_strike = float(spot)

        # Implied move logic
        atm_strike = min(calls['strike'], key=lambda x: abs(x - current_price))
        atm_call = calls[calls['strike'] == atm_strike].iloc[0]
        atm_put = puts[puts['strike'] == atm_strike].iloc[0]
        def get_price(opt):
            if opt['bid'] > 0 and opt['ask'] > 0:
                return (opt['bid'] + opt['ask']) / 2
            return opt['lastPrice']
            
        implied_move_usd = get_price(atm_call) + get_price(atm_put)
        implied_move_pct = (implied_move_usd / current_price) * 100

        return {
            "expiration": target_exp,
            "pcr_oi": round(pcr_oi, 2),
            "max_pain_strike": round(max_pain_strike, 2),
            "atm_strike": round(float(atm_strike), 2),
            "implied_move_usd": round(float(implied_move_usd), 2),
            "implied_move_pct": round(float(implied_move_pct), 2)
        }
    except Exception as e:
        print(f"Error calculating options data for {ticker_symbol}: {e}")
        return None

def get_eps_trend(ticker_symbol):
    try:
        t = YQTicker(ticker_symbol)
        trend = t.earnings_trend
        if not isinstance(trend, dict) or ticker_symbol not in trend:
            return None
            
        trends = trend[ticker_symbol].get('trend', [])
        if not trends: return None
        
        q0 = next((item for item in trends if item.get('period') == '0q'), None)
        if not q0: return None
        
        eps_trend = q0.get('epsTrend', {})
        curr = eps_trend.get('current')
        d30 = eps_trend.get('30daysAgo')
        
        if curr is None or d30 is None: return None
        
        bar_lowered = float(curr) < float(d30)
        return {
            'current_est': round(float(curr), 2),
            'd30_est': round(float(d30), 2),
            'bar_lowered': bar_lowered
        }
    except Exception as e:
        print(f"Error getting eps trend for {ticker_symbol}: {e}")
        return None

def get_historical_earnings_action(ticker_symbol):
    try:
        ticker = yf.Ticker(ticker_symbol)
        ed = ticker.get_earnings_dates()
        if ed is None or ed.empty:
            return []
            
        now = pd.Timestamp.now(tz='America/New_York')
        past_ed = ed[ed.index < now].head(4)
        if past_ed.empty:
            return []
        
        start_date = (past_ed.index.min() - pd.Timedelta(days=15)).strftime('%Y-%m-%d')
        end_date = (past_ed.index.max() + pd.Timedelta(days=20)).strftime('%Y-%m-%d')
        
        hist = yf.download(ticker_symbol, start=start_date, end=end_date, progress=False)
        if hist.empty:
            return []
        
        if isinstance(hist.columns, pd.MultiIndex):
            hist.columns = hist.columns.get_level_values(0)
            
        if hist.index.tz is None:
            hist.index = hist.index.tz_localize('America/New_York')
        else:
            hist.index = hist.index.tz_convert('America/New_York')
            
        all_trading_days = hist.index.normalize().tolist()
        results = []
        
        for release_datetime, row in past_ed.iterrows():
            is_amc = release_datetime.hour >= 14
            release_date = release_datetime.normalize()
            
            if release_date not in all_trading_days:
                future_days = [d for d in all_trading_days if d > release_date]
                if not future_days: continue
                t0_date = future_days[0]
                past_days = [d for d in all_trading_days if d < t0_date]
                t_minus_1_date = past_days[-1] if past_days else None
            else:
                if is_amc:
                    t_minus_1_date = release_date
                    future_days = [d for d in all_trading_days if d > release_date]
                    t0_date = future_days[0] if future_days else None
                else:
                    t0_date = release_date
                    past_days = [d for d in all_trading_days if d < release_date]
                    t_minus_1_date = past_days[-1] if past_days else None
                    
            if t0_date is None or t_minus_1_date is None: continue
                
            try:
                idx_t_minus_1 = all_trading_days.index(t_minus_1_date)
                idx_t0 = all_trading_days.index(t0_date)
                idx_t1 = idx_t0 + 1
                idx_t5 = idx_t0 + 5
            except ValueError: continue
                
            if idx_t5 >= len(all_trading_days): continue
                
            base_price = float(hist['Close'].iloc[idx_t_minus_1])
            t0_open = float(hist['Open'].iloc[idx_t0])
            t0_close = float(hist['Close'].iloc[idx_t0])
            t1_close = float(hist['Close'].iloc[idx_t1])
            t5_close = float(hist['Close'].iloc[idx_t5])
            
            surprise = float(row.get('Surprise(%)', np.nan)) * 100
            
            results.append({
                'date': release_datetime.strftime('%Y-%m-%d'),
                'timing': 'AMC' if is_amc else 'BMO',
                'gap_pct': round((t0_open - base_price) / base_price * 100, 2),
                't0_close_pct': round((t0_close - base_price) / base_price * 100, 2),
                't1_close_pct': round((t1_close - base_price) / base_price * 100, 2),
                't5_close_pct': round((t5_close - base_price) / base_price * 100, 2),
                'eps_surprise_pct': round(surprise, 2) if not np.isnan(surprise) else 0
            })
            
        return results
    except Exception as e:
        print(f"Error calculating historical action for {ticker_symbol}: {e}")
        return []

def get_institutional_data(ticker_symbol):
    try:
        ticker = yf.Ticker(ticker_symbol)
        info = ticker.info
        
        # Fundamental / Short data
        inst_data = {
            "short_percent": round(info.get('shortPercentOfFloat', 0) * 100, 2) if info.get('shortPercentOfFloat') else 0,
            "short_ratio": info.get('shortRatio', 0),
            "forward_pe": round(info.get('forwardPE', 0), 2) if info.get('forwardPE') else 0,
            "peg_ratio": info.get('pegRatio', 0)
        }
        
        # Analyst Revisions (last 30 days)
        up_down = ticker.upgrades_downgrades
        revisions = []
        if up_down is not None and not up_down.empty:
            thirty_days_ago = pd.Timestamp.now(tz='UTC') - pd.Timedelta(days=30)
            if up_down.index.tz is None:
                up_down.index = up_down.index.tz_localize('UTC')
            recent = up_down[up_down.index >= thirty_days_ago]
            
            for index, row in recent.iterrows():
                # We want: Date, Firm, Action, priceTarget
                # 'Action' usually extracted from ToGrade / FromGrade
                revisions.append({
                    "date": index.strftime('%Y-%m-%d'),
                    "firm": row.get('Firm', ''),
                    "to_grade": row.get('ToGrade', ''),
                    "from_grade": row.get('FromGrade', ''),
                    "price_target": row.get('priceTarget', 0),
                    "action": row.get('Action', 'Maintain')
                })
        
        inst_data["analyst_revisions"] = revisions
        return inst_data
    except Exception as e:
        print(f"Error getting institutional data for {ticker_symbol}: {e}")
        return None

def fetch_earnings_data():
    results = []
    print(f"Running V2 Earnings Engine on {len(TICKERS)} stocks...")
    
    for symbol in TICKERS:
        print(f"Processing {symbol}...")
        try:
            yf_ticker = yf.Ticker(symbol)
            current_price = yf_ticker.fast_info.last_price
            calendar = yf_ticker.calendar
            
            earnings_date_str = "Unknown"
            if calendar and 'Earnings Date' in calendar and len(calendar['Earnings Date']) > 0:
                earnings_date_str = calendar['Earnings Date'][0].strftime('%Y-%m-%d')
            
            options_data = get_max_pain(symbol, current_price)
            eps_trend = get_eps_trend(symbol)
            historical_action = get_historical_earnings_action(symbol)
            inst_data = get_institutional_data(symbol)
            
            results.append({
                "ticker": symbol,
                "current_price": round(float(current_price), 2) if pd.notna(current_price) else 0,
                "next_earnings_date": earnings_date_str,
                "options_data": options_data,
                "eps_trend": eps_trend,
                "historical_action": historical_action,
                "institutional": inst_data
            })
            
        except Exception as e:
            print(f"Failed to process {symbol}: {e}")
            
    # Write to public/earnings_data.json
    output_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'earnings_data.json')
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=4)
        
    print(f"Successfully wrote {len(results)} records to {output_path}")

if __name__ == "__main__":
    fetch_earnings_data()
