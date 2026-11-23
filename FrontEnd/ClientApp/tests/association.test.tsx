// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { api, ApiError } from '../src/api/client'
import type { Conversation } from '../src/api/schemas'

vi.mock('../src/api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/api/client')>()
  return {
    ...original,
    api: {
      ...original.api,
      health: vi.fn(),
      listConversations: vi.fn(),
      getConversation: vi.fn(),
      getMessageHistory: vi.fn(),
      listFiles: vi.fn(),
      getFile: vi.fn(),
      setConversationDataset: vi.fn(),
      removeConversationDataset: vi.fn(),
      loadDataset: vi.fn(),
      sendFirstMessage: vi.fn(),
    },
  }
})

const firstFile = { id: 'file-1', original_filename: 'sales.csv', content_type: 'text/csv', file_size: 12, created_at: 'date' }
const secondFile = { id: 'file-2', original_filename: 'costs.csv', content_type: null, file_size: 20, created_at: 'date' }
const conversation = { id: 'chat-1', title: 'First chat', dataset_id: null, created_at: 'date', updated_at: 'date' }
const otherConversation = { ...conversation, id: 'chat-2', title: 'Second chat' }

function renderApp(path = '/conversations/chat-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.health).mockResolvedValue({ status: 'healthy', application: 'Hybrid AI Agent' })
  vi.mocked(api.listConversations).mockResolvedValue({ conversations: [conversation, otherConversation], total: 2 })
  vi.mocked(api.getConversation).mockImplementation(async (id) => id === otherConversation.id ? otherConversation : conversation)
  vi.mocked(api.getMessageHistory).mockImplementation(async (id) => ({ conversation_id: id, messages: [], total: 0 }))
  vi.mocked(api.listFiles).mockResolvedValue({ files: [firstFile, secondFile], total: 2 })
  vi.mocked(api.getFile).mockImplementation(async (id) => id === firstFile.id ? firstFile : secondFile)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('conversation datasets', () => {
  it('only enables association after a conversation exists and attaches without loading the file', async () => {
    const user = userEvent.setup()
    renderApp('/')
    expect(screen.queryByRole('button', { name: 'Attach dataset' })).toBeNull()
    expect(screen.getByText(/first message will create it without a dataset/i)).toBeTruthy()
    await user.click(await screen.findByRole('link', { name: conversation.title }))
    const context = await screen.findByRole('region', { name: 'Conversation dataset' })
    expect(within(context).getByText('No dataset attached')).toBeTruthy()
    await user.click(within(context).getByRole('button', { name: 'Attach dataset' }))
    vi.mocked(api.setConversationDataset).mockResolvedValue({ ...conversation, dataset_id: firstFile.id })
    await user.click(await within(context).findByRole('button', { name: 'Attach sales.csv (file-1)' }))
    expect(api.setConversationDataset).toHaveBeenCalledWith(conversation.id, firstFile.id)
    expect(document.activeElement).toBe(context)
    expect(await within(context).findByText('sales.csv')).toBeTruthy()
    expect(api.loadDataset).not.toHaveBeenCalled()
    expect(api.sendFirstMessage).not.toHaveBeenCalled()
  })

  it('keeps the previous association while pending and uses confirmed responses for replacement and removal', async () => {
    const attached = { ...conversation, dataset_id: firstFile.id }
    let finish: ((value: typeof attached) => void) | undefined
    vi.mocked(api.getConversation).mockResolvedValue(attached)
    vi.mocked(api.setConversationDataset).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    vi.mocked(api.removeConversationDataset).mockResolvedValue(conversation)
    const user = userEvent.setup()
    renderApp()
    const context = await screen.findByRole('region', { name: 'Conversation dataset' })
    expect(await within(context).findByText('sales.csv')).toBeTruthy()
    await user.click(within(context).getByRole('button', { name: 'Replace dataset' }))
    expect(within(context).queryByRole('button', { name: 'Replace with sales.csv (file-1)' })).toBeNull()
    await user.click(await within(context).findByRole('button', { name: 'Replace with costs.csv (file-2)' }))
    expect(within(context).getByText('sales.csv')).toBeTruthy()
    expect((within(context).getByRole('button', { name: 'Remove dataset' }) as HTMLButtonElement).disabled).toBe(true)
    finish?.({ ...conversation, dataset_id: secondFile.id })
    expect(await within(context).findByText('costs.csv')).toBeTruthy()
    expect((await screen.findByText('Dataset updated for "First chat".')).closest('[role="status"]')).toBeTruthy()
    await user.click(within(context).getByRole('button', { name: 'Remove dataset' }))
    expect(api.removeConversationDataset).toHaveBeenCalledWith(conversation.id)
    expect(await within(context).findByText('No dataset attached')).toBeTruthy()
    expect((await screen.findByText('Dataset removed for "First chat".')).closest('[role="status"]')).toBeTruthy()
  })

  it('surfaces errors and preserves the prior association without claiming success', async () => {
    const attached = { ...conversation, dataset_id: firstFile.id }
    vi.mocked(api.getConversation).mockResolvedValue(attached)
    vi.mocked(api.setConversationDataset).mockRejectedValue(new ApiError('File not found.', 'http', 404))
    const user = userEvent.setup()
    renderApp()
    const context = await screen.findByRole('region', { name: 'Conversation dataset' })
    expect(await within(context).findByText('sales.csv')).toBeTruthy()
    await user.click(within(context).getByRole('button', { name: 'Replace dataset' }))
    await user.click(await within(context).findByRole('button', { name: 'Replace with costs.csv (file-2)' }))
    expect(await screen.findByText(/Could not confirm the dataset change/)).toBeTruthy()
    expect(within(context).getByText('sales.csv')).toBeTruthy()
    expect(within(context).queryByText('costs.csv')).toBeNull()
  })

  it('rejects a response that does not confirm the requested association', async () => {
    vi.mocked(api.setConversationDataset).mockResolvedValue(conversation)
    const user = userEvent.setup()
    renderApp()
    const context = await screen.findByRole('region', { name: 'Conversation dataset' })
    await user.click(within(context).getByRole('button', { name: 'Attach dataset' }))
    await user.click(await within(context).findByRole('button', { name: 'Attach sales.csv (file-1)' }))
    expect(await screen.findByText(/unexpected dataset association/)).toBeTruthy()
    expect(within(context).getByText('No dataset attached')).toBeTruthy()
  })

  it('rejects metadata or conversation details returned for the wrong resource', async () => {
    vi.mocked(api.getConversation).mockResolvedValue({ ...conversation, dataset_id: firstFile.id })
    vi.mocked(api.getFile).mockResolvedValue(secondFile)
    renderApp()
    expect(await screen.findByText(/different file ID/)).toBeTruthy()
    expect(screen.queryByText('costs.csv')).toBeNull()
    cleanup()

    vi.mocked(api.getConversation).mockResolvedValue(otherConversation)
    renderApp()
    expect(await screen.findByText(/different conversation ID/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Conversation dataset' })).toBeNull()
  })

  it('handles missing file metadata without presenting the conversation as unassociated', async () => {
    vi.mocked(api.getConversation).mockResolvedValue({ ...conversation, dataset_id: firstFile.id })
    vi.mocked(api.getFile).mockRejectedValue(new ApiError('File not found.', 'http', 404))
    const user = userEvent.setup()
    renderApp()
    const context = await screen.findByRole('region', { name: 'Conversation dataset' })
    expect(await within(context).findByText('The associated file may have been deleted.')).toBeTruthy()
    expect(within(context).getByText('File ID: file-1')).toBeTruthy()
    expect(within(context).queryByText('No dataset attached')).toBeNull()
    vi.mocked(api.getConversation).mockResolvedValue(conversation)
    await user.click(within(context).getByRole('button', { name: 'Retry' }))
    expect(await within(context).findByText('No dataset attached')).toBeTruthy()
  })

  it('handles empty and failed file lists without implying an association', async () => {
    vi.mocked(api.listFiles).mockRejectedValueOnce(new ApiError('Offline.', 'network')).mockResolvedValueOnce({ files: [], total: 0 })
    const user = userEvent.setup()
    renderApp()
    const context = await screen.findByRole('region', { name: 'Conversation dataset' })
    await user.click(within(context).getByRole('button', { name: 'Attach dataset' }))
    expect(await within(context).findByText(/Could not load files/)).toBeTruthy()
    expect(within(context).queryByText(/No other uploaded files/)).toBeNull()
    await user.click(within(context).getByRole('button', { name: 'Retry' }))
    expect(await within(context).findByText(/No other uploaded files/)).toBeTruthy()
    expect(within(context).getByRole('link', { name: 'Open dataset library' })).toBeTruthy()
  })

  it('updates the correct conversation after navigation and blocks conflicting file deletion', async () => {
    let finish: ((value: Conversation) => void) | undefined
    vi.mocked(api.setConversationDataset).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const user = userEvent.setup()
    const client = renderApp()
    const context = await screen.findByRole('region', { name: 'Conversation dataset' })
    await user.click(within(context).getByRole('button', { name: 'Attach dataset' }))
    await user.click(await within(context).findByRole('button', { name: 'Attach sales.csv (file-1)' }))
    await user.click(screen.getByRole('link', { name: otherConversation.title }))
    expect(await screen.findByRole('heading', { name: otherConversation.title })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Conversation dataset' })).getByText('No dataset attached')).toBeTruthy()
    await user.click(screen.getByRole('link', { name: 'Dataset library' }))
    expect((await screen.findByRole('button', { name: 'Delete sales.csv' }) as HTMLButtonElement).disabled).toBe(true)
    finish?.({ ...conversation, dataset_id: firstFile.id })
    await waitFor(() => expect(client.getQueryData(['conversation', conversation.id])).toMatchObject({ dataset_id: firstFile.id }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Delete sales.csv' }) as HTMLButtonElement).disabled).toBe(false))
    expect(client.getQueryData(['conversation', otherConversation.id])).toMatchObject({ dataset_id: null })
  })
})
