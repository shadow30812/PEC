#!/usr/bin/env bash
# VoltBridge - Launch Local Simulation Studio
PORT=8080
echo "Starting VoltBridge on http://localhost:$PORT ..."
if which xdg-open > /dev/null; then
  (sleep 1 && xdg-open "http://localhost:$PORT/index.html") &
elif which open > /dev/null; then
  (sleep 1 && open "http://localhost:$PORT/index.html") &
fi
python3 -m http.server $PORT
