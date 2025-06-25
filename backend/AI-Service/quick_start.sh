#!/bin/bash

echo "🚀 Quick Start AI-Service"
echo "========================="

# Check if we're in the right directory
if [ ! -f "main.py" ]; then
    echo "❌ main.py not found. Please run from AI-Service directory"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Run setup.sh first"
    exit 1
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Kill any existing service on port 8088
if lsof -Pi :8088 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Killing existing service on port 8088..."
    PID=$(lsof -Pi :8088 -sTCP:LISTEN -t)
    kill -9 $PID 2>/dev/null
    sleep 2
fi

echo ""
echo "🎯 Starting AI Story Point Estimation Service..."
echo "📊 Documentation: http://localhost:8088/docs"
echo "💡 Health Check: http://localhost:8088/"
echo "🔄 Estimate API: http://localhost:8088/estimate"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start the service
uvicorn main:app --host 0.0.0.0 --port 8088 --reload 