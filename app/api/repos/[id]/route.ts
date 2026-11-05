import { rm } from "node:fs/promises"
import path from "node:path"

import { found, handle } from "@/lib/server/http"
import { UserError } from "@/lib/server/runner"
import { DATA_DIR, store } from "@/lib/server/store"
import { removeWorkspace } from "@/lib/server/workspace"
import { ACTIVE_RUN_STATUSES } from "@/lib/types"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params
    const repo = found(store.repo(id), "Repository")
    if (
      store
        .runs()
        .some((r) => r.repoId === id && ACTIVE_RUN_STATUSES.includes(r.status))
    )
      throw new UserError(
        "A run is in progress for this repository. Cancel it first."
      )
    await store.removeRepo(id)
    await removeWorkspace(id)

    // Demo repos also own their generated sample remote; real repos are never touched.
    const demoDir = path.join(DATA_DIR, "demo") + path.sep
    const source = path.resolve(repo.source)
    if (source.startsWith(demoDir))
      await rm(path.dirname(source), { recursive: true, force: true })
    return { ok: true }
  })
}
