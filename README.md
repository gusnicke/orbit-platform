# Student Benefit Navigator

Working, agent-ready prototype for discovering higher-education discounts and free plans across software, cloud, AI, developer tools, design, learning, security, hosting, hardware, and related services.

## Current data

- 140 normalized offers
- 29 categories
- Direct-vendor programs, GitHub Student Developer Pack benefits, marketplace snapshots, and institution-mediated entitlements
- Source URL, eligibility, verification, regional scope, commercial-use notes, confidence, status, and review metadata per record

## Architecture

- Static responsive web interface at `/`
- Vercel Functions under `/api`
- Versioned compressed source catalog in `data/catalog.json.gz.b64`
- Airtable as the editable operations database
- Agent maintenance procedure in `AGENT_PLAYBOOK.md`

## API

- `GET /api/health`
- `GET /api/summary`
- `GET /api/offers`
- `GET /api/offers?id={offer_id}`
- `POST /api/recommend`
- `POST /api/stack`
- `GET /api/schema`

## Local validation

```bash
npm test
```

For a Vercel-equivalent local server:

```bash
vercel dev
```

## Airtable

Prepared base: `Student Benefit Navigator` (`appG1mi8PAyxr4DMY`) in workspace `k-dev-table`.

Tables:

- Offers
- Discovery Sources
- Review Queue
- Sync Runs
- Configuration

To synchronize the complete catalog, copy `.env.example` to `.env`, add a scoped Airtable personal access token, and run:

```bash
npm run sync:airtable
```

The synchronization is idempotent and merges on `Offer ID`.

## Vercel

Import `gusnicke/orbit-platform` into the Vercel team `n's projects` (`team_UUILfhVtn2M4ZuOfF66d6FLY`). No build command or output directory is required.

## Data policy

Records marked `marketplace_snapshot`, `paused`, `expiring_soon`, or `needs_live_verification` must be checked against the official source before recommendation. Missing prices, regional support, or commercial-use rights are never inferred.
