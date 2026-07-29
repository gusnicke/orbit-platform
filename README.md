# Student Benefit Navigator

Working prototype and deployment source for discovering higher-education discounts and free plans across AI, cloud, development, design, research, learning, security, hosting, hardware, and related services.

## Current data

- 140 normalized offer records
- 29 categories
- Direct-vendor programs, GitHub Student Developer Pack benefits, marketplace snapshots, and institution-mediated entitlements
- Eligibility, verification, regional scope, commercial-use notes, confidence, status, review dates, and source URLs per record

## Architecture

- Responsive web interface at `/`
- Vercel Functions under `/api`
- Versioned catalog payload in `data/catalog.part*.b64`
- Build step validates and assembles the runtime catalog
- Airtable base for editorial operations and review queues

## Commands

```bash
npm test
npm run sync:airtable
```

The Airtable sync requires `AIRTABLE_TOKEN`; the prepared base ID is `appG1mi8PAyxr4DMY`.

## Deployment

Import `gusnicke/orbit-platform` into Vercel team `n's projects` (`team_UUILfhVtn2M4ZuOfF66d6FLY`). The included `vercel.json` and `package.json` define the deployment; no framework preset is required.

## Verification policy

Records marked `marketplace_snapshot`, `paused`, `expiring_soon`, or `needs_live_verification` must be checked against the official source before recommendation. Missing regional support, prices, deadlines, or commercial-use rights are never inferred.
