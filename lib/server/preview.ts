import { isSyncBack, orderSteps } from "@/lib/flow-order"
import type {
  Flow,
  PreviewCommit,
  PreviewResult,
  PreviewStep,
  Repo,
} from "@/lib/types"
import { git, gitRaw, withRepoLock } from "./git"
import { fetchOrigin, gitOpts, revParse } from "./workspace"
import { now } from "./store"

const PREVIEW_IDENTITY = { name: "Merge preview", email: "preview@localhost" }

/**
 * Simulates the whole flow against the latest remote state without touching
 * any branch. Each clean merge produces a throw-away commit so later steps
 * see the result of earlier ones (main -> staging -> client).
 */
export function previewFlow(repo: Repo, flow: Flow): Promise<PreviewResult> {
  return withRepoLock(repo.id, async () => {
    const { steps, error } = orderSteps(flow.nodes, flow.edges)
    if (error) throw new Error(error)

    await fetchOrigin(repo)
    const opts = gitOpts(repo)
    const virtual = new Map<string, string>()
    /** target branch -> (source branch -> step number) for conflicting merges */
    const conflictedFrom = new Map<string, Map<string, number>>()
    const tip = async (branch: string) =>
      virtual.get(branch) ??
      (await revParse(repo, `refs/remotes/origin/${branch}`))

    const results: PreviewStep[] = []
    for (const step of steps) {
      const base: PreviewStep = {
        edgeId: step.edge.id,
        source: step.source,
        target: step.target,
        result: "clean",
        kind: step.edge.kind,
        commitsIncoming: 0,
        commits: [],
        conflictFiles: [],
      }
      const [target, source] = [await tip(step.target), await tip(step.source)]
      if (!target || !source) {
        results.push({
          ...base,
          result: "missing",
          message: `Branch "${!source ? step.source : step.target}" was not found on the remote.`,
        })
        continue
      }

      const count = Number(
        (
          await git(["rev-list", "--count", `${target}..${source}`], opts)
        ).trim()
      )
      if (count === 0) {
        results.push({ ...base, result: "up-to-date" })
        continue
      }
      const commits = await listCommits(repo, target, source)

      // The sync-back of a merge that will conflict: once the person resolves
      // it, the source contains the target, so the sync-back just matches.
      const pending = conflictedFrom.get(step.source)
      if (isSyncBack(step.edge) && pending?.has(step.target)) {
        results.push({
          ...base,
          commitsIncoming: count,
          commits,
          fastForward: true,
          message: `Will match ${step.source} once the conflict in step ${pending.get(step.target)} is resolved`,
        })
        continue
      }

      // A sync-back usually just moves the earlier branch forward to the
      // freshly merged result, so it can't conflict.
      if (
        isSyncBack(step.edge) &&
        (await gitRaw(["merge-base", "--is-ancestor", target, source], opts))
          .code === 0
      ) {
        virtual.set(step.target, source)
        results.push({
          ...base,
          commitsIncoming: count,
          commits,
          fastForward: true,
        })
        continue
      }

      const merge = await gitRaw(
        [
          "merge-tree",
          "--write-tree",
          "--name-only",
          "--no-messages",
          target,
          source,
        ],
        opts
      )
      const lines = merge.stdout.split("\n")
      if (merge.code === 0) {
        const tree = lines[0].trim()
        const commit = (
          await git(
            ["commit-tree", tree, "-p", target, "-p", source, "-m", "preview"],
            { ...opts, identity: PREVIEW_IDENTITY }
          )
        ).trim()
        virtual.set(step.target, commit)
        results.push({ ...base, commitsIncoming: count, commits })
      } else if (merge.code === 1) {
        const files = lines
          .slice(1)
          .map((l) => l.trim())
          .filter(Boolean)
        results.push({
          ...base,
          result: "conflict",
          commitsIncoming: count,
          commits,
          conflictFiles: [...new Set(files)],
        })
        if (!conflictedFrom.has(step.target))
          conflictedFrom.set(step.target, new Map())
        conflictedFrom.get(step.target)!.set(step.source, results.length)
      } else {
        throw new Error(merge.stderr.trim() || "git merge-tree failed")
      }
    }
    return { checkedAt: now(), steps: results }
  })
}

export async function listCommits(
  repo: Repo,
  from: string,
  to: string,
  limit = 30
): Promise<PreviewCommit[]> {
  const out = await git(
    [
      "log",
      "--no-merges",
      `-n${limit}`,
      "--format=%h%x09%an%x09%s",
      `${from}..${to}`,
    ],
    gitOpts(repo)
  )
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, author, ...subject] = line.split("\t")
      return { sha, author, subject: subject.join("\t") }
    })
}
