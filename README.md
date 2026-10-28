# Tracostume

Tracostume manages the costumes of a dance troupe: a photo gallery you can search in plain words,
a QR code on every piece of clothing and every box, and a record of what goes in and out of the
container and who has it.

## Stack

- **Frontend & API:** [SvelteKit 3](https://svelte.dev/docs/kit) (Svelte 5 runes, TypeScript, adapter-node)
- **Database:** PostgreSQL 16 with [Prisma 7](https://www.prisma.io/)
- **Auth:** Email/password with secure HTTP-only session cookies
- **UI:** Tailwind CSS 4, mobile first, installable as a web app (PWA)
- **Translations:** [Paraglide](https://inlang.com/m/gerre34r/library-inlang-paraglideJs), French and English (`messages/*.json`)
- **Photos:** S3-compatible bucket (Railway) in production, local disk in development
- **QR codes:** generated with `qrcode`; scanned with the browser `BarcodeDetector` API, with a
  WebAssembly fallback (`barcode-detector` + `zxing-wasm`) for iPhones
- **3D map:** [Three.js](https://threejs.org/) (`src/lib/components/ContainerMap.svelte`), loaded only on the map page
- **Semantic search:** `multilingual-e5-small` through [transformers.js](https://huggingface.co/docs/transformers.js)
  on the server CPU; the model (130 MB) is downloaded to `MODELS_DIR` on first start and needs
  about 500 MB of RAM

## Features

- **Gallery** — photos of every piece, identical pieces grouped on one card ("×10") with their
  locations summed up; filters by category, condition, box and status.
- **Search in plain words** — "une robe brillante pour un numéro années 20" works: a small
  multilingual language model running on the server (free, no API) ranks pieces by meaning, and
  pieces containing the typed words come first. Accents and plurals are ignored. Tags on pieces
  (theme, era, style) are what make searches by idea work, so keep them rich.
- **One QR code per piece** — identical pieces (12 skirts) each get their own code. Creating an item
  with sizes `36, 38, 38, 40` creates one piece per size and opens their labels for printing.
- **Boxes in the container** — each box has a QR code, a location ("left shelf, top") and, optionally,
  dimensions and a position in the container.
- **3D map** (`/map`) — the container drawn with Three.js (corrugated walls seen from inside, plywood
  floor, door on the side you choose) with the storage units inside: plastic boxes, cardboard boxes,
  canvas bags, clothes rails, or other. Keepers add units, drag them (5 cm snapping; a unit rests on
  whatever is below it), set sizes, and edit the container's name, inside dimensions and door side.
  Opened from a selection, it highlights the units holding the selected pieces. Until the container
  is measured, a 20 ft container is assumed.
- **In and out** — keepers check pieces out to a member or anyone else (with a due date and a
  reason), return them to a box, move them, and track their condition (to wash, to repair…).
  Every change is kept in the piece's history.
- **Scanner** — in "In/out" mode, scan several pieces (and a box), then store or check them out
  in one go. In "Look up" mode, a scan opens the piece. Labels also work with the phone's own
  camera app (they encode `https://<site>/q/<code>`).
- **Selection — "Where are they?"** — pick pieces in the gallery or by scanning; the selection page
  groups them by box (with its location) and by borrower, and offers bulk actions and labels.
- **Loans and reminders** — overdue and due-this-week loans, grouped by borrower, with a
  ready-made reminder text message. Overdue counts show as badges in the navigation.
- **Printable QR labels** — for selected pieces, a box, or everything.

### Roles

| Role            | Can                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `DANCER`        | Browse the gallery, look pieces up with the scanner, see their own loans and whom to return them to                    |
| `REPAIRER`      | See only the pieces to wash, repair or damaged (a to-do list on the home page), where they are, and mark them repaired |
| `CHOREOGRAPHER` | Also lend pieces to dancers, follow the loans they are the contact for, and mark pieces collected from a dancer        |
| `KEEPER`        | Has the container key: create/edit pieces and boxes, check in/out, store, print labels, edit the map                   |
| `ADMIN`         | Also manage members' roles, delete pieces and boxes                                                                    |
| `OWNER`         | Also appoint other owners. The first account created is the owner.                                                     |

A loan can name a **contact** (a choreographer). The dancer returns the piece to the contact, who
marks it _collected_; the keeper then stores it in the container, which closes the loan.

## Getting started

### Prerequisites

- Node.js 22 (`.nvmrc`; with Volta: `volta install node@22`) and npm 11 (`volta install npm@11`;
  npm 10 crashes on this dependency tree)
- Docker (local PostgreSQL)

### Setup

```bash
npm install                 # also runs svelte-kit sync and prisma generate
cp .env.example .env
docker compose up -d        # PostgreSQL on port 5433 (Tracster's database keeps 5432)
npm run db:migrate
npm run db:seed             # optional demo data
npm run dev                 # http://localhost:5173
```

Demo accounts (password `password123`): `alice@example.com` (owner), `karim@example.com` (keeper),
`chloe@example.com` (choreographer), `remi@example.com` (repairer), `lea@example.com` (dancer).

### Testing on a phone

The camera only works on secure pages. `npm run dev:phone` serves the app over HTTPS on your local
network with a self-signed certificate and prints a QR code: scan it with the phone (same Wi-Fi) and
accept the certificate warning once. Under WSL 2 the phone cannot reach WSL directly: enable
mirrored networking in `C:\Users\<you>\.wslconfig` (`[wsl2]` / `networkingMode=mirrored`, then
`wsl --shutdown`) and allow the port into WSL once, in an admin PowerShell:

```powershell
New-NetFirewallHyperVRule -Name "Tracostume dev" -DisplayName "Tracostume dev" -Direction Inbound -VMCreatorId '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -Protocol TCP -LocalPorts 5173
```

To install the app, open the site in Chrome (Android) and choose **Install app**, or in Safari (iOS)
choose **Share → Add to Home Screen**.

### Scripts

| Script                             | Does                                                        |
| ---------------------------------- | ----------------------------------------------------------- |
| `npm run dev` / `dev:phone`        | Development server (HTTP / HTTPS on the network)            |
| `npm run check`                    | Type checking (app and service worker)                      |
| `npm run lint` / `format`          | Prettier and ESLint                                         |
| `npm test`                         | Unit tests (Vitest)                                         |
| `npm run build` / `start`          | Production build / server (`build/`)                        |
| `npm run db:migrate` / `db:deploy` | Create and apply migrations (dev) / apply them (production) |
| `npm run db:seed` / `db:studio`    | Demo data / Prisma Studio                                   |

## Deployment (Railway)

1. Create a PostgreSQL database and a Storage Bucket, and add the bucket's AWS SDK variable preset
   to the service (see `.env.example`).
2. Variables: `DATABASE_URL`, `PUBLIC_APP_NAME`, `BODY_SIZE_LIMIT=10M`, optionally
   `REGISTERING_PASSWORD` (a password new members must know to register).
3. Build command `npm run build`; start command `npm run db:deploy && npm start`.

The site URL is taken from the request and assumed to be HTTPS, which is what Railway provides.
Print QR labels from the production site: they contain its address.
