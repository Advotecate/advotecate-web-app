#!/bin/sh
set -e

echo "🔗 Starting Tailscale for Frontend..."

# Start tailscaled in the background
tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &

# Wait a moment for tailscaled to start
sleep 2

# Authenticate with Tailscale using auth key
if [ -n "$TAILSCALE_AUTHKEY" ]; then
    echo "🔑 Authenticating with Tailscale..."
    tailscale up --authkey="$TAILSCALE_AUTHKEY" --hostname="advotecate-frontend" --accept-routes
else
    echo "❌ TAILSCALE_AUTHKEY environment variable not set"
    exit 1
fi

# Wait for Tailscale to be ready
echo "⏳ Waiting for Tailscale to be ready..."
timeout=30
while [ $timeout -gt 0 ]; do
    if tailscale status | grep -q "advotecate-frontend"; then
        break
    fi
    sleep 1
    timeout=$((timeout - 1))
done

if [ $timeout -eq 0 ]; then
    echo "❌ Tailscale failed to start within 30 seconds"
    exit 1
fi

echo "✅ Tailscale ready!"
tailscale ip

echo "🚀 Starting nginx..."

# Set default PORT if not provided
if [ -z "$PORT" ]; then
    export PORT=3000
    echo "⚠️ PORT not set, defaulting to 3000"
else
    echo "📡 Using PORT=$PORT"
fi

# Configure nginx with PORT environment variable
echo "🔧 Configuring nginx with PORT=$PORT"
envsubst '$PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Validate nginx configuration
echo "🔍 Validating nginx configuration..."
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Nginx configuration is invalid"
    cat /etc/nginx/nginx.conf
    exit 1
fi

echo "✅ Nginx configuration is valid"
echo "🚀 Starting nginx on port $PORT..."

# Start nginx in the foreground
exec nginx -g "daemon off;"