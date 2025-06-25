#!/bin/bash
echo "Stopping all services on ports 8080 to 8090..."
for PORT in {8080..8089}; do
    PIDS=$(lsof -ti :$PORT)
    if [ -n "$PIDS" ]; then
        echo "Killing process on port $PORT (PID $PIDS)"
        kill -9 $PIDS
    else
        echo "No process found on port $PORT"
    fi
done
echo "All services stopped."
