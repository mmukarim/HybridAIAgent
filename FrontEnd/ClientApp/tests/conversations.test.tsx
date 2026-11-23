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
      deleteConversation: vi.fn(),
      createConversation: vi.fn(),
      sendFirstMessage: vi.fn(),
      sendMessage: vi.fn(),
      getMessageHistory: vi.fn(),
    },
  }
})

const first = { id: 'first', title: 'Recent conversation', dataset_id: null, created_at: 'date', updated_at: 'date' }
const second = { id: 'second', title: 'Older conversation', dataset_id: null, created_at: 'date', updated_at: 'date' }

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
  vi.mocked(api.health).mockResolvedValue({ status: 'healthy', application: 'Hybrid AI Agent' })
  vi.mocked(api.listConversations).mockResolvedValue({ conversations: [first, second], total: 2 })
  vi.mocked(api.getConversation).mockImplementation(async (id) => id === first.id ? first : second)
  vi.mocked(api.getMessageHistory).mockImplementation(async (id) => ({ conversation_id: id, messages: [], total: 0 }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('conversation navigation', () => {
  it('closes the mobile menu with Escape and returns focus to its toggle', async () => {
    const user = userEvent.setup()
    renderApp()
    const menu = screen.getByRole('button', { name: 'Open menu' })
    await user.click(menu)
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    const link = await screen.findByRole('link', { name: first.title })
    link.focus()
    await user.keyboard('{Escape}')
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(menu)
  })

  it('distinguishes an empty list from a failed list and supports retry', async () => {
    vi.mocked(api.listConversations)
      .mockRejectedValueOnce(new ApiError('Offline.', 'network'))
      .mockResolvedValueOnce({ conversations: [], total: 0 })
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByText(/Could not load conversations/)).toBeTruthy()
    expect(screen.queryByText('No conversations yet.')).toBeNull()
    await user.click(within(screen.getByRole('navigation', { name: 'Conversations' })).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No conversations yet.')).toBeTruthy()
  })

  it('preserves server order, opens a deep link, and starts an unsaved draft without an API mutation', async () => {
    const user = userEvent.setup()
    renderApp('/conversations/second')
    const navigation = screen.getByRole('navigation', { name: 'Conversations' })
    const links = await within(navigation).findAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([first.title, second.title])
    expect(links[1]?.getAttribute('aria-current')).toBe('page')
    expect(await screen.findByRole('heading', { name: second.title })).toBeTruthy()
    await user.click(links[0]!)
    expect(await screen.findByRole('heading', { name: first.title })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/conversations/first')
    await user.click(screen.getByRole('link', { name: 'New conversation' }))
    expect(screen.getByTestId('location').textContent).toBe('/')
    expect(screen.getByText(/new, unsaved conversation/i)).toBeTruthy()
    expect(api.createConversation).not.toHaveBeenCalled()
    expect(api.sendFirstMessage).not.toHaveBeenCalled()
  })

  it('shows missing conversations and refreshes the list on retry', async () => {
    vi.mocked(api.getConversation).mockRejectedValue(new ApiError('Conversation not found.', 'http', 404))
    const user = userEvent.setup()
    renderApp('/conversations/missing')
    expect(await screen.findByText('This conversation may have been deleted.')).toBeTruthy()
    await user.click(within(screen.getByRole('region', { name: 'Selected conversation' })).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(api.listConversations).toHaveBeenCalledTimes(2))
  })

  it('requires confirmation, keeps failed deletes visible, and removes only after success', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    vi.mocked(api.deleteConversation).mockRejectedValueOnce(new ApiError('Delete failed.', 'http', 500)).mockResolvedValueOnce()
    const user = userEvent.setup()
    renderApp('/conversations/first')
    const button = await screen.findByRole('button', { name: 'Delete conversation' })
    await user.click(button)
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining(first.title))
    expect(api.deleteConversation).not.toHaveBeenCalled()
    await user.click(button)
    expect(await screen.findByText(/Could not delete/)).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/conversations/first')
    expect(within(screen.getByRole('navigation', { name: 'Conversations' })).getByText(first.title)).toBeTruthy()
    vi.mocked(api.listConversations).mockResolvedValue({ conversations: [second], total: 1 })
    await user.click(button)
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'))
    expect(document.activeElement).toBe(screen.getByRole('main'))
    await waitFor(() => expect(within(screen.getByRole('navigation', { name: 'Conversations' })).queryByText(first.title)).toBeNull())
  })

  it('does not navigate away from another selection when an earlier deletion completes', async () => {
    let finishDelete: (() => void) | undefined
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.deleteConversation).mockImplementation(() => new Promise<void>((resolve) => { finishDelete = resolve }))
    const user = userEvent.setup()
    renderApp('/conversations/first')
    await user.click(await screen.findByRole('button', { name: 'Delete conversation' }))
    await user.click(await screen.findByRole('link', { name: second.title }))
    expect(await screen.findByRole('heading', { name: second.title })).toBeTruthy()
    vi.mocked(api.listConversations).mockResolvedValue({ conversations: [second], total: 1 })
    finishDelete?.()
    await waitFor(() => expect(within(screen.getByRole('navigation', { name: 'Conversations' })).queryByText(first.title)).toBeNull())
    expect(screen.getByTestId('location').textContent).toBe('/conversations/second')
  })
})
