// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { api, ApiError } from '../src/api/client'

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
      sendMessage: vi.fn(),
      listFiles: vi.fn(),
      getFile: vi.fn(),
      uploadFile: vi.fn(),
      loadDataset: vi.fn(),
      deleteFile: vi.fn(),
      setConversationDataset: vi.fn(),
    },
  }
})

const file = { id: 'file-id', original_filename: 'sales.csv', content_type: 'text/csv', file_size: 12, created_at: '2026-01-01T00:00:00Z' }
const conversation = { id: 'conversation-id', title: 'Saved chat', dataset_id: file.id, created_at: 'date', updated_at: 'date' }
const dataset = { dataset_id: file.id, filename: file.original_filename, rows: 10, columns: 2, column_names: ['item', 'sales'], file_size: 12 }

function renderApp(path = '/datasets') {
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
  vi.mocked(api.listConversations).mockResolvedValue({ conversations: [conversation], total: 1 })
  vi.mocked(api.getConversation).mockResolvedValue(conversation)
  vi.mocked(api.getMessageHistory).mockResolvedValue({ conversation_id: conversation.id, messages: [], total: 0 })
  vi.mocked(api.listFiles).mockResolvedValue({ files: [file], total: 1 })
  vi.mocked(api.getFile).mockResolvedValue(file)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('dataset library', () => {
  it('distinguishes a failed file list from an empty one and supports retry', async () => {
    vi.mocked(api.listFiles).mockRejectedValueOnce(new ApiError('Offline.', 'network')).mockResolvedValueOnce({ files: [], total: 0 })
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByText(/Could not load files/)).toBeTruthy()
    expect(screen.queryByText('No files uploaded yet.')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No files uploaded yet.')).toBeTruthy()
  })

  it('validates uploads, retains the selection after failure, and uploads without associating', async () => {
    vi.mocked(api.listFiles).mockResolvedValue({ files: [], total: 0 })
    vi.mocked(api.uploadFile).mockRejectedValueOnce(new ApiError('File exceeds the maximum upload size.', 'http', 400)).mockResolvedValueOnce(file)
    const user = userEvent.setup({ applyAccept: false })
    renderApp()
    const input = screen.getByLabelText('Choose a file')
    await user.upload(input, new File(['x'], 'bad.txt'))
    expect(screen.getByText('Choose a CSV, XLSX, or XLS file.')).toBeTruthy()
    expect(api.uploadFile).not.toHaveBeenCalled()
    const selected = new File(['x,y'], 'sales.CSV', { type: 'text/csv' })
    await user.upload(input, selected)
    await user.click(screen.getByRole('button', { name: 'Upload file' }))
    expect(await screen.findByText(/File exceeds the maximum upload size/)).toBeTruthy()
    expect(screen.getByText(/Selected: sales.CSV/)).toBeTruthy()
    expect(api.uploadFile).toHaveBeenCalledWith(selected)
    vi.mocked(api.listFiles).mockResolvedValue({ files: [file], total: 1 })
    await user.click(screen.getByRole('button', { name: 'Upload file' }))
    expect(await screen.findByText('Uploaded sales.csv.')).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'sales.csv' })).toBeTruthy()
    expect(screen.queryByText(/Selected: sales.CSV/)).toBeNull()
    expect(api.loadDataset).not.toHaveBeenCalled()
    expect(api.setConversationDataset).not.toHaveBeenCalled()
  })

  it('accepts a supported dropped file and rejects multiple files', async () => {
    renderApp()
    const dropzone = screen.getByLabelText('Choose a file').parentElement!
    const dropped = new File(['x'], 'workbook.XLSX')
    fireEvent.drop(dropzone, { dataTransfer: { files: { length: 1, item: () => dropped } } })
    expect(screen.getByText(/Selected: workbook.XLSX/)).toBeTruthy()
    fireEvent.drop(dropzone, { dataTransfer: { files: { length: 2, item: () => dropped } } })
    expect(screen.getByText('Choose exactly one file.')).toBeTruthy()
    expect(screen.queryByText(/Selected: workbook.XLSX/)).toBeNull()
  })

  it('loads transient metadata explicitly and surfaces failures without claiming a new result', async () => {
    vi.mocked(api.loadDataset).mockResolvedValueOnce(dataset).mockRejectedValueOnce(new ApiError('Parse failed.', 'http', 500))
    const user = userEvent.setup()
    renderApp()
    const button = await screen.findByRole('button', { name: 'Load metadata for sales.csv' })
    await user.click(button)
    expect(await screen.findByText('Latest load result (this session)')).toBeTruthy()
    expect(screen.getByText('10 rows · 2 columns')).toBeTruthy()
    expect(screen.getByText('Columns: item, sales')).toBeTruthy()
    await user.click(button)
    expect(await screen.findByText(/Parse failed/)).toBeTruthy()
    expect(screen.getByText('Latest load result (this session)')).toBeTruthy()
    expect(api.setConversationDataset).not.toHaveBeenCalled()
  })

  it('rejects load metadata returned for a different file', async () => {
    vi.mocked(api.loadDataset).mockResolvedValue({ ...dataset, dataset_id: 'another-file' })
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Load metadata for sales.csv' }))
    expect(await screen.findByText(/different dataset ID/)).toBeTruthy()
    expect(screen.queryByText('Latest load result (this session)')).toBeNull()
  })

  it('warns about associations, preserves failed deletes, and refreshes conversation data after success', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    vi.mocked(api.deleteFile).mockRejectedValueOnce(new ApiError('Delete failed.', 'http', 500)).mockResolvedValueOnce()
    const user = userEvent.setup()
    const client = renderApp('/conversations/conversation-id')
    expect(await screen.findByRole('heading', { name: 'Saved chat' })).toBeTruthy()
    await user.click(screen.getByRole('link', { name: 'Dataset library' }))
    const button = await screen.findByRole('button', { name: 'Delete sales.csv' })
    await user.click(button)
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('1 currently listed conversation(s)'))
    expect(api.deleteFile).not.toHaveBeenCalled()
    await user.click(button)
    expect(await screen.findByText(/Could not delete/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'sales.csv' })).toBeTruthy()
    vi.mocked(api.listFiles).mockResolvedValue({ files: [], total: 0 })
    vi.mocked(api.listConversations).mockResolvedValue({ conversations: [{ ...conversation, dataset_id: null }], total: 1 })
    vi.mocked(api.getConversation).mockResolvedValue({ ...conversation, dataset_id: null })
    await user.click(button)
    expect(await screen.findByText('No files uploaded yet.')).toBeTruthy()
    expect(client.getQueryState(['conversation', conversation.id])?.isInvalidated).toBe(true)
    await user.click(screen.getByRole('link', { name: 'Saved chat' }))
    await waitFor(() => expect(api.getConversation).toHaveBeenCalledTimes(2))
  })

  it('disables file deletion during a message and blocks sending while file deletion is pending', async () => {
    let finishMessage: ((value: { conversation_id: string; message: string; response: string }) => void) | undefined
    let finishDelete: (() => void) | undefined
    vi.mocked(api.sendMessage).mockImplementation(() => new Promise((resolve) => { finishMessage = resolve }))
    vi.mocked(api.deleteFile).mockImplementation(() => new Promise<void>((resolve) => { finishDelete = resolve }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp('/conversations/conversation-id')
    await user.type(await screen.findByRole('textbox', { name: 'Your message' }), 'Hello')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    await user.click(screen.getByRole('link', { name: 'Dataset library' }))
    expect((await screen.findByRole('button', { name: 'Delete sales.csv' }) as HTMLButtonElement).disabled).toBe(true)
    finishMessage?.({ conversation_id: conversation.id, message: 'Hello', response: 'Hi' })
    await waitFor(() => expect((screen.getByRole('button', { name: 'Delete sales.csv' }) as HTMLButtonElement).disabled).toBe(false))
    await user.click(screen.getByRole('button', { name: 'Delete sales.csv' }))
    await user.click(screen.getByRole('link', { name: 'Saved chat' }))
    const input = await screen.findByRole('textbox', { name: 'Your message' }) as HTMLTextAreaElement
    expect(input.disabled).toBe(true)
    vi.mocked(api.listFiles).mockResolvedValue({ files: [], total: 0 })
    finishDelete?.()
    await waitFor(() => expect(input.disabled).toBe(false))
  })

  it('keeps an in-progress upload and its failure visible after leaving and returning', async () => {
    let fail: ((reason: Error) => void) | undefined
    vi.mocked(api.uploadFile).mockImplementation(() => new Promise((_resolve, reject) => { fail = reject }))
    const user = userEvent.setup()
    renderApp()
    await user.upload(screen.getByLabelText('Choose a file'), new File(['x'], 'test.csv'))
    await user.click(screen.getByRole('button', { name: 'Upload file' }))
    await user.click(screen.getByRole('link', { name: 'New conversation' }))
    fail?.(new ApiError('Upload unavailable.', 'network'))
    await user.click(screen.getByRole('link', { name: 'Dataset library' }))
    expect(await screen.findByText(/Upload unavailable/)).toBeTruthy()
    expect(screen.getByText(/Selected: test.csv/)).toBeTruthy()
  })
})
