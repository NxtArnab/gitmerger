import { handle } from "@/lib/server/http"
import { detectInterrupted } from "@/lib/server/runner"
import { store } from "@/lib/server/store"

export async function GET() {
  return handle(async () => ({
    runs: store.runs().slice(0, 50).map(detectInterrupted),
  }))
}
