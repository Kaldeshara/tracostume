# Working on Tracostume

Read `README.md` for features and setup, and `FEATURES.md` for what is planned.

## SvelteKit 3 is not the SvelteKit you know

This project uses SvelteKit 3 (with Svelte 5 runes). Check `node_modules/@sveltejs/kit/types/index.d.ts`
before relying on SvelteKit 2 habits. Differences met so far:

- There is no `svelte.config.js`: SvelteKit options go to `sveltekit({...})` in `vite.config.ts`.
- `$lib` is gone. Use the `#lib/*` subpath import, **with the file extension**:
  `#lib/server/db.ts`, `#lib/selection.svelte.ts`, `#lib/components/ItemCard.svelte`,
  `#lib/paraglide/messages.js`. Relative imports inside `src/lib` work without one.
- Environment variables are declared in `src/env.ts` (`defineEnvVars`) and imported from
  `$app/env/private` or `$app/env/public`. `$env/*` is gone. `browser`/`dev` come from `$app/env`.
- `goto()` options are `{ replace, reset }` (no `keepFocus`, `noScroll`, `replaceState`).
  `data-sveltekit-keepfocus` no longer exists.
- Hooks types (`Handle`, `sequence`, `Reroute`) come from `@sveltejs/kit/hooks`.
- The service worker is `src/service-worker/index.ts` with its own `tsconfig.json`; it reads
  `$app/manifest` (not `$service-worker`).
- adapter-node 6 has no `ORIGIN` env var: the origin comes from the request (HTTPS by default).
- Remote functions are still experimental: pages use `load` + form actions.

## Conventions

- Every location or condition change goes through `src/lib/server/inventory.ts` so the `Movement`
  history stays complete. Form actions for it live in `src/lib/server/stock-actions.ts` and are
  reused by the item, selection and scan pages.
- Access: `hooks.server.ts` requires a session everywhere except `/login` and `/register`.
  Pages check roles with `requireRole(event, 'KEEPER' | 'ADMIN' | 'OWNER')`; the UI uses
  `canManageStock`/`hasRole` from `#lib/roles.ts`.
- All UI text goes through Paraglide (`m.key()`), in both `messages/fr.json` and `messages/en.json`.
- The selection (`#lib/selection.svelte.ts`) is browser-only state: never mutate it during SSR.
- The 3D map (`ContainerMap.svelte`) uses Three.js directly, imported dynamically in `onMount`.
  Units are cm; box positions are the back-left-bottom corner from the container's back-left floor
  corner (x = width, y = depth, z = height; the door is at y = depth). Geometry edits are saved
  through `PUT /map/boxes/[id]`; pure geometry helpers live in `src/lib/map.ts` with unit tests.
- Several `ItemPhoto` rows may share one `storageKey` (identical pieces imported from one photo):
  delete stored files only through `src/lib/server/photos.ts`, which checks for other users of the key.
- Search is hybrid (`src/lib/server/search.ts`): Postgres full-text keywords + semantic
  similarity from `src/lib/server/embeddings.ts` (vectors cached in memory and in `ItemEmbedding`,
  refreshed from the item text hash on each search). Ranking rules live in `src/lib/search-rank.ts`
  with unit tests; `scripts/search-eval.ts` compares models on real queries.
- Prisma 7: `prisma migrate dev` does not regenerate the client; run `npm run db:generate`.
- Before finishing: `npm run check`, `npm run lint`, `npm test`.
