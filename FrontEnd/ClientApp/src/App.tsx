import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { api, ApiError } from './api/client'
import type { Conversation, MessageHistory } from './api/schemas'
import { BackendStatus } from './BackendStatus'
import { MessageComposer } from './Chat'
import { ConversationView } from './ConversationView'
import { DatasetLibrary } from './DatasetLibrary'

type MessageRequest = {
  conversationId: string | null
  content: string
  draft: string
  locationKey: string
}

type DatasetRequest = {
  conversation: Conversation
  fileId: string | null
}

const draftKey = (conversationId: string | null) => conversationId === null ? 'new' : `conversation:${conversationId}`

function App() {
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [createdInBackground, setCreatedInBackground] = useState<string | null>(null)
  const [fileDeletionPending, setFileDeletionPending] = useState(false)
  const location = useLocation()
  const match = useMatch('/conversations/:conversationId')
  const selectedId = match?.params.conversationId
  const selectedIdRef = useRef(selectedId)
  const mainRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const locationRef = useRef(location)
  const libraryVisited = useRef(false)
  const sendLock = useRef(false)
  const datasetLock = useRef(false)
  selectedIdRef.current = selectedId
  locationRef.current = location
  const isLibrary = location.pathname === '/datasets'
  if (isLibrary) libraryVisited.current = true
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: ({ signal }) => api.listConversations(signal),
    retry: false,
  })
  const deletion = useMutation({
    mutationFn: (conversation: Conversation) => api.deleteConversation(conversation.id),
    onSuccess: async (_result, conversation) => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] })
      queryClient.setQueryData<Awaited<ReturnType<typeof api.listConversations>>>(['conversations'], (current) => {
        if (!current) return current
        const remaining = current.conversations.filter((item) => item.id !== conversation.id)
        return { conversations: remaining, total: remaining.length }
      })
      queryClient.removeQueries({ queryKey: ['conversation', conversation.id] })
      queryClient.removeQueries({ queryKey: ['messages', conversation.id] })
      setDrafts((current) => {
        const next = { ...current }
        delete next[draftKey(conversation.id)]
        return next
      })
      setCreatedInBackground((current) => current === conversation.id ? null : current)
      if (selectedIdRef.current === conversation.id) {
        if (document.activeElement === document.body || mainRef.current?.contains(document.activeElement)) {
          mainRef.current?.focus()
        }
        navigate('/', { replace: true })
      }
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 404) {
        void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      }
    },
  })

  const message = useMutation({
    mutationFn: async (request: MessageRequest) => {
      const response = request.conversationId === null
        ? await api.sendFirstMessage(request.content)
        : await api.sendMessage(request.conversationId, request.content)
      if (request.conversationId !== null && response.conversation_id !== request.conversationId) {
        throw new ApiError('The backend returned a different conversation ID.', 'invalid-response')
      }
      return response
    },
    onSuccess: async (response, request) => {
      const id = response.conversation_id
      await queryClient.cancelQueries({ queryKey: ['messages', id] })
      queryClient.setQueryData<MessageHistory>(['messages', id], (current) => {
        const messages = [
          ...(current?.messages ?? []),
          { role: 'user', content: response.message },
          { role: 'assistant', content: response.response },
        ]
        return { conversation_id: id, messages, total: messages.length }
      })
      setDrafts((current) => {
        const key = draftKey(request.conversationId)
        if (current[key] !== request.draft) return current
        return { ...current, [key]: '' }
      })
      if (request.conversationId === null) {
        if (locationRef.current.pathname === '/' && locationRef.current.key === request.locationKey) {
          navigate(`/conversations/${encodeURIComponent(id)}`)
        } else {
          setCreatedInBackground(id)
        }
      }
      void queryClient.invalidateQueries({ queryKey: ['messages', id] })
      void queryClient.invalidateQueries({ queryKey: ['conversation', id] })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
    onError: (_error, request) => {
      if (request.conversationId !== null) {
        void queryClient.invalidateQueries({ queryKey: ['messages', request.conversationId] })
      }
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
    onSettled: () => { sendLock.current = false },
  })

  const datasetChange = useMutation({
    mutationFn: async ({ conversation, fileId }: DatasetRequest) => {
      const response = fileId === null
        ? await api.removeConversationDataset(conversation.id)
        : await api.setConversationDataset(conversation.id, fileId)
      if (response.id !== conversation.id || response.dataset_id !== fileId) {
        throw new ApiError('The backend returned an unexpected dataset association.', 'invalid-response')
      }
      return response
    },
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['conversation', response.id] }),
        queryClient.cancelQueries({ queryKey: ['conversations'] }),
      ])
      queryClient.setQueryData(['conversation', response.id], response)
      queryClient.setQueryData<Awaited<ReturnType<typeof api.listConversations>>>(['conversations'], (current) => {
        if (!current) return current
        return { ...current, conversations: current.conversations.map((item) => item.id === response.id ? response : item) }
      })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
    onError: (_error, request) => {
      void queryClient.invalidateQueries({ queryKey: ['conversation', request.conversation.id] })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      void queryClient.invalidateQueries({ queryKey: ['files'] })
    },
    onSettled: () => { datasetLock.current = false },
  })

  const activeId = selectedId ?? null
  const draft = drafts[draftKey(activeId)] ?? ''
  const busy = message.isPending || deletion.isPending || fileDeletionPending || datasetChange.isPending
  const waitingHere = message.isPending && message.variables.conversationId === activeId

  function changeDraft(value: string) {
    setDrafts((current) => ({ ...current, [draftKey(activeId)]: value }))
  }

  function sendMessage() {
    if (busy || sendLock.current || datasetLock.current || !draft.trim()) return
    sendLock.current = true
    message.mutate({ conversationId: activeId, content: draft.trim(), draft, locationKey: location.key })
  }

  function deleteConversation(conversation: Conversation) {
    if (busy || datasetLock.current) return
    const confirmed = window.confirm(
      `Delete "${conversation.title}"? This permanently removes the conversation and its saved history.`,
    )
    if (confirmed) deletion.mutate(conversation)
  }

  function changeDataset(conversation: Conversation, fileId: string | null) {
    if (busy || datasetLock.current || sendLock.current) return
    datasetLock.current = true
    datasetChange.mutate({ conversation, fileId })
  }

  function closeNavigation() {
    if (navigationOpen) mainRef.current?.focus()
    setNavigationOpen(false)
  }

  function dismissNavigation(event: KeyboardEvent) {
    if (navigationOpen && event.key === 'Escape') {
      event.preventDefault()
      setNavigationOpen(false)
      menuRef.current?.focus()
    }
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <header className="mobile-header">
        <span className="mobile-brand"><span className="brand-mark" aria-hidden="true">H</span> HybridAgent</span>
        <button
          className="menu-button"
          type="button"
          aria-controls="sidebar"
          aria-expanded={navigationOpen}
          ref={menuRef}
          onKeyDown={dismissNavigation}
          onClick={() => setNavigationOpen(!navigationOpen)}
        >
          {navigationOpen ? 'Close menu' : 'Open menu'}
        </button>
      </header>

      <aside id="sidebar" className={`sidebar${navigationOpen ? ' sidebar-open' : ''}`} onKeyDown={dismissNavigation}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">H</span>
          <div>
            <span className="brand-name">HybridAgent</span>
            <span className="brand-description">Your analysis workspace</span>
          </div>
        </div>

        <div className="sidebar-content">
          <Link className="new-conversation" to="/" onClick={closeNavigation}>
            <span aria-hidden="true">+</span> New conversation
          </Link>

          <nav className="sidebar-section" aria-label="Conversations">
            <p className="section-label">Conversations</p>
            {conversations.isPending && <p className="sidebar-note" role="status">Loading conversations...</p>}
            {conversations.isError && (
              <div className="sidebar-error" role="alert">
                <p>Could not load conversations. {conversations.error.message}</p>
                <button type="button" onClick={() => void conversations.refetch()}>Retry</button>
              </div>
            )}
            {conversations.data && (
              conversations.data.conversations.length === 0 && !conversations.isError
                ? <p className="sidebar-note">No conversations yet.</p>
                : <ul className="conversation-list">
                    {conversations.data.conversations.map((conversation) => (
                      <li key={conversation.id}>
                        <Link
                          className="conversation-link"
                          to={`/conversations/${encodeURIComponent(conversation.id)}`}
                          aria-current={selectedId === conversation.id ? 'page' : undefined}
                          onClick={closeNavigation}
                        >
                          {conversation.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
            )}
          </nav>

          <div className="sidebar-section">
            <p className="section-label">Workspace</p>
            <Link className="library-button" to="/datasets" aria-current={isLibrary ? 'page' : undefined} onClick={closeNavigation}>
              <span className="library-icon" aria-hidden="true">▦</span>
              Dataset library
            </Link>
          </div>
        </div>
      </aside>

      <main id="main-content" className="workspace" tabIndex={-1} ref={mainRef}>
        <div className="workspace-header">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <p className="workspace-title">{selectedId ? 'Conversation' : isLibrary ? 'Datasets' : 'Overview'}</p>
          </div>
          <BackendStatus />
        </div>

        {deletion.isError && (
          <div className="action-error" role="alert">
            <span>Could not delete "{deletion.variables.title}". {deletion.error.message}</span>
            <button type="button" onClick={() => deletion.reset()}>Dismiss</button>
          </div>
        )}

        {message.isError && (
          <div className="action-error" role="alert">
            <span>
              Could not send the message. {message.error.message} Your draft was kept. The backend may still have processed the request; check the conversation list or history before sending again.
            </span>
            <button type="button" onClick={() => message.reset()}>Dismiss</button>
          </div>
        )}

        <div role="status" aria-live="polite" aria-atomic="true">
          {datasetChange.isPending && (
            <div className="action-notice">Updating dataset for "{datasetChange.variables.conversation.title}"...</div>
          )}
          {datasetChange.isSuccess && (
            <div className="action-notice">
              Dataset {datasetChange.variables.fileId === null ? 'removed' : 'updated'} for "{datasetChange.variables.conversation.title}".
            </div>
          )}
        </div>
        {datasetChange.isError && (
          <div className="action-error" role="alert">
            <span>Could not confirm the dataset change for "{datasetChange.variables.conversation.title}". {datasetChange.error.message} The backend may have applied it; check the conversation before retrying.</span>
            <button type="button" onClick={() => datasetChange.reset()}>Dismiss</button>
          </div>
        )}

        {createdInBackground && (
          <div className="action-notice" role="status">
            <span>Your new conversation is ready.</span>
            <Link to={`/conversations/${encodeURIComponent(createdInBackground)}`} onClick={() => setCreatedInBackground(null)}>Open conversation</Link>
            <button type="button" onClick={() => setCreatedInBackground(null)}>Dismiss</button>
          </div>
        )}

        {libraryVisited.current && (
          <div hidden={!isLibrary}>
            <DatasetLibrary
              active={isLibrary}
              conversations={conversations.data?.conversations}
              conversationsUncertain={!conversations.data || conversations.isError || conversations.isFetching}
              messagePending={message.isPending || datasetChange.isPending}
              onDeletePendingChange={setFileDeletionPending}
            />
          </div>
        )}

        {selectedId ? (
          <ConversationView
            key={selectedId}
            id={selectedId}
            deletePending={busy}
            deletingSelected={deletion.isPending && deletion.variables.id === selectedId}
            onDelete={deleteConversation}
            draft={draft}
            onDraftChange={changeDraft}
            onSend={sendMessage}
            busy={busy}
            waitingHere={waitingHere}
            onDatasetChange={changeDataset}
          />
        ) : isLibrary ? null : location.pathname === '/' ? (
          <section className="welcome" aria-labelledby="welcome-title">
            <div className="welcome-icon" aria-hidden="true">✦</div>
            <p className="eyebrow">NEW CONVERSATION</p>
            <h1 id="welcome-title">Make sense of your data.</h1>
            <p className="welcome-description">
              This is a new, unsaved conversation. Your first message will create it without a dataset; you can attach one afterward.
            </p>
            <MessageComposer draft={draft} onChange={changeDraft} onSend={sendMessage} busy={busy} waitingHere={waitingHere} />
          </section>
        ) : (
          <section className="welcome">
            <h1>Page not found</h1>
            <Link to="/">Start a new conversation</Link>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
