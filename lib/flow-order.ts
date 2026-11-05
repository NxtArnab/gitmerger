import type { FlowEdge, FlowNode } from "./types"

export interface OrderedStep {
  edge: FlowEdge
  source: string
  target: string
  index: number
}

/**
 * Works out the order merges run in.
 *
 * Rule 1: a branch only passes changes on after it has received all of its
 *         own incoming merges (main -> staging runs before staging -> client).
 * Rule 2: when several merges are equally ready, the one higher up on the
 *         canvas runs first (then left to right).
 * Rule 3: a sync-back arrow (pointing back to an earlier branch) runs right
 *         after its source has received all of its merges, so the earlier
 *         branch gets the finished, conflict-resolved result.
 */
export function orderSteps(
  nodes: FlowNode[],
  edges: FlowEdge[]
): { steps: OrderedStep[]; error?: string } {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const validEdges = edges.filter(
    (e) => byId.has(e.source) && byId.has(e.target)
  )
  const forward = validEdges.filter((e) => !isSyncBack(e))
  const indegree = new Map<string, number>(nodes.map((n) => [n.id, 0]))
  for (const e of forward) {
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1)
  }

  const byPosition = (a: FlowNode, b: FlowNode) =>
    a.position.y - b.position.y || a.position.x - b.position.x

  const ready = nodes.filter((n) => indegree.get(n.id) === 0)
  const rank = new Map<string, number>()
  while (ready.length) {
    ready.sort(byPosition)
    const node = ready.shift()!
    rank.set(node.id, rank.size)
    for (const e of forward) {
      if (e.source !== node.id) continue
      const left = (indegree.get(e.target) ?? 0) - 1
      indegree.set(e.target, left)
      if (left === 0) ready.push(byId.get(e.target)!)
    }
  }

  if (rank.size !== nodes.length) {
    return {
      steps: [],
      error:
        "The flow has a loop (a branch eventually merges back into itself). Remove one of the connections in the loop.",
    }
  }

  // A normal merge runs at its target's turn; a sync-back runs at its
  // source's turn, after that source's own incoming merges.
  const key = (e: FlowEdge) =>
    isSyncBack(e)
      ? [rank.get(e.source)!, 1, rank.get(e.target)!]
      : [rank.get(e.target)!, 0, rank.get(e.source)!]
  const sorted = [...validEdges].sort((a, b) => {
    const [ka, kb] = [key(a), key(b)]
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2]
  })
  return {
    steps: sorted.map((edge, index) => ({
      edge,
      source: byId.get(edge.source)!.data.branch,
      target: byId.get(edge.target)!.data.branch,
      index,
    })),
  }
}

export const isSyncBack = (e: Pick<FlowEdge, "kind">) => e.kind === "sync-back"

/**
 * True if adding source -> target would make a loop through normal merges.
 * Such an arrow is added as a sync-back instead of being refused.
 */
export function wouldCreateCycle(
  edges: Pick<FlowEdge, "source" | "target" | "kind">[],
  source: string,
  target: string
) {
  if (source === target) return true
  const stack = [target]
  const seen = new Set<string>()
  while (stack.length) {
    const current = stack.pop()!
    if (current === source) return true
    if (seen.has(current)) continue
    seen.add(current)
    for (const e of edges)
      if (e.source === current && !isSyncBack(e)) stack.push(e.target)
  }
  return false
}

export function guessRole(branch: string, defaultBranch?: string) {
  const name = branch.toLowerCase()
  if (
    name === defaultBranch?.toLowerCase() ||
    ["main", "master", "trunk"].includes(name)
  )
    return "source" as const
  if (/^(develop|dev|staging|stage|release|integration|qa)([/-]|$)/.test(name))
    return "integration" as const
  return "client" as const
}
