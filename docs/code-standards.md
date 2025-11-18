# Code Standards & Development Guidelines

**Last Updated**: 2025-11-18
**Applies To**: All services in WOWZ Cloud API Platform

## Overview

This document defines coding standards, conventions, and best practices for the WOWZ Cloud API Platform. All contributors must follow these guidelines to ensure consistency, maintainability, and code quality across the multi-service architecture.

## Core Principles

### YAGNI (You Aren't Gonna Need It)
- Implement only what's needed now
- Avoid premature optimization
- Don't build features for hypothetical future needs
- Keep implementations focused on current requirements

### KISS (Keep It Simple, Stupid)
- Favor simple solutions over complex ones
- Reduce cognitive load for code readers
- Avoid unnecessary abstractions
- Write straightforward, readable code

### DRY (Don't Repeat Yourself)
- Extract common patterns into shared modules
- Avoid code duplication
- Create utility functions for repeated logic
- Share configurations across services when possible

## File Naming Conventions

### General Rules

**Use kebab-case for all files**:
✅ **Good**:
- `user-authentication-service.js`
- `image-upload-handler.js`
- `supabase-storage-client.js`
- `job-polling-worker.js`

❌ **Bad**:
- `UserAuthenticationService.js` (PascalCase)
- `image_upload_handler.js` (snake_case)
- `imageUploadHandler.js` (camelCase)

### Descriptive Naming

**File names should be self-documenting**:
- Use meaningful names that describe purpose
- Length is acceptable if it improves clarity
- Enable LLM tools (Grep, Glob) to understand file purpose without reading content

✅ **Good Examples**:
- `midjourney-image-generation-api.js` - Clear what this does
- `ideogram-token-refresh-middleware.js` - Specific purpose
- `supabase-job-status-updater.js` - Explicit functionality

❌ **Bad Examples**:
- `api.js` - Too generic
- `utils.js` - Not specific
- `handler.js` - Unclear purpose
- `client.js` - What client?

### File Type Conventions

**Server Files**: `{service}-server.js`
- `midjourney-server.js`
- `ideogram-server.js`

**API Wrappers**: `{service}-api-client.js`
- `midjourney-api-client.js`
- `chatgpt-api-client.js`

**Middleware**: `{purpose}-middleware.js`
- `authentication-middleware.js`
- `token-validation-middleware.js`

**Utilities**: `{domain}-utilities.js`
- `image-processing-utilities.js`
- `prompt-sanitization-utilities.js`

**Configuration**: `{service}-config.js`
- `server-config.js`
- `database-config.js`

## File Size Management

### Size Limit: 200 Lines Per File

**Rationale**:
- Optimal context management for AI tools
- Easier code review
- Better testability
- Improved maintainability

### Modularization Strategy

**When file exceeds 200 lines**:

1. **Extract Utility Functions**
```javascript
// Before: server.js (800 lines)
function sanitizePrompt(text) { /* ... */ }
function validateRequest(req) { /* ... */ }
function formatResponse(data) { /* ... */ }

// After: Extract to utilities
// prompt-sanitization-utils.js
export function sanitizePrompt(text) { /* ... */ }

// request-validation-utils.js
export function validateRequest(req) { /* ... */ }

// response-formatting-utils.js
export function formatResponse(data) { /* ... */ }
```

2. **Split by Concern**
```javascript
// Before: server.js (1000 lines)
// - Express setup
// - Route handlers
// - Database functions
// - Storage functions
// - Job polling logic

// After: Split into modules
// server.js (< 200 lines) - Express setup, route registration
// route-handlers.js - All route logic
// database-operations.js - DB queries
// storage-operations.js - Supabase storage
// job-polling-service.js - Background jobs
```

3. **Create Service Classes**
```javascript
// Instead of procedural code in server.js
class JobPollingService {
  constructor() { /* ... */ }
  startPolling(jobId) { /* ... */ }
  stopPolling(jobId) { /* ... */ }
  checkStatus(jobId) { /* ... */ }
}

// job-polling-service.js
export default JobPollingService;
```

4. **Use Composition Over Inheritance**
```javascript
// Good: Compose smaller modules
import { uploadImage } from './image-upload-handler.js';
import { generateCaption } from './caption-generator.js';
import { pollResults } from './result-polling-service.js';

async function processRemix(imageUrl) {
  const uploadId = await uploadImage(imageUrl);
  const caption = await generateCaption(uploadId);
  const results = await pollResults(uploadId);
  return results;
}
```

