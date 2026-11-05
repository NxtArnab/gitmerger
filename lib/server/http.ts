import { GitError } from "./git"
import { UserError } from "./runner"

/** Wraps a route handler so every failure becomes a readable JSON error. */
export async function handle<T>(fn: () => Promise<T>) {
  try {
    return Response.json(await fn())
  } catch (err) {
    if (err instanceof NotFound)
      return Response.json({ error: err.message }, { status: 404 })
    if (err instanceof UserError || err instanceof GitError)
      return Response.json({ error: err.message }, { status: 400 })
    console.error(err)
    return Response.json(
      { error: err instanceof Error ? err.message : "Something went wrong" },
      { status: 500 }
    )
  }
}

export class NotFound extends Error {}

export function found<T>(value: T | undefined, what: string): T {
  if (!value) throw new NotFound(`${what} not found`)
  return value
}
