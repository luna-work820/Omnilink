import type { ScenePost } from '@/components/consumer-market/types'
import { parsePublicationDocument, publicationScene } from '@/lib/creator-publication-document'
import { readContentBlocks } from '@/lib/creator-content'
import type { createClientServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

const publicColumns = 'id,kind,title,cover_url,body,product_ids,blocks,publication,published_at,store_id'
export async function readPublishedContent(supabase: Awaited<ReturnType<typeof createClientServer>>, focusId?: string) {
  const query = () => supabase.from('creator_posts').select(publicColumns).eq('status', 'published').eq('visibility', 'public')
  const [list, focus] = await Promise.all([
    query().order('published_at', { ascending: false }).limit(48),
    focusId && /^[0-9a-f-]{36}$/i.test(focusId) ? query().eq('id', focusId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  if (list.error || focus.error) throw new Error('内容暂时无法读取，请稍后重试。')
  const rows = [...(list.data ?? [])]
  const focused = focus.data
  if (focused && !rows.some((row) => row.id === focused.id)) rows.unshift(focused)
  const storeIds = [...new Set(rows.map((row) => row.store_id))]
  // Stores are private; only names attached to already-public posts enter this projection.
  const stores = storeIds.length ? await createServiceRoleClient().from('stores').select('id,name').in('id', storeIds).eq('status', 'active').is('deleted_at', null) : { data: [], error: null }
  if (stores.error) throw new Error('发布者信息读取失败。')
  const posts: ScenePost[] = []
  for (const row of rows) {
    const author = stores.data?.find((store) => store.id === row.store_id)
    if (!author) continue
    const document = parsePublicationDocument(row.publication)
    if (document) posts.push(publicationScene(row.id, document, author.name || '创作者'))
    else if (!row.publication) posts.push({ id: row.id, kind: row.kind === 'collection' ? 'collection' : 'note', title: row.title, editorName: author.name || '创作者', editorAvatar: '', coverImage: row.cover_url,
      isVideo: readContentBlocks(row.blocks, row.body, row.product_ids).some((block) => block.type === 'video'), mediaList: [], linkedProducts: [], aspectRatio: 4 / 3, description: row.body, blocks: readContentBlocks(row.blocks, row.body, row.product_ids) })
  }
  return posts
}
