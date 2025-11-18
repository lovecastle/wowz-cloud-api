# Code Standards

## Coding Conventions & Style Guide

### JavaScript Style

**Language**: JavaScript ES6+ (Node.js >=14)

**Style Rules**:
- **Indentation**: 2 spaces (consistent across all files)
- **Semicolons**: Required at statement end
- **Quotes**: Single quotes for strings, backticks for templates
- **Naming Conventions**:
  - Variables/Functions: camelCase (`generateImage`, `jobId`, `isAuthenticated`)
  - Classes: PascalCase (`PuppeteerMidjourneyAPI`, `APIMonitor`)
  - Constants: SCREAMING_SNAKE_CASE (`SUPABASE_URL`, `COOKIES_PATH`)
  - Private/Internal: Prefix with underscore (`_privateMethod`) - not enforced
- **Line Length**: No strict limit, but prefer <120 chars
- **Async/Await**: Preferred over .then() chains

**Code Example**:
```javascript
// Good
async function generateImageViaAPI(prompt, options = {}) {
  try {
    const result = await this.page.evaluate(async (prompt, opts) => {
      const response = await fetch('/api/submit-jobs', {
        method: 'POST',
        body: JSON.stringify({ prompt, ...opts })
      });
      return await response.json();
    }, prompt, options);

    return { success: true, data: result };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Bad
function generateImageViaAPI(prompt,options)
{
    return this.page.evaluate((prompt,opts)=>{
        return fetch('/api/submit-jobs',{method:'POST',body:JSON.stringify({prompt,...opts})}).then(r=>r.json())
    },prompt,options).then(result=>{return {success:true,data:result}}).catch(err=>{console.error('Error:',err.message);return {success:false,error:err.message}})
}
```

### File Organization Patterns

**Current Structure** (Flat):
```
/
├── server.js              # Express server + orchestration
├── puppeteer-client.js    # Browser automation client
├── config.js              # Configuration
├── monitor.js             # Health monitoring
├── ecosystem.config.js    # PM2 config
└── start-production.sh    # Startup script
```

**Recommended Structure** (Modular - for future):
```
/
├── src/
│   ├── server.js          # Main entry
│   ├── api/
│   │   ├── routes/        # Express routes
│   │   ├── middlewares/   # CORS, auth, validation
│   │   └── controllers/   # Business logic
│   ├── services/
│   │   ├── midjourney-client.js
│   │   ├── supabase-service.js
│   │   └── job-poller.js
│   ├── config/
│   │   └── index.js       # Centralized config
│   └── utils/
│       └── logger.js      # Structured logging
├── scripts/
│   └── start-production.sh
└── config/
    └── ecosystem.config.js
```

### Naming Conventions

**Variables**:
- Boolean: `is*`, `has*`, `should*` (e.g., `isAuthenticated`, `hasError`)
- Arrays: Plural nouns (`cookies`, `jobs`, `requests`)
- Objects: Singular nouns (`healthStatus`, `browserData`, `client`)
- Temporary: `tmp`, `temp`, `i`, `idx` acceptable in loops

**Functions**:
- Actions: Verb-noun (`generateImage`, `uploadToSupabase`, `checkAuthStatus`)
- Getters: `get*`, `fetch*`, `extract*` (`getCookieString`, `getBrowserData`)
- Setters: `set*`, `update*`, `append*` (`setRequestInterception`, `appendGeneratedDesignUrl`)
- Validators: `is*`, `validate*`, `check*` (`checkHealth`, `validatePrompt`)
- Handlers: `handle*`, `on*` (`handleError`, `onRequest`)

**Constants**:
```javascript
// Good
const SUPABASE_URL = 'https://...';
const MAX_RETRIES = 3;
const POLLING_INTERVAL_MS = 15000;

// Bad
const supabaseUrl = 'https://...';
const maxRetries = 3;
const pollingInterval = 15000;
```

**File Names**:
- Kebab-case: `puppeteer-client.js`, `ecosystem.config.js`
- Descriptive: Avoid generic names like `utils.js`, `helpers.js`
- Test files: `*.test.js` or `*.spec.js` (if added)

### Code Quality Standards

**Complexity Limits**:
- Function length: Target <50 lines, max 100 lines
- Cyclomatic complexity: <10 branches per function
- Nesting depth: Max 3 levels

**Error Handling**:
```javascript
// Required pattern
async function riskyOperation() {
  try {
    const result = await externalCall();
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ Operation failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Response structure
{
  success: boolean,
  data?: any,
  error?: string,
  message?: string
}
```

**Logging Standards**:
```javascript
// Use emoji prefixes for visual parsing
console.log('🚀 Starting server...');
console.log('✅ Success:', data);
console.error('❌ Error:', error.message);
console.warn('⚠️ Warning:', message);
console.log('🔍 Debug:', info);
console.log('📊 Metrics:', stats);
```

**Comments**:
- Explain WHY not WHAT
- Document complex algorithms
- Add JSDoc for public APIs (currently missing)

```javascript
// Good
// Update job timestamp to prevent timeout detection by frontend
await supabaseAdmin.from('product_design').update({
  job_updated_at: new Date().toISOString()
});

// Bad
// Update timestamp
await supabaseAdmin.from('product_design').update({ job_updated_at: new Date().toISOString() });

// Best (JSDoc)
/**
 * Poll Midjourney CDN for generated images
 * @param {string} jobId - Midjourney job ID
 * @param {string} ideaId - Supabase product_design.id
 * @param {string} userId - User UUID (optional)
 * @param {number} batchSize - Number of images (1-4)
 * @returns {void} Operates via side effects (uploads to Supabase)
 */
function startPollingJob(jobId, ideaId, userId, batchSize = 4) { ... }
```

