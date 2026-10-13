'use client'

import React, { useState } from 'react'
import {
  Search,
  Users,
  Handshake,
} from 'lucide-react'
import { INITIAL_ORGANIZATIONS } from './mockData'

interface OrganizationsPageProps {
  onSelectOrg: (orgId: string) => void
  onPartnerOrg: (orgId: string) => void
  isZh: boolean
}

const CATEGORIES_ZH = ['全部', '营销', '设计', '开发', '物流', '咨询', '制造', '摄影', '销售']
const CATEGORIES_EN = ['All', 'Marketing', 'Design', 'Development', 'Logistics', 'Consulting', 'Manufacturing', 'Photography', 'Sales']

export function OrganizationsPage({
  onSelectOrg,
  onPartnerOrg,
  isZh,
}: OrganizationsPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(isZh ? '全部' : 'All')

  const categories = isZh ? CATEGORIES_ZH : CATEGORIES_EN

  const filteredOrgs = INITIAL_ORGANIZATIONS.filter((org) => {
    const matchesSearch =
      !searchQuery.trim() ||
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.typeZh.includes(searchQuery) ||
      org.serviceScope.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.serviceScopeZh.includes(searchQuery) ||
      org.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
      org.skillsZh.some((s) => s.includes(searchQuery))

    const matchesCategory =
      selectedCategory === '全部' ||
      selectedCategory === 'All' ||
      org.categoryZh === selectedCategory ||
      org.category === selectedCategory ||
      (selectedCategory === '营销' && org.categoryZh === '营销') ||
      (selectedCategory === '设计' && org.categoryZh === '设计') ||
      (selectedCategory === '开发' && org.categoryZh === '开发') ||
      (selectedCategory === '物流' && org.categoryZh === '物流') ||
      (selectedCategory === '咨询' && org.categoryZh === '咨询') ||
      (selectedCategory === '摄影' && org.categoryZh === '摄影') ||
      (selectedCategory === '制造' && org.categoryZh === '咨询')

    return matchesSearch && matchesCategory
  })

  return (
    <div className="w-full max-w-6xl mx-auto py-6 sm:py-8 px-4 space-y-10">
      {/* ============================================================
          1. HEADER & SEARCH
          ============================================================ */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
            <span className="text-[11px] font-bold text-[var(--primary)] uppercase tracking-wider">
              Teams & Agency Ecosystem
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
            {isZh ? '组织' : 'Organizations'}
          </h1>
          <p className="text-sm text-[var(--lavender)]">
            {isZh
              ? '寻找可以承接完整需求的团队与专业机构，赋能业务规模化扩张。'
              : 'Find trusted agencies, studios, and enterprise service providers for end-to-end execution.'}
          </p>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Search Input */}
          <div className="relative w-full sm:max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--lavender)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isZh ? '寻找团队或公司...' : 'Search studios, agencies & teams...'}
              className="w-full h-10 pl-9 pr-4 bg-[var(--surface)] rounded-[6px] border border-[var(--border)] hover:border-[var(--lavender)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-xs sm:text-sm text-[var(--ink)] focus:outline-none shadow-2xs"
            />
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => {
              const active = selectedCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`h-8 px-3  text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-[var(--primary)] text-[var(--surface)] shadow-xs'
                      : 'bg-[var(--surface)] hover:bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--ink)] hover:text-[var(--ink)]'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ============================================================
          2. FEATURED ORGANIZATIONS GRID (Structured Team Cards)
          ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredOrgs.map((org) => (
          <div
            key={org.id}
            id={`org-card-${org.id}`}
            className="bg-[var(--surface)] rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/70 p-5 flex flex-col justify-between transition-all duration-200 shadow-2xs hover:shadow-xs group"
          >
            <div className="space-y-4">
              {/* Top Row: Logo, Name, Type, Verified badge */}
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-[6px] bg-[var(--surface-muted)] text-[var(--surface)] font-black text-sm flex items-center justify-center shrink-0 shadow-2xs">
                  {org.logo}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[var(--ink)] group-hover:text-[var(--primary)] transition-colors truncate">
                      {org.name}
                    </h3>
                  </div>

                  <p className="text-xs font-semibold text-[var(--primary)] truncate">
                    {isZh ? org.typeZh : org.type}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-[var(--lavender)] mt-0.5">
                    <span className="flex items-center gap-1">
                      <Users size={11} className="text-[var(--lavender)]" />
                      <span>{isZh ? org.teamSizeZh : org.teamSize}</span>
                    </span>
                    <span>·</span>
                    <span className="truncate">{isZh ? org.serviceScopeZh : org.serviceScope}</span>
                  </div>
                </div>
              </div>

              {/* About description */}
              <p className="text-xs text-[var(--ink)] leading-relaxed line-clamp-2">
                {isZh ? org.aboutZh : org.about}
              </p>

              {/* Core capabilities */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-[var(--lavender)] uppercase tracking-wider">
                  {isZh ? '团队核心能力' : 'Team Core Capabilities'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(isZh ? org.skillsZh : org.skills).map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5  bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--ink)] text-[11px] font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Featured Case Snippet */}
              {org.featuredCase.length > 0 && (
                <div className="p-2.5 rounded-lg bg-[var(--surface-muted)] border border-[var(--surface-muted)] flex items-center justify-between">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-[10px] text-[var(--lavender)] font-bold">
                      {isZh ? '代表案例' : 'Featured Impact'}
                    </div>
                    <div className="text-[11px] font-semibold text-[var(--ink)] truncate">
                      {org.featuredCase[0].title}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[var(--acid-sage)] shrink-0">
                    {org.featuredCase[0].impact}
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Actions [查看] / [合作] */}
            <div className="pt-4 mt-4 border-t border-[var(--surface-muted)] flex items-center justify-between gap-2">
              <span className="text-[11px] text-[var(--lavender)]">
                {org.projectCount} {isZh ? '个交付案例' : 'delivered cases'}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id={`btn-view-org-${org.id}`}
                  onClick={() => onSelectOrg(org.id)}
                  className="h-8 px-2.5  bg-[var(--surface)] hover:bg-[var(--surface-muted)] border border-[var(--border)] hover:border-[var(--border)] text-xs font-semibold text-[var(--ink)] transition-all cursor-pointer"
                >
                  {isZh ? '查看' : 'Details'}
                </button>
                <button
                  type="button"
                  id={`btn-partner-org-${org.id}`}
                  onClick={() => onPartnerOrg(org.id)}
                  className="h-8 px-3  bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] text-xs font-bold text-[var(--surface)] transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Handshake size={12} />
                  <span>{isZh ? '合作' : 'Partner'}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
