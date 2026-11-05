import { rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { after } from "next/server"

import { orderSteps } from "@/lib/flow-order"
import {
  needsDecision,
  UNPUBLISHED_RUN_STATUSES,
  hasLocalChanges,
  type Flow,
  type LogEntry,
  type Repo,
  type Run,
  type RunStep,
} from "@/lib/types"
import { git, gitRaw, withRepoLock } from "./git"
import { newId, now, store } from "./store"
import { fetchOrigin, gitOpts, resetWorkingTree, revParse } from "./workspace"

export class UserError extends Error {}

const g = globalThis as unknown as {
  __mergerExecuting?: Set<string>
  __mergerCancel?: Set<string>
}
const executing = (g.__mergerExecuting ??= new Set())
const cancelRequests = (g.__mergerCancel ??= new Set())

function log(run: Run, level: LogEntry["level"], message: string) {
  run.log.push({ at: now(), level, message })
}

function repoOf(run: Run): Repo {
  const repo = store.repo(run.repoId)
  if (!repo)
    throw new UserError("The repository for this run no longer exists.")
  return repo
}

const short = (sha?: string) => sha?.slice(0, 7) ?? "—"

/** Lists files git still considers conflicted. */
export async function unmergedFiles(repo: Repo) {
  const out = await git(
    ["diff", "--name-only", "--diff-filter=U", "-z"],
    gitOpts(repo)
  )
  return [...new Set(out.split("\0").filter(Boolean))]
}

export function currentConflictStep(run: Run) {
  return run.steps.find((s) => s.status === "conflict")
}

// ---------------------------------------------------------------- start ---

export async function createRun(repo: Repo, flow: Flow) {
  const blocking = store
    .runs()
    .find((r) => r.repoId === repo.id && needsDecision(r))
  if (blocking) {
    throw new UserError(
      blocking.status === "running" || blocking.status === "waiting"
        ? `Run #${blocking.number} ("${blocking.flowName}") is still in progress for this repository. Finish or cancel it first.`
        : `Run #${blocking.number} ("${blocking.flowName}") has merged changes that were never published. Publish or discard it first.`
    )
  }

  const { steps, error } = orderSteps(flow.nodes, flow.edges)
  if (error) throw new UserError(error)
  if (!steps.length)
    throw new UserError(
      "This flow has no connections yet. Drag from one branch to another to add a merge."
    )

  const number =
    Math.max(
      0,
      ...store
        .runs()
        .filter((r) => r.repoId === repo.id)
        .map((r) => r.number)
    ) + 1
  const run: Run = {
    id: newId(),
    number,
    flowId: flow.id,
    flowName: flow.name,
    repoId: repo.id,
    status: "running",
    busy: true,
    steps: steps.map<RunStep>((s) => ({
      id: newId(),
      edgeId: s.edge.id,
      source: s.source,
      target: s.target,
      kind: s.edge.kind,
      status: "pending",
    })),
    startShas: {},
    createdAt: now(),
    log: [],
  }
  log(
    run,
    "info",
    `Run #${number} started for flow "${flow.name}" (${steps.length} merges).`
  )
  await store.addRun(run)
  scheduleExecution(run)
  return run
}

/** Continues the run in the background after the HTTP response is sent. */
export function scheduleExecution(run: Run) {
  executing.add(run.id)
  run.busy = true
  after(() => executeRun(run.id))
}

/** A run marked busy that no process is working on was interrupted (e.g. server restart). */
export function detectInterrupted(run: Run) {
  if (run.busy && !executing.has(run.id)) {
    run.busy = false
    if (run.status === "running") {
      run.status = "failed"
      for (const s of run.steps)
        if (s.status === "running") {
          s.status = "failed"
          s.error = "Interrupted"
        }
      log(
        run,
        "error",
        "The run was interrupted (the server stopped). You can discard it and start again."
      )
    }
    void store.save()
  }
  return run
}

async function executeRun(runId: string) {
  const run = store.run(runId)
  if (!run) return
  try {
    await withRepoLock(run.repoId, async () => {
      const repo = repoOf(run)
      if (!Object.keys(run.startShas).length) await prepare(run, repo)
      await processSteps(run, repo)
    })
  } catch (err) {
    run.status = "failed"
    log(run, "error", errorMessage(err))
    run.finishedAt = now()
  } finally {
    run.busy = false
    executing.delete(runId)
    cancelRequests.delete(runId)
    await store.save()
  }
}

/** Fetches and points every branch in the flow at its latest remote commit. */
async function prepare(run: Run, repo: Repo) {
  const opts = gitOpts(repo)
  log(run, "info", "Fetching the latest changes from the remote…")
  await fetchOrigin(repo)
  await resetWorkingTree(repo)
  await git(["checkout", "--detach", "-q"], opts)

  const branches = new Set(run.steps.flatMap((s) => [s.source, s.target]))
  const missing: string[] = []
  for (const branch of branches) {
    const sha = await revParse(repo, `refs/remotes/origin/${branch}`)
    if (!sha) {
      missing.push(branch)
      continue
    }
    await git(["branch", "-f", branch, sha], opts)
    run.startShas[branch] = sha
  }
  if (missing.length)
    throw new UserError(
      `These branches don't exist on the remote: ${missing.join(", ")}. Remove them from the flow or create them first.`
    )
  log(
    run,
    "info",
    `Starting from: ${[...branches].map((b) => `${b}@${short(run.startShas[b])}`).join(", ")}`
  )
  await store.save()
}

async function processSteps(run: Run, repo: Repo) {
  const opts = gitOpts(repo)
  for (const [i, step] of run.steps.entries()) {
    if (step.status !== "pending") continue
    if (cancelRequests.has(run.id)) {
      run.status = "cancelled"
      run.finishedAt = now()
      log(run, "warn", "Run cancelled. Remaining merges were not started.")
      return
    }

    step.status = "running"
    step.startedAt = now()
    log(
      run,
      "info",
      `Step ${i + 1}: bringing changes from ${step.source} into ${step.target}…`
    )
    await store.save()

    await resetWorkingTree(repo)
    await git(["checkout", "-q", step.target], opts)
    step.preSha = (await revParse(repo, step.target)) ?? undefined
    step.commitsIncoming = Number(
      (
        await git(
          ["rev-list", "--count", `${step.target}..${step.source}`],
          opts
        )
      ).trim()
    )

    if (step.commitsIncoming === 0) {
      step.status = "up-to-date"
      step.postSha = step.preSha
      step.finishedAt = now()
      log(
        run,
        "success",
        `Step ${i + 1}: ${step.target} already has everything from ${step.source}.`
      )
      continue
    }

    const message = `Merge branch '${step.source}' into ${step.target}\n\nMerged by BranchFlow (run #${run.number}, flow "${run.flowName}").`
    // A sync-back may fast-forward: the earlier branch then points at exactly
    // the same commit as the source, which is the point of syncing back.
    const mode = step.kind === "sync-back" ? "--ff" : "--no-ff"
    log(run, "cmd", `git merge ${mode} ${step.source}   (on ${step.target})`)
    const result = await gitRaw(
      ["merge", mode, "--no-edit", "-m", message, step.source],
      opts
    )

    if (result.code === 0) {
      step.status = "merged"
      step.postSha = (await revParse(repo, "HEAD")) ?? undefined
      step.fastForward =
        step.postSha === (await revParse(repo, step.source)) || undefined
      step.finishedAt = now()
      log(
        run,
        "success",
        step.fastForward
          ? `Step ${i + 1}: synced ${step.target} with ${step.source} — both now point at ${short(step.postSha)}.`
          : `Step ${i + 1}: merged ${step.commitsIncoming} commit(s) from ${step.source} into ${step.target} → ${short(step.postSha)}.`
      )
      await store.save()
      continue
    }

    const conflicts = await unmergedFiles(repo)
    if (conflicts.length) {
      step.status = "conflict"
      step.conflictFiles = conflicts
      run.status = "waiting"
      log(
        run,
        "warn",
        `Step ${i + 1}: ${conflicts.length} file(s) conflict between ${step.source} and ${step.target}. The run is paused until you resolve them, skip this merge, or cancel.`
      )
      return
    }

    await gitRaw(["merge", "--abort"], opts)
    step.status = "failed"
    step.error = (result.stderr || result.stdout).trim()
    step.finishedAt = now()
    run.status = "failed"
    run.finishedAt = now()
    log(run, "error", `Step ${i + 1} failed: ${step.error}`)
    return
  }

  run.status = "completed"
  run.finishedAt = now()
  const changed = changedBranches(run)
  log(
    run,
    "success",
    changed.length
      ? `All merges finished. ${changed.length} branch(es) updated locally: ${changed.join(", ")}. Review, then press Publish to push them.`
      : "All merges finished. Every branch was already up to date — nothing to publish."
  )
}

function changedBranches(run: Run) {
  return [
    ...new Set(
      run.steps.filter((s) => s.status === "merged").map((s) => s.target)
    ),
  ]
}

// ------------------------------------------------------- while paused ---

function requireWaiting(run: Run) {
  if (run.status !== "waiting" || run.busy)
    throw new UserError("This run is not waiting on a conflict.")
  const step = currentConflictStep(run)
  if (!step) throw new UserError("No conflicted merge found in this run.")
  return step
}

/** Commits the resolved merge, then lets the run carry on. */
export function continueRun(run: Run) {
  return withRepoLock(run.repoId, async () => {
    const step = requireWaiting(run)
    const repo = repoOf(run)
    const left = await unmergedFiles(repo)
    if (left.length)
      throw new UserError(
        `${left.length} file(s) still have conflicts: ${left.join(", ")}`
      )

    await git(["commit", "--no-edit", "-q"], gitOpts(repo))
    step.status = "merged"
    step.postSha = (await revParse(repo, "HEAD")) ?? undefined
    step.finishedAt = now()
    run.status = "running"
    log(
      run,
      "success",
      `Conflicts resolved. Merged ${step.source} into ${step.target} → ${short(step.postSha)}.`
    )
    scheduleExecution(run)
    await store.save()
  })
}

export function skipStep(run: Run) {
  return withRepoLock(run.repoId, async () => {
    const step = requireWaiting(run)
    await resetWorkingTree(repoOf(run))
    step.status = "skipped"
    step.finishedAt = now()
    run.status = "running"
    log(
      run,
      "warn",
      `Skipped merging ${step.source} into ${step.target}. ${step.target} was left unchanged.`
    )
    scheduleExecution(run)
    await store.save()
  })
}

export async function cancelRun(run: Run) {
  if (run.status === "running") {
    cancelRequests.add(run.id)
    log(run, "warn", "Cancel requested — stopping after the current merge.")
    await store.save()
    return
  }
  return withRepoLock(run.repoId, async () => {
    const step = requireWaiting(run)
    await resetWorkingTree(repoOf(run))
    step.status = "skipped"
    step.error = "Cancelled while in conflict"
    step.finishedAt = now()
    run.status = "cancelled"
    run.finishedAt = now()
    log(
      run,
      "warn",
      hasLocalChanges(run)
        ? "Run cancelled. Merges that already finished are kept locally — publish them or discard them."
        : "Run cancelled. Nothing was changed."
    )
    await store.save()
  })
}

// ------------------------------------------------- after the run ends ---

function requireUnpublished(run: Run) {
  if (!UNPUBLISHED_RUN_STATUSES.includes(run.status) || run.busy)
    throw new UserError(
      "Only finished, unpublished runs can be published or discarded."
    )
}

/** Throws away everything the run did locally. The remote is untouched. */
export function discardRun(run: Run) {
  return withRepoLock(run.repoId, async () => {
    requireUnpublished(run)
    const repo = repoOf(run)
    const opts = gitOpts(repo)
    await resetWorkingTree(repo)
    await git(["checkout", "--detach", "-q"], opts)
    for (const [branch, sha] of Object.entries(run.startShas))
      await git(["branch", "-f", branch, sha], opts)
    for (const s of run.steps) if (s.status === "merged") s.status = "undone"
    run.status = "discarded"
    log(
      run,
      "info",
      "Discarded. All branches are back where they were before the run; nothing was pushed."
    )
    await store.save()
  })
}

/** Pushes every branch the run changed. */
export function publishRun(run: Run) {
  return withRepoLock(run.repoId, async () => {
    requireUnpublished(run)
    const repo = repoOf(run)
    const opts = gitOpts(repo)
    const branches = changedBranches(run)
    if (!branches.length)
      throw new UserError("Nothing to publish — no branch was changed.")

    log(run, "cmd", `git push origin ${branches.join(" ")}`)
    const result = await gitRaw(
      ["push", "--porcelain", "origin", ...branches],
      opts
    )
    if (result.code !== 0) {
      const rejected = /rejected|non-fast-forward|fetch first/i.test(
        result.stdout + result.stderr
      )
      const msg = rejected
        ? "The remote rejected the push because someone pushed new commits to one of these branches while the run was going. Discard this run and run the flow again to include their work."
        : (result.stderr || result.stdout).trim()
      log(run, "error", `Publish failed: ${msg}`)
      await store.save()
      throw new UserError(msg)
    }

    run.publishedShas = {}
    for (const b of branches) run.publishedShas[b] = (await revParse(repo, b))!
    run.status = "published"
    run.publishedAt = now()
    log(run, "success", `Published ${branches.join(", ")} to the remote.`)
    await store.save()
  })
}

function requirePublished(run: Run) {
  if (run.status !== "published" || run.busy || !run.publishedShas)
    throw new UserError("Only published runs can be reverted or rolled back.")
  return run.publishedShas
}

/**
 * A fast-forward has no merge commit to revert, so apply the reverse of
 * everything it brought in (preSha..postSha) as one new commit.
 */
async function revertFastForward(run: Run, repo: Repo, step: RunStep) {
  const opts = gitOpts(repo)
  log(
    run,
    "cmd",
    `git diff ${short(step.postSha)} ${short(step.preSha)} | git apply --3way   (on ${step.target})`
  )
  const patch = path.join(opts.cwd, ".git", "branchflow-revert.patch")
  await writeFile(
    patch,
    await git(["diff", "--binary", step.postSha!, step.preSha!], opts)
  )
  try {
    const applied = await gitRaw(["apply", "--3way", "--index", patch], opts)
    if (applied.code !== 0) return applied
    return gitRaw(
      [
        "commit",
        "-q",
        "--allow-empty",
        "-m",
        `Revert sync of '${step.source}' into ${step.target}\n\nReverted by BranchFlow (run #${run.number}).`,
      ],
      opts
    )
  } finally {
    await rm(patch, { force: true })
  }
}

/**
 * Safe undo after publishing: adds a "revert" commit on each branch that
 * cancels out the merge. History is kept; nobody else is disrupted.
 */
export function revertRun(run: Run) {
  return withRepoLock(run.repoId, async () => {
    requirePublished(run)
    const repo = repoOf(run)
    const opts = gitOpts(repo)
    await fetchOrigin(repo)
    await resetWorkingTree(repo)

    const prepared = new Set<string>()
    const merged = run.steps
      .filter((s) => s.status === "merged" && s.postSha)
      .reverse()
    for (const step of merged) {
      if (!prepared.has(step.target)) {
        await git(
          [
            "checkout",
            "-q",
            "-B",
            step.target,
            `refs/remotes/origin/${step.target}`,
          ],
          opts
        )
        prepared.add(step.target)
      } else {
        await git(["checkout", "-q", step.target], opts)
      }
      const result = step.fastForward
        ? await revertFastForward(run, repo, step)
        : await (async () => {
            log(
              run,
              "cmd",
              `git revert -m 1 ${short(step.postSha)}   (on ${step.target})`
            )
            return gitRaw(
              ["revert", "-m", "1", "--no-edit", step.postSha!],
              opts
            )
          })()
      if (result.code !== 0) {
        await resetWorkingTree(repo)
        for (const b of prepared)
          await git(
            ["branch", "-f", b, `refs/remotes/origin/${b}`],
            opts
          ).catch(() => {})
        const msg = `Could not automatically revert the merge into ${step.target} — newer commits touch the same lines. Nothing was pushed. Revert it by hand, or use Roll back if nobody has built on top of it.`
        log(run, "error", msg)
        await store.save()
        throw new UserError(msg)
      }
    }

    const branches = [...prepared]
    log(run, "cmd", `git push origin ${branches.join(" ")}`)
    await git(["push", "origin", ...branches], opts).catch(async (err) => {
      log(run, "error", `Pushing the revert failed: ${errorMessage(err)}`)
      await store.save()
      throw new UserError(`Pushing the revert failed: ${errorMessage(err)}`)
    })
    for (const s of merged) s.status = "reverted"
    run.status = "reverted"
    log(
      run,
      "success",
      `Reverted. New "revert" commits were pushed to ${branches.join(", ")}.`
    )
    await store.save()
  })
}

/**
 * Hard undo after publishing: force-moves each branch back to where it was
 * before the run. Refuses if anyone pushed on top since.
 */
export function rollbackRun(run: Run) {
  return withRepoLock(run.repoId, async () => {
    const published = requirePublished(run)
    const repo = repoOf(run)
    const opts = gitOpts(repo)
    await fetchOrigin(repo)

    const moved: string[] = []
    for (const [branch, sha] of Object.entries(published)) {
      if ((await revParse(repo, `refs/remotes/origin/${branch}`)) !== sha)
        moved.push(branch)
    }
    if (moved.length)
      throw new UserError(
        `Can't roll back: ${moved.join(", ")} got new commits after this run was published. Use Revert instead — it's safe even when others have pushed.`
      )

    const branches = Object.keys(published)
    const args = ["push", "origin"]
    for (const b of branches)
      args.push(`--force-with-lease=${b}:${published[b]}`)
    for (const b of branches) args.push(`${run.startShas[b]}:refs/heads/${b}`)
    log(run, "cmd", `git push --force-with-lease origin ${branches.join(" ")}`)
    await git(args, opts).catch(async (err) => {
      log(run, "error", `Roll back failed: ${errorMessage(err)}`)
      await store.save()
      throw new UserError(`Roll back failed: ${errorMessage(err)}`)
    })

    await resetWorkingTree(repo)
    await git(["checkout", "--detach", "-q"], opts)
    for (const b of branches)
      await git(["branch", "-f", b, run.startShas[b]], opts)
    for (const s of run.steps) if (s.status === "merged") s.status = "undone"
    run.status = "rolled-back"
    log(
      run,
      "success",
      `Rolled back. ${branches.join(", ")} on the remote are exactly as they were before run #${run.number}.`
    )
    await store.save()
  })
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}
