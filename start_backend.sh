#!/usr/bin/env bash
# DoodleDash Backend Startup Script
# Can be run from any working directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

HOST="${BACKEND_HOST:-0.0.0.0}"
PORT="${BACKEND_PORT:-5001}"

pick_python_with_gunicorn() {
    CANDIDATES=()

    if [ -x "$PROJECT_ROOT/.venv/bin/python" ]; then
        CANDIDATES+=("$PROJECT_ROOT/.venv/bin/python")
    fi
    if [ -x "$PROJECT_ROOT/venv/bin/python" ]; then
        CANDIDATES+=("$PROJECT_ROOT/venv/bin/python")
    fi
    if command -v python3.10 >/dev/null 2>&1; then
        CANDIDATES+=("$(command -v python3.10)")
    fi
    if command -v python3 >/dev/null 2>&1; then
        CANDIDATES+=("$(command -v python3)")
    fi

    for py in "${CANDIDATES[@]}"; do
        if "$py" -c "import gunicorn" >/dev/null 2>&1; then
            echo "$py"
            return
        fi
    done

    echo ""
}

PYTHON_BIN="$(pick_python_with_gunicorn)"
if [ -z "$PYTHON_BIN" ]; then
    echo "Error: Could not find a Python interpreter with gunicorn installed."
    echo "Tried: .venv/bin/python, venv/bin/python, python3.10, python3"
    echo "Install with one of these:"
    echo "  python3 -m pip install -r backend/requirements.txt"
    echo "  venv/bin/python -m pip install -r backend/requirements.txt"
    exit 1
fi

# Free the configured port if something is already using it.
if command -v lsof >/dev/null 2>&1; then
    EXISTING_PID="$(lsof -ti:"$PORT" 2>/dev/null || true)"
    if [ -n "$EXISTING_PID" ]; then
        echo "Stopping process on port $PORT (PID: $EXISTING_PID)"
        kill $EXISTING_PID 2>/dev/null || true
        sleep 0.5
        kill -9 $EXISTING_PID 2>/dev/null || true
    fi
fi

echo "Using Python: $PYTHON_BIN"
echo "Starting DoodleDash backend on http://$HOST:$PORT ..."
cd "$PROJECT_ROOT"
exec "$PYTHON_BIN" -m gunicorn \
    -k eventlet \
    -w 1 \
    --bind "$HOST:$PORT" \
    --timeout 120 \
    --log-level info \
    backend.wsgi:app
