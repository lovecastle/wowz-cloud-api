const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.WEBHOOK_PORT || 3004;
const SECRET = process.env.WEBHOOK_SECRET || '';
const REPO_PATH = process.env.REPO_PATH || __dirname;
const USE_SSL = process.env.USE_SSL === 'true';
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || '';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || '';
const DISABLE_SIGNATURE_VERIFICATION = process.env.DISABLE_SIGNATURE_VERIFICATION === 'true';

// Middleware to parse JSON
app.use(express.json());

// Logging function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());

  // Append to log file
  const logFile = path.join(__dirname, 'webhook.log');
  fs.appendFileSync(logFile, logMessage);
}

// Verify GitHub webhook signature
function verifySignature(req) {
  // Allow bypassing signature verification for testing (NOT RECOMMENDED for production)
  if (DISABLE_SIGNATURE_VERIFICATION) {
    log('WARNING: Signature verification is DISABLED');
    return true;
  }

  if (!SECRET) {
    log('WARNING: No webhook secret configured - accepting all requests');
    return true;
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    log('ERROR: No signature in request');
    return false;
  }

  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

  const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  log(`Signature verification: ${isValid ? 'PASSED' : 'FAILED'}`);

  return isValid;
}

// Execute git pull
function gitPull(callback) {
  log('Executing git pull...');

  exec(`cd ${REPO_PATH} && git pull origin main`, (error, stdout, stderr) => {
    if (error) {
      log(`ERROR: Git pull failed - ${error.message}`);
      return callback(error, null);
    }

    if (stderr) {
      log(`Git stderr: ${stderr}`);
    }

    log(`Git pull output: ${stdout}`);
    callback(null, stdout);
  });
}

// Webhook endpoint
app.post('/webhook', (req, res) => {
  log('=== Webhook received ===');

  // Verify signature
  if (!verifySignature(req)) {
    log('ERROR: Signature verification failed');
    return res.status(401).send('Unauthorized');
  }

  const event = req.headers['x-github-event'];
  log(`Event type: ${event}`);

  // Only handle push events
  if (event !== 'push') {
    log(`Ignoring ${event} event`);
    return res.status(200).send(`Event ${event} ignored`);
  }

  const payload = req.body;
  const branch = payload.ref?.split('/').pop();
  const commits = payload.commits?.length || 0;
  const pusher = payload.pusher?.name || 'unknown';

  log(`Push to branch: ${branch}`);
  log(`Commits: ${commits}`);
  log(`Pusher: ${pusher}`);

  // Only pull for main branch
  if (branch !== 'main') {
    log(`Ignoring push to ${branch} branch`);
    return res.status(200).send(`Branch ${branch} ignored`);
  }

  // Execute git pull
  gitPull((error, stdout) => {
    if (error) {
      log('ERROR: Failed to update repository');
      return res.status(500).send('Internal server error');
    }

    log('=== Repository updated successfully ===');
    res.status(200).send('Repository updated');
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'running',
    port: PORT,
    repoPath: REPO_PATH,
    hasSecret: !!SECRET,
    ssl: USE_SSL,
    signatureVerification: !DISABLE_SIGNATURE_VERIFICATION
  });
});

// Start server (HTTP or HTTPS)
function startServer() {
  if (USE_SSL) {
    // HTTPS server
    if (!SSL_KEY_PATH || !SSL_CERT_PATH) {
      log('ERROR: SSL enabled but SSL_KEY_PATH or SSL_CERT_PATH not configured');
      process.exit(1);
    }

    if (!fs.existsSync(SSL_KEY_PATH)) {
      log(`ERROR: SSL key file not found: ${SSL_KEY_PATH}`);
      process.exit(1);
    }

    if (!fs.existsSync(SSL_CERT_PATH)) {
      log(`ERROR: SSL certificate file not found: ${SSL_CERT_PATH}`);
      process.exit(1);
    }

    const sslOptions = {
      key: fs.readFileSync(SSL_KEY_PATH),
      cert: fs.readFileSync(SSL_CERT_PATH)
    };

    https.createServer(sslOptions, app).listen(PORT, () => {
      log(`=== Webhook server started (HTTPS) ===`);
      log(`Port: ${PORT}`);
      log(`Repository: ${REPO_PATH}`);
      log(`Secret configured: ${!!SECRET}`);
      log(`SSL Certificate: ${SSL_CERT_PATH}`);
      log(`Signature verification: ${!DISABLE_SIGNATURE_VERIFICATION ? 'ENABLED' : 'DISABLED'}`);
    });
  } else {
    // HTTP server
    http.createServer(app).listen(PORT, () => {
      log(`=== Webhook server started (HTTP) ===`);
      log(`Port: ${PORT}`);
      log(`Repository: ${REPO_PATH}`);
      log(`Secret configured: ${!!SECRET}`);
      log(`Signature verification: ${!DISABLE_SIGNATURE_VERIFICATION ? 'ENABLED' : 'DISABLED'}`);
      log(`WARNING: Running without SSL - use reverse proxy or enable SSL for production`);
    });
  }
}

startServer();
