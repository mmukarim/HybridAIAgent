import { useQuery } from '@tanstack/react-query'
import { useId, useRef } from 'react'
import type { FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { api } from './api/client'
import type { MessageHistory as HistoryResponse } from './api/schemas'

type ComposerProps = {
  draft: string
  onChange: (value: string) => void
  onSend: () => void
  busy: boolean
  waitingHere: boolean
}

export function MessageComposer({ draft, onChange, onSend, busy, waitingHere }: ComposerProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!busy && draft.trim()) onSend()
  }

  return (
    <form className="composer" onSubmit={submit}>
      <label htmlFor="message-input">Your message</label>
      <textarea
        id="message-input"
        rows={3}
        value={draft}
        onChange={(event) => onChange(event.target.value)}
        disabled={busy}
        placeholder="Ask a question..."
      />
      <div className="composer-footer">
        <span role="status" aria-live="polite">
          {waitingHere ? 'Waiting for the assistant...' : busy ? 'Another request is in progress.' : 'Responses may take a moment.'}
        </span>
        <button type="submit" disabled={busy || !draft.trim()}>Send message</button>
      </div>
    </form>
  )
}

type HistoryProps = {
  conversationId: string
  composer: ComposerProps
}

type HistoryItem = HistoryResponse['messages'][number]
type DisplayMessage = { index: number; role: 'user' | 'assistant'; content: string; tools: HistoryItem[] }

function groupMessages(messages: HistoryItem[]) {
  const visible: DisplayMessage[] = []
  const other: HistoryItem[] = []
  let tools: HistoryItem[] = []

  messages.forEach((message, index) => {
    if (message.role === 'tool') {
      tools.push(message)
    } else if (message.role === 'assistant') {
      visible.push({ index, role: 'assistant', content: message.content, tools })
      tools = []
    } else {
      other.push(...tools)
      tools = []
      if (message.role === 'user') {
        visible.push({ index, role: 'user', content: message.content, tools: [] })
      } else {
        other.push(message)
      }
    }
  })
  other.push(...tools)
  return { visible, other }
}

function HistoryDetails({ entries, other = false }: { entries: HistoryItem[]; other?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const title = other ? 'Other history entries' : 'Tool results'

  return (
    <>
      <button className="tool-results-button" type="button" aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()}>
        View {other ? 'other history entries' : 'tool results'} ({entries.length})
      </button>
      <dialog
        className="history-dialog"
        ref={dialogRef}
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            dialogRef.current?.close()
          }
        }}
      >
        <div className="dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <button type="button" onClick={() => dialogRef.current?.close()}>Close</button>
        </div>
        {other && <p>These entries have no matching assistant response or have an unsupported role.</p>}
        <ol className="history-details">
          {entries.map((entry, index) => (
            <li key={index}>
              <p>{entry.role === 'tool' ? 'Tool result' : `Role: ${entry.role}`}</p>
              <pre>{entry.content}</pre>
            </li>
          ))}
        </ol>
      </dialog>
    </>
  )
}

export function MessageHistory({ conversationId, composer }: HistoryProps) {
  const history = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ signal }) => api.getMessageHistory(conversationId, signal),
    retry: false,
  })
  const grouped = history.data ? groupMessages(history.data.messages) : null

  return (
    <div className="chat">
      {history.isPending && <p className="chat-status" role="status">Loading message history...</p>}
      {history.isError && (
        <div className="action-error" role="alert">
          <span>Could not load message history. {history.error.message}</span>
          <button type="button" onClick={() => void history.refetch()}>Retry</button>
        </div>
      )}
      {history.data && grouped && (
        <>
          {grouped.visible.length === 0
            ? <p className="chat-status">{history.data.messages.length === 0 ? 'No messages in this conversation yet.' : 'No user or assistant messages in this conversation.'}</p>
            : <ol className="message-list" aria-label="Message history">
                {grouped.visible.map((message) => (
                  <li className={`message message-${message.role === 'user' ? 'user' : 'other'}`} key={message.index}>
                    <article className="message-card">
                      <p className="message-role">{message.role === 'user' ? 'You' : 'Assistant'}</p>
                      {message.role === 'assistant' ? (
                        <>
                          <div className="markdown">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeSanitize]}
                              components={{ pre: ({ node: _node, ...props }) => <pre {...props} tabIndex={0} role="region" aria-label="Code block" /> }}
                              skipHtml
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                          {message.tools.length > 0 && <HistoryDetails entries={message.tools} />}
                        </>
                      ) : <p className="message-text">{message.content}</p>}
                    </article>
                  </li>
                ))}
              </ol>}
          {grouped.other.length > 0 && (
            <div className="other-history">
              <p>Some history entries could not be matched to an assistant response.</p>
              <HistoryDetails entries={grouped.other} other />
            </div>
          )}
          {composer.waitingHere && <p className="chat-status" role="status">The assistant is working...</p>}
          <MessageComposer {...composer} />
        </>
      )}
    </div>
  )
}
