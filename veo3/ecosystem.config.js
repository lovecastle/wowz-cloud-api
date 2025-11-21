module.exports = {
  apps: [{
    name: 'veo3-api',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3003
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3003
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

    // Kill timeout
    kill_timeout: 5000,

    // Listen timeout
    listen_timeout: 8000
  }]
};
