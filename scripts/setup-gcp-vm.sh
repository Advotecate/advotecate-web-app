#!/bin/bash
set -e

echo "🚀 Setting up GCP VM with Docker and Tailscale"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${PROJECT_ID:-"advotecate-dev"}
ZONE=${ZONE:-"us-central1-a"}
VM_NAME_DEV="advotecate-dev-vm"
VM_NAME_PROD="advotecate-prod-vm"
MACHINE_TYPE=${MACHINE_TYPE:-"e2-standard-4"}  # 4 vCPUs, 16GB RAM
DISK_SIZE=${DISK_SIZE:-"100GB"}

# Function to create VM
create_vm() {
    local vm_name=$1
    local env_type=$2

    echo -e "${YELLOW}Creating $env_type VM: $vm_name${NC}"

    gcloud compute instances create $vm_name \
        --project=$PROJECT_ID \
        --zone=$ZONE \
        --machine-type=$MACHINE_TYPE \
        --network-interface=network-tier=PREMIUM,subnet=default \
        --maintenance-policy=MIGRATE \
        --service-account=advotecate-vm@$PROJECT_ID.iam.gserviceaccount.com \
        --scopes=https://www.googleapis.com/auth/cloud-platform \
        --tags=advotecate-$env_type,http-server,https-server \
        --create-disk=auto-delete=yes,boot=yes,device-name=$vm_name,image=projects/ubuntu-os-cloud/global/images/ubuntu-2204-jammy-v20231213,mode=rw,size=$DISK_SIZE,type=projects/$PROJECT_ID/zones/$ZONE/diskTypes/pd-balanced \
        --no-shielded-secure-boot \
        --shielded-vtpm \
        --shielded-integrity-monitoring \
        --reservation-affinity=any \
        --metadata=startup-script='#!/bin/bash
        set -e

        echo "Starting VM setup..." >> /var/log/startup.log

        # Update system
        apt-get update
        apt-get upgrade -y

        # Install Docker
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
        add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
        apt-get update
        apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

        # Install Docker Compose (standalone)
        curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

        # Create docker group and add user
        groupadd -f docker
        usermod -aG docker $USER

        # Start and enable Docker
        systemctl start docker
        systemctl enable docker

        # Install Tailscale
        curl -fsSL https://tailscale.com/install.sh | sh

        # Install other useful tools
        apt-get install -y curl wget git htop unzip jq nginx-utils

        # Create directories
        mkdir -p /opt/advotecate/{backups,logs}
        mkdir -p /etc/ssl/private

        # Set up log rotation
        cat > /etc/logrotate.d/advotecate << EOF
/opt/advotecate/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    notifempty
    create 644 root root
}
EOF

        # Create deployment user
        useradd -m -s /bin/bash advotecate-deploy
        usermod -aG docker advotecate-deploy

        echo "VM setup completed successfully!" >> /var/log/startup.log
        '

    echo -e "${GREEN}✅ VM $vm_name created successfully${NC}"
}

# Check if gcloud is configured
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}Error: Please authenticate with gcloud first${NC}"
    echo "Run: gcloud auth login"
    exit 1
fi

# Set project
echo -e "${YELLOW}Setting project to $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Create firewall rules if they don't exist
echo -e "${YELLOW}Setting up firewall rules...${NC}"
gcloud compute firewall-rules create advotecate-http \
    --allow tcp:80,tcp:443,tcp:3000,tcp:8080,tcp:3001 \
    --source-ranges 0.0.0.0/0 \
    --target-tags http-server,https-server,advotecate-dev,advotecate-prod \
    --description "Allow HTTP/HTTPS and app ports for Advotecate" \
    --project=$PROJECT_ID || echo "Firewall rule already exists"

# Create service account if it doesn't exist
echo -e "${YELLOW}Setting up service account...${NC}"
gcloud iam service-accounts create advotecate-vm \
    --description="Service account for Advotecate VMs" \
    --display-name="Advotecate VM Service Account" \
    --project=$PROJECT_ID || echo "Service account already exists"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:advotecate-vm@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/logging.logWriter" || true

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:advotecate-vm@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/monitoring.metricWriter" || true

# Prompt for which environment to create
echo -e "${YELLOW}Which environment would you like to create?${NC}"
echo "1) Development VM only"
echo "2) Production VM only"
echo "3) Both environments"
read -p "Select option (1-3): " choice

case $choice in
    1)
        create_vm $VM_NAME_DEV "dev"
        ;;
    2)
        create_vm $VM_NAME_PROD "prod"
        ;;
    3)
        create_vm $VM_NAME_DEV "dev"
        create_vm $VM_NAME_PROD "prod"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 GCP VM setup completed!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Wait for VMs to finish startup (check startup logs):"
echo "   gcloud compute instances get-serial-port-output $VM_NAME_DEV --zone=$ZONE"
echo ""
echo "2. SSH into the VM:"
echo "   gcloud compute ssh $VM_NAME_DEV --zone=$ZONE"
echo ""
echo "3. Set up Tailscale on the VM:"
echo "   sudo tailscale up --authkey=YOUR_AUTHKEY --hostname=$VM_NAME_DEV"
echo ""
echo "4. Clone your repository and deploy:"
echo "   git clone https://github.com/your-repo/web-app.git"
echo "   cd web-app && ./scripts/deploy-dev.sh"