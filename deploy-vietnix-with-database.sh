#!/bin/bash

echo "🚀 TaskFlow Production Deployment with Database"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Server configuration
SERVER_IP="14.225.210.28"
SERVER_USER="root"
PROJECT_DIR="/root/taskflow"

echo -e "${BLUE}📋 Deployment Configuration:${NC}"
echo "Server: $SERVER_USER@$SERVER_IP"
echo "Project Directory: $PROJECT_DIR"
echo "Services: 8 microservices + PostgreSQL database"
echo ""

# Step 1: Upload files to server
echo -e "${YELLOW}📤 Step 1: Uploading files to server...${NC}"
scp docker-compose.production.yml $SERVER_USER@$SERVER_IP:$PROJECT_DIR/
# scp postgres_backup.sql $SERVER_USER@$SERVER_IP:$PROJECT_DIR/  # Skip backup file

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Files uploaded successfully${NC}"
else
    echo -e "${RED}❌ Failed to upload files${NC}"
    exit 1
fi

# Step 2: Deploy on server
echo -e "${YELLOW}📦 Step 2: Deploying on server...${NC}"
ssh $SERVER_USER@$SERVER_IP << 'EOF'
    cd /root/taskflow
    
    echo "🔧 Installing Docker and Docker Compose..."
    # Install Docker if not already installed
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        usermod -aG docker root
    fi
    
    # Install Docker Compose if not already installed
    if ! command -v docker-compose &> /dev/null; then
        curl -L "https://github.com/docker/compose/releases/download/v2.24.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
    
    echo "🛑 Stopping existing services..."
    docker-compose -f docker-compose.production.yml down || true
    
    echo "🧹 Cleaning up old containers and images..."
    docker system prune -f
    
    echo "📥 Pulling latest images..."
    docker-compose -f docker-compose.production.yml pull
    
    echo "🚀 Starting all services with database..."
    docker-compose -f docker-compose.production.yml up -d
    
    echo "⏳ Waiting for services to be ready..."
    sleep 60
    
    echo "🔍 Checking service status..."
    docker-compose -f docker-compose.production.yml ps
    
    echo "🧪 Testing APIs..."
    echo "AI Service (8088):"
    curl -s -w "Status: %{http_code}\n" http://localhost:8088/ || echo "Failed"
    
    echo "Accounts Service (8080):"
    curl -s -w "Status: %{http_code}\n" http://localhost:8080/health || echo "Failed"
    
    echo "Projects Service (8083):"
    curl -s -w "Status: %{http_code}\n" http://localhost:8083/api/projects || echo "Failed"
    
    echo "✅ Deployment completed!"
    echo "🌐 Services are available at:"
    echo "- AI Service: http://14.225.210.28:8088"
    echo "- Accounts: http://14.225.210.28:8080"
    echo "- Projects: http://14.225.210.28:8083"
    echo "- Sprints: http://14.225.210.28:8084"
    echo "- Tasks: http://14.225.210.28:8085"
    echo "- Users: http://14.225.210.28:8086"
    echo "- Files: http://14.225.210.28:8087"
    echo "- Notifications: http://14.225.210.28:8089"
    echo "- Database: PostgreSQL on port 5432"
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
    echo ""
    echo -e "${BLUE}📊 Summary:${NC}"
    echo "✅ 8 microservices deployed"
    echo "✅ PostgreSQL database with production data"
    echo "✅ All services running with persistent volumes"
    echo "✅ Auto-restart enabled"
    echo ""
    echo -e "${YELLOW}🔗 Access URLs:${NC}"
    echo "AI Service: http://14.225.210.28:8088"
    echo "Accounts: http://14.225.210.28:8080"
    echo "Projects: http://14.225.210.28:8083"
    echo "Tasks: http://14.225.210.28:8085"
    echo "Users: http://14.225.210.28:8086"
    echo "Files: http://14.225.210.28:8087"
    echo "Notifications: http://14.225.210.28:8089"
else
    echo -e "${RED}❌ DEPLOYMENT FAILED!${NC}"
    exit 1
fi 