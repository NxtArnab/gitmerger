import { execFile } from "node:child_process"

export interface GitResult {
  code: number
  stdout: string
  stderr: string
}

export class GitError extends Error {
  constructor(
    public args: string[],
    public result: GitResult
  ) {
    super(
      (result.stderr || result.stdout).trim() ||
        `git ${args[0]} failed with exit code ${result.code}`
    )
  }
}

export interface GitOptions {
  cwd: string
  identity?: { name?: string; email?: string }
  timeoutMs?: number
}

/** Runs git and resolves with the exit code instead of throwing. */
export function gitRaw(args: string[], opts: GitOptions): Promise<GitResult> {
  const config: string[] = []
  if (opts.identity?.name) config.push("-c", `user.name=${opts.identity.name}`)
  if (opts.identity?.email)
    config.push("-c", `user.email=${opts.identity.email}`)

  return new Promise((resolve) => {
    execFile(
      "git",
      [...config, ...args],
      {
        cwd: opts.cwd,
        maxBuffer: 64 ,
        timeout: opts.timeoutMs ?? 10 ,
        windowsHide: true,
        env: {
          ...process.env,
          // Never block waiting for a password or an editor.
          GIT_TERMINAL_PROMPT: "0",
          GIT_EDITOR: "true",
          GIT_MERGE_AUTOEDIT: "no",
          LC_ALL: "C",
        },
      },
      (error, stdout, stderr) => {
        const code =
          error && typeof error.code === "number" ? error.code : error ? 1 : 0
        resolve({ code, stdout: String(stdout), stderr: String(stderr) })
      }
    )
  })
}

/** Runs git and throws GitError on a non-zero exit code. */
export async function git(args: string[], opts: GitOptions) {
  const result = await gitRaw(args, opts)
  if (result.code !== 0) throw new GitError(args, result)
  return result.stdout
}

const g = globalThis as unknown as {
  __mergerLocks?: Map<string, Promise<unknown>>
}
const locks = (g.__mergerLocks ??= new Map())

/** Serialises every git operation on one workspace. */
export function withRepoLock<T>(repoId: string, fn: () => Promise<T>) {
  const previous = locks.get(repoId) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(fn)
  locks.set(
    repoId,
    next.catch(() => {})
  )
  return next
}
