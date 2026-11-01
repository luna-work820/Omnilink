import { redirect } from 'next/navigation'
import { createClientServer } from '@/lib/supabase/server'
import { StoreCreateForm } from '@/components/onboarding/StoreCreateForm'
import { logoutAction } from '@/app/actions/auth'
import { getBrandProjectByUserId } from '@/lib/brand/workspace'
import { getStoreByOwnerId } from '@/lib/stores/service'
import { LogOut, User, Sparkles } from 'lucide-react'

function AsteriskIcon({ className = 'w-6 h-6', color = 'currentColor' }: { className?: string; color?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <rect x="10.5" y="2" width="3" height="20" rx="1.5" />
      <rect x="2" y="10.5" width="20" height="3" rx="1.5" />
      <rect x="10.5" y="2" width="3" height="20" rx="1.5" transform="rotate(45 12 12)" />
      <rect x="10.5" y="2" width="3" height="20" rx="1.5" transform="rotate(-45 12 12)" />
    </svg>
  )
}

/**
 * /onboarding — 新手引导与创建店铺页面
 *
 * 验证规则：
 * 1. 仅允许已登录（Supabase Session）用户访问，未登录重定向至 /login
 * 2. 支持用户上传店铺头像、店铺名称、选择/填写主营商品类型（网络通用电商模板 + 自定义品类）
 * 3. 完成初始化后重定向至 /dashboard
 */
export default async function OnboardingPage() {
  const supabase = await createClientServer()
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    user = null
  }

  if (!user) {
    redirect('/login')
  }

  const [existingProject, existingStore] = await Promise.all([
    getBrandProjectByUserId(user.id),
    getStoreByOwnerId(user.id),
  ])
  if (existingProject && existingStore) {
    redirect('/dashboard/products')
  }

  const currentUser = user

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--ink)] flex flex-col justify-between">
      {/* 顶部导航栏 */}
      <header className="w-full bg-[var(--surface)]/90 backdrop-blur-md border-b border-[var(--surface-muted)]/80 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[var(--primary)] via-[var(--lavender)] to-[var(--plum)] flex items-center justify-center shadow-xs">
            <AsteriskIcon className="w-5 h-5 text-[var(--surface)]" color="var(--surface)" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading text-base font-extrabold text-[var(--ink)] tracking-tight">
                OMNILINK
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--plum)] text-[var(--plum)] border border-[var(--plum)]">
                Setup
              </span>
            </div>
            <p className="text-[10px] text-[var(--lavender)]">AI-Native Commerce Infrastructure</p>
          </div>
        </div>

        {/* 右侧用户邮箱与登出 */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-muted)] text-xs font-medium text-[var(--ink)]">
            <User size={13} className="text-[var(--lavender)]" />
            <span className="truncate max-w-[180px]">{currentUser.email}</span>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-full border border-[var(--surface-muted)] hover:bg-[var(--surface-muted)] text-xs font-medium text-[var(--lavender)] hover:text-[var(--ink)] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">退出登录</span>
            </button>
          </form>
        </div>
      </header>

      {/* 主体内容 */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <StoreCreateForm />
      </main>

      {/* 底部版权 */}
      <footer className="w-full border-t border-[var(--surface-muted)]/80 bg-[var(--surface)] px-4 sm:px-8 py-4 text-center text-xs text-[var(--lavender)]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>OMNILINK AI COMMERCE &copy; 2026. All rights reserved.</span>
          <span className="flex items-center gap-1 text-[11px] text-[var(--lavender)]">
            <Sparkles size={12} className="text-[var(--plum)]" />
            <span>智能店铺节点初始化系统</span>
          </span>
        </div>
      </footer>
    </div>
  )
}
