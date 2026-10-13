'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import {
  Search,
  MapPin,
  Star,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react'
import { INITIAL_PEOPLE } from './mockData'

interface PeoplePageProps {
  onSelectPerson: (personId: string) => void
  onContactPerson: (personId: string) => void
  isZh: boolean
}

const CATEGORIES_ZH = ['全部', '设计', '摄影', '营销', '销售', '开发', '咨询', '内容', '运营']
const CATEGORIES_EN = ['All', 'Design', 'Photography', 'Marketing', 'Sales', 'Development', 'Consulting', 'Content', 'Operations']

export function PeoplePage({
  onSelectPerson,
  onContactPerson,
  isZh,
}: PeoplePageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(isZh ? '全部' : 'All')

  const categories = isZh ? CATEGORIES_ZH : CATEGORIES_EN

  const filteredPeople = INITIAL_PEOPLE.filter((person) => {
    const matchesSearch =
      !searchQuery.trim() ||
      person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      person.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      person.roleZh.includes(searchQuery) ||
      person.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      person.locationZh.includes(searchQuery) ||
      person.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
      person.skillsZh.some((s) => s.includes(searchQuery))

    const matchesCategory =
      selectedCategory === '全部' ||
      selectedCategory === 'All' ||
      person.categoryZh === selectedCategory ||
      person.category === selectedCategory ||
      (selectedCategory === '设计' && person.categoryZh === '设计') ||
      (selectedCategory === '摄影' && person.categoryZh === '摄影') ||
      (selectedCategory === '营销' && person.categoryZh === '营销') ||
      (selectedCategory === '销售' && person.categoryZh === '销售') ||
      (selectedCategory === '开发' && person.categoryZh === '开发') ||
      (selectedCategory === '咨询' && (person.categoryZh === '营销' || person.categoryZh === '销售'))

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
              Professional Identity Network
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
            {isZh ? '个人' : 'People'}
          </h1>
          <p className="text-sm text-[var(--lavender)]">
            {isZh
              ? '找到真正拥有你需要能力的人，直接建立专业连接。'
              : 'Find verified specialists with proven industry expertise and collaborate directly.'}
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
              placeholder={isZh ? '寻找专业人士...' : 'Search specialists & experts...'}
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
          2. FEATURED PEOPLE GRID (High Trust Identity Cards)
          ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPeople.map((person) => (
          <div
            key={person.id}
            id={`person-card-${person.id}`}
            className="bg-[var(--surface)] rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/70 p-5 flex flex-col justify-between transition-all duration-200 shadow-2xs hover:shadow-xs group"
          >
            <div className="space-y-4">
              {/* Top Row: Avatar, Verified Badge, Name, Location */}
              <div className="flex items-start gap-3.5">
                <div className="relative shrink-0">
                  <Image
                    src={person.avatar}
                    alt={person.name}
                    width={48}
                    height={48}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover border border-[var(--border)] shadow-2xs"
                  />
                  {person.verified && (
                    <div
                      className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-[var(--primary)] text-[var(--surface)] flex items-center justify-center ring-2 ring-[var(--surface)]"
                      title={isZh ? 'Omnilink 实名认证' : 'Verified Specialist'}
                    >
                      <CheckCircle2 size={10} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[var(--ink)] group-hover:text-[var(--primary)] transition-colors truncate">
                      {person.name}
                    </h3>
                    <div className="flex items-center text-[var(--acid-sage)] text-[11px] font-bold shrink-0">
                      <Star size={11} className="fill-amber-400 text-[var(--acid-sage)] mr-0.5" />
                      <span>{person.rating.toFixed(1)}</span>
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-[var(--primary)] truncate">
                    {isZh ? person.roleZh : person.role}
                  </p>

                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--lavender)] mt-0.5">
                    <MapPin size={11} className="shrink-0 text-[var(--lavender)]" />
                    <span className="truncate">{isZh ? person.locationZh : person.location}</span>
                  </div>
                </div>
              </div>

              {/* Bio snippet */}
              <p className="text-xs text-[var(--ink)] leading-relaxed line-clamp-2">
                {isZh ? person.bioZh : person.bio}
              </p>

              {/* Core Skill Badges */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-[var(--lavender)] uppercase tracking-wider">
                  {isZh ? '核心专长' : 'Core Expertise'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(isZh ? person.skillsZh : person.skills).slice(0, 3).map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5  bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--ink)] text-[11px] font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                  {person.skills.length > 3 && (
                    <span className="px-1.5 py-0.5  bg-[var(--surface-muted)] text-[var(--lavender)] text-[10px]">
                      +{person.skills.length - 3}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Meta & Dual Actions [查看] / [联系] */}
            <div className="pt-4 mt-4 border-t border-[var(--surface-muted)] flex items-center justify-between gap-2">
              <span className="text-[11px] text-[var(--lavender)]">
                {person.projectsCount} {isZh ? '个交付项目' : 'projects completed'}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id={`btn-view-person-${person.id}`}
                  onClick={() => onSelectPerson(person.id)}
                  className="h-8 px-2.5  bg-[var(--surface)] hover:bg-[var(--surface-muted)] border border-[var(--border)] hover:border-[var(--border)] text-xs font-semibold text-[var(--ink)] transition-all cursor-pointer"
                >
                  {isZh ? '查看' : 'Profile'}
                </button>
                <button
                  type="button"
                  id={`btn-contact-person-${person.id}`}
                  onClick={() => onContactPerson(person.id)}
                  className="h-8 px-3  bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] text-xs font-bold text-[var(--surface)] transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <MessageSquare size={12} />
                  <span>{isZh ? '联系' : 'Contact'}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
