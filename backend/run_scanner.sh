#!/bin/bash
# Master Shell script to run ALL daily market scanners sequentially

echo "[Master Scanner] Starting daily data ingestion..."

cd /Users/amitkumar/Desktop/SectorTrackerApp/backend

python3 candlestick_scanner.py
python3 canslim_minervini_scanner.py
python3 darvas_box_scanner.py
python3 earnings_flag_scanner.py
python3 ipo_avwap_scanner.py
python3 orb_scanner.py
python3 sector_rotation_scanner.py
python3 volume_climax_scanner.py
python3 squeeze_engine.py

echo "[Master Scanner] All individual scanners have completed successfully!"
