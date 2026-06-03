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
    
    # 0. Fetch True Previous Close from Lakehouse
    import duckdb
    lakehouse_path = "/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet"
    if os.path.exists(lakehouse_path):
        prev_closes = duckdb.query(f"SELECT Ticker, Close FROM read_parquet('{lakehouse_path}') WHERE Date = (SELECT MAX(Date) FROM read_parquet('{lakehouse_path}'))").to_df().set_index('Ticker')['Close'].to_dict()
    else:
        prev_closes = {}
    
    # 1. Fetch Snapshots (Alpaca expects BRK.B instead of BRK-B)
    alpaca_universe = [sym.replace('-', '.') for sym in UNIVERSE]
    req = StockSnapshotRequest(symbol_or_symbols=alpaca_universe)
    snapshots = client.get_stock_snapshot(req)
    
    now = datetime.now(pytz.timezone('America/New_York'))
    start_time = now.replace(hour=4, minute=0, second=0, microsecond=0)
    
    gaps = []
    for ticker, snap in snapshots.items():
        original_ticker = ticker.replace('.', '-')
        if snap.latest_trade and snap.latest_trade.timestamp >= start_time:
            # Use Lakehouse true close if available, else fallback to Alpaca (which may be stale)
            prev_close = prev_closes.get(original_ticker, snap.previous_daily_bar.close if snap.previous_daily_bar else 0)
            curr_price = snap.latest_trade.price
            
            if prev_close > 5.0: # Filter out penny stocks
                gap_pct = ((curr_price - prev_close) / prev_close) * 100
                if gap_pct > 0: # Only look for Gap Ups
                    gaps.append((original_ticker, gap_pct, curr_price, prev_close, snap.latest_trade.size))
                    
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
    date_str = datetime.now(pytz.timezone('America/New_York')).strftime('%B %d, %Y')
    briefing_lines = [f"*Top 5 Premarket Gap-Ups ({date_str}):*"]
    
    try:
        spy = yf.Ticker('SPY')
        if spy.news:
            briefing_lines.append("\n*📰 Broad Market News:*")
            for n in spy.news[:3]:
                # Handle old yfinance format and new yfinance format
                title = n.get('content', {}).get('title', n.get('title', ''))
                prov = n.get('content', {}).get('provider', {}).get('displayName', n.get('provider', 'News'))
                if title:
                    briefing_lines.append(f"• {title} ({prov})")
            briefing_lines.append("\n*🔥 Top Individual Gappers:*")
    except Exception as e:
        pass
    
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
            
            news_items = []
            if tkr.news:
                for n in tkr.news[:2]: # Grab top 2 headlines
                    news_items.append(n.get('content', {}).get('title', n.get('title', '')))
            catalyst = " | ".join([n for n in news_items if n]) if news_items else "No specific headline"
        except:
            float_str = "Unknown"
            short_str = "N/A"
            catalyst = "Error fetching news"
            
        trade_plan = f"Watch for Opening Range Breakout (ORB) above PMH ({pmh}) with volume. Buy the breakout for a long continuation. Use PML ({pml}) or VWAP as a stop loss."
            
        briefing_lines.append(f"\n*{i+1}. {ticker} (+{gap_pct:.1f}%)* @ ${curr_price:.2f}")
        briefing_lines.append(f"• *PMH:* {pmh} | *PML:* {pml}")
        briefing_lines.append(f"• *Gap Fill Target:* ${prev_close:.2f}")
        briefing_lines.append(f"• *Float:* {float_str} | *Short:* {short_str}")
        briefing_lines.append(f"• *News:* {catalyst}")
        briefing_lines.append(f"• *Trade Plan:* {trade_plan}")

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