## Code Organization

### Directory Structure

**Service-Level Organization**:
```
service-name/
├── src/                          # Source code
│   ├── api/                      # API route handlers
│   │   ├── image-generation-routes.js
│   │   ├── job-status-routes.js
│   │   └── health-check-routes.js
│   ├── services/                 # Business logic
│   │   ├── authentication-service.js
│   │   ├── job-polling-service.js
│   │   └── storage-service.js
│   ├── middleware/               # Express middleware
│   │   ├── authentication-middleware.js
│   │   ├── error-handler-middleware.js
│   │   └── request-validator-middleware.js
│   ├── utils/                    # Utility functions
│   │   ├── image-processing-utils.js
│   │   ├── prompt-sanitization-utils.js
│   │   └── response-formatting-utils.js
│   ├── config/                   # Configuration
│   │   ├── server-config.js
│   │   ├── database-config.js
│   │   └── environment-config.js
│   └── server.js                 # Entry point
├── tests/                        # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/                         # Documentation
├── profile/                      # Browser profile
├── logs/                         # Log files
├── .env.example                  # Environment template
├── package.json
└── README.md
```

### Module Exports

**Use ES6 Modules**:
```javascript
// Good: Named exports
export function sanitizePrompt(text) { /* ... */ }
export function validatePrompt(text) { /* ... */ }

// Good: Default export for classes
export default class ImageService { /* ... */ }

// Import
import { sanitizePrompt, validatePrompt } from './utils.js';
import ImageService from './services/image-service.js';
```

**Avoid CommonJS** (when possible):
```javascript
// Avoid
const express = require('express');
module.exports = { sanitizePrompt };

// Prefer
import express from 'express';
export { sanitizePrompt };
```

## Error Handling Patterns

### Try-Catch Blocks

**Always use try-catch for async operations**:

```javascript
// Good: Comprehensive error handling
async function uploadImage(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Failed to download image from ${imageUrl}:`, error.message);
    throw new Error(`Image download failed: ${error.message}`);
  }
}
```

**Handle specific error types**:

```javascript
async function updateDatabase(jobId, status) {
  try {
    const { error } = await supabase
      .from('product_design')
      .update({ job_status: status })
      .eq('job_id', jobId);

    if (error) {
      throw new Error(`Database update failed: ${error.message}`);
    }
  } catch (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      console.warn(`Job ${jobId} not found in database`);
    } else {
      // Other errors
      console.error(`Database error:`, error);
      throw error;
    }
  }
}
```

### Error Response Format

**Consistent error responses**:

```javascript
// Good: Standard error format
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(err.status || 500).json({
    error: {
      message: err.message,
      status: err.status || 500,
      timestamp: new Date().toISOString(),
      path: req.path
    }
  });
});
```

### Validation Errors

```javascript
function validateRequest(req) {
  const errors = [];

  if (!req.body.imageUrl) {
    errors.push({ field: 'imageUrl', message: 'Image URL is required' });
  }

  if (!req.body.ideaId) {
    errors.push({ field: 'ideaId', message: 'Idea ID is required' });
  }

  if (errors.length > 0) {
    const error = new Error('Validation failed');
    error.status = 400;
    error.details = errors;
    throw error;
  }
}
```

## Security Best Practices

### Environment Variables

**Never hardcode credentials**:

```javascript
// Bad: Hardcoded credentials
const supabaseUrl = 'https://xxx.supabase.co';
const supabaseKey = 'eyJhbGci...';

// Good: Environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required environment variables');
}
```

**Use .env files**:

```bash
# .env.example
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_BUCKET=product-designs
NODE_ENV=development
```

```javascript
// Load environment variables
import dotenv from 'dotenv';
dotenv.config();
```

### Input Validation

**Sanitize all user inputs**:

```javascript
function sanitizePrompt(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid prompt: must be a non-empty string');
  }

  // Remove smart quotes
  text = text.replace(/[\u201C\u201D]/g, '"');
  text = text.replace(/[\u2018\u2019]/g, "'");

  // Remove backslashes and backticks
  text = text.replace(/\\/g, '');
  text = text.replace(/`/g, "'");

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Length check
  if (text.length > 2000) {
    throw new Error('Prompt exceeds maximum length of 2000 characters');
  }

  return text;
}
```

### API Authentication

**Implement API key middleware**:

```javascript
function apiKeyMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
}

// Apply to routes
app.use('/api', apiKeyMiddleware);
```

### Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests, please try again later'
});

