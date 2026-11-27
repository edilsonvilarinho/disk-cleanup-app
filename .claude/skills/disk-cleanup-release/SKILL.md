---
name: disk-cleanup-release
description: Cut and publish a stable Disk Cleanup release — pick the version, check the CI run of the commit, create the annotated tag and follow the GitHub Actions workflow that publishes the Windows, Linux and macOS packages. Use to cut, ship, publish or troubleshoot a release.
---

# Disk Cleanup Release

Same model as usage-monitor's `usage-monitor-release`: the release is a tag, the
version comes from the tag, and CI builds and publishes every package.

## Workflow

1. Read [README.md](../../../README.md), [docs/release.md](../../../docs/release.md) and
   [.github/workflows/release.yml](../../../.github/workflows/release.yml) first.
2. Invoking this skill already means "cut and publish the release". Do not ask for confirmation to
   tag or push — go through the whole flow and report the result.
3. Confirm the release type from the request: `patch`, `minor` or `major`.
4. Verify that `main` is clean and matches `origin/main` — the tag must point to a commit already on
   the remote `main`, or `verify-version` refuses it:
   - `git fetch origin --tags && git status --short --branch`
   - `git log --oneline -5`
5. Pick the version. **There is no version bump commit**: the version comes from the tag.
   - Current stable: `git describe --tags --abbrev=0 --match "v[0-9]*" --exclude "*-beta*"`.
     Compute the next `X.Y.Z` from the release type. Beta tags are never the base.
   - **No tag yet** (first release): the version is `0.1.0`, whatever the type.
   - **Open beta series?** (`git -c versionsort.suffix=- tag --sort=-version:refname --list "v*-beta.*" | head -n 1`
     with no stable of the same `X.Y.Z`): promoting it is `disk-cleanup-release-beta promote`.
   - Never edit `version` in `apps/desktop/src-tauri/tauri.conf.json` or the `Cargo.toml` files for a
     release: the workflow passes the tag to `tauri build --config '{"version": "..."}'`.
6. The suite of the commit to tag must be green — mandatory. The tag triggers the release; a broken
   suite found after the push is a burned tag on the remote. Check the CI run of that commit instead of
   rerunning everything locally:
   `gh run list --workflow ci.yml --commit $(git rev-parse HEAD) --json conclusion,status --jq '.[0]'`
   must be `completed`/`success`. Missing or red → stop, do not tag. Only when no CI run exists for the
   commit, run the gates locally: `cargo cov --summary-only` at the root and `pnpm coverage` in
   `apps/desktop`.
   - Do not package locally as a release gate: `build-windows`, `build-linux` and `build-macos` own
     packaging; a local build proves one OS only.
   - **In-app release notes:** `grep -F "version: 'X.Y.Z'," apps/desktop/src/releaseNotes/catalog.ts`
     must match on that commit — `verify-version` refuses the tag otherwise. Missing → stop and report:
     the entry (and optional GIFs) goes in through a PR first, see `docs/release.md` → *In-app release
     notes*. Do not commit it to `main` from this skill.
7. Publish:
   - annotated tag with the temporary agent git identity:
     `git -c user.name=claude -c user.email=claude@anthropic.com tag -a vX.Y.Z -m "vX.Y.Z"`
     (annotated is mandatory — `verify-version` rejects lightweight tags)
   - push **only the tag**: `git push origin vX.Y.Z`. Nothing goes to `main`.
8. Watch `Release Desktop Packages` and report the outcome:
   `gh run list --workflow release.yml --limit 1` then `gh run watch <id> --exit-status`.
   `verify-version` checks the tag; `verify` runs both coverage gates in parallel with the builds;
   `publish-release` requires all of them, creates the release as a **draft**, waits until every asset
   has a `sha256:` digest and only then publishes it as Latest. To rebuild an existing tag without
   publishing, dispatch the workflow with `publish: false`.
9. Confirm the published release carries every artifact family, each with a digest:
   `gh release view vX.Y.Z --json assets --jq '.assets[] | [.name, .digest] | @tsv'`
   - Windows: `disk-cleanup_X.Y.Z_windows_x64-setup.exe` (NSIS, per-user; no MSI)
   - Linux: `disk-cleanup_X.Y.Z_linux_amd64.deb`, `disk-cleanup_X.Y.Z_linux_x86_64.rpm`,
     `disk-cleanup_X.Y.Z_linux_x64.AppImage`
   - macOS: `disk-cleanup_X.Y.Z_macos_arm64.dmg` and `disk-cleanup_X.Y.Z_macos_x64.dmg`
   - Updater: `latest.json`, `disk-cleanup_X.Y.Z_macos_{arm64,x64}.app.tar.gz`, and a `.sig` next to
     the setup `.exe`, the AppImage and both `.app.tar.gz`
   A release missing any of them is incomplete and must be reported as such.
10. The release notes come from the workflow's `Generate release notes` step (commits since the
    previous stable tag). Do not write them by hand or create the release with `gh release create`.

## Guardrails

- Do not release from a dirty tree unless the user explicitly wants that risk.
- Do not ask the user to confirm the tag or the push: the skill invocation is the authorization.
- Do not reintroduce local packaging as a release gate.
- A macOS-only failure is not acceptable: `build-macos` blocks `publish-release`; a green release
  without both DMGs means the workflow was edited or skipped.
- Never dispatch the release workflow in a loop to "see if it passes"; read the failed log first.
- Every release must carry `latest.json` plus a `.sig` for the NSIS installer, the AppImage and both
  `.app.tar.gz`. A release without them strands installed copies on the old version.
- Never rotate or regenerate the updater key: installed copies only trust the public key they were
  built with.
- Prefer the current workflow and code over these notes when they disagree, and fix the notes.
