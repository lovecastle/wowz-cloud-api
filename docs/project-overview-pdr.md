# Project Overview & Product Development Requirements (PDR)

## Project Information

**Project Name**: WOWZ Cloud API Platform
**Version**: 1.0.0
**Last Updated**: 2025-11-18
**Status**: Active Development

## Executive Summary

WOWZ Cloud API Platform is a comprehensive multi-service REST API infrastructure that provides programmatic access to multiple AI-powered image generation and manipulation platforms. The platform serves as a unified backend for AI-assisted design tools, specifically targeting product design, content creation, and creative workflows.

## Purpose & Vision

### Primary Purpose
Provide developers with a unified, production-ready API gateway to multiple AI image generation services (Midjourney, Ideogram, ChatGPT, Clipdrop) through browser automation and REST endpoints.

### Vision
Become the de-facto backend infrastructure for AI-assisted creative workflows, enabling applications to seamlessly integrate multiple AI services without managing complex authentication, browser automation, or job polling logic.

### Problem Statement
- AI platforms like Midjourney, Ideogram require manual browser interaction or complex Discord bot integration
- No unified API exists across multiple AI image generation platforms
- Session management, cookie authentication, and async job polling are implementation barriers
- Developers need production-ready infrastructure with database persistence and storage integration

## Services Overview

### 1. Midjourney Service (`/root/wowz-cloud-api/midjourney/`)
**Port**: 3002
**Status**: Production-ready with comprehensive documentation

**Capabilities**:
- Text-to-image generation with full parameter control
- Image-to-video conversion
- Reference image support
- Async job polling with Supabase integration
- Automatic CDN download and storage upload
- PM2 process management for production

**Key Features**:
- Cookie-based authentication with Midjourney platform
- Puppeteer browser automation with stealth mode
- Background job processing with 15-second polling
- Automatic image upload to Supabase storage
- Database mode (with tracking) and standalone mode (without tracking)
- Health monitoring and auto-restart capabilities

**Technology Stack**:
- Express.js REST API
- Puppeteer for browser automation
- Supabase for storage and database
- PM2 for process management

### 2. Ideogram Service (`/root/wowz-cloud-api/ideogram/`)
**Port**: 3000
**Status**: Production-ready with N8N integration

**Capabilities**:
- Image upload and caption generation
- Image variation generation with style control
- Custom image generation with full parameter control
- Image upscaling (super resolution)
- Background removal
- Text-to-image generation
- Unified `/api/remix` endpoint for N8N workflows

**Key Features**:
- Token-based authentication with auto-refresh
- Async job processing with 15-second polling intervals
- Supabase integration for job tracking and storage
- Specialized N8N workflow support
- Image weight and style customization

**Technology Stack**:
- Express.js REST API
- Puppeteer with stealth plugin
- Supabase for job management
- Axios for HTTP requests

### 3. ChatGPT Service (`/root/wowz-cloud-api/chatgpt/`)
**Port**: Not explicitly defined
**Status**: In development

**Capabilities**:
- Custom GPT integration (WOWZ AI Assistant Remix Design)
- Image upload and processing through ChatGPT
- Browser automation with persistent profile

**Key Features**:
- Profile-based authentication
- Shared browser instance for efficiency
- Image to base64 conversion
- Auto-reconnect on browser disconnect

**Technology Stack**:
- Express.js
- Puppeteer with stealth plugin
- Chromium browser automation

### 4. Clipdrop Service (`/root/wowz-cloud-api/clipdrop/`)
**Port**: Not defined
**Status**: Minimal implementation (profile directory only)

**Current State**: Only browser profile directory exists, no implementation yet.

## Target Users & Use Cases

### Primary Users
1. **SaaS Application Developers**: Building AI-powered design tools
2. **Product Design Teams**: Automating design variation generation
3. **Content Creators**: Batch processing creative assets
4. **E-commerce Platforms**: Generating product design variations
5. **Marketing Agencies**: Creating campaign visual assets

### Key Use Cases

#### 1. Product Design Automation
- Upload base design image
- Generate multiple variations with different styles
- Store results in Supabase for frontend access
- Track job status through database

#### 2. T-Shirt Design Remixing (Primary Use Case)
- Upload t-shirt design via Ideogram `/api/remix`
- Apply style transformations (DESIGN, AUTO, etc.)
- Control image weight for variation degree
- Retrieve results through job polling

#### 3. Bulk Asset Generation
- Submit multiple generation jobs
- Poll job status via background processing
- Download completed assets from CDN
- Upload to Supabase storage bucket

#### 4. N8N Workflow Integration
- Webhook receives design request
- Call Ideogram `/api/remix` endpoint
- Automated polling until completion
- Return results to calling application

## Product Requirements

### Functional Requirements

#### FR-1: Image Generation
- **FR-1.1**: Support text-to-image generation with customizable parameters
- **FR-1.2**: Support image-to-image variations
- **FR-1.3**: Support reference image uploads
- **FR-1.4**: Return job IDs for async tracking

