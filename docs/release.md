# Release, packages and auto-update

Modelled on usage-monitor (`release-linux.yml`, skills `usage-monitor-release` and
`usage-monitor-release-beta`). **Packages are built only by GitHub Actions** — never on a developer
machine. Local work is tests and coverage only.

## Pipeline

| Step | Where | What |
|---|---|---|
| CI | `.github/workflows/ci.yml` on PR and push to `main` | Rust on Windows (fmt, clippy, `cargo cov` ≥ 95%), Rust on Linux (`cfg(unix)` paths), frontend (typecheck, `pnpm coverage` ≥ 95%); `ci-ok` aggregates |
| Tag | skill `disk-cleanup-release` / `disk-cleanup-release-beta` | annotated `vX.Y.Z` or `vX.Y.Z-beta.N` on a commit already on `main`, with a green `ci.yml` run |
| Release | `.github/workflows/release.yml` on `v*` tags | `verify-version` → `verify` ∥ `build-*` → `publish-release` |

- **The version comes from the tag.** No bump commit. Every build job runs
  `tauri build --config '{"version":"X.Y.Z"}'`; `tauri.conf.json` keeps the development value.
- **Draft first** (usage-monitor #582): the release is created as a draft and published only once every
  asset reports a `sha256:` digest.
- **Beta** = GitHub prerelease, never `latest`: whoever reads `/releases/latest` never sees it.
- **Dry run**: `gh workflow run release.yml -f tag=vX.Y.Z -f publish=false` builds and verifies without
  publishing.

## Artifacts

| OS | Runner | Bundle | Published name |
|---|---|---|---|
| Windows x64 | `windows-latest` | NSIS (per-user) | `disk-cleanup_X.Y.Z_windows_x64-setup.exe` (+ `.sig`) |
| Linux x64 | `ubuntu-22.04` | deb, rpm, AppImage | `disk-cleanup_X.Y.Z_linux_amd64.deb`, `_linux_x86_64.rpm`, `_linux_x64.AppImage` (+ `.sig`) |
| macOS arm64 | `macos-latest` | app, dmg | `disk-cleanup_X.Y.Z_macos_arm64.dmg`, `_macos_arm64.app.tar.gz` (+ `.sig`) |
| macOS x64 | `macos-15-intel` | app, dmg | `disk-cleanup_X.Y.Z_macos_x64.dmg`, `_macos_x64.app.tar.gz` (+ `.sig`) |
| — | `ubuntu-latest` | updater manifest | `latest.json` (every release, beta included) |

Differences from usage-monitor, and why:

| usage-monitor (Kotlin/jpackage) | disk-cleanup (Tauri 2) | Reason |
|---|---|---|
| Linux built in an Ubuntu 20.04 container | `ubuntu-22.04` runner | Tauri 2 needs `webkit2gtk-4.1`, absent before 22.04; 22.04 is the oldest glibc baseline possible |
| `tar.gz` + user-space `.sh` installer for self-update | AppImage | AppImage is the Linux format the Tauri updater can replace in place |
| Beta builds use the base version for Exe/Dmg/Rpm (jpackage rejects the suffix) | full `X.Y.Z-beta.N` | **Verified for NSIS** (`0.2.0-beta.1` built). deb/rpm/AppImage/dmg **not verified** — the first beta must run as a dry run |
| No MSI | No MSI | Same lesson: only the per-user NSIS install can update itself silently |
| DMG unsigned | DMG unsigned | No Apple Developer ID; Gatekeeper needs a manual override |

**Cost.** The repository is public (required by the updater, see below): standard GitHub-hosted
runners do not bill minutes. A full release still runs two macOS jobs; do not dispatch it in a loop.

## Auto-update — implemented

| Piece | Where |
|---|---|
| Plugin | `tauri-plugin-updater` in `src-tauri/src/bootstrap.rs` (commands `app_version`, `check_update`, `download_update`, `install_update`; event `update-progress`) |
| Channel rule | `src-tauri/src/update.rs` (tested): stable → `/releases/latest/download/latest.json`; beta → highest SemVer among published releases that carry `latest.json` (`/releases?per_page=30`), falling back to stable |
| Public key | `tauri.conf.json` > `plugins.updater.pubkey`; Windows `installMode: passive` |
| Signing | `bundle.createUpdaterArtifacts: true`; secrets `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in every build job |
| Manifest | `publish-release` → `Generate updater manifest`: fails if any of the 4 platforms lacks its bundle or `.sig` |
| UI | Settings → Updates: **Update automatically** (on by default), **Receive beta versions** (off by default), **Check now**; sidebar notice with **Download** / **Restart and update** |

Behaviour: with automatic updates on, the app checks on launch and downloads in the background.
**Installing always waits for the user's click** (on Windows the NSIS installer closes the app; on
Linux/macOS the app restarts). The update is refused unless the minisign signature matches the
public key compiled into the installed app.

Decisions taken: repository made public; key pair generated outside the repository (the private key
is only in the owner's machine and in the secrets — **losing it means no installed copy can update
again**); **no rollback** for now.

Not verified on a real machine yet: AppImage self-replace, and `.app.tar.gz` replacement of an
unsigned macOS app. A user who installed a beta stays on stable-channel semantics unless they turn on
**Receive beta versions** — the next beta only reaches testers who opted in.

## Auto-update — original analysis

### How usage-monitor does it

- Off by default (`autoUpdateEnabled`); beta channel is a separate opt-in (`receiveBetaUpdates`).
- Stable channel reads `/releases/latest`; beta channel lists `/releases?per_page=20` and takes the
  highest non-draft version by SemVer (`AppVersionComparison.kt`, single owner of ordering).
- Downloads in the background, validates **SHA-256 against the release asset `digest`** from the
  GitHub API, swaps on app exit or via "Restart the app and update".
- One installer per platform behind a build flag and a **minimum target version**:
  - Windows: only the per-user NSIS install; the installer's `/UPDATE` mode extracts to `$INSTDIR.new`
    and swaps with two `Rename` calls (a successful rename proves the old process exited).
  - Linux: only the managed user-space `.sh` install; `current` is a text file, promotion by
    `rename(2)`, relaunch, then a **file ACK with a script-generated token** within 60 s or rollback.
  - macOS: unsupported (unsigned bundle under quarantine).
- Receipt file for "last update", release notes window triggered by version change.

### Tauri equivalent (proposal)

`tauri-plugin-updater` covers download, verification and install:

| Concern | usage-monitor | Tauri plugin |
|---|---|---|
| Integrity | SHA-256 vs GitHub `digest` | **minisign signature** (`.sig` per bundle), public key compiled into the app — stronger: a compromised release upload without the private key is refused |
| Manifest | GitHub API | `latest.json` asset (`version`, `notes`, `platforms.{os-arch}.{url,signature}`) |
| Windows | NSIS `/UPDATE` + rename swap | runs the NSIS installer (passive) and exits the app |
| Linux | `.sh` tree + ACK/rollback | replaces the AppImage; deb/rpm stay with the package manager |
| macOS | unsupported | replaces the `.app` from `.app.tar.gz` — **unverified** for an unsigned app |
| Beta | `/releases` listing | runtime endpoint: Rust resolves the highest non-draft release and points the updater at its `latest.json` |
| Rollback | ACK token + rollback | **none built in** — would be custom (health ACK as in usage-monitor) |

Decisions that were required before implementing (all taken — see above):

1. **Signing key.** `tauri signer generate` creates the key pair; the private key and its password
   become the `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` repository secrets.
   Losing the private key means no installed copy can ever update again.
2. **Private repository blocks it.** Release assets and the API of a private repository need
   authentication; an installed app cannot read `latest.json` or download the installer anonymously.
   Options: make the repository public (usage-monitor's model), or publish the update feed and
   assets to a public location. Embedding a token in the app is not an option.
3. **Rollback.** Accept the plugin without rollback, or port usage-monitor's ACK handshake.
