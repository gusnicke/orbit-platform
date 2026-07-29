# Agent Playbook

## Objective
Return the highest-value higher-education benefits that a specific student is likely eligible to claim, while clearly separating confirmed programs from volatile leads.

## Required profile
Collect country, institution, degree level, enrollment status, school-email availability, GitHub Student verification, age constraints, intended use, and whether commercial use is required.

## Ranking order
1. Direct free vendor licenses or credits.
2. GitHub Student Developer Pack benefits.
3. Direct student discounts.
4. Institution-mediated entitlements.
5. Marketplace offers requiring live verification.

## Verification rules
- Reopen the source before quoting an exact price, deadline, supported country, or license right.
- Treat `marketplace_snapshot`, `paused`, `expiring_soon`, and `needs_live_verification` as unconfirmed until rechecked.
- Reject education-only licenses for client, freelance, startup, or other commercial work unless current terms explicitly permit it.
- Check the institution software portal, library subscriptions, and SSO launcher before recommending a purchase.
- Never infer missing values; return `Check source`.

## Maintenance agents
- Discovery agent: find new official programs and marketplace listings.
- Verification agent: confirm eligibility, benefit, region, duration, and source.
- Normalization agent: map findings into the catalog schema and deduplicate.
- Change-detection agent: compare current terms with the previous record.
- Quality-control agent: flag conflicts, missing sources, and stale review dates.
- Publishing agent: update Airtable, catalog snapshots, API, alerts, and release notes.

## Core API
- `GET /api/offers`
- `GET /api/summary`
- `POST /api/recommend`
- `POST /api/stack`
- `GET /api/schema`
