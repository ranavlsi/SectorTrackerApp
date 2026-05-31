#!/bin/bash
# Keep-Alive script for SectorTracker Backend Server with Crash Loop Protection

APP_DIR="/Users/amitkumar/Desktop/SectorTrackerApp"
cd "$APP_DIR" || exit

# Check if the server is running
if ! pgrep -f "python3 backend/server.py" > /dev/null; then
    
    # --- CRASH LOOP PROTECTION LOGIC ---
    NOW=$(date +%s)
    HISTORY_FILE=".crash_history"
    
    # Create history file if it doesn't exist
    touch "$HISTORY_FILE"
    
    # Remove timestamps older than 5 minutes (300 seconds)
    TMP_FILE=$(mktemp)
    while read -r timestamp; do
        if (( NOW - timestamp <= 300 )); then
            echo "$timestamp" >> "$TMP_FILE"
        fi
    done < "$HISTORY_FILE"
    mv "$TMP_FILE" "$HISTORY_FILE"
    
    # Count crashes in the last 5 minutes
    CRASH_COUNT=$(wc -l < "$HISTORY_FILE" | tr -d ' ')
    
    if (( CRASH_COUNT >= 3 )); then
        echo "$(date): ABORTING RESTART. Server crashed 3+ times in the last 5 minutes. Please check the code for syntax errors." >> server_watchdog.log
        exit 1
    fi
    
    # Log the current crash timestamp
    echo "$NOW" >> "$HISTORY_FILE"
    # -----------------------------------

    echo "$(date): Server is not running. Restarting (Crash count in last 5m: $((CRASH_COUNT + 1)))..." >> server_watchdog.log
    # Use nohup to run it in the background independently of the shell
    nohup python3 backend/server.py >> server_watchdog.log 2>&1 &
fi
