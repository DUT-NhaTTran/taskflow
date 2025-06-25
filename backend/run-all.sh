set -e

echo "Starting all TaskFlow services..."

# Maven-based services
MAVEN_SERVICES=(
  "Accounts-Service"
  "User-Service"
  "Projects-Service"
  "Sprints-Service"
  "Tasks-Service"
  "Notification-Service"
  "File-Service"
  "common"
)

# Start Maven services
for SERVICE in "${MAVEN_SERVICES[@]}"
do
  echo "Starting $SERVICE..."
  mvn -pl "$SERVICE" spring-boot:run &
done

# Start AI-Service (Python FastAPI)
echo "Starting AI-Service..."
cd AI-Service
if [ -d "venv" ]; then
  echo "Using virtual environment for AI-Service..."
  source venv/bin/activate && python test_simple.py &
else
  echo "Virtual environment not found, running without venv..."
  python test_simple.py &
fi
cd ..

echo "All services are starting..."
echo "Maven services will be available on ports 8080-8089"
echo "AI-Service will be available on port 8088"

