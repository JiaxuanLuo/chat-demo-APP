import {
  ApiError,
  request,
  streamAnthropicEvents,
  streamMessage as streamDeepSeekMessage,
} from '../api/client.js'
import type {
  CreateMessageRequest,
  MessageStreamEvent,
  MessageUsage,
  StopReason,
} from '../api/types.js'
import { readServerSentEvents } from '../api/sse.js'
import { anthropicMessagesUrl, chatCompletionsUrl, modelsUrl } from './presets.js'
import type { Provider, ProviderChatRequest } from './types.js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const numberValue = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

/**
 * GET /models：校验 API Key 并返回平台上的模型列表。
 * 同时兼容 OpenAI 的 `{ data: [...] }`、Anthropic 的 `data` 与少数平台的 `{ models: [...] }`。
 */
export const fetchProviderModels = async (
  provider: Provider,
  signal?: AbortSignal
): Promise<string[]> => {
  const headers: Record<string, string> =
    provider.kind === 'anthropic'
      ? { 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' }
      : { Authorization: `Bearer ${provider.apiKey}` }
  const response = await request(modelsUrl(provider.kind, provider.baseUrl), {
    method: 'GET',
    headers,
    signal,
  })
  const body: unknown = await response.json().catch(() => null)
  const list = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body.data)
      ? body.data
      : isRecord(body) && Array.isArray(body.models)
        ? body.models
        : []
  const models = list
    .map((item) =>
      typeof item === 'string'
        ? item
        : isRecord(item)
          ? (item.id ?? item.name ?? item.model)
          : undefined
    )
    .filter((id): id is string => typeof id === 'string' && id.trim() !== '')
    .map((id) => id.trim())
  return [...new Set(models)]
}

export type DeepSeekStreamBody = CreateMessageRequest

/** DeepSeek 扩展协议：沿用原有请求体与事件格式 */
export const streamDeepSeek = (
  provider: Provider,
  body: DeepSeekStreamBody,
  signal: AbortSignal
): AsyncGenerator<MessageStreamEvent> =>
  streamDeepSeekMessage(provider.baseUrl, provider.apiKey, body, signal)

/** 从 data URL 或纯 base64 中取数据部分 */
const base64Part = (dataUrl: string): string => {
  const comma = dataUrl.indexOf(',')
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1)
}

const mergeTurns = (request: ProviderChatRequest): ProviderChatRequest => {
  const messages: ProviderChatRequest['messages'] = []
  for (const turn of request.messages) {
    const previous = messages.at(-1)
    if (previous?.role === 'user' && turn.role === 'user') {
      // 连续的 user 轮次合并，避免 Anthropic 兼容接口因角色不交替而拒绝请求
      messages[messages.length - 1] = {
        role: 'user',
        text: [previous.text, turn.text].filter(Boolean).join('\n\n'),
        images: [...previous.images, ...turn.images],
      }
    } else if (previous?.role === 'assistant' && turn.role === 'assistant') {
      messages[messages.length - 1] = {
        role: 'assistant',
        text: [previous.text, turn.text].filter(Boolean).join('\n\n'),
      }
    } else if (turn.role === 'assistant' ? turn.text !== '' : turn.text !== '' || turn.images.length > 0) {
      messages.push(turn)
    }
  }
  return { ...request, messages }
}

/** Anthropic 原生 Messages 接口：图片以 base64 内联，不含 DeepSeek 扩展字段 */
export function streamAnthropic(
  provider: Provider,
  chat: ProviderChatRequest,
  signal: AbortSignal
): AsyncGenerator<MessageStreamEvent> {
  const merged = mergeTurns(chat)
  const body = {
    model: merged.model,
    system: merged.system,
    max_tokens: 8192,
    messages: merged.messages.map((turn) =>
      turn.role === 'user'
        ? {
            role: 'user',
            content: [
              ...turn.images.map((image) => ({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: image.mimeType,
                  data: base64Part(image.dataUrl),
                },
              })),
              ...(turn.text ? [{ type: 'text', text: turn.text }] : []),
            ],
          }
        : { role: 'assistant', content: [{ type: 'text', text: turn.text }] }
    ),
  }
  return streamAnthropicEvents(
    anthropicMessagesUrl(provider.baseUrl),
    { 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' },
    body,
    signal
  )
}

type OpenAIChunk = {
  id?: unknown
  model?: unknown
  choices?: unknown
  usage?: unknown
  error?: unknown
}

const readUsage = (value: unknown): MessageUsage | undefined => {
  if (!isRecord(value)) {
    return undefined
  }
  const prompt = numberValue(value.prompt_tokens)
  const completion = numberValue(value.completion_tokens)
  if (prompt === undefined && completion === undefined) {
    return undefined
  }
  const details = isRecord(value.prompt_tokens_details) ? value.prompt_tokens_details : null
  const cached = details ? numberValue(details.cached_tokens) : undefined
  return {
    input_tokens: Math.max(0, (prompt ?? 0) - (cached ?? 0)),
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: cached ?? 0,
    output_tokens: completion ?? 0,
  }
}

