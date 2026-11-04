# Developer Setup

**Requirements:** Node 22+ (CI uses 24) and pnpm 9 (`corepack enable` picks the pinned version).

```bash
pnpm install          # also installs the git pre-commit hook (.githooks/)
pnpm db:migrate       # creates apps/api/tweety.db
pnpm db:seed          # test users: see README "Test Accounts"
pnpm dev              # generates gRPC code, then starts everything
```

| Service | URL |
|---|---|
| User app | http://localhost:3000 |
| Admin app | http://localhost:3002 |
| API (gRPC on :50051) | http://localhost:3001/health |

## Everyday commands

```bash
pnpm lint             # Biome lint + format check (pnpm lint:fix to auto-fix)
pnpm typecheck
pnpm test:unit        # Vitest, in-memory SQLite per test file
pnpm build
pnpm test:e2e         # Playwright; first run: pnpm --filter @tweety/client-user exec playwright install chromium
```

All tasks run through Turborepo, so unchanged packages are served from cache.
Filter to one package with `pnpm turbo run test:unit --filter=@tweety/api`.

## Checks

- **Pre-commit:** Biome on staged files, then typecheck of changed packages. Bypass once with `git commit --no-verify`.
- **CI** (`.github/workflows/ci.yml`): install → lint → typecheck → unit tests → build, failing at the first broken step. On PRs only affected packages run (`turbo --affected`).

## Gotchas

- Generated gRPC code (`packages/proto/generated`) is not committed; `pnpm dev`/`build` regenerate it. Run `pnpm proto:generate` after editing `.proto` files.
- E2E tests write to the dev database. Reset with `rm apps/api/tweety.db && pnpm db:migrate && pnpm db:seed`.
- Set `GRPC_JWT_SECRET` and `SESSION_SECRET` in production; the API refuses to start without `GRPC_JWT_SECRET` when `NODE_ENV=production`.
