# Project Rules & Design System Guidelines

## Inline Alignment & Height Rule

- Buttons and cards placed on the same row MUST use the same height, regardless of shape.
- Inline elements MUST share one horizontal center line by default; use `items-center` and consistent row alignment.
- Pure symbol/logo controls are the only exception to equal height, but they must remain vertically centered with the row.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Skill 使用报告

- 仅当本次实际使用了非 Codex 内置 skill 时，在最终回答末尾添加：`使用的 Skill：\`skill-name\``。
- 如果使用多个 skill，用顿号分隔。
- 如果没有使用 skill，或只使用 Codex 内置能力，则不要添加 Skill 报告。
- 只报告实际加载并影响结果的 skill，不报告候选、推测或未加载的 skill。
- Skill 报告保持简短，不解释安装路径和内部执行过程。
