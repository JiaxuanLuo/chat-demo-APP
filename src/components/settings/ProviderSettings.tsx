import clsx from 'clsx'
import { useState } from 'react'
import { useTranslate, type TranslationMessage } from '../../i18n/index.js'
import {
  addProvider,
  removeProvider,
  setActiveProvider,
  setSelectedModel,
  updateProvider,
  useSettings,
} from '../../services/settings.js'
import { fetchProviderModels } from '../../services/providers/api.js'
import { PROVIDER_PRESETS, isValidBaseUrl, normalizeBaseUrl } from '../../services/providers/presets.js'
import type { Provider, ProviderKind } from '../../services/providers/types.js'
import { IconEditOutline16, IconLinkOutline16, IconTrashOutline16 } from '../base/icons.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { Modal } from '../base/Modal.js'
import { Select } from '../base/Select.js'
import { showToast } from '../base/toastState.js'
import styles from './Settings.module.css'

const kindKey = (kind: ProviderKind) => {
  switch (kind) {
    case 'deepseek':
      return 'providerKindShortDeepSeek' as const
    case 'openai':
      return 'providerKindShortOpenAI' as const
    case 'anthropic':
      return 'providerKindShortAnthropic' as const
  }
}

/** API 平台与模型：添加、编辑、删除平台，切换当前平台与模型 */
export const ProviderSettings = () => {
  const t = useTranslate()
  const providers = useSettings((state) => state.providers)
  const activeProviderId = useSettings((state) => state.activeProviderId)
  const selectedModels = useSettings((state) => state.selectedModels)
  const [editing, setEditing] = useState<Provider | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Provider | null>(null)

  const remove = (provider: Provider) => {
    if (!removeProvider(provider.id)) {
      showToast({ key: 'providerKeepOne', type: 'error' })
    }
  }

  return (
    <div className={styles.providerSection}>
      <div className={styles.providerIntro}>
        <div className={styles.providerIntroTitle}>{t('settingDialogAsideApiOptionLabel')}</div>
        <div className={styles.description}>{t('providerHint')}</div>
      </div>
      <div className={styles.providerList}>
        {providers.map((provider) => {
          const active = provider.id === activeProviderId
          const model = selectedModels[provider.id] ?? provider.models[0] ?? ''
          return (
            <div
              key={provider.id}
              className={clsx(styles.providerCard, active && styles.providerCardActive)}
            >
              <div className={styles.providerHead}>
                <div className={styles.providerIdentity}>
                  <div className={styles.providerNameRow}>
                    <span className={styles.providerName}>{provider.name}</span>
                    <span className={styles.providerKind}>{t(kindKey(provider.kind))}</span>
                    {active ? <span className={styles.providerBadge}>{t('providerActive')}</span> : null}
                  </div>
                  <div className={styles.providerMeta}>{provider.baseUrl}</div>
                </div>
                <div className={styles.providerActions}>
                  <IconButton
                    icon={<IconEditOutline16 />}
                    tooltip={t('providerEdit')}
                    onClick={() => setEditing(provider)}
                  />
                  <IconButton
                    icon={<IconTrashOutline16 />}
                    tooltip={t('providerDelete')}
                    onClick={() => setDeleting(provider)}
                  />
                </div>
              </div>
              <div className={styles.providerFoot}>
                {active ? (
                  <>
                    <Select
                      className={styles.providerModelSelect}
                      ariaLabel={t('providerCurrentModel')}
                      value={model}
                      placeholder={t('providerCurrentModel')}
                      options={provider.models.map((id) => ({ value: id, label: id }))}
                      onChange={(id) => setSelectedModel(provider.id, id)}
                    />
                    <span className={styles.providerModelHint}>{t('providerModelHint')}</span>
                  </>
                ) : (
                  <Button
                    variant="outlined"
                    size="s"
                    className={styles.providerUse}
                    onClick={() => setActiveProvider(provider.id)}
                  >
                    {t('providerUse')}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className={styles.providerAddRow}>
        <Button variant="outlined" size="m" onClick={() => setEditing('new')}>
          <IconLinkOutline16 />
          {t('providerAdd')}
        </Button>
      </div>
      {editing ? (
        <ProviderForm
          provider={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <Modal
          title={t('providerDelete')}
          className={styles.providerConfirm}
          onClose={() => setDeleting(null)}
          footer={
            <div className={styles.formActions}>
              <Button variant="outlined" autoFocus onClick={() => setDeleting(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  remove(deleting)
                  setDeleting(null)
                }}
              >
                {t('providerDelete')}
              </Button>
            </div>
          }
        >
          {t('providerDeleteConfirm', { name: deleting.name })}
        </Modal>
      ) : null}
    </div>
  )
}

const OPENAI_PRESET = PROVIDER_PRESETS.find((preset) => preset.id === 'openai') ?? PROVIDER_PRESETS[0]

const ProviderForm = ({ provider, onClose }: { provider: Provider | null; onClose: () => void }) => {
  const t = useTranslate()
  const [presetId, setPresetId] = useState(OPENAI_PRESET.id)
  const [name, setName] = useState(provider?.name ?? OPENAI_PRESET.name)
  const [kind, setKind] = useState<ProviderKind>(provider?.kind ?? OPENAI_PRESET.kind)
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? OPENAI_PRESET.baseUrl)
  const [apiKey, setApiKey] = useState(provider?.apiKey ?? '')
  const [models, setModels] = useState((provider?.models ?? OPENAI_PRESET.models).join('\n'))
  const [fetching, setFetching] = useState(false)
  const [status, setStatus] = useState<TranslationMessage | null>(null)
  const [error, setError] = useState<string | null>(null)

  const applyPreset = (id: string) => {
    setPresetId(id)
    const preset = PROVIDER_PRESETS.find((item) => item.id === id)
    if (!preset) {
      return
    }
    setName(preset.name)
    setKind(preset.kind)
    setBaseUrl(preset.baseUrl)
    setModels(preset.models.join('\n'))
    setStatus(null)
  }

  const draft = (requireModels: boolean): Provider | null => {
    const modelIds = [
      ...new Set(
        models
          .split(/[\n,]/)
          .map((item) => item.trim())
          .filter(Boolean)
      ),
    ]
    if (!name.trim() || !isValidBaseUrl(baseUrl) || (requireModels && modelIds.length === 0)) {
      return null
    }
    return {
      id: provider?.id ?? 'draft',
      name: name.trim(),
      kind,
      baseUrl: normalizeBaseUrl(baseUrl),
      apiKey: apiKey.trim(),
      models: modelIds,
    }
  }

  const fetchModels = async () => {
    // 获取模型列表时允许模型输入框为空，拿到列表后再回填
    const target = draft(false)
    if (!target) {
      setError(t('providerRequired'))
      return
    }
    setError(null)
    setFetching(true)
    setStatus(null)
    try {
      const list = await fetchProviderModels(target)
      if (list.length === 0) {
        setStatus({ key: 'providerFetchEmpty' })
      } else {
        setModels(list.join('\n'))
        setStatus({ key: 'providerFetched', params: { count: list.length } })
      }
    } catch (failure) {
      setStatus({
        key: 'providerFetchFailed',
        params: { message: failure instanceof Error ? failure.message : String(failure) },
      })
    } finally {
      setFetching(false)
    }
  }

  const save = () => {
    const target = draft(true)
    if (!target) {
      setError(t('providerRequired'))
      return
    }
    const input = {
      name: target.name,
      kind: target.kind,
      baseUrl: target.baseUrl,
      apiKey: target.apiKey,
      models: target.models,
    }
    if (provider) {
      updateProvider(provider.id, input)
    } else {
      addProvider(input)
    }
    onClose()
  }

  return (
    <Modal
      title={provider ? t('providerEdit') : t('providerAdd')}
      className={styles.providerDialog}
      mainClassName={styles.providerDialogMain}
      closable
      onClose={onClose}
      footer={
        <div className={styles.formActions}>
          <Button variant="outlined" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={save}>{t('providerSave')}</Button>
        </div>
      }
    >
      <div className={styles.form}>
        {provider ? null : (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('providerPreset')}</span>
            <Select
              value={presetId}
              options={PROVIDER_PRESETS.map((preset) => ({
                value: preset.id,
                label: preset.name,
              }))}
              onChange={applyPreset}
            />
          </label>
        )}
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('providerName')}</span>
          <input
            className={styles.input}
            value={name}
            spellCheck={false}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('providerKind')}</span>
          <Select
            value={kind}
            ariaLabel={t('providerKind')}
            options={[
              { value: 'openai', label: t('providerKindOpenAI') },
              { value: 'anthropic', label: t('providerKindAnthropic') },
              { value: 'deepseek', label: t('providerKindDeepSeek') },
            ]}
            onChange={setKind}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('providerBaseUrl')}</span>
          <input
            className={styles.input}
            value={baseUrl}
            spellCheck={false}
            autoComplete="off"
            placeholder={t('providerBaseUrlPlaceholder')}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('providerApiKey')}</span>
          <input
            className={styles.input}
            type="password"
            value={apiKey}
            autoComplete="off"
            spellCheck={false}
            placeholder={t('providerKeyPlaceholder')}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('providerModels')}</span>
          <textarea
            className={styles.textarea}
            value={models}
            rows={4}
            spellCheck={false}
            placeholder={t('providerModelsPlaceholder')}
            onChange={(event) => setModels(event.target.value)}
          />
        </label>
        <div className={styles.formHintRow}>
          <span className={styles.description}>{t('providerModelsHint')}</span>
          <Button
            variant="outlined"
            size="s"
            className={styles.fetchButton}
            disabled={fetching}
            onClick={() => void fetchModels()}
          >
            {t(fetching ? 'providerFetching' : 'providerFetchModels')}
          </Button>
        </div>
        {status ? <div className={styles.description}>{t(status.key, status.params)}</div> : null}
        {error ? <div className={styles.error}>{error}</div> : null}
      </div>
    </Modal>
  )
}
