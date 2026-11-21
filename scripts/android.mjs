/**
 * 一键构建 Android APK：
 * 1. 构建网页产物 dist/
 * 2. 调用 Gradle wrapper 打包
 * 3. 把 APK 复制到 release/
 *
 * 用法：node scripts/android.mjs [--debug]
 */

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const androidDir = join(root, 'android')
const debug = process.argv.includes('--debug')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options })
  if (result.status !== 0) {
    console.error(`\n[android] 构建失败：${command} ${args.join(' ')}`)
    process.exit(result.status ?? 1)
  }
}

// 1. 网页产物
run(process.execPath, [join(root, 'scripts', 'build.mjs')])

// 2. Gradle wrapper（首次运行需要网络下载 Gradle 和 Android Gradle Plugin）
const task = debug ? 'assembleDebug' : 'assembleRelease'
if (process.platform === 'win32') {
  run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'gradlew.bat', task, '--console=plain'], {
    cwd: androidDir,
  })
} else {
  run('sh', ['gradlew', task, '--console=plain'], { cwd: androidDir })
}

// 3. 输出到 release/
const variant = debug ? 'debug/app-debug.apk' : 'release/app-release.apk'
const apk = join(androidDir, 'app', 'build', 'outputs', 'apk', variant)
if (!existsSync(apk)) {
  console.error(`[android] 未找到 APK：${apk}`)
  process.exit(1)
}
const releaseDir = join(root, 'release')
mkdirSync(releaseDir, { recursive: true })
const name = `AI-Chat-Demo-${version}${debug ? '-debug' : ''}.apk`
const target = join(releaseDir, name)
copyFileSync(apk, target)
const size = (statSync(target).size / 1024 / 1024).toFixed(1)
console.log(`\n[android] 完成：${target}（${size} MB）`)
