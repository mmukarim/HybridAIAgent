import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApi } from '../src/api/client'

let server: Server
let baseUrl: string
let handler: (request: IncomingMessage, response: ServerResponse) => void

beforeAll(async () => {
  server = createServer((request, response) => handler(request, response))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server did not start.')
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

describe('API client', () => {
  it('uses the health and list endpoints and validates their responses', async () => {
    handler = (request, response) => {
      if (request.url === '/health') return json(response, 200, { status: 'healthy', application: 'Hybrid AI Agent' })
      if (request.url === '/api/v1/conversations') return json(response, 200, { conversations: [], total: 0 })
      if (request.url === '/api/v1/files') return json(response, 200, { files: [], total: 0 })
      response.writeHead(404).end()
    }
    const api = createApi(baseUrl)
    await expect(api.health()).resolves.toEqual({ status: 'healthy', application: 'Hybrid AI Agent' })
    await expect(api.listConversations()).resolves.toEqual({ conversations: [], total: 0 })
    await expect(api.listFiles()).resolves.toEqual({ files: [], total: 0 })
  })

  it('sends message and dataset association payloads to their actual routes', async () => {
    const requests: { method: string | undefined; url: string | undefined; body: unknown }[] = []
    handler = (request, response) => {
      let body = ''
      request.on('data', (chunk) => { body += chunk })
      request.on('end', () => {
        requests.push({ method: request.method, url: request.url, body: JSON.parse(body) })
        if (request.url === '/api/v1/messages') return json(response, 201, { conversation_id: 'id', message: 'hello', response: 'hi' })
        json(response, 200, { id: 'id', title: 'title', dataset_id: 'file-id', created_at: 'date', updated_at: 'date' })
      })
    }
    const api = createApi(baseUrl)
    await api.sendFirstMessage('hello')
    await api.setConversationDataset('id', 'file-id')
    expect(requests).toEqual([
      { method: 'POST', url: '/api/v1/messages', body: { content: 'hello' } },
      { method: 'PUT', url: '/api/v1/conversations/id/dataset', body: { file_id: 'file-id' } },
    ])
  })

  it('sends multipart uploads under the file field and handles a 204 deletion', async () => {
    let upload = ''
    let contentType = ''
    handler = (request, response) => {
      if (request.method === 'DELETE') {
        expect(request.url).toBe('/api/v1/files/file-id')
        return response.writeHead(204).end()
      }
      contentType = request.headers['content-type'] ?? ''
      request.on('data', (chunk) => { upload += chunk })
      request.on('end', () => json(response, 201, {
        id: 'file-id', original_filename: 'test.csv', content_type: 'text/csv', file_size: 3, created_at: 'date',
      }))
    }
    const api = createApi(baseUrl)
    await api.uploadFile(new File(['a,b'], 'test.csv', { type: 'text/csv' }))
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/)
    expect(upload).toContain('name="file"; filename="test.csv"')
    await expect(api.deleteFile('file-id')).resolves.toBeUndefined()
  })

  it('maps conversation, message history, and dataset operations to their routes', async () => {
    const calls: string[] = []
    const conversation = { id: 'id', title: 'title', dataset_id: null, created_at: 'date', updated_at: 'date' }
    const file = { id: 'file-id', original_filename: 'test.csv', content_type: null, file_size: 3, created_at: 'date' }
    handler = (request, response) => {
      calls.push(`${request.method} ${request.url}`)
      if (request.method === 'DELETE' && request.url === '/api/v1/conversations/id') return response.writeHead(204).end()
      if (request.url === '/api/v1/conversations/id/messages') {
        return json(response, 200, request.method === 'GET'
          ? { conversation_id: 'id', messages: [{ role: 'tool', content: 'result' }], total: 1 }
          : { conversation_id: 'id', message: 'question', response: 'answer' })
      }
      if (request.url === '/api/v1/files/file-id') return json(response, 200, file)
      if (request.url === '/api/v1/files/file-id/load') {
        return json(response, 200, { dataset_id: 'file-id', filename: 'test.csv', rows: 1, columns: 1, column_names: ['x'], file_size: 3 })
      }
      json(response, request.method === 'POST' ? 201 : 200, conversation)
    }
    const api = createApi(baseUrl)
    await api.createConversation({ title: 'title' })
    await api.getConversation('id')
    await api.sendMessage('id', 'question')
    await expect(api.getMessageHistory('id')).resolves.toMatchObject({ messages: [{ role: 'tool', content: 'result' }] })
    await api.removeConversationDataset('id')
    await api.getFile('file-id')
    await api.loadDataset('file-id')
    await api.deleteConversation('id')
    expect(calls).toEqual([
      'POST /api/v1/conversations',
      'GET /api/v1/conversations/id',
      'POST /api/v1/conversations/id/messages',
      'GET /api/v1/conversations/id/messages',
      'DELETE /api/v1/conversations/id/dataset',
      'GET /api/v1/files/file-id',
      'POST /api/v1/files/file-id/load',
      'DELETE /api/v1/conversations/id',
    ])
  })

  it('surfaces HTTP details and validation errors without exposing server errors', async () => {
    handler = (request, response) => {
      if (request.url === '/health') return json(response, 404, { detail: 'Not found.' })
      if (request.url === '/api/v1/files') return json(response, 422, { detail: [{ msg: 'Field required', input: 'private' }] })
      json(response, 500, { detail: 'sensitive internal details' })
    }
    const api = createApi(baseUrl)
    await expect(api.health()).rejects.toMatchObject({ kind: 'http', status: 404, message: 'Not found.' })
    await expect(api.listFiles()).rejects.toMatchObject({ kind: 'http', status: 422, message: 'Field required' })
    await expect(api.listConversations()).rejects.toMatchObject({ kind: 'http', status: 500, message: 'The server returned an error (500).' })
  })

  it('rejects malformed success responses and unexpected delete status', async () => {
    handler = (request, response) => {
      if (request.method === 'DELETE') return json(response, 200, { deleted: true })
      json(response, 200, { files: null, total: 0 })
    }
    const api = createApi(baseUrl)
    await expect(api.listFiles()).rejects.toMatchObject({ kind: 'invalid-response' })
    await expect(api.deleteFile('id')).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('reports configuration, cancellation, and network failures distinctly', async () => {
    await expect(createApi(undefined).health()).rejects.toMatchObject({ kind: 'configuration' })
    await expect(createApi('https://user:password@example.com').health()).rejects.toMatchObject({ kind: 'configuration' })
    const controller = new AbortController()
    controller.abort()
    await expect(createApi(baseUrl).health(controller.signal)).rejects.toMatchObject({ kind: 'cancelled' })
    await expect(createApi('http://127.0.0.1:1').health()).rejects.toMatchObject({ kind: 'network' })
  })

  it('reports a health request timeout', async () => {
    handler = (request, response) => { request.on('close', () => response.destroy()) }
    await expect(createApi(baseUrl).health()).rejects.toMatchObject({ kind: 'timeout' })
  }, 8_000)
})
