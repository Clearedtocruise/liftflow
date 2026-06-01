#!/usr/bin/env node
/**
 * Generate ONE MORE PNG icon assets from SVG (Sprint 8.8).
 * Requires: npm install --no-save @resvg/resvg-js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const svgPath = path.join(root, 'assets/branding/one-more-logo-primary.svg');
const publicSvg = path.join(root, 'public/one-more-mark.svg');

const outputs = [
  { file: 'assets/branding/one-more-icon-1024.png', size: 1024 },
  { file: 'assets/branding/one-more-icon-512.png', size: 512 },
  { file: 'assets/branding/one-more-icon-256.png', size: 256 },
  { file: 'assets/branding/one-more-splash-512.png', size: 512 },
  { file: 'public/favicon-one-more.png', size: 48 },
  { file: 'public/og-one-more.png', size: 1200, pad: true },
];

async function main() {
  const { Resvg } = await import('@resvg/resvg-js');
  const svg = fs.readFileSync(svgPath, 'utf8');
  fs.mkdirSync(path.dirname(publicSvg), { recursive: true });
  fs.copyFileSync(svgPath, publicSvg);

  for (const { file, size, pad } of outputs) {
    const outPath = path.join(root, file);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const renderSize = pad ? Math.round(size * 0.55) : size;
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: renderSize },
      background: '#080B10',
    });
    let png = resvg.render().asPng();
    if (pad && size === 1200) {
      const { default: sharp } = await import('sharp');
      png = await sharp(png)
        .extend({
          top: Math.round((size - renderSize) / 2),
          bottom: Math.round((size - renderSize) / 2),
          left: Math.round((size - renderSize) / 2),
          right: Math.round((size - renderSize) / 2),
          background: '#080B10',
        })
        .png()
        .toBuffer();
    }
    fs.writeFileSync(outPath, png);
    console.log('✓', file);
  }

  // Back-compat: mirror to liftflow-icon paths used by existing config until paths updated
  for (const [src, dest] of [
    ['one-more-icon-1024.png', 'liftflow-icon-1024.png'],
    ['one-more-icon-512.png', 'liftflow-icon-512.png'],
    ['one-more-icon-256.png', 'liftflow-icon-256.png'],
  ]) {
    fs.copyFileSync(path.join(root, 'assets/branding', src), path.join(root, 'assets/branding', dest));
    console.log('✓ mirrored', dest);
  }
}

main().catch((e) => {
  console.error('Icon generation failed:', e.message);
  process.exit(1);
});
