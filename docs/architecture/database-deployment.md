# Database deployment

The repository uses ordered SQL files in `supabase/migrations/`. The linked
`omnilink-dev` project was checked on 2026-10-13. Migration
`20261013143618_restore_non_order_database_dependencies` is deployed there.
Migration `20261013054216_secure_public_order_inquiries` remains pending by
request. Do not use a blanket `supabase db push` while that order migration is
deferred: it would also apply the order changes. Resolve that pending migration
before the next normal push, then compare local and remote migration histories.

The non-order migration creates the two product-media buckets and their Storage
policies, public industry reference data, the tenant-scoped semantic-query event
table, and three non-order foreign-key indexes. The event table currently has
no producer; the analytics endpoint can read events but will show zero until
an actual search flow records them.

Before deploying the application to another environment:

1. Confirm the target Supabase project and its backup/restore settings.
2. Apply the intended migrations in version order and compare migration history.
3. Check that the public media bucket is public, the originals bucket is
   private, and authenticated upload policies match product ownership.
4. Generate `lib/database.types.ts` from the target schema after all intended
   migrations are applied. This file includes declarations for the pending
   order RPCs and must not be treated as proof that they exist remotely.
5. Confirm the target Auth redirect URLs and server-only environment variables.

Local development enables Storage in `supabase/config.toml`. The current
remote project has no stores, catalog items, or published storefront versions;
the static flagship demo does not establish a real merchant publishing flow.
