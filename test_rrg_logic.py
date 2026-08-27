import json

with open('public/sector_flow.json', 'r') as f:
    data = json.load(f)['rrg']

monthly = {s['ticker']: s['trail'][-1] for s in data['monthly']}
weekly = {s['ticker']: s['trail'][-1] for s in data['weekly']}
daily = {s['ticker']: s['trail'][-1] for s in data['daily']}
daily_prev = {s['ticker']: s['trail'][-2] for s in data['daily']}

focus_sectors = []
for ticker in monthly:
    if ticker not in weekly or ticker not in daily: continue
    
    m_x, m_y = monthly[ticker]['x'], monthly[ticker]['y']
    w_x, w_y = weekly[ticker]['x'], weekly[ticker]['y']
    d_x, d_y = daily[ticker]['x'], daily[ticker]['y']
    d_x_prev, d_y_prev = daily_prev[ticker]['x'], daily_prev[ticker]['y']
    
    # Example logic:
    # Monthly: Leading or Improving (y > 100)
    # Weekly: Leading (x > 100, y > 100) or Weakening (x > 100, y < 100)
    # Daily: Hooking up (y > y_prev) and (y > 100)
    if m_y > 100 and w_x > 100 and d_y > d_y_prev and d_y > 100:
        focus_sectors.append(ticker)

print("Focus Sectors:", focus_sectors)
