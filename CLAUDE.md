# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Disk Cleanup: desktop app (Tauri 2 + Rust core + Vue 3/TypeScript) that surveys a volume, classifies
cleanup candidates by tier, builds an approvable plan and executes it. Code comments, docs and commit
messages are written in Portuguese (pt-BR).

## Commands

Requirements: Rust stable, Node 20+ (CI uses 24), pnpm. **Never build installers/packages locally** —
packages are produced only by GitHub Actions (`release.yml`). Local work is tests and coverage.

Rust (repo root):

```bash
cargo test --workspace
cargo test -p disk-cleanup-domain --test plan_approval      # one integration test file
cargo test -p disk-cleanup-application some_test_name       # filter by test name
cargo cov --summary-only        # alias in .cargo/config.toml (cargo-llvm-cov), fails below 95% lines
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all -- --check
```

The `apps/desktop/src-tauri` crate embeds `apps/desktop/dist/` via `generate_context!`; it does not
compile (not even for tests) until the frontend is built once: `cd apps/desktop && pnpm exec vite build`.

UI (`apps/desktop`):

```bash
pnpm install
pnpm test                       # vitest run (jsdom), files src/**/*.test.ts
pnpm exec vitest run src/domain/flow.test.ts      # single file
pnpm exec vitest run -t "test name"               # filter by name
pnpm coverage                   # fails below 95% lines/functions/branches/statements
pnpm typecheck                  # vue-tsc --noEmit
pnpm dev                        # browser on port 1420 with DemoGateway (no Tauri)
```

CI (`.github/workflows/ci.yml`) mirrors this: Rust on Windows (fmt, clippy, `cargo cov`), Rust on
Linux (`cargo test`, covers `cfg(unix)` branches), frontend (typecheck + coverage). `ci-ok` aggregates
them and is the check the release skills require before tagging.

Releases: use the project skills `disk-cleanup-release` (stable) and `disk-cleanup-release-beta`
(`vX.Y.Z-beta.N`). The version comes from the annotated tag; there is no version-bump commit
(`tauri.conf.json` keeps the dev value). Details in `docs/release.md`.

## Architecture

Clean architecture, dependencies point inward only. Full description: `docs/architecture.md`.

```
apps/desktop/src (Vue) ──IPC──▶ apps/desktop/src-tauri (commands, DTOs)
                                    │
             crates/infrastructure (jwalk, sysinfo, TOML, JSON, Win32/POSIX)
                                    │ implements ports of
             crates/application (use cases + port traits)
                                    │ uses
             crates/domain (pure rules, no I/O)
```

- `domain`: pure types and invariants (`Plan`, `approve`, `ExclusionList`, `ToolchainGuard`,
  `SafetyGuard`, `CleanupReport`). Depends only on `thiserror`.
- `application`: port traits in `ports.rs` and services (`SurveyService`, `ClassifyService`,
  `ExecuteService`, `export_plan`). Use cases take `&dyn Port`; fakes live in `tests/support/mod.rs`.
- `infrastructure`: adapters. `catalog/*.toml` are embedded with `include_str!` and selected at runtime
  by `catalog_for(std::env::consts::OS)` / `exclusions_for(...)`, so all three OS catalogs are tested on
  any machine.
- `src-tauri`: `service.rs` holds the testable command logic and the `Session` state; `dto.rs` maps to
  camelCase; `bootstrap.rs` is the composition root with the `#[tauri::command]` wrappers and
  `generate_handler!` (excluded from coverage along with `main.rs`). `update.rs` holds the
  stable/beta channel rule without network.

Frontend (`apps/desktop/src`) follows the same layering: `domain/` (pure), `application/` (ports such
as `DiskCleanupGateway`, `UpdaterPort`, `HistoryStorage`, `ReportExporter`; Pinia stores),
`infrastructure/` (Tauri vs. browser/demo adapters), `presentation/` (views, components, router).
`main.ts` picks adapters (`'__TAURI_INTERNALS__' in window` → Tauri, otherwise demo) and injects them
into stores through Pinia plugins (`this.gateway` etc.). Tests replace them with
`src/test/fakeGateway.ts` / `fakeUpdater.ts`.

Adding an IPC command touches: logic in `src-tauri/src/service.rs` (+ DTO in `dto.rs`), wrapper and
registration in `bootstrap.rs`, the `DiskCleanupGateway` port, `TauriGateway`, `DemoGateway` and the
test fake.

### Rules that cut across layers

- The Rust core never formats user-facing sentences. Data text is `LocalizedText {pt, en}` (catalog
  `label`/`label_en`, `note`/`note_en`, `reason`/`reason_en`); reasons are enums (`BlockReason`,
  `SkipCause`, `FailCause`, `SafetyViolation`); errors cross IPC as `ErrorDto {code, params}`. The UI
  translates in `src/i18n/messages.ts`, where `en` is typed by `pt` (missing/extra keys don't compile).
- New cleanup targets are `[[rule]]` entries in `catalog/<os>.toml` (tier A–D, `kind = path|command`,
  `watch_env`), not code. Project artifacts (`node_modules`, `target`...) are `[[project]]` profiles
  (markers + artifact names) searched under `[[project_root]]` plus the roots from Settings. The catalog may widen mandatory exclusions but never remove the baseline.
- Safety invariants (see `docs/architecture.md`) must not be weakened: `Plan::from_selection` rejects
  blocked/excluded/duplicate items; `approve` is the only way to get an `ApprovedPlan`;
  `ExecuteService` only accepts `ApprovedPlan`; item failures become a status and never abort a tier;
  `SafetyGuard` re-checks right before removal (both for permanent removal and Recycle Bin);
  `FsActionRunner` never follows symlinks/junctions; the per-tier `Disposal` is fixed by `approve` and
  trashed bytes are reported apart from freed space;
  each tier runs once per approval and rebuilding the plan discards approval.
- Scan history and preferences persist in the WebView `localStorage` (`dc-history`), not in Rust.
- Vue: no `v-html`, user paths rendered as text only, CSP with no external domains; non-initial
  views are lazy-loaded; core reports are `markRaw`.
- Auto-update never installs on its own: download is automatic, install only on user click.
- In-app release notes live in `apps/desktop/src/releaseNotes/catalog.ts` (`{pt, en}`, newest first).
  Every tag needs an entry (`release.yml` refuses otherwise); GIFs only for the newest version, ≤ 4 MB
  (`catalog.test.ts`). Process in `docs/release.md`.

Workflow is test-first (red → green → refactor); coverage gates of 95% apply to both Rust and UI.
The repo enforces LF line endings (`.gitattributes`).
