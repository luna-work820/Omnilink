import type { ArticleDraft } from '@/lib/creator-article-draft'
import type { ArticleBlockData } from '@/lib/creator-article-editor'

// 初次创建本机预览作品时使用；之后以作品记录为准。
export const GILDED_EAST_POST_ID = 'theme-neo-chinese-01'
export const LEGACY_GILDED_EAST_POST_ID = 'demo-gilded-east-01'
const SHOP_URL = 'https://shop383283250.taobao.com/'
const coverUrl = '/consumer-market/theme-neo-chinese-01-cover.jpg'

const paragraph = (id: string, text: string): ArticleBlockData => ({ id, type: 'paragraph', content: [{ type: 'text', text, styles: {} }] })

const blocks: ArticleBlockData[] = [
  paragraph('ge-p1', '当极致的东方绮丽遇上高级时装的戏剧性，一场关于繁复、欲望与浪漫的盛宴由此展开。'),
  paragraph('ge-p2', '我们迷恋那些过分华丽的事物：层叠的锦缎、细密的金线、摇曳的珠玉、柔软的皮草，以及在光影下流转的刺绣。它们带着旧时代的贵气、精心雕琢的矜持，也带着某种近乎放纵的奢靡。'),
  paragraph('ge-p3', '从古典衣冠的繁缛礼制，到巴黎高级定制秀场的夸张装饰，东方美学在这里挣脱了素雅与含蓄的单一想象。浓艳的色彩、丰盈的材质与大胆的轮廓彼此碰撞，构成一种华丽到近乎颓靡的视觉语言。'),
  paragraph('ge-p4', '本期精选以繁复主义为线索，寻找那些拥有精湛工艺、强烈装饰性与鲜明个人表达的新中式服装。让传统纹样重新鲜活，让旧日繁华融入当代衣橱。'),
  {
    id: 'ge-shop-1',
    type: 'productLink',
    props: {
      kind: 'shop',
      name: '无艳一禾',
      subtitle: '',
      url: SHOP_URL,
      image: '/consumer-market/theme-wuyanyihe-logo.png',
      gallery: [
        { url: '/consumer-market/theme-wuyanyihe-mingzhu.jpg', name: '明珠夫人', price: '188-1598 元', link: 'https://item.taobao.com/item.htm?id=987784779050' },
        { url: '/consumer-market/theme-wuyanyihe-dongfangci.jpg', name: '东方瓷', price: '218-1168 元', link: 'https://item.taobao.com/item.htm?id=989844810065' },
        { url: '/consumer-market/theme-wuyanyihe-moyu.jpg', name: '墨羽金枝', price: '658-1528 元', link: 'https://item.taobao.com/item.htm?id=991339788142' },
        { url: '/consumer-market/theme-wuyanyihe-lihua.jpg', name: '鲤花疏影', price: '1548 元', link: 'https://item.taobao.com/item.htm?id=994301133587' },
        { url: '/consumer-market/theme-wuyanyihe-p5.jpg', name: '东方既白', price: '457-768 元', link: 'https://item.taobao.com/item.htm?id=1084481841677' },
      ],
    },
  },
  {
    id: 'ge-shop-2',
    type: 'productLink',
    props: {
      kind: 'shop',
      name: '羽鸢',
      subtitle: '',
      url: 'https://shop486354897.taobao.com/?spm=a21xtw.29978516.0.0',
      image: '/consumer-market/theme-yuyuan-logo.png',
      gallery: [
        { url: '/consumer-market/theme-yuyuan-hudie.jpg', name: '蝴蝶夫人', price: '397-1298 元', link: 'https://item.taobao.com/item.htm?id=1072293602480' },
        { url: '/consumer-market/theme-yuyuan-meihuo.jpg', name: '魅惑塞王', price: '898-958 元', link: 'https://item.taobao.com/item.htm?id=1080106497167' },
        { url: '/consumer-market/theme-yuyuan-mingshu.jpg', name: '名姝舞会', price: '698 元', link: 'https://item.taobao.com/item.htm?id=1073988801524' },
      ],
    },
  },
  {
    id: 'ge-shop-3',
    type: 'productLink',
    props: {
      kind: 'shop',
      name: 'Walk in Dark',
      subtitle: '',
      url: 'https://shop116856428.taobao.com/?spm=a21xtw.29978516.0.0',
      image: '/consumer-market/theme-walkindark-logo.png',
      gallery: [
        { url: '/consumer-market/theme-walkindark-yanyusi.jpg', name: '烟雨司藤', price: '169-339 元', link: 'https://item.taobao.com/item.htm?id=832031610506' },
        { url: '/consumer-market/theme-walkindark-lvhe.jpg', name: '绿荷', price: '160-373 元', link: 'https://item.taobao.com/item.htm?id=923830130868' },
        { url: '/consumer-market/theme-walkindark-zhipu.jpg', name: '紫蒲', price: '585 元', link: 'https://item.taobao.com/item.htm?id=1005055795230' },
        { url: '/consumer-market/theme-walkindark-kongshanxue.jpg', name: '空山雪', price: '764 元', link: 'https://item.taobao.com/item.htm?id=1097432416445' },
        { url: '/consumer-market/theme-walkindark-jinsiyudie.jpg', name: '金丝羽蝶', price: '407 元', link: 'https://item.taobao.com/item.htm?id=1071087533943' },
      ],
    },
  },
  {
    id: 'ge-shop-4',
    type: 'productLink',
    props: {
      kind: 'shop',
      name: 'MOSS STUDIO',
      subtitle: '',
      url: 'https://shop63258052.taobao.com/?spm=a21xtw.29978516.0.0',
      image: '/consumer-market/theme-moss-logo.png',
      gallery: [
        { url: '/consumer-market/theme-moss-manzifanhua.jpg', name: '漫紫繁花', price: '289 元', link: 'https://item.taobao.com/item.htm?id=1095718340839' },
        { url: '/consumer-market/theme-moss-bifengguanhe.jpg', name: '碧凤观荷', price: '387-693 元', link: 'https://item.taobao.com/item.htm?id=1096490018779' },
        { url: '/consumer-market/theme-moss-jintang.jpg', name: '锦棠', price: '377-725 元', link: 'https://item.taobao.com/item.htm?id=1098663944556' },
      ],
    },
  },
]

export const gildedEastArticle: ArticleDraft = {
  version: 2,
  title: '绮靡东方',
  background: 'white',
  cover: { url: coverUrl, position: 50, ratio: '1000 / 1534' },
  updatedAt: 1764000000000,
  blocks,
}
