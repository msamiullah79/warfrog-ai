# Cross-Border Sentinel

## Overview

Multi-modal fake news detection system. Analyzes news text and optional images to produce a credibility score (0–100), prediction (Real/Fake/Uncertain), and human-readable explanation.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **Frontend**: React + Vite (Tailwind CSS, Framer Motion, Lucide)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── sentinel/           # React + Vite frontend (main app, served at /)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Key Features

1. **Text Analysis** — Rule-based NLP with 11 fake-news indicator patterns and 8 credibility signal patterns
2. **Image Verification** — EXIF metadata check, file size, MIME type validation
3. **Credibility Scoring** — Weighted combination: 70% text + 30% image
4. **Analysis History** — All analyses stored in PostgreSQL, viewable in History page

## Analysis Engine

- `artifacts/api-server/src/lib/analyzer.ts` — Core analysis logic (text + image)
- Fake indicators: sensational keywords, clickbait, conspiracy language, excessive punctuation
- Credibility signals: sourcing language, statistics, institutional references, quotes
- Score ranges: 0-40 = Fake, 41-64 = Uncertain, 65-100 = Real

## API Endpoints

- `POST /api/analyze` — multipart/form-data with `text` + optional `image` file
- `GET /api/history` — returns last 100 analyses
- `DELETE /api/history` — clears all history
- `DELETE /api/history/:id` — removes a specific record

## Database Schema

- `analyses` table — stores full analysis results including JSONB columns for text/image analysis breakdowns

## Development

```bash
# Start all services
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/sentinel run dev

# Push DB schema changes
pnpm --filter @workspace/db run push

# Run codegen after OpenAPI spec changes
pnpm --filter @workspace/api-spec run codegen
```
