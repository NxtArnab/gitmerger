"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CheckIcon,
  CircleIcon,
  FileCode2Icon,
  FileX2Icon,
  Loader2Icon,
  PencilIcon,
  PlayIcon,
  RotateCcwIcon,
  SkipForwardIcon,
  SparklesIcon,
} from "lucide-react"

import { ThemeToggle } from "@/components/app-header"
import { StatusBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { api, useApi } from "@/lib/api"
import {
  buildResolved,
  parseConflicts,
  resolvedLines,
  type Choice,
  type Segment,
} from "@/lib/conflict-parse"
import { cn } from "@/lib/utils"
import type { ConflictFileDetail, ConflictFileSummary, Run } from "@/lib/types"

const CURRENT = {
  text: "text-teal-700 dark:text-teal-300",
  bg: "bg-teal-500/8",
  border: "border-teal-500/40",
  solid: "bg-teal-500",
}
const INCOMING = {
  text: "text-violet-700 dark:text-violet-300",
  bg: "bg-violet-500/8",
  border: "border-violet-500/40",
  solid: "bg-violet-500",
}

export function ConflictResolver({ runId }: { runId: string }) {
  const router = useRouter()
  const search = useSearchParams()
  const runQuery = useApi<{ run: Run }>(`/runs/${runId}`)
  const run = runQuery.data?.run
  const step = run?.steps.find((s) => s.status === "conflict")
  const filesQuery = useApi<{ files: ConflictFileSummary[] }>(
    run?.status === "waiting" ? `/runs/${runId}/conflicts` : null
  )
  const files = filesQuery.data?.files
  const [picked, setSelected] = React.useState<string | null>(
    search.get("file")
  )
  const selected =
    picked ?? files?.find((f) => !f.resolved)?.path ?? files?.[0]?.path ?? null
  const [finishing, setFinishing] = React.useState<"continue" | "skip">()

  const done = files?.filter((f) => f.resolved).length ?? 0
  const total = files?.length ?? 0
  const allDone = total > 0 && done === total

  async function onResolved(list: ConflictFileSummary[], path: string) {
    filesQuery.setData({ files: list })
    const next = list.find((f) => !f.resolved && f.path !== path)
    if (next) setSelected(next.path)
    else toast.success("All conflicts resolved! Press “Finish & continue run”.")
  }

  async function finish(action: "continue" | "skip") {
    setFinishing(action)
    try {
      await api(`/runs/${runId}/actions`, { body: { action } })
      toast.success(
        action === "continue"
          ? "Merge committed — the run is continuing"
          : "Merge skipped — the run is continuing"
      )
      router.push(run ? `/flows/${run.flowId}` : "/")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err), {
        duration: 10000,
      })
      setFinishing(undefined)
    }
  }

  if (run && run.status !== "waiting") {
    return (
      <div className="grid min-h-svh place-items-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <CheckCircle2Icon className="size-8 text-emerald-500" />
          <h1 className="text-base font-semibold">No open conflicts</h1>
          <p className="text-xs text-muted-foreground">
            Run #{run.number} is <StatusBadge status={run.status} /> —
            there&apos;s nothing to resolve here right now.
          </p>
          <Button
            render={<Link href={`/flows/${run.flowId}`} />}
            nativeButton={false}
          >
            Back to the flow
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur-xl">
        <Button
          variant="ghost"
          size="icon"
          render={<Link href={run ? `/flows/${run.flowId}` : "/"} />}
          nativeButton={false}
          aria-label="Back"
        >
          <ArrowLeftIcon />
        </Button>
        <div className="min-w-0">
          <div className="text-[0.6875rem] text-muted-foreground">
            Run #{run?.number} · {run?.flowName}
          </div>
          <h1 className="flex items-center gap-1.5 truncate text-sm font-semibold">
            Resolve conflicts:
            <span className={cn("font-mono", INCOMING.text)}>
              {step?.source}
            </span>
            <ArrowRightIcon className="size-3.5 text-muted-foreground" />
            <span className={cn("font-mono", CURRENT.text)}>
              {step?.target}
            </span>
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${total ? (done / total) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[0.6875rem] text-muted-foreground tabular-nums">
              {done}/{total} files
            </span>
          </div>
          <Button
            variant="ghost"
            onClick={() => finish("skip")}
            disabled={!!finishing}
            title="Leave this branch unchanged and carry on with the rest of the run"
          >
            {finishing === "skip" ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <SkipForwardIcon />
            )}{" "}
            Skip this merge
          </Button>
          <Button
            size="lg"
            onClick={() => finish("continue")}
            disabled={!allDone || !!finishing}
          >
            {finishing === "continue" ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <PlayIcon />
            )}{" "}
            Finish &amp; continue run
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r">
          <div className="border-b p-3">
            <h2 className="text-xs font-semibold">Files with conflicts</h2>
            <p className="mt-1 text-[0.6875rem] text-muted-foreground">
              These files were changed in <b>both</b> branches, so git needs you
              to decide what the final version looks like.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {!files && (
              <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                <Loader2Icon className="size-3 animate-spin" /> Loading…
              </div>
            )}
            {files?.map((f) => (
              <button
                key={f.path}
                onClick={() => setSelected(f.path)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted",
                  selected === f.path && "bg-muted"
                )}
              >
                {f.resolved ? (
                  <CheckCircle2Icon className="size-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <CircleIcon className="size-3.5 shrink-0 text-amber-500" />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs">
                    {f.path.split("/").pop()}
                  </span>
                  <span className="block truncate font-mono text-[0.625rem] text-muted-foreground">
                    {f.path}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t p-3 text-[0.6875rem]">
            <Legend
              color={INCOMING}
              label="Incoming"
              branch={step?.source}
              desc="the new changes being brought in"
            />
            <Legend
              color={CURRENT}
              label="Current"
              branch={step?.target}
              desc="what this branch has today"
            />
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          {selected && step ? (
            <FileResolver
              key={selected}
              runId={runId}
              path={selected}
              source={step.source}
              target={step.target}
              onResolved={(list) => onResolved(list, selected)}
            />
          ) : (
            <div className="grid h-full place-items-center text-xs text-muted-foreground">
              Select a file
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function Legend({
  color,
  label,
  branch,
  desc,
}: {
  color: typeof CURRENT
  label: string
  branch?: string
  desc: string
}) {
  return (
    <div className="flex items-start gap-2">
      <span className={cn("mt-1 size-2 shrink-0 rounded-full", color.solid)} />
      <span className="text-muted-foreground">
        <b className={color.text}>{label}</b> (
        <span className="font-mono">{branch}</span>) — {desc}
      </span>
    </div>
  )
}

function FileResolver({
  runId,
  path,
  source,
  target,
  onResolved,
}: {
  runId: string
  path: string
  source: string
  target: string
  onResolved: (files: ConflictFileSummary[]) => void
}) {
  const { data: file, error } = useApi<ConflictFileDetail>(
    `/runs/${runId}/conflicts?path=${encodeURIComponent(path)}`
  )
  const [choices, setChoices] = React.useState<Record<number, Choice>>({})
  const [mode, setMode] = React.useState<"guided" | "manual">("guided")
  // null = untouched, so the editor shows the file as git left it
  const [edited, setManual] = React.useState<string | null>(null)
  const manual = edited ?? file?.merged?.replace(/\r\n/g, "\n") ?? ""
  const [saving, setSaving] = React.useState(false)
  const [resolvedHere, setResolvedHere] = React.useState(false)

  const segments = React.useMemo(
    () => (file?.merged ? parseConflicts(file.merged) : []),
    [file]
  )
  const conflicts = segments.filter(
    (s): s is Extract<Segment, { kind: "conflict" }> => s.kind === "conflict"
  )
  const guidedResult = buildResolved(segments, choices)
  const special =
    file &&
    (file.binary ||
      file.current === null ||
      file.incoming === null ||
      conflicts.length === 0)

  async function submit(body: Record<string, unknown>) {
    setSaving(true)
    try {
      const { files } = await api<{ files: ConflictFileSummary[] }>(
        `/runs/${runId}/conflicts`,
        { body: { path, ...body } }
      )
      setResolvedHere(true)
      toast.success(`${path.split("/").pop()} resolved`)
      onResolved(files)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err), {
        duration: 8000,
      })
    } finally {
      setSaving(false)
    }
  }

  const setAll = (type: "current" | "incoming") =>
    setChoices(Object.fromEntries(conflicts.map((c) => [c.id, { type }])))

  if (error) return <p className="p-6 text-xs text-destructive">{error}</p>
  if (!file)
    return (
      <div className="grid h-full place-items-center">
        <Loader2Icon className="animate-spin text-muted-foreground" />
      </div>
    )

  const isResolved = file.resolved || resolvedHere

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-9 place-items-center rounded-lg bg-muted">
          <FileCode2Icon className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-mono text-sm font-semibold">{path}</h2>
          <p className="text-xs text-muted-foreground">
            {special
              ? "This file can't be merged line by line. Pick which version to keep."
              : `${conflicts.length} spot${conflicts.length === 1 ? "" : "s"} where both branches changed the same lines. Everything else merged automatically.`}
          </p>
        </div>
        {isResolved && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[0.6875rem] font-medium text-emerald-700 dark:text-emerald-300">
            <CheckIcon className="size-3" /> Resolved
          </span>
        )}
      </div>

      {special ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <WholeFileCard
            color={INCOMING}
            label="Use incoming version"
            branch={source}
            content={file.incoming}
            binary={file.binary}
            onPick={() => submit({ mode: "incoming" })}
            disabled={saving}
          />
          <WholeFileCard
            color={CURRENT}
            label="Keep current version"
            branch={target}
            content={file.current}
            binary={file.binary}
            onPick={() => submit({ mode: "current" })}
            disabled={saving}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <TabsList>
                <TabsTrigger value="guided">
                  <SparklesIcon /> Guided
                </TabsTrigger>
                <TabsTrigger value="manual">
                  <PencilIcon /> Edit manually
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {mode === "guided" && (
              <div className="ml-auto flex gap-1.5">
                <Button variant="outline" onClick={() => setAll("incoming")}>
                  Take all incoming
                </Button>
                <Button variant="outline" onClick={() => setAll("current")}>
                  Keep all current
                </Button>
                {Object.keys(choices).length > 0 && (
                  <Button variant="ghost" onClick={() => setChoices({})}>
                    <RotateCcwIcon /> Reset
                  </Button>
                )}
              </div>
            )}
          </div>

          {mode === "guided" ? (
            <div className="flex flex-col gap-3">
              {segments.map((seg, i) =>
                seg.kind === "text" ? (
                  <ContextBlock key={i} lines={seg.lines} />
                ) : (
                  <ConflictBlock
                    key={i}
                    index={seg.id + 1}
                    total={conflicts.length}
                    seg={seg}
                    source={source}
                    target={target}
                    choice={choices[seg.id]}
                    onChoose={(c) =>
                      setChoices((prev) => ({ ...prev, [seg.id]: c }))
                    }
                    onClear={() =>
                      setChoices((prev) => {
                        const next = { ...prev }
                        delete next[seg.id]
                        return next
                      })
                    }
                  />
                )
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                Edit the file directly. Remove every{" "}
                <code className="rounded bg-muted px-1">
                  &lt;&lt;&lt;&lt;&lt;&lt;&lt;
                </code>
                , <code className="rounded bg-muted px-1">=======</code> and{" "}
                <code className="rounded bg-muted px-1">
                  &gt;&gt;&gt;&gt;&gt;&gt;&gt;
                </code>{" "}
                line and leave the code exactly as it should end up.
              </p>
              {guidedResult !== null && (
                <Button
                  variant="outline"
                  className="self-start"
                  onClick={() => setManual(guidedResult)}
                >
                  Load my guided choices into the editor
                </Button>
              )}
              <Textarea
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                spellCheck={false}
                className="min-h-112 font-mono text-xs leading-relaxed"
              />
            </div>
          )}

          <div className="sticky bottom-0 -mx-6 flex items-center gap-3 border-t bg-background/90 px-6 py-3 backdrop-blur">
            <span className="text-xs text-muted-foreground">
              {mode === "guided"
                ? guidedResult === null
                  ? `Choose an option for each conflict (${Object.keys(choices).length}/${conflicts.length} done).`
                  : "All conflicts decided. Save to mark this file as resolved."
                : "Save when the file looks right."}
            </span>
            <Button
              size="lg"
              className="ml-auto"
              disabled={saving || (mode === "guided" && guidedResult === null)}
              onClick={() =>
                submit({
                  mode: "content",
                  content: mode === "guided" ? guidedResult : manual,
                })
              }
            >
              {saving ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <CheckIcon />
              )}{" "}
              Save &amp; mark resolved
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function ContextBlock({ lines }: { lines: string[] }) {
  const [open, setOpen] = React.useState(false)
  const clean =
    lines.length && lines[lines.length - 1] === "" ? lines.slice(0, -1) : lines
  if (!clean.length) return null
  const long = clean.length > 8
  const shown =
    !long || open ? clean : [...clean.slice(0, 3), null, ...clean.slice(-3)]
  return (
    <div className="overflow-hidden rounded-lg border bg-muted/30">
      <pre className="overflow-x-auto p-3 font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
        {shown.map((l, i) =>
          l === null ? (
            <button
              key={i}
              onClick={() => setOpen(true)}
              className="my-1 block w-full rounded bg-muted py-0.5 text-center text-[0.625rem] hover:text-foreground"
            >
              ⋯ {clean.length - 6} unchanged lines (click to show)
            </button>
          ) : (
            <div key={i}>{l || " "}</div>
          )
        )}
      </pre>
    </div>
  )
}

function Code({ lines, empty }: { lines: string[]; empty: string }) {
  return (
    <pre className="min-h-12 overflow-x-auto p-3 font-mono text-[0.6875rem] leading-relaxed">
      {lines.length ? (
        lines.map((l, i) => <div key={i}>{l || " "}</div>)
      ) : (
        <span className="text-muted-foreground italic">{empty}</span>
      )}
    </pre>
  )
}

function ConflictBlock({
  index,
  total,
  seg,
  source,
  target,
  choice,
  onChoose,
  onClear,
}: {
  index: number
  total: number
  seg: Extract<Segment, { kind: "conflict" }>
  source: string
  target: string
  choice?: Choice
  onChoose: (c: Choice) => void
  onClear: () => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState("")

  if (choice && !editing) {
    const label = {
      current: `Kept current (${target})`,
      incoming: `Took incoming (${source})`,
      both: "Kept both",
      custom: "Custom edit",
    }[choice.type]
    return (
      <div className="overflow-hidden rounded-xl border border-emerald-500/40 bg-emerald-500/5">
        <div className="flex items-center gap-2 border-b border-emerald-500/20 px-3 py-2">
          <CheckCircle2Icon className="size-3.5 text-emerald-500" />
          <span className="text-xs font-medium">
            Conflict {index} of {total}: {label}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={onClear}
          >
            Change
          </Button>
        </div>
        <Code
          lines={resolvedLines(seg, choice)}
          empty="(these lines will be removed)"
        />
      </div>
    )
  }

  if (editing) {
    return (
      <div className="overflow-hidden rounded-xl border border-primary/40">
        <div className="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium">
          <PencilIcon className="size-3.5 text-primary" /> Conflict {index}:
          write the final version of these lines
        </div>
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className="min-h-40 rounded-none border-0 font-mono text-[0.6875rem] leading-relaxed focus-visible:ring-0"
        />
        <div className="flex justify-end gap-2 border-t p-2">
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onChoose({ type: "custom", text: draft })
              setEditing(false)
            }}
          >
            <CheckIcon /> Use this
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-amber-500/40 shadow-sm">
      <div className="flex items-center gap-2 border-b bg-amber-500/8 px-3 py-2 text-xs font-medium">
        <span className="grid size-5 place-items-center rounded-full bg-amber-500 text-[0.625rem] text-white">
          {index}
        </span>
        Conflict {index} of {total} — which version should the file have here?
      </div>
      <div className="grid md:grid-cols-2">
        <Side
          color={INCOMING}
          title="Incoming"
          branch={source}
          lines={seg.incoming}
          action="Take incoming"
          onPick={() => onChoose({ type: "incoming" })}
        />
        <Side
          color={CURRENT}
          title="Current"
          branch={target}
          lines={seg.current}
          action="Keep current"
          onPick={() => onChoose({ type: "current" })}
          className="border-t md:border-t-0 md:border-l"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t bg-muted/30 px-3 py-2">
        <span className="mr-1 text-[0.6875rem] text-muted-foreground">Or:</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChoose({ type: "both", first: "current" })}
        >
          Keep both (current first)
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChoose({ type: "both", first: "incoming" })}
        >
          Keep both (incoming first)
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDraft([...seg.current].join("\n"))
            setEditing(true)
          }}
        >
          <PencilIcon /> Write my own
        </Button>
      </div>
    </div>
  )
}

function Side({
  color,
  title,
  branch,
  lines,
  action,
  onPick,
  className,
}: {
  color: typeof CURRENT
  title: string
  branch: string
  lines: string[]
  action: string
  onPick: () => void
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col", color.bg, className)}>
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span className={cn("size-2 rounded-full", color.solid)} />
        <span className={cn("text-[0.6875rem] font-semibold", color.text)}>
          {title}
        </span>
        <span className="truncate font-mono text-[0.625rem] text-muted-foreground">
          {branch}
        </span>
      </div>
      <div className="flex-1">
        <Code lines={lines} empty="(nothing — these lines were removed here)" />
      </div>
      <div className="px-3 pb-3">
        <Button
          variant="outline"
          className={cn("w-full bg-background", color.border)}
          onClick={onPick}
        >
          <CheckIcon /> {action}
        </Button>
      </div>
    </div>
  )
}

function WholeFileCard({
  color,
  label,
  branch,
  content,
  binary,
  onPick,
  disabled,
}: {
  color: typeof CURRENT
  label: string
  branch: string
  content: string | null
  binary: boolean
  onPick: () => void
  disabled: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border",
        color.border
      )}
    >
      <div className={cn("flex items-center gap-2 px-3 py-2", color.bg)}>
        <span className={cn("size-2 rounded-full", color.solid)} />
        <span className={cn("font-mono text-xs font-semibold", color.text)}>
          {branch}
        </span>
      </div>
      <div className="max-h-80 flex-1 overflow-auto">
        {content === null ? (
          <p className="p-3 text-xs text-muted-foreground italic">
            The file was deleted in this branch.
          </p>
        ) : binary ? (
          <p className="p-3 text-xs text-muted-foreground italic">
            Binary file (can&apos;t be shown).
          </p>
        ) : (
          <Code lines={content.split(/\r?\n/)} empty="(empty file)" />
        )}
      </div>
      <div className="border-t p-2">
        <Button
          className="w-full"
          variant="outline"
          onClick={onPick}
          disabled={disabled}
        >
          {content === null ? <FileX2Icon /> : <CheckIcon />}{" "}
          {content === null ? "Delete the file (like this branch)" : label}
        </Button>
      </div>
    </div>
  )
}
