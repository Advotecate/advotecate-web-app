# Advotecate Deployment Guide

Optimized Docker Compose + VM deployment with Tailscale for secure multi-environment management.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────┐
│              Tailscale Network          │
│  ┌─────────────────┐ ┌─────────────────┐│
│  │   Dev VM        │ │   Prod VM       ││
│  │ advotecate-dev  │ │ advotecate-prod ││
│  └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────┘
         │                       │
    ┌────▼────┐             ┌────▼────┐
    │ Dev Env │             │Prod Env │
    └─────────┘             └─────────┘
         │                       │
  ┌──────▼──────────┐   ┌─────▼─────────┐
  │   nginx:80      │   │  nginx:80/443 │
  │  ┌─────────────┐│   │ ┌─────────────┐│
  │  │ Frontend:3K ││   │ │ Frontend    ││
  │  │ API-GW:8080 ││   │ │ API Gateway ││
  │  │ API-BE:3001 ││   │ │ API Backend ││
  │  │ Postgres:5K ││   │ │ Postgres    ││
  │  │ Redis:6379  ││   │ │ Redis       ││
  │  └─────────────┘│   │ └─────────────┘│
  └─────────────────┘   └───────────────┘
```

## 📁 Project Structure

```
web-app/
├── docker-compose.dev.yml          # Development environment
├── docker-compose.prod.yml         # Production environment
├── .env.dev                        # Development config
├── .env.prod                       # Production config (update secrets!)
├── nginx/
│   ├── dev/                        # Development nginx config
│   │   ├── nginx.conf
│   │   └── conf.d/default.conf
│   └── prod/                       # Production nginx config
│       ├── nginx.conf
│       └── conf.d/default.conf
└── scripts/
    ├── setup-gcp-vm.sh            # Create GCP VMs
    ├── deploy-dev.sh              # Deploy development
    ├── deploy-prod.sh             # Deploy production
    ├── stop-dev.sh                # Stop development
    └── stop-prod.sh               # Stop production
```

## 🚀 Quick Start

### 1. Update Configuration

**Development (.env.dev):**
```bash
# Update Tailscale auth key
TAILSCALE_AUTHKEY=your-dev-tailscale-authkey
```

**Production (.env.prod):**
```bash
# CRITICAL: Update ALL these values!
POSTGRES_PASSWORD=strong-password-here
REDIS_PASSWORD=strong-redis-password
JWT_SECRET=long-random-jwt-secret
FLUIDPAY_API_KEY=your-production-key
TAILSCALE_AUTHKEY=your-prod-tailscale-authkey
DOMAIN=your-domain.com
```

### 2. Create GCP VMs

```bash
# Create development VM
./scripts/setup-gcp-vm.sh

# Select option 1 for dev VM only
```

### 3. Deploy to VM

```bash
# SSH into VM
gcloud compute ssh advotecate-dev-vm --zone=us-central1-a

# On the VM:
git clone https://github.com/your-org/web-app.git
cd web-app

# Deploy development environment
./scripts/deploy-dev.sh
```

### 4. Connect via Tailscale

```bash
# On the VM, connect to Tailscale
sudo tailscale up --authkey=YOUR_AUTHKEY --hostname=advotecate-dev

# Access from your devices at:
# http://advotecate-dev (or the assigned Tailscale IP)
```

## 🔧 Local Development

If you want to run locally (without VM):

```bash
# Clone and setup
git clone https://github.com/your-org/web-app.git
cd web-app

# Deploy locally
./scripts/deploy-dev.sh

# Access at:
# Frontend: http://localhost:3000
# API Gateway: http://localhost:8080
# API Backend: http://localhost:3001
```

## 🏭 Production Deployment

### Prerequisites
1. Update `.env.prod` with real production values
2. Set up SSL certificates in `nginx/ssl/`
3. Configure your domain DNS to point to the VM

### Deploy
```bash
# Create production VM
./scripts/setup-gcp-vm.sh  # Select option 2

# SSH and deploy
gcloud compute ssh advotecate-prod-vm --zone=us-central1-a
git clone https://github.com/your-org/web-app.git
cd web-app

