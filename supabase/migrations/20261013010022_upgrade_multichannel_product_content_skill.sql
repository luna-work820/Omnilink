update public.workspace_skills
set
  name = '多渠道商品内容',
  description = '基于商品事实、原始素材和商家定位生成小红书、抖音与商品详情页内容，并附带营销手段层、图片 brief 和审核清单。',
  icon = 'share-2',
  category = 'copywriting',
  visibility = 'system',
  updated_at = now()
where id = 'multi-channel-product-content';

update public.workspace_skill_versions
set is_active = false
where skill_id = 'multi-channel-product-content'
  and version <> '0.5.2';

insert into public.workspace_skill_versions (skill_id, version, manifest)
values (
  'multi-channel-product-content',
  '0.5.2',
  '{
    "input_types": ["product", "product_assets", "merchant_profile", "brand_proposal"],
    "output": "multi_channel_content_package",
    "channels": ["xiaohongshu", "douyin", "product_page"],
    "includes": ["content_strategy", "channel_copy", "image_brief", "review_checklist"],
    "review_required": true,
    "fact_trace_required": true,
    "publishing": false,
    "image_generation": "brief_only",
    "playbook_layers": ["hook", "suspense_progression", "pain_point", "comparison", "demand"],
    "channel_default_layer": {"xiaohongshu": 5, "douyin": 3, "product_page": 5},
    "requires_commercial_disclosure": true,
    "disallows_fabricated_first_person": true,
    "gap_echo_before_generation": true,
    "blocks_on_channel_facts": true
  }'::jsonb
)
on conflict (skill_id, version) do update set
  manifest = excluded.manifest,
  is_active = true;

update public.store_workspace_skills ss
set skill_version_id = v.id,
    updated_at = now()
from public.workspace_skill_versions v
where ss.skill_id = 'multi-channel-product-content'
  and v.skill_id = ss.skill_id
  and v.version = '0.5.2';
