/**
 * 把已构建的 dist/ 打包成可分发的网页离线包：
 *   release/AI-Chat-Demo-Web-<version>.zip
 *
 * 用法：node scripts/package-web.mjs（先运行 node scripts/build.mjs）
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { zipSync } from 'fflate'

const root = resolve(import.meta.dirname, '..')
const dist = join(root, 'dist')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

if (!existsSync(join(dist, 'index.html'))) {
  console.error('[web] dist/index.html 不存在，请先运行 node scripts/build.mjs。')
  process.exit(1)
}

const files = {}
const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(path)
    } else if (entry.isFile()) {
      const name = relative(dist, path).replaceAll('\\', '/')
      files[name] = new Uint8Array(readFileSync(path))
    }
  }
}
walk(dist)

// level 9：离线包只需要小，构建时间可以接受
const archive = zipSync(files, { level: 9 })
const releaseDir = join(root, 'release')
mkdirSync(releaseDir, { recursive: true })
const target = join(releaseDir, `AI-Chat-Demo-Web-${version}.zip`)
writeFileSync(target, archive)
const size = (statSync(target).size / 1024).toFixed(0)
console.log(`[web] 完成：${target}（${size} KB，${Object.keys(files).length} 个文件）`)
