import { redirect } from 'next/navigation'

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ store_slug: string; orderId: string }>
}) {
  const { store_slug } = await params
  redirect(`/store/${encodeURIComponent(store_slug)}/cart`)
}
