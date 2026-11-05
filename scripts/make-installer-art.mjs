// Generates the NSIS installer artwork (build/installerSidebar.bmp and
// build/installerHeader.bmp): an indigo gradient with a branch-flow diagram
// (main -> staging -> three clients). Run: node scripts/make-installer-art.mjs
import { mkdirSync, writeFileSync } from "node:fs"

const SS = 4 // supersampling for smooth edges

function canvas(w, h) {
  return { w, h, px: new Float32Array(w * SS * h * SS * 3) }
}
function set(c, x, y, rgb, a = 1) {
  if (x < 0 || y < 0 || x >= c.w * SS || y >= c.h * SS) return
  const i = (y * c.w * SS + x) * 3
  for (let k = 0; k < 3; k++) c.px[i + k] = c.px[i + k] * (1 - a) + rgb[k] * a
}
function gradient(c, top, bottom, diagonal = false) {
  const W = c.w * SS, H = c.h * SS
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = diagonal ? (x / W + y / H) / 2 : y / H
      set(c, x, y, top.map((v, k) => v + (bottom[k] - v) * t))
    }
}
function glow(c, cx, cy, r, rgb, strength) {
  const W = c.w * SS, H = c.h * SS
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx * SS, y - cy * SS) / (r * SS)
      if (d < 1) set(c, x, y, rgb, strength * (1 - d) ** 2)
    }
}
function circle(c, cx, cy, r, rgb, a = 1) {
  for (let y = Math.floor((cy - r) * SS); y <= (cy + r) * SS; y++)
    for (let x = Math.floor((cx - r) * SS); x <= (cx + r) * SS; x++)
      if (Math.hypot(x - cx * SS, y - cy * SS) <= r * SS) set(c, x, y, rgb, a)
}
function ring(c, cx, cy, r, w, rgb, a = 1) {
  for (let y = Math.floor((cy - r - w) * SS); y <= (cy + r + w) * SS; y++)
    for (let x = Math.floor((cx - r - w) * SS); x <= (cx + r + w) * SS; x++) {
      const d = Math.hypot(x - cx * SS, y - cy * SS) / SS
      if (Math.abs(d - r) <= w / 2) set(c, x, y, rgb, a)
    }
}
// Quadratic-ish S curve from (x0,y0) to (x1,y1), vertical tangents.
function curve(c, x0, y0, x1, y1, w, rgb, a = 1) {
  const steps = 600
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const e = t * t * (3 - 2 * t)
    const x = x0 + (x1 - x0) * e
    const y = y0 + (y1 - y0) * t
    circle(c, x, y, w / 2, rgb, a)
  }
}
function toBmp(c) {
  const { w, h } = c
  const rowSize = Math.ceil((w * 3) / 4) * 4
  const buf = Buffer.alloc(54 + rowSize * h)
  buf.write("BM", 0)
  buf.writeUInt32LE(buf.length, 2)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(w, 18)
  buf.writeInt32LE(h, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(rowSize * h, 34)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0]
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * w * SS + x * SS + sx) * 3
          for (let k = 0; k < 3; k++) acc[k] += c.px[i + k]
        }
      const o = 54 + (h - 1 - y) * rowSize + x * 3
      buf[o] = Math.round(acc[2] / SS / SS) // BMP is BGR, bottom-up
      buf[o + 1] = Math.round(acc[1] / SS / SS)
      buf[o + 2] = Math.round(acc[0] / SS / SS)
    }
  return buf
}

const DEEP = [22, 18, 64]
const INDIGO = [79, 70, 229]
const LIGHT = [199, 210, 254]
const WHITE = [255, 255, 255]
const ACCENT = [52, 211, 153] // success green for synced clients

// Sidebar: 164 x 314 (welcome / finish pages)
{
  const c = canvas(164, 314)
  gradient(c, DEEP, INDIGO)
  glow(c, 82, 70, 120, [129, 140, 248], 0.35)
  glow(c, 30, 300, 90, [167, 139, 250], 0.25)
  // faint grid dots
  for (let y = 10; y < 314; y += 16)
    for (let x = 10; x < 164; x += 16) circle(c, x, y, 0.6, LIGHT, 0.18)

  const main = [82, 74], staging = [82, 150]
  const clients = [[36, 238], [82, 238], [128, 238]]
  curve(c, ...main, ...staging, 3, LIGHT, 0.9)
  for (const cl of clients) curve(c, ...staging, ...cl, 3, LIGHT, 0.8)

  ring(c, ...main, 19, 3, LIGHT, 0.35)
  circle(c, ...main, 14, WHITE)
  circle(c, ...main, 7, INDIGO)
  circle(c, ...staging, 11, WHITE)
  circle(c, ...staging, 5, INDIGO)
  for (const cl of clients) {
    circle(c, ...cl, 10, WHITE)
    circle(c, ...cl, 5, ACCENT)
  }
  mkdirSync("build", { recursive: true })
  writeFileSync("build/installerSidebar.bmp", toBmp(c))
  writeFileSync("build/uninstallerSidebar.bmp", toBmp(c))
}

// Header: 150 x 57 (inner pages, top-right)
{
  const c = canvas(150, 57)
  gradient(c, [255, 255, 255], [238, 242, 255], true)
  const main = [40, 28], staging = [78, 28]
  const clients = [[116, 12], [116, 28], [116, 44]]
  const line = [165, 180, 252]
  for (let x = main[0]; x <= staging[0]; x += 0.25) circle(c, x, 28, 1.25, line)
  for (const cl of clients) {
    for (let i = 0; i <= 300; i++) {
      const t = i / 300, e = t * t * (3 - 2 * t)
      circle(c, staging[0] + (cl[0] - staging[0]) * t, staging[1] + (cl[1] - staging[1]) * e, 1.25, line)
    }
  }
  circle(c, ...main, 8, INDIGO)
  circle(c, ...main, 3.5, WHITE)
  circle(c, ...staging, 6, INDIGO)
  circle(c, ...staging, 2.5, WHITE)
  for (const cl of clients) {
    circle(c, ...cl, 5, INDIGO)
    circle(c, ...cl, 2.2, ACCENT)
  }
  writeFileSync("build/installerHeader.bmp", toBmp(c))
}
console.log("Installer artwork written to build/")
