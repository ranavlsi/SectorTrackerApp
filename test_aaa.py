import duckdb, time, sys, traceback
sys.path.append('backend')
from screener_engine import run_screener
import screener_engine

# We will inject a custom timing decorator into screener_engine
def run_custom():
    lake_df = duckdb.query("SELECT * FROM read_parquet('backend/data/daily_ohlcv.parquet') ORDER BY Date").to_df()
    grouped = lake_df.groupby('Ticker')
    df = grouped.get_group('AAA').set_index('Date')
    ticker_df = df
    spy_df = grouped.get_group('SPY').set_index('Date')
    
    # Run the exact code for AAPL and time each block
    ticker = 'AAA'
    t0 = time.time()
    close = ticker_df['Close']
    open_s = ticker_df['Open']
    high = ticker_df['High']
    low = ticker_df['Low']
    vol = ticker_df['Volume']
    curr_c = close.iloc[-1]
    
    t1 = time.time()
    print("Setup:", t1-t0)
    
    # 6. Early Stage 2 Breakout
    if len(close) >= 200:
        sma200 = close.rolling(200).mean()
        curr_sma = sma200.iloc[-1]
        crosses = (close > sma200) & (close.shift(1) <= sma200.shift(1))
    t2 = time.time()
    print("Stage 2:", t2-t1)
    
    # 7. Darvas Box Breakout
    try:
        box_top = high.iloc[-11:-1].max()
        box_bot = low.iloc[-11:-1].min()
        if (box_top - box_bot) / box_bot < 0.08:
            pass
    except: pass
    t3 = time.time()
    print("Darvas:", t3-t2)
    
    # 8. Reversal
    delta = close.diff()
    gain = (delta.where(delta > 0, 0)).ewm(alpha=1/14, adjust=False).mean()
    loss = (-delta.where(delta < 0, 0)).ewm(alpha=1/14, adjust=False).mean()
    rs = gain / loss.replace(0, 1e-10)
    rsi = 100 - (100 / (1 + rs))
    t4 = time.time()
    print("Reversal RSI:", t4-t3)
    
    # 10. Consolidation after Positive HVE
    hve_threshold = vol.iloc[-65:-15].mean() * 2.5
    for i in range(-15, -1):
        if vol.iloc[i] > hve_threshold:
            pass
    t5 = time.time()
    print("HVE:", t5-t4)
    
    # 11. Post Earning Positive Reaction
    if len(close) > 65:
        avg_vol_50 = vol.iloc[-70:-20].mean()
        for i in range(-20, -1):
            prev_c = close.iloc[i-1]
    t6 = time.time()
    print("Earnings:", t6-t5)
    
    # 12. Cup Handle
    try:
        weekly_df = ticker_df.resample('W').agg({'Open':'first', 'High':'max', 'Low':'min', 'Close':'last', 'Volume':'sum'}).dropna()
        monthly_df = ticker_df.resample('ME').agg({'Open':'first', 'High':'max', 'Low':'min', 'Close':'last', 'Volume':'sum'}).dropna()
    except Exception as e: pass
    t7 = time.time()
    print("Cup Handle:", t7-t6)
    
    # Zacks Bypass
    try:
        raise Exception("Bypass")
    except: pass
    t8 = time.time()
    print("Zacks:", t8-t7)
    
    # Agents
    from long_base_scanner import evaluate_long_base, evaluate_medium_base
    from pending_breakout_engine import detect_pending_breakout
    from qullamaggie_engine import evaluate_qullamaggie_setup
    t8_1 = time.time()
    evaluate_long_base(ticker, pre_df=ticker_df)
    t9 = time.time()
    print("Long Base:", t9-t8_1)
    
    evaluate_medium_base(ticker, pre_df=ticker_df)
    t10 = time.time()
    print("Medium Base:", t10-t9)
    
    detect_pending_breakout(ticker, pre_df=ticker_df)
    t11 = time.time()
    print("Pending Breakout:", t11-t10)
    
    if curr_c >= 2.0 and vol.iloc[-20:].mean() >= 100000:
        evaluate_qullamaggie_setup(ticker, pre_df=ticker_df)
    t12 = time.time()
    print("Qullamaggie:", t12-t11)

run_custom()
