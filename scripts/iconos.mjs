// Genera los íconos PNG de la app a partir de public/favicon.svg.
// Uso: npm run iconos   (vuelve a correrlo cuando REAP entregue su logo)
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg');
mkdirSync('public/icons', { recursive: true });

await sharp(svg).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(svg).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(svg).resize(180, 180).flatten({ background: '#0F2A44' }).png().toFile('public/icons/apple-touch-icon.png');

// Maskable: fondo completo y el símbolo dentro de la zona segura (80 %)
const interior = await sharp(svg).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0F2A44' } })
  .composite([{ input: interior, top: 56, left: 56 }])
  .png()
  .toFile('public/icons/icon-maskable-512.png');

console.log('Íconos generados en public/icons');
