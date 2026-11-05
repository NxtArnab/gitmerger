import {
  listConflicts,
  readConflict,
  resolveConflict,
  type Resolution,
} from "@/lib/server/conflicts"
import { found, handle } from "@/lib/server/http"
import { store } from "@/lib/server/store"

type Ctx = { params: Promise<{ id: string }> }

/** Lists conflicted files, or returns one file's versions with ?path=. */
export async function GET(request: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const run = found(store.run(id), "Run")
    const file = new URL(request.url).searchParams.get("path")
    if (file) return readConflict(run, file)
    return { files: await listConflicts(run) }
  })
}

export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const run = found(store.run(id), "Run")
    const body = (await request.json()) as Resolution & { path: string }
    await resolveConflict(run, body.path, body)
    return { files: await listConflicts(run) }
  })
}
