import { create } from 'zustand'
import type { TtsVoice } from './api/speech.js'
import { normalizeLocation, type UserLocation } from './location.js'
import { createDefaultProvider } from './providers/presets.js'
import { isProviderKind, type Provider } from './providers/types.js'

export type Locale = 'zh-CN' | 'en-US'

/** 主题偏好；默认跟随系统 */
export type ThemePreference = 'light' | 'dark' | 'system'

/**
 * 本机设置，存 localStorage：API 平台与模型、语言、主题、位置、朗读音色、
 * 深度思考与智能搜索开关、侧边栏收起状态
 */
type Settings = {
  /** 用户添加的全部 API 平台 */
  providers: Provider[]
  activeProviderId: string
  /** 每个平台上次选择的模型 */
  selectedModels: Record<string, string>
  locale: Locale
  themePreference: ThemePreference
  location: UserLocation | null
  ttsVoice: TtsVoice
  thinking: boolean
  search: boolean
  siderCollapsed: boolean
}

const KEYS = {
  /** 旧版本只保存一个 DeepSeek API Key，首次启动时迁移到平台列表 */
  legacyApiKey: 'chat-demo:api-key',
  providers: 'chat-demo:providers',
  activeProviderId: 'chat-demo:active-provider',
  selectedModels: 'chat-demo:selected-models',
  locale: 'chat-demo:locale',
  location: 'chat-demo:location',
  themePreference: 'chat-demo:theme-preference',
  ttsVoice: 'chat-demo:tts-voice',
  thinking: 'chat-demo:thinking',
  search: 'chat-demo:search',
  siderCollapsed: 'chat-demo:sider-collapsed',
} as const

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string | null) => {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // 存储不可用时只在内存中生效
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const readModels = (value: unknown): string[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean)
        ),
      ]
    : []

const parseProviders = (raw: string | null): Provider[] => {
  if (!raw) {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    const seen = new Set<string>()
    return parsed.flatMap((item) => {
      if (
        !isRecord(item) ||
        typeof item.id !== 'string' ||
        typeof item.name !== 'string' ||
        !isProviderKind(item.kind) ||
        typeof item.baseUrl !== 'string'
      ) {
        return []
      }
      const id = item.id.trim()
      if (!id || seen.has(id)) {
        return []
      }
      seen.add(id)
      return [
        {
          id,
          name: item.name.trim() || id,
          kind: item.kind,
          baseUrl: item.baseUrl.trim(),
          apiKey: typeof item.apiKey === 'string' ? item.apiKey : '',
          models: readModels(item.models),
        },
      ]
    })
  } catch {
    return []
  }
}

const initialProviders = (): Provider[] => {
  const saved = parseProviders(read(KEYS.providers))
  if (saved.length > 0) {
    return saved
  }
  const legacyKey = read(KEYS.legacyApiKey) ?? ''
  const provider = createDefaultProvider(legacyKey)
  // 迁移完成后删除旧字段，避免下次启动重复创建
  write(KEYS.legacyApiKey, null)
  write(KEYS.providers, JSON.stringify([provider]))
  return [provider]
}

const initialActiveProviderId = (providers: Provider[]): string => {
  const saved = read(KEYS.activeProviderId)
  return providers.some((provider) => provider.id === saved) ? (saved as string) : providers[0].id
}

const initialSelectedModels = (providers: Provider[]): Record<string, string> => {
  const selected: Record<string, string> = {}
  try {
    const parsed: unknown = JSON.parse(read(KEYS.selectedModels) ?? '{}')
    if (isRecord(parsed)) {
      for (const [id, value] of Object.entries(parsed)) {
        if (typeof value === 'string') {
          selected[id] = value
        }
      }
    }
  } catch {
    // 忽略损坏的选择记录
  }
  for (const provider of providers) {
    if (!provider.models.includes(selected[provider.id])) {
      selected[provider.id] = provider.models[0] ?? ''
    }
  }
  return selected
}

/** 位置选择模式跟随浏览器语言，与应用内选择的界面语言无关。 */
export const isChineseBrowser = (): boolean =>
  (typeof navigator === 'undefined' ? 'zh' : navigator.language).toLowerCase().startsWith('zh')

const initialLocale = (): Locale => {
  const saved = read(KEYS.locale)
  if (saved === 'zh-CN' || saved === 'en-US') {
    return saved
  }
  return isChineseBrowser() ? 'zh-CN' : 'en-US'
}

const initialLocation = (): UserLocation | null => {
  try {
    const location = normalizeLocation(JSON.parse(read(KEYS.location) ?? 'null'))
    if (!location) {
      return null
    }
    return isChineseBrowser()
      ? location.region === 'CN' && location.province
        ? location
        : null
      : { region: location.region }
  } catch {
    return null
  }
}

