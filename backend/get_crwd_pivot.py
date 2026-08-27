import yfinance as yf

df = yf.download("CRWD", period="6mo", interval="1d", progress=False)
high = df['High']

# Reproducing the screener's exact logic
base_highs = high.iloc[-70:-10]
pivot = base_highs.max()

print(f"CRWD Pivot: {pivot}")
