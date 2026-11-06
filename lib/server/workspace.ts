import { existsSync } from "node:fs"
import { mkdir, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import type { Repo } from "@/lib/types"
import { git, gitRaw, type GitOptions } from "./git"
import { DATA_DIR } from "./store"

export function workspacePath(repoId: string) {
  return path.join(DATA_DIR, "workspace", repoId)
}

export function gitOpts(repo: Repo): GitOptions {
  return {
    cwd: workspacePath(repo.id),
    identity: { name: 'authorName', email: 'authorEmail' },
  }
}

/** Clones the repository into the app's private workspace. */
export async function cloneWorkspace(repoId: string, source: string) {
  const dir = workspacePath(repoId)
  await mkdir(path.dirname(dir), { recursive: true })
  await rm(dir, { recursive: true, force: true })
  const result = await gitRaw(["clone", "--no-tag", source, dir], {
    cwd: path.dirname(dir),
  })
  if (result.code !== 0) {
    await rm(dir, { recursive: true, force: true })
    throw new Error(
      `Could not clone "${source}". ${result.stderr.trim() || "Check the URL/path and that this machine has access to it."}`
    )
  }
  const head = await gitRaw(
    ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
    {
      cwd: dir,
    }
  )
  return head.code === 0 ? head.stdout.trim().replace(/^origin\//, "") : "main"
}

export async function removeWorkspace(repoId: string) {
  await rm(workspacePath(repoId), { recursive: true, force: true })
}

export function workspaceExists(repoId: string) {
  return existsSync(path.join(workspacePath(repoId), ".git"))
}

export async function fetchOrigin(repo: Repo) {
  await git(["fetch", "origin", "--prune", "--no-tags"], gitOpts(repo))
}

export interface BranchInfo {
  name: string
  sha: string
  updated: string
  subject: string
}

export async function listBranches(repo: Repo): Promise<BranchInfo[]> {
  const out = await git(
    [
      "for-each-ref",
      "--sort=-committerdate",
      "--format=%(refname:strip=3)%09%(objectname:short)%09%(committerdate:relative)%09%(subject)",
      "refs/remotes/origin",
    ],
    gitOpts(repo)
  )
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name, sha, updated, ...subject] = line.split("\t")
      return { name, sha, updated, subject: subject.join("\t") }
    })
    .filter((b) => b.name && b.name !== "HEAD")
}

/** Brings the working tree back to a clean state (aborting half-done merges). */
export async function resetWorkingTree(repo: Repo) {
  const opts = gitOpts(repo)
  const gitDir = path.join(opts.cwd, ".git")
  if (existsSync(path.join(gitDir, "MERGE_HEAD")))
    await gitRaw(["merge", "--abort"], opts)
  if (existsSync(path.join(gitDir, "REVERT_HEAD")))
    await gitRaw(["revert", "--abort"], opts)
  await gitRaw(["reset", "--hard"], opts)
  await gitRaw(["clean", "-fd"], opts)
}

export async function revParse(repo: Repo, ref: string) {
  const result = await gitRaw(
    ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`],
    gitOpts(repo)
  )
  return result.code === 0 ? result.stdout.trim() : null
}

export async function defaultIdentity() {
  const read = async (key: string) => {
    const r = await gitRaw(["config", "--global", key], { cwd: os.homedir() })
    return r.code === 0 ? r.stdout.trim() : ""
  }
  return { name: await read("user.name"), email: await read("user.email") }
}
