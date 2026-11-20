import { siteDataResponse } from '@/lib/site-builder/http'
import { readSiteStore } from '@/lib/site-builder/public-data'

export async function GET(_request: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  return siteDataResponse(async () => readSiteStore((await params).storeSlug))
}
