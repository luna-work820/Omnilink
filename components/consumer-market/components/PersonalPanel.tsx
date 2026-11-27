'use client';

import Link from 'next/link';
import { Camera, ChevronRight } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';

export function PersonalPanel({ profileName, publisherReady, creatorReady = false, avatarUrl, onNavigate }: { profileName: string | null; publisherReady: boolean; creatorReady?: boolean; avatarUrl?: string; onNavigate?: () => void }) {
  const name = profileName?.trim() || '访客';
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const [error, setError] = useState('');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      let avatarUrl: string | undefined;
      if (file) {
        const data = new FormData(); data.set('file', file);
        const response = await fetch('/api/consumer/avatar', { method: 'POST', body: data });
        const result = await response.json();
        if (!response.ok || !result.avatarUrl) throw new Error(result.error || '头像上传失败');
        avatarUrl = result.avatarUrl;
      }
      const response = await fetch('/api/consumer/ai-assistant-profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'account', name: draftName.trim(), ...(avatarUrl ? { avatarUrl } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '保存失败');
      setEditing(false); setFile(null); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); }
    finally { setBusy(false); }
  }
  const actionClass = 'mt-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-full px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]';

  return (
    <section className="rounded-[var(--radius-dialog-inner)] p-3 text-[var(--market-ink)]">
      {!editing && <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--market-surface-muted)] text-sm font-semibold" aria-hidden="true">
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h2 id="personal-menu-title" className="truncate text-sm font-medium">{name}</h2>
          <p className="mt-1 text-xs text-[var(--market-text-muted)]">
            {[creatorReady && '创作者', publisherReady && '商家'].filter(Boolean).join('、') || '浏览者'}
          </p>
        </div>
      </div>}
      {editing ? <form onSubmit={save} className="space-y-5" aria-label="编辑资料">
        <div>
          <h2 id="personal-menu-title" className="text-sm font-semibold">编辑资料</h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--market-surface-muted)] text-base font-semibold" aria-hidden="true">
            {preview || avatarUrl ? <img src={preview || avatarUrl} alt="" className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
          </span>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-medium hover:bg-[var(--market-hover)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--market-support)]">
            <Camera size={16} aria-hidden="true" />更换头像
            <input type="file" accept="image/*" disabled={busy} onChange={(event) => { const next = event.target.files?.[0] ?? null; if (next && (!next.type.startsWith('image/') || next.size > 5 * 1024 * 1024)) { setError('请选择 5 MB 以内的图片。'); event.target.value = ''; return; } setError(''); setFile(next); }} className="sr-only" />
          </label>
        </div>
        <label className="block text-xs font-medium">账户名
          <input value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={40} required disabled={busy} className="mt-2 h-11 w-full rounded-lg border-[0.5px] border-[var(--market-border)] bg-transparent px-3 text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]" />
        </label>
        {error && <p role="alert" className="text-xs">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => { setEditing(false); setDraftName(name); setFile(null); setError(''); }} className="min-h-10 rounded-full px-4 text-sm hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]">取消</button>
          <button type="submit" disabled={busy || !draftName.trim()} className="min-h-10 rounded-full bg-[var(--market-ink)] px-5 text-sm font-medium text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]">{busy ? '保存中' : '保存'}</button>
        </div>
      </form> : <button type="button" onClick={() => { setDraftName(name); setEditing(true); }} className={actionClass+' hover:bg-[var(--market-hover)]'}><span>编辑资料</span><ChevronRight size={14} aria-hidden="true" /></button>}
      {!editing && <>
      <Link href="/creator" target="_blank" rel="noopener noreferrer" prefetch={false} aria-label="创作者中心，在新标签页打开" className={actionClass+' bg-[var(--market-ink)] text-[var(--surface)] hover:opacity-90'} onClick={() => onNavigate?.()}>
        <span>创作者中心</span>
        <ChevronRight size={14} aria-hidden="true" />
      </Link>
      <Link href="/merchant" target="_blank" rel="noopener noreferrer" prefetch={false} aria-label="商家中心，在新标签页打开" className={actionClass+' hover:bg-[var(--market-hover)]'} onClick={() => onNavigate?.()}>
        <span>商家中心</span>
        <ChevronRight size={14} aria-hidden="true" />
      </Link>
      <form action={logoutAction}><button type="submit" className={actionClass+' hover:bg-[var(--market-hover)]'}>退出账号</button></form>
      </>}
    </section>
  );
}
