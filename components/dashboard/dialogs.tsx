"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckIcon, GitBranchIcon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, useApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Flow, Repo } from "@/lib/types"

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[0.6875rem] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function ConnectRepoDialog({
  open,
  onOpenChange,
  identity,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  identity?: { name: string; email: string }
  onCreated: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open, so every opening starts with a fresh form. */}
        {open && (
          <ConnectRepoForm
            identity={identity}
            onClose={() => onOpenChange(false)}
            onCreated={onCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ConnectRepoForm({
  identity,
  onClose,
  onCreated,
}: {
  identity?: { name: string; email: string }
  onClose: () => void
  onCreated: () => void
}) {
  const [busy, setBusy] = React.useState(false)
  const [form, setForm] = React.useState({
    name: "",
    source: "",
    authorName: identity?.name ?? "",
    authorEmail: identity?.email ?? "",
  })
  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api<Repo>("/repos", { body: form })
      toast.success(`Connected ${form.name}`)
      onClose()
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err), {
        duration: 10000,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Connect a repository</DialogTitle>
        <DialogDescription>
          BranchFlow makes its own private copy to do the merging in. Your local
          checkouts are never touched, and nothing is pushed until you press
          Publish.
        </DialogDescription>
      </DialogHeader>
      <Field label="Name">
        <Input
          required
          placeholder="e.g. Project Management App"
          value={form.name}
          onChange={set("name")}
        />
      </Field>
      <Field
        label="Git URL or folder path"
        hint="Anything you could pass to git clone. Uses this computer's existing git credentials (SSH keys / credential manager)."
      >
        <Input
          required
          className="font-mono"
          placeholder="git@github.com:company/pm-app.git"
          value={form.source}
          onChange={set("source")}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Commit author">
          <Input
            placeholder="Your name"
            value={form.authorName}
            onChange={set("authorName")}
          />
        </Field>
        <Field label="Author email">
          <Input
            placeholder="you@company.com"
            value={form.authorEmail}
            onChange={set("authorEmail")}
          />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2Icon className="animate-spin" />}
          {busy ? "Cloning… (big repos take a while)" : "Connect"}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface Branch {
  name: string
  updated: string
}

export function NewFlowDialog({
  repo,
  onOpenChange,
}: {
  repo?: Repo
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!repo} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {repo && (
          <NewFlowForm
            key={repo.id}
            repo={repo}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function NewFlowForm({ repo, onClose }: { repo: Repo; onClose: () => void }) {
  const router = useRouter()
  const { data } = useApi<{ branches: Branch[] }>(
    `/repos/${repo.id}/branches?refresh`
  )
  const [name, setName] = React.useState("")
  const [template, setTemplate] = React.useState<"fan-out" | "blank">("fan-out")
  const [source, setSource] = React.useState(repo.defaultBranch)
  const [targets, setTargets] = React.useState<string[]>([])
  const [busy, setBusy] = React.useState(false)

  const branches = data?.branches ?? []
  const toggle = (b: string) =>
    setTargets((t) => (t.includes(b) ? t.filter((x) => x !== b) : [...t, b]))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const flow = await api<Flow>("/flows", {
        body: {
          repoId: repo.id,
          name,
          ...(template === "fan-out" ? { fanOutFrom: source, targets } : {}),
        },
      })
      router.push(`/flows/${flow.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>New merge flow</DialogTitle>
        <DialogDescription>
          A flow is a saved plan of which branches get merged into which, and in
          what order. You can change it any time on the canvas.
        </DialogDescription>
      </DialogHeader>
      <Field label="Flow name">
        <Input
          required
          placeholder="e.g. Weekly release to all clients"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        {(
          [
            [
              "fan-out",
              "Start from a template",
              "Merge one branch into many (e.g. main → every client).",
            ],
            ["blank", "Blank canvas", "Draw everything yourself."],
          ] as const
        ).map(([value, title, desc]) => (
          <button
            type="button"
            key={value}
            onClick={() => setTemplate(value)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors hover:bg-muted/60",
              template === value &&
                "border-primary bg-primary/5 ring-1 ring-primary"
            )}
          >
            <div className="text-xs font-medium">{title}</div>
            <div className="mt-0.5 text-[0.6875rem] text-muted-foreground">
              {desc}
            </div>
          </button>
        ))}
      </div>

      {template === "fan-out" && (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Field label="Merge from">
            <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-lg border p-1">
              {branches.map((b) => (
                <BranchOption
                  key={b.name}
                  name={b.name}
                  active={source === b.name}
                  onClick={() => setSource(b.name)}
                />
              ))}
              {!data && <Loading />}
            </div>
          </Field>
          <Field label={`Into (${targets.length} selected)`}>
            <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-lg border p-1">
              {branches
                .filter((b) => b.name !== source)
                .map((b) => (
                  <BranchOption
                    key={b.name}
                    name={b.name}
                    active={targets.includes(b.name)}
                    onClick={() => toggle(b.name)}
                    check
                  />
                ))}
              {!data && <Loading />}
            </div>
          </Field>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            busy || (template === "fan-out" && (!source || !targets.length))
          }
        >
          {busy && <Loader2Icon className="animate-spin" />} Create flow
        </Button>
      </DialogFooter>
    </form>
  )
}

function Loading() {
  return (
    <div className="flex items-center gap-2 p-2 text-[0.6875rem] text-muted-foreground">
      <Loader2Icon className="size-3 animate-spin" /> Fetching branches…
    </div>
  )
}

function BranchOption({
  name,
  active,
  onClick,
  check,
}: {
  name: string
  active: boolean
  onClick: () => void
  check?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-[0.6875rem] transition-colors hover:bg-muted",
        active && "bg-primary/10 text-primary"
      )}
    >
      {check ? (
        <span
          className={cn(
            "grid size-3.5 place-items-center rounded border",
            active && "border-primary bg-primary text-primary-foreground"
          )}
        >
          {active && <CheckIcon className="size-2.5" />}
        </span>
      ) : (
        <GitBranchIcon className="size-3 opacity-60" />
      )}
      <span className="truncate">{name}</span>
    </button>
  )
}
