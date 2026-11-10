# Glasswork vendor files

Local source copied from [kubai087/glasswork](https://github.com/kubai087/glasswork), version `v1.1.0`.

- `lens.js` creates and fits the Chromium SVG rim lens.
- `adapt.js` selects ink and tint density from the sampled backdrop, including WCAG contrast floor.
- `glass.css` defines the material tokens and styles.
- `LICENSE` contains the upstream MIT license.

The consumer UI uses the local files through `LiquidGlass` and `data-glasswork` surfaces. Its adaptive sampler keeps the project's white glass tint, preserves the element's existing corner radius, and uses an opaque material when reduced transparency is enabled. The lens is local, so the app has no npm or runtime CDN dependency.

The optional `refract.js` WebGL renderer is not included. Non-Chromium browsers use the upstream CSS material fallback.
