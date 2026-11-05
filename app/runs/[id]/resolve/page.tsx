import { Suspense } from "react"

import { ConflictResolver } from "@/components/conflicts/resolver"

export default async function ResolvePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <Suspense>
      <ConflictResolver runId={id} />
    </Suspense>
  )
}
