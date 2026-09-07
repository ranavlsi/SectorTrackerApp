import re

with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/deepvue_screener.py', 'r') as f:
    content = f.read()

old_block = """            d_data = z_details.get(ticker, {})
            mcap = d_data.get('marketCap', 0) if isinstance(d_data, dict) else 0
            if mcap < 1000000000: continue
            
            f_data = z_fin.get(ticker, {})"""

new_block = """            d_data = z_details.get(ticker, {})
            mcap = d_data.get('marketCap', 0) if isinstance(d_data, dict) else 0
            if mcap < 1000000000: continue
            
            # Anti-Overhead Supply Filter: True ATH check
            # Filter out broken stocks like MQ that are down 90% from their all-time highs
            true_ath = d_data.get('fiftyTwoWeekHigh', 0) # Fallback
            # yahooquery doesn't return true ATH in summary_detail, we can check 52-week high, but we already did that.
            # Wait, let's just fetch true ATH using YQTicker history for the batch?
            # Actually, to save time, we will just reject anything where the 50-day average is less than half of 200-day? No.
            
            f_data = z_fin.get(ticker, {})"""

content = content.replace(old_block, new_block)

# Let's do it properly by bulk fetching max history high.
# Actually, wait. Before the fundamental loop, we can fetch max history for all top_candidates.
