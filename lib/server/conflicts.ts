import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { ConflictFileDetail, ConflictFileSummary, Run } from "@/lib/types"
import { git, gitRaw, withRepoLock } from "./git"
import { currentConflictStep, unmergedFiles, UserError } from "./runner"
import { store } from "./store"
import { gitOpts } from "./workspace"

function context(run: Run, file?: string) {
  if (run.status !== "waiting")
    throw new UserError("This run has no open conflicts.")
  const step = currentConflictStep(run)
  const repo = store.repo(run.repoId)
  if (!step || !repo)
    throw new UserError("No conflicted merge found in this run.")
  if (file !== undefined && !step.conflictFiles?.includes(file))
    throw new UserError("That file is not part of this conflict.")
  return { step, repo, opts: gitOpts(repo) }
}

export function listConflicts(run: Run): Promise<ConflictFileSummary[]> {
  return withRepoLock(run.repoId, async () => {
    const { step, repo } = context(run)
    const open = new Set(await unmergedFiles(repo))
    return (step.conflictFiles ?? []).map((p) => ({
      path: p,
      resolved: !open.has(p),
    }))
  })
}

export function readConflict(
  run: Run,
  file: string
): Promise<ConflictFileDetail> {
  return withRepoLock(run.repoId, async () => {
    const { repo, opts } = context(run, file)
    const stage = async (n: number) => {
      const r = await gitRaw(["show", `:${n}:${file}`], opts)
      return r.code === 0 ? r.stdout : null
    }
    const [base, current, incoming] = [
      await stage(1),
      await stage(2),
      await stage(3),
    ]
    const merged = await readFile(path.join(opts.cwd, file), "utf8").catch(
      () => null
    )
    const open = new Set(await unmergedFiles(repo))
    const binary = [base, current, incoming, merged].some((c) =>
      c?.includes("\0")
    )
    return {
      path: file,
      binary,
      base: binary ? null : base,
      current: binary ? (current === null ? null : "") : current,
      incoming: binary ? (incoming === null ? null : "") : incoming,
      merged: binary ? null : merged,
      resolved: !open.has(file),
    }
  })
}

export type Resolution =
  | { mode: "content"; content: string }
  | { mode: "current" | "incoming" | "delete" }

export function resolveConflict(
  run: Run,
  file: string,
  resolution: Resolution
) {
  return withRepoLock(run.repoId, async () => {
    const { opts } = context(run, file)
    const full = path.join(opts.cwd, file)
    if (!full.startsWith(opts.cwd + path.sep))
      throw new UserError("Invalid path.")

    if (resolution.mode === "content") {
      const original = await readFile(full, "utf8").catch(() => "")
      const content = original.includes("\r\n")
        ? resolution.content.replace(/\r?\n/g, "\r\n")
        : resolution.content
      if (/^(<{7}|>{7}|={7})( |$)/m.test(content))
        throw new UserError(
          "The file still contains conflict markers (<<<<<<<, =======, >>>>>>>). Remove them first."
        )
      await writeFile(full, content)
      await git(["add", "--", file], opts)
      return
    }

    if (resolution.mode === "delete") {
      await git(["rm", "-q", "-f", "--", file], opts)
      return
    }

    const stage = resolution.mode === "current" ? 2 : 3
    const exists =
      (await gitRaw(["cat-file", "-e", `:${stage}:${file}`], opts)).code === 0
    if (exists) {
      await git(
        [
          "checkout",
          resolution.mode === "current" ? "--ours" : "--theirs",
          "--",
          file,
        ],
        opts
      )
      await git(["add", "--", file], opts)
    } else {
      await git(["rm", "-q", "-f", "--", file], opts)
    }
  })
}
