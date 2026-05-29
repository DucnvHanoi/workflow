import { redirect } from 'next/navigation'

export default async function InstanceDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  redirect(`/tasks?open=${id}`)
}
