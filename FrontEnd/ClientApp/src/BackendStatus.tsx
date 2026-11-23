import { useQuery } from '@tanstack/react-query'
import { api } from './api/client'

export function BackendStatus() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => api.health(signal),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const checking = health.isFetching
  const connected = !health.isError && health.data?.status === 'healthy'

  return (
    <div className="backend-status">
      <div role="status" aria-live="polite">
        <span className={`status-dot ${checking ? '' : connected ? 'status-connected' : 'status-unavailable'}`} aria-hidden="true" />
        {checking ? 'Checking backend' : connected ? 'Backend connected' : 'Backend unavailable'}
      </div>
      {!checking && !connected && (
        <div className="status-error">
          <span>{health.isError ? health.error.message : 'The backend did not report a healthy status.'}</span>
          <button type="button" onClick={() => void health.refetch()}>Retry</button>
        </div>
      )}
    </div>
  )
}
