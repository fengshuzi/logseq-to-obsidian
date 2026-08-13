# AGENTS.md — logseq-formater

Obsidian plugin that auto-converts Logseq syntax (block refs, `TODO/DOING/DONE`, logbook clock) to Markdown on file open.

## Layout

Single-file plugin — `main.ts` is the only TypeScript source. No `src/`, no `lib/`, no `test/` directory. Companion files:

- `manifest.json` — Obsidian plugin manifest (id, version, minAppVersion 0.12.0)
- `styles.css` — styling for the rendering-mode task UI and donate section
- `esbuild.config.mjs` — bundler entry (esbuild, CJS, target es2018)
- `eslint.config.mjs` — strict TS rules (see Lint below)
- `deploy.mjs`, `release.mjs` — maintainer scripts (see Deploy / Release)

## Commands

Defined in `package.json`. Run from repo root.

| Task | Command |
| --- | --- |
| Build (lint + bundle) | `npm run build` |
| Dev (watch + rebuild) | `npm run dev` |
| Lint only | `npm run lint` |
| Deploy to local vaults | `npm run deploy` |
| Cut a GitHub release | `npm run release` |

`build` enforces `npm run lint && node esbuild.config.mjs production`. Lint failures block the bundle. `dev` skips lint (watch mode). There is no separate `typecheck` script — esbuild does not typecheck. To typecheck explicitly: `npx tsc --noEmit`.

## Build output

Production build writes to `dist/`:

- `dist/main.js` (the plugin bundle)
- `dist/manifest.json` (copied from root)
- `dist/styles.css` (copied from root when present)

esbuild `external`s: `obsidian`, `electron`, the `@codemirror/*` set, and the `@lezer/*` set — all provided by the Obsidian runtime, never bundle them. `builtin-modules` are also external.

## Lint

`npm run lint` runs `eslint "**/*.{ts,tsx}"`. The config ignores `*.js`, `*.mjs`, `*.cjs`, `*.config.*`, `**/*.d.ts`, `dist/`, `node_modules/`, `coverage/`. In practice only `main.ts` is linted. Enforced as errors (not warnings):

- `@typescript-eslint/no-explicit-any`
- `no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-call`, `no-unsafe-argument`, `no-unsafe-return`
- `no-unnecessary-type-assertion`, `await-thenable`, `no-floating-promises`

Treat any new `any` as a lint failure.

## Settings (single knob)

`LogseqFormaterSettings.todoRenderMode` — three values: `'preserve'`, `'render-as-task'` (default), `'convert-to-checkbox'`. Implemented in `main.ts` (`renderTodosAsTasks` and the `convert-to-checkbox` branch in `convertSyntax`). Adding a new mode requires updating: `DEFAULT_SETTINGS`, the settings tab dropdown, and both render branches.

## Versioning

Both `manifest.json` and `package.json` carry `version`. **Keep them in sync.** `release.mjs` reads `version` from `manifest.json` (not `package.json`) to create the git tag. Bumping versions is manual — edit both files before running `npm run release`.

## Deploy (`deploy.mjs`)

**Maintainer-personal script.** `BASE_PATH` is hardcoded to the author's iCloud Obsidian vault:

```
~/Library/Mobile Documents/iCloud~md~obsidian/Documents/漂泊者及其影子
```

It fans out to 6 sibling vault directories (`.obsidian-mobile`, `.obsidian-pro`, `.obsidian-ipad`, `.obsidian-2017`, `.obsidian-zhang`, plus a separate `note-demo` vault) and also deletes a legacy `logseq-to-obsidian` sibling. **Do not run this script on another machine** — edit `BASE_PATH` and the `VAULTS` list first. It also wipes `dist/` at the end (relies on `npm run build` having just run). After deploy, Obsidian must be reloaded (the script prints the command).

## Release (`release.mjs`)

1. Runs `npm run build` (so dist/ must be producible).
2. Requires `gh` CLI installed and authenticated (`brew install gh && gh auth login`). Script exits if missing.
3. Reads version from `manifest.json`, creates git tag matching `version` (e.g. `1.0.0`).
4. If the tag already exists, auto-deletes both local and remote tag plus the GitHub Release, then recreates. Pass `--force` to skip the auto-detection step.
5. Attaches `main.js` (or `dist/main.js` / `build/main.js` — auto-detected), `manifest.json`, `dist/styles.css` (if present), and `config.json` (if present).

## Tests / CI

No test framework, no test files, no CI workflows (no `.github/`). Verification is `npm run lint` + manual load in Obsidian. Do not introduce a test runner unless asked — it is not part of the project's existing tooling.

## Conventions
- Single-file source. Keep `main.ts` growing along its current sections (settings, CodeMirror extension, block-ref rendering, `convertSyntax`, `renderTodosAsTasks`, setting tab). New plugins typically warrant a new repo, not new files here.
- No comments in source (project-wide style). Do not add explanatory comments to `main.ts`.
- Logging convention: `console.debug('[LogseqFormater] ...')` is used heavily in `main.ts`; match this prefix and level for new log lines.
- The plugin operates on `md` files via the `file-open` event — anything time-consuming in `convertSyntax` runs on every MD open. Keep that path cheap.

## Marketplace / Scorecard
Marketplace, manifest, and release conventions (author fields, description punctuation, `minAppVersion`, `versions.json`, Scorecard workflow) live in the parent `obsidian-plugins-parent/AGENTS.md`. Read it before touching `manifest.json`, release flow, or marketplace-facing code.
