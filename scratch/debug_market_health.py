import sys
sys.path.append('backend')
from market_health_engine import *

breadth_df, macro_df, mco, pct_above_50, pct_above_200, new_highs, new_lows, hyg_ratio, z_mco, z_p50, z_p200, z_nhnl, z_vix, z_credit, composite_z = None, None, None, None, None, None, None, None, None, None, None, None, None, None, None

# Run the first part of the script
print("Fetching data for Market Health Council...")
import duckdb
lakehouse_path = "/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet"
lake_query = f"SELECT Ticker, Date, Close FROM read_parquet('{lakehouse_path}') WHERE Date >= current_date() - interval '1 year'"
lake_df = duckdb.query(lake_query).to_df()
breadth_df = lake_df.pivot(index='Date', columns='Ticker', values='Close')
breadth_df.index = pd.to_datetime(breadth_df.index).tz_localize(None)

macro_tickers = ['^VIX', '^VIX3M', '^IRX']
macro_yf = yf.download(macro_tickers, period="2y", interval="1d", progress=False)['Close'].ffill()
macro_yf.index = pd.to_datetime(macro_yf.index).tz_localize(None)

if not breadth_df.empty and not macro_yf.empty:
    last_breadth_date = breadth_df.index[-1]
    last_macro_date = macro_yf.index[-1]
    if last_macro_date < last_breadth_date:
        days_diff = (last_breadth_date - last_macro_date).days
        macro_yf.index = macro_yf.index + pd.Timedelta(days=days_diff)

macro_yf_aligned = macro_yf.reindex(breadth_df.index).ffill().bfill()

lakehouse_etfs = ['SPY', 'QQQ', 'RSP', 'HYG', 'IEF', 'XLU', 'XLK']
macro_df = pd.DataFrame(index=breadth_df.index)
for etf in lakehouse_etfs:
    if etf in breadth_df.columns:
        macro_df[etf] = breadth_df[etf]
for idx in macro_tickers:
    macro_df[idx] = macro_yf_aligned[idx]

daily_returns = breadth_df.pct_change()
advances = (daily_returns > 0).sum(axis=1)
declines = (daily_returns < 0).sum(axis=1)
net_advances = advances - declines
ema19 = net_advances.ewm(span=19, adjust=False).mean()
ema39 = net_advances.ewm(span=39, adjust=False).mean()
mco = ema19 - ema39

sma50 = breadth_df.rolling(50).mean()
sma200 = breadth_df.rolling(200).mean()
total_valid = breadth_df.notna().sum(axis=1)
pct_above_50 = ((breadth_df > sma50).sum(axis=1) / total_valid) * 100
pct_above_200 = ((breadth_df > sma200).sum(axis=1) / total_valid) * 100

rolling_max_20 = breadth_df.rolling(20).max()
rolling_min_20 = breadth_df.rolling(20).min()
new_highs = (breadth_df >= rolling_max_20).sum(axis=1)
new_lows = (breadth_df <= rolling_min_20).sum(axis=1)

hyg_ratio = macro_df['HYG'] / macro_df['IEF']

def calc_zscore(series, window=63):
    return (series - series.rolling(window).mean()) / series.rolling(window).std()

z_mco = calc_zscore(mco)
z_p50 = calc_zscore(pct_above_50)
z_p200 = calc_zscore(pct_above_200)
z_nhnl = calc_zscore(new_highs - new_lows)
z_vix = -1 * calc_zscore(macro_df['^VIX']) 
z_credit = calc_zscore(hyg_ratio)

composite_z = (z_mco + z_p50 + z_p200 + z_nhnl + z_vix + z_credit) / 6.0
smoothed_z = composite_z.ewm(span=5, adjust=False).mean()

print("z_mco:\n", z_mco.tail(3))
print("z_p50:\n", z_p50.tail(3))
print("z_p200:\n", z_p200.tail(3))
print("z_nhnl:\n", z_nhnl.tail(3))
print("z_vix:\n", z_vix.tail(3))
print("z_credit:\n", z_credit.tail(3))
print("macro_df['HYG']:\n", macro_df['HYG'].tail(3))
print("macro_df['IEF']:\n", macro_df['IEF'].tail(3))

