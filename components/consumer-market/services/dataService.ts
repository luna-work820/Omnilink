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
  lampProduct,
  chairProduct,
  clockProduct,
  vesselProduct,
  headphonesProduct,
  keyboardProduct,
  cratesProduct,
  mobileTableProduct,
  linenCoatProduct,
  knitSweaterProduct,
  shelfProduct,
} from '../data/mockData';

const STORAGE_KEYS = {
  CART: 'omnilink_cart_items_v1',
  SAVED: 'omnilink_saved_items_v1',
  QNA: 'omnilink_qna_history_v1',
  AI_CHAT: 'omnilink_ai_chat_v3',
};

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
        p.storeName.toLowerCase().includes(q)
    );
  }

  static getExhibitions(): Exhibition[] {
    return exhibitionsList;
  }

  static getScenePosts(): ScenePost[] {
    return scenePostsList;
  }

  static getCreator(): Creator {
    return sampleCreator;
  }

  static getStory(): Story {
    return sampleStory;
  }

  static getCart(products: ProductItem[] = productsList, useOnlyProvidedProducts = false): CartItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CART);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const productIds = new Set(products.map((product) => product.id));
          return parsed.filter((item): item is CartItem => item?.product && productIds.has(item.product.id));
        }
      }
    } catch (e) {
      console.warn('Failed to load cart', e);
    }
    if (useOnlyProvidedProducts) return [];
    return [
      { product: lampProduct, quantity: 1, variant: 'Brushed Brass' },
      { product: keyboardProduct, quantity: 1, variant: 'Dual Dial TKL' },
    ];
  }

  static saveCart(items: CartItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(items));
      if (syncChannel) {
        syncChannel.postMessage({ type: 'CART_UPDATED', payload: items });
      }
    } catch (e) {
      console.warn('Failed to persist cart', e);
    }
  }

  static getSavedProductIds(): string[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SAVED);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return ['p_lamp_01', 'p_chair_02', 'p_keyboard_07', 'p_headphones_06'];
  }

  static saveProductIds(ids: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(ids));
      if (syncChannel) {
        syncChannel.postMessage({ type: 'SAVED_UPDATED', payload: ids });
      }
    } catch {
      // ignore
    }
  }

  static getQnaHistory(): Record<string, QnaMessage[]> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.QNA);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {
      p_lamp_01: [
        {
          id: 'q1',
          text: '底座占地与光线色温如何？',
          isUser: false,
          evidenceText: '实测底座直径18cm，搭载2700K无频闪调光光源。',
          timestamp: '官方认证',
        },
      ],
    };
  }

  static saveQnaHistory(history: Record<string, QnaMessage[]>): void {
    try {
      localStorage.setItem(STORAGE_KEYS.QNA, JSON.stringify(history));
    } catch {
      // ignore
    }
  }

  static getAiChatHistory(): AiChatMessage[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AI_CHAT);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [
      {
        id: 'msg_welcome',
        text: '在下方发送消息或上传照片，我将自动推理画面中的空间或穿搭风格，并为您一次性精准匹配全套真实同款商品。',
        isUser: false,
        styleTag: '智能美学识别',
        matchedProducts: [lampProduct, cratesProduct, keyboardProduct],
        timestamp: '刚刚',
      },
    ];
  }

  static saveAiChatHistory(messages: AiChatMessage[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.AI_CHAT, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }

  // AI Conversational Image & Intent Reasoning Engine
  static analyzeImageAndIntent(userImage?: string, userText?: string, availableProducts: ProductItem[] = productsList): {
    styleTag: string;
    analysisText: string;
    matchedProducts: ProductItem[];
  } {
    const text = (userText || '').toLowerCase();
    const img = (userImage || '').toLowerCase();

    if (availableProducts !== productsList) {
      const terms = text.split(/\s+/).filter((term) => term.length > 1);
      const relevant = availableProducts.filter((product) =>
        [product.name, product.category, product.shortDescription, ...Object.keys(product.specs)]
          .some((value) => terms.some((term) => value.toLowerCase().includes(term)))
      );
      const matchedProducts = (relevant.length ? relevant : availableProducts).slice(0, 4);
      return {
        styleTag: text.trim() ? '按当前店铺商品匹配' : '当前店铺商品推荐',
        analysisText: matchedProducts.length
          ? '根据你的描述，从已发布的店铺商品中整理了这些候选。'
          : '当前没有可用于推荐的已发布商品。',
        matchedProducts,
      };
    }

    // 1. Wabi-Sabi tea / reading corner
    if (
      text.includes('侘寂') ||
      text.includes('陶艺') ||
      text.includes('wabi') ||
      text.includes('阅读角') ||
      img.includes('wabisabi')
    ) {
      return {
        styleTag: '侘寂静谧陶艺阅读角',
        analysisText: '已识别到自然肌理白墙、低矮亚麻家具与粗陶器物。为您匹配手作粗陶花器、低姿态亚麻躺椅与极简实木挂架：',
        matchedProducts: [vesselProduct, chairProduct, shelfProduct, lampProduct],
      };
    }

    // 2. Botanical living room / studio
    if (
      text.includes('绿植') ||
      text.includes('雨林') ||
      text.includes('客厅') ||
      text.includes('jungle') ||
      text.includes('plant') ||
      img.includes('living') ||
      img.includes('jungle')
    ) {
      return {
        styleTag: '日光绿植有机客厅空间',
        analysisText: '已识别到漫射晨光、天然阔叶绿植与流动家具。为您匹配移动红面推车边几、中世纪亚麻躺椅与空间监听耳机：',
        matchedProducts: [mobileTableProduct, chairProduct, headphonesProduct, lampProduct],
      };
    }

    // 3. Outfit: Linen Chore Coat & Minimalist Lookbook
    if (
      text.includes('亚麻') ||
      text.includes('工装') ||
      text.includes('画廊') ||
      img.includes('outfit') ||
      img.includes('styled_1')
    ) {
      return {
        styleTag: '画廊极简亚麻工装穿搭',
        analysisText: '已识别到中性比利时亚麻质感与建筑感廓形。为您匹配重磅亚麻工装夹克、鼠尾草绿监听耳机与极简时钟：',
        matchedProducts: [linenCoatProduct, headphonesProduct, clockProduct],
      };
    }

    // 4. Outfit: Chunky Knit & Creator
    if (
      text.includes('针织') ||
      text.includes('毛衣') ||
      text.includes('开衫') ||
      text.includes('knit') ||
      img.includes('styled_2')
    ) {
      return {
        styleTag: '复古创作者粗针针织穿搭',
        analysisText: '已识别到美利奴羊毛粗针纹理与数码创作美学。为您匹配粗针羊毛开衫、8Bit 双旋钮机械键盘与方壳监听耳机：',
        matchedProducts: [knitSweaterProduct, keyboardProduct, headphonesProduct],
      };
    }

    // 5. Bauhaus Workspace & Light
    if (
      text.includes('包豪斯') ||
      text.includes('光影') ||
      text.includes('书房') ||
      text.includes('desk') ||
      img.includes('bauhaus') ||
      img.includes('collector')
    ) {
      return {
        styleTag: '包豪斯日光极简工作室',
        analysisText: '已识别到几何建筑光影、原木桌面与黄铜点缀。为您匹配包豪斯弧形台灯、复古机械键盘与铝型材收纳箱：',
        matchedProducts: [lampProduct, keyboardProduct, cratesProduct, shelfProduct],
      };
    }

    // Default
    return {
      styleTag: '复古工业桌面藏家空间',
      analysisText: '已完成视觉风格推理。为您检索出以下真实实物同款组合：',
      matchedProducts: [cratesProduct, keyboardProduct, lampProduct, mobileTableProduct],
    };
  }

  static getReplacementOptions(currentProductId: string): ProductItem[] {
    return productsList.filter((p) => p.id !== currentProductId);
  }

  static generateQnaAnswer(question: string, product: ProductItem): { answer: string; evidence: string } {
    const q = question.toLowerCase();
    if (!productsList.some((sample) => sample.id === product.id)) {
      const matchingSpec = Object.entries(product.specs).find(([key]) =>
        q.includes(key.toLowerCase()) ||
        (/(尺寸|size|dimension)/i.test(q) && /(尺寸|长|宽|高|size|dimension)/i.test(key)) ||
        (/(材质|材料|material)/i.test(q) && /(材质|材料|material)/i.test(key)) ||
        (/(颜色|color)/i.test(q) && /(颜色|color)/i.test(key))
      );
      if (matchingSpec) {
        return {
          answer: `商品资料中，${matchingSpec[0]}为：${matchingSpec[1]}。`,
          evidence: `${matchingSpec[0]}：${matchingSpec[1]}`,
        };
      }
      if (product.shortDescription.trim()) {
        return {
          answer: `目前商家提供的商品说明是：${product.shortDescription}`,
          evidence: product.shortDescription,
        };
      }
      return {
        answer: '当前商品资料没有包含这个问题的答案，建议在询价时请商家确认。',
        evidence: '商品详情尚未提供相关字段。',
      };
    }
    if (q.includes('desk') || q.includes('小') || q.includes('尺寸') || q.includes('size')) {
      const dims = product.specs['Dimensions'] || product.specs['尺寸'] || '紧凑占地';
      return {
        answer: `该单品适合紧凑空间布置。具体尺寸：${dims}。底部配有防刮保护缓冲垫。`,
        evidence: `实测尺寸：${dims}。`,
      };
    }
    if (q.includes('光') || q.includes('灯') || q.includes('色温') || q.includes('led')) {
      return {
        answer: '配备 2700K 暖光集成 LED，支持顺滑无级调光，营造安静舒适的空间氛围。',
        evidence: '经过工作室光学校准认证。',
      };
    }
    return {
      answer: '以建筑级精工标准打磨，现货支持安全配送与 14 天退换保障。',
      evidence: '工作室现货质检保障。',
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
