'use client'

import React, { useState, useActionState } from 'react'
import { loginAction, signupAction, type AuthState } from '@/app/actions/auth'
import { Eye, EyeOff, Loader2, ArrowRight, Lock, Mail, X } from 'lucide-react'

interface UnifiedAuthFormProps {
  onClose?: () => void
  isModal?: boolean
}

export function UnifiedAuthForm({ onClose, isModal = false }: UnifiedAuthFormProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [signinState, signinDispatch, signinPending] = useActionState<AuthState, FormData>(
    loginAction,
    null
  )
  const [signupState, signupDispatch, signupPending] = useActionState<AuthState, FormData>(
    signupAction,
    null
  )

  React.useEffect(() => {
    if (signinState?.redirectUrl) {
      window.location.href = signinState.redirectUrl
    }
  }, [signinState])

  React.useEffect(() => {
    if (signupState?.redirectUrl) {
      window.location.href = signupState.redirectUrl
    }
  }, [signupState])

  const error = mode === 'signin' ? signinState?.error : signupState?.error
  const message = signupState?.message ?? null
  const isPending = mode === 'signin' ? signinPending : signupPending

  return (
    <div className="card-breathing-glow-white w-full max-w-md mx-auto p-6 sm:p-8 rounded-[16px] bg-[var(--surface)] border border-[var(--surface-muted)] text-[var(--ink)] shadow-[0_20px_60px_var(--ink)] relative">
      {/* 弹窗关闭按钮 */}
      {isModal && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 w-7 h-7 rounded-full bg-[var(--surface-muted)] hover:bg-[var(--surface-muted)] text-[var(--lavender)] hover:text-[var(--lavender)] transition-colors flex items-center justify-center cursor-pointer"
          aria-label="关闭"
        >
          <X size={15} />
        </button>
      )}

      {/* 顶部标题与品牌标识 */}
      <div className="flex items-center justify-between mb-6 pr-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7  bg-[var(--primary)] flex items-center justify-center text-[var(--surface)] shadow-sm notranslate select-none" translate="no">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-[var(--ink)]">
              {mode === 'signin' ? '登录 OMNILINK' : '注册 OMNILINK'}
            </h2>
          </div>
        </div>

        {/* 模式切换 (极简分段开关) */}
        <div className="flex items-center p-0.5  bg-[var(--surface-muted)] border border-[var(--surface-muted)]">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`px-3 py-1 text-xs font-semibold rounded-[3px] transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs'
                : 'text-[var(--lavender)] hover:text-[var(--lavender)]'
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`px-3 py-1 text-xs font-semibold rounded-[3px] transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs'
                : 'text-[var(--lavender)] hover:text-[var(--lavender)]'
            }`}
          >
            注册
          </button>
        </div>
      </div>

      {/* 表单输入区 */}
      <form action={mode === 'signin' ? signinDispatch : signupDispatch} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5 text-xs text-[var(--lavender)]">
            <label htmlFor="unified-email" className="font-semibold">
              工作邮箱
            </label>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--lavender)]">
              <Mail size={15} />
            </div>
            <input
              id="unified-email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="merchant@omnilink.ai"
              autoComplete="email"
              className="w-full pl-10 pr-3.5 py-2.5  border border-[var(--surface-muted)] bg-[var(--surface)]/90 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 outline-none text-xs text-[var(--lavender)] placeholder:text-[var(--lavender)] transition-all shadow-2xs"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5 text-xs text-[var(--lavender)]">
            <label htmlFor="unified-password" className="font-semibold">
              账户密码
            </label>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--lavender)]">
              <Lock size={15} />
            </div>
            <input
              id="unified-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入 6 位及以上密码"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className="w-full pl-10 pr-10 py-2.5  border border-[var(--surface-muted)] bg-[var(--surface)]/90 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 outline-none text-xs text-[var(--lavender)] placeholder:text-[var(--lavender)] transition-all shadow-2xs font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--lavender)] hover:text-[var(--lavender)] transition-colors p-1 cursor-pointer"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error ? (
          <div role="alert" className="bg-[var(--plum)] border border-[var(--plum)] text-[var(--plum)] text-xs px-3.5 py-2.5  animate-fadeIn">
            {error}
          </div>
        ) : null}

        {/* 成功消息 */}
        {message ? (
          <div role="status" className="bg-[var(--acid-sage)] border border-[var(--acid-sage)] text-[var(--acid-sage)] text-xs px-3.5 py-2.5  animate-fadeIn leading-relaxed">
            {message}
          </div>
        ) : null}

        {/* HP Enterprise 核心主按钮: var(--primary) +  */}
        <button
          type="submit"
          disabled={isPending}
          className="btn-hp-primary w-full mt-2 py-3 px-5  text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>正在验证身份…</span>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <span>{mode === 'signin' ? '登录工作台' : '完成注册并开启'}</span>
              <ArrowRight size={14} />
            </div>
          )}
        </button>
      </form>
    </div>
  )
}
