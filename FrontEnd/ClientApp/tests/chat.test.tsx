// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
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
      sendFirstMessage: vi.fn(),
      sendMessage: vi.fn(),
    },
  }
})

const existing = { id: 'existing', title: 'Saved chat', dataset_id: null, created_at: 'date', updated_at: 'date' }
const created = { ...existing, id: 'created', title: 'First question' }

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

function renderApp(path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true } },
    close: { configurable: true, value() { this.open = false } },
  })
  vi.mocked(api.health).mockResolvedValue({ status: 'healthy', application: 'Hybrid AI Agent' })
  vi.mocked(api.listConversations).mockResolvedValue({ conversations: [existing], total: 1 })
  vi.mocked(api.getConversation).mockImplementation(async (id) => id === created.id ? created : existing)
  vi.mocked(api.getMessageHistory).mockImplementation(async (id) => ({ conversation_id: id, messages: [], total: 0 }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('chat', () => {
  it('creates a conversation on the first message, blocks duplicates, and synchronizes history', async () => {
    let finish: ((value: { conversation_id: string; message: string; response: string }) => void) | undefined
    vi.mocked(api.sendFirstMessage).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const user = userEvent.setup()
    renderApp()
    const input = screen.getByRole('textbox', { name: 'Your message' })
    await user.type(input, 'First question')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    expect(api.sendFirstMessage).toHaveBeenCalledTimes(1)
    expect(api.sendFirstMessage).toHaveBeenCalledWith('First question')
    expect((screen.getByRole('button', { name: 'Send message' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Waiting for the assistant...')).toBeTruthy()
    vi.mocked(api.getMessageHistory).mockResolvedValue({
      conversation_id: created.id,
      messages: [
        { role: 'user', content: 'First question' },
        { role: 'tool', content: 'Calculated result' },
        { role: 'assistant', content: 'Answer' },
      ],
      total: 3,
    })
    finish?.({ conversation_id: created.id, message: 'First question', response: 'Answer' })
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/conversations/created'))
    expect(await screen.findByText('Answer')).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('button', { name: 'View tool results (1)' })).toBeTruthy())
    expect(api.sendMessage).not.toHaveBeenCalled()
  })

  it('renders ordered user and assistant messages with safe Markdown and a tool-results dialog', async () => {
    vi.mocked(api.getMessageHistory).mockResolvedValue({
      conversation_id: existing.id,
      messages: [
        { role: 'user', content: 'Question' },
        { role: 'tool', content: 'tool output' },
        { role: 'assistant', content: '# Result\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n`code`\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))' },
      ],
      total: 3,
    })
    const user = userEvent.setup()
    const { container } = renderApp('/conversations/existing')
    const list = await screen.findByRole('list', { name: 'Message history' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]?.textContent).toContain('Question')
    expect(items[1]?.textContent).toContain('Result')
    expect(within(list).getByRole('heading', { name: 'Result' })).toBeTruthy()
    expect(within(list).getByRole('table')).toBeTruthy()
    expect(within(list).getByText('code').tagName).toBe('CODE')
    expect(container.querySelector('script')).toBeNull()
    expect(within(list).getByText('bad').getAttribute('href')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(within(items[1]!).getByRole('button', { name: 'View tool results (1)' }))
    const dialog = screen.getByRole('dialog', { name: 'Tool results' })
    expect(within(dialog).getByText('tool output')).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(within(items[1]!).getByRole('button', { name: 'View tool results (1)' }))
    within(screen.getByRole('dialog', { name: 'Tool results' })).getByRole('button', { name: 'Close' }).focus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('makes assistant code blocks keyboard focusable for scrolling', async () => {
    vi.mocked(api.getMessageHistory).mockResolvedValue({
      conversation_id: existing.id,
      messages: [{ role: 'assistant', content: '```\nlong code\n```' }],
      total: 1,
    })
    renderApp('/conversations/existing')
    const code = await screen.findByRole('region', { name: 'Code block' })
    expect(code.tagName).toBe('PRE')
    expect(code.getAttribute('tabindex')).toBe('0')
  })

  it('attaches multiple tools to the next assistant and keeps unmatched entries separate', async () => {
    vi.mocked(api.getMessageHistory).mockResolvedValue({
      conversation_id: existing.id,
      messages: [
        { role: 'user', content: 'First question' },
        { role: 'tool', content: 'Unmatched tool' },
        { role: 'user', content: 'Second question' },
        { role: 'tool', content: 'First tool' },
        { role: 'tool', content: 'Second tool' },
        { role: 'assistant', content: 'Second answer' },
        { role: 'tool', content: 'Final unmatched tool' },
        { role: 'other', content: 'Unknown message' },
        { role: 'assistant', content: 'Later answer' },
      ],
      total: 9,
    })
    const user = userEvent.setup()
    renderApp('/conversations/existing')
    const list = await screen.findByRole('list', { name: 'Message history' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items.map((item) => item.querySelector('.message-text, .markdown')?.textContent)).toEqual([
      'First question', 'Second question', 'Second answer', 'Later answer',
    ])
    await user.click(within(items[2]!).getByRole('button', { name: 'View tool results (2)' }))
    let dialog = screen.getByRole('dialog', { name: 'Tool results' })
    expect(within(dialog).getByText('First tool')).toBeTruthy()
    expect(within(dialog).getByText('Second tool')).toBeTruthy()
    expect(within(dialog).queryByText('Unmatched tool')).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(within(items[3]!).queryByRole('button', { name: /tool results/i })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'View other history entries (3)' }))
    dialog = screen.getByRole('dialog', { name: 'Other history entries' })
    expect(within(dialog).getByText('Unmatched tool')).toBeTruthy()
    expect(within(dialog).getByText('Final unmatched tool')).toBeTruthy()
    expect(within(dialog).getByText('Unknown message')).toBeTruthy()
  })

  it('retains the draft on failure and sends subsequent messages to the selected conversation', async () => {
    vi.mocked(api.sendMessage)
      .mockRejectedValueOnce(new ApiError('Connection lost.', 'network'))
      .mockResolvedValueOnce({ conversation_id: existing.id, message: 'Follow up', response: 'Reply' })
    const user = userEvent.setup()
    renderApp('/conversations/existing')
    const input = await screen.findByRole('textbox', { name: 'Your message' }) as HTMLTextAreaElement
    await user.type(input, 'Follow up')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    expect(await screen.findByText(/backend may still have processed/i)).toBeTruthy()
    expect(input.value).toBe('Follow up')
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(2))
    expect(api.sendMessage).toHaveBeenCalledWith(existing.id, 'Follow up')
    expect(api.sendFirstMessage).not.toHaveBeenCalled()
    await waitFor(() => expect(input.value).toBe(''))
  })

  it('shows a retryable history failure without enabling a composer for missing history', async () => {
    vi.mocked(api.getMessageHistory)
      .mockRejectedValueOnce(new ApiError('Offline.', 'network'))
      .mockResolvedValueOnce({ conversation_id: existing.id, messages: [], total: 0 })
    const user = userEvent.setup()
    renderApp('/conversations/existing')
    expect(await screen.findByText(/Could not load message history/)).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Your message' })).toBeNull()
    await user.click(within(screen.getByRole('region', { name: 'Selected conversation' })).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('textbox', { name: 'Your message' })).toBeTruthy()
  })

  it('keeps the successful response visible when history refresh fails', async () => {
    vi.mocked(api.sendFirstMessage).mockResolvedValue({
      conversation_id: created.id, message: 'First question', response: 'Answer',
    })
    vi.mocked(api.getMessageHistory).mockRejectedValue(new ApiError('Offline.', 'network'))
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByRole('textbox', { name: 'Your message' }), 'First question')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    expect(await screen.findByText('Answer')).toBeTruthy()
    expect(await screen.findByText(/Could not load message history/)).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Message history' })).getByText('First question')).toBeTruthy()
  })

  it('does not redirect when a first message completes after navigating elsewhere', async () => {
    let finish: ((value: { conversation_id: string; message: string; response: string }) => void) | undefined
    vi.mocked(api.sendFirstMessage).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByRole('textbox', { name: 'Your message' }), 'First question')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    await user.click(await screen.findByRole('link', { name: existing.title }))
    expect(await screen.findByRole('heading', { name: existing.title })).toBeTruthy()
    finish?.({ conversation_id: created.id, message: 'First question', response: 'Answer' })
    expect(await screen.findByText('Your new conversation is ready.')).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/conversations/existing')
    await user.click(screen.getByRole('link', { name: 'Open conversation' }))
    expect(screen.getByTestId('location').textContent).toBe('/conversations/created')
  })
})
