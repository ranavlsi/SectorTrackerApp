import yfinance as yf

t = yf.Ticker('AAPL')
info = t.info

fcf = info.get('freeCashflow')
shares = info.get('sharesOutstanding')
growth = info.get('earningsGrowth')
beta = info.get('beta')
total_cash = info.get('totalCash', 0)
total_debt = info.get('totalDebt', 0)

growth_rate = min(growth, 0.5)
discount_rate = 0.04 + (beta * 0.06)
terminal_growth = 0.02

# 10 year model
pv_fcfs = 0.0
projected_fcf = fcf
for year in range(1, 11):
    # Taper growth rate slowly to terminal growth? No, let's just do fixed for 10
    projected_fcf *= (1 + growth_rate)
    pv_fcfs += projected_fcf / ((1 + discount_rate) ** year)
    
tv = (projected_fcf * (1 + terminal_growth)) / (discount_rate - terminal_growth)
pv_tv = tv / ((1 + discount_rate) ** 10)

eq_val = pv_fcfs + pv_tv + total_cash - total_debt
fv = eq_val / shares

print(f"5-year FV was ~181. 10-year FV is: {fv}")

# What if we taper growth over 10 years?
pv_fcfs_taper = 0.0
projected_fcf = fcf
current_growth = growth_rate
taper_step = (growth_rate - terminal_growth) / 10

for year in range(1, 11):
    current_growth -= taper_step
    projected_fcf *= (1 + current_growth)
    pv_fcfs_taper += projected_fcf / ((1 + discount_rate) ** year)

tv_taper = (projected_fcf * (1 + terminal_growth)) / (discount_rate - terminal_growth)
pv_tv_taper = tv_taper / ((1 + discount_rate) ** 10)

eq_val_taper = pv_fcfs_taper + pv_tv_taper + total_cash - total_debt
fv_taper = eq_val_taper / shares
print(f"10-year TAPERED FV is: {fv_taper}")

