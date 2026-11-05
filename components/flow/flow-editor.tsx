"use client"

import "@xyflow/react/dist/style.css"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { graphlib, layout } from "@dagrejs/dagre"
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
} from "@xyflow/react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  CheckIcon,
  CloudIcon,
  GitBranchIcon,
  LayoutGridIcon,
  Loader2Icon,
  LockIcon,
  MousePointerClickIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"

import { ThemeToggle } from "@/components/app-header"
import {
  BranchNode,
  MergeEdge,
  SYNC_BACK_STROKE,
  roleMeta,
  type BranchNodeData,
  type BranchNodeType,
  type MergeEdgeData,
  type MergeEdgeType,
} from "@/components/flow/canvas-parts"
import { FlowPanel, type PanelTab } from "@/components/flow/flow-panel"
import {
  runStatusMeta,
  stepStatusMeta,
  toneClasses,
  type Tone,
} from "@/components/status"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { api, useApi } from "@/lib/api"
import { guessRole, orderSteps, wouldCreateCycle } from "@/lib/flow-order"
import { cn } from "@/lib/utils"
import {
  ACTIVE_RUN_STATUSES,
  needsDecision,
  type BranchRole,
  type Flow,
  type FlowEdge,
  type FlowNode,
  type PreviewResult,
  type Repo,
  type Run,
} from "@/lib/types"

const nodeTypes = { branch: BranchNode }
const edgeTypes = { merge: MergeEdge }
const NODE_WIDTH = 240

interface FlowResponse {
  flow: Flow
  repo?: Repo
  runs: Run[]
}

interface BranchInfo {
  name: string
  updated: string
  subject: string
}

const uid = () => crypto.randomUUID().slice(0, 8)

const isActive = (r: Run) => ACTIVE_RUN_STATUSES.includes(r.status) || !!r.busy

type NodeLike = Pick<FlowNode, "id" | "position"> & {
  data: { branch: string; role: BranchRole }
}
type EdgeLike = Pick<FlowEdge, "id" | "source" | "target"> & {
  data?: { kind?: FlowEdge["kind"] }
}

/** React Flow edges keep the sync-back flag in `data`; flows keep it on the edge. */
const plainEdges = (edges: EdgeLike[]) =>
  edges.map((e) => ({ source: e.source, target: e.target, kind: e.data?.kind }))

/** The saved shape of a flow — also used to detect unsaved changes. */
function toPersist(nodes: NodeLike[], edges: EdgeLike[]) {
  return {
    nodes: nodes.map<FlowNode>((n) => ({
      id: n.id,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      data: { branch: n.data.branch, role: n.data.role },
    })),
    edges: edges.map<FlowEdge>((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.data?.kind ? { kind: e.data.kind } : {}),
    })),
  }
}
const serialize = (nodes: NodeLike[], edges: EdgeLike[]) =>
  JSON.stringify(toPersist(nodes, edges))

export function FlowEditor({ flowId }: { flowId: string }) {
  return (
    <ReactFlowProvider>
      <Editor flowId={flowId} />
    </ReactFlowProvider>
  )
}

