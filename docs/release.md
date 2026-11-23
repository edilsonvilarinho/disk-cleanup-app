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
| Windows x64 | `windows-latest` | NSIS (per-user) | `disk-cleanup_X.Y.Z_windows_x64-setup.exe` |
| Linux x64 | `ubuntu-22.04` | deb, rpm, AppImage | `disk-cleanup_X.Y.Z_linux_amd64.deb`, `_linux_x86_64.rpm`, `_linux_x64.AppImage` |
| macOS arm64 | `macos-latest` | dmg | `disk-cleanup_X.Y.Z_macos_arm64.dmg` |
| macOS x64 | `macos-15-intel` | dmg | `disk-cleanup_X.Y.Z_macos_x64.dmg` |

Differences from usage-monitor, and why:

| usage-monitor (Kotlin/jpackage) | disk-cleanup (Tauri 2) | Reason |
|---|---|---|
| Linux built in an Ubuntu 20.04 container | `ubuntu-22.04` runner | Tauri 2 needs `webkit2gtk-4.1`, absent before 22.04; 22.04 is the oldest glibc baseline possible |
| `tar.gz` + user-space `.sh` installer for self-update | AppImage | AppImage is the Linux format the Tauri updater can replace in place |
| Beta builds use the base version for Exe/Dmg/Rpm (jpackage rejects the suffix) | full `X.Y.Z-beta.N` | **Verified for NSIS** (`0.2.0-beta.1` built). deb/rpm/AppImage/dmg **not verified** — the first beta must run as a dry run |
| No MSI | No MSI | Same lesson: only the per-user NSIS install can update itself silently |
| DMG unsigned | DMG unsigned | No Apple Developer ID; Gatekeeper needs a manual override |

**Cost.** This repository is private. macOS runners bill 10× and Windows 2× the Linux minute; a full
release runs two macOS jobs. usage-monitor is public and does not pay for them.

## Auto-update — analysis (not implemented)

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

Required before implementing — decisions for the owner:

1. **Signing key.** `tauri signer generate` creates the key pair; the private key and its password
   become the `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` repository secrets.
   Losing the private key means no installed copy can ever update again.
2. **Private repository blocks it.** Release assets and the API of a private repository need
   authentication; an installed app cannot read `latest.json` or download the installer anonymously.
   Options: make the repository public (usage-monitor's model), or publish the update feed and
   assets to a public location. Embedding a token in the app is not an option.
3. **Rollback.** Accept the plugin without rollback, or port usage-monitor's ACK handshake.
