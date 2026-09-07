import duckdb
import pandas as pd
import json
import os
import time

def run():
    LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
    df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') ORDER BY Date").to_df()
    grouped = df.groupby('Ticker')
    
    spy_df = grouped.get_group('SPY').set_index('Date')
    spy_perf_val = (spy_df['Close'].iloc[-1] / spy_df['Close'].iloc[-63]) - 1 if len(spy_df) >= 63 else 0
    
    results = []
    for ticker, group in grouped:
        try:
            hist = group.set_index('Date')
            if len(hist) < 250: continue
            
            current_price = hist['Close'].iloc[-1]
            if current_price < 10: continue
            
            avg_vol_20 = hist['Volume'].rolling(20).mean().iloc[-1]
            if (avg_vol_20 * current_price) < 5000000: continue
            
            ema_21 = hist['Close'].ewm(span=21, adjust=False).mean()
            sma_50 = hist['Close'].rolling(50).mean()
            sma_200 = hist['Close'].rolling(200).mean()
            
            aligned = (current_price > ema_21.iloc[-1]) and (ema_21.iloc[-1] > sma_50.iloc[-1]) and (sma_50.iloc[-1] > sma_200.iloc[-1])
            if not aligned: continue
                
            recent_closes = hist['Close'].iloc[-20:]
            recent_50s = sma_50.iloc[-20:]
            if sum(recent_closes > recent_50s) < 16: continue
            if sma_200.iloc[-1] <= sma_200.iloc[-20]: continue
            if sma_50.iloc[-1] <= sma_50.iloc[-20]: continue
                
            high_52w = hist['High'].rolling(250).max().iloc[-1]
            if current_price < high_52w * 0.75: continue
            
            results.append({"ticker": ticker, "price": current_price})
        except:
            pass

    top_candidates = results[:10] # Just take 10
    
    from yahooquery import Ticker as YQTicker
    tickers_list = [c["ticker"] for c in top_candidates]
    yq_t = YQTicker(tickers_list, asynchronous=True)
    
    z_fin = yq_t.financial_data
    z_details = yq_t.summary_detail
    hist_df = yq_t.history(period="max", interval="1mo")
    
    z_hist = {}
    if hist_df is not None and not hist_df.empty:
        for ticker in tickers_list:
            try:
                t_hist = hist_df.loc[ticker]
                z_hist[ticker] = t_hist['high'].max()
            except: pass
            
    print("Testing Fundamental Filter for top 10...")
    for res in top_candidates:
        ticker = res["ticker"]
        current_price = res["price"]
        
        true_ath = z_hist.get(ticker, 0)
        print(f"[{ticker}] Curr: {current_price}, True ATH: {true_ath}")
        if true_ath > 0 and current_price < true_ath * 0.60:
            print(f" -> Rejected due to True ATH overhead.")
            continue
            
        mcap = z_details.get(ticker, {}).get('marketCap', 0) if isinstance(z_details.get(ticker), dict) else 0
        if mcap < 1000000000:
            print(f" -> Rejected due to Mcap {mcap}.")
            continue
            
        f_data = z_fin.get(ticker, {})
        if isinstance(f_data, dict):
            rev_growth = f_data.get('revenueGrowth', 0)
            eps_growth = f_data.get('earningsGrowth', 0)
            print(f" -> Rev Growth: {rev_growth}, EPS Growth: {eps_growth}")
            
run()
