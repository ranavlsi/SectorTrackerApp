import yfinance as yf
from screener_engine import check_cup_and_handle

df = yf.download('FFIV', period='3y', progress=False)
if str(df.columns.__class__.__name__) == 'MultiIndex':
    df.columns = df.columns.get_level_values(0)

monthly_df = df.resample('ME').agg({'Open':'first', 'High':'max', 'Low':'min', 'Close':'last', 'Volume':'sum'}).dropna()
df_recent = monthly_df.iloc[-24:]
cup_data = df_recent.iloc[:-2]
handle_data = df_recent.iloc[-2:]

left_cup_high = cup_data['High'].max()
left_cup_high_idx = cup_data['High'].values.argmax()
cup_bottom_data = cup_data.iloc[left_cup_high_idx:]
cup_bottom = cup_bottom_data['Low'].min()
cup_bottom_idx = cup_bottom_data['Low'].values.argmin() + left_cup_high_idx

cup_depth = (left_cup_high - cup_bottom) / left_cup_high
right_side_data = cup_data.iloc[cup_bottom_idx+1:]
right_cup_high = right_side_data['High'].max()
handle_low = handle_data['Low'].min()
handle_depth = (right_cup_high - handle_low) / right_cup_high

print(f"Left Cup High: ${left_cup_high:.2f}")
print(f"Cup Bottom: ${cup_bottom:.2f}")
print(f"Cup Depth: {cup_depth*100:.1f}%")
print(f"Right Cup High: ${right_cup_high:.2f}")
print(f"Handle Low: ${handle_low:.2f}")
print(f"Handle Depth: {handle_depth*100:.1f}%")

print("Result:", check_cup_and_handle(monthly_df, is_monthly=True))
