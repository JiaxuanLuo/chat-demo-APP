import { create } from 'zustand'
import { getActiveModel, getActiveProvider } from '../../services/settings.js'

/** 设置弹窗的分组：通用设置 / API 与模型 / 数据管理 */
export type SettingsSection = 'general' | 'api' | 'data'

/** 设置弹窗：侧边栏底部、没有 API Key 时的操作与 401 提示都可以打开；section 为打开时选中的分组 */
export const useSettingsDialog = create(() => ({
  open: false,
  section: 'general' as SettingsSection,
}))

export const openSettings = (section: SettingsSection) =>
  useSettingsDialog.setState({ open: true, section })

export const closeSettings = () => useSettingsDialog.setState({ open: false })

/** 没有可用的 API 平台或模型时打开设置并选中「API 与模型」，返回是否已配置 */
export const ensureApiKey = () => {
  const provider = getActiveProvider()
  if (provider?.apiKey && getActiveModel(provider)) {
    return true
  }
  openSettings('api')
  return false
}
