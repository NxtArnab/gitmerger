import { createDemoRepo } from "@/lib/server/demo"
import { handle } from "@/lib/server/http"
import { newId, now, store } from "@/lib/server/store"
import { cloneWorkspace } from "@/lib/server/workspace"
import type { Flow, FlowNode } from "@/lib/types"

/** Creates a sample repository plus a ready-made flow to experiment with. */
export async function POST() {
  return handle(async () => {
    const origin = await createDemoRepo()
    const id = newId()
    const defaultBranch = await cloneWorkspace(id, origin)
    await store.addRepo({
      id,
      name: "TaskPilot (demo)",
      source: origin,
      defaultBranch,
      authorName: "BranchFlow",
      authorEmail: "branchflow@localhost",
      createdAt: now(),
    })

    const node = (
      branch: string,
      role: FlowNode["data"]["role"],
      x: number,
      y: number
    ): FlowNode => ({ id: newId(), position: { x, y }, data: { branch, role } })
    const main = node("main", "source", 0, 160)
    const staging = node("staging", "integration", 340, 160)
    const clients = ["client-acme", "client-globex", "client-initech"].map(
      (b, i) => node(b, "client", 700, i * 160)
    )
    const flow: Flow = {
      id: newId(),
      repoId: id,
      name: "Weekly release",
      description: "main → staging → every client branch",
      nodes: [main, staging, ...clients],
      edges: [
        { id: newId(), source: main.id, target: staging.id },
        ...clients.map((c) => ({
          id: newId(),
          source: staging.id,
          target: c.id,
        })),
      ],
      createdAt: now(),
      updatedAt: now(),
    }
    await store.addFlow(flow)
    return { repoId: id, flowId: flow.id }
  })
}
