export interface ProductImageItem {
  id: string
  url: string
  name: string
  size?: number
  isHero?: boolean
  file?: File
}

export interface BrandConceptData {
  brandName: string
  concept: string
  category: string
  targetAudience: string
  tags: string[]
}

export interface BrandAnalysisResult {
  styleName: string
  brandPositioning: string
  coreSlogan: string
  dominantColors: Array<{ hex: string; name: string; role: string }>
  visualKeywords: string[]
  typography: {
    displayFont: string
    bodyFont: string
    characteristics: string
  }
  selectedToneId: string
  toneOptions: Array<{
    id: string
    title: string
    description: string
    accentColor: string
    bgColor: string
  }>
}

export interface GeneratedStorefrontData {
  heroHeadline: string
  heroSubheading: string
  ctaText: string
  navLinks: string[]
  features: Array<{ title: string; desc: string; icon: string }>
  featuredProducts: Array<{ id: string; name: string; price: string; imageUrl: string; tag: string }>
  brandStory: string
}

export interface GeneratedPosterItem {
  id: string
  title: string
  subtitle: string
  ratio: '1:1' | '3:4' | '16:9'
  imageUrl: string
  badgeText: string
  accentColor: string
}
