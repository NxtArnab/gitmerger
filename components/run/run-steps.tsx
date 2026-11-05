"use client"

import Link from "next/link"
import { ArrowRightIcon, FileWarningIcon } from "lucide-react"

import { StatusBadge, stepStatusMeta, toneClasses } from "@/components/status"
import { cn } from "@/lib/utils"
import type { LogEntry, Run } from "@/lib/types"

export function RunSteps({ run }: { run: Run }) {
  return (
    <ol className="relative flex flex-col">
      {run.steps.map((step, i) => {
        const meta = stepStatusMeta[step.status]
        const last = i === run.steps.length - 1
        return (
          <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && (
              <span className="absolute top-6 bottom-0 left-[11px] w-px bg-border" />
            )}
            <span
              className={cn(
                "relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[0.625rem] font-semibold ring-4 ring-background",
                toneClasses[meta.tone].badge
              )}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
                  <span className="truncate">{step.source}</span>
                  <ArrowRightIcon className="size-3 shrink-0 text-muted-foreground" />
                  <span className="truncate font-semibold">{step.target}</span>
                </span>
                <StatusBadge
                  kind="step"
                  status={step.status}
                  className="ml-auto"
                />
              </div>
              <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                {step.kind === "sync-back" && (
                  <span className="text-violet-600 dark:text-violet-300">
                    Sync back ·{" "}
                  </span>
                )}
                {step.status === "merged" &&
                  (step.fastForward
                    ? `Now identical to ${step.source} · ${step.postSha?.slice(0, 7)}`
                    : `${step.commitsIncoming} commit${step.commitsIncoming === 1 ? "" : "s"} brought in · ${step.postSha?.slice(0, 7)}`)}
                {step.status === "up-to-date" &&
                  "Already had everything — nothing to do."}
                {step.status === "pending" && "Waiting for earlier steps."}
                {step.status === "running" && "Merging…"}
                {step.status === "skipped" &&
                  "Skipped — branch left unchanged."}
                {step.status === "failed" && step.error}
                {(step.status === "undone" || step.status === "reverted") &&
                  meta.hint}
              </p>
              {step.status === "conflict" && (
                <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/8 p-2.5">
                  <p className="text-[0.6875rem] text-amber-800 dark:text-amber-200">
                    {step.conflictFiles?.length} file
                    {step.conflictFiles?.length === 1 ? "" : "s"} changed in
                    both branches:
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {step.conflictFiles?.map((f) => (
                      <li key={f}>
                        <Link
                          href={`/runs/${run.id}/resolve?file=${encodeURIComponent(f)}`}
                          className="flex items-center gap-1.5 font-mono text-[0.6875rem] hover:underline"
                        >
                          <FileWarningIcon className="size-3 text-amber-600" />{" "}
                          {f}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

const logTone: Record<LogEntry["level"], string> = {
  info: "text-muted-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-rose-600 dark:text-rose-400",
  cmd: "text-violet-600 dark:text-violet-300 font-mono",
}

export function RunLog({
  log,
  className,
}: {
  log: LogEntry[]
  className?: string
}) {
  return (
    <ol
      className={cn(
        "flex flex-col gap-1.5 text-[0.6875rem] leading-relaxed",
        className
      )}
    >
      {log.map((entry, i) => (
        <li key={i} className="flex gap-3">
          <time className="shrink-0 font-mono text-muted-foreground/60 tabular-nums">
            {new Date(entry.at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </time>
          <span className={cn("min-w-0 break-words", logTone[entry.level])}>
            {entry.level === "cmd" ? `$ ${entry.message}` : entry.message}
          </span>
        </li>
      ))}
    </ol>
  )
}
