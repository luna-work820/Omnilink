alter table public.workspace_skills
  drop constraint if exists workspace_skills_category_check;

alter table public.workspace_skills
  add constraint workspace_skills_category_check
  check (category = any (array[
    'merchant_profile', 'brand', 'copywriting', 'analysis', 'compliance',
    'other', 'commerce_content'
  ]::text[]));

update public.workspace_skills
set name = '商品内容创作',
    description = '从商品事实与素材出发，生成多渠道文案、商品图片与审核清单。',
    category = 'commerce_content',
    updated_at = now()
where id = 'multi-channel-product-content';

insert into public.workspace_skill_versions (skill_id, version, manifest)
values (
  'multi-channel-product-content',
  '0.6.0',
  '{"input_types":["product","product_assets","reference_image","merchant_profile"],"output":"product_content_creation_package","includes":["semantic_extract","image_results","channel_copy","image_brief","review_checklist"],"review_required":true,"publishing":false,"image_generation":"optional"}'::jsonb
)
on conflict (skill_id, version) do update set manifest = excluded.manifest, is_active = true;

update public.workspace_skill_versions
set is_active = false
where skill_id = 'multi-channel-product-content' and version <> '0.6.0';

update public.store_workspace_skills ss
set skill_version_id = v.id, updated_at = now()
from public.workspace_skill_versions v
where ss.skill_id = 'multi-channel-product-content'
  and v.skill_id = ss.skill_id
  and v.version = '0.6.0';
