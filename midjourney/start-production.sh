#!/bin/bash

# 🚀 Midjourney API Production Startup Script

echo "🚀 Starting Midjourney API Production Server..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Installing PM2..."
    npm install -g pm2
fi

# Create logs directory if it doesn't exist
if [ ! -d "./logs" ]; then
    echo "📁 Creating logs directory..."
    mkdir logs
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️ .env file not found. Creating default .env..."
    cat > .env << EOF
NODE_ENV=production
PORT=3000
MIDJOURNEY_PROFILE_PATH=./midjourney-profile
EOF
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "./node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Stop existing PM2 processes
echo "🛑 Stopping existing PM2 processes..."
pm2 stop midjourney-api 2>/dev/null || true
pm2 delete midjourney-api 2>/dev/null || true

# Start the API server
echo "🚀 Starting API server with PM2..."
pm2 start ecosystem.config.js

# Start the monitor
echo "📊 Starting monitor..."
pm2 start monitor.js --name "midjourney-monitor"

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Show status
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "✅ Production server started successfully!"
echo ""
echo "📊 Useful commands:"
echo "  pm2 logs midjourney-api          # View API logs"
echo "  pm2 logs midjourney-monitor      # View monitor logs"
echo "  pm2 status                       # View status"
echo "  pm2 restart midjourney-api       # Restart API"
echo "  pm2 stop midjourney-api          # Stop API"
echo ""
echo "🌐 API Endpoints:"
echo "  Health Check: http://localhost:3002/health"
echo "  API Docs: http://localhost:3002/"
echo "  Generate Image: http://localhost:3002/midjourney/genimage"
echo ""
echo "📁 Log files:"
echo "  ./logs/combined.log"
echo "  ./logs/out.log"
echo "  ./logs/error.log"
echo "  ./logs/monitor.log" 