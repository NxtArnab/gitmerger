import type { Metadata } from "next"
import {
  ArrowRightIcon,
  Building2Icon,
  CheckCircle2Icon,
  CloudUploadIcon,
  GitCommitHorizontalIcon,
  Layers3Icon,
  PlayIcon,
  RotateCcwIcon,
  ScanSearchIcon,
  SwordsIcon,
  Trash2Icon,
  Undo2Icon,
  WorkflowIcon,
  XCircleIcon,
} from "lucide-react"

import { AppHeader } from "@/components/app-header"

export const metadata: Metadata = { title: "How it works · BranchFlow" }

const sections = [
  { id: "model", title: "The branch model" },
  { id: "rules", title: "Team rules" },
  { id: "procedure", title: "Release procedure" },
  { id: "conflicts", title: "Handling conflicts" },
  { id: "undo", title: "Undoing things" },
  { id: "tips", title: "Fewer conflicts" },
  { id: "glossary", title: "Glossary" },
]

export default function GuidePage() {
  return (
    <div className="min-h-svh">
      <AppHeader />
      <div className="mx-auto flex max-w-6xl gap-12 px-4 py-12 sm:px-6">
        <nav className="sticky top-24 hidden h-fit w-44 shrink-0 flex-col gap-1 text-xs lg:flex">
          <span className="mb-2 font-semibold text-muted-foreground">
            On this page
          </span>
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {s.title}
            </a>
          ))}
        </nav>

        <article className="flex max-w-3xl min-w-0 flex-col gap-14 text-sm leading-relaxed">
          <header>
            <p className="text-xs font-medium text-primary">Guide</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              How we keep client branches in sync
            </h1>
            <p className="mt-3 text-muted-foreground">
              One product, sold to many clients, each with a few customisations.
              This page is the agreed procedure for getting new features and bug
              fixes from <code>main</code> into every client branch — safely and
              without anyone needing to be a git expert.
            </p>
          </header>

          <Section id="model" title="1. The branch model">
            <p>
              Code always flows in one direction: from the shared product out to
              the clients.
            </p>
            <div className="my-2 flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/30 p-5">
              <Pill
                icon={GitCommitHorizontalIcon}
                className="bg-primary/12 text-primary"
              >
                main
              </Pill>
              <ArrowRightIcon className="size-4 text-muted-foreground" />
              <Pill
                icon={Layers3Icon}
                className="bg-sky-500/12 text-sky-700 dark:text-sky-300"
              >
                staging{" "}
                <span className="font-sans font-normal opacity-70">
                  (optional)
                </span>
              </Pill>
              <ArrowRightIcon className="size-4 text-muted-foreground" />
              <div className="flex flex-col gap-1.5">
                <Pill icon={Building2Icon} className="bg-muted">
                  client-acme
                </Pill>
                <Pill icon={Building2Icon} className="bg-muted">
                  client-globex
                </Pill>
                <Pill icon={Building2Icon} className="bg-muted">
                  client-…
                </Pill>
              </div>
            </div>
            <ul className="flex flex-col gap-2">
              <Li>
                <b>Main source</b> (<code>main</code>): every shared feature and
                bug fix lands here first, through normal pull requests.
              </Li>
              <Li>
                <b>Integration</b> (e.g. <code>staging</code>): optional. Lets
                you test the combined result once before it reaches clients.
              </Li>
              <Li>
                <b>Client</b> branches: main <em>plus</em> that client&apos;s
                customisations. They receive updates; they never send shared
                code back.
              </Li>
            </ul>
            <p>
              In BranchFlow, each box above is a node on the canvas and each
              arrow is a merge. The arrow reads as{" "}
              <em>“bring the changes from here into there”</em>.
            </p>
          </Section>

          <Section id="rules" title="2. Team rules">
            <ol className="flex flex-col gap-3">
              <Rule n={1} title="Shared work goes to main — always.">
                Features and bug fixes that more than one client gets are merged
                into <code>main</code> via a pull request. Never build a shared
                feature on a client branch.
              </Rule>
              <Rule
                n={2}
                title="Client branches only hold client-specific changes."
              >
                Branding, config, client-only modules. Make those changes with a
                pull request into that client&apos;s branch.
              </Rule>
              <Rule n={3} title="Hotfix for one client? Fix it in main first.">
                Unless the bug only exists in that client&apos;s custom code,
                fix it in <code>main</code> and let the flow deliver it.
                Otherwise the same bug gets fixed differently in five places.
              </Rule>
              <Rule
                n={4}
                title="Only BranchFlow merges main into client branches."
              >
                No manual “merge main into client-x” on someone&apos;s laptop.
                That keeps the history clean and every sync visible in the run
                history.
              </Rule>
              <Rule n={5} title="One person owns each release run.">
                They press Run, resolve or delegate conflicts, and press
                Publish. If a conflict touches code they don&apos;t know, they
                ask the author of that change.
              </Rule>
            </ol>
          </Section>

          <Section id="procedure" title="3. Release procedure (every sync)">
            <p>
              Do this whenever <code>main</code> has changes the clients should
              get — ideally weekly, or after every important fix. Small,
              frequent syncs mean small, easy conflicts.
            </p>
            <div className="flex flex-col gap-3">
              <StepCard n={1} icon={WorkflowIcon} title="Open the flow">
                From the dashboard, open your flow (e.g. “Weekly release”). Make
                sure every client branch that should be updated is on the canvas
                and connected. New client? Drag its branch in from the left and
                connect it.
              </StepCard>
              <StepCard n={2} icon={ScanSearchIcon} title="Check for conflicts">
                Press <b>Check for conflicts</b>. Nothing is changed.
                You&apos;ll see, per arrow, how many commits will come in and
                whether any files will clash. Expand a step to see exactly which
                commits and files.
              </StepCard>
              <StepCard n={3} icon={PlayIcon} title="Run the flow">
                Press <b>Run flow</b>. Merges run in the numbered order on the
                arrows, in BranchFlow&apos;s private copy of the repository. You
                can watch each arrow light up.
              </StepCard>
              <StepCard
                n={4}
                icon={SwordsIcon}
                title="If it pauses: resolve the conflict"
              >
                The branch turns amber and the run waits. Click <b>Resolve</b>,
                decide each conflicting block, then{" "}
                <b>Finish &amp; continue run</b>. Not sure?{" "}
                <b>Skip this merge</b> leaves that client untouched for now, and
                the rest carry on. See section 4.
              </StepCard>
              <StepCard n={5} icon={CheckCircle2Icon} title="Review the result">
                When all steps are done the run says <b>Ready to publish</b>.
                Nothing has been pushed yet. Look over the steps and the
                activity log. If anything looks wrong, press <b>Discard</b> and
                nothing ever happened.
              </StepCard>
              <StepCard n={6} icon={CloudUploadIcon} title="Publish">
                Press <b>Publish</b> to push all updated branches at once. Then
                deploy / test each client as usual.
              </StepCard>
            </div>
            <Callout>
              Only one run per repository can be open at a time. If a run is
              waiting or unpublished, finish it (publish, discard or cancel)
              before starting the next one, so nobody&apos;s work gets mixed up.
            </Callout>
          </Section>

          <Section id="conflicts" title="4. Handling conflicts">
            <p>
              A conflict simply means{" "}
              <b>both branches changed the same lines</b>, for example main
              renamed a menu item that a client had already re-labelled. Git
              can&apos;t guess which is right, so it asks you.
            </p>
            <p>For each conflicting block you see two versions side by side:</p>
            <ul className="flex flex-col gap-2">
              <Li>
                <span className="font-semibold text-violet-600 dark:text-violet-300">
                  Incoming
                </span>
                : the new code coming from main / staging.
              </Li>
              <Li>
                <span className="font-semibold text-teal-600 dark:text-teal-300">
                  Current
                </span>
                : what the client branch has today, usually their customisation.
              </Li>
            </ul>
            <p>A rule of thumb for choosing:</p>
            <div className="overflow-hidden rounded-xl border text-xs">
              {[
                [
                  "It's the client's branding / wording / config",
                  "Keep current",
                ],
                [
                  "It's a bug fix or new feature logic from main",
                  "Take incoming",
                ],
                [
                  "Both added different things (e.g. two new menu items)",
                  "Keep both",
                ],
                [
                  "Main changed the code around the client's tweak",
                  "Write my own: apply the client's tweak to main's new code",
                ],
                [
                  "You're not sure",
                  "Skip this merge and ask the person who made the change",
                ],
              ].map(([when, what]) => (
                <div
                  key={when}
                  className="grid grid-cols-[1fr_auto] gap-4 border-b px-4 py-2.5 last:border-0"
                >
                  <span className="text-muted-foreground">{when}</span>
                  <span className="text-right font-medium">{what}</span>
                </div>
              ))}
            </div>
            <Callout>
              Resolved a conflict? The fix is saved in that client branch&apos;s
              history, so git won&apos;t ask about the same lines again next
              time unless main changes them again.
            </Callout>
            <h3 className="mt-2 font-semibold">
              Two-way sync (e.g. dev ⇄ main)
            </h3>
            <p>
              When you merge <code>dev</code> into <code>main</code> and resolve
              a conflict, the fix lives only in <code>main</code>. To keep both
              branches consistent, draw a second arrow <b>back</b> from{" "}
              <code>main</code> to <code>dev</code>. BranchFlow turns it into a{" "}
              <span className="font-medium text-violet-600 dark:text-violet-300">
                sync-back
              </span>{" "}
              (violet, dashed). It runs right after <code>main</code> has
              received all its merges, so <code>dev</code> gets exactly the
              resolved result. Usually both branches end up on the very same
              commit, with no extra conflict. Publish pushes both.
            </p>
          </Section>

          <Section id="undo" title="5. Undoing things">
            <p>
              Every run records exactly where each branch was before it started,
              so everything can be undone. Which button you use depends on how
              far you got:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <UndoCard
                icon={XCircleIcon}
                title="Cancel"
                when="While running or paused"
              >
                Stops the run. Merges that already finished stay in the private
                copy until you publish or discard them.
              </UndoCard>
              <UndoCard
                icon={Trash2Icon}
                title="Discard"
                when="Before publishing"
              >
                Throws away everything the run did. The shared repository was
                never touched, so this is 100% safe.
              </UndoCard>
              <UndoCard
                icon={Undo2Icon}
                title="Roll back"
                when="After publishing, nobody pushed since"
              >
                Puts the branches on the remote back exactly where they were.
                The cleanest undo. Refuses if someone pushed on top in the
                meantime. Teammates who pulled must pull again.
              </UndoCard>
              <UndoCard
                icon={RotateCcwIcon}
                title="Revert"
                when="After publishing, others pushed since"
              >
                Adds a new commit that cancels the merge. Always safe. Catch:
                git then treats those changes as “already merged”, so to bring
                them back later you must revert the revert. Prefer Roll back
                when possible.
              </UndoCard>
            </div>
          </Section>

          <Section id="tips" title="6. Fewer conflicts, less pain">
            <ul className="flex flex-col gap-2">
              <Li>
                <b>Sync often.</b> A weekly run with 10 commits is far easier
                than a quarterly one with 400.
              </Li>
              <Li>
                <b>Put client differences in config, not code.</b> A{" "}
                <code>clients/acme.json</code> or feature flags beat editing
                shared components on the client branch.
              </Li>
              <Li>
                <b>Add, don&apos;t edit.</b> When a client needs custom
                behaviour, add a new file/component and switch to it, rather
                than editing a shared file in place.
              </Li>
              <Li>
                <b>Keep formatting consistent.</b> Run the same formatter on
                every branch. Re-formatting causes the most pointless conflicts.
              </Li>
              <Li>
                <b>Use a staging node.</b> main → staging → clients lets you
                test once before every client gets it, and you resolve shared
                problems once instead of per client.
              </Li>
              <Li>
                <b>Retire customisations.</b> When a client feature becomes
                useful for everyone, move it into main behind a flag and delete
                it from the client branch.
              </Li>
            </ul>
          </Section>

          <Section id="glossary" title="7. Glossary">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
              {[
                [
                  "Flow",
                  "A saved diagram of which branches merge into which. Reused every release.",
                ],
                [
                  "Run",
                  "One execution of a flow. Has steps, a log, and can be published or undone.",
                ],
                [
                  "Step",
                  "One arrow on the canvas = one merge: “bring changes from A into B”.",
                ],
                [
                  "Conflict",
                  "Both branches changed the same lines; a human picks the final version.",
                ],
                [
                  "Publish",
                  "Push the run's results to the shared repository (GitHub/GitLab/…).",
                ],
                [
                  "Workspace",
                  "BranchFlow's private copy of the repo where merges happen before publishing.",
                ],
              ].map(([term, def]) => (
                <div key={term} className="contents">
                  <dt className="font-medium">{term}</dt>
                  <dd className="text-muted-foreground">{def}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </article>
      </div>
    </div>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="flex scroll-mt-24 flex-col gap-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8em]"
    >
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
      <span>{children}</span>
    </li>
  )
}

function Pill({
  icon: Icon,
  className,
  children,
}: {
  icon: React.ElementType
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-xs font-semibold ${className}`}
    >
      <Icon className="size-3.5" /> {children}
    </span>
  )
}

function Rule({
  n,
  title,
  children,
}: {
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3 rounded-xl border p-4">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[0.6875rem] font-semibold text-primary-foreground">
        {n}
      </span>
      <div>
        <div className="font-medium">{title}</div>
        <p className="mt-1 text-muted-foreground">{children}</p>
      </div>
    </li>
  )
}

function StepCard({
  n,
  icon: Icon,
  title,
  children,
}: {
  n: number
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-col items-center gap-1">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <span className="text-[0.625rem] font-semibold text-muted-foreground">
          STEP {n}
        </span>
      </div>
      <div>
        <div className="font-medium">{title}</div>
        <p className="mt-1 text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}

function UndoCard({
  icon: Icon,
  title,
  when,
  children,
}: {
  icon: React.ElementType
  title: string
  when: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <span className="font-medium">{title}</span>
      </div>
      <div className="mt-1 text-[0.6875rem] font-medium text-muted-foreground uppercase">
        {when}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{children}</p>
    </div>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs leading-relaxed">
      {children}
    </div>
  )
}
