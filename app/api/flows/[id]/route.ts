import { found, handle } from "@/lib/server/http"
import { detectInterrupted } from "@/lib/server/runner"
import { store } from "@/lib/server/store"
import type { Flow } from "@/lib/types"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const flow = found(store.flow(id), "Flow")
    const runs = store
      .runs()
      .filter((r) => r.flowId === id)
      .slice(0, 20)
      .map(detectInterrupted)
    return { flow, repo: store.repo(flow.repoId), runs }
  })
}

export async function PUT(request: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    found(store.flow(id), "Flow")
    const body = (await request.json()) as Partial<Flow>
    const patch: Partial<Flow> = {}
    if (typeof body.name === "string" && body.name.trim())
      patch.name = body.name.trim()
    if (typeof body.description === "string")
      patch.description = body.description
    if (Array.isArray(body.nodes)) patch.nodes = body.nodes
    if (Array.isArray(body.edges)) patch.edges = body.edges
    return store.updateFlow(id, patch)
  })
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    found(store.flow(id), "Flow")
    await store.removeFlow(id)
    return { ok: true }
  })
}
