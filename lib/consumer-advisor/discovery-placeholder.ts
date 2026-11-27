export function isDiscoveryPlaceholderImage(imageUrl: unknown): boolean {
  if (typeof imageUrl !== 'string') return false
  const path = imageUrl.split(/[?#]/, 1)[0]
  return /^https?:\/\/static\.reverb-assets\.com\/production-assets\/webpack\/images\/[^/]+\.svg$/i.test(path)
    || /(?:^|\/)[^/]*(?:placeholder|image[-_]pending)[^/]*\.(?:svg|png|webp|jpe?g|gif)$/i.test(path)
}
