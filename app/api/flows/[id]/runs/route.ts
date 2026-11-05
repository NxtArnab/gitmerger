import { found, handle } from "@/lib/server/http"
import { createRun } from "@/lib/server/runner"
import { store } from "@/lib/server/store"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params
    const flow = found(store.flow(id), "Flow")
    const repo = found(store.repo(flow.repoId), "Repository")
    return createRun(repo, flow)
  })
}
