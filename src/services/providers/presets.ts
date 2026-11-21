import { DEFAULT_API_ORIGIN } from '../api/config.js'
import type { Provider, ProviderKind } from './types.js'

export type ProviderPreset = {
  id: string
  name: string
  kind: ProviderKind
  baseUrl: string
  models: string[]
}

/** 添加平台时可以一键带出的常用配置；模型名只是占位，可在表单里获取或修改 */
export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'deepseek',
    baseUrl: DEFAULT_API_ORIGIN,
    models: ['deepseek-flash', 'deepseek-v4-pro'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [],
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    kind: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: [],
  },
  {
    id: 'moonshot',
    name: 'Moonshot Kimi',
    kind: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k'],
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    kind: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus'],
  },
  {
    id: 'dashscope',
    name: '阿里云百炼',
    kind: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-20250514'],
  },
  {
    id: 'custom-openai',
    name: '自定义 OpenAI 兼容',
    kind: 'openai',
    baseUrl: 'https://',
    models: [],
  },
  {
    id: 'custom-anthropic',
    name: '自定义 Anthropic 兼容',
    kind: 'anthropic',
    baseUrl: 'https://',
    models: [],
  },
]

/** 默认的 DeepSeek 平台；没有历史设置时作为唯一平台出现 */
export const createDefaultProvider = (apiKey = ''): Provider => {
  const preset = PROVIDER_PRESETS[0]
  return {
    id: 'deepseek',
    name: preset.name,
    kind: preset.kind,
    baseUrl: preset.baseUrl,
    apiKey,
    models: [...preset.models],
  }
}

export const normalizeBaseUrl = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return withScheme.replace(/\/+$/, '')
}

/** 接口地址必须是 http(s) 地址，避免把未填完的 https:// 当作有效配置 */
export const isValidBaseUrl = (value: string): boolean => {
  try {
    const url = new URL(normalizeBaseUrl(value))
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      url.hostname !== '' &&
      !url.pathname.endsWith('//')
    )
  } catch {
    return false
  }
}

/** 只填了域名时补上 OpenAI 常用的 /v1 */
export const openAIBaseUrl = (value: string): string => {
  const base = normalizeBaseUrl(value)
  try {
    const url = new URL(base)
    return url.pathname === '/' || url.pathname === '' ? `${base}/v1` : base
  } catch {
    return base
  }
}

/** Anthropic 兼容接口统一在 /v1 下 */
export const anthropicBaseUrl = (value: string): string => {
  const base = normalizeBaseUrl(value)
  return base.endsWith('/v1') ? base : `${base}/v1`
}

/** DeepSeek 兼容协议挂在 /anthropic/v1 下；用户也可以直接填写这一段 */
export const deepseekBaseUrl = (value: string): string => {
  const base = normalizeBaseUrl(value)
  if (base.endsWith('/anthropic/v1')) {
    return base
  }
  if (base.endsWith('/anthropic')) {
    return `${base}/v1`
  }
  return `${base}/anthropic/v1`
}

/** 去掉 DeepSeek 的 Anthropic 前缀，得到 API 根地址（/models、/v1/tools 都在根下） */
const deepseekOrigin = (value: string): string => {
  const base = normalizeBaseUrl(value)
  return base.replace(/\/anthropic(\/v1)?$/, '')
}

export const chatCompletionsUrl = (value: string): string =>
  `${openAIBaseUrl(value)}/chat/completions`

export const modelsUrl = (kind: ProviderKind, value: string): string => {
  if (kind === 'openai') {
    return `${openAIBaseUrl(value)}/models`
  }
  if (kind === 'anthropic') {
    return `${anthropicBaseUrl(value)}/models`
  }
  return `${deepseekOrigin(value)}/models`
}

export const deepseekMessagesUrl = (value: string): string =>
  `${deepseekBaseUrl(value)}/messages`

export const anthropicMessagesUrl = (value: string): string =>
  `${anthropicBaseUrl(value)}/messages`

export const deepseekFilesUrl = (value: string): string => `${deepseekBaseUrl(value)}/files`

/** DeepSeek 语音接口：ASR 与 TTS */
export const deepseekToolsUrl = (value: string): string => `${deepseekOrigin(value)}/v1/tools`
