#!/bin/bash
# setup_cron.sh
# This script sets up a crontab entry to automatically run the db_updater.py 
# and all daily scanners at 4:15 PM EST (16:15) every weekday (Monday-Friday).

BACKEND_DIR="/Users/amitkumar/Desktop/SectorTrackerApp/backend"
PYTHON_BIN="/usr/bin/python3" # Or whatever path pip3 uses

# Create a master update script that runs the DB updater then the scanners
cat << 'EOF' > "$BACKEND_DIR/master_daily_update.sh"
#!/bin/bash
cd /Users/amitkumar/Desktop/SectorTrackerApp/backend
echo "Starting Daily Market Data Download..." > master_update.log
python3 db_updater.py >> master_update.log 2>&1
echo "Running Volume Climax Scanner..." >> master_update.log
python3 volume_climax_scanner.py >> master_update.log 2>&1
echo "Running Darvas Box Scanner..." >> master_update.log
python3 darvas_box_scanner.py >> master_update.log 2>&1
echo "Running CANSLIM Scanner..." >> master_update.log
python3 canslim_minervini_scanner.py >> master_update.log 2>&1
echo "Running Earnings Flag Scanner..." >> master_update.log
python3 earnings_flag_scanner.py >> master_update.log 2>&1
echo "Running Candlestick Scanner..." >> master_update.log
python3 candlestick_scanner.py >> master_update.log 2>&1
echo "Update Complete." >> master_update.log
EOF

chmod +x "$BACKEND_DIR/master_daily_update.sh"

CRON_CMD="15 16 * * 1-5 $BACKEND_DIR/master_daily_update.sh"
REBOOT_CMD="@reboot sleep 30 && $BACKEND_DIR/master_daily_update.sh && /usr/bin/python3 $BACKEND_DIR/market_health_engine.py"

# Add to crontab if not already there
(crontab -l 2>/dev/null | grep -v "master_daily_update.sh"; echo "$CRON_CMD"; echo "$REBOOT_CMD") | crontab -

echo "Cron jobs installed successfully! The master update will run at 4:15 PM every weekday, AND automatically immediately upon machine reboot."
