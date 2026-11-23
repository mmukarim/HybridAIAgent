import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from './api/client'
import type { Conversation, DatasetLoad, UploadedFile } from './api/schemas'

type Props = {
  active: boolean
  conversations: Conversation[] | undefined
  conversationsUncertain: boolean
  messagePending: boolean
  onDeletePendingChange: (pending: boolean) => void
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export function DatasetLibrary({ active, conversations, conversationsUncertain, messagePending, onDeletePendingChange }: Props) {
  const queryClient = useQueryClient()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectionError, setSelectionError] = useState('')
  const [uploadedName, setUploadedName] = useState('')
  const [loadResults, setLoadResults] = useState<Record<string, DatasetLoad>>({})
  const mutationLock = useRef(false)
  const files = useQuery({
    queryKey: ['files'],
    queryFn: ({ signal }) => api.listFiles(signal),
    enabled: active,
    retry: false,
  })

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadFile(file),
    onSuccess: async (file) => {
      await queryClient.cancelQueries({ queryKey: ['files'] })
      queryClient.setQueryData<Awaited<ReturnType<typeof api.listFiles>>>(['files'], (current) => {
        if (!current) return current
        const updated = [file, ...current.files.filter((item) => item.id !== file.id)]
        return { files: updated, total: updated.length }
      })
      setSelectedFile(null)
      setUploadedName(file.original_filename)
      void queryClient.invalidateQueries({ queryKey: ['files'] })
    },
    onError: () => { void queryClient.invalidateQueries({ queryKey: ['files'] }) },
    onSettled: () => { mutationLock.current = false },
  })

  const load = useMutation({
    mutationFn: async (file: UploadedFile) => {
      const result = await api.loadDataset(file.id)
      if (result.dataset_id !== file.id) {
        throw new ApiError('The backend returned a different dataset ID.', 'invalid-response')
      }
      return result
    },
    onSuccess: (result, file) => {
      setLoadResults((current) => ({ ...current, [file.id]: result }))
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 404) {
        void queryClient.invalidateQueries({ queryKey: ['files'] })
      }
    },
    onSettled: () => { mutationLock.current = false },
  })

  const deletion = useMutation({
    mutationFn: (file: UploadedFile) => api.deleteFile(file.id),
    onSuccess: async (_result, file) => {
      await queryClient.cancelQueries({ queryKey: ['files'] })
      queryClient.setQueryData<Awaited<ReturnType<typeof api.listFiles>>>(['files'], (current) => {
        if (!current) return current
        const remaining = current.files.filter((item) => item.id !== file.id)
        return { files: remaining, total: remaining.length }
      })
      setLoadResults((current) => {
        const next = { ...current }
        delete next[file.id]
        return next
      })
      setUploadedName('')
      queryClient.removeQueries({ queryKey: ['file', file.id] })
      void queryClient.invalidateQueries({ queryKey: ['files'] })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      void queryClient.invalidateQueries({ queryKey: ['conversation'] })
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['files'] })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      void queryClient.invalidateQueries({ queryKey: ['conversation'] })
    },
    onSettled: () => {
      mutationLock.current = false
      onDeletePendingChange(false)
    },
  })

  const busy = upload.isPending || load.isPending || deletion.isPending

  function chooseFile(fileList: FileList | null) {
    setUploadedName('')
    upload.reset()
    if (!fileList || fileList.length !== 1) {
      setSelectedFile(null)
      setSelectionError('Choose exactly one file.')
      return
    }
    const file = fileList.item(0)
    if (!file || !/\.(csv|xlsx|xls)$/i.test(file.name)) {
      setSelectedFile(null)
      setSelectionError('Choose a CSV, XLSX, or XLS file.')
      return
    }
    setSelectionError('')
    setSelectedFile(file)
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files?.length) chooseFile(event.currentTarget.files)
    event.currentTarget.value = ''
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (busy || mutationLock.current) return
    chooseFile(event.dataTransfer.files)
  }

  function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedFile || busy || mutationLock.current) return
    mutationLock.current = true
    setUploadedName('')
    upload.mutate(selectedFile)
  }

  function loadFile(file: UploadedFile) {
    if (busy || mutationLock.current) return
    mutationLock.current = true
    load.mutate(file)
  }

  function deleteFile(file: UploadedFile) {
    if (busy || messagePending || mutationLock.current) return
    const count = conversations?.filter((item) => item.dataset_id === file.id).length ?? 0
    const association = conversationsUncertain
      ? 'Conversation associations could not be fully checked.'
      : `${count} currently listed conversation(s) reference this file. This information may change.`
    if (!window.confirm(
      `Delete "${file.original_filename}"? This permanently removes the file and clears its dataset association from any conversations. Conversations remain.\n\n${association}`,
    )) return
    mutationLock.current = true
    onDeletePendingChange(true)
    deletion.mutate(file)
  }

  return (
    <section className="dataset-library" aria-labelledby="dataset-title">
      <p className="eyebrow">YOUR DATA</p>
      <h1 id="dataset-title">Dataset library</h1>
      <p className="dataset-intro">Upload CSV or Excel files and inspect their metadata. Uploading or loading a file does not attach it to a conversation.</p>

      <form className="upload-form" onSubmit={uploadFile}>
        <div className="upload-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={dropFile}>
          <label htmlFor="dataset-file">Choose a file</label>
          <input id="dataset-file" type="file" accept=".csv,.xlsx,.xls" disabled={busy} onChange={selectFile} aria-describedby="dataset-upload-help dataset-selection" />
          <p id="dataset-upload-help">Choose or drop one CSV, XLSX, or XLS file. The backend checks the upload size.</p>
          <p id="dataset-selection" className="selected-file" role="status" aria-live="polite">
            {selectedFile ? `Selected: ${selectedFile.name} (${selectedFile.size.toLocaleString()} bytes)` : 'No file selected.'}
          </p>
        </div>
        {selectionError && <p className="upload-error" role="alert">{selectionError}</p>}
        {upload.isError && <p className="upload-error" role="alert">Upload failed. {upload.error.message} Your selection was kept. The backend may still have received the file; check the list before retrying.</p>}
        {uploadedName && <p className="upload-success" role="status">Uploaded {uploadedName}.</p>}
        <button className="primary-button" type="submit" disabled={!selectedFile || busy}>
          {upload.isPending ? 'Uploading...' : 'Upload file'}
        </button>
      </form>

      <div className="file-list-heading">
        <div>
          <p className="eyebrow">LIBRARY</p>
          <h2>Uploaded files</h2>
        </div>
      </div>
      {messagePending && <p className="chat-status">File deletion is unavailable while a message or dataset change is being processed.</p>}
      {files.isPending && <p className="chat-status" role="status">Loading files...</p>}
      {files.isError && (
        <div className="action-error" role="alert">
          <span>Could not load files. {files.error.message}</span>
          <button type="button" onClick={() => void files.refetch()}>Retry</button>
        </div>
      )}
      {deletion.isError && (
        <div className="action-error" role="alert">
          <span>Could not delete "{deletion.variables.original_filename}". {deletion.error.message} Check the file list before retrying.</span>
          <button type="button" onClick={() => deletion.reset()}>Dismiss</button>
        </div>
      )}
      {load.isError && (
        <div className="action-error" role="alert">
          <span>Could not load "{load.variables.original_filename}". {load.error.message}</span>
          <button type="button" onClick={() => load.reset()}>Dismiss</button>
        </div>
      )}
      {files.data && (
        files.data.files.length === 0 && !files.isError
          ? <p className="chat-status">No files uploaded yet.</p>
          : <ul className="file-list" aria-label="Uploaded files">
              {files.data.files.map((file) => {
                const result = loadResults[file.id]
                return <li className="file-card" key={file.id}>
                  <div className="file-card-heading">
                    <div>
                      <h3>{file.original_filename}</h3>
                      <p>{file.file_size.toLocaleString()} bytes · {file.content_type ?? 'Content type not provided'} · {formatDate(file.created_at)}</p>
                    </div>
                    <div className="file-actions">
                      <button className="secondary-button" type="button" disabled={busy} onClick={() => loadFile(file)} aria-label={`Load metadata for ${file.original_filename}`}>
                        {load.isPending && load.variables.id === file.id ? 'Loading...' : 'Load metadata'}
                      </button>
                      <button className="delete-button" type="button" disabled={busy || messagePending} onClick={() => deleteFile(file)} aria-label={`Delete ${file.original_filename}`}>
                        {deletion.isPending && deletion.variables.id === file.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                  {result && (
                    <div className="dataset-metadata">
                      <p className="metadata-label">Latest load result (this session)</p>
                      <p>{result.rows.toLocaleString()} rows · {result.columns.toLocaleString()} columns</p>
                      <p>Columns: {result.column_names.length ? result.column_names.join(', ') : 'None'}</p>
                    </div>
                  )}
                </li>
              })}
            </ul>
      )}
    </section>
  )
}
