import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as icons from 'lucide-react';

const root = process.cwd();
const map = JSON.parse(await readFile(resolve(root, 'components/ui/line-icons/icon-map.json'), 'utf8'));
const output = resolve(root, 'public/icons/line');
const names = [...new Set(Object.values(map.symbols).flatMap((group) => Object.values(group)))].sort();
const filename = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() + '.svg';
await mkdir(output, { recursive: true });
for (const name of names) {
  const Icon = icons[name];
  if (!Icon) throw new Error('Missing Lucide icon: ' + name);
  const svg = renderToStaticMarkup(createElement(Icon, {
    size: map.size,
    color: map.staticColor,
    strokeWidth: map.strokeWidth,
    'aria-hidden': true,
  }));
  await writeFile(resolve(output, filename(name)), svg + '\n');
}
const symbols = Object.fromEntries(Object.entries(map.symbols).map(([source, group]) => [
  source,
  Object.fromEntries(Object.entries(group).map(([legacy, name]) => [legacy, filename(name)])),
]));
await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
  source: map.source,
  size: map.size,
  strokeWidth: map.strokeWidth,
  color: map.staticColor,
  symbols,
}, null, 2) + '\n');
await writeFile(resolve(output, 'LICENSE'), await readFile(resolve(root, 'node_modules/lucide-react/LICENSE'), 'utf8'));
console.log('Exported ' + names.length + ' line SVG icons to public/icons/line.');
