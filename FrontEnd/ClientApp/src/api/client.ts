import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import {
  conversationListSchema,
  conversationSchema,
  datasetLoadSchema,
  fileListSchema,
  fileSchema,
  healthSchema,
  messageHistorySchema,
  messageResponseSchema,
} from './schemas'

export type ApiErrorKind = 'configuration' | 'network' | 'timeout' | 'cancelled' | 'http' | 'invalid-response'
type RequestConfig = Omit<AxiosRequestConfig, 'signal'> & { signal?: AbortSignal | undefined }

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function errorDetail(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('detail' in data)) return
  const detail = data.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .filter((item): item is { msg: string } =>
        typeof item === 'object' && item !== null && 'msg' in item && typeof item.msg === 'string',
      )
      .map((item) => item.msg)
    if (messages.length) return messages.join('; ')
  }
}

function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isCancel(error)) return new ApiError('Request cancelled.', 'cancelled')
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError('The request timed out. Please try again.', 'timeout')
    }
    if (error.response) {
      const status = error.response.status
      const detail = status < 500 ? errorDetail(error.response.data) : undefined
      return new ApiError(detail ?? `The server returned an error (${status}).`, 'http', status)
    }
    return new ApiError('Could not reach the backend. Check the connection and try again.', 'network')
  }
  return new ApiError('The request could not be completed.', 'network')
}

function validateBaseUrl(baseUrl: string | undefined): string {
  if (!baseUrl) throw new ApiError('Set VITE_API_BASE_URL to the backend URL.', 'configuration')
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new ApiError('VITE_API_BASE_URL must be an absolute HTTP or HTTPS URL.', 'configuration')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new ApiError('VITE_API_BASE_URL must be an HTTP or HTTPS URL without credentials, query, or fragment.', 'configuration')
  }
  return url.toString().replace(/\/+$/, '')
}

export function createApi(baseUrl: string | undefined) {
  const http = axios.create({ timeout: 120_000, headers: { Accept: 'application/json' } })

  async function send({ signal, ...config }: RequestConfig) {
    try {
      return await http.request<unknown>({
        ...config,
        ...(signal ? { signal } : {}),
        baseURL: validateBaseUrl(baseUrl),
      })
    } catch (error) {
      throw normalizeError(error)
    }
  }

  async function request<T>(schema: z.ZodType<T>, config: RequestConfig): Promise<T> {
    const response = await send(config)
    const result = schema.safeParse(response.data)
    if (!result.success) throw new ApiError('The backend returned an unexpected response.', 'invalid-response', response.status)
    return result.data
  }

  async function remove(config: RequestConfig): Promise<void> {
    const response = await send(config)
    if (response.status !== 204) {
      throw new ApiError('The backend returned an unexpected response.', 'invalid-response', response.status)
    }
  }

  const conversationPath = (id: string) => `/api/v1/conversations/${encodeURIComponent(id)}`
  const filePath = (id: string) => `/api/v1/files/${encodeURIComponent(id)}`

  return {
    health: (signal?: AbortSignal) =>
      request(healthSchema, { url: '/health', signal, timeout: 5_000 }),
    listConversations: (signal?: AbortSignal) =>
      request(conversationListSchema, { url: '/api/v1/conversations', signal }),
    createConversation: (payload: { title?: string; dataset_id?: string | null }, signal?: AbortSignal) =>
      request(conversationSchema, { method: 'post', url: '/api/v1/conversations', data: payload, signal }),
    getConversation: (id: string, signal?: AbortSignal) =>
      request(conversationSchema, { url: conversationPath(id), signal }),
    deleteConversation: (id: string, signal?: AbortSignal) =>
      remove({ method: 'delete', url: conversationPath(id), signal }),
    setConversationDataset: (id: string, fileId: string, signal?: AbortSignal) =>
      request(conversationSchema, { method: 'put', url: `${conversationPath(id)}/dataset`, data: { file_id: fileId }, signal }),
    removeConversationDataset: (id: string, signal?: AbortSignal) =>
      request(conversationSchema, { method: 'delete', url: `${conversationPath(id)}/dataset`, signal }),
    sendFirstMessage: (content: string, signal?: AbortSignal) =>
      request(messageResponseSchema, { method: 'post', url: '/api/v1/messages', data: { content }, signal }),
    sendMessage: (id: string, content: string, signal?: AbortSignal) =>
      request(messageResponseSchema, { method: 'post', url: `${conversationPath(id)}/messages`, data: { content }, signal }),
    getMessageHistory: (id: string, signal?: AbortSignal) =>
      request(messageHistorySchema, { url: `${conversationPath(id)}/messages`, signal }),
    listFiles: (signal?: AbortSignal) =>
      request(fileListSchema, { url: '/api/v1/files', signal }),
    getFile: (id: string, signal?: AbortSignal) =>
      request(fileSchema, { url: filePath(id), signal }),
    uploadFile: (file: File, signal?: AbortSignal) => {
      const data = new FormData()
      data.append('file', file)
      return request(fileSchema, { method: 'post', url: '/api/v1/files', data, signal })
    },
    deleteFile: (id: string, signal?: AbortSignal) =>
      remove({ method: 'delete', url: filePath(id), signal }),
    loadDataset: (id: string, signal?: AbortSignal) =>
      request(datasetLoadSchema, { method: 'post', url: `${filePath(id)}/load`, signal }),
  }
}

export const api = createApi(import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : undefined))
