begin;

create function private.correct_missing_consumer_composition() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.product->>'itemType'='product' and new.product->>'deliveryType'='physical'
    and coalesce(new.product->>'category','') ~* '(洗护|护肤|精华|新中式|服饰|时尚|设计师|连衣裙|衣服|上衣|裙装)'
    and new.product->'composition'->>'status'='not_applicable'
    and new.product->'composition'->>'kind'='unknown'
    and new.product->'composition'->'items'='[]'::jsonb then
    new.product := jsonb_set(new.product, '{composition,status}', to_jsonb('not_provided'::text), false);
  end if;
  return new;
end;
$$;
revoke all on function private.correct_missing_consumer_composition() from public,anon,authenticated;

create trigger consumer_catalog_correct_missing_composition
before insert or update of product on public.consumer_catalog_products
for each row execute function private.correct_missing_consumer_composition();

update public.consumer_catalog_products
set product=jsonb_set(product,'{composition,status}',to_jsonb('not_provided'::text),false)
where product->>'itemType'='product' and product->>'deliveryType'='physical'
  and coalesce(product->>'category','') ~* '(洗护|护肤|精华|新中式|服饰|时尚|设计师|连衣裙|衣服|上衣|裙装)'
  and product->'composition'->>'status'='not_applicable'
  and product->'composition'->>'kind'='unknown'
  and product->'composition'->'items'='[]'::jsonb;

commit;
