import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  ProductItem,
  CartItem,
  Exhibition,
  ScenePost,
  Story,
  Creator,
  FeedItem,
  QnaMessage,
  AiChatMessage,
  ConsumerAiModel,
} from '../types';
import { DataService } from '../services/dataService';
import { feedItemsList } from '../data/mockData';
import { readPreviewAiAssistantProfile as readStoredPreviewAiAssistantProfile, savePreviewAiAssistantProfile } from '@/lib/consumer-advisor/ai-assistant-preview-storage';

const persistedIntentByStyleTag = {
  '穿搭建议': 'outfit-styling',
  '商品检索': 'product-search',
  '商品问答': 'product-question',
  '商品对比': 'comparison',
  '个性化推荐': 'personalized-recommendation',
  '购物请求': 'cart-request',
} as const satisfies Record<string, NonNullable<AiChatMessage['intent']>>

interface OmnilinkContextType {
  homeChatOpen: boolean;
  setHomeChatOpen: (open: boolean) => void;

  // Repositories
  products: ProductItem[];
  feedItems: FeedItem[];
  scenePosts: ScenePost[];
  exhibitions: Exhibition[];
  creator: Creator;
  story: Story;

  // Active Overlays
  selectedFloatingProduct: ProductItem | null;
  openFloatingProduct: (product: ProductItem) => void;
  closeFloatingProduct: () => void;

  currentProductDetail: ProductItem | null;
  openProductDetail: (product: ProductItem) => void;
  closeProductDetail: () => void;

  currentScenePost: ScenePost | null;
  currentSceneIndex: number;
  openScenePost: (scenePost: ScenePost) => void;
  closeScenePost: () => void;
  nextScenePost: () => void;
  prevScenePost: () => void;

  currentExhibition: Exhibition | null;
  openExhibition: (exhibition: Exhibition) => void;
  closeExhibition: () => void;

  openStore: (product: ProductItem) => void;

  currentStory: Story | null;
  openStory: (story: Story) => void;
  closeStory: () => void;

  currentCreator: Creator | null;
  openCreator: (creator: Creator) => void;
  closeCreator: () => void;

  // Reviews
  isReviewsOpen: boolean;
  openReviews: () => void;
  closeReviews: () => void;

  // Cart & Comparison
  cartItems: CartItem[];
  cartCount: number;
  addToCart: (product: ProductItem, variant?: string, selectedOptions?: Record<string, string>) => void;
  addMultipleToCart: (products: ProductItem[]) => void;
  updateCartQuantity: (productId: string, delta: number, variantId?: string | null) => void;
  removeFromCart: (productId: string, variantId?: string | null) => void;
  clearCart: () => void;
  cartComparisonPair: [ProductItem, ProductItem] | null;
  startCartComparison: (p1: ProductItem, p2: ProductItem) => void;
  closeCartComparison: () => void;

  // AI Conversational Image & Intent Reasoning
  aiMessages: AiChatMessage[];
  activeAiConversationId: string;
  archivedAiConversationIds: string[];
  selectAiConversation: (id: string) => void;
  startAiConversation: () => void;
  archiveAiConversation: (id: string) => void;
  deleteAiConversation: (id: string) => void;
  isAiThinking: boolean;
  aiModel: ConsumerAiModel;
  setAiModel: (model: ConsumerAiModel) => void;
  sendAiMessage: (prompt: string, selectedProductIds?: string[], hasActiveSkill?: boolean) => void;
  sendAiImageMessage: (imageSrc: string, promptText?: string, selectedProductIds?: string[], hasActiveSkill?: boolean) => void;
  sendAiFileMessage: (fileName: string, fileData: string, promptText?: string, selectedProductIds?: string[], hasActiveSkill?: boolean) => void;
  deleteMatchedItem: (messageId: string, productId: string) => void;
  replaceMatchedItem: (messageId: string, oldProductId: string, newProduct: ProductItem) => void;
  openAiPage: (initialPrompt?: string, initialImage?: string) => void;

  // Q&A
  qnaHistory: Record<string, QnaMessage[]>;
  askProductQna: (productId: string, question: string) => void;

  // Toast & Notifications
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // Saved / Liked items
  savedProductIds: string[];
  toggleSaveProduct: (productId: string) => void;
  rejectedProductIds: string[];
  toggleRejectProduct: (productId: string) => void;
}

