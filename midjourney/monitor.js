const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class APIMonitor {
  constructor() {
    this.apiUrl = 'http://localhost:3002';
    this.checkInterval = 60000; // 1 minute
    this.maxFailures = 3;
    this.failureCount = 0;
    this.lastRestart = 0;
    this.restartCooldown = 300000; // 5 minutes
    this.logFile = './logs/monitor.log';
    
    // Ensure logs directory exists
    if (!fs.existsSync('./logs')) {
      fs.mkdirSync('./logs');
    }
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    // Write to log file
    fs.appendFileSync(this.logFile, logMessage + '\n');
  }

  async checkHealth() {
    try {
      const response = await axios.get(`${this.apiUrl}/health`, {
        timeout: 10000
      });
      
      const data = response.data;
      this.log(`✅ Health check passed - Status: ${data.status}, Uptime: ${data.uptime}s, Success Rate: ${data.successRate}%`);
      
      // Reset failure count on success
      this.failureCount = 0;
      
      return true;
    } catch (error) {
      this.failureCount++;
      this.log(`❌ Health check failed (${this.failureCount}/${this.maxFailures}): ${error.message}`);
      
      if (this.failureCount >= this.maxFailures) {
        await this.restartService();
      }
      
      return false;
    }
  }

  async restartService() {
    const now = Date.now();
    if (now - this.lastRestart < this.restartCooldown) {
      this.log(`⏳ Restart cooldown active, skipping restart`);
      return;
    }

    this.log(`🔄 Restarting service due to ${this.failureCount} consecutive failures...`);
    this.lastRestart = now;
    this.failureCount = 0;

    try {
      // Restart using PM2
      exec('pm2 restart midjourney-api', (error, stdout, stderr) => {
        if (error) {
          this.log(`❌ Failed to restart service: ${error.message}`);
          return;
        }
        
        this.log(`✅ Service restarted successfully`);
        this.log(`📊 PM2 output: ${stdout}`);
        
        if (stderr) {
          this.log(`⚠️ PM2 stderr: ${stderr}`);
        }
      });
    } catch (error) {
      this.log(`❌ Error during restart: ${error.message}`);
    }
  }

  async checkMemoryUsage() {
    try {
      const response = await axios.get(`${this.apiUrl}/health`);
      const data = response.data;
      
      // Check if uptime is too long (potential memory leak)
      const uptimeHours = data.uptime / 3600;
      if (uptimeHours > 6) {
        this.log(`⚠️ Service uptime is ${uptimeHours.toFixed(1)} hours, scheduling restart`);
        setTimeout(() => this.restartService(), 30000); // Restart in 30 seconds
      }
    } catch (error) {
      this.log(`❌ Could not check memory usage: ${error.message}`);
    }
  }

  start() {
    this.log('🚀 Starting API Monitor...');
    this.log(`📊 Monitoring ${this.apiUrl} every ${this.checkInterval/1000} seconds`);
    
    // Initial health check
    this.checkHealth();
    
    // Set up periodic health checks
    setInterval(() => {
      this.checkHealth();
    }, this.checkInterval);
    
    // Set up memory usage checks (every 30 minutes)
    setInterval(() => {
      this.checkMemoryUsage();
    }, 30 * 60 * 1000);
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      this.log('🛑 Stopping API Monitor...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      this.log('🛑 Stopping API Monitor...');
      process.exit(0);
    });
  }
}

// Start the monitor
const monitor = new APIMonitor();
monitor.start(); 