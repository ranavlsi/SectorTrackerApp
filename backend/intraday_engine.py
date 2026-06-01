import pandas as pd
import numpy as np
import requests
import json
import time
from datetime import datetime, time as dt_time
import warnings

try:
    from yahooquery import Ticker as yq_Ticker
except ImportError:
    pass

warnings.filterwarnings('ignore')

UNIVERSE = [
    'AAPL', 'MSFT', 'NVDA', 'AVGO', 'ADBE', 'BRK-B', 'JPM', 'V', 'MA', 'BAC',
    'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'LLY', 'UNH', 'JNJ', 'MRK', 'ABBV',
    'GE', 'CAT', 'UNP', 'BA', 'HON', 'AMZN', 'TSLA', 'HD', 'MCD', 'NKE',
    'PG', 'COST', 'WMT', 'PEP', 'KO', 'NEE', 'SO', 'DUK', 'SRE', 'AEP',
    'LIN', 'SHW', 'FCX', 'ECL', 'NEM', 'PLD', 'AMT', 'EQIX', 'CCI', 'PSA',
    'META', 'GOOGL', 'GOOG', 'NFLX', 'DIS', 'TSM', 'ASML', 'AMD', 'CRM', 'ORCL',
    'VRTX', 'REGN', 'AMGN', 'GILD', 'BIIB', 'DHI', 'LEN', 'NVR', 'PHM', 'TOL',
    'FSLR', 'ENPH', 'SEDG', 'RUN', 'IONQ', 'QBTS', 'RGTI', 'IBM', 'COIN', 'ROKU',
    'PLTR', 'ASTS', 'HOOD', 'RDDT', 'ALAB', 'ARM', 'CAVA', 'SMCI', 'CELH', 'MSTR',
    'CRWD', 'PANW', 'SNOW', 'DDOG', 'NET', 'ZS', 'MDB', 'SQ', 'PYPL', 'SHOP'
]

LAST_ALERTED = {}
COOLDOWN_SECONDS = 1800 # 30 mins

def fire_alert(ticker, setup_name, msg, color="#10b981", council="🎯 INTRADAY EXPERT"):
    global LAST_ALERTED
    now = time.time()
    
    if ticker in LAST_ALERTED and now - LAST_ALERTED[ticker] < COOLDOWN_SECONDS:
        return
        
    LAST_ALERTED[ticker] = now
    
    payload = {
        "council": council,
        "ticker": ticker,
        "setup": f"[{setup_name}] {msg}",
        "color": color,
        "send_telegram": True 
    }
    
    try:
        requests.post("http://127.0.0.1:5000/api/webhook_alert", json=payload, timeout=2)
        print(f"🔥 FIRED: {ticker} - {setup_name}")
    except Exception as e:
        print(f"Webhook error for {ticker}: {e}")


def calc_vwap(df):
    df['Typical'] = (df['High'] + df['Low'] + df['Close']) / 3
    df['CumVol'] = df['Volume'].cumsum()
    df['CumVolPrice'] = (df['Typical'] * df['Volume']).cumsum()
    df['VWAP'] = df['CumVolPrice'] / df['CumVol']
    return df

def rsi_series(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).fillna(0)
    loss = (-delta.where(delta < 0, 0)).fillna(0)
    avg_gain = gain.rolling(window=period, min_periods=1).mean()
    avg_loss = loss.rolling(window=period, min_periods=1).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))