const stopReasonOf = (value: unknown): StopReason => {
  switch (value) {
    case 'length':
      return 'max_tokens'
    case 'content_filter':
      return 'refusal'
    case 'tool_calls':
    case 'function_call':
      return 'tool_use'
    default:
      return 'end_turn'
  }
}

const readText = (value: unknown): string => (typeof value === 'string' ? value : '')

const readReasoning = (delta: Record<string, unknown>): string => {
  const value = delta.reasoning_content ?? delta.reasoning
  if (typeof value === 'string') {
    return value
  }
  // 部分平台把推理放在 reasoning.text / reasoning.content
  if (isRecord(value)) {
    return readText(value.text ?? value.content)
  }
  return ''
}

/**
 * OpenAI 兼容的 /chat/completions 流：把 chunk 转换成应用内部的 Anthropic 风格事件，
 * 因而可以复用现有的回复归并、思考展示与错误处理。
 */
export async function* streamOpenAI(
  provider: Provider,
  chat: ProviderChatRequest,
  signal: AbortSignal
): AsyncGenerator<MessageStreamEvent> {
  const merged = mergeTurns(chat)
  const body = {
    model: merged.model,
    messages: [
      { role: 'system', content: merged.system },
      ...merged.messages.map((turn) =>
        turn.role === 'assistant'
          ? { role: 'assistant', content: turn.text }
          : turn.images.length === 0
            ? { role: 'user', content: turn.text }
            : {
                role: 'user',
                content: [
                  ...(turn.text ? [{ type: 'text', text: turn.text }] : []),
                  ...turn.images.map((image) => ({
                    type: 'image_url',
                    image_url: { url: image.dataUrl },
                  })),
                ],
              }
      ),
    ],
    stream: true,
  }
  const response = await request(chatCompletionsUrl(provider.baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal,
  })
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!response.body || !contentType.includes('text/event-stream')) {
    const text = await response.text().catch(() => '')
    throw new ApiError('protocol', text, response.status)
  }

  const messageId = `openai-${Date.now().toString(36)}`
  let nextIndex = 0
  let textIndex: number | null = null
  let thinkingIndex: number | null = null
  let stopReason: StopReason = 'end_turn'
  let usage: MessageUsage | undefined
  let sawChunk = false

  yield { type: 'message_start', message: { id: messageId, model: merged.model } }

  for await (const { data } of readSseData(response.body, signal)) {
    if (data === '[DONE]') {
      break
    }
    let chunk: OpenAIChunk
    try {
      chunk = JSON.parse(data) as OpenAIChunk
    } catch {
      continue
    }
    if (!isRecord(chunk)) {
      continue
    }
    if (isRecord(chunk.error) && typeof chunk.error.message === 'string') {
      throw new ApiError('stream', chunk.error.message)
    }
    sawChunk = true
    if (chunk.usage) {
      usage = readUsage(chunk.usage) ?? usage
    }
    const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : undefined
    if (!isRecord(choice)) {
      continue
    }
    const delta = isRecord(choice.delta) ? choice.delta : {}
    const reasoning = readReasoning(delta)
    if (reasoning) {
      if (textIndex !== null) {
        yield { type: 'content_block_stop', index: textIndex }
        textIndex = null
      }
      if (thinkingIndex === null) {
        thinkingIndex = nextIndex++
        yield {
          type: 'content_block_start',
          index: thinkingIndex,
          content_block: { type: 'thinking', thinking: '', signature: '' },
        }
      }
      yield {
        type: 'content_block_delta',
        index: thinkingIndex,
        delta: { type: 'thinking_delta', thinking: reasoning },
      }
    }
    const text = readText(delta.content)
    if (text) {
      if (thinkingIndex !== null) {
        yield { type: 'content_block_stop', index: thinkingIndex }
        thinkingIndex = null
      }
      if (textIndex === null) {
        textIndex = nextIndex++
        yield {
          type: 'content_block_start',
          index: textIndex,
          content_block: { type: 'text', text: '' },
        }
      }
      yield {
        type: 'content_block_delta',
        index: textIndex,
        delta: { type: 'text_delta', text },
      }
    }
    if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
      stopReason = stopReasonOf(choice.finish_reason)
    }
  }

  if (thinkingIndex !== null) {
    yield { type: 'content_block_stop', index: thinkingIndex }
  }
  if (textIndex !== null) {
    yield { type: 'content_block_stop', index: textIndex }
  }
  if (!sawChunk) {
    throw new ApiError('interrupted', '')
  }
  yield {
    type: 'message_delta',
    delta: { stop_reason: stopReason, stop_sequence: null },
    ...(usage ? { usage } : {}),
  }
  yield { type: 'message_stop' }
}

/** 只取 SSE 的 data 字段；OpenAI 兼容流不区分 event 名 */
async function* readSseData(
  stream: ReadableStream<Uint8Array>,
  signal: AbortSignal
): AsyncGenerator<{ data: string }> {
  for await (const event of readServerSentEvents(stream, signal)) {
    yield { data: event.data }
  }
}
