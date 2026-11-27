import type { ProductItem, Exhibition, Creator, Story, ScenePost, FeedItem } from '../types';
import { readConsumerCatalog } from '@/lib/products/consumer-catalog';

export const fiveStoreDemoProducts: ProductItem[] = readConsumerCatalog();
export const productsList = fiveStoreDemoProducts;
export const exhibitionsList: Exhibition[] = [];

// 主题文章样品：新中式——繁复的中华美学 × 利落的剪裁
const neoChineseThemeProducts = readConsumerCatalog([
  'neop-nc-shanghai-tang-1',
  'neop-nc-shanghai-tang-2',
  'neop-nc-shanghai-tang-4',
  'neop-nc-shanghai-tang-5',
  'neop-nc-mukzin-1',
  'neop-nc-mukzin-2',
  'neop-nc-mukzin-3',
  'neop-nc-mukzin-5',
]);

export const legacyNeoChineseThemeArticle: ScenePost = {
  id: 'legacy-neo-chinese-01',
  kind: 'collection',
  title: '繁在纹样，简在轮廓：新中式的优雅繁荣',
  editorName: 'Omnilink 策展',
  editorAvatar: '/omnilink-logo.png',
  coverImage: '/consumer-market/theme-neo-chinese-01-cover.jpg',
  isVideo: false,
  mediaList: [],
  linkedProducts: neoChineseThemeProducts,
  aspectRatio: 0.78,
  description: '繁复的中华美学，遇上利落的剪裁。纹样可以汹涌，轮廓必须克制——热闹都留在衣身上，人自有一种从容。',
  blocks: [
    { id: 'nc-01-t1', type: 'text', text: '第一眼看见的，是花。\n再细看，花被收进了一条干净的肩线里。\n东方的繁，从来不是把元素堆满——它知道在哪里停手。' },
    { id: 'nc-01-t2', type: 'text', text: '我们太习惯把「新中式」当成复古的同义词：盘扣、立领、刺绣，缺一不可。\n可真正好看的当代东方衣着，恰恰相反——纹样可以汹涌，轮廓必须利落。繁与简的对峙，才是最耐看的地方。' },
    { id: 'nc-01-img1', type: 'image', url: 'https://media.shanghaitang.com/media/catalog/product/cache/2122e730c664159f00004bed994f0d36/b/2/b2wrd358an-look-plp.webp' },
    { id: 'nc-01-t3', type: 'text', text: '提花不是印上去的花，是织进去的光。走一步，暗纹才醒一次。珠绣落在米色天鹅绒上，靠近了才看得见手艺的重量。\n东方的繁复讲究一个「藏」字：把整座花园织进一块布，再让剪裁替它守住分寸。' },
    { id: 'nc-01-g1', type: 'group', productIds: ['neop-nc-shanghai-tang-1', 'neop-nc-shanghai-tang-2', 'neop-nc-shanghai-tang-4', 'neop-nc-shanghai-tang-5'] },
    { id: 'nc-01-t4', type: 'text', text: '这份繁简的分寸，不只属于高定。密扇把它带进了日常衣橱：M 形绗棉外套用结构代替堆砌，提花阔腿裤让纹样在走动时自己开口。\n不必把繁华写在胸口，藏在转身的一瞬，更耐看。' },
    { id: 'nc-01-g2', type: 'group', productIds: ['neop-nc-mukzin-1', 'neop-nc-mukzin-2', 'neop-nc-mukzin-3', 'neop-nc-mukzin-5'] },
    { id: 'nc-01-t5', type: 'text', text: '所谓优雅繁荣，不是把旧时代原封不动地穿回来，而是让那些花、那些纹、那些手艺，在今天的线条里重新活一次。\n繁华穿在身上，从容留给自己。' },
  ],
};

export const scenePostsList: ScenePost[] = [];
export const sampleCreator: Creator | null = null;
export const sampleStory: Story | null = null;
export const feedItemsList: FeedItem[] = [
  ...productsList.map((product) => ({ type: 'product' as const, product })),
];