app.use('/api', limiter);
```

### CORS Configuration

```javascript
// Bad: Open CORS
app.use(cors());

// Good: Restricted CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));
```

## Testing Standards

### Unit Tests

**Test coverage requirements**:
- Minimum 70% code coverage
- All utility functions must have tests
- Critical business logic requires 90%+ coverage

**Test structure**:

```javascript
// image-processing-utils.test.js
import { describe, it, expect } from 'vitest';
import { sanitizePrompt, validateImageUrl } from './image-processing-utils.js';

describe('Image Processing Utils', () => {
  describe('sanitizePrompt', () => {
    it('should remove smart quotes', () => {
      const input = '"Hello" 'World'';
      const expected = '"Hello" \'World\'';
      expect(sanitizePrompt(input)).toBe(expected);
    });

    it('should throw on empty string', () => {
      expect(() => sanitizePrompt('')).toThrow('Invalid prompt');
    });

    it('should normalize whitespace', () => {
      const input = 'Hello    World';
      const expected = 'Hello World';
      expect(sanitizePrompt(input)).toBe(expected);
    });
  });
});
```

### Integration Tests

```javascript
// api-endpoints.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('API Endpoints', () => {
  describe('POST /api/remix', () => {
    it('should return job ID for valid request', async () => {
      const response = await request(app)
        .post('/api/remix')
        .send({
          imageUrl: 'https://example.com/image.jpg',
          imageWeight: 70
        })
        .expect(200);

      expect(response.body).toHaveProperty('jobId');
      expect(response.body.success).toBe(true);
    });

    it('should reject request without imageUrl', async () => {
      const response = await request(app)
        .post('/api/remix')
        .send({ imageWeight: 70 })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });
});
```

## Documentation Standards

### Code Comments

**When to comment**:
- Complex algorithms
- Non-obvious business logic
- Workarounds for platform quirks
- API limitations

**When NOT to comment**:
- Self-explanatory code
- Obvious variable names
- Standard patterns

```javascript
// Bad: Unnecessary comment
// Increment counter
counter++;

// Good: Explains non-obvious logic
// Polling interval must be 15s to avoid Ideogram rate limits
const POLLING_INTERVAL = 15000;

// Good: Documents workaround
// Midjourney CDN requires exact timestamp format (YYYYMMDD_HHmmss)
// Standard ISO format is not supported
const timestamp = formatCDNTimestamp(date);
```

### Function Documentation

**Use JSDoc for public APIs**:

```javascript
/**
 * Upload an image to Supabase storage bucket
 *
 * @param {string} ideaId - Product design idea UUID
 * @param {number} index - Image index in batch (0-3)
 * @param {Buffer} buffer - Image data as Buffer
 * @param {string} contentType - MIME type (default: 'image/png')
 * @returns {Promise<string>} Public URL of uploaded image
 * @throws {Error} If upload fails or Supabase client not configured
 */
async function uploadToSupabase(ideaId, index, buffer, contentType = 'image/png') {
  // Implementation
}
```

### README Requirements

**Every service must have**:
- Quick start guide
- Installation instructions
- API endpoint documentation
- Configuration guide
- Troubleshooting section

## Git Workflow

### Commit Messages

**Use Conventional Commits**:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build/tooling changes

**Examples**:
```
feat(midjourney): add video generation endpoint

- Implement /midjourney/genvideo route
- Add video parameter validation
- Update documentation

fix(ideogram): correct token refresh timing

The token was expiring 5 seconds before refresh,
causing occasional 401 errors. Increased buffer to 10s.

docs(readme): update installation instructions
```

### Branch Naming

```
<type>/<description>

