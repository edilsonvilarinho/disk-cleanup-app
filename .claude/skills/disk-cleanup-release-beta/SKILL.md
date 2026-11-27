---
name: disk-cleanup-release-beta
description: Beta channel of Disk Cleanup — publish a vX.Y.Z-beta.N prerelease, fix it with the next beta, promote the series to stable, or withdraw/restore a beta. Use for any beta release task; plain stable releases use disk-cleanup-release.
---

# Disk Cleanup Beta Release

Same model as usage-monitor's `usage-monitor-release-beta`. Publishing is the stable flow
([disk-cleanup-release](../disk-cleanup-release/SKILL.md)) with a different tag and one promise:
**a beta never becomes `latest`**.

## Operations (the argument picks one)

| Argument | What it does |
|---|---|
| `patch` / `minor` / `major` | Publish `beta.1` of a new series for the next stable of that type |
| `next` | Publish `beta.N+1` of the open series (the way to **fix** a bad beta) |
| `promote` | Publish the stable `vX.Y.Z` of the open series |
| `withdraw [tag]` | Hide a beta as a draft (reversible) |
| `restore [tag]` | Undo a `withdraw` |

## How the channel works

- Tag format: `vX.Y.Z-beta.N`, `N ≥ 1`. `verify-version` rejects anything else (`-rc.1`, `-beta`).
- The workflow publishes `-beta.N` tags with `prerelease: true` and `make_latest: false`. Anyone reading
  `/releases/latest` never sees a beta — the GitHub API never answers it with a prerelease.
- SemVer precedence: `1.2.0-beta.1 < 1.2.0-beta.2 < 1.2.0`. `X.Y.Z` is the **next stable** the beta
  previews; never tag a beta for an `X.Y.Z` that is already stable.
- Packaging: the NSIS installer accepts the full `X.Y.Z-beta.N` (verified locally with
  `0.2.0-beta.1`). `.deb`, `.rpm`, AppImage and `.dmg` with a prerelease suffix are **not verified
  yet**: the first beta must be dispatched with `publish: false` and every job read before tagging for
  real (see [docs/release.md](../../../docs/release.md)).

## Workflow (publish a beta)

1. Read [docs/release.md](../../../docs/release.md) and
   [.github/workflows/release.yml](../../../.github/workflows/release.yml).
2. Invoking this skill means "cut and publish the beta". Do not ask for confirmation.
3. Pick the operation. An **open series** is `vX.Y.Z-beta.*` with no stable `vX.Y.Z` yet.
   - `patch` / `minor` / `major`: last stable bumped by the type, `N = 1` (no stable yet: `0.1.0`).
   - `next`: same `X.Y.Z`, `N + 1`. Refuse if `vX.Y.Z` already exists (series closed).
   - Ambiguous request and no open series → ask which type.
4. `main` clean and equal to `origin/main`: `git fetch origin --tags && git status --short --branch`.
5. Compute the version:
   - last stable: `git describe --tags --abbrev=0 --match "v[0-9]*" --exclude "*-beta*"`
   - highest beta of the series: `git -c versionsort.suffix=- tag --sort=-version:refname --list "vX.Y.Z-beta.*" | head -n 1`
6. The CI run of the commit must be green — same check as the stable skill, step 6 — and
   `apps/desktop/src/releaseNotes/catalog.ts` must have an entry for `X.Y.Z-beta.N` (same check as the
   stable skill; `verify-version` refuses the tag otherwise).
7. Publish:
   - `git -c user.name=claude -c user.email=claude@anthropic.com tag -a vX.Y.Z-beta.N -m "vX.Y.Z-beta.N"`
   - `git push origin vX.Y.Z-beta.N`
8. Watch `Release Desktop Packages`, then confirm:
   - `gh release view vX.Y.Z-beta.N --json isPrerelease` → `true`;
   - `/releases/latest` unchanged: `gh api repos/{owner}/{repo}/releases/latest --jq .tag_name`;
   - every artifact family present with a `sha256:` digest (same list as the stable skill, with
     `X.Y.Z-beta.N` in the names), including `latest.json` and the `.sig` files.
   Testers only receive the **next** beta automatically if they turned on Settings → Updates →
   *Receive beta versions*; say so in the report.
   Published as Latest by mistake → `gh release edit vX.Y.Z-beta.N --prerelease --latest=false` and
   report it.

## Promote — the open series becomes stable

A **new tag and a new build**, never the beta release edited into a stable one (the beta binaries
carry `X.Y.Z-beta.N`). Never run `gh release edit ... --prerelease=false` on a beta.

1. Open series: `git -c versionsort.suffix=- tag --sort=-version:refname --list "v*-beta.*" | head -n 1`.
   Refuse if `vX.Y.Z` exists or there is no beta.
2. What becomes stable: default = current `origin/main` (report `git log --oneline vX.Y.Z-beta.N..origin/main`);
   `promote exact` = the commit the testers ran: tag on `vX.Y.Z-beta.N^{commit}`.
3. Run the stable skill from its step 4 with the version **fixed** to `X.Y.Z`.
4. Confirm `isPrerelease: false` and `/releases/latest` → `vX.Y.Z`.

## Withdraw / Restore

- Withdraw: `gh release edit vX.Y.Z-beta.N --draft=true`. Reversible; refuse a stable tag. Testers who
  installed it stay on it (no downgrade) until a higher version reaches them — fix forward with `next`.
- Restore: `gh release edit vX.Y.Z-beta.N --draft=false --prerelease --latest=false` (all three flags).
- Never delete a release or a tag, and never reuse a withdrawn tag name.

## Guardrails

- Never publish a stable from this skill except through `promote`.
- Never tag a suffix other than `-beta.N`, nor a beta for an `X.Y.Z` already stable.
- Do not ask the user to confirm the tag or the push.
