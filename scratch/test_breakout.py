from breakout_engine import evaluate_breakout_profile, check_market_regime

print("Market Regime Pass?", check_market_regime())
res = evaluate_breakout_profile("NVDA")
print("NVDA:", res)
res2 = evaluate_breakout_profile("FUTU")
print("FUTU:", res2)
