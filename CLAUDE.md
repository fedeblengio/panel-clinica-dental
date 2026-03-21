# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Panel de administración web para clínicas dentales. Multi-tenant architecture where each clinic (`clinica`) has isolated data (patients, appointments, chat histories, config). A superadmin role manages all clinics; regular admins are scoped to one clinic.

## Commands

```bash
# Development (run both in parallel)
npm run dev:server    # Express backend with --watch on port 3000
npm run dev:client    # Vite dev server with proxy to :3000

# Build & production
npm run build         # Vite build → dist/
npm start             # node server.js (serves dist/ + API)
```

No test framework is configured.

## Architecture

**Monolith**: Single Express server (`server.js`) serves both the REST API and the built React SPA from `dist/`.

### Backend (`server.js`)
- All API routes are defined inline in `server.js` (no separate route files, `routes/` dir is empty)
- PostgreSQL via `pg.Pool` with `DATABASE_URL` env var
- `initDB()` auto-creates tables and runs migrations on startup (CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS)
- Auth: `express-session` with cookie, bcrypt passwords. Three middleware: `requireAuth`, `requireClinica`, `requireSuperAdmin`
- Multi-tenancy: `clinica_id` column on all data tables. `getClinicaId(req)` resolves clinic from session (admin) or `X-Clinica-Id` header (superadmin)
- Evolution API integration for WhatsApp instance management (create instances, QR codes, webhooks)
- DB trigger `auto_set_chat_clinica` auto-assigns `clinica_id` to new chat messages based on patient phone

### Frontend (`src/`)
- React 18 + React Router v6, Tailwind CSS, Framer Motion
- `src/lib/utils.js`: `api()` wrapper that auto-injects `X-Clinica-Id` header; `cn()` for Tailwind class merging
- Pages are in `src/components/`: Dashboard, Pacientes, Citas, Conversaciones, Configuracion, Ayuda, SuperAdmin
- Reusable UI primitives in `src/components/ui/` (button, card, dialog, input, badge)
- Vite proxies `/api` to `localhost:3000` in dev mode

### Key API patterns
- All data endpoints follow: `GET/POST /api/{resource}`, `PUT/DELETE /api/{resource}/:id`
- Superadmin endpoints under `/api/admin/` (clinicas, usuarios)
- Public bot config endpoint: `GET /api/configuracion/bot?instance=<name>` (no auth, used by n8n)
- Bot session sync: `POST /api/bot/register-session`, `POST /api/bot/sync-chat-clinicas`

## Environment Variables

`DATABASE_URL`, `ADMIN_USER`, `ADMIN_PASS`, `SESSION_SECRET`, `PORT`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `N8N_WEBHOOK_URL`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`

## Language

The codebase, UI, variable names, and database schema are in **Spanish**. Keep all user-facing text, DB column names, and API responses in Spanish.
