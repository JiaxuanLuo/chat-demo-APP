/** 支持的接口类型：DeepSeek 扩展协议、OpenAI 兼容、Anthropic 兼容 */
export type ProviderKind = 'deepseek' | 'openai' | 'anthropic'

/** 一个可用的 API 平台；同一平台下可以配置多个模型 */
export type Provider = {
  id: string
  name: string
  kind: ProviderKind
  /** 用户填写的接口根地址，例如 https://api.openai.com/v1 */
  baseUrl: string
  apiKey: string
  models: string[]
}

/**
 * 不同接口类型支持的能力，界面按能力隐藏入口：
 * - search：服务端联网搜索与阅读链接（DeepSeek 扩展）
 * - files：附件处理方式，server 走 DeepSeek Files API，images 只支持本地图片
 * - speech：语音输入与朗读（DeepSeek 语音接口）
 * - thinking：深度思考开关（DeepSeek 扩展请求字段）
 * - serverTitle：由服务端生成对话标题
 * - prefix：支持以 assistant 前缀续写
 */
export type ProviderCapabilities = {
  search: boolean
  files: 'server' | 'images' | 'none'
  speech: boolean
  thinking: boolean
  serverTitle: boolean
  prefix: boolean
}

const CAPABILITIES: Record<ProviderKind, ProviderCapabilities> = {
  deepseek: {
    search: true,
    files: 'server',
    speech: true,
    thinking: true,
    serverTitle: true,
    prefix: true,
  },
  openai: {
    search: false,
    files: 'images',
    speech: false,
    thinking: false,
    serverTitle: false,
    prefix: false,
  },
  anthropic: {
    search: false,
    files: 'images',
    speech: false,
    thinking: false,
    serverTitle: false,
    prefix: false,
  },
}

export const capabilitiesOf = (kind: ProviderKind): ProviderCapabilities => CAPABILITIES[kind]

export const isProviderKind = (value: unknown): value is ProviderKind =>
  value === 'deepseek' || value === 'openai' || value === 'anthropic'

/** 平台通用的一轮消息：图片以 data URL 内联，不依赖服务端文件 ID */
export type ProviderImage = { dataUrl: string; mimeType: string }

export type ProviderTurn =
  | { role: 'user'; text: string; images: ProviderImage[] }
  | { role: 'assistant'; text: string }

export type ProviderChatRequest = {
  model: string
  system: string
  messages: ProviderTurn[]
}
