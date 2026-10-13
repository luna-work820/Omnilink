'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { KnowledgeEntryRecord } from '@/lib/knowledge/model'

export type SelectedProduct = {
  id: string
  name: string
  sku?: string | null
}

export type WorkspaceArtifact = {
  id: string
  title: string
  content: string
  productId?: string
  productName?: string
  createdAt: string
  archived: boolean
}

export type WorkspaceSource = {
  id: string
  title: string
  sourceType: 'website' | 'document' | 'certificate' | 'merchant_record'
  uri: string
  owner: string
  store: string
  capturedAt: string
  contentHash: string
  anchorStatus: 'anchored' | 'pending' | 'not_requested'
  verification: 'verified' | 'pending' | 'attention'
  txHash?: string
  network?: string
  blockNumber?: number
  linkedProductIds: string[]
  excerpt: string
}

const DEMO_SOURCES: WorkspaceSource[] = [
  {
    id: 'source-spec-s1',
    title: 'OmniFlow S1 产品规格书',
    sourceType: 'document',
    uri: '本地资料 / product-specs-v3.pdf',
    owner: '演示商家',
    store: '主店铺',
    capturedAt: '2026-02-10 14:30',
    contentHash: '待生成：保存后计算 SHA-256',
    anchorStatus: 'not_requested',
    verification: 'pending',
    linkedProductIds: ['prod-101'],
    excerpt: '包含降噪、续航、材质与版本信息，可作为商品详情的证据来源。',
  },
  {
    id: 'source-cert-s1',
    title: '声学实验室检测报告',
    sourceType: 'certificate',
    uri: '本地资料 / CNAS-2026-018.pdf',
    owner: '演示商家',
    store: '主店铺',
    capturedAt: '2026-02-08 09:12',
    contentHash: '待生成：保存后计算 SHA-256',
    anchorStatus: 'pending',
    verification: 'attention',
    linkedProductIds: ['prod-101', 'prod-102'],
    excerpt: '等待链上服务返回交易回执；在回执回读并比对哈希前，不显示为已验证。',
  },
  {
    id: 'source-store-omni',
    title: 'Omni 官方商城商品页',
    sourceType: 'website',
    uri: 'https://shop.omnilink.example/products/omni-flow-s1',
    owner: '演示商家',
    store: '授权店铺 / Omni 官方商城',
    capturedAt: '2026-02-06 18:20',
    contentHash: '待生成：保存后计算 SHA-256',
    anchorStatus: 'not_requested',
    verification: 'pending',
    linkedProductIds: ['prod-101'],
    excerpt: '记录授权店铺的商品公开信息，后续可由商家授权关系校验来源资格。',
  },
]

type DashboardWorkspaceValue = {
  selectedProduct: SelectedProduct | null
  selectedProducts: SelectedProduct[]
  products: SelectedProduct[]
  knowledgeEntries: KnowledgeEntryRecord[]
  artifacts: WorkspaceArtifact[]
  sources: WorkspaceSource[]
  setSelectedProduct: (product: SelectedProduct) => void
  setSelectedProducts: (products: SelectedProduct[]) => void
  registerProducts: (products: SelectedProduct[]) => void
  refreshProducts: () => Promise<void>
  addKnowledgeEntry: (entry: Omit<KnowledgeEntryRecord, 'id'>) => void
  addArtifact: (artifact: Omit<WorkspaceArtifact, 'archived'>) => void
  archiveArtifact: (artifactId: string) => void
  addSource: (source: Omit<WorkspaceSource, 'id'>) => void
  updateSource: (sourceId: string, patch: Partial<WorkspaceSource>) => void
}

const DashboardWorkspaceContext = createContext<DashboardWorkspaceValue | null>(null)

export function DashboardWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [products, setProducts] = useState<SelectedProduct[]>([])
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntryRecord[]>([])
  const [artifacts, setArtifacts] = useState<WorkspaceArtifact[]>([])
  const [sources, setSources] = useState<WorkspaceSource[]>(DEMO_SOURCES)

  const refreshProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/merchant/products', { credentials: 'include' })
      if (!response.ok) return
      const data = await response.json() as { products?: Array<{ id: string; name?: string; title?: string; sku?: string | null }> }
      setProducts((data.products ?? []).map((product) => ({ id: product.id, name: product.name || product.title || '', sku: product.sku })))
    } catch {
      // The server-rendered asset library remains the fallback when unauthenticated.
    }
  }, [])

  const registerProducts = useCallback((incoming: SelectedProduct[]) => {
    setProducts(incoming)
  }, [])

  useEffect(() => {
    void refreshProducts()
    const handleChange = () => void refreshProducts()
    window.addEventListener('omnilink:products-changed', handleChange)
    return () => window.removeEventListener('omnilink:products-changed', handleChange)
  }, [refreshProducts])

  const value = useMemo<DashboardWorkspaceValue>(() => ({
    selectedProduct: selectedProducts[0] ?? null,
    selectedProducts,
    products,
    knowledgeEntries,
    artifacts,
    sources,
    setSelectedProduct: (product) => setSelectedProducts([product]),
    setSelectedProducts,
    registerProducts,
    refreshProducts,
    addKnowledgeEntry: (entry) => {
      setKnowledgeEntries((current) => [...current, { ...entry, id: `knowledge-${Date.now()}` }])
    },
    addArtifact: (artifact) => {
      setArtifacts((current) => [...current, { ...artifact, archived: false }])
    },
    archiveArtifact: (artifactId) => {
      setArtifacts((current) => current.map((artifact) => (
        artifact.id === artifactId ? { ...artifact, archived: true } : artifact
      )))
      const artifact = artifacts.find((item) => item.id === artifactId)
      if (!artifact) return
      setKnowledgeEntries((current) => [...current, {
        id: `knowledge-${artifact.id}`,
        domain: artifact.productId ? 'product' : 'merchant',
        key: artifact.title,
        value: artifact.content,
        kind: 'claim',
        status: 'pending_review',
        sourceId: `conversation-${artifact.id}`,
        updatedAt: '刚刚',
      }])
    },
    addSource: (source) => {
      setSources((current) => [...current, { ...source, id: `source-${Date.now()}` }])
    },
    updateSource: (sourceId, patch) => {
      setSources((current) => current.map((source) => source.id === sourceId ? { ...source, ...patch } : source))
    },
  }), [artifacts, knowledgeEntries, products, refreshProducts, registerProducts, selectedProducts, sources])

  return <DashboardWorkspaceContext.Provider value={value}>{children}</DashboardWorkspaceContext.Provider>
}

export function useDashboardWorkspace() {
  const context = useContext(DashboardWorkspaceContext)
  if (!context) throw new Error('useDashboardWorkspace must be used inside DashboardWorkspaceProvider')
  return context
}
