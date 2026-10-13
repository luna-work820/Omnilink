-- Local-only Catalog seed. Safe to run repeatedly.
insert into public.organizations (id, slug, name, owner_user_id)
values ('00000000-0000-0000-0000-000000000001', 'omnilink-demo', 'Omnilink Demo', null)
on conflict (id) do update set name = excluded.name;

insert into public.stores (id, organization_id, slug, name, currency)
values ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'demo', 'Omnilink Demo', 'CNY')
on conflict (id) do update set name = excluded.name, currency = excluded.currency;

insert into public.sales_channels (id, organization_id, code, name, channel_type, status)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'workspace', '工作台', 'workspace', 'active'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'storefront', '演示商城', 'storefront', 'active')
on conflict (id) do update set name = excluded.name, status = excluded.status;

insert into public.catalog_items (id, organization_id, item_type, title, slug, description, cover_image, status, details)
values
  ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000001', 'product', '暖灰弧面台灯', 'warm-arc-lamp', '适合卧室与工作台的柔和暖光台灯。', 'demo/warm-arc-lamp.webp', 'active', '{"style":["warm minimal","soft arc"],"colors":["warm gray","cream"],"material":"aluminum"}'),
  ('00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000000001', 'service', '品牌视觉诊断', 'brand-visual-audit', '面向商家的品牌视觉与竞品分析服务。', null, 'active', '{"delivery":"3 business days","format":"report"}'),
  ('00000000-0000-0000-0000-000000001003', '00000000-0000-0000-0000-000000000001', 'skill', '社媒内容策划', 'social-content-planning', '围绕商品资产生成社交媒体内容方案。', null, 'draft', '{"output":["caption","content calendar"],"language":"zh-CN"}')
on conflict (id) do update set title = excluded.title, description = excluded.description, status = excluded.status, details = excluded.details;

insert into public.catalog_variants (id, organization_id, catalog_item_id, sku_code, title, price, currency_code, availability_type, availability_value, details)
values
  ('00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001001', 'OMNI-LAMP-001', '标准款', 399.00, 'CNY', 'stock', 20, '{"finish":"matte"}'),
  ('00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001002', 'OMNI-AUDIT-001', '基础诊断', 1999.00, 'CNY', 'capacity', 5, '{}'),
  ('00000000-0000-0000-0000-000000002003', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001003', 'OMNI-SOCIAL-001', '标准方案', 899.00, 'CNY', 'capacity', 10, '{}')
on conflict (id) do update set price = excluded.price, availability_value = excluded.availability_value, details = excluded.details;

insert into public.catalog_media (id, organization_id, catalog_item_id, variant_id, media_type, media_role, storage_path, alt_text, metadata)
values ('00000000-0000-0000-0000-000000003001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000002001', 'image', 'cover', 'demo/warm-arc-lamp.webp', '暖灰弧面台灯', '{"source":"seed"}')
on conflict (id) do update set storage_path = excluded.storage_path, metadata = excluded.metadata;

insert into public.catalog_item_channels (id, organization_id, catalog_item_id, channel_id, store_id, is_visible, is_purchasable, price_override, currency_code, published_at)
values
  ('00000000-0000-0000-0000-000000004001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000011', true, true, null, 'CNY', now()),
  ('00000000-0000-0000-0000-000000004002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000011', true, true, 379.00, 'CNY', now()),
  ('00000000-0000-0000-0000-000000004003', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000011', true, false, null, 'CNY', now())
on conflict (id) do update set is_visible = excluded.is_visible, is_purchasable = excluded.is_purchasable, price_override = excluded.price_override;

insert into public.semantic_documents (id, organization_id, entity_type, entity_id, content, content_hash)
values
  ('00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000000001', 'catalog_item', '00000000-0000-0000-0000-000000001001', '暖灰弧面台灯，暖光，极简，适合卧室和工作台，哑光铝材。', 'seed-lamp-v1'),
  ('00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000000001', 'catalog_item', '00000000-0000-0000-0000-000000001002', '品牌视觉诊断，竞品分析，品牌风格和视觉策略报告。', 'seed-audit-v1')
on conflict (id) do update set content = excluded.content, content_hash = excluded.content_hash;

insert into public.semantic_embeddings (id, organization_id, document_id, modality, provider, model, dimensions, embedding)
values
  ('00000000-0000-0000-0000-000000006001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000005001', 'text', 'qwen', 'Qwen3-Embedding', 1024, array_fill(0::real, array[1024])::extensions.vector),
  ('00000000-0000-0000-0000-000000006002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000005002', 'text', 'qwen', 'Qwen3-Embedding', 1024, array_fill(0::real, array[1024])::extensions.vector)
on conflict (id) do update set embedding = excluded.embedding;
