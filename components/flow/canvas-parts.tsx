"use client"

import Link from "next/link"
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  Position,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import {
  Building2Icon,
  GitCommitHorizontalIcon,
  Layers3Icon,
  RefreshCwIcon,
  WrenchIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"

import { toneClasses, type Tone } from "@/components/status"
import { cn } from "@/lib/utils"
import type { BranchRole } from "@/lib/types"

export const roleMeta: Record<
  BranchRole,
  { label: string; icon: LucideIcon; chip: string; description: string }
> = {
  source: {
    label: "Main source",
    icon: GitCommitHorizontalIcon,
    chip: "bg-primary/12 text-primary",
    description: "Where new features and fixes land first (usually main).",
  },
  integration: {
    label: "Integration",
    icon: Layers3Icon,
    chip: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    description: "An in-between branch such as staging or develop.",
  },
  client: {
    label: "Client",
    icon: Building2Icon,
    chip: "bg-muted text-muted-foreground",
    description: "A customised branch for one customer.",
  },
}

export interface BranchNodeData extends Record<string, unknown> {
  branch: string
  role: BranchRole
  status?: { tone: Tone; label: string; pulse?: boolean }
  detail?: string
  resolveHref?: string
}

export type BranchNodeType = Node<BranchNodeData, "branch">

const handleClass =
  "size-3.5! rounded-full! border-2! border-background! bg-muted-foreground/60! transition-all hover:scale-125 hover:bg-primary!"

export function BranchNode({ data, selected }: NodeProps<BranchNodeType>) {
  const role = roleMeta[data.role]
  const tone = data.status ? toneClasses[data.status.tone] : undefined
  return (
    <div
      className={cn(
        "group relative w-60 rounded-xl border bg-card/95 shadow-sm backdrop-blur transition-shadow",
        selected && "border-primary/60 shadow-lg shadow-primary/10",
        tone && `ring-2 ${tone.ring}`
      )}
    >
      {data.status?.pulse && tone && (
        <span
          className={cn(
            "pointer-events-none absolute -inset-1.5 animate-pulse rounded-[1rem] ring-4",
            tone.ring
          )}
        />
      )}
      <Handle
        type="target"
        position={Position.Left}
        className={handleClass}
        title="Incoming: drop a connection here to merge INTO this branch"
      />
      <div className="flex items-center gap-2 px-3 pt-3">
        <span
          className={cn("grid size-6 place-items-center rounded-md", role.chip)}
        >
          <role.icon className="size-3.5" />
        </span>
        <span className="text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
          {role.label}
        </span>
        {data.status && (
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium",
              tone!.badge
            )}
          >
            <span className={cn("size-1.5 rounded-full", tone!.dot)} />
            {data.status.label}
          </span>
        )}
      </div>
      <div
        className="truncate px-3 pt-1.5 pb-3 font-mono text-[0.8125rem] font-semibold"
        title={data.branch}
      >
        {data.branch}
      </div>
      {(data.detail || data.resolveHref) && (
        <div className="flex items-center gap-2 border-t px-3 py-2 text-[0.6875rem] text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">{data.detail}</span>
          {data.resolveHref && (
            <Link
              href={data.resolveHref}
              className="nodrag inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-1 text-[0.6875rem] font-medium text-white shadow-sm hover:bg-amber-600"
            >
              <WrenchIcon className="size-3" /> Resolve
            </Link>
          )}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className={handleClass}
        title="Outgoing: drag from here to another branch to merge this branch INTO it"
      />
    </div>
  )
}

export interface MergeEdgeData extends Record<string, unknown> {
  step?: number
  tone?: Tone
  flowing?: boolean
  dashed?: boolean
  label?: string
  locked?: boolean
  kind?: "sync-back"
}

export type MergeEdgeType = Edge<MergeEdgeData, "merge">

export const SYNC_BACK_STROKE = "oklch(0.62 0.2 293)"
const LOOP_GAP = 28

/**
 * A sync-back arrow points to a branch on its left. Instead of a bezier
 * cutting through the nodes, route it out right, under the nodes, and back
 * in from the left, with rounded corners.
 */
function loopPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number
): [string, number, number] {
  const low = Math.max(sy, ty) + 78
  const points = [
    [sx, sy],
    [sx + LOOP_GAP, sy],
    [sx + LOOP_GAP, low],
    [tx - LOOP_GAP, low],
    [tx - LOOP_GAP, ty],
    [tx, ty],
  ]
  let d = `M ${sx} ${sy}`
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1]
    const [cx, cy] = points[i]
    const [nx, ny] = points[i + 1]
    const r = Math.min(
      14,
      Math.hypot(cx - px, cy - py) / 2,
      Math.hypot(nx - cx, ny - cy) / 2
    )
    const inX = cx - Math.sign(cx - px) * r
    const inY = cy - Math.sign(cy - py) * r
    const outX = cx + Math.sign(nx - cx) * r
    const outY = cy + Math.sign(ny - cy) * r
    d += ` L ${inX} ${inY} Q ${cx} ${cy} ${outX} ${outY}`
  }
  d += ` L ${tx} ${ty}`
  return [d, (sx + tx) / 2, low]
}

export function MergeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<MergeEdgeType>) {
  const { deleteElements } = useReactFlow()
  const syncBack = data?.kind === "sync-back"
  const [path, labelX, labelY] =
    syncBack && targetX < sourceX + 2 * LOOP_GAP
      ? loopPath(sourceX, sourceY, targetX, targetY)
      : getBezierPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
        })
  const tone = data?.tone
  const stroke = tone
    ? toneClasses[tone].stroke
    : selected
      ? "var(--primary)"
      : syncBack
        ? SYNC_BACK_STROKE
        : undefined
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className={cn(data?.flowing && "edge-flowing")}
        style={{
          stroke,
          strokeWidth: selected || tone ? 2.25 : 1.5,
          strokeDasharray:
            (data?.dashed || syncBack) && !data?.flowing ? "6 4" : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute flex items-center gap-1"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          {/* Solid backing so the translucent tone colour doesn't show the edge through it. */}
          <span className="rounded-full bg-card shadow-sm">
            <span
              className={cn(
                "inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[0.625rem] font-semibold",
                syncBack &&
                  !tone &&
                  "border-violet-500/40 text-violet-700 dark:text-violet-300",
                tone && toneClasses[tone].badge,
                selected && !tone && "border-primary text-primary"
              )}
              title={
                syncBack
                  ? "Sync-back: copies the finished result back into this branch so both match"
                  : data?.label
              }
            >
              {syncBack && <RefreshCwIcon className="size-2.5" />}
              {data?.step !== undefined ? `Step ${data.step}` : "—"}
              {syncBack && !data?.label && (
                <span className="font-normal opacity-80">· sync back</span>
              )}
              {data?.label && (
                <span className="font-normal opacity-80">· {data.label}</span>
              )}
            </span>
          </span>
          {selected && !data?.locked && (
            <button
              onClick={() => deleteElements({ edges: [{ id }] })}
              className="grid size-5 place-items-center rounded-full border bg-card text-muted-foreground shadow-sm hover:bg-destructive hover:text-white"
              aria-label="Remove this merge"
            >
              <XIcon className="size-3" />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
