create table public.knowledge_uploads (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  original_name text not null,
  object_path text,
  content_type text not null,
  byte_size bigint not null check (byte_size > 0),
  status text not null check (status in ('clean', 'rejected')),
  scan_detail text,
  created_at timestamptz not null default now()
);

alter table public.knowledge_uploads enable row level security;

create policy knowledge_uploads_member_select on public.knowledge_uploads
  for select to authenticated
  using (exists (
    select 1 from public.stores s
    join public.organization_members m on m.organization_id = s.organization_id
    where s.id = knowledge_uploads.store_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  ));

create policy knowledge_uploads_editor_insert on public.knowledge_uploads
  for insert to authenticated
  with check (uploaded_by = (select auth.uid()) and exists (
    select 1 from public.stores s
    join public.organization_members m on m.organization_id = s.organization_id
    where s.id = knowledge_uploads.store_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'editor')
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-quarantine',
  'knowledge-quarantine',
  false,
  52428800,
  array['application/pdf', 'application/zip', 'application/x-zip-compressed']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
