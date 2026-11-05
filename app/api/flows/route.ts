import { guessRole } from "@/lib/flow-order"
import { found, handle } from "@/lib/server/http"
import { UserError } from "@/lib/server/runner"
import { newId, now, store } from "@/lib/server/store"
import type { Flow, FlowNode } from "@/lib/types"

export async function GET() {
  return handle(async () => ({ flows: store.flows() }))
}

interface CreateFlowBody {
  repoId: string
  name: string
  description?: string
  /** Optional quick start: merge `fanOutFrom` into each of `targets`. */
  fanOutFrom?: string
  targets?: string[]
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = (await request.json()) as CreateFlowBody
    const repo = found(store.repo(body.repoId), "Repository")
    const name = body.name?.trim()
    if (!name) throw new UserError("Give the flow a name.")

    const nodes: FlowNode[] = []
    const edges: Flow["edges"] = []
    if (body.fanOutFrom) {
      const targets = (body.targets ?? []).filter((t) => t !== body.fanOutFrom)
      const source: FlowNode = {
        id: newId(),
        position: { x: 0, y: (Math.max(targets.length, 1) - 1) * 70 },
        data: {
          branch: body.fanOutFrom,
          role: guessRole(body.fanOutFrom, repo.defaultBranch),
        },
      }
      nodes.push(source)
      targets.forEach((branch, i) => {
        const target: FlowNode = {
          id: newId(),
          position: { x: 380, y: i * 140 },
          data: { branch, role: guessRole(branch, repo.defaultBranch) },
        }
        nodes.push(target)
        edges.push({ id: newId(), source: source.id, target: target.id })
      })
    }

    const flow: Flow = {
      id: newId(),
      repoId: repo.id,
      name,
      description: body.description?.trim() || undefined,
      nodes,
      edges,
      createdAt: now(),
      updatedAt: now(),
    }
    await store.addFlow(flow)
    return flow
  })
}
