# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js Express API server that provides a programmatic interface to Ideogram.ai's image generation and manipulation capabilities. The server uses Puppeteer with stealth mode to automate browser interactions with Ideogram.ai and exposes REST endpoints for image operations.

## Starting the Server

```bash
# Install dependencies
npm install

# Start the server (runs on port 3000)
npm start
```

## Architecture

### Core Components

**Token Management (server.js:22-86)**
- The server uses a token caching system to authenticate with Ideogram.ai
- Tokens are fetched from `https://ideogram.cryptovn.news/` via Puppeteer
- Cached tokens are refreshed automatically before expiry (5 seconds buffer)
- The `checkToken` middleware (server.js:22-42) handles token validation and refresh
- Users can optionally provide their own token via `Authorization: Bearer <token>` header

**Browser Management (server.js:62-72)**
- Uses Puppeteer with stealth plugin to avoid detection
- Configured for Linux with Chromium (`/usr/bin/chromium-browser`)
- Browser instance is shared across requests and reused
- All API operations open new pages within the shared browser instance

**Job Processing System (server.js:50-155)**
- Asynchronous background processing for long-running operations
- Job statuses: `pending`, `processing`, `completed`, `failed`, `timeout`
- Jobs are tracked in Supabase `product_design` table with these fields:
  - `job_id`: Unique job identifier
  - `job_status`: Current status
  - `job_created_at`, `job_updated_at`: Timestamps
  - `error_message`: Error details if failed
  - `remixed_designs_url`: JSON array of result image URLs
- Maximum polling timeout: 10 minutes (40 attempts × 15 seconds)

**Supabase Integration (server.js:10-13)**
- Database: Used for job tracking and metadata storage
- Storage: `product-ideas` bucket for storing generated images
- Images are uploaded as PNG with public URLs returned

### API Endpoints

**POST /api/upload** (server.js:182-228)
- Upload an image from URL to Ideogram.ai
- Returns `uploadId` for use in subsequent operations
- Images are converted to base64 before upload

**POST /api/caption** (server.js:230-270)
- Get AI-generated caption/description for an uploaded image
- Requires `uploadId` from previous upload
- Uses Ideogram's V_3_0 captioner model

**POST /api/generate-variations** (server.js:272-321)
- Generate variations of an image (async background job)
- Accepts customization options: `imageWeight`, `magicPrompt`, `style`, `prompt`
- Returns `jobId` immediately; processing happens in background
- Background processing: `processGenerateVariations` (server.js:324-514)
  - Uploads image → gets caption → generates variations → polls for results → downloads and stores images
  - Results stored in Supabase as public URLs

**POST /api/gencustom** (server.js:516-575)
- Generate custom variations with full control over parameters
- Requires pre-existing `imageId` and custom `promptText`
- Background processing: `processGenCustom` (server.js:578-728)
- Supports customization: style, resolution, sampling speed, parent weight, etc.

**POST /api/upscale** (server.js:731-826)
- Upscale an existing image response
- Requires `request_id` and `response_id` from previous generation
- Uses SUPER_RES parent type

**POST /api/removebackground** (server.js:829-866)
- Remove background from an image
- Requires `asset_id` and optionally `asset_type` (default: 'RESPONSE')

**POST /api/genimageprompt** (server.js:868-950)
- Generate images from text prompt only (no parent image)
- Full control over style, resolution, model version, etc.

**GET /api/getrequestid** (server.js:953-997)
- Poll for metadata of a generation request
- Use this to check if a generation job is complete

**GET /api/download/response/:response_id/image** (server.js:1001-1049)
- Download a specific generated image by response_id
- Supports PNG or JPEG quality parameter

**POST /api/d/images** (server.js:1052-1107)
- Batch download multiple images by image_ids
- Returns ZIP or single image depending on input

**GET /api/u** (server.js:1110-1156)
- Get all images for a user_id from Ideogram.ai
- Supports privacy and filter parameters

### Key Implementation Patterns

**Puppeteer Page Evaluation**
- Most API calls execute fetch requests inside `page.evaluate()`
- This runs code in the browser context with access to Ideogram.ai's authenticated session
- Data is serialized between Node and browser contexts

**Error Handling**
- Background jobs catch errors and update job status to 'failed'
- Errors are logged with job ID prefix for traceability
- HTTP errors include appropriate status codes

**Image Processing Flow**
1. Convert image URL to base64 (axios with arraybuffer)
2. Upload to Ideogram via FormData in browser context
3. Get upload ID for subsequent operations
4. For variations: caption → generate → poll → download → upload to Supabase storage

## Configuration

**Supabase credentials** are hardcoded in server.js:11-12 (consider moving to environment variables)

**Chrome executable path**: `/usr/bin/chromium-browser` (configured for Linux)

**Server port**: 3000 (configurable via PORT environment variable)

## Important Notes

- All `/api/*` routes require authentication (via checkToken middleware)
- The server maintains a persistent browser instance; closing it requires server restart
- Image generation operations are asynchronous; use job IDs to track progress
- The polling mechanism for job completion uses 15-second intervals up to 10 minutes
- All images uploaded to Supabase storage are public by default
