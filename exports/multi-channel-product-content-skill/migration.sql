insert into public.workspace_skills (id, name, description, icon, category, visibility)
values (
  'multi-channel-product-content',
  '多渠道商品内容',
  '基于商品事实、原始素材和商家定位生成小红书、抖音与商品详情页内容，并附带图片 brief 和审核清单。',
  'share-2',
  'copywriting',
  'system'
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  category = excluded.category,
  visibility = excluded.visibility,
  updated_at = now();

insert into public.workspace_skill_versions (skill_id, version, manifest)
values (
  'multi-channel-product-content',
  '0.1.0',
  '{
    "input_types": ["product", "product_assets", "merchant_profile", "brand_proposal"],
    "output": "multi_channel_content_package",
    "channels": ["xiaohongshu", "douyin", "product_page"],
    "includes": ["content_strategy", "channel_copy", "image_brief", "review_checklist"],
    "review_required": true,
    "fact_trace_required": true,
    "publishing": false,
    "image_generation": "brief_only"
  }'::jsonb
)
on conflict (skill_id, version) do update set
  manifest = excluded.manifest,
  is_active = true;
