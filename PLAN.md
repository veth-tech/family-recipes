# Family Recipes — Project Plan

A private recipe library for two vegans: searchable, annotatable, agent-friendly.

## Goals

- **One home** for recipes currently scattered across books, websites, and memory
- **Fast search** — by name, ingredient ("what can I make with tofu?"), tag, cuisine
- **Notes** — append-only tasting/modification notes, attributed per person
- **Easy capture** — quick manual entry + import from recipe URLs (schema.org structured data)
- **Agent-friendly** — a well-documented API our AI tools can call directly

## Stack (decided)

| Concern | Choice | Why |
|---|---|---|
| Frontend | React Router v7 (framework mode) + Vite | Modern, SSR-capable, single repo |
| Styling | Tailwind CSS v4 + [neobrutalism.dev](https://www.neobrutalism.dev) kit | Fuchsia duotone palette; shadcn-style components via their registry (Base UI primitives) |
| API | Hono + `@hono/zod-openapi` | Zod schemas → validation **and** OpenAPI doc from one source |
| API docs | `/doc` spec + Scalar/Swagger UI | Free browsable docs; agents read the spec |
| Typed client | `hono/client` RPC | Type-safe calls from React, no fetch boilerplate |
| DB | SQLite (`better-sqlite3`) + Drizzle ORM | Zero-ops, WAL mode, `drizzle-kit` migrations, `drizzle-zod` schemas |
| Search | **MiniSearch** in-memory fuzzy index | Whole library fits in memory (≤200 recipes) — typo-tolerant search, zero infra |
| Auth | **better-auth** (email + password, two accounts) | Native Hono mount, Drizzle adapter, session cookies, auto-attributed notes |
| Deploy | Docker (multi-stage) + docker-compose | Host TBD; SQLite + photos in one mounted `/data` volume |

## Architecture

**Dev:** two processes — `react-router dev` (frontend) + `tsx watch server/index.ts`
(Hono API). Vite proxies `/api/*` to the API port. Same server entry runs in prod.

**Prod:** one Node process serves both the Hono API and the built static app
(`serveStatic` from `@hono/node-server`). Stateless container; all mutable state
(SQLite file + uploaded photos) lives under the mounted `/data` volume.
Backups = copy the volume.

**Scale assumption:** ≤200 recipes, forever. The whole recipe table fits in
memory, so read paths can load everything — search is a fuzzy in-memory index
(rebuilt on write) rather than SQL full-text. Simpler, and more forgiving:
typos and partial matches just work.

### Repo layout

```
family-recipes/
├── app/                  # React Router v7 (routes, components, styles)
├── server/
│   ├── index.ts          # Hono entry: auth mount, API routes, static serving (prod)
│   ├── auth.ts           # better-auth instance (drizzleAdapter, provider: sqlite)
│   ├── routes/           # OpenAPI route definitions (thin)
│   ├── services/         # business logic (route handlers stay thin)
│   └── db/
│       ├── schema.ts     # Drizzle: app tables + auth tables (auth CLI-generated)
│       ├── client.ts     # better-sqlite3 + drizzle, WAL mode
│       └── migrations/   # drizzle-kit output
├── Dockerfile            # multi-stage: build → slim Node runtime
├── docker-compose.yml    # /data volume mount, env config
└── PLAN.md
```

### Key wiring notes (verified against current docs)

- better-auth mounts with one line: `app.all("/api/auth/*", (c) => auth.handler(c.req.raw))`
- Session middleware exposes `auth.api.getSession()` to route handlers as `c.get("session")`
- Auth schema generated via `npx auth@latest generate`, merged into drizzle-kit migrations
- CORS: only needed cross-origin in dev; use explicit origin + `credentials: true`,
  and register the origin in better-auth's `trustedOrigins`

## Data model (v1 sketch)

- **recipes** — id, title, description, source_url, source_book, servings,
  prep_minutes, cook_minutes, instructions (markdown), created_by → user, timestamps
- **ingredients** — freeform markdown text on the recipe row (one ingredient per
  line, author's formatting preserved verbatim — copy-paste first, structure never)
- **tags** — JSON array column on the recipe row (filter chips; no join table
  needed at this scale — distinct tag lists are computed from the in-memory set)
- **tags** + **recipe_tags** — many-to-many (cuisine, occasion, "quick weeknight", …)
- **notes** — id, recipe_id, user_id, body, created_at — append-only, no edits
- **photos** — files under `/data/photos/{recipeId}/…`, path rows in DB
- **Search index** — MiniSearch index over title/ingredients/instructions,
  rebuilt on any write (200 recipes ≈ instant)

## API surface (v1 sketch)

```
POST   /api/auth/*              # better-auth (signup disabled after we both register)
GET    /api/recipes             # list + filter (tag, q, sort) + pagination
POST   /api/recipes             # create
GET    /api/recipes/:id         # full recipe w/ ingredients, tags, notes
PATCH  /api/recipes/:id         # update
DELETE /api/recipes/:id
GET    /api/search?q=           # fuzzy full-text (in-memory index, typo-tolerant)
POST   /api/recipes/:id/notes   # add note
POST   /api/recipes/:id/photos  # upload
POST   /api/import/url          # fetch URL → parse schema.org/Recipe → draft
GET    /doc + /docs             # OpenAPI JSON + Scalar/Swagger UI
```

## Auth model

Two lightweight accounts (one each). Sign-up available initially, then the UI
hides it (invite-style: new accounts via a one-time invite code or CLI-seeded
user). Every note and recipe change is attributed automatically.

## Roadmap

1. **M1 — Skeleton**: scaffold app + server, Drizzle schema + migrations,
   better-auth wired, healthcheck, Docker build, `docker compose up` works
2. **M2 — Core CRUD + search**: recipes/ingredients/tags endpoints, fuzzy search,
   React UI (list, detail, create/edit forms)
3. **M3 — Notes + photos**: append-only notes, photo upload to `/data/photos`
4. **M4 — URL import**: schema.org/Recipe parser → prefilled draft for review
5. **M5 — Polish**: responsive/mobile tweaks, empty states, seed script for initial data

## Open questions

- Ingredient parsing (structured quantities, servings scaling) if ever wanted —
  parse at the read layer; freeform text stays the source of truth
- Whether notes support markdown (lean yes, rendered in UI)
- Photo pipeline: client-side resize before upload vs. server-side sharp
