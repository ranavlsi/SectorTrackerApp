with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/deepvue_screener.py', 'r') as f:
    content = f.read()

old_rs = """def calculate_rs_rating(hist, spy_perf_val):
    if len(hist) < 63: return 0
    stock_perf = (hist['Close'].iloc[-1] / hist['Close'].iloc[-63]) - 1
    rs_diff = (stock_perf - spy_perf_val) * 100
    return round(rs_diff, 2)"""

new_rs = """def calculate_rs_rating(hist, spy_perf_val):
    if len(hist) < 63: return 0
    stock_perf = (hist['Close'].iloc[-1] / hist['Close'].iloc[-63]) - 1
    
    # Anti-Reverse Split Filter: If a stock claims to be up >300% in 3 months, it's almost 
    # certainly a reverse split anomaly in unadjusted lakehouse data.
    if stock_perf > 3.0: 
        return -999
        
    rs_diff = (stock_perf - spy_perf_val) * 100
    return round(rs_diff, 2)"""

content = content.replace(old_rs, new_rs)
with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/deepvue_screener.py', 'w') as f:
    f.write(content)
