// Genera los íconos PNG de la app a partir de un SVG simple. Uso: node scripts/make-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1f6feb"/>
  <g fill="#ffffff">
    <rect x="96" y="150" width="320" height="170" rx="36"/>
    <rect x="96" y="250" width="320" height="26" fill="#1f6feb" opacity="0.25"/>
  </g>
  <g fill="#1f6feb">
    <rect x="124" y="176" width="110" height="68" rx="12"/>
    <rect x="278" y="176" width="110" height="68" rx="12"/>
  </g>
  <g fill="#ffffff">
    <circle cx="170" cy="344" r="40"/><circle cx="342" cy="344" r="40"/>
  </g>
  <g fill="#1f6feb">
    <circle cx="170" cy="344" r="16"/><circle cx="342" cy="344" r="16"/>
  </g>
</svg>`

mkdirSync('public', { recursive: true })
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await sharp(Buffer.from(svg(size))).png().toFile(`public/${name}`)
  console.log('ok', name)
}
