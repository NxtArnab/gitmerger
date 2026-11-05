import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { git } from "./git"
import { DATA_DIR, newId } from "./store"

const identity = { name: "Demo Developer", email: "demo@example.com" }

const config = (
  name: string,
  color: string,
  extra = ""
) => `export const config = {
  appName: "${name}",
  primaryColor: "${color}",
  features: {
    kanban: true,
    timesheets: true,${extra}
  },
}
`

const dashboard = (title: string) => `import { config } from "./config"

export function Dashboard() {
  return (
    <main>
      <h1>${title}</h1>
      <TaskBoard enabled={config.features.kanban} />
    </main>
  )
}
`

/**
 * Builds a small sample "project management app" repository with a main
 * branch, a staging branch and three client branches. One client has
 * customised the same lines main later changes, so the demo hits a real
 * merge conflict.
 */
export async function createDemoRepo() {
  const root = path.join(DATA_DIR, "demo", newId())
  const work = path.join(root, "seed")
  const origin = path.join(root, "origin.git")
  await mkdir(work, { recursive: true })
  const opts = { cwd: work, identity }
  const write = (file: string, content: string) =>
    mkdir(path.dirname(path.join(work, file)), { recursive: true }).then(() =>
      writeFile(path.join(work, file), content)
    )
  const commit = async (message: string) => {
    await git(["add", "-A"], opts)
    await git(["commit", "-q", "-m", message], opts)
  }

  await git(["init", "-q", "-b", "main"], opts)
  await write("README.md", "# TaskPilot\n\nProject management for teams.\n")
  await write("src/config.ts", config("TaskPilot", "#4f46e5"))
  await write("src/dashboard.tsx", dashboard("Your projects"))
  await write(
    "src/tasks.ts",
    "export function dueSoon(tasks) {\n  return tasks.filter((t) => t.due < Date.now())\n}\n"
  )
  await commit("Initial project")

  for (const b of ["staging", "client-acme", "client-globex", "client-initech"])
    await git(["branch", b], opts)

  await git(["checkout", "-q", "client-acme"], opts)
  await write("src/config.ts", config("Acme Projects", "#e11d48"))
  await write("src/dashboard.tsx", dashboard("Acme project hub"))
  await commit("Acme: custom branding")

  await git(["checkout", "-q", "client-globex"], opts)
  await write("src/theme.css", ":root {\n  --brand: #0ea5e9;\n}\n")
  await commit("Globex: custom theme file")

  await git(["checkout", "-q", "client-initech"], opts)
  await write(
    "src/reports/tps.ts",
    "export function tpsReport() {\n  return 'Did you get the memo?'\n}\n"
  )
  await commit("Initech: TPS report module")

  await git(["checkout", "-q", "main"], opts)
  await write(
    "src/tasks.ts",
    "export function dueSoon(tasks, now = Date.now()) {\n  return tasks.filter((t) => !t.done && t.due < now)\n}\n"
  )
  await commit("Fix: completed tasks showed as overdue")
  await write(
    "src/config.ts",
    config("TaskPilot Pro", "#4f46e5", "\n    gantt: true,")
  )
  await write("src/dashboard.tsx", dashboard("Your projects at a glance"))
  await write(
    "src/gantt.ts",
    "export function GanttChart() {\n  // new feature\n}\n"
  )
  await commit("Feature: Gantt chart view")

  await git(["init", "-q", "--bare", "-b", "main", origin], { cwd: root })
  await git(["push", "-q", origin, "--all"], opts)
  await rm(work, { recursive: true, force: true })
  return origin
}
