import { useEffect, useState } from 'react'
import type { AppUpdateInfo, AppUpdateProgress } from '../../../shared/ipc'

type UpdateState =
  | { phase: 'idle' }
  | { phase: 'available'; info: AppUpdateInfo }
  | { phase: 'downloading'; info: AppUpdateInfo; progress: AppUpdateProgress }
  | { phase: 'ready'; info: AppUpdateInfo }
  | { phase: 'error'; message: string }

export function UpdateNotifier(): React.ReactElement | null {
  const [state, setState] = useState<UpdateState>({ phase: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const unsubs = [
      window.umbrella.onAppUpdateAvailable((info) => {
        setState({ phase: 'available', info })
        setDismissed(false)
      }),
      window.umbrella.onAppUpdateDownloadProgress((progress) => {
        setState((prev) => {
          const info = prev.phase === 'available' || prev.phase === 'downloading'
            ? prev.info
            : { version: '' }
          return { phase: 'downloading', info, progress }
        })
      }),
      window.umbrella.onAppUpdateDownloaded((info) => {
        setState({ phase: 'ready', info })
      }),
      window.umbrella.onAppUpdateError((message) => {
        setState({ phase: 'error', message })
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  if (dismissed || state.phase === 'idle') return null

  return (
    <div style={styles.banner} role="status" aria-live="polite">
      <BannerContent state={state} onDismiss={() => setDismissed(true)} />
    </div>
  )
}

function BannerContent({
  state,
  onDismiss,
}: {
  state: Exclude<UpdateState, { phase: 'idle' }>
  onDismiss: () => void
}): React.ReactElement {
  if (state.phase === 'available') {
    return (
      <>
        <span style={styles.dot} aria-hidden />
        <span style={styles.text}>
          Update <strong>v{state.info.version}</strong> available — downloading…
        </span>
        <button type="button" onClick={onDismiss} style={styles.dismiss} aria-label="Dismiss">×</button>
      </>
    )
  }

  if (state.phase === 'downloading') {
    const pct = Math.round(state.progress.percent)
    return (
      <>
        <span style={styles.dot} aria-hidden />
        <span style={styles.text}>Downloading v{state.info.version}…</span>
        <div style={styles.progressTrack} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ ...styles.progressFill, width: `${pct}%` }} />
        </div>
        <span style={styles.pct}>{pct}%</span>
      </>
    )
  }

  if (state.phase === 'ready') {
    return (
      <>
        <span style={{ ...styles.dot, background: '#4ade80' }} aria-hidden />
        <span style={styles.text}>
          <strong>v{state.info.version}</strong> ready — restart to install
        </span>
        <button
          type="button"
          style={styles.btnPrimary}
          onClick={() => void window.umbrella.installUpdate()}
        >
          Restart now
        </button>
        <button type="button" onClick={onDismiss} style={styles.dismiss} aria-label="Dismiss">×</button>
      </>
    )
  }

  // error
  return (
    <>
      <span style={{ ...styles.dot, background: '#f87171' }} aria-hidden />
      <span style={{ ...styles.text, color: '#f87171' }}>Update failed: {state.message}</span>
      <button type="button" onClick={onDismiss} style={styles.dismiss} aria-label="Dismiss">×</button>
    </>
  )
}

const styles = {
  banner: {
    position: 'fixed' as const,
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10000,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    borderRadius: 8,
    background: 'var(--color-background-primary, #30302e)',
    border: '1px solid var(--color-border-secondary, #3c3b38)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    fontSize: 13,
    color: 'var(--color-text-primary, #faf9f5)',
    minWidth: 280,
    maxWidth: 480,
    whiteSpace: 'nowrap' as const,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#3b82f6',
    flexShrink: 0,
  },
  text: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  progressTrack: {
    width: 80,
    height: 4,
    borderRadius: 2,
    background: 'var(--color-border-secondary, #3c3b38)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  progressFill: {
    height: '100%',
    background: '#3b82f6',
    borderRadius: 2,
    transition: 'width 0.2s ease',
  },
  pct: {
    fontSize: 11,
    color: 'var(--color-text-secondary, #a09f97)',
    width: 32,
    textAlign: 'right' as const,
  },
  btnPrimary: {
    padding: '4px 12px',
    borderRadius: 5,
    border: 'none',
    background: '#3b82f6',
    color: '#fff',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 600,
    flexShrink: 0,
  },
  dismiss: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-text-secondary, #a09f97)',
    fontSize: 16,
    lineHeight: 1,
    padding: 0,
    flexShrink: 0,
  },
} as const
