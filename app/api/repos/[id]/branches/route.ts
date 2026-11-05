import { withRepoLock } from "@/lib/server/git"
import { found, handle } from "@/lib/server/http"
import { store } from "@/lib/server/store"
import { fetchOrigin, listBranches } from "@/lib/server/workspace"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params
    const repo = found(store.repo(id), "Repository")
    const refresh = new URL(request.url).searchParams.has("refresh")
    return withRepoLock(repo.id, async () => {
      if (refresh) await fetchOrigin(repo)
      return { branches: await listBranches(repo) }
    })
  })
}
