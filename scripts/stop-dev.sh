#!/bin/bash
echo "🛑 Stopping Advotecate Development Environment"

docker-compose -f docker-compose.dev.yml down --remove-orphans

echo "✅ Development environment stopped"