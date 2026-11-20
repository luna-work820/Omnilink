import { siteDataResponse } from '@/lib/site-builder/http'
import { readSiteProducts } from '@/lib/site-builder/public-data'

export async function GET(request: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  return siteDataResponse(async () => readSiteProducts((await params).storeSlug, new URL(request.url).searchParams))
}