function Editor({ flowId }: { flowId: string }) {
  const router = useRouter()
  const { screenToFlowPosition, fitView } = useReactFlow()
  const { resolvedTheme } = useTheme()
  const wrapper = React.useRef<HTMLDivElement>(null)

  const { data, error, reload } = useApi<FlowResponse>(
    `/flows/${flowId}`,
    (d) => (d.runs.some(isActive) ? 1200 : false)
  )
  const runs = React.useMemo(() => data?.runs ?? [], [data])
  const latestRun = runs[0]
  const activeRun = runs.find(isActive)
  const overlayRun =
    latestRun && needsDecision(latestRun) ? latestRun : undefined
  const locked = !!activeRun

  const [nodes, setNodes, onNodesChange] = useNodesState<BranchNodeType>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<MergeEdgeType>([])
  const [name, setName] = React.useState("")
  const [tab, setTab] = React.useState<PanelTab>("plan")
  const [preview, setPreview] = React.useState<{
    key: string
    result: PreviewResult
  }>()
  const [previewing, setPreviewing] = React.useState(false)
  const [starting, setStarting] = React.useState(false)
  const [loadedId, setLoadedId] = React.useState<string>()
  const [savedSnapshot, setSavedSnapshot] = React.useState("")
  const saveTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  // ---- load once (adjusting state during render, not in an effect) -----
  if (data && loadedId !== data.flow.id) {
    setLoadedId(data.flow.id)
    setName(data.flow.name)
    setNodes(
      data.flow.nodes.map((n) => ({
        id: n.id,
        type: "branch",
        position: n.position,
        data: { ...n.data },
      }))
    )
    setEdges(
      data.flow.edges.map(({ kind, ...e }) => ({
        ...e,
        type: "merge",
        data: kind ? { kind } : {},
      }))
    )
    setSavedSnapshot(
      serialize(
        data.flow.nodes,
        data.flow.edges.map((e) => ({ ...e, data: { kind: e.kind } }))
      )
    )
    if (data.runs[0] && needsDecision(data.runs[0])) setTab("run")
  }
  React.useEffect(() => {
    if (loadedId)
      requestAnimationFrame(() => fitView({ padding: 0.25, maxZoom: 1 }))
  }, [loadedId, fitView])

  // ---- persistence ----------------------------------------------------
  const persist = React.useMemo(() => toPersist(nodes, edges), [nodes, edges])
  const snapshot = JSON.stringify(persist)
  const topoKey = JSON.stringify([
    persist.edges,
    persist.nodes.map((n) => [n.id, n.data.branch]),
  ])
  const dirty = !!loadedId && snapshot !== savedSnapshot

  const save = React.useCallback(async () => {
    clearTimeout(saveTimer.current)
    if (!loadedId || snapshot === savedSnapshot) return
    try {
      await api(`/flows/${flowId}`, {
        method: "PUT",
        body: JSON.parse(snapshot),
      })
      setSavedSnapshot(snapshot)
    } catch (err) {
      toast.error(`Couldn't save: ${err instanceof Error ? err.message : err}`)
    }
  }, [flowId, snapshot, savedSnapshot, loadedId])

  React.useEffect(() => {
    if (!dirty) return
    saveTimer.current = setTimeout(save, 700)
    return () => clearTimeout(saveTimer.current)
  }, [dirty, save])

  // ---- ordering & overlays ---------------------------------------------
  const order = React.useMemo(
    () => orderSteps(persist.nodes, persist.edges),
    [persist]
  )
  const stepIndex = new Map(order.steps.map((s) => [s.edge.id, s.index + 1]))
  const previewResult = preview?.key === topoKey ? preview.result : undefined

  const displayNodes = React.useMemo<BranchNodeType[]>(() => {
    return nodes.map((n) => {
      const extra: Partial<BranchNodeData> = {
        status: undefined,
        detail: undefined,
        resolveHref: undefined,
      }
      if (overlayRun) {
        const incoming = overlayRun.steps.filter(
          (s) => s.target === n.data.branch
        )
        const conflict = incoming.find((s) => s.status === "conflict")
        if (conflict) {
          extra.status = { tone: "warning", label: "Conflict", pulse: true }
          extra.detail = `${conflict.conflictFiles?.length} file(s) need you`
          extra.resolveHref = `/runs/${overlayRun.id}/resolve`
        } else if (incoming.some((s) => s.status === "running")) {
          extra.status = { tone: "info", label: "Merging", pulse: true }
        } else if (incoming.some((s) => s.status === "failed")) {
          extra.status = { tone: "danger", label: "Failed" }
        } else if (incoming.some((s) => s.status === "pending")) {
          extra.status = { tone: "neutral", label: "Waiting" }
        } else if (incoming.some((s) => s.status === "merged")) {
          const count = incoming.reduce(
            (sum, s) =>
              sum + (s.status === "merged" ? (s.commitsIncoming ?? 0) : 0),
            0
          )
          extra.status = { tone: "success", label: "Updated" }
          extra.detail = `${count} commit(s) merged locally`
        } else if (incoming.some((s) => s.status === "skipped")) {
          extra.status = { tone: "neutral", label: "Skipped" }
        } else if (incoming.length) {
          extra.status = { tone: "success", label: "Up to date" }
        }
      } else if (previewResult) {
        const incoming = previewResult.steps.filter(
          (s) => s.target === n.data.branch
        )
        const conflict = incoming.filter((s) => s.result === "conflict")
        if (
          incoming.some((s) => s.result === "missing") ||
          previewResult.steps.some(
            (s) => s.result === "missing" && s.source === n.data.branch
          )
        ) {
          extra.status = { tone: "danger", label: "Not found" }
          extra.detail = "Branch doesn't exist on the remote"
        } else if (conflict.length) {
          extra.status = { tone: "warning", label: "Will conflict" }
          extra.detail = `${conflict.reduce((s, c) => s + c.conflictFiles.length, 0)} file(s) changed on both sides`
        } else if (incoming.length) {
          const count = incoming.reduce((s, c) => s + c.commitsIncoming, 0)
          extra.status = count
            ? { tone: "success", label: "Clean" }
            : { tone: "neutral", label: "Up to date" }
          extra.detail = count
            ? `${count} new commit(s) will come in`
            : "Nothing new to bring in"
        }
      }
      return { ...n, data: { ...n.data, ...extra } }
    })
  }, [nodes, overlayRun, previewResult])

  const displayEdges = React.useMemo<MergeEdgeType[]>(() => {
    return edges.map((e) => {
      const d: MergeEdgeData = {
        step: stepIndex.get(e.id),
        locked,
        kind: e.data?.kind,
      }
      const runStep = overlayRun?.steps.find((s) => s.edgeId === e.id)
      const prev = previewResult?.steps.find((s) => s.edgeId === e.id)
      if (runStep) {
        const meta = stepStatusMeta[runStep.status]
        d.tone = runStep.status === "pending" ? undefined : meta.tone
        d.label = meta.label
        d.flowing = runStep.status === "running"
      } else if (prev) {
        const map: Record<string, [Tone, string]> = {
          clean: [
            "success",
            prev.fastForward ? "will match" : `${prev.commitsIncoming} new`,
          ],
          "up-to-date": ["neutral", "up to date"],
          conflict: ["warning", "conflict"],
          missing: ["danger", "missing"],
        }
        ;[d.tone, d.label] = map[prev.result]
        d.dashed = prev.result === "conflict"
      }
      const color = d.tone
        ? toneClasses[d.tone].stroke
        : e.selected
          ? "var(--primary)"
          : d.kind
            ? SYNC_BACK_STROKE
            : "var(--muted-foreground)"
      return {
        ...e,
        data: d,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color,
        },
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, overlayRun, previewResult, locked, topoKey])

  // ---- notify on run state changes --------------------------------------
  const lastStatus = React.useRef<Record<string, string>>({})
  React.useEffect(() => {
    if (!latestRun) return
    const prev = lastStatus.current[latestRun.id]
    lastStatus.current[latestRun.id] = latestRun.status
    if (!prev || prev === latestRun.status) return
    if (latestRun.status === "waiting") {
      const step = latestRun.steps.find((s) => s.status === "conflict")
      toast.warning(
        `Paused: ${step?.source} → ${step?.target} has a conflict`,
        {
          action: {
            label: "Resolve",
            onClick: () => router.push(`/runs/${latestRun.id}/resolve`),
          },
          duration: 10000,
        }
      )
    } else if (latestRun.status === "completed") {
      toast.success("All merges done. Review the result, then Publish.")
    } else if (latestRun.status === "failed") {
      toast.error(`Run #${latestRun.number} failed — see the activity log`)
    }
  }, [latestRun, router])

  // ---- editing -----------------------------------------------------------
  const isValidConnection = React.useCallback(
    (c: Connection | Edge) =>
      !locked &&
      !!c.source &&
      !!c.target &&
      c.source !== c.target &&
      !edges.some((e) => e.source === c.source && e.target === c.target),
    [edges, locked]
  )

  const onConnect = React.useCallback(
    (c: Connection) => {
      if (!isValidConnection(c)) return
      // Pointing back to a branch that feeds this one = sync-back, not a loop.
      const syncBack = wouldCreateCycle(plainEdges(edges), c.source, c.target)
      setEdges((es) => [
        ...es,
        {
          id: uid(),
          source: c.source,
          target: c.target,
          type: "merge",
          data: syncBack ? { kind: "sync-back" } : {},
        },
      ])
      if (syncBack) {
        const name = (id: string) => nodes.find((n) => n.id === id)?.data.branch
        toast.info(
          `Added as a sync-back: once ${name(c.source)} has all its merges, ${name(c.target)} gets the same result.`
        )
      }
    },
    [isValidConnection, setEdges, edges, nodes]
  )

  const addBranch = React.useCallback(
    (branch: string, position?: { x: number; y: number }) => {
      if (locked) return
      if (nodes.some((n) => n.data.branch === branch)) {
        toast.info(`${branch} is already on the canvas`)
        return
      }
      let pos = position
      if (!pos) {
        const rect = wrapper.current?.getBoundingClientRect()
        const center = screenToFlowPosition({
          x: (rect?.left ?? 0) + (rect?.width ?? 800) / 2,
          y: (rect?.top ?? 0) + (rect?.height ?? 600) / 2,
        })
        pos = {
          x: center.x - NODE_WIDTH / 2 + (Math.random() - 0.5) * 80,
          y: center.y - 40 + (Math.random() - 0.5) * 80,
        }
      }
      setNodes((ns) => [
        ...ns.map((n) => ({ ...n, selected: false })),
        {
          id: uid(),
          type: "branch",
          position: pos,
          selected: true,
          data: { branch, role: guessRole(branch, data?.repo?.defaultBranch) },
        },
      ])
    },
    [locked, nodes, screenToFlowPosition, setNodes, data?.repo?.defaultBranch]
  )

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const branch = e.dataTransfer.getData("application/x-branch")
    if (!branch) return
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    addBranch(branch, { x: p.x - NODE_WIDTH / 2, y: p.y - 40 })
  }

  function autoArrange() {
    const g = new graphlib.Graph()
    g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 140 })
    g.setDefaultEdgeLabel(() => ({}))
    for (const n of nodes)
      g.setNode(n.id, { width: NODE_WIDTH, height: n.measured?.height ?? 90 })
    for (const e of edges) g.setEdge(e.source, e.target)
    layout(g)
    setNodes((ns) =>
      ns.map((n) => {
        const p = g.node(n.id)
        return {
          ...n,
          position: {
            x: p.x - NODE_WIDTH / 2,
            y: p.y - (n.measured?.height ?? 90) / 2,
          },
        }
      })
    )
    setTimeout(() => fitView({ padding: 0.25, maxZoom: 1, duration: 400 }), 50)
  }

  function setRole(id: string, role: BranchRole) {
    setNodes((ns) =>
      ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, role } } : n))
    )
  }

  async function runPreview() {
    await save()
    setPreviewing(true)
    try {
      const result = await api<PreviewResult>(`/flows/${flowId}/preview`, {
        method: "POST",
      })
      setPreview({ key: topoKey, result })
      setTab("plan")
      const conflicts = result.steps.filter(
        (s) => s.result === "conflict"
      ).length
      if (conflicts)
        toast.warning(`${conflicts} merge(s) will need conflict resolution`)
      else toast.success("Everything merges cleanly")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err), {
        duration: 10000,
      })
    } finally {
      setPreviewing(false)
    }
  }

  async function startRun() {
    await save()
    setStarting(true)
    try {
      await api(`/flows/${flowId}/runs`, { method: "POST" })
      setTab("run")
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err), {
        duration: 10000,
      })
    } finally {
      setStarting(false)
    }
  }

  async function rename() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === data?.flow.name) return
    await api(`/flows/${flowId}`, {
      method: "PUT",
      body: { name: trimmed },
    }).catch(() => {})
    void reload()
  }

  async function deleteFlow() {
    if (
      !window.confirm(
        `Delete the flow "${name}"? Its run history stays; your git branches are not affected.`
      )
    )
      return
    await api(`/flows/${flowId}`, { method: "DELETE" })
    router.push("/")
  }

  if (error && !data)
    return (
      <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          {error}
          <Button
            variant="outline"
            render={<Link href="/" />}
            nativeButton={false}
          >
            Back to dashboard
          </Button>
        </div>
      </div>
    )

  const selectedNodes = nodes.filter((n) => n.selected)
  const selectedEdges = edges.filter((e) => e.selected)

  return (
    <div className="flex h-svh flex-col bg-background">
      {/* ---- top bar ---- */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur-xl">
        <Button
          variant="ghost"
          size="icon"
          render={<Link href="/" />}
          nativeButton={false}
          aria-label="Back"
        >
          <ArrowLeftIcon />
        </Button>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[0.6875rem] text-muted-foreground">
            {data?.repo?.name ?? "…"}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="-ml-1 w-64 truncate rounded-md bg-transparent px-1 text-sm font-semibold outline-none hover:bg-muted focus:bg-muted"
            aria-label="Flow name"
          />
        </div>
        <span className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
          {!dirty ? (
            <>
              <CloudIcon className="size-3" /> Saved
            </>
          ) : (
            <>
              <Loader2Icon className="size-3 animate-spin" /> Saving…
            </>
          )}
        </span>

        {activeRun && (
          <span
            className={cn(
              "ml-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium",
              toneClasses[runStatusMeta[activeRun.status].tone].badge
            )}
          >
            <LockIcon className="size-3" /> Run #{activeRun.number}{" "}
            {runStatusMeta[activeRun.status].label.toLowerCase()} — editing
            locked
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            onClick={autoArrange}
            disabled={!nodes.length}
          >
            <LayoutGridIcon /> Auto-arrange
          </Button>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label="More" />}
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem variant="destructive" onClick={deleteFlow}>
                <Trash2Icon /> Delete flow
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {data?.repo && (
          <BranchPalette
            repoId={data.repo.id}
            onCanvas={new Set(nodes.map((n) => n.data.branch))}
            onAdd={(b) => addBranch(b)}
            locked={locked}
          />
        )}

        {/* ---- canvas ---- */}
        <div
          ref={wrapper}
          className="relative min-w-0 flex-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <ReactFlow<BranchNodeType, MergeEdgeType>
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            nodesConnectable={!locked}
            deleteKeyCode={locked ? null : ["Backspace", "Delete"]}
            onBeforeDelete={async () => !locked}
            connectionRadius={36}
            minZoom={0.2}
            maxZoom={1.75}
            colorMode={resolvedTheme === "dark" ? "dark" : "light"}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap
              pannable
              zoomable
              position="bottom-right"
              className="hidden! lg:block!"
              nodeBorderRadius={10}
            />

            {nodes.length === 0 && data && (
              <Panel
                position="top-center"
                className="pointer-events-none mt-[18vh]!"
              >
                <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border bg-card/90 p-6 text-center shadow-xl backdrop-blur">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <MousePointerClickIcon className="size-5" />
                  </span>
                  <h3 className="text-sm font-semibold">
                    Build your merge flow
                  </h3>
                  <ol className="flex flex-col gap-1.5 text-left text-xs text-muted-foreground">
                    <li>
                      <b className="text-foreground">1.</b> Add branches from
                      the list on the left (click{" "}
                      <PlusIcon className="inline size-3" /> or drag them here).
                    </li>
                    <li>
                      <b className="text-foreground">2.</b> Drag from a
                      branch&apos;s <b>right dot</b> to another branch&apos;s{" "}
                      <b>left dot</b>. That means “merge into”.
                    </li>
                    <li>
                      <b className="text-foreground">3.</b> Press{" "}
                      <b>Check for conflicts</b>, then <b>Run flow</b>.
                    </li>
                  </ol>
                </div>
              </Panel>
            )}

            {(selectedNodes.length === 1 || selectedEdges.length === 1) &&
              !locked && (
                <Panel position="bottom-center">
                  <Inspector
                    node={
                      selectedNodes.length === 1 ? selectedNodes[0] : undefined
                    }
                    edge={
                      selectedNodes.length === 0 ? selectedEdges[0] : undefined
                    }
                    nodes={nodes}
                    stepIndex={stepIndex}
                    onRole={setRole}
                    onRemoveNode={(id) => {
                      setNodes((ns) => ns.filter((n) => n.id !== id))
                      setEdges((es) =>
                        es.filter((e) => e.source !== id && e.target !== id)
                      )
                    }}
                    onRemoveEdge={(id) =>
                      setEdges((es) => es.filter((e) => e.id !== id))
                    }
                  />
                </Panel>
              )}
          </ReactFlow>
        </div>

        <FlowPanel
          tab={tab}
          onTab={setTab}
          steps={order.steps}
          orderError={order.error}
          preview={previewResult}
          previewing={previewing}
          onPreview={runPreview}
          onRun={startRun}
          starting={starting}
          run={latestRun}
          runs={runs}
          onRunChanged={() => void reload()}
          locked={locked}
        />
      </div>
    </div>
  )
}

function Inspector({
  node,
  edge,
  nodes,
  stepIndex,
  onRole,
  onRemoveNode,
  onRemoveEdge,
}: {
  node?: BranchNodeType
  edge?: MergeEdgeType
  nodes: BranchNodeType[]
  stepIndex: Map<string, number>
  onRole: (id: string, role: BranchRole) => void
  onRemoveNode: (id: string) => void
  onRemoveEdge: (id: string) => void
}) {
  if (node) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border bg-card/95 p-2 pl-4 shadow-xl backdrop-blur">
        <span className="max-w-40 truncate font-mono text-xs font-semibold">
          {node.data.branch}
        </span>
        <div className="flex rounded-lg bg-muted p-0.5">
          {(Object.keys(roleMeta) as BranchRole[]).map((role) => {
            const meta = roleMeta[role]
            return (
              <button
                key={role}
                title={meta.description}
                onClick={() => onRole(node.id, role)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-[0.6875rem] font-medium text-muted-foreground transition-colors hover:text-foreground",
                  node.data.role === role &&
                    "bg-background text-foreground shadow-sm"
                )}
              >
                <meta.icon className="size-3" /> {meta.label}
              </button>
            )
          })}
        </div>
        <Button variant="destructive" onClick={() => onRemoveNode(node.id)}>
          <Trash2Icon /> Remove
        </Button>
      </div>
    )
  }
  if (edge) {
    const branch = (id: string) => nodes.find((n) => n.id === id)?.data.branch
    return (
      <div className="flex items-center gap-3 rounded-2xl border bg-card/95 p-2 pl-4 shadow-xl backdrop-blur">
        {edge.data?.kind === "sync-back" ? (
          <span className="max-w-md text-xs">
            <span className="font-medium text-violet-600 dark:text-violet-300">
              Step {stepIndex.get(edge.id)} · sync back:
            </span>{" "}
            once{" "}
            <span className="font-mono font-semibold">
              {branch(edge.source)}
            </span>{" "}
            has all its merges (conflicts resolved), copy that result back into{" "}
            <span className="font-mono font-semibold">
              {branch(edge.target)}
            </span>{" "}
            so both branches match.
          </span>
        ) : (
          <span className="text-xs">
            <span className="font-medium">Step {stepIndex.get(edge.id)}:</span>{" "}
            bring changes from{" "}
            <span className="font-mono font-semibold">
              {branch(edge.source)}
            </span>{" "}
            into{" "}
            <span className="font-mono font-semibold">
              {branch(edge.target)}
            </span>
          </span>
        )}
        <Button variant="destructive" onClick={() => onRemoveEdge(edge.id)}>
          <Trash2Icon /> Remove
        </Button>
      </div>
    )
  }
  return null
}

