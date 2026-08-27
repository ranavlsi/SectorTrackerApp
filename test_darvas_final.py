import yfinance as yf
import pandas as pd
from backend.darvas_box_scanner import calculate_darvas_box

print("VLO:")
df_vlo = yf.download("VLO", period="2y")
df_vlo.columns = df_vlo.columns.get_level_values(0)
print(calculate_darvas_box(df_vlo))

print("NVDA:")
df_nvda = yf.download("NVDA", period="2y")
df_nvda.columns = df_nvda.columns.get_level_values(0)
print(calculate_darvas_box(df_nvda))

