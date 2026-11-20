import {
  ProductItem,
  CartItem,
  Exhibition,
  ScenePost,
  Story,
  Creator,
  QnaMessage,
  AiChatMessage,
} from '../types';
import {
  productsList,
  exhibitionsList,
  scenePostsList,
  sampleCreator,
  sampleStory,
} from '../data/mockData';

const STORAGE_KEYS = {
  CART: 'omnilink_cart_items_v1',
  SAVED: 'omnilink_saved_items_v1',
  QNA: 'omnilink_qna_history_v2',
  AI_CHAT: 'omnilink_ai_chat_v4',
  REJECTED: 'omnilink-rejected-products-v1',
  ARCHIVED_CONVERSATIONS: 'omnilink-ai-assistant-archived-conversations',
};
const LEGACY_ARCHIVED_CONVERSATIONS_KEY = 'omnilink-eva-archived-conversations';

function getBrowserStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    const storage = window.localStorage;
    return typeof storage?.getItem === 'function' && typeof storage?.setItem === 'function' ? storage : null;
  } catch {
    return null;
  }
}

function readStringList(key: string): string[] {
  try {
    const storage = getBrowserStorage();
    const currentValue = storage?.getItem(key);
    const legacyValue = !currentValue && key === STORAGE_KEYS.ARCHIVED_CONVERSATIONS
      ? storage?.getItem(LEGACY_ARCHIVED_CONVERSATIONS_KEY)
      : null;
    const value = currentValue ?? legacyValue;
    const parsed: unknown = value ? JSON.parse(value) : [];
    if (!Array.isArray(parsed)) return [];
    const result = parsed.filter((item): item is string => typeof item === 'string');
    if (key === STORAGE_KEYS.ARCHIVED_CONVERSATIONS && storage && legacyValue) {
      try {
        storage.setItem(key, JSON.stringify(result));
        storage.removeItem(LEGACY_ARCHIVED_CONVERSATIONS_KEY);
      } catch {
        // Existing archive data remains readable when storage is read-only.
      }
    }
    return result;
  } catch {
    return [];
  }
}

let syncChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel('omnilink_realtime_sync');
  }
} catch {
  syncChannel = null;
}

export class DataService {
  static getProducts(): ProductItem[] {
    return productsList;
  }

  static getProductById(id: string): ProductItem | undefined {
    return productsList.find((p) => p.id === id);
  }

