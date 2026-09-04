// PWA 图标生成脚本：深色底 + 薰衣草蓝车轮图形，纯 Node 实现（zlib + 手写 PNG 编码，无第三方依赖）
// 用法：node scripts/generate-icons.mjs，产物输出到 public/icons/
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ===== PNG 编码器（RGBA 8bit，CRC32 + zlib deflate） =====

// CRC32 查表
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// 组装单个 PNG chunk：长度 + 类型 + 数据 + CRC
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

// RGBA 像素缓冲 → PNG 文件缓冲
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // 位深 8bit
  ihdr[9] = 6   // 颜色类型 RGBA
  // 每行扫描线前置 1 字节过滤器类型（0 = None）
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ===== 图形定义：颜色令牌与车轮几何 =====

const BG = [1, 1, 2]          // 画布色 #010102（近黑微蓝）
const BRAND = [94, 106, 210]  // 主色 #5e6ad2（薰衣草蓝）
const INK = [247, 248, 248]   // 主文字色 #f7f8f8（轮毂）

// 判断采样点落在哪个色块：轮毂 / 轮胎环 / 五根辐条 / 背景
function sample(x, y, size, scale) {
  const c = size / 2
  const dx = x - c
  const dy = y - c
  const d = Math.hypot(dx, dy)
  const R = size * 0.30 * scale        // 轮胎外半径
  const r0 = size * 0.205 * scale      // 轮胎内半径
  const hub = size * 0.075 * scale     // 轮毂半径
  const spokeHalf = size * 0.030 * scale // 辐条半宽
  if (d < hub) return INK
  if (d >= r0 && d <= R) return BRAND
  if (d < r0) {
    // 辐条：与最近辐条方向的角差换算为到辐条中线的垂距
    const ang = Math.atan2(dy, dx)
    const step = (Math.PI * 2) / 5
    const diff = Math.abs(ang - Math.round(ang / step) * step)
    if (d * Math.sin(diff) < spokeHalf) return BRAND
  }
  return BG
}

// 逐像素绘制（3x3 超采样抗锯齿）
function drawIcon(size, scale = 1) {
  const rgba = Buffer.alloc(size * size * 4)
  const SS = 3
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const col = sample(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS, size, scale)
          r += col[0]; g += col[1]; b += col[2]
        }
      }
      const n = SS * SS
      const i = (py * size + px) * 4
      rgba[i] = Math.round(r / n)
      rgba[i + 1] = Math.round(g / n)
      rgba[i + 2] = Math.round(b / n)
      rgba[i + 3] = 255 // 全不透明：iOS 苹果图标与 maskable 都要求不透明底
    }
  }
  return encodePNG(size, size, rgba)
}

// ===== 输出四枚图标 =====
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'icon-192.png'), drawIcon(192))
writeFileSync(join(outDir, 'icon-512.png'), drawIcon(512))
// maskable 版本图形整体内缩 20%，保证落在安卓自适应图标安全区内
writeFileSync(join(outDir, 'icon-512-maskable.png'), drawIcon(512, 0.8))
writeFileSync(join(outDir, 'apple-touch-icon.png'), drawIcon(180))
console.log('图标已生成：' + outDir)
