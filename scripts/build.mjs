import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// 跨平台构建：先清空 dist，再以生产模式运行 rspack
rmSync('dist', { recursive: true, force: true })
const rspack = fileURLToPath(new URL('../node_modules/@rspack/cli/bin/rspack.js', import.meta.url))
const result = spawnSync(process.execPath, [rspack, 'build', '-c', 'rspack.config.ts'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
})
process.exit(result.status ?? 1)
