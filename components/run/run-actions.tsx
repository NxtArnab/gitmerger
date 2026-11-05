"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  CloudUploadIcon,
  Loader2Icon,
  PlayIcon,
  RotateCcwIcon,
  SkipForwardIcon,
  SquareIcon,
  Trash2Icon,
  Undo2Icon,
  WrenchIcon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import {
  hasLocalChanges,
  UNPUBLISHED_RUN_STATUSES,
  type Run,
} from "@/lib/types"

type Action =
  "continue" | "skip" | "cancel" | "publish" | "discard" | "revert" | "rollback"

interface Confirm {
  action: Action
  title: string
  body: React.ReactNode
  confirm: string
  destructive?: boolean
}

export function useRunAction(run: Run | undefined, onDone: () => void) {
  const [pending, setPending] = React.useState<Action>()
  const perform = React.useCallback(
    async (action: Action) => {
      if (!run) return
      setPending(action)
      try {
        await api(`/runs/${run.id}/actions`, { body: { action } })
        const messages: Partial<Record<Action, string>> = {
          continue: "Merge committed — continuing the run",
          skip: "Merge skipped — continuing the run",
          cancel: "Run cancelled",
          publish: "Published to the remote 🎉",
          discard: "Local changes discarded",
          revert: "Revert commits pushed",
          rollback: "Branches rolled back on the remote",
        }
        toast.success(messages[action])
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err), {
          duration: 10000,
        })
      } finally {
        setPending(undefined)
        onDone()
      }
    },
    [run, onDone]
  )
  return { pending, perform }
}

export function RunActions({
  run,
  onChanged,
  compact,
}: {
  run: Run
  onChanged: () => void
  compact?: boolean
}) {
  const { pending, perform } = useRunAction(run, onChanged)
  const [confirm, setConfirm] = React.useState<Confirm>()
  const changed = [
    ...new Set(
      run.steps.filter((s) => s.status === "merged").map((s) => s.target)
    ),
  ]
  const branchList = (list: string[]) => (
    <span className="font-mono text-foreground">{list.join(", ")}</span>
  )

  const button = (
    action: Action,
    label: string,
    Icon: React.ElementType,
    variant: React.ComponentProps<typeof Button>["variant"] = "outline",
    ask?: Omit<Confirm, "action">
  ) => (
    <Button
      key={action}
      variant={variant}
      size={compact ? "default" : "lg"}
      disabled={!!pending || run.busy}
      onClick={() => (ask ? setConfirm({ action, ...ask }) : perform(action))}
    >
      {pending === action ? <Loader2Icon className="animate-spin" /> : <Icon />}
      {label}
    </Button>
  )

  const buttons: React.ReactNode[] = []
  if (run.status === "waiting") {
    buttons.push(
      <Button
        key="resolve"
        size={compact ? "default" : "lg"}
        render={<Link href={`/runs/${run.id}/resolve`} />}
        nativeButton={false}
      >
        <WrenchIcon /> Resolve conflicts
      </Button>,
      button("skip", "Skip this merge", SkipForwardIcon, "outline", {
        title: "Skip this merge?",
        body: "The conflicting branch will be left unchanged for now and the run carries on with the remaining merges. You can bring it up to date in a later run.",
        confirm: "Skip and continue",
      }),
      button("cancel", "Cancel run", SquareIcon, "ghost", {
        title: "Cancel the run?",
        body: "The current merge is abandoned and no further merges start. Merges that already finished stay in the workspace — you can still publish or discard them.",
        confirm: "Cancel run",
        destructive: true,
      })
    )
  } else if (run.status === "running") {
    buttons.push(
      button("cancel", "Stop after current merge", SquareIcon, "ghost")
    )
  } else if (
    UNPUBLISHED_RUN_STATUSES.includes(run.status) &&
    hasLocalChanges(run)
  ) {
    buttons.push(
      button(
        "publish",
        `Publish ${changed.length} branch${changed.length === 1 ? "" : "es"}`,
        CloudUploadIcon,
        "default",
        {
          title: "Push the results to the remote?",
          body: (
            <>
              This pushes {branchList(changed)} to the shared repository so the
              team (and deployments) get the merged code.
            </>
          ),
          confirm: "Publish",
        }
      ),
      button("discard", "Discard", Trash2Icon, "ghost", {
        title: "Discard this run's merges?",
        body: "All branches go back to exactly how they were before the run. Nothing was pushed, so nobody else is affected.",
        confirm: "Discard",
        destructive: true,
      })
    )
  } else if (run.status === "published") {
    const branches = Object.keys(run.publishedShas ?? {})
    buttons.push(
      button("rollback", "Roll back", Undo2Icon, "outline", {
        title: "Roll back this publish?",
        body: (
          <>
            Puts {branchList(branches)} on the remote back to exactly where they
            were before this run, as if it never happened.
            <br />
            <br />
            Only possible if nobody has pushed to these branches since.
            Teammates who already pulled will need to pull again.
          </>
        ),
        confirm: "Roll back",
        destructive: true,
      }),
      button("revert", "Revert", RotateCcwIcon, "ghost", {
        title: "Revert this run?",
        body: (
          <>
            Adds a new &quot;revert&quot; commit on {branchList(branches)} that
            cancels out the merge. History is kept, so it&apos;s safe even if
            others pushed on top.
            <br />
            <br />
            <strong className="text-foreground">Heads up:</strong> git will
            treat those changes as already merged. To bring them back later
            you&apos;ll need to revert the revert. Prefer <em>Roll back</em>{" "}
            when it&apos;s possible.
          </>
        ),
        confirm: "Revert",
        destructive: true,
      })
    )
  }

  if (!buttons.length) return null
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">{buttons}</div>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <Button
              variant={confirm?.destructive ? "destructive" : "default"}
              onClick={() => {
                if (confirm) void perform(confirm.action)
                setConfirm(undefined)
              }}
            >
              <PlayIcon /> {confirm?.confirm}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
