#!/bin/bash
cd /Users/amitkumar/Desktop/SectorTrackerApp/backend

echo "Resuming from Volume Climax Scanner..." >> master_update.log
python3 volume_climax_scanner.py >> master_update.log 2>&1
echo "Running Darvas Box Scanner..." >> master_update.log
python3 darvas_box_scanner.py >> master_update.log 2>&1
echo "Running CANSLIM Scanner..." >> master_update.log
python3 canslim_minervini_scanner.py >> master_update.log 2>&1
echo "Running Earnings Flag Scanner..." >> master_update.log
python3 earnings_flag_scanner.py >> master_update.log 2>&1
echo "Running Candlestick Scanner..." >> master_update.log
python3 candlestick_scanner.py >> master_update.log 2>&1
echo "Running Short Squeeze Engine..." >> master_update.log
python3 squeeze_engine.py >> master_update.log 2>&1
echo "Running Unified Expert Screener (Screener Engine)..." >> master_update.log
python3 screener_engine.py >> master_update.log 2>&1
echo "Running Relative Strength Line Scanner..." >> master_update.log
python3 rs_line_scanner.py >> master_update.log 2>&1
echo "Generating AI Playbook..." >> master_update.log
python3 playbook_generator.py >> master_update.log 2>&1
echo "Running DeepVue Quantitative Screener..." >> master_update.log
python3 deepvue_screener.py >> master_update.log 2>&1
echo "Running Correlation Engine..." >> master_update.log
python3 correlation_engine.py >> master_update.log 2>&1
echo "Running Market Health Engine..." >> master_update.log
python3 market_health_engine.py >> master_update.log 2>&1
echo "Update Complete." >> master_update.log
