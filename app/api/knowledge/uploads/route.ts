import { randomUUID } from 'node:crypto'
import net from 'node:net'
import { NextRequest, NextResponse } from 'next/server'

import { getOwnedStoreId, requireUser } from '@/lib/api/auth'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const runtime = 'nodejs'

const MAX_PDF_BYTES = 20 * 1024 * 1024
const MAX_ZIP_BYTES = 50 * 1024 * 1024

function fileKind(buffer: Buffer) {
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return { extension: 'pdf', contentType: 'application/pdf', limit: MAX_PDF_BYTES }
  const zip = buffer.subarray(0, 4).toString('binary')
  if (zip === 'PK\x03\x04' || zip === 'PK\x05\x06' || zip === 'PK\x07\x08') return { extension: 'zip', contentType: 'application/zip', limit: MAX_ZIP_BYTES }
  return null
}

function scan(buffer: Buffer) {
  const host = process.env.CLAMAV_HOST ?? '127.0.0.1'
  const port = Number(process.env.CLAMAV_PORT ?? '3310')
  return new Promise<{ clean: boolean; detail: string }>((resolve, reject) => {
    const socket = net.createConnection({ host, port })
    let reply = ''
    socket.setTimeout(60_000)
    socket.on('connect', () => {
      socket.write('zINSTREAM\0')
      for (let offset = 0; offset < buffer.length; offset += 64 * 1024) {
        const chunk = buffer.subarray(offset, offset + 64 * 1024)
        const length = Buffer.alloc(4)
        length.writeUInt32BE(chunk.length)
        socket.write(length)
        socket.write(chunk)
      }
      socket.end(Buffer.alloc(4))
    })
    socket.on('data', (data) => { reply += data.toString('utf8') })
    socket.on('end', () => resolve({ clean: /\bOK\b/.test(reply), detail: reply.trim() || 'Scanner returned no result' }))
    socket.on('timeout', () => socket.destroy(new Error('Scanner timeout')))
    socket.on('error', reject)
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  const preview = !auth.ok && process.env.NODE_ENV !== 'production'
  if (!auth.ok && !preview) return auth.response
  const storeId = auth.ok ? await getOwnedStoreId(auth.supabase, auth.user) : null
  if (!preview && !storeId) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File) || !file.name || file.name.length > 180) return NextResponse.json({ error: 'Invalid file' }, { status: 400 })
  const buffer = Buffer.from(await file.arrayBuffer())
  const kind = fileKind(buffer)
  if (!kind || buffer.length > kind.limit) return NextResponse.json({ error: 'Only PDF (20 MB) and ZIP (50 MB) files are accepted' }, { status: 400 })

  let result: { clean: boolean; detail: string }
  try { result = await scan(buffer) } catch { return NextResponse.json({ error: 'Virus scanner unavailable. File was not stored.' }, { status: 503 }) }
  if (preview) return NextResponse.json({ id: randomUUID(), status: result.clean ? 'clean' : 'rejected', name: file.name, preview: true }, { status: result.clean ? 201 : 422 })
  if (!auth.ok || !storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceRoleClient()
  const id = randomUUID()
  const safeName = file.name.replace(/[^\w.()-]/g, '_')
  const objectPath = `${storeId}/${id}/${safeName}`
  const row = { id, store_id: storeId, uploaded_by: auth.user.id, original_name: file.name, content_type: kind.contentType, byte_size: buffer.length, status: result.clean ? 'clean' : 'rejected', scan_detail: result.detail, object_path: result.clean ? objectPath : null }
  if (result.clean) {
    const { error } = await service.storage.from('knowledge-quarantine').upload(objectPath, buffer, { contentType: kind.contentType, upsert: false })
    if (error) return NextResponse.json({ error: 'Private storage upload failed' }, { status: 502 })
  }
  const { error } = await (service.from('knowledge_uploads') as any).insert(row)
  if (error) {
    if (result.clean) await service.storage.from('knowledge-quarantine').remove([objectPath])
    return NextResponse.json({ error: 'Upload record failed' }, { status: 500 })
  }
  return NextResponse.json({ id, status: row.status, name: file.name }, { status: result.clean ? 201 : 422 })
}
