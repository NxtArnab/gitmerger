import { FlowEditor } from "@/components/flow/flow-editor"

export default async function FlowPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <FlowEditor flowId={id} />
}
