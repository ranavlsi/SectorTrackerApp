import yfinance as yf
from datetime import datetime
import pandas as pd

t = yf.Ticker('AMD')
df_5m = t.history(period="5d", interval="5m", prepost=True)
df_1m = t.history(period="1d", interval="1m", prepost=True)

df_5m.index = df_5m.index.tz_convert('America/New_York')
df_1m.index = df_1m.index.tz_convert('America/New_York')

today_str = datetime.now().strftime('%Y-%m-%d')
today_5m_ui = df_5m[df_5m.index.strftime('%Y-%m-%d') == today_str]
today_5m_ui = today_5m_ui.between_time('09:30', '16:00')
today_1m_ui = df_1m[df_1m.index.strftime('%Y-%m-%d') == today_str]
today_1m_ui = today_1m_ui.between_time('09:30', '16:00')

if len(today_5m_ui) >= 3:
    orb_pivot = float(today_5m_ui['High'].iloc[0:3].max())
elif len(today_1m_ui) > 0:
    orb_pivot = float(today_1m_ui['High'].max())
else:
    orb_pivot = float(df_1m['High'].max())

current_price = float(df_1m['Close'].iloc[-1])
recent_lows = today_1m_ui['Low'].iloc[-15:] if len(today_1m_ui) >= 15 else today_1m_ui['Low']
broke_recently = any(l < orb_pivot for l in recent_lows)

print(f"Today: {today_str}")
print(f"5m bars today: {len(today_5m_ui)}")
print(f"1m bars today: {len(today_1m_ui)}")
print(f"ORB Pivot: {orb_pivot}")
print(f"Current Price: {current_price}")
print(f"0.995 threshold: {orb_pivot * 0.995}")
print(f"Broke recently: {broke_recently}")
if current_price >= orb_pivot * 0.995 and broke_recently:
    print("TRIGGERS!")
else:
    print("DOES NOT TRIGGER")
