#!/bin/bash

echo "🚀 AI-Service Setup & Start Script"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the correct directory
if [ ! -f "main.py" ]; then
    print_error "main.py not found. Please run this script from AI-Service directory"
    exit 1
fi

print_info "Current directory: $(pwd)"

# Step 1: Check Python version
print_info "Checking Python version..."
python_version=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
major_version=$(echo $python_version | cut -d. -f1)
minor_version=$(echo $python_version | cut -d. -f2)

if [ "$major_version" -gt 3 ] || ([ "$major_version" -eq 3 ] && [ "$minor_version" -ge 8 ]); then
    print_status "Python $python_version found"
else
    print_error "Python 3.8+ required. Current version: $python_version"
    exit 1
fi

# Step 2: Create/Activate virtual environment
print_info "Setting up virtual environment..."
if [ ! -d "venv" ]; then
    print_info "Creating virtual environment..."
    python3 -m venv venv
    if [ $? -eq 0 ]; then
        print_status "Virtual environment created"
    else
        print_error "Failed to create virtual environment"
        exit 1
    fi
else
    print_status "Virtual environment already exists"
fi

# Activate virtual environment
print_info "Activating virtual environment..."
source venv/bin/activate
if [ $? -eq 0 ]; then
    print_status "Virtual environment activated"
else
    print_error "Failed to activate virtual environment"
    exit 1
fi

# Step 3: Upgrade pip
print_info "Upgrading pip..."
pip install --upgrade pip > /dev/null 2>&1
print_status "Pip upgraded"

# Step 4: Install dependencies
print_info "Installing dependencies..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        print_status "Dependencies installed successfully"
    else
        print_warning "Some dependencies may have issues, but continuing..."
    fi
else
    print_warning "requirements.txt not found, installing basic dependencies..."
    pip install fastapi uvicorn pydantic scikit-learn pandas numpy textstat nltk > /dev/null 2>&1
fi

# Step 5: Create necessary directories
print_info "Creating necessary directories..."
mkdir -p models
mkdir -p logs
mkdir -p data
print_status "Directories created"

# Step 6: Download NLTK data if needed
print_info "Checking NLTK data..."
python3 -c "
import nltk
try:
    nltk.data.find('tokenizers/punkt')
    print('NLTK data already available')
except LookupError:
    print('Downloading NLTK data...')
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
" 2>/dev/null

# Step 7: Test imports
print_info "Testing critical imports..."
python3 -c "
import sys
try:
    from models.story_point_estimator import StoryPointEstimator
    from utils.text_preprocessor import TextPreprocessor
    import main
    print('✅ All imports successful')
except Exception as e:
    print(f'❌ Import error: {e}')
    sys.exit(1)
" 2>/dev/null

if [ $? -eq 0 ]; then
    print_status "All imports working correctly"
else
    print_error "Import errors detected. Check your code."
    exit 1
fi

# Step 8: Check port availability
print_info "Checking if port 8088 is available..."
if lsof -Pi :8088 -sTCP:LISTEN -t >/dev/null ; then
    print_warning "Port 8088 is already in use. Attempting to free it..."
    # Try to kill existing process
    PID=$(lsof -Pi :8088 -sTCP:LISTEN -t)
    if [ ! -z "$PID" ]; then
        kill -9 $PID 2>/dev/null
        sleep 2
        print_status "Port 8088 freed"
    fi
else
    print_status "Port 8088 is available"
fi

# Step 9: Start the service
echo ""
echo "🎯 STARTING AI STORY POINT ESTIMATION SERVICE"
echo "============================================="
print_info "Service will be available at:"
echo "  📊 API Documentation: http://localhost:8088/docs"
echo "  💡 Health Check: http://localhost:8088/"
echo "  🔄 Estimate API: http://localhost:8088/estimate"
echo "  📈 Model Status: http://localhost:8088/model/status"
echo ""
print_info "Press Ctrl+C to stop the service"
echo ""

# Start the service with proper error handling
python3 -c "
import uvicorn
import sys
import os

try:
    uvicorn.run(
        'main:app',
        host='0.0.0.0',
        port=8088,
        reload=True,
        log_level='info'
    )
except KeyboardInterrupt:
    print('\n👋 Service stopped by user')
except Exception as e:
    print(f'❌ Error starting service: {e}')
    sys.exit(1)
"

# If we get here, service was stopped
print_status "AI-Service stopped successfully" 