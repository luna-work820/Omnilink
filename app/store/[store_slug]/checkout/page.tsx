import { redirect } from 'next/navigation'

export default async function StoreCheckoutPage({
  params,
}: {
  params: Promise<{ store_slug: string }>
}) {
  const { store_slug } = await params
  redirect(`/store/${encodeURIComponent(store_slug)}/cart`)
}
