import re

with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/deepvue_screener.py', 'r') as f:
    content = f.read()

old_vcp_logic = """def check_vcp(hist):
    if len(hist) < 20: return False
    tr1 = hist['High'] - hist['Low']
    tr2 = abs(hist['High'] - hist['Close'].shift(1))
    tr3 = abs(hist['Low'] - hist['Close'].shift(1))
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr_20 = tr.rolling(20).mean()
    atr_3 = tr.rolling(3).mean()
    is_vol_contracting = atr_3.iloc[-1] < (atr_20.iloc[-1] * 0.5)
    recent_high = hist['High'].iloc[-5:].max()
    recent_low = hist['Low'].iloc[-5:].min()
    is_price_tight = (recent_high - recent_low) / hist['Close'].iloc[-1] < 0.05
    avg_vol_20 = hist['Volume'].rolling(20).mean().iloc[-1]
    avg_vol_3 = hist['Volume'].iloc[-3:].mean()
    is_vol_dry = avg_vol_3 < (avg_vol_20 * 0.75)
    return is_vol_contracting and is_price_tight and is_vol_dry"""

new_vcp_logic = """def check_vcp(hist):
    if len(hist) < 60: return False
    
    closes = hist['Close'].values
    highs = hist['High'].values
    lows = hist['Low'].values
    vols = hist['Volume'].values
    
    # 1. Find the major pivot high in the last 40 days (Left side of base)
    recent_40 = hist.iloc[-40:]
    pivot_idx_local = recent_40['High'].argmax()
    pivot_high = recent_40['High'].iloc[pivot_idx_local]
    
    days_since_pivot = 40 - pivot_idx_local
    if days_since_pivot < 10: return False
        
    # 2. Base Depth
    base_low = recent_40['Low'].iloc[pivot_idx_local:].min()
    base_depth = (pivot_high - base_low) / pivot_high
    
    if base_depth > 0.35 or base_depth < 0.08: return False
        
    # 3. Current tightness near the pivot (The Right Side)
    current_price = closes[-1]
    
    # Must be approaching the pivot high (within 10%)
    if current_price < pivot_high * 0.90 or current_price > pivot_high * 1.02: return False
        
    # 4. Volatility Contraction (ATR / BBW)
    tr1 = hist['High'] - hist['Low']
    tr2 = abs(hist['High'] - hist['Close'].shift(1))
    tr3 = abs(hist['Low'] - hist['Close'].shift(1))
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    
    atr_20 = tr.rolling(20).mean().iloc[-1]
    atr_5 = tr.rolling(5).mean().iloc[-1]
    if atr_5 > atr_20 * 0.7: return False # Volatility hasn't contracted enough on the right side
        
    # 5. Volume Dry up on the right side
    avg_vol_50 = hist['Volume'].rolling(50).mean().iloc[-1]
    recent_5_vol = hist['Volume'].iloc[-5:].mean()
    
    if recent_5_vol > avg_vol_50 * 0.8: return False
        
    return True"""

if "def check_vcp(hist):" in content:
    content = content.replace(old_vcp_logic, new_vcp_logic)
    
with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/deepvue_screener.py', 'w') as f:
    f.write(content)
