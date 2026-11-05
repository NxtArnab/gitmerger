"use client"

import Link from "next/link"
import {
  ArrowLeftIcon,
  GitCommitHorizontalIcon,
  Loader2Icon,
  WorkflowIcon,
} from "lucide-react"

import { AppHeader } from "@/components/app-header"
import { RunActions } from "@/components/run/run-actions"
import { RunLog, RunSteps } from "@/components/run/run-steps"
import { runStatusMeta, StatusBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import { timeAgo, useApi } from "@/lib/api"
import {
  ACTIVE_RUN_STATUSES,
  type Flow,
  type Repo,
  type Run,
} from "@/lib/types"

export function RunView({ runId }: { runId: string }) {
  const { data, error, reload } = useApi<{
    run: Run
    repo?: Repo
    flow?: Flow
  }>(`/runs/${runId}`, 1500)
  const run = data?.run

  if (error && !run)
    return (
      <p className="p-10 text-center text-sm text-muted-foreground">{error}</p>
    )
  if (!run)
    return (
      <div className="grid min-h-svh place-items-center">
        <Loader2Icon className="animate-spin text-muted-foreground" />
      </div>
    )

  const meta = runStatusMeta[run.status]
  const touched = Object.entries(run.startShas)

  return (
    <div className="min-h-svh">
      <AppHeader />
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4">
          <Link
            href={data.flow ? `/flows/${data.flow.id}` : "/"}
            className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" />{" "}
            {data.flow ? `Back to ${data.flow.name}` : "Dashboard"}
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {run.flowName}{" "}
              <span className="text-muted-foreground">#{run.number}</span>
            </h1>
            <StatusBadge status={run.status} />
          </div>
          <p className="text-xs text-muted-foreground">
            {data.repo?.name} · started {timeAgo(run.createdAt)}
            {run.publishedAt && ` · published ${timeAgo(run.publishedAt)}`}
          </p>
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-sm">{meta.hint}</p>
            <div className="mt-3">
              <RunActions run={run} onChanged={reload} />
            </div>
            {ACTIVE_RUN_STATUSES.includes(run.status) && data.flow && (
              <Button
                variant="link"
                className="mt-2 px-0"
                render={<Link href={`/flows/${data.flow.id}`} />}
                nativeButton={false}
              >
                <WorkflowIcon /> Watch it on the canvas
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="flex flex-col gap-4">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Steps
            </h2>
            <div className="rounded-xl border p-4">
              <RunSteps run={run} />
            </div>
            {touched.length > 0 && (
              <>
                <h2 className="mt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Branch snapshots
                </h2>
                <div className="overflow-hidden rounded-xl border text-xs">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b bg-muted/40 px-4 py-2 text-[0.6875rem] text-muted-foreground">
                    <span>Branch</span>
                    <span>Before run</span>
                    <span>Published</span>
                  </div>
                  {touched.map(([branch, sha]) => (
                    <div
                      key={branch}
                      className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b px-4 py-2 font-mono last:border-0"
                    >
                      <span className="truncate">{branch}</span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <GitCommitHorizontalIcon className="size-3" />{" "}
                        {sha.slice(0, 7)}
                      </span>
                      <span className="w-16 text-right">
                        {run.publishedShas?.[branch]?.slice(0, 7) ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[0.6875rem] text-muted-foreground">
                  BranchFlow remembers where every branch was before the run,
                  which is what makes Discard and Roll back possible.
                </p>
              </>
            )}
          </section>
          <section className="flex flex-col gap-4">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Activity log
            </h2>
            <div className="rounded-xl border bg-card p-4">
              <RunLog log={run.log} />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
