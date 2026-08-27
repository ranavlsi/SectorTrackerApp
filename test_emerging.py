import json

with open('public/sector_flow.json', 'r') as f:
    data = json.load(f)['rrg']

monthly = {s['ticker']: s['trail'][-1] for s in data['monthly']}
weekly = {s['ticker']: s['trail'][-1] for s in data['weekly']}
daily = {s['ticker']: s['trail'][-1] for s in data['daily']}
daily_prev = {s['ticker']: s['trail'][-2] for s in data['daily']}

emerging_sectors = []
for ticker in monthly:
    if ticker not in weekly or ticker not in daily: continue
    
    m_x, m_y = monthly[ticker]['x'], monthly[ticker]['y']
    w_x, w_y = weekly[ticker]['x'], weekly[ticker]['y']
    d_x, d_y = daily[ticker]['x'], daily[ticker]['y']
    d_x_prev, d_y_prev = daily_prev[ticker]['x'], daily_prev[ticker]['y']
    
    # Emerging Leader definition:
    # Weekly is Improving (x < 100, y > 100) or just crossing into Leading (x near 100, y > 100)
    # Daily is Hooking up
    
    is_w_improving = w_x < 102 and w_y > 100
    is_d_hooking = d_y > 100 and d_y > d_y_prev
    
    if is_w_improving and is_d_hooking:
        emerging_sectors.append(ticker)

print("Emerging Sectors:", emerging_sectors)