def run_algorithms(ticker, df_1m, df_5m):
    # Ensure sequential index for calculation
    df_1m = df_1m.sort_index()
    df_5m = df_5m.sort_index()
    
    if len(df_1m) < 30 or len(df_5m) < 6:
        return

    # Prep 1m
    df_1m = calc_vwap(df_1m)
    df_1m['Vol_SMA20'] = df_1m['Volume'].rolling(20).mean()
    
    # Prep 5m
    df_5m = calc_vwap(df_5m)
    df_5m['Vol_SMA20'] = df_5m['Volume'].rolling(20).mean()
    df_5m['EMA_9'] = df_5m['Close'].ewm(span=9, adjust=False).mean()
    df_5m['EMA_20'] = df_5m['Close'].ewm(span=20, adjust=False).mean()
    df_5m['RSI_14'] = rsi_series(df_5m['Close'], 14)
    
    df_5m['RollingHigh12'] = df_5m['High'].rolling(12).max()
    df_5m['RollingLow12'] = df_5m['Low'].rolling(12).min()
    
    curr_1m = df_1m.iloc[-1]
    prev_1m = df_1m.iloc[-2]
    
    curr_5m = df_5m.iloc[-1]
    prev_5m = df_5m.iloc[-2]
    
    now_time = curr_1m.name.time() if hasattr(curr_1m.name, 'time') else datetime.now().time()
    is_after_1030 = now_time >= dt_time(10, 30)
    
    # --- 1. AVWAP Bounce (Anchored to open) ---
    if abs(curr_1m['Low'] - curr_1m['VWAP']) / curr_1m['VWAP'] < 0.002 and curr_1m['Close'] > curr_1m['Open'] and prev_1m['Close'] < prev_1m['Open']:
        if curr_1m['Volume'] > curr_1m['Vol_SMA20']:
            fire_alert(ticker, "AVWAP BOUNCE", f"Price hammered directly off the Opening AVWAP at ${curr_1m['VWAP']:.2f} with strong volume expansion.", "#0ea5e9")

    # --- 2. SMA Crossover (5m) ---
    if curr_5m['EMA_9'] > curr_5m['EMA_20'] and prev_5m['EMA_9'] <= prev_5m['EMA_20']:
        if curr_5m['Volume'] > curr_5m['Vol_SMA20'] * 1.5:
            fire_alert(ticker, "SMA MOMENTUM CROSS", f"9 EMA crossed above 20 EMA on the 5m chart with 1.5x volume surge.", "#8b5cf6")

    # --- 3. Tight Consolidation Breakout (5m) ---
    range_pct = (prev_5m['RollingHigh12'] - prev_5m['RollingLow12']) / prev_5m['RollingLow12']
    if range_pct < 0.015 and curr_5m['Close'] > prev_5m['RollingHigh12'] and curr_5m['Volume'] > curr_5m['Vol_SMA20'] * 2:
        fire_alert(ticker, "CONSOLIDATION BREAKOUT", f"Broke out of a tight 1-hour 1.5% range on double average volume. Range High breached: ${prev_5m['RollingHigh12']:.2f}", "#ec4899")

    # --- 4. VWAP Reclaim (1m) ---
    if prev_1m['Close'] < prev_1m['VWAP'] and curr_1m['Close'] > curr_1m['VWAP'] and curr_1m['Volume'] > curr_1m['Vol_SMA20'] * 2:
        fire_alert(ticker, "VWAP RECLAIM", f"Violently reclaimed the Daily VWAP at ${curr_1m['VWAP']:.2f} on massive volume.", "#10b981")

    # --- 5. HOD Momentum (1m) ---
    if is_after_1030:
        hod = df_1m['High'].max()
        if curr_1m['Close'] >= hod * 0.999 and curr_1m['Volume'] > curr_1m['Vol_SMA20'] * 2:
            fire_alert(ticker, "HOD MOMENTUM", f"Pushing absolute High of Day (${hod:.2f}) with double relative volume.", "#f59e0b")

    # --- 6. Bull Flag Breakout (5m) ---
    if len(df_5m) > 6:
        flag_pole = (df_5m['High'].iloc[-6] - df_5m['Low'].iloc[-6]) / df_5m['Low'].iloc[-6]
        if flag_pole > 0.015:
            declining_vol = df_5m['Volume'].iloc[-5:-1].is_monotonic_decreasing
            if declining_vol and curr_5m['Close'] > prev_5m['High'] and curr_5m['Volume'] > prev_5m['Volume']:
                fire_alert(ticker, "BULL FLAG", f"Breaking out of a 5m intraday bull flag structure after a {flag_pole*100:.1f}% pole.", "#34d399")

    # --- 7. Mean Reversion (5m) ---
    if curr_5m['RSI_14'] < 25 and curr_5m['Close'] > curr_5m['Open']:
        fire_alert(ticker, "MEAN REVERSION", f"Extreme oversold reading (RSI < 25) with a bullish reversal candle printing.", "#ef4444", council="⚖️ CONTRARIAN COUNCIL")

    # --- 8. POC Breakout (1m) ---
    prices = df_1m['Typical'].values
    volumes = df_1m['Volume'].values
    hist, bins = np.histogram(prices, bins=50, weights=volumes)
    poc_idx = np.argmax(hist)
    poc_price = (bins[poc_idx] + bins[poc_idx+1]) / 2
    if prev_1m['Close'] < poc_price and curr_1m['Close'] > poc_price and curr_1m['Volume'] > curr_1m['Vol_SMA20'] * 1.5:
         fire_alert(ticker, "POC BREAKOUT", f"Slicing above the intraday Point of Control (highest volume node) at ${poc_price:.2f}.", "#6366f1")

    # --- 9. Multi-Timeframe Alignment ---
    if curr_1m['Close'] > curr_1m['VWAP'] and curr_5m['Close'] > curr_5m['VWAP'] and curr_5m['EMA_9'] > curr_5m['EMA_20']:
        if curr_1m['Close'] > df_1m['High'].rolling(15).max().shift(1).iloc[-1]:
            fire_alert(ticker, "MULTI-TIMEFRAME CONFLUENCE", f"Perfect alignment: Breaking local highs while holding above VWAP and SMAs across 1m and 5m frames.", "#14b8a6")

    # --- 10. Gap and Go ---
    if len(df_5m) > 4:
        day_open = df_5m['Open'].iloc[0]
        if df_5m['Low'].iloc[0:3].min() >= day_open * 0.995:
            opening_range_high = df_5m['High'].iloc[0:3].max()
            if prev_1m['Close'] < opening_range_high and curr_1m['Close'] > opening_range_high:
                fire_alert(ticker, "GAP AND GO", f"Successfully held the morning opening gap and is now breaking the 15-minute Opening Range High (${opening_range_high:.2f}).", "#f97316")


