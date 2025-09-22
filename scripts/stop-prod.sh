#!/bin/bash
echo "🛑 Stopping Advotecate Production Environment"

echo "⚠️  You are about to stop the PRODUCTION environment!"
read -p "Are you sure? (type 'yes' to continue): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Operation cancelled."
    exit 0
fi

docker-compose -f docker-compose.prod.yml down --timeout 30

echo "✅ Production environment stopped"