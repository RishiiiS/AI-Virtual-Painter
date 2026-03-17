#!/bin/bash
# DoodleDash Frontend Startup Script
# Run from the project root: /Users/rishiseth/Desktop/DoodleDash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd "$FRONTEND_DIR" && npm install
fi

echo "Starting DoodleDash frontend at http://localhost:5173 ..."
cd "$FRONTEND_DIR"
exec npm run dev
