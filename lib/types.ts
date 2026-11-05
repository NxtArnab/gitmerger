// Shared data model used by both the API and the UI.

export type BranchRole = "source" | "integration" | "client"

export interface Repo {
  id: string
  name: string
  /** Remote URL or local path the workspace was cloned from. */
  source: string
  defaultBranch: string
  authorName?: string
  authorEmail?: string
  createdAt: string
}

export interface FlowNode {
  id: string
  position: { x: number; y: number }
  data: { branch: string; role: BranchRole }
}

export interface FlowEdge {
  id: string
  /** Node id whose branch is merged FROM. */
  source: string
  /** Node id whose branch is merged INTO. */
  target: string
  /**
   * "sync-back": points back to an earlier branch (e.g. main -> dev after
   * dev -> main) so both end up with the same, conflict-resolved code.
   */
  kind?: "sync-back"
}

export interface Flow {
  id: string
  repoId: string
  name: string
  description?: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  createdAt: string
  updatedAt: string
}

export type StepStatus =
  | "pending"
  | "running"
  | "merged"
  | "up-to-date"
  | "conflict"
  | "skipped"
  | "failed"
  | "undone"
  | "reverted"

export interface RunStep {
  id: string
  edgeId: string
  source: string
  target: string
  status: StepStatus
  kind?: FlowEdge["kind"]
  /** The target simply moved forward to the source (no merge commit). */
  fastForward?: boolean
  preSha?: string
  postSha?: string
  commitsIncoming?: number
  conflictFiles?: string[]
  error?: string
  startedAt?: string
  finishedAt?: string
}

export type RunStatus =
  | "running"
  | "waiting" // paused on a merge conflict
  | "completed" // all steps done, results only in the workspace
  | "cancelled"
  | "failed"
  | "published" // pushed to the remote
  | "discarded" // local results thrown away before publishing
  | "reverted" // revert commits pushed after publishing
  | "rolled-back" // remote branches force-reset to their pre-run state

export interface LogEntry {
  at: string
  level: "info" | "success" | "warn" | "error" | "cmd"
  message: string
}

export interface Run {
  id: string
  number: number
  flowId: string
  flowName: string
  repoId: string
  status: RunStatus
  steps: RunStep[]
  /** Branch -> commit before the run touched anything. */
  startShas: Record<string, string>
  /** Branch -> commit that was pushed by Publish. */
  publishedShas?: Record<string, string>
  createdAt: string
  finishedAt?: string
  publishedAt?: string
  busy?: boolean
  log: LogEntry[]
}

export interface PreviewCommit {
  sha: string
  subject: string
  author: string
}

export interface PreviewStep {
  edgeId: string
  source: string
  target: string
  result: "clean" | "up-to-date" | "conflict" | "missing"
  kind?: FlowEdge["kind"]
  fastForward?: boolean
  commitsIncoming: number
  commits: PreviewCommit[]
  conflictFiles: string[]
  message?: string
}

export interface PreviewResult {
  checkedAt: string
  steps: PreviewStep[]
}

export interface ConflictFileSummary {
  path: string
  resolved: boolean
}

export interface ConflictFileDetail {
  path: string
  binary: boolean
  /** Contents in the branch being merged INTO (git "ours"). null = deleted there. */
  current: string | null
  /** Contents in the branch being merged FROM (git "theirs"). null = deleted there. */
  incoming: string | null
  base: string | null
  /** Working-tree file with conflict markers. */
  merged: string | null
  resolved: boolean
}

export const ACTIVE_RUN_STATUSES: RunStatus[] = ["running", "waiting"]
/** Runs whose results may exist only in the workspace. */
export const UNPUBLISHED_RUN_STATUSES: RunStatus[] = [
  "completed",
  "cancelled",
  "failed",
]

export const hasLocalChanges = (run: Run) =>
  run.steps.some((s) => s.status === "merged")

/** True when someone still has to publish or discard this run. */
export const needsDecision = (run: Run) =>
  ACTIVE_RUN_STATUSES.includes(run.status) ||
  (UNPUBLISHED_RUN_STATUSES.includes(run.status) && hasLocalChanges(run))
