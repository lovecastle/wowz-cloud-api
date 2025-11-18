module.exports = {
  apps: [{
    name: 'midjourney-api',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Restart policy
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Health check
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true,
    
    // Memory management
    node_args: '--max-old-space-size=512 --optimize-for-size --gc-interval=100',
    
    // Cron restart (restart every 4 hours instead of 6 to prevent memory leaks)
    cron_restart: '0 */4 * * *',
    
    // Kill timeout
    kill_timeout: 5000,
    
    // Listen timeout
    listen_timeout: 8000,
    
    // PM2 specific
    pmx: false,
    source_map_support: false,
    
    // Environment variables
    env_file: '.env'
  }]
}; 