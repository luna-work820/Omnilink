create index if not exists brand_assets_user_idx
  on public.brand_assets (user_id);

create index if not exists brand_recommendations_user_idx
  on public.brand_recommendations (user_id);
