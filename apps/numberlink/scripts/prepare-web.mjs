import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// The Expo export is the only published UI: add just the PWA metadata/assets.
const dist = 'dist';
const htmlPath = join(dist, 'index.html');
if (!existsSync(htmlPath)) throw new Error('Expo web export did not produce dist/index.html');
let html = readFileSync(htmlPath, 'utf8');
if (!html.includes('</head>')) throw new Error('Unexpected Expo export: missing </head>');
const metadata = `<link rel="manifest" href="/numberlink/manifest.webmanifest"/><link rel="icon" type="image/svg+xml" href="/numberlink/icon.svg"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-title" content="Numberlink"/>`;
html = html.replace('</head>', `${metadata}</head>`);
writeFileSync(htmlPath, html);
for (const name of ['manifest.webmanifest', 'icon.svg']) copyFileSync(join('public', name), join(dist, name));