function BranchPalette({
  repoId,
  onCanvas,
  onAdd,
  locked,
}: {
  repoId: string
  onCanvas: Set<string>
  onAdd: (branch: string) => void
  locked: boolean
}) {
  const [query, setQuery] = React.useState("")
  const [refreshing, setRefreshing] = React.useState(false)
  const { data, error, setData } = useApi<{ branches: BranchInfo[] }>(
    `/repos/${repoId}/branches`
  )

  async function refresh() {
    setRefreshing(true)
    try {
      setData(await api(`/repos/${repoId}/branches?refresh`))
      toast.success("Branch list updated from the remote")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setRefreshing(false)
    }
  }

  const branches = (data?.branches ?? []).filter((b) =>
    b.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-background/95">
      <div className="flex flex-col gap-2 border-b p-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold">Branches</h3>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            onClick={refresh}
            disabled={refreshing}
            title="Fetch latest branches from the remote"
          >
            <RefreshCwIcon className={cn(refreshing && "animate-spin")} />
          </Button>
        </div>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search branches"
            className="pl-7"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {!data && !error && (
          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
            <Loader2Icon className="size-3 animate-spin" /> Loading…
          </div>
        )}
        {error && <p className="p-3 text-xs text-destructive">{error}</p>}
        {branches.map((b) => {
          const added = onCanvas.has(b.name)
          return (
            <div
              key={b.name}
              draggable={!added && !locked}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-branch", b.name)
                e.dataTransfer.effectAllowed = "move"
              }}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
                added
                  ? "opacity-50"
                  : "cursor-grab hover:bg-muted active:cursor-grabbing"
              )}
              title={b.subject}
            >
              <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-xs">{b.name}</div>
                <div className="truncate text-[0.625rem] text-muted-foreground">
                  {b.updated}
                </div>
              </div>
              {added ? (
                <CheckIcon className="size-3.5 text-muted-foreground" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => onAdd(b.name)}
                  disabled={locked}
                  aria-label={`Add ${b.name}`}
                >
                  <PlusIcon />
                </Button>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex flex-col gap-2 border-t p-3 text-[0.6875rem] text-muted-foreground">
        {(Object.keys(roleMeta) as BranchRole[]).map((role) => {
          const meta = roleMeta[role]
          return (
            <div key={role} className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-md",
                  meta.chip
                )}
              >
                <meta.icon className="size-3" />
              </span>
              {meta.label}
            </div>
          )
        })}
        <p className="mt-1 leading-relaxed">
          Click a branch on the canvas to change its role. Select an arrow and
          press <kbd className="rounded border px-1">Delete</kbd> to remove it.
        </p>
      </div>
    </aside>
  )
}
