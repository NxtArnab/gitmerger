"use client"

import Link from "next/link"
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ExternalLinkIcon,
  HistoryIcon,
  ListOrderedIcon,
  Loader2Icon,
  PlayIcon,
  RefreshCwIcon,
  ScanSearchIcon,
  SwordsIcon,
} from "lucide-react"

import { RunActions } from "@/components/run/run-actions"
import { RunLog, RunSteps } from "@/components/run/run-steps"
import { runStatusMeta, StatusBadge, toneClasses } from "@/components/status"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { timeAgo } from "@/lib/api"
import { isSyncBack, type OrderedStep } from "@/lib/flow-order"
import { cn } from "@/lib/utils"
import type { PreviewResult, PreviewStep, Run } from "@/lib/types"

export type PanelTab = "plan" | "run" | "history"

export function FlowPanel({
  tab,
  onTab,
  steps,
  orderError,
  preview,
  previewing,
  onPreview,
  onRun,
  starting,
  run,
  runs,
  onRunChanged,
  locked,
}: {
  tab: PanelTab
  onTab: (tab: PanelTab) => void
  steps: OrderedStep[]
  orderError?: string
  preview?: PreviewResult
  previewing: boolean
  onPreview: () => void
  onRun: () => void
  starting: boolean
  run?: Run
  runs: Run[]
  onRunChanged: () => void
  locked: boolean
}) {
  const previewByEdge = new Map(preview?.steps.map((s) => [s.edgeId, s]))
  const conflicts =
    preview?.steps.filter((s) => s.result === "conflict").length ?? 0
  const missing =
    preview?.steps.filter((s) => s.result === "missing").length ?? 0

  return (
    <aside className="flex w-[22rem] shrink-0 flex-col border-l bg-background/95 backdrop-blur">
      <Tabs
        value={tab}
        onValueChange={(v) => onTab(v as PanelTab)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="border-b px-3 py-2">
          <TabsList className="w-full">
            <TabsTrigger value="plan">
              <ListOrderedIcon /> Plan
            </TabsTrigger>
            <TabsTrigger value="run">
              {run && (run.status === "running" || run.status === "waiting") ? (
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    toneClasses[runStatusMeta[run.status].tone].dot
                  )}
                />
              ) : (
                <PlayIcon />
              )}
              Run
            </TabsTrigger>
            <TabsTrigger value="history">
              <HistoryIcon /> History
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="plan" className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 p-4">
            <div>
              <h3 className="text-sm font-semibold">Merge plan</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Each arrow means{" "}
                <em>“bring the changes from this branch into that one”</em>.
                Steps run top to bottom; a branch always receives its own
                updates before passing them on.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                <RefreshCwIcon className="mr-1 inline size-3 text-violet-500" />
                Drawing an arrow <b>back</b> to an earlier branch (e.g.{" "}
                <code className="font-mono">main → dev</code> after{" "}
                <code className="font-mono">dev → main</code>) makes a{" "}
                <span className="text-violet-600 dark:text-violet-300">
                  sync-back
                </span>
                : it runs right after, so both branches end up identical.
              </p>
            </div>

            {orderError && (
              <div className="flex gap-2 rounded-lg border border-rose-500/30 bg-rose-500/8 p-3 text-xs text-rose-700 dark:text-rose-300">
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />{" "}
                {orderError}
              </div>
            )}

            {steps.length === 0 && !orderError && (
              <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                No merges yet. Drag from the dot on the <b>right</b> of a branch
                to the dot on the <b>left</b> of another.
              </div>
            )}

            {steps.length > 0 && (
              <>
                <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <ScanSearchIcon className="size-4 text-primary" />
                    <span className="text-xs font-medium">Conflict check</span>
                    {preview && (
                      <span className="ml-auto text-[0.6875rem] text-muted-foreground">
                        {timeAgo(preview.checkedAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-[0.6875rem] text-muted-foreground">
                    {preview
                      ? conflicts + missing === 0
                        ? "Everything merges cleanly. You're good to run."
                        : `${conflicts} merge${conflicts === 1 ? "" : "s"} will need a human${missing ? `, ${missing} branch(es) missing` : ""}. You can still run — it will pause there.`
                      : "Simulates the whole plan against the latest code, without changing anything."}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={onPreview}
                      disabled={previewing}
                    >
                      {previewing ? (
                        <Loader2Icon className="animate-spin" />
                      ) : (
                        <ScanSearchIcon />
                      )}
                      {preview ? "Check again" : "Check for conflicts"}
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={onRun}
                      disabled={starting || locked || !!orderError}
                    >
                      {starting ? (
                        <Loader2Icon className="animate-spin" />
                      ) : (
                        <PlayIcon />
                      )}{" "}
                      Run flow
                    </Button>
                  </div>
                </div>

                <ol className="flex flex-col gap-2">
                  {steps.map((step) => (
                    <PlanStep
                      key={step.edge.id}
                      step={step}
                      preview={previewByEdge.get(step.edge.id)}
                    />
                  ))}
                </ol>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="run" className="min-h-0 flex-1 overflow-y-auto">
          {run ? (
            <div className="flex flex-col gap-5 p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Run #{run.number}</h3>
                  <StatusBadge status={run.status} />
                  <Link
                    href={`/runs/${run.id}`}
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    title="Open full run page"
                  >
                    <ExternalLinkIcon className="size-3.5" />
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground">
                  {runStatusMeta[run.status].hint}
                </p>
              </div>
              <RunActions run={run} onChanged={onRunChanged} compact />
              <RunSteps run={run} />
              <details className="group rounded-lg border">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium">
                  <ChevronRightIcon className="size-3.5 transition-transform group-open:rotate-90" />{" "}
                  Activity log
                  <span className="ml-auto text-[0.6875rem] font-normal text-muted-foreground">
                    {run.log.length} entries
                  </span>
                </summary>
                <RunLog log={run.log} className="border-t p-3" />
              </details>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 p-8 text-center text-xs text-muted-foreground">
              <PlayIcon className="size-5" />
              This flow hasn&apos;t been run yet.
              <Button
                onClick={onRun}
                disabled={starting || locked || !steps.length || !!orderError}
              >
                {starting ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <PlayIcon />
                )}{" "}
                Run flow
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col p-2">
            {runs.length === 0 && (
              <p className="p-6 text-center text-xs text-muted-foreground">
                No runs yet.
              </p>
            )}
            {runs.map((r) => (
              <Link
                key={r.id}
                href={`/runs/${r.id}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs transition-colors hover:bg-muted"
              >
                <span className="font-mono text-muted-foreground">
                  #{r.number}
                </span>
                <span className="text-muted-foreground">
                  {timeAgo(r.createdAt)}
                </span>
                <StatusBadge status={r.status} className="ml-auto" />
              </Link>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  )
}

function PlanStep({
  step,
  preview,
}: {
  step: OrderedStep
  preview?: PreviewStep
}) {
  const result = preview?.result
  const tone =
    result === "conflict"
      ? "warning"
      : result === "missing"
        ? "danger"
        : result
          ? "success"
          : "neutral"
  const Icon =
    result === "conflict"
      ? SwordsIcon
      : result === "missing"
        ? AlertTriangleIcon
        : CheckCircle2Icon
  return (
    <li className="rounded-xl border bg-card">
      <div className="flex items-center gap-2.5 p-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[0.625rem] font-semibold">
          {step.index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="truncate">{step.source}</span>
            <ArrowRightIcon className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate font-semibold">{step.target}</span>
          </div>
          {isSyncBack(step.edge) && (
            <div className="mt-0.5 flex items-center gap-1 text-[0.6875rem] text-violet-600 dark:text-violet-300">
              <RefreshCwIcon className="size-3" /> Sync back — {step.target}{" "}
              gets the finished {step.source}
            </div>
          )}
        </div>
        {result && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-medium",
              toneClasses[tone].badge
            )}
          >
            <Icon className="size-3" />
            {result === "clean" &&
              (preview.fastForward
                ? "Will match"
                : `${preview.commitsIncoming} new`)}
            {result === "up-to-date" && "Up to date"}
            {result === "conflict" &&
              `${preview.conflictFiles.length} conflict${preview.conflictFiles.length === 1 ? "" : "s"}`}
            {result === "missing" && "Missing"}
          </span>
        )}
      </div>
      {preview &&
        (preview.commits.length > 0 ||
          preview.conflictFiles.length > 0 ||
          preview.message) && (
          <details className="group border-t">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[0.6875rem] text-muted-foreground hover:text-foreground">
              <ChevronRightIcon className="size-3 transition-transform group-open:rotate-90" />
              {preview.message ??
                `What's coming in (${preview.commitsIncoming} commit${preview.commitsIncoming === 1 ? "" : "s"})`}
            </summary>
            <div className="flex flex-col gap-2 px-3 pb-3">
              {preview.conflictFiles.length > 0 && (
                <div className="rounded-md bg-amber-500/8 p-2 text-[0.6875rem]">
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    Both branches changed:
                  </p>
                  {preview.conflictFiles.map((f) => (
                    <div key={f} className="truncate font-mono">
                      {f}
                    </div>
                  ))}
                </div>
              )}
              {preview.commits.map((c) => (
                <div key={c.sha} className="flex gap-2 text-[0.6875rem]">
                  <span className="shrink-0 font-mono text-muted-foreground">
                    {c.sha}
                  </span>
                  <span
                    className="min-w-0 truncate"
                    title={`${c.subject} — ${c.author}`}
                  >
                    {c.subject}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
    </li>
  )
}