## Testing Standards

**Current State**: ❌ No tests implemented

**Recommended Framework**: Jest + Supertest

**Test Structure**:
```
tests/
├── unit/
│   ├── puppeteer-client.test.js
│   └── job-poller.test.js
├── integration/
│   ├── api-endpoints.test.js
│   └── supabase-integration.test.js
└── e2e/
    └── full-workflow.test.js
```

**Test Naming**:
```javascript
describe('PuppeteerMidjourneyAPI', () => {
  describe('generateImageViaAPI', () => {
    it('should return jobId when generation succeeds', async () => {
      // Arrange
      const client = new PuppeteerMidjourneyAPI();
      await client.initBrowser();

      // Act
      const result = await client.generateImageViaAPI('test prompt');

      // Assert
      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
    });

    it('should retry 3 times on failure', async () => { ... });
    it('should throw on invalid prompt', async () => { ... });
  });
});
```

**Coverage Targets**:
- Unit: 80%+ coverage for business logic
- Integration: All API endpoints
- E2E: Critical user flows (image gen, video gen)

## Documentation Standards

**Code Comments**:
- Public functions: JSDoc required
- Complex logic: Inline comments
- TODOs: `// TODO: Description` with issue number if tracked

**JSDoc Template**:
```javascript
/**
 * Brief description of function
 *
 * Longer description if needed. Explain business logic,
 * assumptions, side effects.
 *
 * @param {string} param1 - Description
 * @param {Object} options - Options object
 * @param {number} options.chaos - Chaos value (0-100)
 * @param {string} options.ar - Aspect ratio (e.g., "16:9")
 * @returns {Promise<Object>} Result object with success and data/error
 * @throws {Error} When authentication fails
 *
 * @example
 * const result = await client.generateImage('cat photo', { chaos: 10 });
 * if (result.success) { console.log(result.jobId); }
 */
async function generateImage(prompt, options = {}) { ... }
```

**README Requirements**:
- Installation instructions
- Quick start guide
- API documentation
- Environment setup
- Troubleshooting

**Changelog**:
- Follow Keep a Changelog format
- Semantic versioning (MAJOR.MINOR.PATCH)

## Git Conventions

**Branch Naming**:
- Feature: `feature/add-api-authentication`
- Bugfix: `fix/memory-leak-polling`
- Hotfix: `hotfix/security-supabase-key`
- Release: `release/v1.1.0`

**Commit Messages**:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples**:
```
feat(api): add API key authentication middleware

- Add API key validation middleware
- Generate keys via /admin/generate-key endpoint
- Store hashed keys in Supabase
- Update docs with authentication guide

Closes #42

---

fix(polling): prevent memory leak from unclosed jobs

Jobs Map never cleaned up after completion, causing memory growth.
Now delete from Map after max attempts or completion.

---

docs(readme): add troubleshooting section

Added common issues and solutions for cookie expiration and browser crashes.
```

**Commit Frequency**: Small, atomic commits preferred

## Security & Credentials

**Environment Variables**:
```bash
# Required in .env
NODE_ENV=production
PORT=3002
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_BUCKET=product-designs
MIDJOURNEY_PROFILE_PATH=./midjourney-profile
```

**Secrets Management**:
- ✅ Use .env files (gitignored)
- ✅ Rotate keys regularly
- ❌ Never commit secrets
- ❌ Don't log sensitive data

**Current Violations**:
```javascript
// ❌ BAD - hardcoded in server.js line 27
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

// ✅ GOOD
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

## Performance Best Practices

**Memory Management**:
```javascript
// Close resources
await page.close();
await browser.close();

// Clear large objects
jobs.delete(jobId);

// Avoid circular references
client.page = null;
client.browser = null;
```

**Async Patterns**:
```javascript
// Good - concurrent
const [auth, data, channel] = await Promise.all([
  checkAuthStatus(),
  getBrowserData(),
  extractChannelId()
]);

// Bad - sequential when unnecessary
const auth = await checkAuthStatus();
const data = await getBrowserData();
const channel = await extractChannelId();
```

**Database Queries**:
```javascript
// Use single query with filters
const { data } = await supabase
  .from('product_design')
  .select('generated_designs_url')
  .eq('id', ideaId)
  .single();

// Avoid N+1 queries in loops
```

## Code Review Checklist

Before submitting PR:
- [ ] No hardcoded credentials
- [ ] Error handling on all async functions
- [ ] Logging for debugging
- [ ] Input validation
- [ ] Resource cleanup (browser, timers)
- [ ] Update documentation
- [ ] Add/update tests
- [ ] Check for memory leaks
- [ ] Verify PM2 compatibility

## Deprecation Policy

**Marking Deprecated**:
```javascript
/**
 * @deprecated Use generateImageViaAPI instead
 * @see {@link generateImageViaAPI}
 */
async function generateImageRealistic(prompt) {
  console.warn('⚠️ generateImageRealistic is deprecated');
  return this.generateImageViaAPI(prompt);
}
```

**Removal Timeline**:
- Mark deprecated: Version N
- Warn in logs: Version N+1
- Remove: Version N+2 (after 6 months)

## Open Questions

1. **TypeScript migration?** Would improve type safety and IDE support
2. **Linting setup?** ESLint + Prettier not configured
3. **Pre-commit hooks?** Husky for automated checks
4. **CI/CD pipeline?** GitHub Actions for testing/deployment
5. **Monorepo structure?** If expanding to multiple services
