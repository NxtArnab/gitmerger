"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowRightIcon,
  BellRingIcon,
  FolderGit2Icon,
  GitForkIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PlusIcon,
  RocketIcon,
  SparklesIcon,
  Trash2Icon,
  WorkflowIcon,
} from "lucide-react"

import { AppHeader } from "@/components/app-header"
import {
  ConnectRepoDialog,
  NewFlowDialog,
} from "@/components/dashboard/dialogs"
import { StatusBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { api, timeAgo, useApi } from "@/lib/api"
import { needsDecision, type Flow, type Repo, type Run } from "@/lib/types"

type RepoRow = Repo & { ready: boolean }

export function Dashboard() {
  const router = useRouter()
  const repos = useApi<{
    repos: RepoRow[]
    identity: { name: string; email: string }
  }>("/repos")
  const flows = useApi<{ flows: Flow[] }>("/flows")
  const runs = useApi<{ runs: Run[] }>("/runs", 4000)
  const [connectOpen, setConnectOpen] = React.useState(false)
  const [newFlowRepo, setNewFlowRepo] = React.useState<Repo>()
  const [demoBusy, setDemoBusy] = React.useState(false)

  const reloadAll = () => {
    void repos.reload()
    void flows.reload()
    void runs.reload()
  }

  async function createDemo() {
    setDemoBusy(true)
    try {
      const { flowId } = await api<{ flowId: string }>("/repos/demo", {
        method: "POST",
      })
      toast.success("Demo repository created")
      router.push(`/flows/${flowId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      setDemoBusy(false)
    }
  }

  async function removeRepo(repo: Repo) {
    if (
      !window.confirm(
        `Remove "${repo.name}" from BranchFlow? This deletes its flows and run history here — the actual git repository is not touched.`
      )
    )
      return
    try {
      await api(`/repos/${repo.id}`, { method: "DELETE" })
      toast.success(`Removed ${repo.name}`)
      reloadAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const loading = !repos.data || !flows.data
  const repoList = repos.data?.repos ?? []
  const attention = (runs.data?.runs ?? []).filter(needsDecision)
  const recent = (runs.data?.runs ?? []).slice(0, 8)
  const repoName = (id: string) =>
    repoList.find((r) => r.id === id)?.name ?? "—"

  return (
    <div className="min-h-svh bg-background">
      <AppHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6">
        {loading ? (
          <div className="grid place-items-center py-32 text-muted-foreground">
            <Loader2Icon className="animate-spin" />
          </div>
        ) : repoList.length === 0 ? (
          <Welcome
            onDemo={createDemo}
            demoBusy={demoBusy}
            onConnect={() => setConnectOpen(true)}
          />
        ) : (
          <>
            <section className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Your merge flows
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick a flow to see its plan, check for conflicts and run it.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={createDemo}
                  disabled={demoBusy}
                >
                  {demoBusy ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <SparklesIcon />
                  )}{" "}
                  Demo repo
                </Button>
                <Button size="lg" onClick={() => setConnectOpen(true)}>
                  <PlusIcon /> Connect repository
                </Button>
              </div>
            </section>

            {attention.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-amber-600 uppercase dark:text-amber-400">
                  <BellRingIcon className="size-3.5" /> Needs your attention
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {attention.map((run) => (
                    <Link
                      key={run.id}
                      href={
                        run.status === "waiting"
                          ? `/runs/${run.id}/resolve`
                          : `/runs/${run.id}`
                      }
                      className="group flex items-center gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 transition-colors hover:bg-amber-500/10"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {run.flowName}{" "}
                            <span className="text-muted-foreground">
                              #{run.number}
                            </span>
                          </span>
                          <StatusBadge status={run.status} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {run.status === "waiting"
                            ? "A merge conflict is waiting to be resolved."
                            : run.status === "running"
                              ? "Merging right now…"
                              : "Merged locally but not published yet. Publish or discard it."}
                        </p>
                      </div>
                      <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {repoList.map((repo) => {
              const repoFlows = flows.data!.flows.filter(
                (f) => f.repoId === repo.id
              )
              return (
                <section key={repo.id} className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-lg bg-muted">
                      <FolderGit2Icon className="size-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold">
                        {repo.name}
                      </h2>
                      <p className="truncate font-mono text-[0.6875rem] text-muted-foreground">
                        {repo.source}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        variant="ghost"
                        onClick={() => setNewFlowRepo(repo)}
                      >
                        <PlusIcon /> New flow
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Repository options"
                            />
                          }
                        >
                          <MoreHorizontalIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => removeRepo(repo)}
                          >
                            <Trash2Icon /> Remove from BranchFlow
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {repoFlows.map((flow) => (
                      <FlowCard
                        key={flow.id}
                        flow={flow}
                        lastRun={runs.data?.runs.find(
                          (r) => r.flowId === flow.id
                        )}
                      />
                    ))}
                    <button
                      onClick={() => setNewFlowRepo(repo)}
                      className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                    >
                      <PlusIcon className="size-4" /> Create a flow
                    </button>
                  </div>
                </section>
              )
            })}

            {recent.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Recent runs
                </h2>
                <div className="overflow-hidden rounded-xl border">
                  {recent.map((run) => {
                    const merged = run.steps.filter(
                      (s) => s.status === "merged"
                    ).length
                    return (
                      <Link
                        key={run.id}
                        href={`/runs/${run.id}`}
                        className="flex items-center gap-4 border-b px-4 py-3 text-xs transition-colors last:border-0 hover:bg-muted/50"
                      >
                        <span className="w-10 font-mono text-muted-foreground">
                          #{run.number}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium">{run.flowName}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {repoName(run.repoId)}
                          </span>
                        </span>
                        <span className="hidden text-muted-foreground sm:inline">
                          {merged}/{run.steps.length} merged
                        </span>
                        <StatusBadge status={run.status} />
                        <span className="w-16 text-right text-muted-foreground">
                          {timeAgo(run.createdAt)}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <ConnectRepoDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        identity={repos.data?.identity}
        onCreated={reloadAll}
      />
      <NewFlowDialog
        repo={newFlowRepo}
        onOpenChange={(open) => !open && setNewFlowRepo(undefined)}
      />
    </div>
  )
}

function FlowCard({ flow, lastRun }: { flow: Flow; lastRun?: Run }) {
  const clients = flow.nodes.filter((n) => n.data.role === "client").length
  return (
    <Link
      href={`/flows/${flow.id}`}
      className="group relative flex min-h-32 flex-col overflow-hidden rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="bg-dots pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)] opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <WorkflowIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium">{flow.name}</h3>
          <p className="truncate text-[0.6875rem] text-muted-foreground">
            {flow.description ||
              `${flow.nodes.length} branches · ${flow.edges.length} merges`}
          </p>
        </div>
      </div>
      <div className="relative mt-auto flex items-center gap-2 pt-4 text-[0.6875rem] text-muted-foreground">
        <GitForkIcon className="size-3" /> {flow.edges.length} merges
        <span>·</span> {clients} client{clients === 1 ? "" : "s"}
        <span className="ml-auto">
          {lastRun ? (
            <StatusBadge status={lastRun.status} />
          ) : (
            <span className="opacity-60">Never run</span>
          )}
        </span>
      </div>
    </Link>
  )
}

function Welcome({
  onDemo,
  demoBusy,
  onConnect,
}: {
  onDemo: () => void
  demoBusy: boolean
  onConnect: () => void
}) {
  const steps = [
    {
      icon: FolderGit2Icon,
      title: "Connect your repo",
      body: "BranchFlow works on its own private copy, so nobody's local work is affected.",
    },
    {
      icon: WorkflowIcon,
      title: "Draw how code flows",
      body: 'Drag from main to each client branch. Arrows mean "bring these changes into that branch".',
    },
    {
      icon: RocketIcon,
      title: "Check, run, publish",
      body: "See conflicts before they happen, fix them in the browser, then push everything in one click.",
    },
  ]
  return (
    <section className="relative overflow-hidden rounded-3xl border bg-card px-6 py-16 sm:px-12">
      <div className="bg-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1 text-[0.6875rem] text-muted-foreground backdrop-blur">
          <SparklesIcon className="size-3 text-primary" /> One product, many
          clients — no more merge chaos
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Keep every client branch in sync with main.
        </h1>
        <p className="mt-4 max-w-lg text-sm text-balance text-muted-foreground">
          Draw your merge plan once. Each release, BranchFlow merges it all in
          the right order, stops when something needs a human, and lets you undo
          anything.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button
            size="lg"
            className="h-9 px-4"
            onClick={onDemo}
            disabled={demoBusy}
          >
            {demoBusy ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <SparklesIcon />
            )}{" "}
            Try it with a demo repo
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-9 px-4"
            onClick={onConnect}
          >
            <PlusIcon /> Connect your repository
          </Button>
        </div>
      </div>
      <div className="relative mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div
            key={s.title}
            className="rounded-2xl border bg-background/70 p-5 text-left backdrop-blur"
          >
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="size-3.5" />
              </span>
              <span className="text-[0.6875rem] font-medium text-muted-foreground">
                Step {i + 1}
              </span>
            </div>
            <h3 className="mt-3 text-sm font-medium">{s.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
