import { resizeUploadImage } from '../../utils/resizeUploadImage.js'
import type { ProviderImage, ProviderTurn } from '../providers/types.js'
import { loadFile } from './db.js'
import { getContextRounds, getReplyText } from './reply.js'
import type { FileAttachment, Message, UserMessage } from './types.js'

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('image read failed'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('image read failed'))
    reader.readAsDataURL(blob)
  })

/**
 * 非 DeepSeek 平台没有 Files API：发送前读取本地原件，缩小后转成 data URL 内联。
 * 只有图片会进入请求；没有本地原件（导入的历史文档等）或读取失败时跳过。
 */
const toImage = async (
  file: FileAttachment,
  blobs: ReadonlyMap<string, Blob> | undefined,
  signal: AbortSignal
): Promise<ProviderImage | null> => {
  if (!file.isImage) {
    return null
  }
  signal.throwIfAborted()
  try {
    const blob = blobs?.get(file.id) ?? (await loadFile(file.id))
    if (!blob) {
      return null
    }
    signal.throwIfAborted()
    const source =
      blob instanceof File
        ? blob
        : new File([blob], file.name, { type: blob.type || file.mimeType || 'image/png' })
    const resized = await resizeUploadImage(source, signal)
    const dataUrl = await blobToDataUrl(resized)
    return { dataUrl, mimeType: resized.type || file.mimeType || 'image/png' }
  } catch (error) {
    if (signal.aborted) {
      throw error
    }
    return null
  }
}

const toUserTurn = async (
  user: UserMessage,
  blobs: ReadonlyMap<string, Blob> | undefined,
  signal: AbortSignal
): Promise<ProviderTurn> => {
  const images: ProviderImage[] = []
  for (const file of user.files) {
    signal.throwIfAborted()
    const image = await toImage(file, blobs, signal)
    if (image) {
      images.push(image)
    }
  }
  return { role: 'user', text: user.content.trim(), images }
}

/**
 * 把会话转换成平台通用的消息列表：只保留有回答的历史轮次，正文取纯文本，
 * 附件只保留图片。续写前缀在其他平台不受支持，不在这里处理。
 */
export const toProviderTurns = async (
  history: Message[],
  question: UserMessage,
  blobs: ReadonlyMap<string, Blob> | undefined,
  signal: AbortSignal
): Promise<ProviderTurn[]> => {
  const turns: ProviderTurn[] = []
  for (const [user, reply] of getContextRounds(history)) {
    turns.push(await toUserTurn(user, blobs, signal))
    turns.push({ role: 'assistant', text: getReplyText(reply).trim() })
  }
  turns.push(await toUserTurn(question, blobs, signal))
  return turns
}
