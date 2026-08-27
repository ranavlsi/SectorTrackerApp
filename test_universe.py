import sys
sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
from screener_engine import get_dynamic_universe, UNIVERSE
print("Default UNIVERSE length:", len(UNIVERSE))
dyn = get_dynamic_universe()
print("Dynamic Universe Length:", len(dyn))
