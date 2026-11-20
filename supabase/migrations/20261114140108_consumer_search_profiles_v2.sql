begin;

-- New derived profiles leave every v1 vector and lease unchanged.
insert into public.consumer_embedding_profiles(id,profile) values
('bge-small-zh-v1.5-512-v2','{"id":"bge-small-zh-v1.5-512-v2","provider":"local-bge","model":"BAAI/bge-small-zh-v1.5-onnx-quantized","revision":"v1.5-onnx-quantized","dimensions":512,"preprocessing":"product-facts-bilingual-v2","indexVersion":2}'),
('qwen-text-embedding-v4-1024-v2','{"id":"qwen-text-embedding-v4-1024-v2","provider":"qwen","model":"text-embedding-v4","revision":"provider-alias:text-embedding-v4","dimensions":1024,"preprocessing":"product-facts-bilingual-v2","indexVersion":2}');

create index consumer_vectors_bge_v2 on public.consumer_catalog_vectors
  using hnsw ((embedding::extensions.vector(512)) extensions.vector_cosine_ops)
  where profile_id='bge-small-zh-v1.5-512-v2';
create index consumer_vectors_qwen_v2 on public.consumer_catalog_vectors
  using hnsw ((embedding::extensions.vector(1024)) extensions.vector_cosine_ops)
  where profile_id='qwen-text-embedding-v4-1024-v2';

commit;
