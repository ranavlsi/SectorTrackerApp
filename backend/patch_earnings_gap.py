with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/screener_engine.py', 'r') as f:
    content = f.read()

old_logic = """                        # Happened 6-20 days ago, check if consolidating (holding the gap)
                        # Current price must be above the gap day's low, and below gap day's high * 1.05
                        gap_low = low.iloc[i]
                        # Must hold the gap low, must not have exceeded gap high by >10% structurally, AND today's close must NOT be breaking out of the flag high!
                        if curr_c > gap_low and high.iloc[i:].max() < day_c * 1.10 and curr_c <= flag_high * 1.01:
                            results["post_earning_consolidation"].append({"ticker": ticker, "metric": f"Holding Gap {days_since}d"})"""

new_logic = """                        # Happened 6-20 days ago, check if consolidating (holding the gap)
                        gap_low = low.iloc[i]
                        
                        # 1. Strict Gap Hold: The stock must NEVER have closed below the gap day's low during the entire consolidation.
                        # If it bleeds back down into the gap, the setup is structurally broken.
                        lowest_close_since_gap = close.iloc[i:].min()
                        lowest_low_since_gap = low.iloc[i:].min()
                        
                        # 2. Tight Consolidation: Must not have drawn down more than 12% from the flag high.
                        flag_high_real = high.iloc[i:].max()
                        max_drawdown = (flag_high_real - lowest_low_since_gap) / flag_high_real
                        
                        # Check conditions
                        is_holding_gap = lowest_close_since_gap >= gap_low * 0.98  # Allow tiny intraday wicks, but closes must hold
                        is_tight = max_drawdown <= 0.15 # Max 15% drawdown from the post-gap peak
                        not_explosive = flag_high_real < day_c * 1.15
                        not_breaking_out = curr_c <= flag_high_real * 1.01
                        
                        if is_holding_gap and is_tight and not_explosive and not_breaking_out:
                            results["post_earning_consolidation"].append({"ticker": ticker, "metric": f"Holding Gap {days_since}d"})"""

content = content.replace(old_logic, new_logic)
with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/screener_engine.py', 'w') as f:
    f.write(content)
