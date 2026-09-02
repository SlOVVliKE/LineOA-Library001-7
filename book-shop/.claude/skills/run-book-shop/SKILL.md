---
name: run-book-shop
description: Build, start, and drive book-shop (Next.js + Supabase bookstore/inventory system). Use when asked to run book-shop, start its dev server, reset its local database, take a screenshot of /shop or /admin, log in as a test role, or verify a change actually works in the running app (not just typecheck/test).
---

book-shop is a Next.js 15 app backed by a local Supabase (Postgres) stack
running in Docker. All paths below are relative to `book-shop/` (this
skill lives at `book-shop/.claude/skills/run-book-shop/`). Drive it by
starting the dev server, then piping commands to
`.claude/skills/run-book-shop/driver.mjs` — a small Playwright-based
headless-Chromium REPL (chromium-cli is not installed on this machine,
so this driver stands in for it; the command vocabulary matches
chromium-cli's `nav` / `wait-for` / `click` / `fill` / `screenshot`).

## Prerequisites

- **Node.js** (verified with v24.19.0) and **Docker Desktop**, both already
  installed on this machine.
- Docker Desktop must actually be running (not just installed) before
  Supabase can start:
  ```bash
  docker info >/dev/null 2>&1 || "/c/Program Files/Docker/Docker/Docker Desktop.exe" &
  # poll until it responds
  until docker info >/dev/null 2>&1; do sleep 5; done
  ```
- `playwright` is installed as a devDependency (added this session) so
  the driver can `import { chromium } from 'playwright'`. Its browser
  binary is a separate download, cached outside the repo:
  ```bash
  npx playwright install chromium
  ```

## Setup

```bash
npm install                 # already present in this checkout (node_modules exists)
npx supabase start          # boots Postgres/GoTrue/PostgREST/Storage/Studio in Docker
npx supabase db reset       # applies all 25 migrations + supabase/seed.sql
```

`supabase start` prints fresh `ANON_KEY` / `SERVICE_ROLE_KEY` values (they
rotate per-instance). Copy `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY` from
its JSON/`supabase status -o env` output into `.env.local`'s
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
`SUPABASE_SERVICE_ROLE_KEY` — the rest of `.env.local` (LINE, PromptPay,
app secrets) is unrelated and can stay as-is. `supabase status` reporting
`imgproxy`/`analytics`/`vector`/`pooler` as "Stopped services" is expected
— `supabase/config.toml` disables analytics on purpose (see README
Troubleshooting), the app doesn't use those services.

`.env.local` is already checked out in this workspace with working
Supabase keys and a real `NEXT_PUBLIC_LIFF_ID` — see Gotchas below before
driving `/shop`.

## Run (agent path)

Start the dev server in the background and wait for it to actually serve
(don't fixed-sleep):

```bash
npm run dev > /tmp/nextdev.log 2>&1 &
until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done
```

To stop it: find the PID on port 3000 and kill it — `npm run dev`'s `$!`
is only the npm wrapper.
```bash
netstat -ano | grep ':3000' | grep LISTENING   # note the PID
taskkill //F //PID <pid>
```

Then drive it with the Playwright REPL driver (stdin commands, one per
line):

```bash
node .claude/skills/run-book-shop/driver.mjs <<'EOF'
nav http://localhost:3000/login
wait-for text=เข้าสู่ระบบหลังบ้าน
sleep 800
fill #email owner@bookshop.local
fill #password bookshop1234
click button:has-text("เข้าสู่ระบบ")
wait-for text=ภาพรวม
screenshot admin-home
console --errors
EOF
```

The `sleep 800` after the first `wait-for` is required — see the
hydration gotcha below.

Screenshots land in `.claude/skills/run-book-shop/screenshots/<name>.png`
(full-page PNG). `console --errors` prints a count of `error`/`pageerror`
console entries seen since launch — check it before declaring success.

| command | what it does |
|---|---|
| `nav <url>` | navigate |
| `wait-for text=<substr>` or `wait-for <css-selector>` | wait up to 15s |
| `click <selector>` | Playwright selector, `:has-text()` works |
| `fill <selector> <value>` | React-safe input (goes through Playwright's input pipeline) |
| `type <selector> <value>` | key-by-key typing |
| `press <key>` | e.g. `Enter` |
| `screenshot [name]` | full-page PNG to `screenshots/` |
| `eval <js>` | `page.evaluate`, prints the result |
| `console [--errors]` | dump captured console/pageerror lines |
| `sleep <ms>` | fixed wait — last resort, prefer `wait-for` |

Verified this session: `/login` → owner login → `/admin` overview
rendered real seeded data (7 books, ฿10,435 stock value, low-stock and
stale-stock panels populated). `/shop` (with `NEXT_PUBLIC_LIFF_ID`
cleared, see Gotchas) rendered the seeded catalog of 7 books with
prices, stock badges, and pre-order tags.

## Run (human path)

```bash
npm run dev      # http://localhost:3000/admin or /shop, Ctrl-C to stop
```

Test accounts (from `supabase/seed.sql`, local only): `owner@bookshop.local`
/ `bookshop1234` (full access), `packer@bookshop.local` / `packer1234`
(orders/shipping only, no cost data — RLS-enforced, not just hidden UI).
Full role list in `README.md`.

## Test

```bash
npm test         # tsx tests/money.test.ts — FIFO/shipping/profit math, 9 cases, all pass
npm run typecheck   # tsc --noEmit, no output = clean
```

## Gotchas

- **Filling `/login`'s inputs immediately after `wait-for text=...` can
  silently lose the value.** The heading text is present in the
  server-rendered HTML before React hydrates, so `wait-for text=เข้าสู่ระบบหลังบ้าน`
  resolves before the `<input>`'s `onChange` handler is attached. A
  `fill` that lands in that window sets the DOM value, then hydration
  reconciles the input back to its (empty) React state — the form then
  submits with an empty field and shows "Please fill out this field."
  with no console error. Fix: a short `sleep 800` between the heading
  `wait-for` and the first `fill` (reproduced and fixed this session).
- **`/shop` redirects to a real LINE login instead of the local
  dev-customer fallback.** `.env.local` has a real, working
  `NEXT_PUBLIC_LIFF_ID` (this app is deployed and wired to an actual LINE
  channel). `getLiffIdToken()` (`src/lib/line/liff.ts`) sees that ID, calls
  `liff.init()`, and since the headless session isn't logged into LINE it
  calls `liff.login()` — a hard redirect to `access.line.me`, which a
  headless driver can't complete. The dev-customer fallback in
  `CustomerGate.tsx` (a random `devU...` id stored in `localStorage`) only
  runs when `NEXT_PUBLIC_LIFF_ID` is falsy. To drive `/shop` locally,
  launch the dev server with that one var overridden (shell env vars beat
  `.env.local` in Next.js) rather than editing the file:
  ```bash
  NEXT_PUBLIC_LIFF_ID= npm run dev > /tmp/nextdev.log 2>&1 &
  ```
- **`chromium_headless_shell` vs `chromium`.** `npx playwright install
  chromium` run from outside the project (a different npx cache) does not
  put the browser where the project's own `playwright` package looks —
  you'll hit `Executable doesn't exist at ...chrome-headless-shell.exe`.
  Run `npx playwright install chromium` **from inside `book-shop/`** (so
  it uses the project's installed `playwright` version) after `npm
  install`.
- **`supabase db reset` output is verbose but safe to scan for
  `Applying migration NNNN_*.sql...` lines** — if one is missing partway
  through, the migration before it failed silently upstream; re-run to
  see the actual Postgres error.
- **PowerShell blocks `npm` directly on this machine** — `npm.cmd` works
  from PowerShell; from this Bash/git-bash tool `npm` itself works fine
  (verified: `npm --version`, `npm install`, `npm test` all ran directly).

## Troubleshooting

- **`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`**
  from any `supabase`/`docker` command: Docker Desktop isn't running yet.
  Launch `"/c/Program Files/Docker/Docker/Docker Desktop.exe"` and poll
  `docker info` until it succeeds (took ~5-15s this session once launched).
- **`browserType.launch: Executable doesn't exist at
  ...chrome-headless-shell.exe`**: see the headless_shell gotcha above —
  rerun `npx playwright install chromium` from inside `book-shop/`.
