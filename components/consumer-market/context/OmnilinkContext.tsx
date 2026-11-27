import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import type { AiAssistantSkillId } from '../components/CapabilityLibrary';
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
import { useDiscoveryWorkspace,type PersonalView,type DiscoveryFailure } from '../hooks/useDiscoveryWorkspace';
import type { SearchScope } from '@/lib/consumer-advisor/search-continuation';
import { readDiscoveryReference,type DiscoveryPage,type DiscoverySpec } from '@/lib/consumer-advisor/discovery-contract';
import { fetchConsumerReply } from '@/lib/consumer-advisor/client-response';
import { ruleConsumerExecution } from '@/lib/consumer-advisor/execution-policy';
import { selectedAppearanceAction } from '@/lib/consumer-advisor/appearance-actions';
import { readExecutionBlocks,readSourceIds,type ExecutionTask,type ResponseBlock } from '@/lib/consumer-advisor/response-contract';
import { DEFAULT_EMBEDDING_PROFILE,type RetrievalOptions } from '@/lib/consumer-advisor/embedding-profile';

const persistedIntentByStyleTag = {
  '穿搭建议': 'outfit-styling',
  '商品检索': 'product-search',
  '商品问答': 'product-question',
  '商品对比': 'comparison',
  '个性化推荐': 'personalized-recommendation',
  '购物请求': 'cart-request',
} as const satisfies Record<string, NonNullable<AiChatMessage['intent']>>

interface OmnilinkContextType {
  discovery:DiscoveryPage|null;
  discoveryBusy:boolean;
  discoveryError:DiscoveryFailure|null;
  loadMoreDiscovery:()=>void;
  refreshDiscovery:(spec?:DiscoverySpec)=>void;
  retryDiscovery:()=>void;
  clearDiscovery:()=>void;
  refineDiscovery:(answer:string)=>void;
  skipDiscoveryQuestion:()=>void;
  resumeDiscovery:(runId:string,version:number,spec?:DiscoverySpec)=>void;
  personalView:PersonalView;
  openPersonalView:(view:PersonalView)=>void;
  contextVersion:number;
  updateContextVersion:(version:number)=>void;
  homeChatOpen: boolean;
  setHomeChatOpen: (open: boolean) => void;

