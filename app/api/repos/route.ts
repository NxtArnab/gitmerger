import { found, handle } from "@/lib/server/http"
import { UserError } from "@/lib/server/runner"
import { newId, now, store } from "@/lib/server/store"
import {
  cloneWorkspace,
  defaultIdentity,
  workspaceExists,
} from "@/lib/server/workspace"
import type { Repo } from "@/lib/types"

export async function GET() {
  return handle(async () => ({
    repos: store.repos().map((r) => ({ ...r, ready: workspaceExists(r.id) })),
    identity: await defaultIdentity(),
  }))
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = (await request.json()) as Partial<Repo>
    const name = body.name?.trim()
    const source = body.source?.trim()
    if (!name || !source)
      throw new UserError(
        "Give the repository a name and a URL or folder path."
      )

    const id = newId()
    const defaultBranch = await cloneWorkspace(id, source)
    const repo: Repo = {
      id,
      name,
      source,
      defaultBranch,
      authorName: body.authorName?.trim() || undefined,
      authorEmail: body.authorEmail?.trim() || undefined,
      createdAt: now(),
    }
    await store.addRepo(repo)
    return found(store.repo(id), "Repository")
  })
}