# Deploy production (requires confirmation)
./scripts/deploy-prod.sh
```

## 🌐 Service URLs

### Development
- **Frontend**: `http://advotecate-dev` (via Tailscale)
- **API Gateway**: `http://advotecate-dev:8080`
- **Direct Backend**: `http://advotecate-dev:3001` (debug only)

### Production
- **Website**: `https://your-domain.com`
- **API**: `https://your-domain.com/api`
- **Tailscale**: `http://advotecate-prod` (private access)

## 🛠️ Management Commands

```bash
# View service status
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs -f [service-name]

# Restart a service
docker-compose -f docker-compose.dev.yml restart [service-name]

# Update and rebuild
docker-compose -f docker-compose.dev.yml down
git pull
docker-compose -f docker-compose.dev.yml up --build -d

# Stop everything
./scripts/stop-dev.sh
./scripts/stop-prod.sh
```

## 🔒 Security Features

### Development
- Internal Docker network isolation
- Basic security headers
- CORS configured for localhost
- Debug endpoints enabled

### Production
- HTTPS with SSL/TLS
- Security headers (HSTS, CSP, etc.)
- Rate limiting
- Log rotation
- No debug endpoints
- Backup automation

## 📊 Monitoring

```bash
# Check service health
curl http://advotecate-dev/health

# Monitor resources
docker stats

# Check logs
tail -f /opt/advotecate/logs/*.log

# Database backup (production)
docker exec advotecate-postgres-prod pg_dump -U advotecate_user advotecate_prod > backup.sql
```

## 🔄 Environment Promotion

### Dev → Prod Workflow
1. Test thoroughly in development
2. Update `.env.prod` with production values
3. Create production VM (if not exists)
4. Deploy to production VM
5. Update DNS to point to production VM
6. Monitor deployment

### Rollback Process
```bash
# Stop current deployment
./scripts/stop-prod.sh

# Restore from backup if needed
docker run --rm -v postgres_data_prod:/data -v $(pwd)/backups:/backup busybox tar xzf /backup/postgres_backup_TIMESTAMP.tar.gz -C /data

# Redeploy previous version
git checkout previous-stable-commit
./scripts/deploy-prod.sh
```

## 🚨 Troubleshooting

### Common Issues

**Services won't start:**
```bash
# Check logs
docker-compose -f docker-compose.dev.yml logs

# Check disk space
df -h

# Restart Docker
sudo systemctl restart docker
```

**Can't connect via Tailscale:**
```bash
# Check Tailscale status
sudo tailscale status

# Restart Tailscale
sudo systemctl restart tailscaled

# Re-authenticate
sudo tailscale up --authkey=NEW_AUTHKEY
```

**Database connection errors:**
```bash
# Check if postgres is running
docker-compose -f docker-compose.dev.yml ps postgres

# Check postgres logs
docker-compose -f docker-compose.dev.yml logs postgres

# Reset postgres data (DESTRUCTIVE)
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d postgres
```

## 🎯 Benefits of This Setup

### vs Individual Cloud Run Services:
- ✅ **90% cost reduction** (single VM vs multiple services)
- ✅ **Simplified networking** (internal Docker network)
- ✅ **Easier debugging** (all services in one place)
- ✅ **Faster deployments** (no cold starts)
- ✅ **Better resource utilization**

### vs Traditional Deployment:
- ✅ **Environment parity** (dev/prod identical)
- ✅ **One-command deployment**
- ✅ **Automatic health checks**
- ✅ **Built-in service discovery**
- ✅ **Easy rollbacks**

### Tailscale Integration:
- ✅ **Secure private access** (no public IPs needed)
- ✅ **Easy team collaboration** (share Tailscale network)
- ✅ **Multi-device access** (phone, laptop, etc.)
- ✅ **No VPN complexity** (zero-config networking)

## 📞 Support

For issues:
1. Check the logs: `docker-compose -f docker-compose.dev.yml logs`
2. Verify environment variables in `.env.dev` or `.env.prod`
3. Ensure VM has enough resources (CPU, RAM, disk)
4. Check Tailscale connectivity: `sudo tailscale status`