import yfinance as yf
import requests

# Test normal
try:
    print("Normal:")
    df = yf.Ticker("AAPL").history(period="1mo")
    print(len(df))
except Exception as e:
    print("Normal failed:", e)

# Test with session
try:
    print("With Session:")
    session = requests.Session()
    session.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
    df = yf.Ticker("AAPL", session=session).history(period="1mo")
    print(len(df))
except Exception as e:
    print("Session failed:", e)
