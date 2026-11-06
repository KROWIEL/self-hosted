# Contributing

Thanks for helping. Bug reports, fixes, new catalog apps, translations and
documentation are all welcome.

## Before you start

- For anything bigger than a small fix, open an issue first so we can agree on
  the approach before you spend time on it.
- Security problems: follow [`SECURITY.md`](SECURITY.md) instead of opening a
  public issue.

## Set up

You need Node.js 24 LTS, Docker with Compose, and Go 1.25+.

```bash
git clone https://github.com/KROWIEL/self-hosted.git
cd self-hosted
./start.sh                          # Windows: ./start.ps1
git config core.hooksPath .githooks # gitleaks pre-commit secret scan
```

[`docs/INSTALL.md`](docs/INSTALL.md#local-development) has the manual steps and
how to run a local node.

## Checks

Run what CI runs before you push:

```bash
npm run catalog:validate
npm run build --workspace @selfhosted/shared
npm test --workspace @selfhosted/control-plane
npm run build --workspace @selfhosted/control-plane
npm run build --workspace @selfhosted/web
cd services/agent && go vet ./... && go test ./...
```

Database schema changes go through Drizzle migrations: edit
`apps/control-plane/src/db/schema.ts`, then run `npm run db:generate` and commit
the generated files in `apps/control-plane/drizzle`.

## Pull requests

- Keep a pull request to one change, and include tests for new logic.
- UI strings live in `apps/web/src/i18n/en.ts` and `ru.ts`; add both.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit
  messages: `feat: …`, `fix: …`, `docs: …`.
- Never commit `.env` files, keys or tokens.

## Catalog apps

Each app is one JSON manifest in [`catalog/apps`](catalog/apps). See
[`tools/catalog/README.md`](tools/catalog/README.md) for the format and the
validator.

## License

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE).