Examples:
- feature/api-authentication
- fix/memory-leak-polling
- refactor/split-server-file
- docs/api-documentation
```

### Pre-Commit Rules

**Before committing**:
1. Run linting: `npm run lint`
2. Run tests: `npm test`
3. Check for console.logs (remove debug logs)
4. Verify no .env files staged
5. Update documentation if API changed

**Before pushing**:
1. All tests must pass
2. No failed linting
3. No confidential information in commit

### What NOT to Commit

❌ **Never commit**:
- `.env` files
- `node_modules/`
- Browser profile directories
- Log files
- API keys or credentials
- Cookie files
- Temporary files

✅ **Always commit**:
- `.env.example` (template)
- Source code
- Documentation
- Configuration templates
- Test files

## Code Quality Guidelines

### Linting

**ESLint configuration** (recommended):

```json
{
  "extends": ["eslint:recommended"],
  "env": {
    "node": true,
    "es2021": true
  },
  "parserOptions": {
    "ecmaVersion": 2021,
    "sourceType": "module"
  },
  "rules": {
    "no-console": "off",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

**Don't be too strict**:
- Prioritize functionality over style
- Focus on syntax errors, not formatting
- Use Prettier for formatting
- Linting should enhance productivity, not hinder it

### Code Review Checklist

**Before requesting review**:
- [ ] Code follows naming conventions
- [ ] Files are under 200 lines (or modularized)
- [ ] Error handling implemented
- [ ] Input validation added
- [ ] No hardcoded credentials
- [ ] Comments added for complex logic
- [ ] Tests written and passing
- [ ] Documentation updated

**Reviewer should check**:
- [ ] Business logic correctness
- [ ] Security vulnerabilities
- [ ] Performance implications
- [ ] Error handling coverage
- [ ] Test adequacy
- [ ] Code readability

## Performance Best Practices

### Async/Await

**Always use async/await for async operations**:

```javascript
// Good
async function processJob(jobId) {
  const job = await getJob(jobId);
  const result = await generateImage(job.prompt);
  await saveResult(jobId, result);
}

// Avoid: Promise chains (harder to read)
function processJob(jobId) {
  return getJob(jobId)
    .then(job => generateImage(job.prompt))
    .then(result => saveResult(jobId, result));
}
```

### Memory Management

```javascript
// Good: Close resources
async function processWithBrowser() {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    // Do work
  } finally {
    await browser.close(); // Always close
  }
}

// Good: Limit concurrent operations
const MAX_CONCURRENT = 5;
const queue = [];

async function processQueue() {
  const batch = queue.splice(0, MAX_CONCURRENT);
  await Promise.all(batch.map(job => processJob(job)));
}
```

### Database Queries

```javascript
// Good: Select only needed columns
const { data } = await supabase
  .from('product_design')
  .select('id, job_status, generated_designs_url')
  .eq('job_id', jobId)
  .single();

// Bad: Select all columns
const { data } = await supabase
  .from('product_design')
  .select('*')
  .eq('job_id', jobId);
```

## Logging Standards

### Log Levels

```javascript
// Error: Application errors
console.error('[ERROR]', 'Failed to upload image:', error);

// Warn: Warnings that need attention
console.warn('[WARN]', 'Token expires in 30 seconds');

// Info: Important events
console.log('[INFO]', 'Job completed:', jobId);

// Debug: Development debugging (remove before production)
console.debug('[DEBUG]', 'Request body:', req.body);
```

### Structured Logging

```javascript
// Good: Structured with context
function log(level, message, context = {}) {
  console.log(JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context
  }));
}

log('INFO', 'Job started', { jobId: 'job-123', service: 'midjourney' });

// Output:
// {"level":"INFO","message":"Job started","timestamp":"2025-11-18T...","jobId":"job-123","service":"midjourney"}
```

## Deployment Standards

### Environment Configuration

**Separate environments**:
- Development: `.env.development`
- Staging: `.env.staging`
- Production: `.env.production`

**Never deploy with**:
- Debug logging enabled
- Open CORS policy
- Hardcoded credentials
- Test data

### Health Checks

**Every service must have**:

```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'midjourney-api',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});
```

## Migration Path

### Current → Standardized

**Phase 1: Immediate fixes**:
1. Move all credentials to .env files
2. Add input validation to all endpoints
3. Implement basic error handling

**Phase 2: Refactoring**:
1. Split files over 200 lines
2. Rename files to kebab-case
3. Extract utilities and services

**Phase 3: Testing**:
1. Add unit tests for utilities
2. Add integration tests for APIs
3. Achieve 70% coverage

**Phase 4: TypeScript** (future):
1. Add TypeScript to new files
2. Gradually migrate existing files
3. Enable strict mode

---

**Compliance**: All new code must follow these standards
**Exceptions**: Must be documented with justification
**Review Cycle**: Quarterly review and updates
**Feedback**: Submit improvements via pull requests

