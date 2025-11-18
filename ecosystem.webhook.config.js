module.exports = {
  apps: [{
    name: 'wowz-webhook',
    script: 'webhook-server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env_file: '.env.webhook',
    env: {
      NODE_ENV: 'production',
      WEBHOOK_PORT: 3004,
      REPO_PATH: '/root/wowz-cloud-api'
    },
    error_file: '/root/.pm2/logs/wowz-webhook-error.log',
    out_file: '/root/.pm2/logs/wowz-webhook-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
