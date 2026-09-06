import numpy as np
import pandas as pd
from scipy.stats import linregress

def evaluate_regression_channel(ticker, df=None, lookback=120):
    """
    Identifies stocks breaking out of their statistical Linear Regression channel.
    Bullish Breakout: Current price crosses above the Upper Regression Band (+2 StdDev).
    """
    try:
        if df is None or len(df) < lookback:
            return None
            
        recent_df = df.iloc[-lookback:].copy()
        closes = recent_df['Close'].values
        
        # 1. Calculate Linear Regression
        x = np.arange(lookback)
        slope, intercept, r_value, p_value, std_err = linregress(x, closes)
        
        # 2. Calculate the regression line
        regression_line = intercept + slope * x
        
        # 3. Calculate residuals and standard deviation of residuals
        residuals = closes - regression_line
        std_dev = np.std(residuals)
        
        # 4. Calculate upper channel (regression line + 2 standard deviations)
        upper_channel = regression_line + (2 * std_dev)
        
        # 5. Breakout detection: 
        # Today's close must be ABOVE the upper channel.
        # Yesterday's close must have been BELOW or AT the upper channel (to capture fresh breakouts).
        
        curr_close = closes[-1]
        prev_close = closes[-2]
        
        curr_upper = upper_channel[-1]
        prev_upper = upper_channel[-2]
        
        if curr_close > curr_upper and prev_close <= prev_upper:
            # Determine channel direction
            channel_type = "Ascending" if slope > 0 else "Descending"
            
            # Calculate distance past the breakout
            breakout_pct = ((curr_close - curr_upper) / curr_upper) * 100
            
            return {
                "status": "BREAKOUT",
                "ticker": ticker,
                "slope": float(slope),
                "upper_channel": float(curr_upper),
                "r_squared": float(r_value**2),
                "message": f"Bullish Breakout (+{breakout_pct:.1f}%) from {channel_type} Channel"
            }
            
        return None
        
    except Exception as e:
        return None
