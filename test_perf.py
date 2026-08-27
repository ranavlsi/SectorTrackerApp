import time
import sys
sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
from screener_engine import run_screener

start = time.time()
run_screener(custom_universe=['AAPL', 'MSFT', 'NVDA'] * 100) # 300 stocks
end = time.time()
print(f"Time for 300 stocks: {end-start} seconds")