/** 未保存过时跟随系统 */
const initialThemePreference = (): ThemePreference => {
  const saved = read(KEYS.themePreference)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

/** 未保存过时使用服务端默认音色 stella（海星） */
const initialTtsVoice = (): TtsVoice => (read(KEYS.ttsVoice) === 'tide' ? 'tide' : 'stella')

const providers = initialProviders()

export const useSettings = create<Settings>(() => ({
  providers,
  activeProviderId: initialActiveProviderId(providers),
  selectedModels: initialSelectedModels(providers),
  locale: initialLocale(),
  location: initialLocation(),
  themePreference: initialThemePreference(),
  ttsVoice: initialTtsVoice(),
  thinking: read(KEYS.thinking) === 'true',
  search: read(KEYS.search) === 'true',
  siderCollapsed: read(KEYS.siderCollapsed) === 'true',
}))

export const setLocale = (locale: Locale) => {
  write(KEYS.locale, locale)
  useSettings.setState({ locale })
}

export const setLocation = (value: UserLocation | null) => {
  const location = normalizeLocation(value)
  write(KEYS.location, location ? JSON.stringify(location) : null)
  useSettings.setState({ location })
}

export const setThemePreference = (themePreference: ThemePreference) => {
  write(KEYS.themePreference, themePreference)
  useSettings.setState({ themePreference })
}

export const setTtsVoice = (ttsVoice: TtsVoice) => {
  write(KEYS.ttsVoice, ttsVoice)
  useSettings.setState({ ttsVoice })
}

export const setThinking = (thinking: boolean) => {
  write(KEYS.thinking, String(thinking))
  useSettings.setState({ thinking })
}

export const setSearch = (search: boolean) => {
  write(KEYS.search, String(search))
  useSettings.setState({ search })
}

export const setSiderCollapsed = (siderCollapsed: boolean) => {
  write(KEYS.siderCollapsed, String(siderCollapsed))
  useSettings.setState({ siderCollapsed })
}

// ---------- API 平台与模型 ----------

const persistProviders = (next: Provider[]) => {
  write(KEYS.providers, JSON.stringify(next))
  useSettings.setState({ providers: next })
}

const persistSelectedModels = (next: Record<string, string>) => {
  write(KEYS.selectedModels, JSON.stringify(next))
  useSettings.setState({ selectedModels: next })
}

const pickModel = (provider: Provider, selected: Record<string, string>) =>
  provider.models.includes(selected[provider.id]) ? selected[provider.id] : (provider.models[0] ?? '')

/** 当前使用的平台；平台被删除时回退到第一个 */
export const getActiveProvider = (): Provider | null => {
  const { providers: list, activeProviderId } = useSettings.getState()
  return list.find((provider) => provider.id === activeProviderId) ?? list[0] ?? null
}

export const getProvider = (id: string | null | undefined): Provider | null => {
  if (!id) {
    return null
  }
  return useSettings.getState().providers.find((provider) => provider.id === id) ?? null
}

/** 当前选中的模型；平台没有模型时为空串 */
export const getActiveModel = (provider = getActiveProvider()): string => {
  if (!provider) {
    return ''
  }
  return pickModel(provider, useSettings.getState().selectedModels)
}

export const providerForMessage = (providerId: string | null | undefined): Provider | null =>
  providerId ? getProvider(providerId) : getActiveProvider()

export const setActiveProvider = (id: string) => {
  if (!getProvider(id)) {
    return
  }
  write(KEYS.activeProviderId, id)
  useSettings.setState({ activeProviderId: id })
  if (!getActiveModel()) {
    const provider = getProvider(id)
    if (provider?.models[0]) {
      setSelectedModel(id, provider.models[0])
    }
  }
}

export const setSelectedModel = (providerId: string, model: string) => {
  const { selectedModels } = useSettings.getState()
  persistSelectedModels({ ...selectedModels, [providerId]: model })
}

export const addProvider = (input: Omit<Provider, 'id'>): Provider => {
  const provider: Provider = {
    ...input,
    id: `provider-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  }
  persistProviders([...useSettings.getState().providers, provider])
  if (provider.models[0]) {
    setSelectedModel(provider.id, provider.models[0])
  }
  setActiveProvider(provider.id)
  return provider
}

export const updateProvider = (id: string, patch: Omit<Provider, 'id'>) => {
  const { providers: list, selectedModels } = useSettings.getState()
  const next = list.map((provider) => (provider.id === id ? { ...patch, id } : provider))
  persistProviders(next)
  const updated = next.find((provider) => provider.id === id)
  if (updated) {
    persistSelectedModels({
      ...selectedModels,
      [id]: pickModel(updated, selectedModels),
    })
  }
}

/** 删除平台；至少保留一个，返回是否删除成功 */
export const removeProvider = (id: string): boolean => {
  const { providers: list, selectedModels, activeProviderId } = useSettings.getState()
  if (list.length <= 1) {
    return false
  }
  const next = list.filter((provider) => provider.id !== id)
  persistProviders(next)
  persistSelectedModels(
    Object.fromEntries(Object.entries(selectedModels).filter(([key]) => key !== id))
  )
  if (activeProviderId === id) {
    setActiveProvider(next[0].id)
  }
  return true
}
