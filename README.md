# TRPG Sheets

Character sheets for tabletop RPGs, in the browser. Games are **plain TOML files** (a *system
package*); one generic engine draws the sheet, rolls the dice and guides character creation.

Built in: **Vampire: The Masquerade V20**, **D&D 5e (SRD)**, **Call of Cthulhu 7e**.
Bring your own by importing a `.zip` — see [docs/package-format.md](docs/package-format.md).

**Stack:** Vite · React 19 · TypeScript · Tailwind v4 · shadcn/ui · optional Firebase account.

## Features

- Step-by-step **character creation** for every system, with live budgets, option
  descriptions, hints and a “what is wrong” checklist that jumps to the right step.
- Sheet rendered from `sheet.toml`; dice roller per mechanic (pools, d20, d100, notation);
  tap traits to build a roll.
- **Local-first.** Characters live in your browser (IndexedDB) and work offline.
- **Optional Google account** (Firebase). Signed in, your sheets and imported systems sync
  across devices; signed out, nothing leaves the browser.
- **Sharing without a server** (WebRTC, signalling over public relays, end-to-end encrypted):
  - *Snapshot link / QR* — a read-only copy of a sheet inside the URL.
  - *Live game session* — the GM hosts a room, players join with the code and choose which
    sheets to show; the GM sees them update live plus a shared roll feed.
- Markdown notes, accent colour of your choice, RU / EN interface, print / PDF.

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # engine, every bundled package, JSON schemas, sharing logic
pnpm schema       # regenerate schema/*.schema.json (editor autocomplete for packages)
pnpm build        # typecheck + production build → dist/
```

## Cloud account (optional)

Without configuration the app is fully local and shows no sign-in button. To enable it:

1. Create a Firebase project; enable **Authentication → Google** and **Firestore**.
2. Authentication → Settings → Authorized domains: add the site's domain (for example
   `<user>.github.io`).
3. Put the web-app config in `.env.local` (see `.env.example`) for local development, and in
   the repository secrets `VITE_FIREBASE_*` for the Pages deploy.
4. Deploy the rules: `firebase deploy --only firestore:rules` (`firestore.rules`: each user can
   read and write only `/users/{uid}/…`).

Data layout: `/users/{uid}/sheets/{id}` and `/users/{uid}/systems/{id}`, each
`{ updatedAt, data }` with `data` a JSON string. The newest `updatedAt` wins; a sheet deleted on
one device is deleted on the others.

## Layout

```text
systems/<id>/       bundled system packages (TOML + locales)
schema/             generated JSON Schemas for those files
docs/               package-format.md — the format reference
src/
  engine/           pure TypeScript: schema, loader, expressions, dice, creation rules
  storage/          IndexedDB (characters, imported systems)
  cloud/            optional Firebase sign-in and sheet / system sync
  share/            snapshot links, transports (Trystero / in-memory), sessions
  systems/          registry of bundled + imported packages
  ui/               sheet renderer, wizard, dice dialog, screens, shadcn components
  i18n/             interface strings (system texts live in each package)
```

The engine never mentions a concrete game. To add one, create `systems/<id>/` (or import a
zip) — nothing else changes.

## Notes and limits

- Sessions live while the GM's tab is open; on iPhone the connection drops when the tab is
  backgrounded and recovers on return. Strict mobile NATs may need a TURN server
  (supported by the transport, no UI yet).
- The room code is both the room name (hashed) and the encryption password.
- Printing uses the browser: **Print / PDF → Save as PDF** gives a vector A4 sheet.
- D&D and CoC packages cover the core sheet and creation, not every rule (no spell tables,
  no age modifiers).

## Licence

Code: see [LICENSE](LICENSE). The D&D package contains material from the System Reference
Document 5.1 by Wizards of the Coast LLC, licensed under CC BY 4.0. The Call of Cthulhu package
is fan-made and not affiliated with Chaosium Inc.
