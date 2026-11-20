import sharp from 'sharp'

export async function inspectImage(bytes: Buffer) {
  const metadata = await sharp(bytes).metadata()
  return {
    width: metadata.width,
    height: metadata.height,
    exif: Boolean(metadata.exif),
  }
}

export async function encodeWebp(bytes: Buffer, quality: number) {
  return sharp(bytes).rotate().webp({ quality }).toBuffer()
}

export async function encodeAvatar(bytes: Buffer) {
  return sharp(bytes, { failOn: 'error' })
    .rotate()
    .resize(512, 512, { fit: 'cover' })
    .webp({ quality: 82 })
    .toBuffer()
}

export async function sampleImage(bytes: Buffer) {
  const { data, info } = await sharp(bytes)
    .resize({ width: 48, height: 48, fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, channels: info.channels }
}
