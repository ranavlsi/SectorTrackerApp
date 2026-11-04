#!/bin/bash
cd /Users/amitkumar/Desktop/SectorTrackerApp/backend
echo "=== [$(date)] Starting Daily Market Data & Lakehouse Download ===" > master_update.log
python3 db_updater.py >> master_update.log 2>&1

echo "=== [$(date)] Running Core Quantitative Market Scanners ===" >> master_update.log
echo "Running Volume Climax Scanner..." >> master_update.log
python3 volume_climax_scanner.py >> master_update.log 2>&1

echo "Running Darvas Box Scanner..." >> master_update.log
python3 darvas_box_scanner.py >> master_update.log 2>&1

echo "Running CANSLIM & Minervini Scanner..." >> master_update.log
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

echo "Running First MA Pullback Rejection Scanner..." >> master_update.log
python3 first_ma_pullback_scanner.py >> master_update.log 2>&1

echo "Running Upper Wick Supply Absorption Scanner..." >> master_update.log
python3 wick_absorption_scanner.py >> master_update.log 2>&1

echo "Running Clean Untangled Uptrend (9/13 SMA) Scanner..." >> master_update.log
python3 clean_uptrend_scanner.py >> master_update.log 2>&1

echo "Running Best Acting Stocks Engine..." >> master_update.log
python3 best_acting_engine.py >> master_update.log 2>&1

echo "Running Institutional Swing Trading Setups Engine..." >> master_update.log
python3 swing_trading_engine.py >> master_update.log 2>&1

echo "Running Pre-Breakout Volatility Ignition Matrix..." >> master_update.log
python3 pre_breakout_ignition_engine.py >> master_update.log 2>&1

echo "Running Real Simple Execution Engine..." >> master_update.log
python3 realsimple_engine.py >> master_update.log 2>&1

echo "=== [$(date)] Running Structural Architecture Engines ===" >> master_update.log
echo "Running Stage Analysis & CANSLIM Engine..." >> master_update.log
python3 -c "from stage_canslim_engine import run_stage_canslim_screener; run_stage_canslim_screener(force_refresh=True)" >> master_update.log 2>&1

echo "Running Institutional Wyckoff Screener Engine..." >> master_update.log
python3 -c "from wyckoff_engine import run_wyckoff_screener; run_wyckoff_screener(force_refresh=True)" >> master_update.log 2>&1

echo "Running Elliott Wave Pattern & Subwave Screener..." >> master_update.log
python3 -c "from elliott_wave_engine import run_elliott_wave_screener; run_elliott_wave_screener(force_refresh=True)" >> master_update.log 2>&1

echo "Running W.D. Gann Geometric & Square of 9 Screener..." >> master_update.log
python3 gann_engine.py >> master_update.log 2>&1

echo "Running Options Intelligence Dumper & Flow Engine..." >> master_update.log
python3 options_dumper.py --test >> master_update.log 2>&1

echo "=== [$(date)] Running Synthesis, Macro & Playbooks ===" >> master_update.log
echo "Running DeepVue Quantitative Screener..." >> master_update.log
python3 deepvue_screener.py >> master_update.log 2>&1

echo "Running Correlation Engine..." >> master_update.log
python3 correlation_engine.py >> master_update.log 2>&1

echo "Running Market Health Engine..." >> master_update.log
python3 market_health_engine.py >> master_update.log 2>&1

echo "Generating AI Playbook 2.0..." >> master_update.log
python3 playbook_generator.py >> master_update.log 2>&1

echo "Generating Weekly Playbook 2.0..." >> master_update.log
python3 weekly_playbook_engine.py >> master_update.log 2>&1

echo "=== [$(date)] All Scanners Master Daily Update Complete. ===" >> master_update.log
