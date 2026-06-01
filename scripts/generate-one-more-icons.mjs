#!/usr/bin/env node
/**
 * Sprint 8.8.1 — Generate ONE MORE premium asset pack and install everywhere.
 * Requires: @resvg/resvg-js, sharp (dev, installed on demand)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const branding = path.join(root, 'assets/branding');

const SOURCES = {
  appIcon: path.join(branding, 'one-more-logo-primary.svg'),
  splash: path.join(branding, 'one-more-splash-full.svg'),
  og: path.join(branding, 'one-more-og.svg'),
};

/** Every PNG destination for the app icon mark (square, transparent-safe on #080B10). */
const APP_ICON_OUTPUTS = [
  { file: 'assets/branding/one-more-icon-1024.png', size: 1024 },
  { file: 'assets/branding/one-more-icon-512.png', size: 512 },
  { file: 'assets/branding/one-more-icon-256.png', size: 256 },
  { file: 'assets/branding/one-more-icon-192.png', size: 192 },
  { file: 'assets/branding/one-more-icon-128.png', size: 128 },
  { file: 'assets/branding/one-more-splash-512.png', size: 512, source: 'appIcon' },
  { file: 'assets/images/icon.png', size: 1024 },
  { file: 'assets/images/favicon.png', size: 48 },
  { file: 'assets/images/splash-icon.png', size: 512, source: 'splash' },
  { file: 'assets/images/android-icon-foreground.png', size: 1024 },
  { file: 'assets/images/android-icon-monochrome.png', size: 1024 },
  { file: 'public/favicon-one-more.png', size: 48 },
  { file: 'public/favicon.png', size: 48 },
];

const SPLASH_OUTPUTS = [{ file: 'assets/branding/one-more-splash-full-512.png', size: 512, source: 'splash' }];

const OG_OUTPUTS = [{ file: 'public/og-one-more.png', size: 1200, source: 'og', width: 1200, height: 630 }];

const changed = [];

async function renderPng(svgContent, { size, width, height, pad = false }) {
  const { Resvg } = await import('@resvg/resvg-js');
  const renderW = width ?? size;
  const renderH = height ?? size;
  const fit = width && height ? renderW : pad ? Math.round(size * 0.55) : size;
  const resvg = new Resvg(svgContent, {
    fitTo: width && height ? { mode: 'width', value: renderW } : { mode: 'width', value: fit },
    background: '#000000',
  });
  let png = resvg.render().asPng();
  if (pad && !width) {
    const { default: sharp } = await import('sharp');
    png = await sharp(png)
      .extend({
        top: Math.round((size - fit) / 2),
        bottom: Math.round((size - fit) / 2),
        left: Math.round((size - fit) / 2),
        right: Math.round((size - fit) / 2),
        background: '#000000',
      })
      .png()
      .toBuffer();
  }
  if (width && height) {
    const { default: sharp } = await import('sharp');
    png = await sharp(png).resize(width, height, { fit: 'contain', background: '#080B10' }).png().toBuffer();
  }
  return png;
}

async function writeOutput(entry, svgMap) {
  const sourceKey = entry.source ?? 'appIcon';
  const svg = svgMap[sourceKey];
  const outPath = path.join(root, entry.file);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const png = await renderPng(svg, entry);
  fs.writeFileSync(outPath, png);
  changed.push(entry.file);
  console.log('✓', entry.file);
}

async function main() {
  const svgMap = {
    appIcon: fs.readFileSync(SOURCES.appIcon, 'utf8'),
    splash: fs.readFileSync(SOURCES.splash, 'utf8'),
    og: fs.readFileSync(SOURCES.og, 'utf8'),
  };

  fs.copyFileSync(SOURCES.appIcon, path.join(root, 'public/one-more-mark.svg'));

  for (const entry of APP_ICON_OUTPUTS) await writeOutput(entry, svgMap);
  for (const entry of SPLASH_OUTPUTS) await writeOutput(entry, svgMap);
  for (const entry of OG_OUTPUTS) await writeOutput(entry, svgMap);

  // Legacy path aliases — overwrite so nothing can resolve old LF artwork
  const aliases = [
    ['one-more-icon-1024.png', 'liftflow-icon-1024.png'],
    ['one-more-icon-512.png', 'liftflow-icon-512.png'],
    ['one-more-icon-256.png', 'liftflow-icon-256.png'],
    ['one-more-splash-full-512.png', 'one-more-splash-512.png'],
  ];
  for (const [src, dest] of aliases) {
    const from = path.join(branding, src);
    const to = path.join(branding, dest);
    fs.copyFileSync(from, to);
    changed.push(`assets/branding/${dest}`);
    console.log('✓ alias', dest);
  }

  // Replace legacy LF vector sources with ONE MORE mark
  for (const legacy of [
    'liftflow-logo-primary.svg',
    'liftflow-logo-white.svg',
    'liftflow-logo-black.svg',
    'liftflow-logo-gradient.svg',
  ]) {
    const dest = path.join(branding, legacy);
    fs.copyFileSync(SOURCES.appIcon, dest);
    changed.push(`assets/branding/${legacy}`);
    console.log('✓ replaced', legacy);
  }

  fs.writeFileSync(
    path.join(root, 'assets/branding/ASSET_MANIFEST.json'),
    JSON.stringify({ brand: 'ONE MORE', tagline: 'Only One.', generated: new Date().toISOString(), files: changed }, null, 2),
  );
  console.log(`\n${changed.length} assets installed.`);
}

main().catch((e) => {
  console.error('Asset generation failed:', e.message);
  process.exit(1);
});
