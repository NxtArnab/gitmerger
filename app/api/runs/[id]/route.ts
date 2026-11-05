import { found, handle } from "@/lib/server/http"
import { detectInterrupted } from "@/lib/server/runner"
import { store } from "@/lib/server/store"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params
    const run = detectInterrupted(found(store.run(id), "Run"))
    return { run, repo: store.repo(run.repoId), flow: store.flow(run.flowId) }
  })
}
