import type { StorefrontProductOption, StorefrontProductVariant } from '@/lib/storefront/types';
import type { OutboundLinks } from '@/lib/products/outbound-links';

export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  categoryTag: string;
  createdAt?: string;
}

export type ProductCompositionKind = 'cosmetic-inci' | 'textile-fiber' | 'metal-alloy' | 'material' | 'other' | 'unknown';
export type ProductCompositionStatus = 'verified' | 'partial' | 'not_provided' | 'not_applicable';

export interface ProductCompositionEntry {
  name: string;
  /** NFKC-normalized, whitespace-collapsed lowercase value for exact filters. */
  normalizedName?: string;
  position?: number;
  proportion?: string;
  purity?: string;
  role?: string;
  sourceLabel?: string;
}

/** Shared composition field for formulas, textile fibers, metals, and other product materials. */
export interface ProductComposition {
  kind: ProductCompositionKind;
  status: ProductCompositionStatus;
  items: ProductCompositionEntry[];
  rawText?: string;
  region?: string;
  sourceUrl?: string;
  observedAt?: string;
  verifiedAt?: string;
}

export interface ProductItem {
  id: string;
  name: string;
  creator: string;
  itemType?: 'product' | 'service' | 'skill';
  price: number;
  formattedPrice: string;
  priceMode?: 'amount' | 'inquiry' | 'free' | 'unknown';
  outboundLinks?: OutboundLinks;
  mainImage: string;
  videoUrl?: string;
  aspectRatio: number;
  posterFormat?: 'landscape' | 'portrait';
  secondaryImages: string[];
  category: string;
  shortDescription: string;
  aiSummary: string;
  reviews: Review[];
  specs: Record<string, string>;
  composition?: ProductComposition;
  recommendationFacets?: Record<string, string[]>;
  storeName: string;
  sourceUrl?: string;
  sourceDate?: string;
  catalogAddedAt?: string | null;
  catalogEvidence?: {
    sourceType: 'official_store' | 'public_page';
    reviewedAt: string;
    productPageStatus: 'indexed_snapshot' | 'previous_capture' | 'not_revalidated' | 'fetched';
    listingUrl: string;
    priceStatus: 'snapshot' | 'unconfirmed';
    priceSourceUrl?: string;
    shippingSourceUrl?: string;
    stockStatus: 'unknown' | 'sold_out_snapshot';
    deliveryToChina: 'unverified';
    verifiedDeliveryCountries?: string[];
    checkoutVerified: false;
    imageStatus: 'source_url_only';
  };
  storeDescription?: string;
  storeImage?: string;
  contextStory?: string;
  hasWhiteBg?: boolean;
  currency?: string;
  storeSlug?: string;
  defaultVariantId?: string | null;
  options?: StorefrontProductOption[];
  variants?: StorefrontProductVariant[];
  deliveryType?: 'physical' | 'digital' | 'ai_capability';
  capabilityKind?: 'question_set' | 'skill' | 'plugin';
}

/** Product records returned by the catalog always include a normalized composition field. */
export interface CatalogProductItem extends ProductItem {
  composition: ProductComposition;
}

export type DiscoveryType = '商品' | '数字' | '服务';

export function getDiscoveryType(item: Pick<ProductItem, 'itemType' | 'deliveryType' | 'capabilityKind'>): DiscoveryType {
  if (item.itemType === 'service') return '服务';
  if (item.itemType === 'skill' || item.deliveryType === 'digital' || item.deliveryType === 'ai_capability' || item.capabilityKind) return '数字';
  return '商品';
}

export interface ExhibitionChapter {
  chapterNumber: string;
  title: string;
  image: string;
  contentText: string;
  taggedProducts: ProductItem[];
}

export interface Exhibition {
  id: string;
  title: string;
  subtitle: string;
  coverImage: string;
  description: string;
  chapters: ExhibitionChapter[];
}

export interface Creator {
  id: string;
  name: string;
  tagline: string;
  portrait: string;
  bio: string;
  gridImages: string[];
  styleTags: string[];
}

export interface StoryParagraph {
  text: string;
  image?: string;
  productRef?: ProductItem;
}

export interface Story {
  id: string;
  title: string;
  creatorName: string;
  heroImage: string;
  paragraphs: StoryParagraph[];
}

export interface ScenePost {
  id: string;
  href?: string;
  kind?: 'collection' | 'note';
  title: string;
  editorName: string;
  editorAvatar: string;
  coverImage: string;
  isVideo: boolean;
  mediaList: string[];
  linkedProducts: ProductItem[];
  aspectRatio: number;
  description: string;
  blocks?: import('@/lib/creator-content').ContentBlock[];
  publication?: import('@/lib/creator-publication-document').PublicationDocument;
  hasWhiteBg?: boolean;
}

export type FeedItem =
  | { type: 'product'; product: ProductItem }
  | { type: 'scene'; scenePost: ScenePost };

export interface CartItem {
  product: ProductItem;
  quantity: number;
  variant: string;
  variantId?: string | null;
  selectedOptions?: Record<string, string>;
}

export interface QnaMessage {
  id: string;
  text: string;
  isUser: boolean;
  evidenceText?: string;
  timestamp?: string;
}

export type ConsumerTaskIntent = 'ingredient-lookup' | 'image-analysis' | 'document-analysis' | 'outfit-styling' | 'product-search' | 'product-question' | 'comparison' | 'personalized-recommendation' | 'cart-request' | 'assistant' | 'information-search';

export interface AiChatMessage {
  id: string;
  conversationId?: string;
  text: string;
  isUser: boolean;
  image?: string;
  styleTag?: string;
  intent?: ConsumerTaskIntent;
  matchedProducts?: ProductItem[];
  matchReasons?: Record<string, string>;
  usedPreferences?: string[];
  memoryProposed?: boolean;
  analysisMessageId?: string;
  fileName?: string;
  timestamp?: string;
  model?: ConsumerAiModel;
  searchRef?: import('@/lib/consumer-advisor/discovery-contract').DiscoveryReference;
  retrySpec?: import('@/lib/consumer-advisor/discovery-contract').DiscoverySpec;
  blocks?: import('@/lib/consumer-advisor/response-contract').ResponseBlock[];
  state?: 'streaming'|'completed'|'failed'|'cancelled';
  matchedSourceIds?:string[];
}

export type ConsumerAiModel = 'gemini' | 'qwen-plus' | 'deepseek-flash' | 'deepseek-v4-pro';