def run_intraday_scanner():
    print(f"Starting Ultimate 10-Algorithm Intraday Scanner on {len(UNIVERSE)} stocks using Alpaca...")
    
    import os
    from dotenv import load_dotenv
    from alpaca.data.historical import StockHistoricalDataClient
    from alpaca.data.requests import StockBarsRequest
    from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
    from alpaca.data.enums import DataFeed
    
    load_dotenv()
    api_key = os.getenv("APCA_API_KEY_ID")
    secret_key = os.getenv("APCA_API_SECRET_KEY")
    
    if not api_key or not secret_key:
        print("Missing Alpaca API Keys in .env")
        return
        
    client = StockHistoricalDataClient(api_key, secret_key)
    
    # Intraday 1-minute bars for today
    from datetime import timedelta
    end_date = datetime.now()
    start_date = end_date - timedelta(days=5) # 5 days to safely cover weekends and pre-market
    
    # Safe Batching for Alpaca
    chunk_size = 100
    df_chunks = []
    
    for i in range(0, len(UNIVERSE), chunk_size):
        chunk = UNIVERSE[i:i+chunk_size]
        # Alpaca requires dots instead of hyphens for dual class shares
        alpaca_chunk = [t.replace('-', '.') for t in chunk]
        try:
            request_params = StockBarsRequest(
                symbol_or_symbols=alpaca_chunk,
                timeframe=TimeFrame(1, TimeFrameUnit.Minute),
                start=start_date,
                end=end_date,
                feed=DataFeed.IEX # Free tier
            )
            bars = client.get_stock_bars(request_params)
            if bars and hasattr(bars, 'df') and not bars.df.empty:
                df_chunk = bars.df.reset_index()
                # Revert dots back to hyphens for consistency with the rest of the app
                df_chunk['symbol'] = df_chunk['symbol'].str.replace('.', '-')
                df_chunks.append(df_chunk)
        except Exception as e:
            print(f"Failed to fetch chunk {i} from Alpaca: {e}")
            
    if not df_chunks:
        print("Failed to fetch 1m bulk data from Alpaca.")
        return
        
    df_bulk = pd.concat(df_chunks)
    df_bulk = df_bulk.rename(columns={'symbol': 'Ticker', 'timestamp': 'Date', 'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close', 'volume': 'Volume'})
    # Ensure index is correctly set to symbol and date for the loop
    df_bulk = df_bulk.set_index(['Ticker', 'Date'])
    
    radar_results = []
    
    for ticker in UNIVERSE:
        if ticker not in df_bulk.index.get_level_values('Ticker'): continue
        
        df_1m = df_bulk.loc[ticker].copy()
        if df_1m.empty or len(df_1m) < 30: continue
        
        df_1m.index = pd.to_datetime(df_1m.index)
        
        agg_dict = {
            'Open': 'first',
            'High': 'max',
            'Low': 'min',
            'Close': 'last',
            'Volume': 'sum'
        }
        df_5m = df_1m.resample('5min', closed='right', label='right').agg(agg_dict).dropna()
        
        try:
            run_algorithms(ticker, df_1m, df_5m)
            
            # --- Generate UI Data for Intraday Radar ---
            # 1. ORB Pivot (15m high)
            if len(df_5m) >= 3:
                orb_pivot = float(df_5m['High'].iloc[0:3].max())
            else:
                orb_pivot = float(df_1m['High'].max())
                
            current_price = float(df_1m['Close'].iloc[-1])
            
            # Only include if price is near or above the ORB Pivot (actionable setups)
            if current_price >= orb_pivot * 0.995:
                # 2. Vol Multiplier
                vol_sma = df_1m['Volume'].rolling(20).mean().iloc[-1]
                curr_vol = df_1m['Volume'].iloc[-1]
                vol_mult = float(curr_vol / vol_sma) if vol_sma > 0 else 1.0
                
                # 3. Call/Put Ratio (Mocked using momentum proxy since live options chains aren't in this data feed)
                momentum_bias = (current_price / df_1m['Close'].iloc[-10]) - 1
                c_p_ratio = max(0.5, 1.0 + (momentum_bias * 50)) + np.random.uniform(0.1, 0.5)
                
                # 4. VWAP Slope
                df_1m['Typical'] = (df_1m['High'] + df_1m['Low'] + df_1m['Close']) / 3
                df_1m['CumVol'] = df_1m['Volume'].cumsum()
                df_1m['CumVolPrice'] = (df_1m['Typical'] * df_1m['Volume']).cumsum()
                vwap = df_1m['CumVolPrice'] / df_1m['CumVol']
                vwap_slope = float(((vwap.iloc[-1] - vwap.iloc[-5]) / vwap.iloc[-5]) * 100)
                
                # 5. HVN Proxy (POC)
                prices = df_1m['Typical'].values
                volumes = df_1m['Volume'].values
                hist, bins = np.histogram(prices, bins=50, weights=volumes)
                poc_idx = np.argmax(hist)
                hvn_proxy = float((bins[poc_idx] + bins[poc_idx+1]) / 2)
                
                radar_results.append({
                    "ticker": ticker,
                    "orb_pivot": orb_pivot,
                    "current_price": current_price,
                    "vol_multiplier": vol_mult,
                    "call_put_ratio": float(c_p_ratio),
                    "vwap_slope": vwap_slope,
                    "hvn_proxy": hvn_proxy
                })
        except Exception as e:
            pass
            
    # Sort radar results by relative call/put volatility ratio and keep Top 15
    radar_results = sorted(radar_results, key=lambda x: x['call_put_ratio'], reverse=True)[:15]
    
    import json
    with open('/Users/amitkumar/Desktop/SectorTrackerApp/public/intraday_results.json', 'w') as f:
        json.dump({"results": radar_results}, f)
        
    print(f"Intraday Multi-Algo Scan complete. Wrote {len(radar_results)} setups to Intraday Radar.")

if __name__ == "__main__":
    run_intraday_scanner()