  // Repositories
  products: ProductItem[];
  feedItems: FeedItem[];
  scenePosts: ScenePost[];
  exhibitions: Exhibition[];
  creator: Creator | null;
  story: Story | null;

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
  startAiConversation: (skillId?: AiAssistantSkillId) => void;
  activeAssistantSkillId: AiAssistantSkillId | null;
  setActiveAssistantSkillId: (skillId: AiAssistantSkillId | null) => void;
  archiveAiConversation: (id: string) => void;
  deleteAiConversation: (id: string) => void;
  isAiThinking: boolean;
  aiModel: ConsumerAiModel;
  setAiModel: (model: ConsumerAiModel) => void;
  retrievalOptions: RetrievalOptions;
  setRetrievalOptions: (options: RetrievalOptions) => void;
  sendAiMessage: (prompt: string, selectedProductIds?: string[], hasActiveSkill?: boolean, searchScope?:SearchScope, skillId?: AiAssistantSkillId) => void;
  sendAiImageMessage: (imageSrc: string, promptText?: string, selectedProductIds?: string[], hasActiveSkill?: boolean, searchScope?:SearchScope, skillId?: AiAssistantSkillId) => void;
  sendAiFileMessage: (fileName: string, fileData: string, promptText?: string, selectedProductIds?: string[], hasActiveSkill?: boolean, searchScope?:SearchScope, skillId?: AiAssistantSkillId) => void;
  sendAiUrlMessage:(url:string,promptText?:string,selectedProductIds?:string[])=>void;
  stopAiResponse:()=>void;
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
  memory: { id: string; domain: 'clothing' | 'skin' | 'hair' | 'space' | 'other'; text: string; origin: 'user' | 'inferred'; status: 'proposed'; evidence: string | null; sourceMessageId: string | null; supportIds: string[]; supersedeIds: string[]; confirmedAt: null; revision: number };
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
    const memories = [...existing];
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

export const OmnilinkProvider: React.FC<{ children: React.ReactNode; initialProducts?: ProductItem[]; initialPosts?: ScenePost[]; hasLiveProducts?: boolean; initialWelcome?: boolean; initialAiMessages?: AiChatMessage[]; authenticated?: boolean; initialAiModel?: ConsumerAiModel }> = ({
  children,
  initialProducts = [],
  initialPosts = [],
  hasLiveProducts = false,
  initialWelcome = false,
  initialAiMessages,
  authenticated = false,
  initialAiModel,
}) => {
  const router = useRouter();
  const [homeChatOpen, setHomeChatOpen] = useState(false);

  // Repositories
  const [products,setProducts] = useState<ProductItem[]>(() => hasLiveProducts ? initialProducts : (initialProducts.length ? initialProducts : DataService.getProducts()));
  const initialProductCatalog=useRef(products);
  const registerProducts=useCallback((incoming:ProductItem[]) => setProducts((current) => [...new Map([...current,...incoming].map((p) => [p.id,p])).values()]),[]);
  useEffect(() => {
    if (!hasLiveProducts) return;
    initialProductCatalog.current = initialProducts;
    setProducts(initialProducts);
  }, [hasLiveProducts, initialProducts]);
  const feedItems = useMemo<FeedItem[]>(() => {
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
  }, [hasLiveProducts, initialProducts, initialPosts]);
  const scenePosts = useMemo<ScenePost[]>(() => {
    if (hasLiveProducts) return initialPosts;
    const posts = DataService.getScenePosts();
    return hasLiveProducts ? posts.map((post) => ({ ...post, linkedProducts: [] })) : posts;
  }, [hasLiveProducts, initialPosts]);
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
  const [creator] = useState<Creator | null>(() => DataService.getCreator());
  const [story] = useState<Story | null>(() => DataService.getStory());

  // Overlays
  const [selectedFloatingProduct, setSelectedFloatingProduct] = useState<ProductItem | null>(null);
  const [currentProductDetail, setCurrentProductDetail] = useState<ProductItem | null>(null);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const currentScenePost = scenePosts.find((post) => post.id === currentSceneId) ?? null;
  const currentSceneIndex = Math.max(0, scenePosts.findIndex((post) => post.id === currentSceneId));
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
  const [conversationSkills, setConversationSkills] = useState<Record<string, AiAssistantSkillId | null>>({});
  const activeAssistantSkillId = conversationSkills[activeAiConversationId] ?? null;
  const setActiveAssistantSkillId = useCallback((skillId: AiAssistantSkillId | null) => {
    setConversationSkills((current) => ({ ...current, [activeAiConversationId]: skillId }));
  }, [activeAiConversationId]);
  const [aiModel, setAiModel] = useState<ConsumerAiModel>(initialAiModel ?? (authenticated ? 'deepseek-v4-pro' : 'qwen-plus'));
  const [retrievalOptions, updateRetrievalOptions] = useState<RetrievalOptions>({mode:'auto',profile:DEFAULT_EMBEDDING_PROFILE});
  const responseEpoch=useRef(0);
  const responseAbort=useRef<AbortController|null>(null);
  const cancelAssistantRequest=useCallback(()=>{
    responseEpoch.current++;responseAbort.current?.abort();setIsAiThinking(false);
  },[]);
  const discoveryWorkspace=useDiscoveryWorkspace(activeAiConversationId,registerProducts,cancelAssistantRequest);
  const {acceptDiscovery,resumeDiscovery,cancelPendingDiscovery,clearDiscovery}=discoveryWorkspace;
  const {discovery:currentDiscovery,refreshDiscovery}=discoveryWorkspace;
  const setRetrievalOptions=useCallback((options:RetrievalOptions)=>{
    if(options.mode===retrievalOptions.mode&&options.profile===retrievalOptions.profile)return;
    updateRetrievalOptions(options);
    if(currentDiscovery)refreshDiscovery({...currentDiscovery.spec,retrieval:options});
  },[retrievalOptions,currentDiscovery,refreshDiscovery]);
  const previousSearchQuery=discoveryWorkspace.discovery?.query;
  const previousSearchRunId=discoveryWorkspace.discovery?.searchRunId;
  const previousContextVersion=discoveryWorkspace.discovery?.contextVersion;
  const restoredSearchRef=useRef<string|null>(null);
  const activeConversationRef=useRef(activeAiConversationId);
  const localHistoryLoadedRef=useRef(false);
  useLayoutEffect(()=>{activeConversationRef.current=activeAiConversationId},[activeAiConversationId]);
  useEffect(() => {responseEpoch.current++;responseAbort.current?.abort();setIsAiThinking(false)},[activeAiConversationId]);
  useEffect(()=>()=>responseAbort.current?.abort(),[]);

  useEffect(() => {
    setCartItems(DataService.getCart(initialProductCatalog.current));
    setSavedProductIds(DataService.getSavedProductIds(initialProductCatalog.current));
    setRejectedProductIds(DataService.getRejectedProductIds());
    setQnaHistory(DataService.getQnaHistory());
    setArchivedAiConversationIds(DataService.getArchivedConversationIds());

    if (!authenticated && !initialAiMessages && !initialWelcome && !localHistoryLoadedRef.current) {
      localHistoryLoadedRef.current = true;
      const messages = DataService.getAiChatHistory(initialProductCatalog.current);
      setAiMessages(messages);
      const conversationId = messages.at(-1)?.conversationId;
      setActiveAiConversationId(conversationId || createConversationId());
    } else if (!authenticated && !initialAiMessages && initialWelcome && !localHistoryLoadedRef.current) {
      localHistoryLoadedRef.current = true;
      setActiveAiConversationId(createConversationId());
    } else if (!authenticated && initialAiMessages && !initialAiMessages.at(-1)?.conversationId && !localHistoryLoadedRef.current) {
      localHistoryLoadedRef.current = true;
      setActiveAiConversationId(createConversationId());
    }

    setLocalStateLoaded(true);
  }, [authenticated, initialAiMessages, initialProducts.length, initialWelcome]);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    void fetch('/api/consumer/ai-assistant-history').then(async (response) => {
      if (!response.ok) throw new Error('对话历史暂时无法读取');
      return response.json() as Promise<{ messages: { id: string; conversation_id: string; role: string; content: string; style_tag: string | null; matched_product_ids: string[]; model: string | null;response_blocks?:unknown }[] }>;
    }).then(({ messages }) => {
      if (cancelled) return;
      const storedMessages = messages.map((message) => ({
        id: message.id, conversationId: message.conversation_id, isUser: message.role === 'user',
        text: message.content, styleTag: message.style_tag ?? undefined,
        analysisMessageId: message.role === 'assistant' && message.style_tag === '形象分析' ? message.id : undefined,
        intent: message.style_tag ? persistedIntentByStyleTag[message.style_tag as keyof typeof persistedIntentByStyleTag] : undefined,
        matchedProducts: readDiscoveryReference(message.response_blocks)?undefined:initialProductCatalog.current.filter((product) => message.matched_product_ids?.includes(product.id)),
        searchRef:readDiscoveryReference(message.response_blocks),
        blocks:readExecutionBlocks(message.response_blocks),
        matchedSourceIds:readSourceIds(message.response_blocks),
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
  }, [authenticated, initialConversationId]);

  useEffect(()=>{
    const latest=[...aiMessages].reverse().find((message)=>message.conversationId===activeAiConversationId&&message.searchRef)?.searchRef;
    if(!latest)return;
    const key=`${activeAiConversationId}:${latest.searchRunId}`;
    if(discoveryWorkspace.discovery){restoredSearchRef.current=key;return;}
    if(discoveryWorkspace.discoveryBusy||restoredSearchRef.current===key)return;
    restoredSearchRef.current=key;
    resumeDiscovery(latest.searchRunId,latest.contextVersion,latest.spec);
  },[activeAiConversationId,aiMessages,discoveryWorkspace.discovery,discoveryWorkspace.discoveryBusy,resumeDiscovery]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real-time synchronization across browser tabs
  useEffect(() => {
    const unsubscribe = DataService.subscribeToSync((event) => {
      if (event.type === 'CART_UPDATED') {
        setCartItems((current) => {
          const items=DataService.getCart(initialProductCatalog.current);
          return JSON.stringify(current)===JSON.stringify(items)?current:items;
        });
      } else if (event.type === 'SAVED_UPDATED') {
        setSavedProductIds((current) => {
          const ids=DataService.getSavedProductIds(initialProductCatalog.current);
          return JSON.stringify(current)===JSON.stringify(ids)?current:ids;
        });
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

  const startAiConversation = useCallback((skillId?: AiAssistantSkillId) => {
    const id = createConversationId();
    if (skillId) setConversationSkills((current) => ({ ...current, [id]: skillId }));
    setActiveAiConversationId(id);
  }, []);
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
      setCurrentSceneId(scenePost.id);
    },
    []
  );

  const closeScenePost = useCallback(() => {
    setCurrentSceneId(null);
  }, []);

  const nextScenePost = useCallback(() => {
    if (!scenePosts.length) return;
    const nextIdx = (currentSceneIndex + 1) % scenePosts.length;
    setCurrentSceneId(scenePosts[nextIdx].id);
  }, [currentSceneIndex, scenePosts]);

  const prevScenePost = useCallback(() => {
    if (!scenePosts.length) return;
    const prevIdx =
      (currentSceneIndex - 1 + scenePosts.length) % scenePosts.length;
    setCurrentSceneId(scenePosts[prevIdx].id);
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

  const requestAiResponse = useCallback(async (promptText: string, image?: string, selectedProductIds: string[] = [], messageId?: string, document?: { name: string; data: string }, hasActiveSkill = false, searchScope?:SearchScope, skillId?: AiAssistantSkillId) => {
    cancelPendingDiscovery();
    responseAbort.current?.abort();
    const abort=new AbortController();responseAbort.current=abort;
    const turn=++responseEpoch.current;
    const sessionId=activeAiConversationId;
    const requestId=messageId??`m_${crypto.randomUUID()}`,replyId=`reply_${requestId}`;
    let retrySpec:DiscoverySpec|undefined;
    setIsAiThinking(true);
    try {
      const previousAssistant = [...aiMessages].reverse().find((message) => message.conversationId === activeAiConversationId && !message.isUser && message.timestamp !== '连接失败');
      const previousIntent = previousAssistant?.intent ?? (previousAssistant?.styleTag
        ? persistedIntentByStyleTag[previousAssistant.styleTag as keyof typeof persistedIntentByStyleTag]
        : undefined);
      const response = await fetchConsumerReply(JSON.stringify({
          prompt: promptText,
          image,
          document,
          model: aiModel,
          retrieval: retrievalOptions,
          searchScope,
          previousSearchRunId,
          previousContextVersion,
          conversationId: activeAiConversationId,
          messageId:requestId,
          selectedProductIds,
          previousProductIds: previousAssistant?.matchedProducts?.map((product) => product.id) ?? [],
          hasActiveSkill,
          skillId: skillId ?? activeAssistantSkillId ?? undefined,
          appearanceSelection: [...aiMessages].reverse().find((message) => message.conversationId === activeAiConversationId && message.isUser && selectedAppearanceAction(message.text))?.text,
          previousIntent,
          previousSearch:previousSearchQuery,
          previousTaskId:previousAssistant?.blocks?.find((block)=>block.type==='task_progress')?.id,
          previousSourceIds:[...(previousAssistant?.matchedSourceIds??[]),...(previousAssistant?.blocks?.flatMap((block)=>block.type==='information_feed'?block.data.items.filter((item)=>item.entityType==='source').map((item)=>item.id):[])??[])].slice(0,6),
          savedProductIds,
          rejectedProductIds,
          history: aiMessages.filter((message) => message.conversationId === activeAiConversationId && message.timestamp !== '连接失败' && (message.isUser || message.text.trim()))
            .slice(-6).map((message) => ({ role: message.isUser ? 'user' : 'assistant', content: message.text })),
          profile: authenticated ? undefined : readPreviewAiAssistantProfile(),
        }),abort.signal,(delta)=>{
          if(turn!==responseEpoch.current||activeConversationRef.current!==sessionId)return;
          setAiMessages((current)=>{
            const existing=current.find((message)=>message.id===replyId);
            return existing?current.map((message)=>message.id===replyId?{...message,text:message.text+delta}:message):[...current,
              {id:replyId,conversationId:sessionId,text:delta,isUser:false,timestamp:'AI 助手',model:aiModel,state:'streaming'}];
          });
        });
      const result = response.body as { text?: string; styleTag?: string; intent?: AiChatMessage['intent']; matchedProductIds?: string[]; matchReasons?: Record<string, string>; usedPreferences?: string[]; memorySaved?: boolean; memoryProposed?:boolean; memoryWarning?:string; analysisMessageId?:string; memoryOrigin?: 'user' | 'inferred' | null; demoMemoryUpdate?: PreviewMemoryUpdate; model?: ConsumerAiModel | null; source?: string; error?: string; discovery?:DiscoveryPage; retrySpec?:DiscoverySpec; sessionId?:string;blocks?:ResponseBlock[];task?:ExecutionTask;matchedSourceIds?:string[] };
      if(turn!==responseEpoch.current || activeConversationRef.current!==sessionId) return;
      retrySpec=result.retrySpec;
      if (!response.ok || (!result.text && !result.discovery)) throw new Error(result.error || '模型没有返回可用内容。');
      if(result.discovery) {
        if(!acceptDiscovery(result.discovery)) throw new Error('搜索结果已过期，请刷新重试。');
        setHomeChatOpen(false);
      }
      const availableIds=new Set([...products,...(result.discovery?.products??[])].map((product)=>product.id));
      if(result.matchedProductIds?.some((id) => !availableIds.has(id))) {
        throw new Error('商品目录已更新，请刷新重试。');
      }
      if(result.blocks?.some((block)=>block.type==='information_feed')) {
        clearDiscovery();
        setHomeChatOpen(true);
      } else if(result.task) setHomeChatOpen(true);
      if (!authenticated && result.demoMemoryUpdate && persistPreviewMemory(result.demoMemoryUpdate)) {
        showToast('已生成一条待确认偏好');
      } else if (authenticated && result.memoryProposed) {
        showToast('已生成一条待确认偏好');
      }
      if (result.memoryWarning) showToast(result.memoryWarning);
      const matchedIds = new Set(result.matchedProductIds || []);
      const finalMessage: AiChatMessage = {
        id: replyId,
        text: result.text ?? '',
        isUser: false,
        conversationId: activeAiConversationId,
        styleTag: result.styleTag,
        intent: result.intent,
        matchedProducts: result.discovery?undefined:products.filter((product) => matchedIds.has(product.id)).slice(0, 3),
        searchRef:result.discovery?{searchRunId:result.discovery.searchRunId,contextVersion:result.discovery.contextVersion,spec:result.discovery.spec}:undefined,
        matchReasons: result.matchReasons,
        usedPreferences: result.usedPreferences,
        memoryProposed: result.memoryProposed,
        analysisMessageId: result.analysisMessageId,
        timestamp: result.intent === 'outfit-styling' ? '穿搭建议' : result.source === 'ingredient-index' ? '资料检索' : result.source === 'catalog-index' ? '商品检索' : 'AI 助手',
        model: result.model === null ? undefined : result.model ?? aiModel,
        blocks:result.discovery?undefined:readExecutionBlocks(result.blocks),
        state:'completed',
        matchedSourceIds:result.matchedSourceIds,
      };
      setAiMessages((prev) => [...prev.filter((message)=>message.id!==replyId), finalMessage]);
    } catch (error) {
      if(abort.signal.aborted || turn!==responseEpoch.current || activeConversationRef.current!==sessionId) return;
      setAiMessages((current)=>current.map((message)=>message.id===replyId?{...message,state:'failed'}:message));
      const failedMessage: AiChatMessage = {
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        text: error instanceof Error ? `${retrySpec?'商品搜索':'回答'}未完成：${error.message}` : '请求未完成，请稍后重试。',
        isUser: false,
        conversationId: activeAiConversationId,
        timestamp: '连接失败',
        retrySpec,
        model: aiModel,
      };
      setAiMessages((prev) => [...prev, failedMessage]);
    } finally {
      if(turn===responseEpoch.current)setIsAiThinking(false);
    }
  }, [activeAssistantSkillId, activeAiConversationId, aiMessages, aiModel, retrievalOptions, authenticated, products, savedProductIds, rejectedProductIds, showToast,acceptDiscovery,clearDiscovery,previousSearchQuery,previousSearchRunId,previousContextVersion,cancelPendingDiscovery]);

  const stopAiResponse=useCallback(()=>{
    responseEpoch.current++;responseAbort.current?.abort();setIsAiThinking(false);
    setAiMessages((current)=>current.map((message)=>message.state==='streaming'?{...message,state:'cancelled'}:message));
  },[]);
  const sendAiUrlMessage=useCallback((url:string,promptText='',selectedProductIds:string[]=[])=>{
    const sessionId=activeAiConversationId,requestId=`url_${crypto.randomUUID()}`;
    setAiMessages((current)=>[...current,{id:requestId,conversationId:sessionId,isUser:true,text:[promptText||`阅读 ${new URL(url).hostname} 的资料`,url].join('\n'),timestamp:'你'}]);
    setHomeChatOpen(true);
    void fetch('/api/consumer/tasks',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'create',sessionId,requestId,input:{urls:[url],productIds:selectedProductIds,goal:promptText.trim().slice(0,1000)}})})
      .then(async(response)=>{const result=await response.json();if(!response.ok||!result.task)throw new Error(result.error??'任务暂时无法创建。');return result.task as ExecutionTask})
      .then((task)=>{if(activeConversationRef.current!==sessionId)return;setAiMessages((current)=>[...current,
        {id:`reply_${requestId}`,conversationId:sessionId,isUser:false,text:'已创建资料任务。',timestamp:'AI 助手',blocks:[{type:'task_progress',id:task.id,version:1,data:task}]}])})
      .catch((cause)=>{if(activeConversationRef.current===sessionId)showToast(cause instanceof Error?cause.message:'任务暂时无法创建。')});
  },[activeAiConversationId,showToast]);

  const sendAiMessage = useCallback((promptText: string, selectedProductIds: string[] = [], hasActiveSkill = false, searchScope?:SearchScope, skillId?: AiAssistantSkillId) => {
    const prompt=promptText.trim();
    if (!prompt || isAiThinking) return;
    const userMsg: AiChatMessage = {
      id: `m_${crypto.randomUUID()}`,
      text: prompt,
      isUser: true,
      conversationId: activeAiConversationId,
      timestamp: '刚刚',
    };

    const directSearch=hasActiveSkill||skillId||activeAssistantSkillId||selectedProductIds.length?null:ruleConsumerExecution({
      prompt,hasImage:false,hasDocument:false,hasSelectedProducts:false,hasSources:false,scope:searchScope,catalogProducts:products,
      productSearchContext:Boolean(discoveryWorkspace.discovery),
    });
    if(directSearch?.intent==='product-search'&&directSearch.search) {
      // A direct keyword search stays keyword by default, but an explicit
      // semantic/hybrid choice from the user is never overwritten.
      const spec=retrievalOptions.mode==='auto'?directSearch.search:{...directSearch.search,retrieval:retrievalOptions};
      setAiMessages((prev)=>[...prev,userMsg]);
      setHomeChatOpen(false);
      refreshDiscovery(spec,{requestId:userMsg.id,prompt});
      return;
    }

    setAiMessages((prev) => [...prev, userMsg]);
    void requestAiResponse(prompt, undefined, selectedProductIds, userMsg.id, undefined, hasActiveSkill,searchScope,skillId);
  }, [activeAiConversationId, activeAssistantSkillId, discoveryWorkspace.discovery, isAiThinking, products, refreshDiscovery, requestAiResponse, retrievalOptions, setHomeChatOpen]);

  // AI Conversational Image Upload & Reasoning
  const sendAiImageMessage = useCallback(
    (imageSrc: string, promptText?: string, selectedProductIds: string[] = [], hasActiveSkill = false, searchScope?:SearchScope, skillId?: AiAssistantSkillId) => {
      if (isAiThinking) return;
      const userMsg: AiChatMessage = {
        id: `m_${crypto.randomUUID()}`,
        text: promptText?.trim() || '看看这张图',
        isUser: true,
        conversationId: activeAiConversationId,
        image: imageSrc,
        timestamp: '刚刚',
      };

      setAiMessages((prev) => [...prev, userMsg]);
      void requestAiResponse(promptText?.trim() || '', imageSrc, selectedProductIds, userMsg.id, undefined, hasActiveSkill,searchScope,skillId);
    },
    [activeAiConversationId, isAiThinking, requestAiResponse]
  );

  const sendAiFileMessage = useCallback((fileName: string, fileData: string, promptText = '', selectedProductIds: string[] = [], hasActiveSkill = false, searchScope?:SearchScope, skillId?: AiAssistantSkillId) => {
    if (isAiThinking) return;
    const userMsg: AiChatMessage = {
      id: `m_${crypto.randomUUID()}`,
      text: promptText.trim(),
      fileName,
      isUser: true,
      conversationId: activeAiConversationId,
      timestamp: '刚刚',
    };
    setAiMessages((prev) => [...prev, userMsg]);
    void requestAiResponse(promptText.trim(), undefined, selectedProductIds, userMsg.id, { name: fileName, data: fileData }, hasActiveSkill,searchScope,skillId);
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
        ...discoveryWorkspace,
        sendAiUrlMessage,stopAiResponse,
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
        activeAssistantSkillId,
        setActiveAssistantSkillId,
        archiveAiConversation,
        deleteAiConversation,
        isAiThinking,
        aiModel,
        setAiModel,
        retrievalOptions,
        setRetrievalOptions,
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
