#!/bin/bash
set -e

echo "🚀 Deploying Advotecate Production Environment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load production environment
if [ -f ".env.prod" ]; then
    echo -e "${GREEN}Loading production environment...${NC}"
    export $(cat .env.prod | xargs)
else
    echo -e "${RED}Error: .env.prod file not found!${NC}"
    exit 1
fi

# Validate critical environment variables
echo -e "${YELLOW}Validating production configuration...${NC}"
REQUIRED_VARS=("POSTGRES_PASSWORD" "REDIS_PASSWORD" "JWT_SECRET" "FLUIDPAY_API_KEY")

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ] || [[ "${!var}" == *"CHANGE_ME"* ]]; then
        echo -e "${RED}Error: $var is not set or contains default value!${NC}"
        echo -e "${RED}Please update .env.prod with production values${NC}"
        exit 1
    fi
done

# Confirmation prompt for production
echo -e "${YELLOW}⚠️  You are about to deploy to PRODUCTION environment!${NC}"
read -p "Are you sure? (type 'yes' to continue): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Deployment cancelled.${NC}"
    exit 0
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

# Backup existing data (if any)
if docker volume ls | grep -q "advotecate_postgres_data_prod"; then
    echo -e "${YELLOW}Creating backup of production data...${NC}"
    timestamp=$(date +%Y%m%d_%H%M%S)
    docker run --rm -v advotecate_postgres_data_prod:/data -v $(pwd)/backups:/backup busybox tar czf /backup/postgres_backup_$timestamp.tar.gz -C /data .
    echo -e "${GREEN}Backup created: backups/postgres_backup_$timestamp.tar.gz${NC}"
fi

# Stop existing containers gracefully
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker-compose -f docker-compose.prod.yml down --timeout 30 || true

# Pull latest images
echo -e "${YELLOW}Pulling latest base images...${NC}"
docker-compose -f docker-compose.prod.yml pull --ignore-pull-failures

# Build and start services
echo -e "${YELLOW}Building and starting production services...${NC}"
docker-compose -f docker-compose.prod.yml up --build -d

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
timeout=180
counter=0

while [ $counter -lt $timeout ]; do
    healthy_count=$(docker-compose -f docker-compose.prod.yml ps --filter status=running --format table | grep -c "healthy" || echo "0")
    if [ "$healthy_count" -ge "3" ]; then  # Assuming at least 3 services should be healthy
        break
    fi
    echo -n "."
    sleep 5
    counter=$((counter + 5))
done

echo ""

# Check service status
echo -e "${YELLOW}Checking service status...${NC}"
docker-compose -f docker-compose.prod.yml ps

# Run health checks
echo -e "${YELLOW}Running health checks...${NC}"
sleep 10

# Check if nginx is responding
if curl -f -s http://localhost/health > /dev/null; then
    echo -e "${GREEN}✅ Nginx health check passed${NC}"
else
    echo -e "${RED}❌ Nginx health check failed${NC}"
fi

# Display deployment info
echo -e "${GREEN}✅ Production environment deployed successfully!${NC}"
echo ""
echo -e "${YELLOW}Service Status:${NC}"
docker-compose -f docker-compose.prod.yml ps
echo ""
echo -e "${YELLOW}Production URLs:${NC}"
echo "Website: https://${DOMAIN:-advotecate.com}"
echo "API: https://${DOMAIN:-advotecate.com}/api"
echo ""
echo -e "${YELLOW}To view logs:${NC}"
echo "docker-compose -f docker-compose.prod.yml logs -f [service-name]"
echo ""
echo -e "${YELLOW}To stop services:${NC}"
echo "./scripts/stop-prod.sh"
echo ""
echo -e "${YELLOW}Monitor with:${NC}"
echo "watch -n 5 'docker-compose -f docker-compose.prod.yml ps'"