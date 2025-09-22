#!/bin/bash
set -e

echo "🚀 Deploying Advotecate Development Environment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load development environment
if [ -f ".env.dev" ]; then
    echo -e "${GREEN}Loading development environment...${NC}"
    export $(cat .env.dev | xargs)
else
    echo -e "${RED}Error: .env.dev file not found!${NC}"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check dependencies
echo -e "${YELLOW}Checking dependencies...${NC}"
if ! command_exists docker; then
    echo -e "${RED}Error: Docker is not installed!${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}Error: Docker Compose is not installed!${NC}"
    exit 1
fi

# Stop existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker-compose -f docker-compose.dev.yml down --remove-orphans || true

# Pull latest images
echo -e "${YELLOW}Pulling latest base images...${NC}"
docker-compose -f docker-compose.dev.yml pull --ignore-pull-failures

# Build and start services
echo -e "${YELLOW}Building and starting services...${NC}"
docker-compose -f docker-compose.dev.yml up --build -d

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
timeout=120
counter=0

while [ $counter -lt $timeout ]; do
    if docker-compose -f docker-compose.dev.yml ps | grep -q "healthy"; then
        break
    fi
    echo -n "."
    sleep 2
    counter=$((counter + 2))
done

echo ""

# Check service status
echo -e "${YELLOW}Checking service status...${NC}"
docker-compose -f docker-compose.dev.yml ps

# Display connection info
echo -e "${GREEN}✅ Development environment deployed successfully!${NC}"
echo ""
echo -e "${YELLOW}Service URLs:${NC}"
echo "Frontend: http://localhost:3000"
echo "API Gateway: http://localhost:8080"
echo "API Backend: http://localhost:3001"
echo "Postgres: localhost:5432"
echo "Redis: localhost:6379"
echo ""
echo -e "${YELLOW}To view logs:${NC}"
echo "docker-compose -f docker-compose.dev.yml logs -f [service-name]"
echo ""
echo -e "${YELLOW}To stop services:${NC}"
echo "./scripts/stop-dev.sh"