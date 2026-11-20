# 项目无用代码清理审查

日期：2026-11-15

## 已完成

审查覆盖应用路由、组件、库、脚本、测试、独立 MCP 服务、直接依赖及公共资源引用。使用 TypeScript 解析模块依赖，并人工核对动态加载、声明文件对应实现、CSS 导入、路径别名及独立入口；未将自动扫描结果直接作为删除清单。

删除 27 个源码或样式文件、38 个静态资源，共 65 个文件；删除源码和样式 8,958 行，文件合计 9,150,920 字节。此大小为仓库文件体积，不能直接视作首屏传输或包体积降幅。

- `delete:` 移除无入口的旧登录动画、轮播、WebGL、鼠标效果及关联字体、图片。现有登录和注册表单保留。
- `delete:` 移除只服务旧登录图库的 `components/OrbitImages.jsx` 和样式。
- `delete:` 移除无人调用的 `lib/consumer-advisor/consumer-product.ts`。
- `delete:` 移除未引用的 Next.js 初始 SVG 与 `public/logo_orb.png`。
- `shrink:` 登录表单和四处组件统一使用 `lib/utils.ts`，移除重复工具和 `cn` 包。
- `delete:` 移除八个无运行用途的直接依赖，并同步 npm 锁文件：`@gsap/react`、`gsap`、`ogl`、`class-variance-authority`、`@phosphor-icons/react`、`@hugeicons/react`、`@hugeicons/core-free-icons`、`cn`。图标继续使用已配置的本地实现。

## 保留的内容

- `SwipeRow.jsx`：工作台实际使用，TypeScript 经声明文件解析时会漏掉实现文件。
- `search-benchmark-cases.ts`：被搜索基准脚本动态加载。
- `shadcn`：全局 CSS 仍导入其样式，并非无用依赖。
- 数据库迁移、测试、Skill 包、公开接口和历史文档：保留其功能、追溯或部署用途，未因缺少静态 import 删除。
- 明确标为本地暂存的 `src/local-pages`、交付资料和运行中的构建缓存：未删除。

## 验证

- 全量 Vitest：57 个文件、396 项测试通过。
- TypeScript：`npx tsc --noEmit` 通过。
- 修改的六个在用组件 ESLint：0 错误，工作台原有 `set-state-in-effect` 警告 1 条。
- 手机 390px、桌面 1108px：注册邀请进入个人助手，连续两轮保留 Skill，未误入购物偏好问卷，浏览器无运行错误。AI 返回由测试拦截模拟，不代表真实模型或云端写入验证。
- `git diff --check` 通过。
- 未运行生产构建、部署或云端迁移；本次没有审计所有函数内部的死分支，也没有将未验证用途的资源或接口强行删除。

## 删除清单

- `components/OrbitImages.css`
- `components/OrbitImages.jsx`
- `components/login-package/components/AuthModal.tsx`
- `components/login-package/components/BleibtGooeySection.tsx`
- `components/login-package/components/FlexCarousel.css`
- `components/login-package/components/FlexCarousel.tsx`
- `components/login-package/components/LiquidCanvasBackground.tsx`
- `components/login-package/components/Navbar.tsx`
- `components/login-package/components/RippleDistortion/RippleDistortion.css`
- `components/login-package/components/RippleDistortion/RippleDistortion.tsx`
- `components/login-package/components/RippleDistortion/metaballContour.ts`
- `components/login-package/components/RippleDistortion/sharedRippleGpu.ts`
- `components/login-package/components/RippleDistortionHero.tsx`
- `components/login-package/components/Shuffle.css`
- `components/login-package/components/Shuffle.d.ts`
- `components/login-package/components/Shuffle.jsx`
- `components/login-package/components/Skiper30.tsx`
- `components/login-package/components/StaggeredMenu.css`
- `components/login-package/components/StaggeredMenu.tsx`
- `components/login-package/components/TextCursor.css`
- `components/login-package/components/TextCursor.tsx`
- `components/login-package/components/WarpText.css`
- `components/login-package/components/WarpText.tsx`
- `components/login-package/hooks/usePageTheme.ts`
- `components/login-package/login-package.css`
- `lib/consumer-advisor/consumer-product.ts`
- `components/login-package/lib/utils.ts`
- `public/login-package/images/pexels-ebahir-32106612.webp`
- `public/login-package/images/pexels-faisal-shabir-2164409984-39884329.webp`
- `public/login-package/images/pexels-trunggubydal-426012394-15389465.webp`
- `public/login-package/images/pexels-bitugbaa-35905494.webp`
- `public/login-package/images/212.webp`
- `public/login-package/images/four.webp`
- `public/login-package/images/pexels-rahimegul-33612622.webp`
- `public/login-package/images/two.webp`
- `public/login-package/images/pexels-bynamnamnam-43716305-33676036.webp`
- `public/login-package/images/one.webp`
- `public/login-package/images/pexels-92377587-31379973.webp`
- `public/login-package/images/three.webp`
- `public/login-package/images/pexels-madzery-39218180.webp`
- `public/login-package/images/pexels-arteeem-1887920.webp`
- `public/login-package/images/pexels-hoang-ti-n-anh-2149671659-36894753.webp`
- `public/login-package/images/pexels-mallonymedia-4903651.webp`
- `public/login-package/images/pexels-shakir1317-34619706.webp`
- `public/login-package/images/pexels-thanh-long-bui-483143920-35170919.webp`
- `public/login-package/images/pexels-mathilde-11843706.webp`
- `public/login-package/images/pexels-limonovdigital-8797181.webp`
- `public/login-package/fonts/editorial-page2-regular.woff2`
- `public/login-package/fonts/lemi-jian-zhuan.ttf`
- `public/login-package/fonts/editorial-page2-bold.woff2`
- `public/login-package/fonts/xiangcui-OFL-1.1.txt`
- `public/login-package/fonts/OFL.txt`
- `public/login-package/fonts/editorial-page2-light.woff2`
- `public/login-package/fonts/xiangcui-jixuesong.ttf`
- `public/login-package/assets/images/art_liquid_portrait_1792422213678.jpg`
- `public/login-package/assets/images/art_liquid_classical_1792422198989.jpg`
- `public/login-package/assets/images/art_liquid_monet_1792422227626.jpg`
- `public/login-package/assets/images/art_liquid_bust_1792422241406.jpg`
- `public/login-package/assets/aistudio/The_City_Rises_by_Umberto_Boccioni_1910_c08f466e.webp`
- `public/file.svg`
- `public/globe.svg`
- `public/next.svg`
- `public/vercel.svg`
- `public/window.svg`
- `public/logo_orb.png`

删除前文件备份：`/private/tmp/omnilink-cleanup-20261115`。备份位于系统临时目录，不作为长期归档。

net: -8,958 source/style lines, -8 direct deps.