#### FR-2: Job Management
- **FR-2.1**: Background job processing without blocking API responses
- **FR-2.2**: Job status tracking (pending, processing, completed, failed, timeout)
- **FR-2.3**: Automatic polling with configurable intervals
- **FR-2.4**: Maximum timeout handling (10 minutes for Ideogram, variable for Midjourney)

#### FR-3: Storage Integration
- **FR-3.1**: Automatic upload of generated images to Supabase storage
- **FR-3.2**: Public URL generation for stored assets
- **FR-3.3**: Database persistence of job metadata and results
- **FR-3.4**: Support for both database mode and standalone mode

#### FR-4: Authentication
- **FR-4.1**: Cookie-based authentication for Midjourney
- **FR-4.2**: Token-based authentication for Ideogram with auto-refresh
- **FR-4.3**: Profile-based authentication for ChatGPT
- **FR-4.4**: Optional user-provided tokens via Authorization header

#### FR-5: API Endpoints
- **FR-5.1**: RESTful endpoint design
- **FR-5.2**: JSON request/response format
- **FR-5.3**: CORS support for cross-origin requests
- **FR-5.4**: Unified endpoints for simplified integration (e.g., `/api/remix`)

### Non-Functional Requirements

#### NFR-1: Performance
- **NFR-1.1**: API response time < 1 second
- **NFR-1.2**: Image generation completion within 30s-2min (Midjourney)
- **NFR-1.3**: Image generation completion within 40-100s (Ideogram)
- **NFR-1.4**: Support 10-20 concurrent jobs (512MB RAM)

#### NFR-2: Reliability
- **NFR-2.1**: Success rate > 95% with valid authentication
- **NFR-2.2**: Auto-restart on failures (PM2 for Midjourney)
- **NFR-2.3**: Graceful handling of browser crashes
- **NFR-2.4**: Reconnection logic for disconnected browsers

#### NFR-3: Scalability
- **NFR-3.1**: Horizontal scaling support (future)
- **NFR-3.2**: Multi-account support for rate limit distribution (future)
- **NFR-3.3**: Efficient memory usage (150MB baseline, 450MB peak for Midjourney)

#### NFR-4: Security
- **NFR-4.1**: Environment variable configuration for credentials
- **NFR-4.2**: API key authentication (recommended for production)
- **NFR-4.3**: CORS policy restrictions
- **NFR-4.4**: Rate limiting implementation
- **NFR-4.5**: No hardcoded credentials in source code

#### NFR-5: Maintainability
- **NFR-5.1**: Comprehensive logging for debugging
- **NFR-5.2**: Health check endpoints
- **NFR-5.3**: Clear error messages
- **NFR-5.4**: Documentation for all endpoints

## Success Metrics

### Technical Metrics
- **API Uptime**: > 99% availability
- **Response Time**: < 1s for synchronous endpoints
- **Success Rate**: > 95% for image generation jobs
- **Error Rate**: < 5% for valid requests
- **Job Completion Time**: 30s-2min for Midjourney, 40-100s for Ideogram

### Business Metrics
- **Total Requests**: Track daily/monthly request volume
- **Active Users**: Number of unique API consumers
- **Storage Usage**: Total Supabase storage consumed
- **Cost Efficiency**: Cost per 1000 requests

### Operational Metrics
- **Memory Usage**: Stay within 512MB per service instance
- **Browser Crash Rate**: < 1% of sessions
- **Session Expiration Rate**: Track authentication failures
- **Storage Upload Success**: > 98% success rate

## Technology Stack Overview

### Backend Framework
- **Express.js**: REST API server framework
- **Node.js**: Runtime environment (v14+)

### Browser Automation
- **Puppeteer**: Headless Chrome/Chromium control
- **puppeteer-extra**: Plugin system for stealth mode
- **puppeteer-extra-plugin-stealth**: Anti-detection mechanisms

### Database & Storage
- **Supabase**: PostgreSQL database and object storage
- **PostgreSQL**: Relational database for job tracking
- **Supabase Storage**: Public object storage for images

### Process Management
- **PM2**: Production process manager (Midjourney)
- **Ecosystem Config**: Process configuration and monitoring

### HTTP & Utilities
- **Axios**: HTTP client for image downloads
- **CORS**: Cross-origin resource sharing middleware
- **body-parser**: Request body parsing
- **dotenv**: Environment variable management

### Development Tools
- **Claude Code**: AI-assisted development
- **Git**: Version control
- **Markdown**: Documentation format

## Current Limitations

### Service-Specific Limitations

#### Midjourney
- Single instance only (Puppeteer profile lock)
- Manual cookie refresh required
- No TypeScript (plain JavaScript)
- Missing unit/integration tests
- Hardcoded Supabase credentials in some places

#### Ideogram
- Hardcoded Supabase credentials
- No API authentication mechanism
- Open CORS policy (security risk)
- No rate limiting
- Token refresh depends on external service

