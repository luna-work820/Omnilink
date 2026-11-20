import { siteDataResponse } from '@/lib/site-builder/http'
import { readSiteProduct } from '@/lib/site-builder/public-data'

export async function GET(_request: Request, { params }: { params: Promise<{ storeSlug: string; productId: string }> }) {
  return siteDataResponse(async () => { const { storeSlug, productId } = await params; return readSiteProduct(storeSlug, productId) })
}
