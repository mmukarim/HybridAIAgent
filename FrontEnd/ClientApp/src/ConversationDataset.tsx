import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, ApiError } from './api/client'
import type { Conversation } from './api/schemas'

type Props = {
  conversation: Conversation
  busy: boolean
  onChange: (fileId: string | null) => void
}

function DatasetName({ fileId, conversationId }: { fileId: string; conversationId: string }) {
  const queryClient = useQueryClient()
  const file = useQuery({
    queryKey: ['file', fileId],
    queryFn: async ({ signal }) => {
      const result = await api.getFile(fileId, signal)
      if (result.id !== fileId) throw new ApiError('The backend returned a different file ID.', 'invalid-response')
      return result
    },
    retry: false,
  })

  function retry() {
    void file.refetch()
    void queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
  }

  return (
    <>
      {file.isPending && <p className="dataset-context-name" role="status">Loading dataset details...</p>}
      {file.data && <p className="dataset-context-name">{file.isError ? 'Last known file: ' : ''}{file.data.original_filename}</p>}
      {file.isError && (
        <div className="dataset-lookup-error" role="alert">
          <span>
            {file.error instanceof ApiError && file.error.status === 404
              ? 'The associated file may have been deleted.'
              : `Could not load dataset details. ${file.error.message}`}
          </span>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      )}
      <p className="dataset-context-id">File ID: {fileId}</p>
    </>
  )
}

export function ConversationDataset({ conversation, busy, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const contextRef = useRef<HTMLElement>(null)
  const files = useQuery({
    queryKey: ['files'],
    queryFn: ({ signal }) => api.listFiles(signal),
    enabled: pickerOpen,
    retry: false,
  })
  const candidates = files.data?.files.filter((file) => file.id !== conversation.dataset_id)

  function choose(fileId: string) {
    if (busy) return
    contextRef.current?.focus()
    setPickerOpen(false)
    onChange(fileId)
  }

  return (
    <section className="dataset-context" aria-label="Conversation dataset" tabIndex={-1} ref={contextRef}>
      <div className="dataset-context-heading">
        <div>
          <p className="eyebrow">CONVERSATION DATASET</p>
          {conversation.dataset_id
            ? <DatasetName fileId={conversation.dataset_id} conversationId={conversation.id} />
            : <p className="dataset-context-name">No dataset attached</p>}
        </div>
        <div className="dataset-context-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={busy}
            aria-expanded={pickerOpen}
            aria-controls={pickerOpen ? 'dataset-picker' : undefined}
            onClick={() => setPickerOpen(!pickerOpen)}
          >
            {pickerOpen ? 'Close selection' : conversation.dataset_id ? 'Replace dataset' : 'Attach dataset'}
          </button>
          {conversation.dataset_id && (
            <button className="secondary-button" type="button" disabled={busy} onClick={() => { contextRef.current?.focus(); onChange(null) }}>
              Remove dataset
            </button>
          )}
        </div>
      </div>
      {pickerOpen && (
        <div id="dataset-picker" className="dataset-picker">
          <p>Select an uploaded file. Loading metadata is optional and separate from association.</p>
          {files.isPending && <p role="status">Loading files...</p>}
          {files.isError && (
            <div className="dataset-lookup-error" role="alert">
              <span>Could not load files. {files.error.message}</span>
              <button type="button" onClick={() => void files.refetch()}>Retry</button>
            </div>
          )}
          {candidates && !files.isError && (
            candidates.length === 0
              ? <p>No other uploaded files are available. <Link to="/datasets">Open dataset library</Link></p>
              : <ul>
                  {candidates.map((file) => (
                    <li key={file.id}>
                      <div>
                        <span className="dataset-picker-name">{file.original_filename}</span>
                        <span className="dataset-picker-id">{file.file_size.toLocaleString()} bytes · {file.id}</span>
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={busy}
                        aria-label={`${conversation.dataset_id ? 'Replace with' : 'Attach'} ${file.original_filename} (${file.id})`}
                        onClick={() => choose(file.id)}
                      >
                        {conversation.dataset_id ? 'Replace' : 'Attach'}
                      </button>
                    </li>
                  ))}
                </ul>
          )}
        </div>
      )}
    </section>
  )
}
