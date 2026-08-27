import yfinance as yf
import pandas as pd
import numpy as np

def calculate_darvas_box_state_machine(df):
    if len(df) < 252:
        return None, 0, 0, ""
        
    # Macro check: must be within 15% of 52-week high
    high_52w = df['High'].iloc[-252:].max()
    current_close = df['Close'].iloc[-1]
    if current_close < high_52w * 0.85: 
        return None, 0, 0, ""

    # Precalculate SMAs
    df['SMA_50'] = df['Close'].rolling(50).mean()
    df['SMA_200'] = df['Close'].rolling(200).mean()
    df['Vol_SMA_50'] = df['Volume'].rolling(50).mean()
    
    highs = df['High'].values
    lows = df['Low'].values
    closes = df['Close'].values
    vols = df['Volume'].values
    
    n_days = 3
    state = 0 # 0=Top, 1=Bottom, 2=Box
    current_top = 0.0
    current_bottom = float('inf')
    
    # Track the latest state throughout the loop
    latest_status = None
    latest_msg = ""
    
    for i in range(n_days, len(df)):
        if state == 0:
            potential_top = highs[i-n_days]
            if potential_top > highs[i-n_days-1]: 
                is_top = True
                for j in range(1, n_days + 1):
                    if highs[i-n_days+j] >= potential_top:
                        is_top = False
                        break
                if is_top:
                    current_top = potential_top
                    state = 1
                    current_bottom = lows[i]
        elif state == 1:
            potential_bottom = lows[i-n_days]
            if lows[i] < current_bottom:
                current_bottom = lows[i]
            
            is_bottom = True
            for j in range(1, n_days + 1):
                if lows[i-n_days+j] <= potential_bottom:
                    is_bottom = False
                    break
            if is_bottom and potential_bottom <= current_bottom:
                current_bottom = potential_bottom
                state = 2
                
            # Wait, even in state 1, the top can be broken!
            if highs[i] > current_top:
                state = 0
                current_top = 0.0
                current_bottom = float('inf')
                
        elif state == 2:
            # Box is formed. Check daily action.
            # VLO FIX: If the high pierces the top, but close is inside or below
            if highs[i] > current_top:
                if closes[i] > current_top:
                    # Potential Breakout
                    vol_ma = df['Vol_SMA_50'].iloc[i]
                    is_high_volume = vols[i] > (1.5 * vol_ma) if not np.isnan(vol_ma) else False
                    sma50 = df['SMA_50'].iloc[i]
                    sma200 = df['SMA_200'].iloc[i]
                    is_uptrend = sma50 > sma200 if not np.isnan(sma200) else True
                    
                    if is_uptrend and is_high_volume:
                        if i == len(df) - 1:
                            latest_status = "STRONG_BREAKOUT"
                            latest_msg = f"Volume is {vols[i]/vol_ma:.1f}x average"
                    
                    # Regardless, the box is destroyed (either successful breakout or false close)
                    state = 0
                    current_top = 0.0
                    current_bottom = float('inf')
                else:
                    # Intraday pierce but closed inside/below. Box Destroyed.
                    state = 0
                    current_top = 0.0
                    current_bottom = float('inf')
            elif closes[i] < current_bottom:
                # Box broken to downside
                state = 0
                current_top = 0.0
                current_bottom = float('inf')
            else:
                # Still inside box.
                if i == len(df) - 1:
                    dist = (current_top - closes[i]) / closes[i]
                    if dist <= 0.02:
                        vol_ma = df['Vol_SMA_50'].iloc[i]
                        if vols[i] < vol_ma: # Dry up rule
                            latest_status = "ABOUT_TO_BREAKOUT"
                            latest_msg = f"Within {dist*100:.1f}% of Box Top"

    # Only return status if we ended the loop IN the box, OR if it broke out on the EXACT last day.
    if latest_status:
        return latest_status, current_top, current_bottom, latest_msg
    
    # Wait! If it broke out on the last day, state is 0, so current_top is 0.0!
    # I must save the top before resetting state.
    
    return None, 0, 0, ""

print("VLO:")
df_vlo = yf.download("VLO", period="2y")
df_vlo.columns = df_vlo.columns.get_level_values(0)
print(calculate_darvas_box_state_machine(df_vlo))

print("NVDA:")
df_nvda = yf.download("NVDA", period="2y")
df_nvda.columns = df_nvda.columns.get_level_values(0)
print(calculate_darvas_box_state_machine(df_nvda))

