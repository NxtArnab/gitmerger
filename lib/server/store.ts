import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { rename, writeFile } from "node:fs/promises"
import path from "node:path"

import type { Flow, Repo, Run } from "@/lib/types"

interface Db {
  repos: Repo[]
  flows: Flow[]
  runs: Run[]
}

// The data folder is chosen at runtime; turbopackIgnore stops output tracing
// from copying the whole project into the standalone build.
export const DATA_DIR = path.resolve(
  process.env.MERGER_DATA_DIR ??
    path.join(/* turbopackIgnore: true */ process.cwd(), ".merger-data")
)
const DB_FILE = path.join(DATA_DIR, "db.json")

// Kept on globalThis so dev-mode hot reloads share one copy.
const g = globalThis as unknown as {
  __mergerDb?: Db
  __mergerWrite?: Promise<void>
}

function load(): Db {
  if (g.__mergerDb) return g.__mergerDb
  mkdirSync(DATA_DIR, { recursive: true })
  const db: Db = existsSync(DB_FILE)
    ? JSON.parse(readFileSync(DB_FILE, "ascii"))
    : { repos: [], flows: [], runs: [] }
  g.__mergerDb = db
  return db
}

function persist() {
  const snapshot = JSON.stringify(load(), null, 2)
  const tmp = `${DB_FILE}.tmp`
  g.__mergerWrite = (g.__mergerWrite ?? Promise.resolve())
    .then(async () => {
      await writeFile(tmp, snapshot)
      await rename(tmp, DB_FILE)
    })
    .catch((err) => console.error("[store] failed to save", err))
  return g.__mergerWrite
}

export const newId = () => randomUUID().slice(0, 8)
export const now = () => new Date().toISOString()

export const store = {
  repos: () => load().repos,
  repo: (id: string) => load().repos.find((r) => r.id === id),
  flows: () => load().flows,
  flow: (id: string) => load().flows.find((f) => f.id === id),
  runs: () => load().runs,
  run: (id: string) => load().runs.find((r) => r.id === id),

  async addRepo(repo: Repo) {
    load().repos.push(repo)
    await persist()
  },
  async removeRepo(id: string) {
    const db = load()
    db.repos = db.repos.filter((r) => r.id !== id)
    db.flows = db.flows.filter((f) => f.repoId !== id)
    db.runs = db.runs.filter((r) => r.repoId !== id)
    await persist()
  },
  async addFlow(flow: Flow) {
    load().flows.push(flow)
    await persist()
  },
  async updateFlow(id: string, patch: Partial<Flow>) {
    const flow = store.flow(id)
    if (!flow) return undefined
    Object.assign(flow, patch, { updatedAt: now() })
    await persist()
    return flow
  },
  async removeFlow(id: string) {
    const db = load()
    db.flows = db.flows.filter((f) => f.id !== id)
    await persist()
  },
  async addRun(run: Run) {
    load().runs.unshift(run)
    await persist()
  },
  /** Runs are mutated in place by the runner; call this to save them. */
  save: persist,
}
