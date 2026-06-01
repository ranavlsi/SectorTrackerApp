#!/bin/bash
cd /Users/amitkumar/Desktop/SectorTrackerApp

# Clean up any lingering processes just in case
pkill -f "python3 server.py" || true
pkill -f "npm run dev" || true
pkill -f "vite" || true
pkill -f "intraday_snapshot_daemon.py" || true

# Start Backend API (Autonomous Python Councils)
nohup python3 server.py > backend/server.log 2>&1 &

# Start React Frontend Dashboard
nohup npm run dev > frontend.log 2>&1 &

# Start Live Market Snapshot Daemon
nohup python3 backend/intraday_snapshot_daemon.py > backend/intraday_daemon.log 2>&1 &
