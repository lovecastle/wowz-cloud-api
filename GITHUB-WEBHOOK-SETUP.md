# GitHub Webhook Setup for WOWZ Cloud API

This guide explains how to set up GitHub webhooks for automatic deployment of the WOWZ Cloud API repository.

## Prerequisites

- Node.js installed
- Express package installed (`npm install express` in the root directory)
- Server with public IP or domain name
- GitHub repository: `wowz-cloud-api`

## 1. Configure Environment Variables

Edit the `.env.webhook` file in the repository root:

```bash
WEBHOOK_PORT=3004
WEBHOOK_SECRET=your_github_webhook_secret_here
REPO_PATH=/root/wowz-cloud-api
```

**Important**: Replace `your_github_webhook_secret_here` with a strong random secret that you'll use in GitHub webhook settings.

## 2. Install Dependencies

```bash
cd /root/wowz-cloud-api
npm install express
```

## 3. Start the Webhook Server

### Option A: Run Directly
```bash
node webhook-server.js
```

### Option B: Run with Environment File
```bash
export $(cat .env.webhook | xargs) && node webhook-server.js
```

### Option C: Run with PM2 (Recommended for Production)
```bash
pm2 start webhook-server.js --name wowz-webhook
pm2 save
```

### Option D: Run as systemd Service

Create `/etc/systemd/system/wowz-webhook.service`:

```ini
[Unit]
Description=WOWZ Cloud API Webhook Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/wowz-cloud-api
EnvironmentFile=/root/wowz-cloud-api/.env.webhook
ExecStart=/usr/bin/node /root/wowz-cloud-api/webhook-server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable wowz-webhook
sudo systemctl start wowz-webhook
sudo systemctl status wowz-webhook
```

## 4. Configure GitHub Webhook

1. Go to your GitHub repository: `https://github.com/lovecastle/wowz-cloud-api`
2. Click **Settings** → **Webhooks** → **Add webhook**
3. Configure the webhook:

   - **Payload URL**: `http://your-server-ip:3004/webhook`
     - Example: `http://123.45.67.89:3004/webhook`
     - Or with domain: `https://api.yourserver.com/webhook`

   - **Content type**: `application/json`

   - **Secret**: Enter the same secret you configured in `.env.webhook`

   - **Which events would you like to trigger this webhook?**
     - Select "Just the push event"

   - **Active**: ✓ (checked)

4. Click **Add webhook**

## 5. Test the Webhook

### Check Server Status
```bash
curl http://localhost:3004/health
```

Expected response:
```json
{
  "status": "running",
  "port": 3003,
  "repoPath": "/root/wowz-cloud-api",
  "hasSecret": true
}
```

### Test with a Git Push
Make a small change and push to the repository:

```bash
echo "# Test" >> README.md
git add README.md
git commit -m "Test webhook"
git push origin main
```

### Check Webhook Logs
```bash
# If running directly
tail -f webhook.log

# If using systemd
sudo journalctl -u wowz-webhook -f

# If using PM2
pm2 logs wowz-webhook
```

## 6. Firewall Configuration

Make sure port 3003 is open on your firewall:

```bash
# UFW (Ubuntu)
sudo ufw allow 3004/tcp
sudo ufw reload

# iptables
sudo iptables -A INPUT -p tcp --dport 3004 -j ACCEPT
sudo iptables-save
```

## 7. Nginx Reverse Proxy (Optional)

If you want to use HTTPS or a subdomain, configure Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name webhook.yourserver.com;

    location /webhook {
        proxy_pass http://localhost:3004/webhook;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then configure SSL with Let's Encrypt:
```bash
sudo certbot --nginx -d webhook.yourserver.com
```

Update GitHub webhook URL to: `https://webhook.yourserver.com/webhook`

## Troubleshooting

### Webhook Not Triggering

1. **Check webhook server is running**:
   ```bash
   ps aux | grep webhook-server
   netstat -tulpn | grep 3004
   ```

2. **Check GitHub webhook delivery**:
   - Go to GitHub → Settings → Webhooks
   - Click on your webhook
   - Check "Recent Deliveries" tab
   - Look for error messages

3. **Check server logs**:
   ```bash
   tail -50 webhook.log
   ```

4. **Verify firewall allows connections**:
   ```bash
   sudo ufw status
   ```

### Signature Verification Failed

- Make sure the `WEBHOOK_SECRET` in `.env.webhook` matches exactly with the secret in GitHub webhook settings
- Check that you're loading the environment variables correctly

### Git Pull Fails

1. **Check repository permissions**:
   ```bash
   cd /root/wowz-cloud-api
   git status
   git pull origin main
   ```

2. **Ensure SSH keys or credentials are configured**:
   ```bash
   git config --list
   ```

3. **Check for uncommitted changes**:
   ```bash
   git stash
   ```

## Security Best Practices

1. **Use a strong webhook secret** (32+ characters, random)
2. **Use HTTPS** in production (via Nginx reverse proxy)
3. **Restrict webhook to specific IP ranges** if possible
4. **Monitor webhook logs** for suspicious activity
5. **Keep webhook secret secure** and rotate periodically

## Monitoring

### Check Webhook Server Status
```bash
# Using systemd
sudo systemctl status wowz-webhook

# Using PM2
pm2 status wowz-webhook
pm2 monit
```

### View Logs
```bash
# Real-time log monitoring
tail -f /root/wowz-cloud-api/webhook.log

# View recent webhook activity
tail -100 /root/wowz-cloud-api/webhook.log | grep "Webhook received"
```

## Maintenance

### Restart Webhook Server
```bash
# systemd
sudo systemctl restart wowz-webhook

# PM2
pm2 restart wowz-webhook
```

### Update Secret
1. Update `.env.webhook` file with new secret
2. Update GitHub webhook settings with same secret
3. Restart webhook server

## Additional Resources

- GitHub Webhooks Documentation: https://docs.github.com/en/webhooks
- Webhook Event Types: https://docs.github.com/en/webhooks/webhook-events-and-payloads
