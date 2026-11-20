import { env } from 'cloudflare:workers'

function stream(bytes: Buffer) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

function hasExif(bytes: Buffer) {
  if (bytes.length < 12) return false

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 4 < bytes.length && bytes[offset] === 0xff) {
      const marker = bytes[offset + 1]
      if (marker === 0xda || marker === 0xd9) break
      const size = bytes.readUInt16BE(offset + 2)
      if (size < 2 || offset + size + 2 > bytes.length) break
      if (marker === 0xe1 && bytes.toString('ascii', offset + 4, offset + 10) === 'Exif\0\0') return true
      offset += size + 2
    }
  }

  if (bytes.toString('ascii', 1, 4) === 'PNG') {
    let offset = 8
    while (offset + 12 <= bytes.length) {
      const size = bytes.readUInt32BE(offset)
      if (bytes.toString('ascii', offset + 4, offset + 8) === 'eXIf') return true
      offset += size + 12
    }
  }

  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    let offset = 12
    while (offset + 8 <= bytes.length) {
      const size = bytes.readUInt32LE(offset + 4)
      if (bytes.toString('ascii', offset, offset + 4) === 'EXIF') return true
      offset += size + 8 + (size % 2)
    }
  }

  return false
}

export async function inspectImage(bytes: Buffer) {
  const info = await env.IMAGES.info(stream(bytes))
  if (!('width' in info)) throw new Error('Unsupported image type')
  return { width: info.width, height: info.height, exif: hasExif(bytes) }
}

export async function encodeWebp(bytes: Buffer, quality: number) {
  const result = await env.IMAGES.input(stream(bytes)).output({ format: 'image/webp', quality, anim: false })
  return Buffer.from(await result.response().arrayBuffer())
}

export async function encodeAvatar(bytes: Buffer) {
  const result = await env.IMAGES.input(stream(bytes))
    .transform({ width: 512, height: 512, fit: 'cover' })
    .output({ format: 'image/webp', quality: 82, anim: false })
  return Buffer.from(await result.response().arrayBuffer())
}

export async function sampleImage(bytes: Buffer) {
  const result = await env.IMAGES.input(stream(bytes))
    .transform({ width: 48, height: 48, fit: 'scale-down' })
    .output({ format: 'rgb', anim: false })
  return { data: Buffer.from(await new Response(result.image()).arrayBuffer()), channels: 3 }
}
