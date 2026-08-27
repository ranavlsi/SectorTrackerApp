#!/bin/bash
# Watchdog script to keep the backend server alive and log crashes

LOG_FILE="/Users/amitkumar/Desktop/SectorTrackerApp/backend/server_crash.log"

echo "========================================" >> "$LOG_FILE"
echo "Starting Watchdog at $(date)" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

while true; do
    echo "[$(date)] Launching server.py..." >> "$LOG_FILE"
    
    # Run the root server and redirect all output to the log file
    python3 /Users/amitkumar/Desktop/SectorTrackerApp/server.py >> "$LOG_FILE" 2>&1
    
    EXIT_CODE=$?
    echo "[$(date)] ⚠️ Server crashed or stopped with exit code $EXIT_CODE" >> "$LOG_FILE"
    echo "Respawning in 5 seconds..." >> "$LOG_FILE"
    
    sleep 5
done