const OmnilinkContext = createContext<OmnilinkContextType | undefined>(undefined);
const INITIAL_CONVERSATION_ID = '00000000-0000-4000-8000-000000000000';

function readPreviewAiAssistantProfile() {
  return readStoredPreviewAiAssistantProfile();
}

type PreviewMemoryUpdate = {
  memory: { id: string; domain: 'clothing' | 'skin' | 'hair' | 'space' | 'other'; text: string; origin: 'user' | 'inferred'; status: 'active'; evidence: string | null; sourceMessageId: string | null; supportIds: string[] };
  supersedeIds: string[];
};

function persistPreviewMemory(update: PreviewMemoryUpdate) {
  const profile = readPreviewAiAssistantProfile();
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false;
  try {
    const existing = Array.isArray(profile.memories)
      ? profile.memories.filter((item: unknown) => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown>[]
      : [];
    if (existing.length >= 50 || existing.some((memory) => memory.id === update.memory.id)) return false;
    const supersededIds = new Set(update.supersedeIds);
    const memories = existing.map((memory) => {
      const dependsOnSuperseded = memory.origin === 'inferred' && Array.isArray(memory.supportIds)
        && memory.supportIds.some((id) => typeof id === 'string' && supersededIds.has(id));
      return supersededIds.has(String(memory.id)) || dependsOnSuperseded ? { ...memory, status: 'rejected' } : memory;
    });
    memories.push(update.memory);
    savePreviewAiAssistantProfile({ ...profile, memories });
    return true;
  } catch {
    return false;
  }
}

function createConversationId() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const OmnilinkProvider: React.FC<{ children: React.ReactNode; initialProducts?: ProductItem[]; initialPosts?: ScenePost[]; hasLiveProducts?: boolean; initialWelcome?: boolean; initialAiMessages?: AiChatMessage[]; authenticated?: boolean }> = ({
  children,
  initialProducts = [],
  initialPosts = [],
  hasLiveProducts = false,
  initialWelcome = false,
  initialAiMessages,
  authenticated = false,
}) => {
  const router = useRouter();
  const [homeChatOpen, setHomeChatOpen] = useState(false);

  // Repositories
  const [products] = useState<ProductItem[]>(() => hasLiveProducts ? initialProducts : (initialProducts.length ? initialProducts : DataService.getProducts()));
  const [feedItems] = useState<FeedItem[]>(() => {
    if (hasLiveProducts) {
      const mixed: FeedItem[] = initialProducts.map((product) => ({ type: 'product', product }));
      initialPosts.forEach((scenePost, index) => mixed.splice(Math.min(index * 3, mixed.length), 0, { type: 'scene', scenePost }));
      return mixed;
    }
    if (!initialProducts.length) return feedItemsList;
    const curatedScenes = feedItemsList.filter((item) => item.type === 'scene');
    return initialProducts.flatMap((product, index) => [
      { type: 'product' as const, product },
      ...(index % 4 === 2 && curatedScenes.length ? [curatedScenes[Math.floor(index / 4) % curatedScenes.length]] : []),
    ]);
  });
  const [scenePosts] = useState<ScenePost[]>(() => {
    if (hasLiveProducts) return initialPosts;
    const posts = DataService.getScenePosts();
    return hasLiveProducts ? posts.map((post) => ({ ...post, linkedProducts: [] })) : posts;
  });
  const [exhibitions] = useState<Exhibition[]>(() => {
    if (hasLiveProducts) return [];
    const items = DataService.getExhibitions();
    return hasLiveProducts
      ? items.map((exhibition) => ({
          ...exhibition,
          chapters: exhibition.chapters.map((chapter) => ({ ...chapter, taggedProducts: [] })),
        }))
      : items;
  });
  const [creator] = useState<Creator>(() => DataService.getCreator());
  const [story] = useState<Story>(() => DataService.getStory());

  // Overlays
  const [selectedFloatingProduct, setSelectedFloatingProduct] = useState<ProductItem | null>(null);
  const [currentProductDetail, setCurrentProductDetail] = useState<ProductItem | null>(null);
  const [currentScenePost, setCurrentScenePost] = useState<ScenePost | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);
  const [currentExhibition, setCurrentExhibition] = useState<Exhibition | null>(null);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [currentCreator, setCurrentCreator] = useState<Creator | null>(null);

  // Reviews
  const [isReviewsOpen, setIsReviewsOpen] = useState(false);

  // Cart
  const [localStateLoaded, setLocalStateLoaded] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartComparisonPair, setCartComparisonPair] = useState<[ProductItem, ProductItem] | null>(null);

  // Saved Products
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [rejectedProductIds, setRejectedProductIds] = useState<string[]>([]);

  // Q&A & AI Chat
  const [qnaHistory, setQnaHistory] = useState<Record<string, QnaMessage[]>>({});
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>(initialAiMessages ?? []);
  const [activeAiConversationId, setActiveAiConversationId] = useState(() => initialAiMessages?.at(-1)?.conversationId || INITIAL_CONVERSATION_ID);
  const [initialConversationId] = useState(activeAiConversationId);
  const [archivedAiConversationIds, setArchivedAiConversationIds] = useState<string[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiModel, setAiModel] = useState<ConsumerAiModel>(authenticated ? 'deepseek-v4-pro' : 'qwen-plus');

  useEffect(() => {
    setCartItems(DataService.getCart(products, initialProducts.length > 0));
    setSavedProductIds(DataService.getSavedProductIds());
    setRejectedProductIds(DataService.getRejectedProductIds());
    setQnaHistory(DataService.getQnaHistory());
    setArchivedAiConversationIds(DataService.getArchivedConversationIds());

    if (!authenticated && !initialAiMessages && !initialWelcome) {
      const messages = DataService.getAiChatHistory();
      setAiMessages(messages);
      const conversationId = messages.at(-1)?.conversationId;
      setActiveAiConversationId(conversationId || createConversationId());
    } else if (!authenticated && !initialAiMessages) {
      setActiveAiConversationId(createConversationId());
    } else if (!authenticated && !initialAiMessages?.at(-1)?.conversationId) {
      setActiveAiConversationId(createConversationId());
    }

    setLocalStateLoaded(true);
  }, [authenticated, initialAiMessages, initialProducts.length, initialWelcome, products]);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    void fetch('/api/consumer/ai-assistant-history').then(async (response) => {
      if (!response.ok) throw new Error('对话历史暂时无法读取');
      return response.json() as Promise<{ messages: { id: string; conversation_id: string; role: string; content: string; style_tag: string | null; matched_product_ids: string[]; model: string | null }[] }>;
    }).then(({ messages }) => {
      if (cancelled) return;
      const storedMessages = messages.map((message) => ({
        id: message.id, conversationId: message.conversation_id, isUser: message.role === 'user',
        text: message.content, styleTag: message.style_tag ?? undefined,
        intent: message.style_tag ? persistedIntentByStyleTag[message.style_tag as keyof typeof persistedIntentByStyleTag] : undefined,
        matchedProducts: products.filter((product) => message.matched_product_ids?.includes(product.id)),
        model: message.model as ConsumerAiModel | undefined,
        timestamp: message.role === 'user' ? '你' : message.style_tag && message.style_tag in persistedIntentByStyleTag ? message.style_tag : message.style_tag === '成分资料检索' ? '资料检索' : 'AI assistant',
      }));
      setAiMessages((current) => {
        const storedIds = new Set(storedMessages.map((message) => message.id));
        return [...storedMessages, ...current.filter((message) => !storedIds.has(message.id))];
      });
      setActiveAiConversationId((current) => current === initialConversationId
        ? messages.at(-1)?.conversation_id || createConversationId()
        : current);
    }).catch(() => {
      if (!cancelled) setActiveAiConversationId((current) => current === initialConversationId ? createConversationId() : current);
    });
    return () => { cancelled = true; };
  }, [authenticated, products, initialConversationId]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real-time synchronization across browser tabs
  useEffect(() => {
    const unsubscribe = DataService.subscribeToSync((event) => {
      if (event.type === 'CART_UPDATED') {
        setCartItems(event.payload as CartItem[]);
      } else if (event.type === 'SAVED_UPDATED') {
        setSavedProductIds(event.payload as string[]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!localStateLoaded) return;
    DataService.saveCart(cartItems);
  }, [cartItems, localStateLoaded]);

  useEffect(() => {
    if (!localStateLoaded) return;
    DataService.saveProductIds(savedProductIds);
  }, [localStateLoaded, savedProductIds]);

  useEffect(() => {
    if (!localStateLoaded) return;
    DataService.saveRejectedProductIds(rejectedProductIds);
  }, [localStateLoaded, rejectedProductIds]);

  useEffect(() => {
    if (!localStateLoaded) return;
    DataService.saveQnaHistory(qnaHistory);
  }, [localStateLoaded, qnaHistory]);

  useEffect(() => {
    if (localStateLoaded && !authenticated && !initialAiMessages && !initialWelcome) DataService.saveAiChatHistory(aiMessages);
  }, [aiMessages, authenticated, initialAiMessages, initialWelcome, localStateLoaded]);

  useEffect(() => {
    if (!localStateLoaded) return;
    DataService.saveArchivedConversationIds(archivedAiConversationIds);
  }, [archivedAiConversationIds, localStateLoaded]);

  const startAiConversation = useCallback(() => setActiveAiConversationId(createConversationId()), []);
  const selectAiConversation = useCallback((id: string) => {
    setArchivedAiConversationIds((current) => current.filter((item) => item !== id));
    setActiveAiConversationId(id);
  }, []);
  const archiveAiConversation = useCallback((id: string) => {
    setArchivedAiConversationIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setActiveAiConversationId((current) => current === id ? createConversationId() : current);
  }, []);
  const deleteAiConversation = useCallback((id: string) => {
    setAiMessages((current) => current.filter((message) => message.conversationId !== id));
    setArchivedAiConversationIds((current) => current.filter((item) => item !== id));
    setActiveAiConversationId((current) => current === id ? createConversationId() : current);
    if (authenticated) void fetch('/api/consumer/ai-assistant-history', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: id }) });
  }, [authenticated]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    const timer = setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  // Cart Actions
  const addToCart = useCallback(
    (product: ProductItem, variant: string = '标准', selectedOptions?: Record<string, string>) => {
      setCartItems((prev) => {
        const variantId = product.defaultVariantId ?? null;
        const existingIdx = prev.findIndex((i) => i.product.id === product.id && (i.variantId ?? i.product.defaultVariantId ?? null) === variantId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: updated[existingIdx].quantity + 1,
          };
          return updated;
        }
        return [...prev, { product, quantity: 1, variant, variantId, selectedOptions }];
      });
      showToast(`已将 ${product.name} 加入购物车`);
    },
    [showToast]
  );

  const addMultipleToCart = useCallback(
    (productsToAdd: ProductItem[]) => {
      if (productsToAdd.length === 0) return;
      setCartItems((prev) => {
        const updated = [...prev];
        productsToAdd.forEach((product) => {
          const idx = updated.findIndex((i) => i.product.id === product.id && (i.variantId ?? i.product.defaultVariantId ?? null) === (product.defaultVariantId ?? null));
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              quantity: updated[idx].quantity + 1,
            };
          } else {
            updated.push({ product, quantity: 1, variant: '标准', variantId: product.defaultVariantId ?? null });
          }
        });
        return updated;
      });
      showToast(`已批量添加 ${productsToAdd.length} 件商品至购物车`);
    },
    [showToast]
  );

  const updateCartQuantity = useCallback(
    (productId: string, delta: number, variantId?: string | null) => {
      setCartItems((prev) =>
        prev
          .map((item) => {
            if (item.product.id === productId && (variantId === undefined || (item.variantId ?? item.product.defaultVariantId ?? null) === variantId)) {
              const newQty = item.quantity + delta;
              return newQty <= 0 ? null : { ...item, quantity: newQty };
            }
            return item;
          })
          .filter(Boolean) as CartItem[]
      );
    },
    []
  );

  const removeFromCart = useCallback((productId: string, variantId?: string | null) => {
    setCartItems((prev) => prev.filter((i) => i.product.id !== productId || (variantId !== undefined && (i.variantId ?? i.product.defaultVariantId ?? null) !== variantId)));
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const cartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  // Overlays
  const openFloatingProduct = useCallback((product: ProductItem) => {
    setSelectedFloatingProduct(product);
  }, []);

  const closeFloatingProduct = useCallback(() => {
    setSelectedFloatingProduct(null);
  }, []);

  const openProductDetail = useCallback((product: ProductItem) => {
    setSelectedFloatingProduct(null);
    setCurrentProductDetail(product);
  }, []);

  const closeProductDetail = useCallback(() => {
    setCurrentProductDetail(null);
  }, []);

  const openScenePost = useCallback(
    (scenePost: ScenePost) => {
      const idx = scenePosts.findIndex((s) => s.id === scenePost.id);
      setCurrentSceneIndex(Math.max(0, idx));
      setCurrentScenePost(scenePost);
    },
    [scenePosts]
  );

  const closeScenePost = useCallback(() => {
    setCurrentScenePost(null);
  }, []);

  const nextScenePost = useCallback(() => {
    const nextIdx = (currentSceneIndex + 1) % scenePosts.length;
    setCurrentSceneIndex(nextIdx);
    setCurrentScenePost(scenePosts[nextIdx]);
  }, [currentSceneIndex, scenePosts]);

  const prevScenePost = useCallback(() => {
    const prevIdx =
      (currentSceneIndex - 1 + scenePosts.length) % scenePosts.length;
    setCurrentSceneIndex(prevIdx);
    setCurrentScenePost(scenePosts[prevIdx]);
  }, [currentSceneIndex, scenePosts]);

  const openExhibition = useCallback((exhibition: Exhibition) => {
    setCurrentExhibition(exhibition);
  }, []);

  const closeExhibition = useCallback(() => {
    setCurrentExhibition(null);
  }, []);

  const openStore = useCallback((product: ProductItem) => {
    if (!product.storeSlug) {
      showToast('这家店铺暂时没有公开网页');
      return;
    }
    router.push(`/store/${encodeURIComponent(product.storeSlug)}`);
  }, [router, showToast]);

  const openStory = useCallback((s: Story) => {
    setCurrentStory(s);
  }, []);

  const closeStory = useCallback(() => {
    setCurrentStory(null);
  }, []);

  const openCreator = useCallback((c: Creator) => {
    setCurrentCreator(c);
  }, []);

  const closeCreator = useCallback(() => {
    setCurrentCreator(null);
  }, []);

  // Reviews
  const openReviews = useCallback(() => {
    setIsReviewsOpen(true);
  }, []);

  const closeReviews = useCallback(() => {
    setIsReviewsOpen(false);
  }, []);

  // Cart Comparison
  const startCartComparison = useCallback(
    (p1: ProductItem, p2: ProductItem) => {
      setCartComparisonPair([p1, p2]);
    },
    []
  );

  const closeCartComparison = useCallback(() => {
    setCartComparisonPair(null);
  }, []);

  // Bookmarks
  const toggleSaveProduct = useCallback(
    (productId: string) => {
      setSavedProductIds((prev) => {
        const exists = prev.includes(productId);
        const updated = exists
          ? prev.filter((id) => id !== productId)
          : [...prev, productId];
        showToast(exists ? '已取消收藏' : '已加入我的收藏');
        return updated;
      });
    },
    [showToast]
  );

  const toggleRejectProduct = useCallback((productId: string) => {
    setRejectedProductIds((current) => current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId].slice(-100));
  }, []);

  // Q&A
  const askProductQna = useCallback(
    (productId: string, questionText: string) => {
      if (!questionText.trim()) return;
      const userMsg: QnaMessage = {
        id: `q_${Date.now()}`,
        text: questionText.trim(),
        isUser: true,
        timestamp: '刚刚',
      };

      setQnaHistory((prev) => ({
        ...prev,
        [productId]: [...(prev[productId] || []), userMsg],
      }));

      setTimeout(() => {
        const targetProd =
          products.find((p) => p.id === productId) || products[0];
        const { answer, evidence } = DataService.generateQnaAnswer(
          questionText,
          targetProd
        );
        const aiMsg: QnaMessage = {
          id: `a_${Date.now()}`,
          text: answer,
          isUser: false,
          evidenceText: evidence,
          timestamp: '商品资料',
        };
        setQnaHistory((prev) => ({
          ...prev,
          [productId]: [...(prev[productId] || []), aiMsg],
        }));
      }, 400);
    },
    [products]
  );

  const requestAiResponse = useCallback(async (promptText: string, image?: string, selectedProductIds: string[] = [], messageId?: string, document?: { name: string; data: string }, hasActiveSkill = false) => {
    setIsAiThinking(true);
    try {
      const previousAssistant = [...aiMessages].reverse().find((message) => message.conversationId === activeAiConversationId && !message.isUser && message.timestamp !== '连接失败');
      const previousIntent = previousAssistant?.intent ?? (previousAssistant?.styleTag
        ? persistedIntentByStyleTag[previousAssistant.styleTag as keyof typeof persistedIntentByStyleTag]
        : undefined);
      const response = await fetch('/api/consumer/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          image,
          document,
          model: aiModel,
          conversationId: activeAiConversationId,
          messageId,
          selectedProductIds,
          previousProductIds: previousAssistant?.matchedProducts?.map((product) => product.id) ?? [],
          hasActiveSkill,
          previousIntent,
          savedProductIds,
          rejectedProductIds,
          history: aiMessages.filter((message) => message.conversationId === activeAiConversationId && message.timestamp !== '连接失败')
            .slice(-6).map((message) => ({ role: message.isUser ? 'user' : 'assistant', content: message.text })),
          profile: authenticated ? undefined : readPreviewAiAssistantProfile(),
        }),
      });
      const result = await response.json() as { text?: string; styleTag?: string; intent?: AiChatMessage['intent']; matchedProductIds?: string[]; matchReasons?: Record<string, string>; usedPreferences?: string[]; memorySaved?: boolean; memoryOrigin?: 'user' | 'inferred' | null; demoMemoryUpdate?: PreviewMemoryUpdate; model?: ConsumerAiModel | null; source?: string; error?: string };
      if (!response.ok || !result.text) throw new Error(result.error || '模型没有返回可用内容。');
      if (!authenticated && result.demoMemoryUpdate && persistPreviewMemory(result.demoMemoryUpdate)) {
        showToast(result.demoMemoryUpdate.memory.origin === 'user' ? '已记住这项偏好' : '已记录一条待确认偏好');
      } else if (authenticated && result.memorySaved) {
        showToast(result.memoryOrigin === 'inferred' ? '已记录一条待确认偏好' : '已记住这项偏好');
      }
      const matchedIds = new Set(result.matchedProductIds || []);
      const finalMessage: AiChatMessage = {
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        text: result.text!,
        isUser: false,
        conversationId: activeAiConversationId,
        styleTag: result.styleTag,
        intent: result.intent,
        matchedProducts: products.filter((product) => matchedIds.has(product.id)).slice(0, 3),
        matchReasons: result.matchReasons,
        usedPreferences: result.usedPreferences,
        timestamp: result.intent === 'outfit-styling' ? '穿搭建议' : result.source === 'ingredient-index' ? '资料检索' : result.source === 'catalog-index' ? '商品检索' : 'AI 助手',
        model: result.model === null ? undefined : result.model ?? aiModel,
      };
      setAiMessages((prev) => [...prev, finalMessage]);
    } catch (error) {
      const failedMessage: AiChatMessage = {
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        text: error instanceof Error ? `模型暂时无法回答：${error.message}` : '模型暂时无法回答，请稍后重试。',
        isUser: false,
        conversationId: activeAiConversationId,
        timestamp: '连接失败',
        model: aiModel,
      };
      setAiMessages((prev) => [...prev, failedMessage]);
    } finally {
      setIsAiThinking(false);
    }
  }, [activeAiConversationId, aiMessages, aiModel, authenticated, products, savedProductIds, rejectedProductIds, showToast]);

  const sendAiMessage = useCallback((promptText: string, selectedProductIds: string[] = [], hasActiveSkill = false) => {
    if (!promptText.trim() || isAiThinking) return;
    const userMsg: AiChatMessage = {
      id: `m_${Date.now()}`,
      text: promptText.trim(),
      isUser: true,
      conversationId: activeAiConversationId,
      timestamp: '刚刚',
    };

    setAiMessages((prev) => [...prev, userMsg]);
    void requestAiResponse(promptText.trim(), undefined, selectedProductIds, userMsg.id, undefined, hasActiveSkill);
  }, [activeAiConversationId, isAiThinking, requestAiResponse]);

  // AI Conversational Image Upload & Reasoning
  const sendAiImageMessage = useCallback(
    (imageSrc: string, promptText?: string, selectedProductIds: string[] = [], hasActiveSkill = false) => {
      if (isAiThinking) return;
      const userMsg: AiChatMessage = {
        id: `m_${Date.now()}`,
        text: promptText?.trim() || '看看这张图',
        isUser: true,
        conversationId: activeAiConversationId,
        image: imageSrc,
        timestamp: '刚刚',
      };

      setAiMessages((prev) => [...prev, userMsg]);
      void requestAiResponse(promptText?.trim() || '', imageSrc, selectedProductIds, userMsg.id, undefined, hasActiveSkill);
    },
    [activeAiConversationId, isAiThinking, requestAiResponse]
  );

  const sendAiFileMessage = useCallback((fileName: string, fileData: string, promptText = '', selectedProductIds: string[] = [], hasActiveSkill = false) => {
    if (isAiThinking) return;
    const userMsg: AiChatMessage = {
      id: `m_${Date.now()}`,
      text: promptText.trim(),
      fileName,
      isUser: true,
      conversationId: activeAiConversationId,
      timestamp: '刚刚',
    };
    setAiMessages((prev) => [...prev, userMsg]);
    void requestAiResponse(promptText.trim(), undefined, selectedProductIds, userMsg.id, { name: fileName, data: fileData }, hasActiveSkill);
  }, [activeAiConversationId, isAiThinking, requestAiResponse]);

  // Delete Matched Item from AI Result List
  const deleteMatchedItem = useCallback((messageId: string, productId: string) => {
    setAiMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId && msg.matchedProducts) {
          return {
            ...msg,
            matchedProducts: msg.matchedProducts.filter((p) => p.id !== productId),
          };
        }
        return msg;
      })
    );
    showToast('已从搭配清单中移除该单品');
  }, [showToast]);

  // Replace Matched Item with New Product
  const replaceMatchedItem = useCallback(
    (messageId: string, oldProductId: string, newProduct: ProductItem) => {
      setAiMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId && msg.matchedProducts) {
            const updated = msg.matchedProducts.map((p) =>
              p.id === oldProductId ? newProduct : p
            );
            return {
              ...msg,
              matchedProducts: updated,
            };
          }
          return msg;
        })
      );
      showToast(`已替换为 ${newProduct.name}`);
    },
    [showToast]
  );

  const openAiPage = useCallback(
    (initialPrompt?: string, initialImage?: string) => {
      setHomeChatOpen(true);
      if (initialImage) {
        sendAiImageMessage(initialImage, initialPrompt);
      } else if (initialPrompt) {
        sendAiMessage(initialPrompt);
      }
    },
    [sendAiImageMessage, sendAiMessage]
  );

  return (
    <OmnilinkContext.Provider
      value={{
        homeChatOpen,
        setHomeChatOpen,
        products,
        feedItems,
        scenePosts,
        exhibitions,
        creator,
        story,
        selectedFloatingProduct,
        openFloatingProduct,
        closeFloatingProduct,
        currentProductDetail,
        openProductDetail,
        closeProductDetail,
        currentScenePost,
        currentSceneIndex,
        openScenePost,
        closeScenePost,
        nextScenePost,
        prevScenePost,
        currentExhibition,
        openExhibition,
        closeExhibition,
        openStore,
        currentStory,
        openStory,
        closeStory,
        currentCreator,
        openCreator,
        closeCreator,
        isReviewsOpen,
        openReviews,
        closeReviews,
        cartItems,
        cartCount,
        addToCart,
        addMultipleToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartComparisonPair,
        startCartComparison,
        closeCartComparison,
        aiMessages,
        activeAiConversationId,
        archivedAiConversationIds,
        selectAiConversation,
        startAiConversation,
        archiveAiConversation,
        deleteAiConversation,
        isAiThinking,
        aiModel,
        setAiModel,
        sendAiMessage,
        sendAiImageMessage,
        sendAiFileMessage,
        deleteMatchedItem,
        replaceMatchedItem,
        openAiPage,
        qnaHistory,
        askProductQna,
        toastMessage,
        showToast,
        savedProductIds,
        toggleSaveProduct,
        rejectedProductIds,
        toggleRejectProduct,
      }}
    >
      {children}
    </OmnilinkContext.Provider>
  );
};

export const useOmnilink = (): OmnilinkContextType => {
  const context = useContext(OmnilinkContext);
  if (!context) {
    throw new Error('useOmnilink must be used within an OmnilinkProvider');
  }
  return context;
};
