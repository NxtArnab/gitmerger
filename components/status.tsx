import {
  CheckCircle2Icon,
  CircleDashedIcon,
  CircleSlashIcon,
  CloudUploadIcon,
  Loader2Icon,
  OctagonXIcon,
  PauseCircleIcon,
  RotateCcwIcon,
  SkipForwardIcon,
  SwordsIcon,
  Undo2Icon,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { RunStatus, StepStatus } from "@/lib/types"

export type Tone =
  "neutral" | "info" | "success" | "warning" | "danger" | "primary"

export const toneClasses: Record<
  Tone,
  { badge: string; text: string; dot: string; stroke: string; ring: string }
> = {
  neutral: {
    badge: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground/50",
    stroke: "var(--muted-foreground)",
    ring: "ring-border",
  },
  info: {
    badge: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    text: "text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500",
    stroke: "oklch(0.68 0.15 237)",
    ring: "ring-sky-500/60",
  },
  success: {
    badge: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    stroke: "oklch(0.7 0.15 162)",
    ring: "ring-emerald-500/60",
  },
  warning: {
    badge: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    stroke: "oklch(0.77 0.16 70)",
    ring: "ring-amber-500/70",
  },
  danger: {
    badge: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
    text: "text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
    stroke: "oklch(0.64 0.21 16)",
    ring: "ring-rose-500/60",
  },
  primary: {
    badge: "bg-primary/12 text-primary",
    text: "text-primary",
    dot: "bg-primary",
    stroke: "var(--primary)",
    ring: "ring-primary/60",
  },
}

interface StatusMeta {
  label: string
  tone: Tone
  icon: LucideIcon
  hint: string
}

export const runStatusMeta: Record<RunStatus, StatusMeta> = {
  running: {
    label: "Running",
    tone: "info",
    icon: Loader2Icon,
    hint: "Merges are being applied in the safe workspace.",
  },
  waiting: {
    label: "Needs you",
    tone: "warning",
    icon: PauseCircleIcon,
    hint: "Paused on a merge conflict. Resolve it, skip that merge, or cancel.",
  },
  completed: {
    label: "Ready to publish",
    tone: "primary",
    icon: CheckCircle2Icon,
    hint: "All merges done locally. Nothing is pushed until you press Publish.",
  },
  cancelled: {
    label: "Cancelled",
    tone: "neutral",
    icon: CircleSlashIcon,
    hint: "Stopped early. Finished merges are kept locally until you publish or discard.",
  },
  failed: {
    label: "Failed",
    tone: "danger",
    icon: OctagonXIcon,
    hint: "Something went wrong. Check the activity log.",
  },
  published: {
    label: "Published",
    tone: "success",
    icon: CloudUploadIcon,
    hint: "Pushed to the remote.",
  },
  discarded: {
    label: "Discarded",
    tone: "neutral",
    icon: Undo2Icon,
    hint: "Thrown away before publishing. The remote was never touched.",
  },
  reverted: {
    label: "Reverted",
    tone: "neutral",
    icon: RotateCcwIcon,
    hint: "Undone with revert commits after publishing.",
  },
  "rolled-back": {
    label: "Rolled back",
    tone: "neutral",
    icon: RotateCcwIcon,
    hint: "Branches on the remote were put back exactly as they were.",
  },
}

export const stepStatusMeta: Record<StepStatus, StatusMeta> = {
  pending: {
    label: "Waiting",
    tone: "neutral",
    icon: CircleDashedIcon,
    hint: "Not started yet.",
  },
  running: {
    label: "Merging",
    tone: "info",
    icon: Loader2Icon,
    hint: "Merging now…",
  },
  merged: {
    label: "Merged",
    tone: "success",
    icon: CheckCircle2Icon,
    hint: "Changes applied.",
  },
  "up-to-date": {
    label: "Up to date",
    tone: "success",
    icon: CheckCircle2Icon,
    hint: "Nothing new to bring in.",
  },
  conflict: {
    label: "Conflict",
    tone: "warning",
    icon: SwordsIcon,
    hint: "Both branches changed the same lines.",
  },
  skipped: {
    label: "Skipped",
    tone: "neutral",
    icon: SkipForwardIcon,
    hint: "Left unchanged.",
  },
  failed: {
    label: "Failed",
    tone: "danger",
    icon: OctagonXIcon,
    hint: "Git reported an error.",
  },
  undone: {
    label: "Undone",
    tone: "neutral",
    icon: Undo2Icon,
    hint: "Rolled back / discarded.",
  },
  reverted: {
    label: "Reverted",
    tone: "neutral",
    icon: RotateCcwIcon,
    hint: "Undone with a revert commit.",
  },
}

export function StatusBadge({
  status,
  kind = "run",
  className,
}: {
  status: RunStatus | StepStatus
  kind?: "run" | "step"
  className?: string
}) {
  const meta =
    kind === "run"
      ? runStatusMeta[status as RunStatus]
      : stepStatusMeta[status as StepStatus]
  const Icon = meta.icon
  return (
    <span
      title={meta.hint}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[0.6875rem] font-medium whitespace-nowrap",
        toneClasses[meta.tone].badge,
        className
      )}
    >
      <Icon className={cn("size-3", status === "running" && "animate-spin")} />
      {meta.label}
    </span>
  )
}
