import yfinance as yf
from breakout_engine import calculate_technical_matrices

def evaluate_breakout_debug(ticker: str):
    data = yf.download(ticker, period="1y", interval="1d", progress=False)
    if data.empty or len(data) < 200:
        return "Failed: Not enough data"
        
    import pandas as pd
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)
        
    df = calculate_technical_matrices(data)
    current = df.iloc[-1]
    
    # Trend Alignment: 20 EMA > 50 EMA > 200 SMA
    if not (current['EMA_20'] > current['EMA_50'] > current['SMA_200']):
        return "Failed: Trend Alignment (EMA_20 > EMA_50 > SMA_200)"
        
    # Volume Z-Score Expansion (>= 2.0 Sigma)
    if current['Vol_ZScore'] < 2.0:
        return f"Failed: Vol_ZScore < 2.0 (Got {current['Vol_ZScore']:.2f})"
        
    # Structural Clearance Buffer
    required_breakout_level = current['R_Pivot'] + (0.2 * current['ATR'])
    if current['Close'] < required_breakout_level:
        return f"Failed: Not Breaking Resistance (Close {current['Close']:.2f} < Req {required_breakout_level:.2f})"
        
    # The Squeeze
    recent_squeeze = df['Squeeze_On'].iloc[-6:-1].any()
    if not recent_squeeze:
        return "Failed: No Recent Squeeze"
        
    return "PASSED"

print("NVDA:", evaluate_breakout_debug('NVDA'))
print("RDW:", evaluate_breakout_debug('RDW'))
print("VICR:", evaluate_breakout_debug('VICR'))
