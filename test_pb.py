import pandas as pd
from backend.pending_breakout_engine import detect_pending_breakout

print("Testing detect_pending_breakout on popular stocks...")
for ticker in ["AAPL", "NVDA", "TSLA", "MSFT", "PLTR", "AMZN", "AMD"]:
    try:
        res = detect_pending_breakout(ticker)
        print(f"{ticker}: {res}")
    except Exception as e:
        print(f"Error on {ticker}: {e}")
