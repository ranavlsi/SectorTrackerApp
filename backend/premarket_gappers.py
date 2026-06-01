import os
import time
import requests
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from dotenv import load_dotenv
import pytz
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockSnapshotRequest, StockBarsRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
from alpaca.data.enums import DataFeed

# Load UNIVERSE
try:
    from intraday_engine import UNIVERSE
except:
    UNIVERSE = ["SPY", "QQQ", "TSLA", "NVDA", "AMD", "AAPL", "META", "MSFT", "AMZN"]

dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)
api_key = os.getenv("APCA_API_KEY_ID")
secret_key = os.getenv("APCA_API_SECRET_KEY")

if not api_key or not secret_key:
    print("FATAL ERROR: Missing Alpaca API keys from backend/.env")
    exit(1)

def format_large_number(num):
    if num >= 1e9:
        return f"{num/1e9:.2f}B"
    elif num >= 1e6:
        return f"{num/1e6:.2f}M"
    else:
        return str(num)

def fetch_premarket_briefing():
    print("Fetching Premarket Snapshots for Top Gappers...")
    client = StockHistoricalDataClient(api_key, secret_key)
    
    # 1. Fetch Snapshots (Alpaca expects BRK.B instead of BRK-B)
    alpaca_universe = [sym.replace('-', '.') for sym in UNIVERSE]
    req = StockSnapshotRequest(symbol_or_symbols=alpaca_universe)
    snapshots = client.get_stock_snapshot(req)
    
    gaps = []
    for ticker, snap in snapshots.items():
        if snap.previous_daily_bar and snap.latest_trade:
            prev_close = snap.previous_daily_bar.close
            curr_price = snap.latest_trade.price
            if prev_close > 5.0: # Filter out penny stocks
                gap_pct = ((curr_price - prev_close) / prev_close) * 100
                if gap_pct > 0: # Only look for Gap Ups
                    gaps.append((ticker, gap_pct, curr_price, prev_close, snap.latest_trade.size))
                    
    # Sort by gap percentage and take top 5
    top_5 = sorted(gaps, key=lambda x: x[1], reverse=True)[:5]
    if not top_5:
        return
        
    top_tickers = [x[0] for x in top_5]
    
    # 2. Fetch 1-minute premarket data for PMH and PML
    now = datetime.now(pytz.timezone('America/New_York'))
    # Set start to 4:00 AM today
    start_time = now.replace(hour=4, minute=0, second=0, microsecond=0)
    
    alpaca_top_tickers = [sym.replace('-', '.') for sym in top_tickers]
    bars_req = StockBarsRequest(
        symbol_or_symbols=alpaca_top_tickers,
        timeframe=TimeFrame(1, TimeFrameUnit.Minute),
        start=start_time,
        end=now,
        feed=DataFeed.IEX
    )
    
    bars_df = client.get_stock_bars(bars_req).df
    if not bars_df.empty:
        bars_df = bars_df.reset_index()
        
    # 3. Fetch yfinance Data
    briefing_lines = ["*Top 5 Premarket Gap-Ups:*"]
    
    for i, (ticker, gap_pct, curr_price, prev_close, last_size) in enumerate(top_5):
        pmh, pml = "N/A", "N/A"
        if not bars_df.empty and ticker in bars_df['symbol'].values:
            ticker_bars = bars_df[bars_df['symbol'] == ticker]
            if not ticker_bars.empty:
                pmh = f"${ticker_bars['high'].max():.2f}"
                pml = f"${ticker_bars['low'].min():.2f}"
                
        # yfinance metrics
        try:
            tkr = yf.Ticker(ticker)
            info = tkr.info
            float_shares = info.get("floatShares", 0)
            short_pct = info.get("shortPercentOfFloat", 0)
            
            float_str = format_large_number(float_shares) if float_shares else "Unknown"
            short_str = f"{short_pct * 100:.1f}%" if short_pct else "N/A"
            catalyst = tkr.news[0]['content']['title'] if tkr.news else "No specific headline"
        except:
            float_str = "Unknown"
            short_str = "N/A"
            catalyst = "Error fetching news"
            
        briefing_lines.append(f"\n*{i+1}. {ticker} (+{gap_pct:.1f}%)* @ ${curr_price:.2f}")
        briefing_lines.append(f"• *PMH:* {pmh} | *PML:* {pml}")
        briefing_lines.append(f"• *PDH/PDL:* (Close was ${prev_close:.2f})")
        briefing_lines.append(f"• *Float:* {float_str} | *Short:* {short_str}")
        briefing_lines.append(f"• *Catalyst:* {catalyst}")

    payload = {
        "council": "🌅 PREMARKET BRIEFING",
        "ticker": "MARKET",
        "setup": "\n".join(briefing_lines),
        "color": "#f59e0b",
        "send_telegram": True 
    }
    try:
        requests.post("http://127.0.0.1:5000/api/webhook_alert", json=payload, timeout=2)
        print("Premarket Briefing sent successfully.")
    except Exception as e:
        print(f"Failed to send briefing: {e}")

if __name__ == "__main__":
    fetch_premarket_briefing()
