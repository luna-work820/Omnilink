import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataService } from '@/components/consumer-market/services/dataService'
import { productsList, feedItemsList, exhibitionsList, scenePostsList, sampleCreator, sampleStory } from '@/components/consumer-market/data/mockData'
import { DEMO_PRODUCTS, getDemoProductById } from './demo-data'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DisplayPrice } from '@/components/consumer-market/components/DisplayPrice'

const officialHosts: Record<string, string> = {
  CLED: 'www.thecled.com',
  'LEAP STUDIO': 'leapstudio.shop',
  Berhel: 'berhel.com',
  'Hooks and Luxe': 'www.hooksandluxe.com',
  'Amano Studio': 'amanostudio.com',
}

function storage(values: Record<string, unknown>) {
  const entries = new Map(Object.entries(values).map(([key, value]) => [key, JSON.stringify(value)]))
  vi.stubGlobal('window', { localStorage: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
  } })
}

afterEach(() => vi.unstubAllGlobals())

describe('five-store source catalog', () => {
  it('expands the catalog using only products from the five official stores', () => {
    expect(productsList.length).toBeGreaterThan(25)
    expect(new Set(productsList.map((product) => product.id)).size).toBe(productsList.length)
    expect([...new Set(productsList.map((product) => product.storeName))].sort()).toEqual(Object.keys(officialHosts).sort())
    for (const product of productsList) {
      expect(new URL(product.sourceUrl!).hostname).toBe(officialHosts[product.storeName])
      expect(new URL(product.sourceUrl!).pathname).toMatch(/^\/products\//)
      expect([officialHosts[product.storeName], 'cdn.shopify.com']).toContain(new URL(product.mainImage).hostname)
      expect(product.sourceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Object.values(product.specs).every((value) => typeof value === 'string' && value.length > 0)).toBe(true)
      expect(product.reviews).toEqual([])
      expect(product.catalogEvidence?.checkoutVerified).toBe(false)
      expect(product.catalogEvidence?.deliveryToChina).toBe('unverified')
      if (product.catalogEvidence?.priceStatus === 'unconfirmed') {
        expect(product.priceMode).toBe('unknown')
        expect(product.formattedPrice).toBe('待核价')
      }
    }
  })

  it('leaves fictional scenes, exhibitions, merchants and default selections inactive', () => {
    expect(feedItemsList.every((item) => item.type === 'product' && productsList.includes(item.product))).toBe(true)
    expect([exhibitionsList, scenePostsList, DEMO_PRODUCTS]).toEqual([[], [], []])
    expect([sampleCreator, sampleStory]).toEqual([null, null])
    expect(getDemoProductById('prod-101')).toBeUndefined()
    expect(DataService.getCart()).toEqual([])
    expect(DataService.getSavedProductIds()).toEqual([])
    expect(DataService.getQnaHistory()).toEqual({})
  })

  it('removes retired cart records and reloads retained products from the current source data', () => {
    const product = productsList[0]
    storage({ omnilink_cart_items_v1: [
      { product: { id: 'p_lamp_01' }, quantity: 1, variant: 'Brushed Brass' },
      { product: { ...product, price: 1, specs: { 材质: 'invented' } }, quantity: 2, variant: 'invented' },
      { product, quantity: -1, variant: '' },
    ] })
    const cart = DataService.getCart()
    expect(cart).toHaveLength(1)
    expect(cart[0].product).toBe(product)
    expect(cart[0].quantity).toBe(2)
    expect(cart[0].variant).toBe('')
  })

  it('preserves the user conversation while removing retired product attachments', () => {
    const product = productsList[0]
    storage({
      omnilink_saved_items_v1: ['p_lamp_01', product.id],
      omnilink_qna_history_v1: { p_lamp_01: [{ text: '2700K' }] },
      omnilink_ai_chat_v4: [{ id: 'user-message', isUser: true, text: '我的偏好', matchedProducts: [
        { id: 'p_lamp_01' }, { ...product, price: 1 },
      ] }],
    })
    expect(DataService.getSavedProductIds()).toEqual([product.id])
    expect(DataService.getQnaHistory()).toEqual({})
    const messages = DataService.getAiChatHistory()
    expect(messages[0].text).toBe('我的偏好')
    expect(messages[0].matchedProducts).toEqual([product])
  })

  it('migrates old conversation identifiers while keeping each conversation together', () => {
    storage({ omnilink_ai_chat_v4: [
      { id: 'u1', conversationId: 'old-chat', isUser: true, text: '第一条' },
      { id: 'a1', conversationId: 'old-chat', isUser: false, text: '回复' },
      { id: 'u2', conversationId: 'another-chat', isUser: true, text: '另一条' },
    ] })
    const messages = DataService.getAiChatHistory()
    expect(messages[0].conversationId).toMatch(/^[0-9a-f-]{36}$/)
    expect(messages[1].conversationId).toBe(messages[0].conversationId)
    expect(messages[2].conversationId).not.toBe(messages[0].conversationId)
    DataService.saveAiChatHistory(messages)
    expect(DataService.getAiChatHistory().map((message) => message.conversationId)).toEqual(messages.map((message) => message.conversationId))
  })

  it('answers from actual specifications and declines unsupported product claims', () => {
    const product = productsList.find((item) => item.id === 'external-berhel-blue-sapphire-earrings')!
    expect(DataService.generateQnaAnswer('材质是什么？', product).answer).toContain('实验室培育蓝宝石')
    expect(DataService.generateQnaAnswer('有没有 14 天退换保障？', product).answer).toContain('没有提供')
    expect(DataService.generateQnaAnswer('有 2700K LED 吗？', product).answer).toContain('没有提供')
  })

  it('hides unconfirmed amounts even when a detail view supplies an explicit amount', () => {
    const product = productsList.find((item) => item.priceMode === 'unknown')!
    expect(renderToStaticMarkup(createElement(DisplayPrice, { product, amount: product.price, currency: product.currency }))).toBe('<span>待核价</span>')
  })
})
