# Technology Stack

**Analysis Date:** 2026-03-29

## Languages

**Primary:**
- TypeScript ESNext - Backend API handlers and type definitions (`src/index.tsx`, `src/helpers.ts`, `src/types.ts`)
- JavaScript (Vanilla ES Modules) - Frontend SPA (`public/static/app.js`, `public/static/app-mentor.js`)
- HTML/CSS - UI with TailwindCSS CDN (`public/index.html`)

**Secondary:**
- JSX - Hono server-side rendering (`src/renderer.tsx`, Hono components in TSX files)
- SQL - Cloudflare D1 queries (embedded in TypeScript)

## Runtime

**Environment:**
- Node.js 18+ (implied by wrangler config)
- Cloudflare Workers (serverless execution via Hono)
- Cloudflare Pages Functions (`pages_build_output_dir: "./dist"`)

**Package Manager:**
- npm 10+ (evidenced by package-lock.json v3)
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Hono 4.11.9 - Lightweight web framework for Cloudflare Workers (`src/index.tsx`)
  - CORS middleware enabled for all `/api/*` routes
  - JSX support via `hono/jsx` with `jsxImportSource: "hono/jsx"`

**Build/Dev:**
- Vite 6.3.5 - Build bundler and dev server (`vite.config.ts`)
  - @hono/vite-build 1.2.0 - Compiles Hono app to Cloudflare Pages Functions
  - @hono/vite-dev-server 0.18.2 - Local development server with Cloudflare adapter
- Wrangler 4.4.0 - Cloudflare CLI for deployment and local testing

**Testing:**
- Not detected in package.json (unit tests not configured)

## Key Dependencies

**Critical:**
- hono 4.11.9 - All API endpoints depend on Hono router and middleware
- @hono/vite-build 1.2.0 - Required for building to Cloudflare Pages Functions format
- @hono/vite-dev-server 0.18.2 - Enables local dev with Cloudflare bindings
- wrangler 4.4.0 - Deploys to production and manages secrets/environment

**Infrastructure:**
- @cloudflare/workerd-darwin-64 (optional) - Local Workers runtime emulation on macOS x64
- @cloudflare/workerd-darwin-arm64 (optional) - Local Workers runtime on macOS ARM64
- @cloudflare/workerd-linux-64 (optional) - Local Workers runtime on Linux x64
- @cloudflare/workerd-linux-arm64 (optional) - Local Workers runtime on Linux ARM64
- @cloudflare/unenv-preset 2.14.0 - Polyfills for Workers environment
- @cloudflare/kv-asset-handler 0.4.2 - Serves static assets from Cloudflare KV

## Configuration

**Environment:**
- `.dev.vars` - Local development secrets (contains GEMINI_API_KEY for local testing)
- `wrangler.jsonc` - Cloudflare configuration:
  - D1 database binding: `DB` (credit-planner-db, UUID: 4e1b3a27-5c53-499f-b697-846560efcd60)
  - R2 bucket binding: `R2` (credit-planner-photos)
  - Compatibility date: 2026-02-14
  - nodejs_compat flag enabled

**Build:**
- `vite.config.ts` - Configures @hono/vite-build and @hono/vite-dev-server
- `tsconfig.json`:
  - Target: ESNext, Module: ESNext, ModuleResolution: Bundler
  - Strict mode enabled
  - JSX: react-jsx with jsxImportSource: "hono/jsx"
- `package.json` - "type": "module" (ES Module imports)

## TypeScript Configuration

**Type Bindings (`src/types.ts`):**
```typescript
export type Bindings = {
  OPENAI_API_KEY: string
  ANTHROPIC_API_KEY: string
  GEMINI_API_KEY: string
  PERPLEXITY_API_KEY: string
  QA_APP_SECRET: string
  ADMIN_KEY: string
  JYSK_API_URL: string
  JYSK_API_KEY: string
  DB: D1Database
  R2: R2Bucket
  KV: KVNamespace
}
```

## Platform Requirements

**Development:**
- Node.js 18+
- npm (with package-lock.json v3)
- macOS/Linux/Windows with npm installed
- `.dev.vars` file with at least GEMINI_API_KEY set

**Production:**
- Cloudflare Pages (deployment target)
- Cloudflare Workers (serverless runtime)
- Cloudflare D1 SQLite database
- Cloudflare R2 object storage
- Cloudflare KV namespace (optional, for caching)

## Build Commands

```bash
npm run dev              # Vite dev server + Hono on localhost:5173
npm run build            # Vite build → dist/ (transpiles src/ to Cloudflare Pages format)
npm run preview          # Wrangler Pages local preview
npm run deploy           # npm run build && wrangler pages deploy (production deployment)
npm run cf-typegen      # wrangler types → generates TypeScript types for Cloudflare bindings
```

**Build Output:**
- Source: `src/index.tsx` (Hono app entry point)
- Output: `dist/` (Cloudflare Pages Functions)
- Static assets: `public/` (served by Cloudflare Pages)

## Environment Variables Required

**For Development (.dev.vars):**
- GEMINI_API_KEY - Google Gemini API key
- OPENAI_API_KEY - OpenAI API key
- ANTHROPIC_API_KEY - Claude API key
- PERPLEXITY_API_KEY - Perplexity API key
- JYSK_API_URL - Remote DB proxy URL (default: https://jungyoul.com/api/jysk-api.php)
- JYSK_API_KEY - Remote DB API authentication key

**For Production (wrangler secrets):**
- Same as above, set via `wrangler pages secret put KEY VALUE`

---

*Stack analysis: 2026-03-29*