  static searchProducts(query: string, products: ProductItem[] = productsList): ProductItem[] {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.creator.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q) ||
        p.storeName.toLowerCase().includes(q) ||
        Object.values(p.specs).some((value) => value.toLowerCase().includes(q))
    );
  }

  static getExhibitions(): Exhibition[] {
    return exhibitionsList;
  }

  static getScenePosts(): ScenePost[] {
    return scenePostsList;
  }

  static getCreator(): Creator | null {
    return sampleCreator;
  }

  static getStory(): Story | null {
    return sampleStory;
  }

  static getCart(products: ProductItem[] = productsList): CartItem[] {
    try {
      const stored = getBrowserStorage()?.getItem(STORAGE_KEYS.CART);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const productById = new Map(products.map((product) => [product.id, product]));
          return parsed.flatMap((item) => {
            const product = productById.get(item?.product?.id);
            if (!product || !Number.isInteger(item.quantity) || item.quantity < 1) return [];
            const variant = product.variants?.find((candidate) => candidate.id === item.variantId);
            return [{
              product,
              quantity: item.quantity,
              variant: variant ? Object.values(variant.optionValues).join(' / ') : '',
              variantId: variant?.id ?? null,
              selectedOptions: variant?.optionValues,
            }];
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load cart', e);
    }
    return [];
  }

  static saveCart(items: CartItem[]): void {
    try {
      const storage = getBrowserStorage();
      if (!storage) return;
      storage.setItem(STORAGE_KEYS.CART, JSON.stringify(items));
      if (syncChannel) {
        syncChannel.postMessage({ type: 'CART_UPDATED', payload: items });
      }
    } catch (e) {
      console.warn('Failed to persist cart', e);
    }
  }

  static getSavedProductIds(products: ProductItem[] = productsList): string[] {
    return readStringList(STORAGE_KEYS.SAVED).filter((id) => products.some((product) => product.id === id));
  }

  static saveProductIds(ids: string[]): void {
    try {
      const storage = getBrowserStorage();
      if (!storage) return;
      storage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(ids));
      if (syncChannel) {
        syncChannel.postMessage({ type: 'SAVED_UPDATED', payload: ids });
      }
    } catch {
      // ignore
    }
  }

  static getQnaHistory(): Record<string, QnaMessage[]> {
    try {
      const stored = getBrowserStorage()?.getItem(STORAGE_KEYS.QNA);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {};
  }

  static saveQnaHistory(history: Record<string, QnaMessage[]>): void {
    try {
      getBrowserStorage()?.setItem(STORAGE_KEYS.QNA, JSON.stringify(history));
    } catch {
      // ignore
    }
  }

  static getAiChatHistory(products: ProductItem[] = productsList): AiChatMessage[] {
    try {
      const stored = getBrowserStorage()?.getItem(STORAGE_KEYS.AI_CHAT);
      if (stored) {
        let conversationId = '';
        return (JSON.parse(stored) as AiChatMessage[]).map((message) => {
          if (message.conversationId) conversationId = message.conversationId;
          else if (message.isUser) conversationId = message.id;
          return {
            ...message,
            conversationId: conversationId || message.id,
            matchedProducts: message.matchedProducts?.flatMap((item) => {
              const product = products.find((candidate) => candidate.id === item.id);
              return product ? [product] : [];
            }),
          };
        });
      }
    } catch {
      // ignore
    }
    return [
      {
        id: 'msg_welcome',
        text: '发送消息或上传照片，我会结合当前可用的商品目录给出建议；没有依据的部分会明确说明。',
        isUser: false,
        timestamp: '刚刚',
      },
    ];
  }

  static saveAiChatHistory(messages: AiChatMessage[]): void {
    try {
      getBrowserStorage()?.setItem(STORAGE_KEYS.AI_CHAT, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }

  static getRejectedProductIds(): string[] {
    return readStringList(STORAGE_KEYS.REJECTED).slice(0, 100);
  }

  static saveRejectedProductIds(ids: string[]): void {
    try {
      getBrowserStorage()?.setItem(STORAGE_KEYS.REJECTED, JSON.stringify(ids));
    } catch {
      // ignore
    }
  }

  static getArchivedConversationIds(): string[] {
    return readStringList(STORAGE_KEYS.ARCHIVED_CONVERSATIONS);
  }

  static saveArchivedConversationIds(ids: string[]): void {
    try {
      getBrowserStorage()?.setItem(STORAGE_KEYS.ARCHIVED_CONVERSATIONS, JSON.stringify(ids));
    } catch {
      // ignore
    }
  }

  static getReplacementOptions(currentProductId: string): ProductItem[] {
    return productsList.filter((p) => p.id !== currentProductId);
  }

  static generateQnaAnswer(question: string, product: ProductItem): { answer: string; evidence: string } {
    const q = question.toLowerCase();
    const matchingSpec = Object.entries(product.specs).find(([key]) =>
      q.includes(key.toLowerCase()) ||
      (/(尺寸|size|dimension|length)/i.test(q) && /(尺寸|尺码|size|dimension)/i.test(key)) ||
      (/(材质|材料|material)/i.test(q) && /(材质|材料|material)/i.test(key)) ||
      (/(颜色|color)/i.test(q) && /(颜色|color)/i.test(key)) ||
      (/(配送|运费|shipping|deliver)/i.test(q) && key === '配送政策') ||
      (/(库存|现货|stock|availability)/i.test(q) && key === '库存状态') ||
      (/(价格|多少钱|price|cost)/i.test(q) && key === '价格状态')
    );
    if (matchingSpec) {
      return {
        answer: `商品资料中，${matchingSpec[0]}为：${matchingSpec[1]}。`,
        evidence: `${matchingSpec[0]}：${matchingSpec[1]}${product.sourceUrl ? `；来源：${product.sourceUrl}` : ''}`,
      };
    }
    return {
      answer: '当前商品资料没有提供这个问题的答案，请向原店确认。',
      evidence: product.sourceUrl || '商品详情尚未提供相关字段。',
    };
  }

  static subscribeToSync(callback: (event: { type: string; payload: unknown }) => void): () => void {
    if (syncChannel) {
      const handler = (event: MessageEvent) => {
        callback(event.data);
      };
      syncChannel.addEventListener('message', handler);
      return () => {
        syncChannel?.removeEventListener('message', handler);
      };
    }
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.CART && e.newValue) {
        callback({ type: 'CART_UPDATED', payload: JSON.parse(e.newValue) });
      }
    };
    window.addEventListener('storage', storageHandler);
    return () => window.removeEventListener('storage', storageHandler);
  }
}
