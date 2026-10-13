# Module ownership

This repository remains one Next.js deployment. These boundaries assign one
place to own business rules and persisted data without introducing service or
package boundaries.

## Owners and entry points

| Domain | Owner | Allowed entry points | Persisted authority |
| --- | --- | --- | --- |
| Orders and checkout inquiries | `lib/orders` | `app/actions/order.ts` adapts the public checkout action; order confirmation UI consumes `lib/orders/types.ts` | `submit_storefront_inquiry` and `get_public_order_confirmation` database functions |
| Public storefront projection | `lib/storefront` | Storefront pages and components read through `lib/storefront/service.ts` | Storefront, catalog and channel tables, subject to RLS |
| Merchant store management | `lib/stores` and `app/actions/store.ts` | Merchant Server Actions and Route Handlers | `stores` and related settings tables, subject to organization membership and RLS |
| Product catalog and variants | `lib/products` and `lib/products/variants` | Merchant Route Handlers adapt HTTP requests to domain services | `catalog_items`, `catalog_variants` and related tables, subject to organization membership and RLS |
| Imports | `lib/imports` | Import Route Handlers | Import records and catalog write paths |
| AI generation and analysis | `lib/product-ai`, `lib/content-generation`, and `lib/ai` | API Route Handlers authenticate, validate request shape and call the relevant service | AI output remains request-scoped unless a persistent job is explicitly created |
| Authentication and authorization | `lib/api/auth.ts`, `lib/supabase/server.ts`, and database RLS | Every Server Action and protected Route Handler checks identity and resource ownership | Supabase Auth identity plus organization membership and RLS |

## Dependency rules

1. Pages, components, Server Actions and Route Handlers are adapters. They do
   not own persisted business rules such as authoritative order prices.
2. A domain module may use its own DTOs and database functions. It should not
   read another domain module's tables directly; request cross-domain data
   through that domain's public service function.
3. UI code consumes DTOs. It does not consume raw database row shapes except
   in explicitly isolated prototype or preview code.
4. `lib/database.types.ts` describes the shared database contract. Domain DTOs
   live with their owner; order contracts now live in `lib/orders/types.ts`.
5. Supabase RLS remains a second authorization boundary. A service-role client
   is not a substitute for user identity or resource ownership checks.

## Current boundary gaps

- Product and store CRUD still has direct Supabase queries in some Route
  Handlers and Server Actions. Move those paths into existing domain services
  when they are next changed; avoid a repository-wide mechanical rewrite.
- The database-free demo checkout remains an adapter concern in
  `app/actions/order.ts`; production order persistence and confirmation are
  owned by `lib/orders`.
- AI routes run synchronously. A durable job owner/worker is not implemented.
- Production RLS and deployment configuration must be checked against the
  intended production Supabase project before a migration or deployment is
  applied.
