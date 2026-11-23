import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from './api/client'
import type { Conversation } from './api/schemas'
import { MessageHistory } from './Chat'
import { ConversationDataset } from './ConversationDataset'

type Props = {
  id: string
  deletePending: boolean
  deletingSelected: boolean
  onDelete: (conversation: Conversation) => void
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => void
  busy: boolean
  waitingHere: boolean
  onDatasetChange: (conversation: Conversation, fileId: string | null) => void
}

export function ConversationView({ id, deletePending, deletingSelected, onDelete, draft, onDraftChange, onSend, busy, waitingHere, onDatasetChange }: Props) {
  const queryClient = useQueryClient()
  const conversation = useQuery({
    queryKey: ['conversation', id],
    queryFn: async ({ signal }) => {
      const result = await api.getConversation(id, signal)
      if (result.id !== id) throw new ApiError('The backend returned a different conversation ID.', 'invalid-response')
      return result
    },
    retry: false,
  })

  function retry() {
    void conversation.refetch()
    void queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }

  return (
    <section className="conversation-view" aria-label="Selected conversation">
      {conversation.isPending && <p role="status">Loading conversation...</p>}
      {conversation.isError && (
        <div className="action-error" role="alert">
          <span>
            {conversation.error instanceof ApiError && conversation.error.status === 404
              ? 'This conversation may have been deleted.'
              : `Could not load conversation. ${conversation.error.message}`}
          </span>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      )}
      {conversation.data && !conversation.isError && (
        <>
          <div className="conversation-heading">
            <div>
              <p className="eyebrow">SAVED CONVERSATION</p>
              <h1>{conversation.data.title}</h1>
            </div>
            <button
              className="delete-button"
              type="button"
              disabled={deletePending}
              onClick={() => onDelete(conversation.data)}
            >
              {deletingSelected ? 'Deleting...' : 'Delete conversation'}
            </button>
          </div>
          <ConversationDataset conversation={conversation.data} busy={busy} onChange={(fileId) => onDatasetChange(conversation.data, fileId)} />
          <MessageHistory conversationId={id} composer={{ draft, onChange: onDraftChange, onSend, busy, waitingHere }} />
        </>
      )}
    </section>
  )
}
