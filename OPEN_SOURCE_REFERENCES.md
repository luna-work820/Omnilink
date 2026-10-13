# Open-Source Brand References

> This file stores external references only.
>
> These repositories must not be copied, vendored, bundled, uploaded, or imported into Omnilink. Use them only for architecture and workflow research. Any future implementation must be written in Omnilink's own code and data model, with licenses reviewed before reuse.

## Priority references

### 1. BrandSpec

- Repository: https://github.com/brandspec/brandspec
- Best reference for: machine-readable brand schema, brand decisions, validation, linting, and token generation.
- Omnilink takeaway: use the idea of a versioned brand source of truth, not the repository code.

### 2. Brandcode / Brand System MCP

- Repository: https://github.com/Brandcode-Studio/brandsystem-mcp
- Best reference for: brand runtime, task-scoped context selection, messaging rules, visual rules, and AI access.
- Omnilink takeaway: select only the brand facts required by each Skill or Agent.

### 3. brand-book

- Repository: https://github.com/ordinarynerds/brand-book
- Best reference for: one machine-readable brand source generating multiple outputs and a companion brand skill.
- Omnilink takeaway: brand guidelines should remain operational rather than becoming a static PDF.

### 4. BrandKit MCP

- Repository: https://github.com/ejwhite7/brandkit-mcp
- Best reference for: exposing verbal and visual brand systems to AI tools through MCP.
- Omnilink takeaway: make the brand runtime consumable by downstream Skills and Agents.

## Secondary references

### 5. Brand Identity Generator

- Repository: https://github.com/AbdulkareemKR/brand-identity-generator
- Best reference for: guided identity generation, brand books, voice, typography, color, and mockups.
- Limitation: mainly a one-time identity generator; not a full operational brand runtime.

### 6. Brand Studio Forge

- Repository: https://github.com/levi-lvjp/brand-studio-forge
- Best reference for: conversational brand creation, anti-cliche checks, voice rules, and generated brand skills.
- Limitation: use as workflow inspiration only; do not copy its skill or generated assets.

## Directly usable implementation candidates

These projects are not approved dependencies yet. They are candidates for selective installation after a version, license, security, and bundle-size review. Do not copy their repositories into this workspace.

### 7. C2PA JavaScript SDK

- Repository: https://github.com/contentauth/c2pa-js
- Package: `@contentauth/c2pa-web`
- License shown by the repository: MIT.
- Use for: reading and creating C2PA content provenance manifests for product images and other media assets.
- Omnilink use: verify or attach media provenance; store the resulting manifest metadata beside `MediaAsset` and `Evidence`.
- Constraint: C2PA records media provenance; it does not prove that a product is globally original or settle copyright ownership.
- Adoption status: candidate for the design-provenance module, not for the first brand-identity screen.

### 8. C2PA command-line tool

- Repository: https://github.com/contentauth/c2patool
- License shown by the repository: Apache-2.0.
- Use for: server-side inspection and manifest operations where browser-side WASM is not appropriate.
- Omnilink use: background media verification or controlled asset processing.
- Constraint: introduces a native binary and deployment concerns; prefer the JavaScript SDK for the first web flow.
- Adoption status: evaluate only after browser verification is working.

### 9. jsonld.js

- Repository: https://github.com/digitalbazaar/jsonld.js
- Use for: JSON-LD processing, expansion, compaction, framing, normalization, and linked-data handling.
- Omnilink use: generate or validate the machine-readable graph connecting Brand, Product, MediaAsset, Evidence, Person, Organization, and published pages.
- Constraint: use JSON-LD for public interoperability; keep Omnilink's internal relational schema as the application source of truth.
- Adoption status: strong candidate for the public identity and structured-data layer after license review.

### 10. schema-dts

- Repository: https://github.com/google/schema-dts
- Package: `schema-dts`
- License shown by the repository: Apache-2.0.
- Use for: TypeScript types for Schema.org JSON-LD, including Product, Brand, Organization, Person, WebSite, and Graph.
- Omnilink use: type-check public Product Identity and Brand Identity JSON-LD emitted by Next.js pages.
- Constraint: Schema.org types are a public vocabulary, not a complete provenance or rights model; custom Omnilink fields remain necessary.
- Adoption status: strong candidate for the existing JSON-LD route.

### 11. Tiptap

- Repository: https://github.com/ueberdosis/tiptap
- Package family: `@tiptap/react` and the required open-source extensions.
- License shown by the project: MIT for the open-source core.
- Use for: a controlled rich-text editor for Brand Knowledge, design statements, product stories, and human review notes.
- Omnilink use: store structured editor JSON linked to Brand, Product, MediaAsset, or Evidence rather than treating knowledge as loose files.
- Constraint: use only the open-source packages; review Pro and XL packages separately before adding them.
- Adoption status: candidate if the current document editor is insufficient; do not add it before the knowledge workflow is defined.

### 12. Tiptap UI Components

- Repository: https://github.com/ueberdosis/tiptap-ui-components
- License shown by the repository: MIT.
- Use for: neutral React editor controls and primitives built on Tiptap.
- Omnilink use: selectively reuse editor primitives for the Brand Knowledge and review surfaces.
- Constraint: copy or adapt only the needed component source after license review; do not import a full visual system that conflicts with Omnilink's HP UI rules.
- Adoption status: optional companion to Tiptap.

## Evaluate later, do not add now

### pgGraph

- Repository: https://github.com/evokoa/pggraph
- Use for: graph traversal and relationship queries on PostgreSQL tables.
- Why not now: it requires a PostgreSQL extension and operational control that may not be available on the current Supabase setup. The existing relational `product_relations`, evidence, and identity tables are enough for the first Demo.
- Possible future use: product-family, brand, media, supplier, and service-provider relationship traversal at larger scale.

### BlockNote

- Repository: https://github.com/TypeCellOS/BlockNote
- Use for: a block-based knowledge editor.
- Why not now: its majority MPL-2.0 license and separate GPL-3.0 XL packages require more careful licensing than the current need justifies. Tiptap is the simpler first candidate.
- Possible future use: rich, block-oriented brand and product knowledge authoring.

## Planned Omnilink direction

Omnilink should implement its own `Brand Runtime` as the stable fact source:

```text
Brand facts
  -> task-specific context
  -> Skill / Agent output
  -> human review
  -> approved asset or content
  -> Brand Runtime update
```

The website, social content, photographer brief, designer brief, marketing brief, and supplier brief are outputs of the same Brand Runtime. They are not separate sources of truth.

## Non-import rule

- Do not clone these repositories into the workspace.
- Do not copy their source code, prompts, skills, assets, or generated outputs into the product.
- Do not add them as runtime or build dependencies.
- Do not include them in deployment bundles, uploads, or backups.
- If code is ever reused, review its license and record the approved dependency separately first.

## Adoption rule

Before adding any candidate as a dependency:

1. Record the exact repository, package, version, and license.
2. Check whether the package is maintained and compatible with Next.js 16 / React 19.
3. Check whether it runs in the browser, server, or requires a native binary.
4. Add only the smallest package needed for one real Omnilink workflow.
5. Keep the external project out of the repository; install the package or use its documented API only.
6. Add a short decision record explaining why a native implementation was not enough.
