# BranchFlow

Keep every client branch in sync with `main` — visually.

One product is sold to many clients, and each client branch carries a few
customisations. BranchFlow lets you draw how code should flow (for example
`main → staging → every client`), check for conflicts before anything
changes, run all the merges in the right order, fix conflicts in the
browser, and publish or undo the whole thing with one click.

The full team procedure lives in the app under **How it works** (`/guide`).

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

Requirements: Node 20+ and Git **2.38 or newer** (the conflict check uses
`git merge-tree --write-tree`). BranchFlow runs git on the machine it is
started on, using that machine's existing credentials (SSH keys or the git
credential manager), so start it somewhere that can already `git clone` and
`git push` your repository.

New here? Click **Try it with a demo repo** on the dashboard. It creates a
throw-away sample repository (main, staging and three clients, with one real
conflict) so you can try every button without risk.

## How it works

| Concept    | Meaning                                                                                 |
| ---------- | --------------------------------------------------------------------------------------- |
| Repository | A git repo BranchFlow manages. It is cloned into a private workspace.                  |
| Flow       | A saved diagram. Each node is a branch, each arrow means "merge this into that".       |
| Step order | Dependencies first (a branch receives its updates before passing them on), then top to bottom on the canvas. Shown as "Step N" on each arrow. |
| Run        | One execution of a flow: fetch → merge each step → pause on conflicts → publish.       |

Safety model:

- Merges happen in `.merger-data/workspaces/<repo>` — a separate clone. No
  developer's checkout is touched.
- Nothing is pushed until someone presses **Publish**.
- Only one open run per repository; a run with unpublished results must be
  published or discarded before the next one starts.
- Every run records each branch's commit before it started, which powers
  **Discard** (before publishing), **Roll back** (force-with-lease back to the
  old commits, refused if anyone pushed since) and **Revert** (adds revert
  commits; always safe).

## Code map

| Path                           | What                                                          |
| ------------------------------ | ------------------------------------------------------------- |
| `lib/types.ts`                 | Shared data model (repos, flows, runs, steps).                |
| `lib/flow-order.ts`            | Step ordering and loop detection (used by UI and server).     |
| `lib/server/runner.ts`         | The run engine: merge, pause, continue, publish, undo.        |
| `lib/server/preview.ts`        | Dry-run conflict check with `git merge-tree`.                 |
| `lib/server/conflicts.ts`      | Reading and resolving conflicted files.                       |
| `lib/server/store.ts`          | JSON storage in `.merger-data/db.json`.                       |
| `app/api/**`                   | Route handlers the UI calls.                                  |
| `components/flow/*`            | React Flow canvas, branch nodes, merge edges, side panel.     |
| `components/conflicts/*`       | The conflict resolver.                                        |

Data location can be changed with the `MERGER_DATA_DIR` environment variable.

## Current limits

- Single server process, JSON-file storage, no login — intended for an
  internal tool run by the team (or on one shared machine/VM).
- Merges use `git merge --no-ff`. Rebasing strategies are not supported.
- Long-running runs survive page reloads, but not a server restart mid-merge:
  the run is marked failed and can be discarded and re-run.

## Windows desktop app

BranchFlow also ships as a Windows app (Electron). It starts the same server
in the background on a private local port and opens it in its own window.
Git runs as the signed-in Windows user, so it uses that machine's existing
Git Credential Manager logins, SSH keys and global `user.name`/`user.email`.
Git 2.38+ must be installed; the app checks on startup.

Data is stored in `%APPDATA%\BranchFlow\data` (server log: `%APPDATA%\BranchFlow\server.log`).

```bash
npm run electron:dev     # dev: next dev + Electron window
npm run electron:build   # builds dist-electron/BranchFlow-Setup-<version>.exe
npm run electron:art     # regenerate installer artwork in build/
```

### Releasing an update

Installed apps check GitHub Releases on
[NxtArnab/gitmerger](https://github.com/NxtArnab/gitmerger/releases) at startup
and every 4 hours, download new versions in the background and offer to
restart.

```bash
npm version patch        # bumps package.json and creates tag vX.Y.Z
git push --follow-tags   # GitHub Actions builds and publishes the release
```

The workflow is `.github/workflows/release.yml`. The repository must stay
public for installed apps to see releases (a private repo would need a token
inside the app). Builds are unsigned, so Windows SmartScreen shows "Unknown
publisher" until a code-signing certificate is added.
