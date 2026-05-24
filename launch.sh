#!/bin/bash
echo "🚀 Booting up SectorTracker Super App..."

# Safely kill any existing instances of the platform to avoid port conflicts
echo "🧹 Cleaning up old background agents..."
lsof -ti:5000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

echo "🧠 Starting Autonomous Python Councils..."
python3 server.py &

echo "🌐 Starting React Dashboard..."
npm run dev &

echo "⏳ Waiting for systems to initialize..."
sleep 3

echo "✅ Launching!"
open http://localhost:5173

echo ""
echo "========================================================"
echo "    DO NOT CLOSE THIS TERMINAL WINDOW!                  "
echo "    Closing this window will shut down the platform.    "
echo "========================================================"
wait