#### ChatGPT
- Incomplete implementation
- No production deployment configuration
- Limited documentation
- No job tracking integration

#### Clipdrop
- Not implemented (only profile directory exists)
- No design or requirements defined

### Platform-Wide Limitations
- No unified authentication layer
- Each service runs on different port
- No API gateway or reverse proxy configuration
- No centralized logging
- No monitoring/alerting system
- No Docker deployment
- No CI/CD pipeline
- Limited error handling standardization

## Roadmap & Future Development

### Phase 1: Foundation (Current)
- ✅ Midjourney service with full functionality
- ✅ Ideogram service with N8N integration
- ✅ Basic ChatGPT integration
- ⏳ Comprehensive documentation

### Phase 2: Security & Production Readiness
- Environment variable configuration for all services
- API key authentication middleware
- Rate limiting implementation
- CORS policy restrictions
- Remove all hardcoded credentials
- TypeScript migration

### Phase 3: Testing & Quality
- Unit test coverage
- Integration tests
- End-to-end testing
- Performance testing
- Load testing

### Phase 4: Advanced Features
- Unified API gateway
- WebSocket support for real-time updates
- Multi-account support for horizontal scaling
- Admin dashboard for monitoring
- Centralized logging and monitoring
- Docker containerization

### Phase 5: Clipdrop Implementation
- Complete Clipdrop service implementation
- Define API endpoints
- Integrate with Supabase
- Add to unified platform

## Dependencies & Integrations

### External Services
- **Midjourney.com**: AI image generation platform
- **Ideogram.ai**: AI image generation and manipulation
- **ChatGPT**: OpenAI's conversational AI
- **Supabase**: Backend-as-a-Service (database + storage)
- **Chromium**: Browser for automation

### Required Accounts
- Midjourney subscription (for cookie authentication)
- Ideogram account (token via cryptovn.news)
- ChatGPT Plus (for custom GPT access)
- Supabase account (free tier sufficient for development)

### Infrastructure Requirements
- Linux server (for /usr/bin/chromium-browser)
- Node.js v14 or higher
- Minimum 512MB RAM per service
- Storage for browser profiles (~100MB per service)
- Network access to AI platforms

## Risk Assessment

### Technical Risks
- **Browser Detection**: AI platforms may detect and block automation
  - *Mitigation*: Stealth plugin, regular cookie refresh
- **Session Expiration**: Authentication tokens/cookies expire
  - *Mitigation*: Auto-refresh mechanisms, health checks
- **Rate Limiting**: AI platforms may throttle requests
  - *Mitigation*: Multi-account support (future), request queuing
- **Memory Leaks**: Puppeteer instances may leak memory
  - *Mitigation*: PM2 max_memory_restart, cron restarts

### Business Risks
- **Platform ToS Violations**: Automation may violate terms of service
  - *Mitigation*: User responsibility disclaimer, proper usage guidelines
- **Dependency on External Services**: Platform changes break integration
  - *Mitigation*: Monitoring, quick response to changes, fallback mechanisms
- **Cost Scaling**: Supabase storage/database costs increase with usage
  - *Mitigation*: Usage monitoring, cleanup policies, cost alerts

### Security Risks
- **Exposed Credentials**: Hardcoded credentials in codebase
  - *Mitigation*: Environment variables, .env file exclusion
- **No API Authentication**: Open endpoints vulnerable to abuse
  - *Mitigation*: Implement API key authentication
- **CORS Wide Open**: Cross-origin attacks possible
  - *Mitigation*: Restrict CORS to specific origins

## Acceptance Criteria

### Service Deployment
- ✅ Each service can start successfully
- ✅ Health check endpoints return valid status
- ✅ Browser automation connects to target platforms
- ✅ Authentication mechanisms work correctly

### API Functionality
- ✅ Image generation endpoints accept valid requests
- ✅ Job tracking returns accurate status
- ✅ Async processing completes within expected timeframe
- ✅ Error responses include meaningful messages

### Storage Integration
- ✅ Generated images upload to Supabase
- ✅ Public URLs are accessible
- ✅ Database records persist job metadata
- ✅ File naming conventions are consistent

### Production Readiness
- ⏳ Environment variables configured (not fully implemented)
- ⏳ No hardcoded credentials (partially implemented)
- ✅ PM2 configuration for Midjourney
- ⏳ Monitoring and logging (basic implementation)

## Conclusion

WOWZ Cloud API Platform provides a robust foundation for AI-powered image generation workflows. The current implementation focuses on Midjourney and Ideogram services with production-ready features including async job processing, Supabase integration, and browser automation.

The platform successfully serves its primary use case of product design automation while maintaining a clear roadmap for security enhancements, testing, and additional service integrations.

**Next Steps**: Implement security best practices (Phase 2), complete test coverage (Phase 3), and build unified API gateway (Phase 4).

---

**Document Owner**: WOWZ Development Team
**Review Cycle**: Monthly
**Last Review**: 2025-11-18
