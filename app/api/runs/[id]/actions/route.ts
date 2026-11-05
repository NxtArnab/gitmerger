import { found, handle } from "@/lib/server/http"
import {
  cancelRun,
  continueRun,
  discardRun,
  publishRun,
  revertRun,
  rollbackRun,
  skipStep,
  UserError,
} from "@/lib/server/runner"
import { store } from "@/lib/server/store"
import type { Run } from "@/lib/types"

const actions: Record<string, (run: Run) => Promise<unknown>> = {
  continue: continueRun,
  skip: skipStep,
  cancel: cancelRun,
  publish: publishRun,
  discard: discardRun,
  revert: revertRun,
  rollback: rollbackRun,
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params
    const run = found(store.run(id), "Run")
    const { action } = (await request.json()) as { action: string }
    const fn = actions[action]
    if (!fn) throw new UserError(`Unknown action "${action}"`)
    await fn(run)
    return run
  })
}
