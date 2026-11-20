import { PublicSiteDataError } from './public-data'

export async function siteDataResponse(read: () => Promise<unknown>) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  try { return Response.json(await read(), { headers }) }
  catch (error) {
    if (error instanceof PublicSiteDataError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status, headers })
    return Response.json({ error: { code: 'DATA_UNAVAILABLE', message: '网站数据暂时不可用' } }, { status: 503, headers })
  }
}
