'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'motion/react'
import {
  X,
  MapPin,
  Star,
  CheckCircle2,
  MessageSquare,
  Send,
  Check,
  Handshake,
} from 'lucide-react'
import { INITIAL_PEOPLE, INITIAL_ORGANIZATIONS } from './mockData'

interface DetailDrawersProps {
  selectedPersonId: string | null
  selectedOrgId: string | null
  contactPersonId: string | null
  partnerOrgId: string | null
  onClose: () => void
  isZh: boolean
}

export function DetailDrawers({
  selectedPersonId,
  selectedOrgId,
  contactPersonId,
  partnerOrgId,
  onClose,
  isZh,
}: DetailDrawersProps) {
  const [messageSent, setMessageSent] = useState(false)
  const [inquiryText, setInquiryText] = useState('')
  const [projectBudget, setProjectBudget] = useState('$5,000 - $10,000')

  const person = INITIAL_PEOPLE.find((p) => p.id === (selectedPersonId || contactPersonId))
  const org = INITIAL_ORGANIZATIONS.find((o) => o.id === (selectedOrgId || partnerOrgId))

  const isContactMode = Boolean(contactPersonId || partnerOrgId)

  const handleSendInquiry = (e: React.FormEvent) => {
    e.preventDefault()
    setMessageSent(true)
    setTimeout(() => {
      setMessageSent(false)
      setInquiryText('')
      onClose()
    }, 1800)
  }

  return (
    <AnimatePresence>
      {(person || org) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[var(--surface-muted)]/40 backdrop-blur-xs transition-opacity"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-xl bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--surface-muted)] bg-[var(--surface)] sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                <span className="text-xs font-bold text-[var(--lavender)] uppercase tracking-wider">
                  {person
                    ? isContactMode
                      ? isZh
                        ? '发起直连沟通'
                        : 'Direct Message'
                      : isZh
                      ? '专业个人档案'
                      : 'Specialist Profile'
                    : isContactMode
                    ? isZh
                      ? '发起商务合作'
                      : 'Initiate Partnership'
                    : isZh
                    ? '团队与机构主页'
                    : 'Organization Profile'}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1  text-[var(--lavender)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* PERSON VIEW */}
              {person && !isContactMode && (
                <div className="space-y-6">
                  {/* Top Profile Header */}
                  <div className="flex items-start gap-4">
                    <Image
                      src={person.avatar}
                      alt={person.name}
                      width={64}
                      height={64}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-full object-cover border border-[var(--border)] shadow-sm shrink-0"
                    />
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-[var(--ink)]">{person.name}</h2>
                        {person.verified && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--primary)] bg-[var(--surface-muted)] px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={11} />
                            {isZh ? '官方实名' : 'Verified'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-[var(--primary)]">
                        {isZh ? person.roleZh : person.role}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-[var(--lavender)]">
                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="text-[var(--lavender)]" />
                          <span>{isZh ? person.locationZh : person.location}</span>
                        </span>
                        <span>·</span>
                        <span className="flex items-center text-[var(--acid-sage)] font-bold">
                          <Star size={12} className="fill-amber-400 text-[var(--acid-sage)] mr-0.5" />
                          <span>{person.rating.toFixed(1)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-[var(--ink)]">
                      {isZh ? '个人简介' : 'About'}
                    </h4>
                    <p className="text-xs text-[var(--ink)] leading-relaxed">
                      {isZh ? person.bioZh : person.bio}
                    </p>
                  </div>

                  {/* Skills */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-[var(--ink)]">
                      {isZh ? '专长与技术栈' : 'Skills & Technologies'}
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {(isZh ? person.skillsZh : person.skills).map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1  bg-[var(--surface-muted)] border border-[var(--border)] text-xs text-[var(--ink)] font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Recent Work */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-[var(--ink)]">
                      {isZh ? '代表交付项目' : 'Recent Work & Deliveries'}
                    </h4>
                    <div className="space-y-2">
                      {person.recentWork.map((w, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-[var(--surface-muted)] rounded-lg border border-[var(--surface-muted)] flex items-center justify-between"
                        >
                          <div>
                            <div className="text-xs font-bold text-[var(--ink)]">{w.title}</div>
                            <div className="text-[11px] text-[var(--lavender)]">
                              {isZh ? '客户：' : 'Client: '} {w.client}
                            </div>
                          </div>
                          <span className="text-[11px] text-[var(--lavender)] font-medium">{w.year}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ORGANIZATION VIEW */}
              {org && !isContactMode && (
                <div className="space-y-6">
                  {/* Org Top Header */}
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-[8px] bg-[var(--surface-muted)] text-[var(--surface)] font-black text-xl flex items-center justify-center shrink-0 shadow-sm">
                      {org.logo}
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <h2 className="text-lg font-bold text-[var(--ink)]">{org.name}</h2>
                      <p className="text-xs font-bold text-[var(--primary)]">
                        {isZh ? org.typeZh : org.type}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-[var(--lavender)]">
                        <span>{isZh ? org.teamSizeZh : org.teamSize}</span>
                        <span>·</span>
                        <span>{isZh ? org.serviceScopeZh : org.serviceScope}</span>
                      </div>
                    </div>
                  </div>

                  {/* About */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-[var(--ink)]">
                      {isZh ? '机构概况' : 'About the Organization'}
                    </h4>
                    <p className="text-xs text-[var(--ink)] leading-relaxed">
                      {isZh ? org.aboutZh : org.about}
                    </p>
                  </div>

                  {/* Core Services */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-[var(--ink)]">
                      {isZh ? '全链路服务能力' : 'Service Capabilities'}
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {(isZh ? org.skillsZh : org.skills).map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1  bg-[var(--surface-muted)] border border-[var(--border)] text-xs text-[var(--ink)] font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Featured Cases */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-[var(--ink)]">
                      {isZh ? '核心标杆案例' : 'Featured Case Studies'}
                    </h4>
                    <div className="space-y-2">
                      {org.featuredCase.map((c, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-[var(--surface-muted)] rounded-lg border border-[var(--surface-muted)] flex items-center justify-between"
                        >
                          <div>
                            <div className="text-xs font-bold text-[var(--ink)]">{c.title}</div>
                            <div className="text-[11px] text-[var(--lavender)]">{c.category}</div>
                          </div>
                          <span className="text-xs font-bold text-[var(--acid-sage)]">{c.impact}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* CONTACT / PARTNER INQUIRY FORM */}
              {isContactMode && (
                <form onSubmit={handleSendInquiry} className="space-y-4">
                  <div className="p-3.5 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] flex items-center gap-3">
                    <div className="w-9 h-9  bg-[var(--primary)] text-[var(--surface)] flex items-center justify-center shrink-0">
                      {person ? <MessageSquare size={16} /> : <Handshake size={16} />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--ink)]">
                        {isZh ? '直连对象：' : 'Recipient: '}
                        {person ? person.name : org?.name}
                      </div>
                      <div className="text-[11px] text-[var(--ink)]">
                        {person
                          ? isZh
                            ? person.roleZh
                            : person.role
                          : isZh
                          ? org?.typeZh
                          : org?.type}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ink)]">
                      {isZh ? '合作/咨询需求描述' : 'Requirement Description'}
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={inquiryText}
                      onChange={(e) => setInquiryText(e.target.value)}
                      placeholder={
                        isZh
                          ? '例如：我们需要为 2026 春季上新的 3 款消费电子产品拍摄全套白底与场景大片，预计 3 周内交付...'
                          : 'Describe your project goals, timelines, deliverables, and specific requirements...'
                      }
                      className="w-full p-3 bg-[var(--surface)] rounded-[6px] border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-xs text-[var(--ink)] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ink)]">
                      {isZh ? '预估预算区间' : 'Estimated Budget'}
                    </label>
                    <select
                      value={projectBudget}
                      onChange={(e) => setProjectBudget(e.target.value)}
                      className="w-full h-9 px-3 bg-[var(--surface)] rounded-[6px] border border-[var(--border)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                    >
                      <option value="< $2,000">&lt; $2,000 USD</option>
                      <option value="$2,000 - $5,000">$2,000 - $5,000 USD</option>
                      <option value="$5,000 - $10,000">$5,000 - $10,000 USD</option>
                      <option value="$10,000+">$10,000+ USD</option>
                    </select>
                  </div>

                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={messageSent}
                      className="w-full h-10  bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] disabled:bg-[var(--acid-sage)] text-[var(--surface)] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      {messageSent ? (
                        <>
                          <Check size={14} />
                          <span>{isZh ? '已发送需求邀约' : 'Inquiry Sent!'}</span>
                        </>
                      ) : (
                        <>
                          <Send size={13} />
                          <span>{isZh ? '立即发送' : 'Send Message'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            {!isContactMode && (
              <div className="p-4 border-t border-[var(--surface-muted)] bg-[var(--surface-muted)] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4  bg-[var(--surface)] hover:bg-[var(--surface-muted)] border border-[var(--border)] text-xs font-semibold text-[var(--ink)] cursor-pointer"
                >
                  {isZh ? '关闭' : 'Close'}
                </button>
                {person && (
                  <button
                    type="button"
                    onClick={() => {
                      // switch to contact mode in same modal
                    }}
                    className="h-9 px-4  bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] text-xs font-bold text-[var(--surface)] cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <MessageSquare size={13} />
                    <span>{isZh ? '发起沟通' : 'Contact Person'}</span>
                  </button>
                )}
                {org && (
                  <button
                    type="button"
                    onClick={() => {
                      // switch to partner mode in same modal
                    }}
                    className="h-9 px-4  bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] text-xs font-bold text-[var(--surface)] cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Handshake size={13} />
                    <span>{isZh ? '洽谈合作' : 'Partner with Org'}</span>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
