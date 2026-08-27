import yfinance as yf
from qullamaggie_engine import evaluate_qullamaggie_setup
from bull_flag_scanner import detect_bull_flag
import pandas as pd

df = yf.download("AAPL", period="1y")
if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.droplevel(1)

print("Testing Bull Flag...")
try:
    print(detect_bull_flag("AAPL", df))
except Exception as e:
    import traceback
    traceback.print_exc()
