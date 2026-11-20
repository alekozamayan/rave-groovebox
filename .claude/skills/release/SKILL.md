---
name: release
description: Cut and verify a Rave Groovebox release to GitHub Pages (version bump, tag push, deploy workflow, smoke check of the live site). Use when the user asks to release, deploy or publish.
---

1. Be on an up-to-date `main` with CI green; run `/verify`.
2. `npm version patch|minor|major` (ask which if unclear; new features = minor).
3. `git push --follow-tags`. The cloud sandbox can't push tags (HTTP 403): if so, give the user the
   exact commands to run locally (`git fetch && git checkout main && git pull && npm version … && git push --follow-tags`).
4. Watch `deploy.yml` for the tag. On failure, read the logs, fix on a branch, and release again.
5. Smoke-check https://alekozamayan.github.io/rave-groovebox/: the version label matches, the manifest
   loads, and Tap to start → Play works.
6. Record the release in `docs/STATUS.md`.
